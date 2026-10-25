"""Learning management: courses, content, assignments, attendance, announcements, calendar (role-aware)."""
import random
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, func, or_, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from main import (ADMIN, ANY, STAFF, Base, Course, SchoolClass, Student, User, check_students, get_db, hash_pw,
                  need_class, scope, teacher_username, utcnow)

router = APIRouter(prefix="/api")

ITEM_KINDS = ["Lesson", "File", "Video", "Link", "Note"]
SUB_STATUS = ["Missing", "Submitted", "Late"]
ATT_STATUS = ["Present", "Absent", "Late", "Excused"]
EVENT_KINDS = ["Exam", "Holiday", "Meeting", "Event"]
COLORS = ["blue", "emerald", "amber", "rose", "violet", "sky"]


class CourseItem(Base):
    __tablename__ = "course_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[date] = mapped_column(Date)
    max_score: Mapped[float] = mapped_column(Float, default=20)


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="Missing")
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str] = mapped_column(String(500), default="")
    file_name: Mapped[str] = mapped_column(String(255), default="")
    file_path: Mapped[str] = mapped_column(String(500), default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(Text)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "day"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20))


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    day: Mapped[date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(20), default="Event")
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)


# ------------------------------------------------------------------ schemas
class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=30)
    class_id: int
    teacher_id: int | None = None
    description: str = ""
    color: str = "blue"


class ItemIn(BaseModel):
    kind: str
    title: str = Field(min_length=1, max_length=150)
    body: str = ""
    url: str = Field("", max_length=500)


class AssignmentIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str = ""
    due_date: date
    max_score: float = Field(20, gt=0, le=1000)


class SubIn(BaseModel):
    student_id: int
    status: str = "Missing"
    score: float | None = Field(None, ge=0)
    feedback: str = ""


class AnnIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1)
    class_id: int | None = None
    pinned: bool = False


class AttRec(BaseModel):
    student_id: int
    status: str | None = None


class AttIn(BaseModel):
    day: date
    records: list[AttRec]


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    day: date
    kind: str = "Event"
    class_id: int | None = None


# ------------------------------------------------------------------ helpers
def need(db: Session, model, oid: int, label: str):
    o = db.get(model, oid)
    if not o:
        raise HTTPException(404, f"{label} not found")
    return o


def class_students(db: Session, cid: int):
    return db.scalars(select(Student).where(Student.class_id == cid).order_by(Student.full_name)).all()


def count(db: Session, col, *where):
    return db.scalar(select(func.count(col)).where(*where)) or 0


def access_course(db: Session, user: User, cid: int, staff_only: bool = True) -> Course:
    """Admin: any course. Teacher: own courses. Student (staff_only=False): courses of their class."""
    c = need(db, Course, cid, "Course")
    if user.role == "admin" or (user.role == "teacher" and c.teacher_id == user.id):
        return c
    if user.role == "student" and not staff_only:
        s = db.get(Student, user.student_id) if user.student_id else None
        if s and s.class_id == c.class_id:
            return c
    raise HTTPException(403, "You do not have access to this course")


def course_filter(db: Session, user: User) -> list:
    if user.role == "admin":
        return []
    if user.role == "teacher":
        return [Course.teacher_id == user.id]
    s = db.get(Student, user.student_id) if user.student_id else None
    return [Course.class_id == (s.class_id if s else -1)]


def course_out(db: Session, c: Course):
    cls = db.get(SchoolClass, c.class_id)
    t = db.get(User, c.teacher_id) if c.teacher_id else None
    return dict(id=c.id, title=c.title, code=c.code, teacher=t.full_name if t else c.teacher, teacher_id=c.teacher_id,
                description=c.description, color=c.color, class_id=c.class_id, class_name=cls.name if cls else "-",
                students=count(db, Student.id, Student.class_id == c.class_id),
                items=count(db, CourseItem.id, CourseItem.course_id == c.id),
                assignments=count(db, Assignment.id, Assignment.course_id == c.id))


