"""
Script para adicionar as colunas presence_confirmed_at e presence_confirmed_by_user_id
na tabela check_ins. Execute a partir da pasta backend com o mesmo .env da aplicação.

Uso (na pasta backend):
  python -m scripts.add_checkin_presence_columns
  ou: python scripts/add_checkin_presence_columns.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Garante que o backend está no path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from sqlalchemy.engine import create_engine

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)

    with engine.connect() as conn:
        # Colunas e índices (IF NOT EXISTS para ser idempotente)
        conn.execute(
            text(
                """
            ALTER TABLE check_ins
            ADD COLUMN IF NOT EXISTS presence_confirmed_at TIMESTAMP WITH TIME ZONE
            """
            )
        )
        conn.execute(
            text(
                """
            ALTER TABLE check_ins
            ADD COLUMN IF NOT EXISTS presence_confirmed_by_user_id INTEGER
            REFERENCES users(id) ON DELETE SET NULL
            """
            )
        )
        conn.execute(
            text(
                """
            CREATE INDEX IF NOT EXISTS ix_check_ins_presence_confirmed_at
            ON check_ins (presence_confirmed_at)
            """
            )
        )
        conn.execute(
            text(
                """
            CREATE INDEX IF NOT EXISTS ix_check_ins_presence_confirmed_by_user_id
            ON check_ins (presence_confirmed_by_user_id)
            """
            )
        )
        # Colunas para marcar ausência (não veio) e devolver crédito
        conn.execute(
            text(
                """
            ALTER TABLE check_ins
            ADD COLUMN IF NOT EXISTS marked_absent_at TIMESTAMP WITH TIME ZONE
            """
            )
        )
        conn.execute(
            text(
                """
            ALTER TABLE check_ins
            ADD COLUMN IF NOT EXISTS marked_absent_by_user_id INTEGER
            REFERENCES users(id) ON DELETE SET NULL
            """
            )
        )
        conn.execute(
            text(
                """
            CREATE INDEX IF NOT EXISTS ix_check_ins_marked_absent_at
            ON check_ins (marked_absent_at)
            """
            )
        )
        conn.execute(
            text(
                """
            CREATE INDEX IF NOT EXISTS ix_check_ins_marked_absent_by_user_id
            ON check_ins (marked_absent_by_user_id)
            """
            )
        )
        conn.commit()
    print("Colunas de confirmação de presença e de ausência adicionadas em check_ins.")


if __name__ == "__main__":
    main()
