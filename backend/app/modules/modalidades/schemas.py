from pydantic import BaseModel, Field, field_validator


def _validate_skills_labels_optional(v: list[str] | None) -> list[str] | None:
    if v is None:
        return None
    cleaned = [str(x).strip() for x in v]
    if len(cleaned) != 5:
        raise ValueError("Informe exatamente 5 habilidades ou deixe em branco (usa o padrão do dojo)")
    if any(not s for s in cleaned):
        raise ValueError("Nenhuma habilidade pode ficar vazia")
    if len(set(x.casefold() for x in cleaned)) != 5:
        raise ValueError("As habilidades devem ser únicas")
    return cleaned


class ModalidadeRead(BaseModel):
    id: int
    name: str
    has_graduation_system: bool = True
    skills_labels: list[str] | None = None

    class Config:
        from_attributes = True


class ModalidadeListaItem(BaseModel):
    """Item para o painel: catálogo (id definido) ou só em uso em turmas/alunos (id nulo)."""

    id: int | None = None
    name: str
    em_catalogo: bool
    has_graduation_system: bool = True
    skills_labels: list[str] | None = None


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
    has_graduation_system: bool = True
    skills_labels: list[str] | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Nome não pode ser vazio")
        return s

    @field_validator("skills_labels")
    @classmethod
    def validate_skills_create(cls, v: list[str] | None) -> list[str] | None:
        return _validate_skills_labels_optional(v)


class ModalidadeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    has_graduation_system: bool | None = None
    skills_labels: list[str] | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Nome não pode ser vazio")
        return s

    @field_validator("skills_labels")
    @classmethod
    def validate_skills_update(cls, v: list[str] | None) -> list[str] | None:
        return _validate_skills_labels_optional(v)
