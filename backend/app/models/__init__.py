from app.core.database import Base  # noqa: F401
from app.models.check_in import CheckIn  # noqa: F401
from app.models.dojo import Dojo  # noqa: F401
from app.models.faixa import Faixa  # noqa: F401
from app.models.student import Student  # noqa: F401
from app.models.student_guardian import StudentGuardian  # noqa: F401
from app.models.turma import Turma  # noqa: F401
from app.models.turma_enrollment import TurmaEnrollment  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.mural_post import MuralPost  # noqa: F401
from app.models.skills import DojoSkillsConfig, StudentSkillsRating  # noqa: F401
from app.models.finance import (  # noqa: F401
    Payment,
    PixConfig,
    Plan,
    StudentSubscription,
)
from app.models.matricula_link import MatriculaLink  # noqa: F401

