from typing import Literal

from pydantic import BaseModel, EmailStr


RoleLiteral = Literal["superadmin", "admin", "aluno"]


class UserRead(BaseModel):
    id: int
    email: str
    name: str | None = None
    role: RoleLiteral
    dojo_id: int | None = None
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class RegisterStudentRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    dojo_id: int
    role: RoleLiteral = "aluno"

