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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

