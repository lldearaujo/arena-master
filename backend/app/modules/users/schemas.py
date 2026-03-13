from pydantic import BaseModel


class UserMeRead(BaseModel):
    id: int
    email: str
    role: str
    dojo_id: int | None
    avatar_url: str | None = None
    graduacao: str | None = None

    class Config:
        from_attributes = True


class AvatarUpdate(BaseModel):
    avatar_url: str | None = None
