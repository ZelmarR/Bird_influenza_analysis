import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as _jwt
from jwt.exceptions import PyJWTError
from pydantic import BaseModel, EmailStr

from github_utils import download_users, upload_users

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is not set")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

bearer_scheme = HTTPBearer()
router = APIRouter()

USERS_COLUMNS = ["id", "email", "name", "department", "password_hash", "created_at"]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = ""
    department: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _create_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    return _jwt.encode({"sub": email, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> str | None:
    """Return email if valid, None otherwise."""
    try:
        payload = _jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except PyJWTError:
        return None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    email = verify_token(credentials.credentials)
    if email is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return email


@router.post("/register", status_code=201)
def register(req: RegisterRequest):
    df, sha = download_users()
    if not df.empty and req.email in df["email"].values:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    new_row = pd.DataFrame([{
        "id": str(uuid.uuid4()),
        "email": req.email,
        "name": req.name,
        "department": req.department,
        "password_hash": _hash(req.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    upload_users(df, sha)
    token = _create_token(req.email)
    return {"message": "Account created", "access_token": token, "token_type": "bearer"}


@router.post("/login")
def login(req: LoginRequest):
    df, _ = download_users()
    if df.empty:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    row = df[df["email"] == req.email]
    if row.empty or not _verify(req.password, row.iloc[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"access_token": _create_token(req.email), "token_type": "bearer"}


@router.get("/me")
def me(user: str = Depends(get_current_user)):
    return {"email": user}
