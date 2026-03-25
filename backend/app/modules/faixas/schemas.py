from pydantic import BaseModel, Field


class FaixaBase(BaseModel):
    name: str
    ordem: int = 0
    max_graus: int = 4
    exibir_como_dan: bool = False


class FaixaCreate(FaixaBase):
    modalidade_id: int = Field(..., description="ID em dojo_modalidades (catálogo do dojo)")


class FaixaUpdate(BaseModel):
    name: str | None = None
    ordem: int | None = None
    max_graus: int | None = None
    exibir_como_dan: bool | None = None
    modalidade_id: int | None = None


class FaixaRead(FaixaBase):
    id: int
    dojo_id: int
    modalidade_id: int
    modalidade_name: str

    class Config:
        from_attributes = True

