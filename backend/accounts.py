"""Account administration (admin only): teachers, administrators and password resets."""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from main import ADMIN, DEFAULT_STUDENT_PW, Course, Student, User, get_db, hash_pw, teacher_username, temp_password, unique_username, utcnow

router = APIRouter(prefix="/api")
USERNAME = re.compile(r"^[A-Za-z0-9._-]{3,50}$")


class UserIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    role: str = "teacher"
    username: str | None = None


class UserEdit(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)


def user_out(db: Session, u: User):
    return dict(id=u.id, username=u.username, full_name=u.full_name, role=u.role, must_change_password=u.must_change_password,
                locked=bool(u.locked_until and u.locked_until > utcnow()),
                courses=db.scalar(select(func.count(Course.id)).where(Course.teacher_id == u.id)) if u.role == "teacher" else None)


def reset(db: Session, u: User) -> str:
    pw = DEFAULT_STUDENT_PW if u.role == "student" else temp_password()
    u.password_hash, u.must_change_password, u.failed_attempts, u.locked_until = hash_pw(pw), True, 0, None
    return pw


def need_user(db: Session, uid: int) -> User:
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    return u


@router.get("/users")
def list_users(role: str = "", user: User = ADMIN, db: Session = Depends(get_db)):
    q = select(User).order_by(User.role, User.full_name)
    if role:
        q = q.where(User.role == role)
    return [user_out(db, u) for u in db.scalars(q)]


@router.post("/users", status_code=201)
def create_user(d: UserIn, user: User = ADMIN, db: Session = Depends(get_db)):
    if d.role not in ("teacher", "admin"):
        raise HTTPException(400, "Role must be teacher or admin (student accounts are created with the student)")
    if d.username:
        if not USERNAME.match(d.username):
            raise HTTPException(400, "Username: 3-50 letters, digits, dots, dashes or underscores")
        if db.scalar(select(User.id).where(func.lower(User.username) == d.username.lower())):
            raise HTTPException(409, "This username is already taken")
        name = d.username
    elif d.role == "teacher":
        name = teacher_username(db, d.full_name)
    else:
        raise HTTPException(400, "A username is required for administrators")
    u = User(username=name, full_name=d.full_name.strip(), role=d.role, password_hash="")
    pw = reset(db, u)
    db.add(u)
    db.commit()
    return dict(**user_out(db, u), temporary_password=pw)


@router.put("/users/{uid}")
def edit_user(uid: int, d: UserEdit, user: User = ADMIN, db: Session = Depends(get_db)):
    u = need_user(db, uid)
    if u.role == "student":
        raise HTTPException(400, "Edit the student record instead")
    u.full_name = d.full_name.strip()
    db.commit()
    return user_out(db, u)


@router.post("/users/{uid}/reset-password")
def reset_password(uid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    u = need_user(db, uid)
    pw = reset(db, u)
    db.commit()
    return dict(username=u.username, temporary_password=pw)


@router.post("/students/{sid}/reset-password")
def reset_student_password(sid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    s = db.get(Student, sid)
    if not s:
        raise HTTPException(404, "Student not found")
    u = db.scalar(select(User).where(User.student_id == sid))
    if not u:
        u = User(username=unique_username(db, s.student_number), full_name=s.full_name, role="student", student_id=sid, password_hash="")
        db.add(u)
    pw = reset(db, u)
    db.commit()
    return dict(username=u.username, temporary_password=pw)


@router.delete("/users/{uid}", status_code=204)
def delete_user(uid: int, user: User = ADMIN, db: Session = Depends(get_db)):
    u = need_user(db, uid)
    if u.id == user.id:
        raise HTTPException(400, "You cannot delete your own account")
    if u.role == "student":
        raise HTTPException(400, "Delete the student record instead")
    if u.role == "admin" and db.scalar(select(func.count(User.id)).where(User.role == "admin")) <= 1:
        raise HTTPException(400, "At least one administrator is required")
    db.delete(u)
    db.commit()
