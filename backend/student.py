"""Student self-service: overview, courses, assignment hand-in, grades, attendance, report card."""
import os
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from extras import TERMS, card_data, pdf_response, report_pdf
from lms import (Assignment, Attendance, CourseItem, Submission, access_course, attendance_counts, ann_out, count, need,
                 upcoming_items, visible_announcements)
from main import ANY, STUDENT, Course, Student, User, get_db, s_out, utcnow
from quiz import me_student, my_quizzes

router = APIRouter(prefix="/api")

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
MAX_BYTES = 10 * 1024 * 1024
ALLOWED_EXT = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".png", ".jpg", ".jpeg", ".zip"}


def state_of(a: Assignment, s: Submission | None) -> str:
    if s and s.score is not None and s.status != "Missing":
        return "Graded"
    if s and s.status in ("Submitted", "Late"):
        return s.status
    return "Overdue" if a.due_date < date.today() else "To do"


def assignment_row(a: Assignment, c: Course, s: Submission | None):
    return dict(id=a.id, title=a.title, description=a.description, course_id=c.id, course_title=c.title, due_date=a.due_date.isoformat(),
                max_score=a.max_score, state=state_of(a, s), score=s.score if s else None, feedback=s.feedback if s else "",
                content=s.content if s else "", link=s.link if s else "", file_name=s.file_name if s else "",
                submission_id=s.id if s else None, submitted_at=s.submitted_at.isoformat() if s and s.submitted_at else None,
                locked=bool(s and s.score is not None and s.status != "Missing"))


def my_assignments(db: Session, st: Student, course_id: int | None = None):
    q = select(Assignment, Course).join(Course, Course.id == Assignment.course_id).where(Course.class_id == st.class_id)
    if course_id:
        q = q.where(Course.id == course_id)
    subs = {x.assignment_id: x for x in db.scalars(select(Submission).where(Submission.student_id == st.id))}
    return [assignment_row(a, c, subs.get(a.id)) for a, c in db.execute(q.order_by(Assignment.due_date))]


@router.get("/me/overview")
def overview(user: User = STUDENT, db: Session = Depends(get_db)):
    st = me_student(db, user)
    rows = my_assignments(db, st)
    quizzes = my_quizzes(db, st)
    return dict(student=s_out(st), average=card_data(db, st)["overall"],
                courses=count(db, Course.id, Course.class_id == st.class_id),
                todo=sum(1 for r in rows if r["state"] in ("To do", "Overdue")), overdue=sum(1 for r in rows if r["state"] == "Overdue"),
                quizzes_open=sum(1 for q in quizzes if q["can_attempt"]),
                attendance_rate=attendance_counts(db, st.id, date.today() - timedelta(days=30))["rate"],
                announcements=[ann_out(db, a, user) for a in visible_announcements(db, user, 3)],
                upcoming=upcoming_items(db, user))


@router.get("/me/courses/{cid}")
def my_course(cid: int, user: User = STUDENT, db: Session = Depends(get_db)):
    from lms import course_out
    st = me_student(db, user)
    c = access_course(db, user, cid, staff_only=False)
    items = db.scalars(select(CourseItem).where(CourseItem.course_id == cid).order_by(CourseItem.id)).all()
    return dict(**course_out(db, c), content=[dict(id=i.id, kind=i.kind, title=i.title, body=i.body, url=i.url) for i in items],
                assignment_list=my_assignments(db, st, cid), quiz_list=my_quizzes(db, st, cid))


@router.get("/me/assignments")
def assignments(user: User = STUDENT, db: Session = Depends(get_db)):
    return my_assignments(db, me_student(db, user))


@router.post("/me/assignments/{aid}/submit")
def submit(aid: int, content: str = Form(""), link: str = Form(""), file: UploadFile | None = File(None),
           user: User = STUDENT, db: Session = Depends(get_db)):
    st = me_student(db, user)
    a = need(db, Assignment, aid, "Assignment")
    c = db.get(Course, a.course_id)
    if not c or c.class_id != st.class_id:
        raise HTTPException(404, "Assignment not found")
    content, link = content.strip(), link.strip()
    if len(content) > 10000:
        raise HTTPException(400, "Your text is too long (10 000 characters maximum)")
    if link and not link.lower().startswith(("http://", "https://")):
        raise HTTPException(400, "The link must start with http:// or https://")
    sub = db.scalar(select(Submission).where(Submission.assignment_id == aid, Submission.student_id == st.id))
    if sub and sub.score is not None and sub.status != "Missing":
        raise HTTPException(400, "This assignment has already been graded and can no longer be changed")
    if not sub:
        sub = Submission(assignment_id=aid, student_id=st.id)
        db.add(sub)
    if file is not None and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, "File type not allowed (PDF, Office, image, text or ZIP)")
        data = file.file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(400, "File too large (10 MB maximum)")
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        stored = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(UPLOAD_DIR, stored), "wb") as fh:
            fh.write(data)
        if sub.file_path:
            try:
                os.remove(os.path.join(UPLOAD_DIR, sub.file_path))
            except OSError:
                pass
        sub.file_name, sub.file_path = os.path.basename(file.filename)[:255], stored
    if not (content or link or sub.file_name):
        raise HTTPException(400, "Add some text, a link or a file before submitting")
    sub.content, sub.link = content, link
    sub.status = "Late" if date.today() > a.due_date else "Submitted"
    sub.submitted_at = utcnow()
    db.commit()
    return assignment_row(a, c, sub)


@router.get("/submissions/{sid}/file")
def submission_file(sid: int, user: User = ANY, db: Session = Depends(get_db)):
    sub = need(db, Submission, sid, "Submission")
    if user.role == "student":
        if sub.student_id != user.student_id:
            raise HTTPException(403, "This file belongs to another student")
    else:
        access_course(db, user, db.get(Assignment, sub.assignment_id).course_id)
    path = os.path.join(UPLOAD_DIR, sub.file_path) if sub.file_path else ""
    if not path or not os.path.isfile(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path, filename=sub.file_name or "submission")


@router.get("/me/grades")
def grades(user: User = STUDENT, db: Session = Depends(get_db)):
    st = me_student(db, user)
    return dict(student=s_out(st), terms=TERMS, **card_data(db, st))


@router.get("/me/attendance")
def attendance(user: User = STUDENT, db: Session = Depends(get_db)):
    st = me_student(db, user)
    recent = db.scalars(select(Attendance).where(Attendance.student_id == st.id).order_by(Attendance.day.desc()).limit(30)).all()
    return dict(summary=attendance_counts(db, st.id), recent=[dict(day=r.day.isoformat(), status=r.status) for r in recent])


@router.get("/me/report-card.pdf")
def my_report_card(user: User = STUDENT, db: Session = Depends(get_db)):
    st = me_student(db, user)
    return pdf_response(report_pdf(db, st), f"report-card-{st.student_number}.pdf")
