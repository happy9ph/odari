"""Quizzes: built by teachers, taken and auto-graded for students."""
import random
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, delete, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from lms import access_course, class_students, count, need
from main import ANY, STAFF, STUDENT, Base, Course, Student, User, get_db, utcnow

router = APIRouter(prefix="/api")


class Quiz(Base):
    __tablename__ = "quizzes"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Question(Base):
    __tablename__ = "quiz_questions"
    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    points: Mapped[float] = mapped_column(Float, default=1)
    position: Mapped[int] = mapped_column(Integer, default=0)


class Option(Base):
    __tablename__ = "quiz_options"
    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(String(300))
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)


class Attempt(Base):
    __tablename__ = "quiz_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    score: Mapped[float] = mapped_column(Float)
    max_score: Mapped[float] = mapped_column(Float)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ------------------------------------------------------------------ schemas
class OptIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    is_correct: bool = False


class QuestionIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    points: float = Field(1, gt=0, le=100)
    options: list[OptIn] = Field(min_length=2, max_length=8)


class QuizIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str = ""
    due_date: date | None = None
    max_attempts: int = Field(1, ge=1, le=10)
    published: bool = False
    questions: list[QuestionIn] = Field(min_length=1, max_length=100)


class AttemptIn(BaseModel):
    answers: dict[str, int]


# ------------------------------------------------------------------ helpers
def questions_of(db: Session, qid: int):
    out = []
    for x in db.scalars(select(Question).where(Question.quiz_id == qid).order_by(Question.position, Question.id)):
        out.append((x, db.scalars(select(Option).where(Option.question_id == x.id).order_by(Option.id)).all()))
    return out


def total_points(db: Session, qid: int) -> float:
    return db.scalar(select(func.coalesce(func.sum(Question.points), 0)).where(Question.quiz_id == qid)) or 0


def write_questions(db: Session, q: Quiz, items: list[QuestionIn]):
    for pos, it in enumerate(items):
        if sum(o.is_correct for o in it.options) != 1:
            raise HTTPException(400, f"Question {pos + 1} needs exactly one correct answer")
    for pos, it in enumerate(items):
        qu = Question(quiz_id=q.id, text=it.text.strip(), points=it.points, position=pos)
        db.add(qu)
        db.flush()
        db.add_all(Option(question_id=qu.id, text=o.text.strip(), is_correct=o.is_correct) for o in it.options)


def staff_quiz(db: Session, user: User, qid: int) -> Quiz:
    q = need(db, Quiz, qid, "Quiz")
    access_course(db, user, q.course_id)
    return q


def quiz_summary(db: Session, q: Quiz):
    best = {}
    for a in db.scalars(select(Attempt).where(Attempt.quiz_id == q.id)):
        best[a.student_id] = max(best.get(a.student_id, 0), a.score / a.max_score * 100 if a.max_score else 0)
    return dict(id=q.id, title=q.title, description=q.description, due_date=q.due_date.isoformat() if q.due_date else None,
                max_attempts=q.max_attempts, published=q.published, questions=count(db, Question.id, Question.quiz_id == q.id),
                total_points=total_points(db, q.id), students_attempted=len(best),
                avg_percent=round(sum(best.values()) / len(best)) if best else None)


def quiz_full(db: Session, q: Quiz, reveal: bool = True):
    return dict(**quiz_summary(db, q), has_attempts=count(db, Attempt.id, Attempt.quiz_id == q.id) > 0,
                question_list=[dict(id=x.id, text=x.text, points=x.points,
                                    options=[dict(id=o.id, text=o.text, **({"is_correct": o.is_correct} if reveal else {})) for o in opts])
                               for x, opts in questions_of(db, q.id)])


# ------------------------------------------------------------------ teacher / admin
@router.get("/courses/{cid}/quizzes")
def list_quizzes(cid: int, user: User = STAFF, db: Session = Depends(get_db)):
    access_course(db, user, cid)
    return [quiz_summary(db, q) for q in db.scalars(select(Quiz).where(Quiz.course_id == cid).order_by(Quiz.id.desc()))]


@router.post("/courses/{cid}/quizzes", status_code=201)
def create_quiz(cid: int, d: QuizIn, user: User = STAFF, db: Session = Depends(get_db)):
    access_course(db, user, cid)
    q = Quiz(course_id=cid, title=d.title.strip(), description=d.description, due_date=d.due_date, max_attempts=d.max_attempts, published=d.published)
    db.add(q)
    db.flush()
    write_questions(db, q, d.questions)
    db.commit()
    return quiz_summary(db, q)


