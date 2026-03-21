from pydantic import BaseModel, Field, field_validator


class ModalidadeRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ModalidadeListaItem(BaseModel):
    """Item para o painel: catálogo (id definido) ou só em uso em turmas/alunos (id nulo)."""

    id: int | None = None
    name: str
    em_catalogo: bool


class ModalidadeRenamePorNome(BaseModel):
    old_name: str = Field(min_length=1, max_length=64)
    new_name: str = Field(min_length=1, max_length=64)

    @field_validator("old_name", "new_name")
    @classmethod
    def strip_nomes(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Nome não pode ser vazio")
        return s


class ModalidadeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Nome não pode ser vazio")
        return s


class ModalidadeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=64)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Nome não pode ser vazio")
        return s
