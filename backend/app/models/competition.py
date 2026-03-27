"""Modelos do domínio de competições (torneios, inscrições, chaves, tatames)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organizer_dojo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dojos.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    reference_year: Mapped[int] = mapped_column(Integer, index=True)
    event_starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    default_match_duration_seconds: Mapped[int] = mapped_column(Integer, default=360)
    transition_buffer_seconds: Mapped[int] = mapped_column(Integer, default=90)
    public_display_token: Mapped[str] = mapped_column(
        String(36), unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    # internal: visível só para alunos do dojo organizador; public: visível para todos os usuários.
    visibility: Mapped[str] = mapped_column(String(16), default="internal", index=True)
    # Código do preset de federação aplicado (libera regras de pontuação/placar na UI).
    federation_preset_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Valor da inscrição (None ou 0 = sem cobrança; confirmação automática).
    registration_fee_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Taxas isoladas por quantidade de inscrições (1..4). Quando definidas, têm prioridade no cálculo.
    registration_fee_amount_1: Mapped[float | None] = mapped_column(Float, nullable=True)
    registration_fee_amount_2: Mapped[float | None] = mapped_column(Float, nullable=True)
    registration_fee_amount_3: Mapped[float | None] = mapped_column(Float, nullable=True)
    registration_fee_amount_4: Mapped[float | None] = mapped_column(Float, nullable=True)
    registration_payment_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Modalidade "macro" do evento (ex.: "Jiu-Jitsu", "Judô") para filtrar catálogo do app.
    # Deve corresponder ao texto exibido em `students.modalidade` (catálogo do dojo).
    event_modality: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class CompetitionAgeDivision(Base):
    __tablename__ = "competition_age_divisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(128))
    birth_year_min: Mapped[int] = mapped_column(Integer)
    birth_year_max: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class CompetitionWeightClass(Base):
    __tablename__ = "competition_weight_classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    age_division_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competition_age_divisions.id", ondelete="CASCADE"), index=True
    )
    gender: Mapped[str] = mapped_column(String(16), index=True)
    # gi | nogi — mesmo evento pode ter chaves kimono e No-Gi (pesos distintos).
    modality: Mapped[str] = mapped_column(String(8), default="gi", index=True)
    label: Mapped[str] = mapped_column(String(128))
    max_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class CompetitionBeltEligibility(Base):
    __tablename__ = "competition_belt_eligibility"
    __table_args__ = (
        UniqueConstraint(
            "competition_id",
            "age_division_id",
            "gender",
            "faixa_id",
            name="uq_comp_belt_eligibility",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    age_division_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competition_age_divisions.id", ondelete="CASCADE"), index=True
    )
    gender: Mapped[str] = mapped_column(String(16), index=True)
    faixa_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("faixas.id", ondelete="CASCADE"), index=True
    )


class CompetitionRegistration(Base):
    __tablename__ = "competition_registrations"
    __table_args__ = (
        UniqueConstraint(
            "competition_id",
            "student_id",
            "kind",
            "modality",
            name="uq_comp_student_kind_modality",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    # category (idade+peso) | absolute (absoluto da faixa)
    kind: Mapped[str] = mapped_column(String(16), default="category", index=True)
    # gi | nogi
    modality: Mapped[str] = mapped_column(String(8), default="gi", index=True)
    gender: Mapped[str] = mapped_column(String(16))
    faixa_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("faixas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    age_division_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("competition_age_divisions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    weight_class_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("competition_weight_classes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), default="registered", index=True)
    declared_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    registration_public_code: Mapped[str] = mapped_column(String(16), index=True)
    ranking_points: Mapped[float] = mapped_column(Float, default=0.0)
    weigh_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    weigh_in_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Pagamento da inscrição (similar ao fluxo de mensalidade / comprovante).
    payment_status: Mapped[str] = mapped_column(
        String(32), default="not_applicable", index=True
    )
    payment_receipt_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    payment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    registration_fee_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class CompetitionBracket(Base):
    __tablename__ = "competition_brackets"
    __table_args__ = (
        UniqueConstraint(
            "competition_id",
            "age_division_id",
            "weight_class_id",
            "gender",
            name="uq_comp_bracket_division",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    age_division_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competition_age_divisions.id", ondelete="CASCADE"), index=True
    )
    weight_class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competition_weight_classes.id", ondelete="CASCADE"), index=True
    )
    gender: Mapped[str] = mapped_column(String(16))
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    team_separation_warnings: Mapped[str | None] = mapped_column(Text, nullable=True)


class CompetitionMat(Base):
    __tablename__ = "competition_mats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128))
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class CompetitionMatch(Base):
    __tablename__ = "competition_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bracket_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competition_brackets.id", ondelete="CASCADE"), index=True
    )
    round_index: Mapped[int] = mapped_column(Integer, index=True)
    position_in_round: Mapped[int] = mapped_column(Integer)
    red_registration_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("competition_registrations.id", ondelete="SET NULL"), nullable=True
    )
    blue_registration_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("competition_registrations.id", ondelete="SET NULL"), nullable=True
    )
    winner_registration_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("competition_registrations.id", ondelete="SET NULL"), nullable=True
    )
    feeder_red_match_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("competition_matches.id", ondelete="SET NULL"), nullable=True
    )
    feeder_blue_match_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("competition_matches.id", ondelete="SET NULL"), nullable=True
    )
    mat_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("competition_mats.id", ondelete="SET NULL"), nullable=True, index=True
    )
    queue_order: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    estimated_start_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    match_status: Mapped[str] = mapped_column(String(32), default="scheduled", index=True)
    red_score: Mapped[int] = mapped_column(Integer, default=0)
    blue_score: Mapped[int] = mapped_column(Integer, default=0)
    timer_elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0)
    timer_running: Mapped[bool] = mapped_column(Boolean, default=False)
    paused_for: Mapped[str | None] = mapped_column(String(64), nullable=True)
    finish_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    referee_decision_used: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CompetitionPrize(Base):
    """
    Premiação configurável por evento.

    - kind="category": premia uma categoria (divisão de idade + gênero + gi/nogi)
    - kind="absolute": premia um absoluto (gênero + gi/nogi, opcionalmente filtrado por divisão de idade)
    """

    __tablename__ = "competition_prizes"
    __table_args__ = (
        UniqueConstraint(
            "competition_id",
            "kind",
            "age_division_id",
            "faixa_id",
            "gender",
            "modality",
            "place",
            name="uq_comp_prize_target_place",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    # category | absolute
    kind: Mapped[str] = mapped_column(String(16), index=True)
    # opcional para absoluto; obrigatório na UI para categoria
    age_division_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("competition_age_divisions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    faixa_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("faixas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # male | female
    gender: Mapped[str] = mapped_column(String(16), index=True)
    # gi | nogi
    modality: Mapped[str] = mapped_column(String(8), index=True)
    # 1,2,3...
    place: Mapped[int] = mapped_column(Integer)
    # Ex.: "Medalha + cinturão", "R$ 200", etc.
    reward: Mapped[str] = mapped_column(String(255))


class CompetitionAward(Base):
    """
    Registro persistente de premiação (pódio/medalha) por atleta.

    Diferente de `competition_prizes` (configuração do que se ganha),
    esta tabela guarda QUEM ganhou em cada competição.
    """

    __tablename__ = "competition_awards"
    __table_args__ = (
        UniqueConstraint(
            "competition_id",
            "kind",
            "age_division_id",
            "weight_class_id",
            "gender",
            "modality",
            "place",
            name="uq_comp_award_target_place",
        ),
        UniqueConstraint(
            "competition_id",
            "student_id",
            "kind",
            "age_division_id",
            "weight_class_id",
            "gender",
            "modality",
            name="uq_comp_award_student_target",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    competition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    prize_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("competition_prizes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # category | absolute
    kind: Mapped[str] = mapped_column(String(16), index=True)
    age_division_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("competition_age_divisions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    weight_class_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("competition_weight_classes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # male | female
    gender: Mapped[str] = mapped_column(String(16), index=True)
    # gi | nogi
    modality: Mapped[str] = mapped_column(String(8), index=True)
    # 1,2,3...
    place: Mapped[int] = mapped_column(Integer)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