@router.get("/quizzes/{qid}")
def get_quiz(qid: int, user: User = STAFF, db: Session = Depends(get_db)):
    return quiz_full(db, staff_quiz(db, user, qid))


@router.put("/quizzes/{qid}")
def update_quiz(qid: int, d: QuizIn, user: User = STAFF, db: Session = Depends(get_db)):
    q = staff_quiz(db, user, qid)
    q.title, q.description, q.due_date, q.max_attempts, q.published = d.title.strip(), d.description, d.due_date, d.max_attempts, d.published
    if not count(db, Attempt.id, Attempt.quiz_id == qid):  # questions are locked once students have attempted
        db.execute(delete(Question).where(Question.quiz_id == qid))
        write_questions(db, q, d.questions)
    db.commit()
    return quiz_summary(db, q)


@router.post("/quizzes/{qid}/publish")
def toggle_publish(qid: int, user: User = STAFF, db: Session = Depends(get_db)):
    q = staff_quiz(db, user, qid)
    q.published = not q.published
    db.commit()
    return {"published": q.published}


@router.delete("/quizzes/{qid}", status_code=204)
def delete_quiz(qid: int, user: User = STAFF, db: Session = Depends(get_db)):
    db.delete(staff_quiz(db, user, qid))
    db.commit()


@router.get("/quizzes/{qid}/results")
def quiz_results(qid: int, user: User = STAFF, db: Session = Depends(get_db)):
    q = staff_quiz(db, user, qid)
    course = db.get(Course, q.course_id)
    qs = questions_of(db, qid)
    total = sum(x.points for x, _ in qs)
    attempts = db.scalars(select(Attempt).where(Attempt.quiz_id == qid).order_by(Attempt.submitted_at)).all()
    by = {}
    for a in attempts:
        by.setdefault(a.student_id, []).append(a)
    rows = []
    for s in class_students(db, course.class_id):
        mine = by.get(s.id, [])
        best = max(mine, key=lambda a: a.score) if mine else None
        rows.append(dict(student_id=s.id, student_number=s.student_number, full_name=s.full_name, attempts=len(mine),
                         best=best.score if best else None, last_at=mine[-1].submitted_at.isoformat() if mine else None))
    stats = []
    for x, opts in qs:
        right = next((o.id for o in opts if o.is_correct), None)
        ok = sum(1 for a in attempts if a.answers.get(str(x.id)) == right)
        stats.append(dict(id=x.id, text=x.text, answered=len(attempts), correct=ok, percent=round(ok / len(attempts) * 100) if attempts else None))
    return dict(quiz=quiz_summary(db, q), total=total, rows=rows, questions=stats)


# ------------------------------------------------------------------ student
def me_student(db: Session, user: User) -> Student:
    s = db.get(Student, user.student_id) if user.student_id else None
    if not s:
        raise HTTPException(403, "No student profile is linked to this account")
    return s


def student_quiz(db: Session, user: User, qid: int):
    s = me_student(db, user)
    q = db.get(Quiz, qid)
    c = db.get(Course, q.course_id) if q else None
    if not q or not q.published or not c or c.class_id != s.class_id:
        raise HTTPException(404, "Quiz not found")
    return s, q, c


def my_attempts(db: Session, qid: int, sid: int):
    return db.scalars(select(Attempt).where(Attempt.quiz_id == qid, Attempt.student_id == sid).order_by(Attempt.submitted_at)).all()


def my_quiz_row(db: Session, q: Quiz, c: Course, sid: int):
    mine = my_attempts(db, q.id, sid)
    closed = bool(q.due_date and date.today() > q.due_date)
    total = total_points(db, q.id)
    best = max((a.score for a in mine), default=None)
    return dict(id=q.id, title=q.title, description=q.description, course_id=c.id, course_title=c.title,
                due_date=q.due_date.isoformat() if q.due_date else None, questions=count(db, Question.id, Question.quiz_id == q.id),
                total_points=total, max_attempts=q.max_attempts, attempts_used=len(mine), best=best, closed=closed,
                can_attempt=not closed and len(mine) < q.max_attempts)


def my_quizzes(db: Session, s: Student, course_id: int | None = None):
    qry = select(Quiz, Course).join(Course, Course.id == Quiz.course_id).where(Course.class_id == s.class_id, Quiz.published.is_(True))
    if course_id:
        qry = qry.where(Course.id == course_id)
    return [my_quiz_row(db, q, c, s.id) for q, c in db.execute(qry.order_by(Quiz.id.desc()))]