def assign_out(db: Session, a: Assignment, total: int):
    done = count(db, Submission.id, Submission.assignment_id == a.id, Submission.status != "Missing")
    graded = count(db, Submission.id, Submission.assignment_id == a.id, Submission.score.is_not(None))
    return dict(id=a.id, course_id=a.course_id, title=a.title, description=a.description, due_date=a.due_date.isoformat(),
                max_score=a.max_score, submitted=done, graded=graded, total=total, overdue=a.due_date < date.today())


def ann_out(db: Session, a: Announcement, user: User):
    cls = db.get(SchoolClass, a.class_id) if a.class_id else None
    au = db.get(User, a.author_id) if a.author_id else None
    return dict(id=a.id, title=a.title, body=a.body, pinned=a.pinned, class_id=a.class_id,
                class_name=cls.name if cls else "All classes", author=au.full_name if au else "Administration",
                created_at=a.created_at.isoformat(), can_delete=user.role == "admin" or a.author_id == user.id)


def check_class(db: Session, cid: int | None):
    if cid is not None and not db.get(SchoolClass, cid):
        raise HTTPException(400, "Selected class does not exist")


def visible_announcements(db: Session, user: User, limit: int | None = None):
    q = select(Announcement).order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
    ids = scope(db, user)
    if ids is not None:
        q = q.where(or_(Announcement.class_id.is_(None), Announcement.class_id.in_(ids or [0])))
    return db.scalars(q.limit(limit) if limit else q).all()


def upcoming_items(db: Session, user: User, limit: int = 6):
    from quiz import Quiz
    today, ids = date.today(), scope(db, user)
    eq = select(Event).where(Event.day >= today)
    if ids is not None:
        eq = eq.where(or_(Event.class_id.is_(None), Event.class_id.in_(ids or [0])))
    out = [dict(day=e.day.isoformat(), title=e.title, kind=e.kind) for e in db.scalars(eq.order_by(Event.day).limit(limit))]
    aq = (select(Assignment).join(Course, Course.id == Assignment.course_id)
          .where(Assignment.due_date >= today, *course_filter(db, user)).order_by(Assignment.due_date).limit(limit))
    out += [dict(day=a.due_date.isoformat(), title=f"Due: {a.title}", kind="Assignment") for a in db.scalars(aq)]
    qq = (select(Quiz).join(Course, Course.id == Quiz.course_id)
          .where(Quiz.due_date.is_not(None), Quiz.due_date >= today, *course_filter(db, user)).order_by(Quiz.due_date).limit(limit))
    if user.role == "student":
        qq = qq.where(Quiz.published.is_(True))
    out += [dict(day=q.due_date.isoformat(), title=f"Quiz closes: {q.title}", kind="Quiz") for q in db.scalars(qq)]
    return sorted(out, key=lambda x: x["day"])[:limit]


# ------------------------------------------------------------------ courses
def apply_course(db: Session, c: Course, d: CourseIn):
    check_class(db, d.class_id)
    t = None
    if d.teacher_id is not None:
        t = db.get(User, d.teacher_id)
        if not t or t.role != "teacher":
            raise HTTPException(400, "Selected teacher does not exist")
    c.title, c.code, c.class_id, c.description, c.color = d.title.strip(), d.code.strip(), d.class_id, d.description, d.color
    c.teacher_id, c.teacher = d.teacher_id, t.full_name if t else ""


@router.get("/courses")
def list_courses(class_id: int | None = None, user: User = ANY, db: Session = Depends(get_db)):
    q = select(Course).where(*course_filter(db, user)).order_by(Course.class_id, Course.title)
    if class_id:
        q = q.where(Course.class_id == class_id)
    return [course_out(db, c) for c in db.scalars(q)]


@router.post("/courses", status_code=201)
def create_course(d: CourseIn, user: User = ADMIN, db: Session = Depends(get_db)):
    c = Course()
    apply_course(db, c, d)
    db.add(c)
    db.commit()
    return course_out(db, c)


@router.put("/courses/{cid}")
def update_course(cid: int, d: CourseIn, user: User = ADMIN, db: Session = Depends(get_db)):
    c = need(db, Course, cid, "Course")
    apply_course(db, c, d)
    db.commit()
    return course_out(db, c)


