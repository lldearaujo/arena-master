from pydantic import BaseModel, Field


class SkillsConfigRead(BaseModel):
    skills: list[str]


class SkillsConfigUpdate(BaseModel):
    skills: list[str] = Field(min_length=5, max_length=5)


class StudentSkillRatingsRead(BaseModel):
    student_id: int
    student_name: str
    ratings: list[int] | None = None


class SkillsOverviewRead(BaseModel):
    skills: list[str]
    students: list[StudentSkillRatingsRead]


class StudentSkillRatingsUpdate(BaseModel):
    ratings: list[int] = Field(min_length=5, max_length=5)


class MySkillsRead(BaseModel):
    skills: list[str]
    ratings: list[int]