def review(db: Session, q: Quiz, a: Attempt):
    out = []
    for x, opts in questions_of(db, q.id):
        right = next((o.id for o in opts if o.is_correct), None)
        chosen = a.answers.get(str(x.id))
        out.append(dict(question_id=x.id, text=x.text, points=x.points, earned=x.points if chosen == right else 0,
                        chosen_id=chosen, correct_id=right, options=[dict(id=o.id, text=o.text) for o in opts]))
    return out


@router.get("/me/quizzes")
def my_quiz_list(user: User = STUDENT, db: Session = Depends(get_db)):
    return my_quizzes(db, me_student(db, user))


@router.get("/me/quizzes/{qid}")
def my_quiz(qid: int, user: User = STUDENT, db: Session = Depends(get_db)):
    s, q, c = student_quiz(db, user, qid)
    mine = my_attempts(db, qid, s.id)
    return dict(**my_quiz_row(db, q, c, s.id),
                question_list=[dict(id=x.id, text=x.text, points=x.points, options=[dict(id=o.id, text=o.text) for o in opts]) for x, opts in questions_of(db, qid)],
                attempts=[dict(id=a.id, score=a.score, max_score=a.max_score, submitted_at=a.submitted_at.isoformat()) for a in mine],
                last_review=review(db, q, mine[-1]) if mine else None)


@router.post("/me/quizzes/{qid}/attempt")
def submit_attempt(qid: int, d: AttemptIn, user: User = STUDENT, db: Session = Depends(get_db)):
    s, q, c = student_quiz(db, user, qid)
    if q.due_date and date.today() > q.due_date:
        raise HTTPException(400, "This quiz is closed")
    if len(my_attempts(db, qid, s.id)) >= q.max_attempts:
        raise HTTPException(400, "You have no attempts left for this quiz")
    qs = questions_of(db, qid)
    answers, score = {}, 0.0
    for x, opts in qs:
        chosen = d.answers.get(str(x.id))
        if chosen is not None and chosen in {o.id for o in opts}:
            answers[str(x.id)] = chosen
            if any(o.id == chosen and o.is_correct for o in opts):
                score += x.points
    a = Attempt(quiz_id=qid, student_id=s.id, score=score, max_score=sum(x.points for x, _ in qs), answers=answers)
    db.add(a)
    db.commit()
    return dict(attempt_id=a.id, score=a.score, max_score=a.max_score, review=review(db, q, a))


# ------------------------------------------------------------------ demo data
DEMO = {
    "MAT": [("What is 7 x 8?", ["54", "56", "58", "64"], 1), ("Solve: 2x + 6 = 14. What is x?", ["3", "4", "5", "6"], 1),
            ("Area of a rectangle 5 m by 3 m?", ["8 square metres", "15 square metres", "16 square metres", "30 square metres"], 1)],
    "FRA": [("Which word is a verb?", ["maison", "courir", "rapide", "table"], 1), ("Choose the correct article: ___ ecole", ["le", "la", "l'", "les"], 2),
            ("What is the plural of 'cheval'?", ["chevals", "chevaux", "chevales", "chevaus"], 1)],
    "SCI": [("Which gas do plants absorb for photosynthesis?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], 2),
            ("At sea level, water boils at?", ["50 C", "90 C", "100 C", "120 C"], 2), ("Which organ pumps blood?", ["Lungs", "Heart", "Liver", "Kidney"], 1)],
}


def seed_quizzes(db: Session):
    if db.scalar(select(func.count(Quiz.id))):
        return
    rnd = random.Random(5)
    for c in db.scalars(select(Course)):
        items = DEMO.get(c.code.split("-")[0])
        if not items:
            continue
        q = Quiz(course_id=c.id, title="Chapter 1 quiz", description="Five minutes, one question at a time. Good luck.", max_attempts=2, published=True)
        db.add(q)
        db.flush()
        correct = {}
        for pos, (text, opts, right) in enumerate(items):
            qu = Question(quiz_id=q.id, text=text, points=2, position=pos)
            db.add(qu)
            db.flush()
            ids = []
            for i, o in enumerate(opts):
                op = Option(question_id=qu.id, text=o, is_correct=i == right)
                db.add(op)
                db.flush()
                ids.append(op.id)
            correct[qu.id] = (ids, ids[right])
        for s in class_students(db, c.class_id):
            if rnd.random() < .6:
                ans, score = {}, 0.0
                for qid, (ids, right) in correct.items():
                    pick = right if rnd.random() < .7 else rnd.choice(ids)
                    ans[str(qid)] = pick
                    score += 2 if pick == right else 0
                db.add(Attempt(quiz_id=q.id, student_id=s.id, score=score, max_score=2 * len(items), answers=ans))
    db.commit()
