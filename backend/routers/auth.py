"""鉴权路由：注册 / 登录 / 当前用户。"""
import sqlite3
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from core.config import EMAIL_RE, ACCESS_TOKEN_EXPIRE_MINUTES
from core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
)
from core.db import get_db
from models.schemas import UserCreate, UserOut, Token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(user: UserCreate):
    email = (user.email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if not user.password or len(user.password) < 8:
        raise HTTPException(status_code=400, detail="密码至少需要 8 位")
    conn = get_db()
    cursor = conn.cursor()
    hashed = get_password_hash(user.password)
    try:
        cursor.execute(
            "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
            (email, hashed),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    conn.close()
    return {"id": user_id, "email": user.email}


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_db()
    email = (form_data.username or "").strip().lower()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email,)
    ).fetchone()
    conn.close()
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    token = create_access_token(
        {"sub": str(user["id"])},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def read_me(current_user=Depends(get_current_user)):
    return {"id": current_user["id"], "email": current_user["email"]}
