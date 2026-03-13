from pydantic import BaseModel


class FaixaBase(BaseModel):
    name: str
    ordem: int = 0
    max_graus: int = 4
    exibir_como_dan: bool = False


class FaixaCreate(FaixaBase):
    pass


class FaixaUpdate(BaseModel):
    name: str | None = None
    ordem: int | None = None
    max_graus: int | None = None
    exibir_como_dan: bool | None = None


class FaixaRead(FaixaBase):
    id: int
    dojo_id: int

    class Config:
        from_attributes = True
