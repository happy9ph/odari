"""Hodari School - Student Record Management System (FastAPI + PostgreSQL)."""
import os, time
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

import bcrypt, jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy import Date, DateTime, ForeignKey, String, create_engine, func, or_, select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, joinedload, mapped_column, relationship, sessionmaker

DB_URL = os.getenv("DATABASE_URL", "postgresql://hodari:hodari@localhost:5432/hodari")
SECRET = os.getenv("SECRET_KEY", "dev-secret")
engine = create_engine(DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
utcnow = lambda: datetime.now(timezone.utc)


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


def seed(db: Session):
    if db.scalar(select(func.count(User.id))):
        return
    db.add(User(username="admin", full_name="Admin", password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()))
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
        c.execute(text("DELETE FROM users WHERE role <> 'admin'"))  # legacy teacher/student accounts
    with SessionLocal() as db:
        seed(db)
        seed_extras(db)
        seed_lms(db)
    yield


app = FastAPI(title="Hodari School API", docs_url="/api/docs", openapi_url="/api/openapi.json", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def get_db():
    with SessionLocal() as db:
        yield db


oauth = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def current_user(token: str = Depends(oauth), db: Session = Depends(get_db)) -> User:
    try:
        uid = int(jwt.decode(token, SECRET, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Invalid or expired session")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(401, "Unknown user")
    return user


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
    user = db.scalar(select(User).where(User.username == data.username.strip()))
    if not user or not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
        raise HTTPException(401, "Incorrect username or password")
    token = jwt.encode({"sub": str(user.id), "exp": utcnow() + timedelta(hours=12)}, SECRET, algorithm="HS256")
    return {"access_token": token, "full_name": user.full_name}


@app.post("/api/auth/password")
def change_password(data: PasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not bcrypt.checkpw(data.current_password.encode(), user.password_hash.encode()):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    db.commit()
    return {"ok": True}


def guard(user: User = Depends(current_user)) -> User:
    """Single administrator account: any valid session has full access."""
    return user


api = APIRouter(prefix="/api", dependencies=[Depends(guard)])


def class_rows(db: Session):
    q = (select(SchoolClass.id, SchoolClass.name, SchoolClass.academic_year, func.count(Student.id))
         .outerjoin(Student, Student.class_id == SchoolClass.id).group_by(SchoolClass.id).order_by(SchoolClass.id))
    return [dict(id=i, name=n, academic_year=y, student_count=c) for i, n, y, c in db.execute(q)]


def s_out(s: Student):
    return dict(id=s.id, student_number=s.student_number, full_name=s.full_name, birth_date=s.birth_date.isoformat(),
                guardian_name=s.guardian_name, status=s.status, class_id=s.class_id, class_name=s.school_class.name)


@api.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    rows = class_rows(db)
    recent = db.scalar(select(func.count(Student.id)).where(Student.created_at >= utcnow() - timedelta(days=7)))
    return dict(total_students=db.scalar(select(func.count(Student.id))), total_classes=len(rows),
                recent_registrations=recent, by_class=[dict(name=r["name"], count=r["student_count"]) for r in rows])


@api.get("/classes")
def list_classes(db: Session = Depends(get_db)):
    return class_rows(db)


@api.post("/classes", status_code=201)
def create_class(data: ClassIn, db: Session = Depends(get_db)):
    c = SchoolClass(name=data.name.strip(), academic_year=data.academic_year)
    db.add(c)
    db.commit()
    return dict(id=c.id, name=c.name, academic_year=c.academic_year, student_count=0)


@api.put("/classes/{cid}")
def update_class(cid: int, data: ClassIn, db: Session = Depends(get_db)):
    c = db.get(SchoolClass, cid)
    if not c:
        raise HTTPException(404, "Class not found")
    c.name, c.academic_year = data.name.strip(), data.academic_year
    db.commit()
    return dict(id=c.id)


@api.delete("/classes/{cid}", status_code=204)
def delete_class(cid: int, db: Session = Depends(get_db)):
    c = db.get(SchoolClass, cid)
    if not c:
        raise HTTPException(404, "Class not found")
    if db.scalar(select(func.count(Student.id)).where(Student.class_id == cid)):
        raise HTTPException(400, "Cannot delete a class that still has students")
    db.delete(c)
    db.commit()


@api.get("/students/next-number")
def next_number(db: Session = Depends(get_db)):
    n = (db.scalar(select(func.max(Student.id))) or 0) + 1
    while db.scalar(select(Student.id).where(Student.student_number == f"ST{n:03d}")):
        n += 1
    return {"student_number": f"ST{n:03d}"}


@api.get("/students")
def list_students(q: str = "", page: int = Query(1, ge=1), size: int = Query(5, ge=1, le=100), db: Session = Depends(get_db)):
    q = q.strip()
    filt = [or_(Student.full_name.ilike(f"%{q}%"), Student.student_number.ilike(f"%{q}%"))] if q else []
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
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This student number already exists")
    db.refresh(s)
    return s_out(s)


@api.post("/students", status_code=201)
def create_student(data: StudentIn, db: Session = Depends(get_db)):
    return save_student(db, Student(), data)


@api.get("/students/{sid}")
def get_student(sid: int, db: Session = Depends(get_db)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found")
    return s_out(s)


@api.put("/students/{sid}")
def update_student(sid: int, data: StudentIn, db: Session = Depends(get_db)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found")
    return save_student(db, s, data)


@api.delete("/students/{sid}", status_code=204)
def delete_student(sid: int, db: Session = Depends(get_db)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found")
    db.delete(s)
    db.commit()


app.include_router(api)
from extras import router as extras_router, seed_extras  # noqa: E402
from lms import router as lms_router, seed_lms  # noqa: E402

app.include_router(extras_router)
app.include_router(lms_router)