@router.delete("/courses/{cid}", status_code=204)
def delete_course(cid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    db.delete(need(db, Course, cid, "Course"))
    db.commit()


@router.get("/courses/{cid}")
def get_course(cid: int, user: User = STAFF, db: Session = Depends(get_db)):
    c = access_course(db, user, cid)
    studs = class_students(db, c.class_id)
    items = db.scalars(select(CourseItem).where(CourseItem.course_id == cid).order_by(CourseItem.id)).all()
    asg = db.scalars(select(Assignment).where(Assignment.course_id == cid).order_by(Assignment.due_date.desc())).all()
    return dict(**course_out(db, c),
                content=[dict(id=i.id, kind=i.kind, title=i.title, body=i.body, url=i.url, created_at=i.created_at.isoformat()) for i in items],
                assignment_list=[assign_out(db, a, len(studs)) for a in asg],
                participants=[dict(id=s.id, student_number=s.student_number, full_name=s.full_name, status=s.status) for s in studs])


@router.post("/courses/{cid}/items", status_code=201)
def add_item(cid: int, d: ItemIn, user: User = STAFF, db: Session = Depends(get_db)):
    access_course(db, user, cid)
    if d.kind not in ITEM_KINDS:
        raise HTTPException(400, "Unknown content type")
    db.add(CourseItem(course_id=cid, **d.model_dump()))
    db.commit()
    return {"ok": True}


@router.delete("/items/{iid}", status_code=204)
def delete_item(iid: int, user: User = STAFF, db: Session = Depends(get_db)):
    i = need(db, CourseItem, iid, "Item")
    access_course(db, user, i.course_id)
    db.delete(i)
    db.commit()


# ------------------------------------------------------------------ assignments
def staff_assignment(db: Session, user: User, aid: int) -> Assignment:
    a = need(db, Assignment, aid, "Assignment")
    access_course(db, user, a.course_id)
    return a


@router.post("/courses/{cid}/assignments", status_code=201)
def add_assignment(cid: int, d: AssignmentIn, user: User = STAFF, db: Session = Depends(get_db)):
    access_course(db, user, cid)
    db.add(Assignment(course_id=cid, **d.model_dump()))
    db.commit()
    return {"ok": True}


@router.put("/assignments/{aid}")
def update_assignment(aid: int, d: AssignmentIn, user: User = STAFF, db: Session = Depends(get_db)):
    a = staff_assignment(db, user, aid)
    for k, v in d.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/assignments/{aid}", status_code=204)
def delete_assignment(aid: int, user: User = STAFF, db: Session = Depends(get_db)):
    db.delete(staff_assignment(db, user, aid))
    db.commit()


@router.get("/assignments/{aid}/submissions")
def get_submissions(aid: int, user: User = STAFF, db: Session = Depends(get_db)):
    a = staff_assignment(db, user, aid)
    c = db.get(Course, a.course_id)
    subs = {s.student_id: s for s in db.scalars(select(Submission).where(Submission.assignment_id == aid))}
    rows = []
    for st in class_students(db, c.class_id):
        s = subs.get(st.id)
        rows.append(dict(student_id=st.id, student_number=st.student_number, full_name=st.full_name,
                         status=s.status if s else "Missing", score=s.score if s else None, feedback=s.feedback if s else "",
                         content=s.content if s else "", link=s.link if s else "", file_name=s.file_name if s else "",
                         submission_id=s.id if s else None, submitted_at=s.submitted_at.isoformat() if s and s.submitted_at else None))
    return dict(assignment=assign_out(db, a, len(rows)), rows=rows)


@router.put("/assignments/{aid}/submissions")
def save_submissions(aid: int, rows: list[SubIn], user: User = STAFF, db: Session = Depends(get_db)):
    a = staff_assignment(db, user, aid)
    check_students(db, user, [r.student_id for r in rows])
    ex = {s.student_id: s for s in db.scalars(select(Submission).where(Submission.assignment_id == aid))}
    for r in rows:
        if r.status not in SUB_STATUS:
            raise HTTPException(400, "Unknown submission status")
        if r.score is not None and r.score > a.max_score:
            raise HTTPException(400, f"Score cannot exceed {a.max_score:g}")
        s = ex.get(r.student_id) or Submission(assignment_id=aid, student_id=r.student_id)
        s.status, s.score, s.feedback = r.status, r.score, r.feedback.strip()
        db.add(s)
    db.commit()
    return {"saved": len(rows)}


# ------------------------------------------------------------------ announcements
@router.get("/announcements")
def list_announcements(user: User = ANY, db: Session = Depends(get_db)):
    return [ann_out(db, a, user) for a in visible_announcements(db, user)]


@router.post("/announcements", status_code=201)
def add_announcement(d: AnnIn, user: User = STAFF, db: Session = Depends(get_db)):
    check_class(db, d.class_id)
    if user.role == "teacher":
        if d.class_id is None:
            raise HTTPException(400, "Choose one of your classes")
        need_class(db, user, d.class_id)
    a = Announcement(**d.model_dump(), author_id=user.id)
    if user.role == "teacher":
        a.pinned = False
    db.add(a)
    db.commit()
    return ann_out(db, a, user)


@router.put("/announcements/{aid}/pin")
def toggle_pin(aid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    a = need(db, Announcement, aid, "Announcement")
    a.pinned = not a.pinned
    db.commit()
    return {"pinned": a.pinned}


@router.delete("/announcements/{aid}", status_code=204)
def delete_announcement(aid: int, user: User = STAFF, db: Session = Depends(get_db)):
    a = need(db, Announcement, aid, "Announcement")
    if user.role != "admin" and a.author_id != user.id:
        raise HTTPException(403, "You can only delete your own announcements")
    db.delete(a)
    db.commit()


# ------------------------------------------------------------------ attendance
@router.get("/attendance")
def get_attendance(class_id: int, day: date, user: User = STAFF, db: Session = Depends(get_db)):
    need_class(db, user, class_id)
    studs = class_students(db, class_id)
    rec = {a.student_id: a.status for a in db.scalars(select(Attendance).where(
        Attendance.day == day, Attendance.student_id.in_([s.id for s in studs] or [0])))}
    return [dict(student_id=s.id, student_number=s.student_number, full_name=s.full_name, status=rec.get(s.id)) for s in studs]


@router.put("/attendance")
def save_attendance(d: AttIn, user: User = STAFF, db: Session = Depends(get_db)):
    check_students(db, user, [r.student_id for r in d.records])
    ex = {a.student_id: a for a in db.scalars(select(Attendance).where(Attendance.day == d.day))}
    for r in d.records:
        a = ex.get(r.student_id)
        if r.status is None:
            if a:
                db.delete(a)
            continue
        if r.status not in ATT_STATUS:
            raise HTTPException(400, "Unknown attendance status")
        if a:
            a.status = r.status
        else:
            db.add(Attendance(student_id=r.student_id, day=d.day, status=r.status))
    db.commit()
    return {"saved": len(d.records)}


def attendance_counts(db: Session, student_id: int, since: date | None = None) -> dict:
    q = select(Attendance.status, func.count()).where(Attendance.student_id == student_id).group_by(Attendance.status)
    if since:
        q = q.where(Attendance.day >= since)
    c = {k: 0 for k in ATT_STATUS}
    for st, n in db.execute(q):
        c[st] = n
    total = sum(c.values())
    return dict(**{k.lower(): v for k, v in c.items()}, total=total,
                rate=round((c["Present"] + c["Late"]) / total * 100) if total else None)


@router.get("/attendance/summary")
def attendance_summary(class_id: int, user: User = STAFF, db: Session = Depends(get_db)):
    need_class(db, user, class_id)
    return [dict(student_id=s.id, student_number=s.student_number, full_name=s.full_name, **attendance_counts(db, s.id))
            for s in class_students(db, class_id)]


# ------------------------------------------------------------------ calendar & overview
@router.get("/calendar")
def calendar(month: str, user: User = ANY, db: Session = Depends(get_db)):
    from quiz import Quiz
    try:
        y, m = map(int, month.split("-"))
        start = date(y, m, 1)
    except ValueError:
        raise HTTPException(400, "month must be YYYY-MM")
    end = date(y + (m == 12), m % 12 + 1, 1)
    ids = scope(db, user)
    eq = select(Event).where(Event.day >= start, Event.day < end)
    if ids is not None:
        eq = eq.where(or_(Event.class_id.is_(None), Event.class_id.in_(ids or [0])))
    out = []
    for e in db.scalars(eq):
        cls = db.get(SchoolClass, e.class_id) if e.class_id else None
        out.append(dict(id=e.id, day=e.day.isoformat(), title=e.title, kind=e.kind, class_name=cls.name if cls else "All classes",
                        deletable=user.role == "admin"))
    aq = select(Assignment, Course).join(Course, Course.id == Assignment.course_id).where(
        Assignment.due_date >= start, Assignment.due_date < end, *course_filter(db, user))
    for a, c in db.execute(aq):
        out.append(dict(id=None, day=a.due_date.isoformat(), title=f"Due: {a.title}", kind="Assignment", class_name=c.title, deletable=False))
    qq = select(Quiz, Course).join(Course, Course.id == Quiz.course_id).where(
        Quiz.due_date.is_not(None), Quiz.due_date >= start, Quiz.due_date < end, *course_filter(db, user))
    if user.role == "student":
        qq = qq.where(Quiz.published.is_(True))
    for q, c in db.execute(qq):
        out.append(dict(id=None, day=q.due_date.isoformat(), title=f"Quiz closes: {q.title}", kind="Quiz", class_name=c.title, deletable=False))
    return sorted(out, key=lambda x: x["day"])


@router.post("/events", status_code=201)
def add_event(d: EventIn, user: User = ADMIN, db: Session = Depends(get_db)):
    check_class(db, d.class_id)
    if d.kind not in EVENT_KINDS:
        raise HTTPException(400, "Unknown event type")
    db.add(Event(**d.model_dump()))
    db.commit()
    return {"ok": True}


@router.delete("/events/{eid}", status_code=204)
def delete_event(eid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    db.delete(need(db, Event, eid, "Event"))
    db.commit()


@router.get("/lms/overview")
def overview(user: User = STAFF, db: Session = Depends(get_db)):
    today = date.today()
    cf = course_filter(db, user)
    cids = select(Course.id).where(*cf)
    asg_ids = select(Assignment.id).where(Assignment.course_id.in_(cids))
    ids = scope(db, user)
    stud_ids = select(Student.id).where(*([] if ids is None else [Student.class_id.in_(ids or [0])]))
    att = [Attendance.day >= today - timedelta(days=30), Attendance.student_id.in_(stud_ids)]
    present = count(db, Attendance.id, *att, Attendance.status.in_(["Present", "Late"]))
    total = count(db, Attendance.id, *att)
    return dict(
        courses=count(db, Course.id, *cf),
        open_assignments=count(db, Assignment.id, Assignment.due_date >= today, Assignment.course_id.in_(cids)),
        to_grade=count(db, Submission.id, Submission.status != "Missing", Submission.score.is_(None), Submission.assignment_id.in_(asg_ids)),
        attendance_rate=round(present / total * 100) if total else None,
        announcements=[ann_out(db, a, user) for a in visible_announcements(db, user, 3)],
        upcoming=upcoming_items(db, user))


# ------------------------------------------------------------------ demo data & migration
def link_teachers(db: Session):
    """Give every course a real teacher account (created on the fly for legacy name-only courses)."""
    names = {n for (n,) in db.execute(select(Course.teacher).where(Course.teacher_id.is_(None), Course.teacher != "")).all()}
    if not names:
        return
    h = hash_pw("teacher123")
    for name in sorted(names):
        t = db.scalar(select(User).where(User.role == "teacher", User.full_name == name))
        if not t:
            t = User(username=teacher_username(db, name), full_name=name, role="teacher", password_hash=h, must_change_password=True)
            db.add(t)
            db.flush()
        for c in db.scalars(select(Course).where(Course.teacher_id.is_(None), Course.teacher == name)):
            c.teacher_id = t.id
    db.commit()


def seed_lms(db: Session):
    if db.scalar(select(func.count(Course.id))):
        return
    rnd = random.Random(11)
    today = date.today()
    teachers = ["Prof. Kalala", "Mme Nsimba", "M. Mukendi", "Mme Ilunga"]
    subjects = [("Mathematics", "MAT"), ("French", "FRA"), ("Science", "SCI")]
    for cls in db.scalars(select(SchoolClass).order_by(SchoolClass.id)):
        studs = class_students(db, cls.id)
        for k, (sub, code) in enumerate(subjects):
            c = Course(title=f"{sub} - {cls.name}", code=f"{code}-{cls.name.replace(' ', '')}", teacher=rnd.choice(teachers),
                       description=f"Weekly {sub.lower()} programme for {cls.name} ({cls.academic_year}).", color=COLORS[(cls.id + k) % len(COLORS)], class_id=cls.id)
            db.add(c)
            db.flush()
            db.add_all([
                CourseItem(course_id=c.id, kind="Lesson", title="Chapter 1 - Introduction", body="Objectives, key vocabulary and worked examples for the first chapter."),
                CourseItem(course_id=c.id, kind="File", title="Course syllabus (PDF)", url="https://example.org/syllabus.pdf"),
                CourseItem(course_id=c.id, kind="Video", title="Revision video - Chapter 1", url="https://example.org/video"),
            ])
            for n, (title, off) in enumerate([("Homework 1", -10), ("Quiz - Chapter 1", -3), ("Project work", 9)]):
                a = Assignment(course_id=c.id, title=title, description="Complete all questions and hand in on the due date.",
                               due_date=today + timedelta(days=off + k), max_score=20 if n != 1 else 10)
                db.add(a)
                db.flush()
                if off < 0:
                    for s in studs:
                        st = rnd.choices(SUB_STATUS, [1, 7, 2])[0]
                        graded = st != "Missing" and (off < -5 or rnd.random() < .5)
                        db.add(Submission(assignment_id=a.id, student_id=s.id, status=st,
                                          score=round(rnd.uniform(.4, .95) * a.max_score * 4) / 4 if graded else (0 if st == "Missing" else None),
                                          content="" if st == "Missing" else "Completed all the exercises.",
                                          submitted_at=None if st == "Missing" else utcnow() - timedelta(days=abs(off) - 1),
                                          feedback="Good work, keep it up." if graded and rnd.random() < .3 else ""))
    d, n = today, 0
    studs = db.scalars(select(Student)).all()
    while n < 14:
        d -= timedelta(days=1)
        if d.weekday() >= 5:
            continue
        n += 1
        for s in studs:
            db.add(Attendance(student_id=s.id, day=d, status=rnd.choices(ATT_STATUS, [88, 5, 5, 2])[0]))
    db.add_all([
        Announcement(title="Welcome to the new academic year", body="Classes start at 7:30. Please make sure every student has their textbooks and uniform.", pinned=True),
        Announcement(title="Parents' meeting", body="A parents' meeting will take place on Saturday at 10:00 in the main hall.", created_at=utcnow() - timedelta(days=2)),
        Announcement(title="Term 1 exams timetable", body="The exam timetable is now available. Revision sessions run every afternoon.", created_at=utcnow() - timedelta(days=5)),
    ])
    db.add_all([
        Event(title="Term 1 exams begin", day=today + timedelta(days=12), kind="Exam"),
        Event(title="Parents' meeting", day=today + timedelta(days=(5 - today.weekday()) % 7 or 7), kind="Meeting"),
        Event(title="Public holiday", day=today + timedelta(days=20), kind="Holiday"),
        Event(title="Sports day", day=today + timedelta(days=27), kind="Event"),
    ])
    db.commit()
