from pydantic import BaseModel


class DojoBase(BaseModel):
    name: str
    slug: str
    localidade: str | None = None
    contato: str | None = None
    logo_url: str | None = None
    active: bool = True


class DojoCreate(DojoBase):
    pass


class DojoUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    localidade: str | None = None
    contato: str | None = None
    logo_url: str | None = None
    active: bool | None = None


class DojoRead(DojoBase):
    id: int

    class Config:
        from_attributes = True

