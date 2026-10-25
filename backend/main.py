"""Hodari School - Student Record Management System (FastAPI + PostgreSQL)."""
import math, os, re, secrets, time, unicodedata
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

import bcrypt, jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, create_engine, delete, func, or_, select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, joinedload, mapped_column, relationship, sessionmaker

DB_URL = os.getenv("DATABASE_URL", "postgresql://hodari:hodari@localhost:5432/hodari")
SECRET = os.getenv("SECRET_KEY", "dev-secret")
engine = create_engine(DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
utcnow = lambda: datetime.now(timezone.utc)
DEFAULT_STUDENT_PW = "12345"
MAX_FAILS, LOCK_MINUTES = 5, 10


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    full_name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="admin")
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SchoolClass(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    academic_year: Mapped[str] = mapped_column(String(20))
    students: Mapped[list["Student"]] = relationship(back_populates="school_class")


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_number: Mapped[str] = mapped_column(String(20), unique=True)
    full_name: Mapped[str] = mapped_column(String(120))
    birth_date: Mapped[date] = mapped_column(Date)
    guardian_name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="Active")
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    school_class: Mapped[SchoolClass] = relationship(back_populates="students")


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(30))
    teacher: Mapped[str] = mapped_column(String(100), default="")
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(20), default="blue")
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))


# ------------------------------------------------------------------ account helpers
hash_pw = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def temp_password() -> str:
    return "".join(secrets.choice("abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(10))


def unique_username(db: Session, base: str) -> str:
    name, i = base, 2
    while db.scalar(select(User.id).where(func.lower(User.username) == name.lower())):
        name, i = f"{base}{i}", i + 1
    return name


def teacher_username(db: Session, full_name: str) -> str:
    parts = [p for p in (slug(x) for x in full_name.split()) if p]
    return unique_username(db, f"t.{parts[-1] if parts else 'teacher'}")


def ensure_student_accounts(db: Session):
    """Every student gets an account: username = student number, default password 12345 (change forced)."""
    have = set(db.scalars(select(User.student_id).where(User.student_id.is_not(None))))
    missing = [s for s in db.scalars(select(Student).order_by(Student.id)) if s.id not in have]
    if not missing:
        return
    h = hash_pw(DEFAULT_STUDENT_PW)
    for s in missing:
        db.add(User(username=unique_username(db, s.student_number), full_name=s.full_name, role="student",
                    student_id=s.id, password_hash=h, must_change_password=True))
        db.flush()
    db.commit()


def seed(db: Session):
    if db.scalar(select(func.count(User.id))):
        return
    db.add(User(username="admin", full_name="Admin", password_hash=hash_pw("admin123"), must_change_password=True))
    classes = [SchoolClass(name=n, academic_year="2026 - 2027") for n in ["6e A", "6e B", "5e A", "5e B", "4e A"]]
    db.add_all(classes)
    db.flush()
    names = ["Jean Dupont", "Marie Lopez", "Albert Kabila", "Aline Mbuyi", "Patrick Tshibanda", "Grace Ilunga",
             "Samuel Mukendi", "Esther Kalala", "David Ngoy", "Ruth Kasongo", "Joël Mwamba", "Sarah Banza",
             "Christian Lukusa", "Divine Mutombo", "Prince Kabongo", "Léa Nsimba", "Gédéon Tshimanga",
             "Nadine Kapinga", "Emmanuel Mulumba", "Joëlle Kazadi", "Daniel Ngandu", "Chantal Mpoyi",
             "Fabrice Kalenga", "Béatrice Mujinga", "Olivier Kanku"]
    guardians = ["M. Dupont", "Mme Lopez", "M. Kabila", "Mme Mbuyi", "M. Tshibanda", "Mme Ilunga", "M. Mukendi", "Mme Kalala"]
    idx = [0, 1, 2, 3, 4] + sum([[i] * n for i, n in enumerate([4, 5, 4, 4, 3])], [])
    fixed = [date(2012, 3, 12), date(2011, 7, 18), date(2011, 11, 25), date(2012, 5, 9), date(2014, 2, 14)]
    for i, name in enumerate(names):
        db.add(Student(
            student_number=f"ST{i + 1:03d}", full_name=name, guardian_name=guardians[i % 8],
            birth_date=fixed[i] if i < 5 else date(2010 + i % 5, 1 + i % 12, 1 + (i * 3) % 28),
            class_id=classes[idx[i]].id,
            created_at=utcnow() - timedelta(days=0 if i >= 22 else 60 + i)))
    db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    for _ in range(30):
        try:
            Base.metadata.create_all(engine)
            break
        except OperationalError:
            time.sleep(2)
    with engine.begin() as c:
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin'"))
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL"))
        for stmt in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ",
            "ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
            "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS link VARCHAR(500) NOT NULL DEFAULT ''",
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT ''",
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) NOT NULL DEFAULT ''",
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ",
        ]:
            c.execute(text(stmt))
    with SessionLocal() as db:
        seed(db)
        seed_extras(db)
        ensure_student_accounts(db)
        seed_lms(db)
        link_teachers(db)
        seed_quizzes(db)
    yield


