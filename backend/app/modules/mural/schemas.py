from datetime import datetime

from pydantic import BaseModel


class MuralPostBase(BaseModel):
    title: str
    content: str
    pinned: bool = False


class MuralPostCreate(MuralPostBase):
    pass


class MuralPostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    pinned: bool | None = None


class MuralPostRead(MuralPostBase):
    id: int
    dojo_id: int
    author_name: str
    author_avatar_url: str | None = None
    likes_count: int = 0
    liked_by_me: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LikeState(BaseModel):
    likes_count: int
    liked_by_me: bool


class MuralLikerRead(BaseModel):
    id: int
    name: str | None = None
    email: str
    avatar_url: str | None = None

    class Config:
        from_attributes = True

