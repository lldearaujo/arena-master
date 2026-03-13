from pydantic import BaseModel, EmailStr


class ProfessorRead(BaseModel):
    id: int
    email: EmailStr
    dojo_id: int | None
    is_active: bool

    class Config:
        from_attributes = True


class ProfessorCreate(BaseModel):
    email: EmailStr
    password: str


class ProfessorUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None