app = FastAPI(title="Hodari School API", docs_url="/api/docs", openapi_url="/api/openapi.json", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_db():
    with SessionLocal() as db:
        yield db


oauth = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def auth_user(token: str = Depends(oauth), db: Session = Depends(get_db)) -> User:
    try:
        uid = int(jwt.decode(token, SECRET, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Invalid or expired session")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(401, "Unknown user")
    return user


def current_user(user: User = Depends(auth_user)) -> User:
    if user.must_change_password:
        raise HTTPException(403, "You must change your password before continuing")
    return user


def require(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You do not have permission to do this")
        return user
    return dep


ANY, ADMIN, STAFF, STUDENT = Depends(current_user), Depends(require("admin")), Depends(require("admin", "teacher")), Depends(require("student"))


def scope(db: Session, user: User) -> list[int] | None:
    """Class ids the user may work with. None = every class (admin)."""
    if user.role == "admin":
        return None
    if user.role == "teacher":
        return list(db.scalars(select(Course.class_id).where(Course.teacher_id == user.id).distinct()))
    s = db.get(Student, user.student_id) if user.student_id else None
    return [s.class_id] if s else []


def need_class(db: Session, user: User, cid: int):
    ids = scope(db, user)
    if ids is not None and cid not in ids:
        raise HTTPException(403, "You do not have access to this class")


def check_students(db: Session, user: User, student_ids: list[int]):
    ids = scope(db, user)
    if ids is None:
        return
    classes = set(db.scalars(select(Student.class_id).where(Student.id.in_(student_ids or [0]))))
    if not classes <= set(ids):
        raise HTTPException(403, "Some students are outside your classes")


def student_filters(db: Session, user: User, q: str = "", class_id: int | None = None):
    filt = []
    ids = scope(db, user)
    if ids is not None:
        filt.append(Student.class_id.in_(ids or [0]))
    if class_id:
        filt.append(Student.class_id == class_id)
    q = q.strip()
    if q:
        filt.append(or_(Student.full_name.ilike(f"%{q}%"), Student.student_number.ilike(f"%{q}%")))
    return filt


class LoginIn(BaseModel):
    username: str
    password: str


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=100)


class ClassIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    academic_year: str = Field(min_length=1, max_length=20)


class StudentIn(BaseModel):
    student_number: str = Field(min_length=1, max_length=20)
    full_name: str = Field(min_length=1, max_length=120)
    birth_date: date
    guardian_name: str = Field(min_length=1, max_length=120)
    class_id: int
    status: str = "Active"


@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.username) == data.username.strip().lower()))
    now = utcnow()
    if user and user.locked_until and user.locked_until > now:
        mins = math.ceil((user.locked_until - now).total_seconds() / 60)
        raise HTTPException(429, f"Too many failed attempts. Try again in {mins} minute(s).")
    if not user or not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
        if user:
            user.failed_attempts += 1
            if user.failed_attempts >= MAX_FAILS:
                user.failed_attempts, user.locked_until = 0, now + timedelta(minutes=LOCK_MINUTES)
            db.commit()
        raise HTTPException(401, "Incorrect username or password")
    user.failed_attempts, user.locked_until = 0, None
    db.commit()
    token = jwt.encode({"sub": str(user.id), "exp": now + timedelta(hours=12)}, SECRET, algorithm="HS256")
    return dict(access_token=token, full_name=user.full_name, role=user.role, must_change_password=user.must_change_password)


@app.get("/api/auth/me")
def me(user: User = Depends(auth_user)):
    return dict(id=user.id, username=user.username, full_name=user.full_name, role=user.role, must_change_password=user.must_change_password)


@app.post("/api/auth/password")
def change_password(data: PasswordIn, user: User = Depends(auth_user), db: Session = Depends(get_db)):
    if not bcrypt.checkpw(data.current_password.encode(), user.password_hash.encode()):
        raise HTTPException(400, "Current password is incorrect")
    if data.new_password == data.current_password:
        raise HTTPException(400, "The new password must be different from the current one")
    if data.new_password == DEFAULT_STUDENT_PW:
        raise HTTPException(400, "This password is too easy to guess. Choose another one")
    user.password_hash = hash_pw(data.new_password)
    user.must_change_password = False
    db.commit()
    return {"ok": True}


api = APIRouter(prefix="/api")


def class_rows(db: Session, ids: list[int] | None = None):
    q = (select(SchoolClass.id, SchoolClass.name, SchoolClass.academic_year, func.count(Student.id))
         .outerjoin(Student, Student.class_id == SchoolClass.id).group_by(SchoolClass.id).order_by(SchoolClass.id))
    if ids is not None:
        q = q.where(SchoolClass.id.in_(ids or [0]))
    return [dict(id=i, name=n, academic_year=y, student_count=c) for i, n, y, c in db.execute(q)]


def s_out(s: Student):
    return dict(id=s.id, student_number=s.student_number, full_name=s.full_name, birth_date=s.birth_date.isoformat(),
                guardian_name=s.guardian_name, status=s.status, class_id=s.class_id, class_name=s.school_class.name)


@api.get("/dashboard")
def dashboard(user: User = STAFF, db: Session = Depends(get_db)):
    ids = scope(db, user)
    rows = class_rows(db, ids)
    sf = [] if ids is None else [Student.class_id.in_(ids or [0])]
    recent = db.scalar(select(func.count(Student.id)).where(Student.created_at >= utcnow() - timedelta(days=7), *sf))
    return dict(total_students=db.scalar(select(func.count(Student.id)).where(*sf)), total_classes=len(rows),
                recent_registrations=recent, by_class=[dict(name=r["name"], count=r["student_count"]) for r in rows])


@api.get("/classes")
def list_classes(user: User = STAFF, db: Session = Depends(get_db)):
    return class_rows(db, scope(db, user))


@api.post("/classes", status_code=201)
def create_class(data: ClassIn, user: User = ADMIN, db: Session = Depends(get_db)):
    c = SchoolClass(name=data.name.strip(), academic_year=data.academic_year)
    db.add(c)
    db.commit()
    return dict(id=c.id, name=c.name, academic_year=c.academic_year, student_count=0)


@api.put("/classes/{cid}")
def update_class(cid: int, data: ClassIn, user: User = ADMIN, db: Session = Depends(get_db)):
    c = db.get(SchoolClass, cid)
    if not c:
        raise HTTPException(404, "Class not found")
    c.name, c.academic_year = data.name.strip(), data.academic_year
    db.commit()
    return dict(id=c.id)


@api.delete("/classes/{cid}", status_code=204)
def delete_class(cid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    c = db.get(SchoolClass, cid)
    if not c:
        raise HTTPException(404, "Class not found")
    if db.scalar(select(func.count(Student.id)).where(Student.class_id == cid)):
        raise HTTPException(400, "Cannot delete a class that still has students")
    db.delete(c)
    db.commit()


@api.get("/students/next-number")
def next_number(user: User = ADMIN, db: Session = Depends(get_db)):
    n = (db.scalar(select(func.max(Student.id))) or 0) + 1
    while db.scalar(select(Student.id).where(Student.student_number == f"ST{n:03d}")):
        n += 1
    return {"student_number": f"ST{n:03d}"}


@api.get("/students")
def list_students(q: str = "", class_id: int | None = None, page: int = Query(1, ge=1), size: int = Query(5, ge=1, le=100),
                  user: User = STAFF, db: Session = Depends(get_db)):
    filt = student_filters(db, user, q, class_id)
    total = db.scalar(select(func.count(Student.id)).where(*filt))
    rows = db.scalars(select(Student).options(joinedload(Student.school_class)).where(*filt)
                      .order_by(Student.student_number).offset((page - 1) * size).limit(size)).all()
    return dict(items=[s_out(s) for s in rows], total=total, page=page, size=size)


def save_student(db: Session, s: Student, data: StudentIn):
    if not db.get(SchoolClass, data.class_id):
        raise HTTPException(400, "Selected class does not exist")
    for k, v in data.model_dump().items():
        setattr(s, k, v.strip() if isinstance(v, str) else v)
    db.add(s)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This student number already exists")
    acct = db.scalar(select(User).where(User.student_id == s.id))
    if acct:
        acct.full_name = s.full_name
        if acct.username != s.student_number:
            if db.scalar(select(User.id).where(func.lower(User.username) == s.student_number.lower(), User.id != acct.id)):
                db.rollback()
                raise HTTPException(409, "Another account already uses this student number")
            acct.username = s.student_number
    else:
        db.add(User(username=unique_username(db, s.student_number), full_name=s.full_name, role="student", student_id=s.id,
                    password_hash=hash_pw(DEFAULT_STUDENT_PW), must_change_password=True))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This student number already exists")
    db.refresh(s)
    return s_out(s)


@api.post("/students", status_code=201)
def create_student(data: StudentIn, user: User = ADMIN, db: Session = Depends(get_db)):
    return save_student(db, Student(), data)


@api.get("/students/{sid}")
def get_student(sid: int, user: User = STAFF, db: Session = Depends(get_db)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found")
    need_class(db, user, s.class_id)
    return s_out(s)


@api.put("/students/{sid}")
def update_student(sid: int, data: StudentIn, user: User = ADMIN, db: Session = Depends(get_db)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found")
    return save_student(db, s, data)


@api.delete("/students/{sid}", status_code=204)
def delete_student(sid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found")
    db.execute(delete(User).where(User.student_id == sid))
    db.delete(s)
    db.commit()


app.include_router(api)
from extras import router as extras_router, seed_extras  # noqa: E402
from lms import router as lms_router, seed_lms, link_teachers  # noqa: E402
from quiz import router as quiz_router, seed_quizzes  # noqa: E402
from student import router as student_router  # noqa: E402
from accounts import router as accounts_router  # noqa: E402

for r in (extras_router, lms_router, quiz_router, student_router, accounts_router):
    app.include_router(r)
