"""Presets IBJJF e CBJJ (kimono e No-Gi), regra atual — valores para cópia na competição.

Os pesos/idades seguem as tabelas usuais IBJJF/CBJJ; confirme sempre o regulamento
oficial do ano do evento. CBJJ (kimono/No-Gi) replica aqui a mesma grelha numérica
mais comum; ajuste após aplicar se a confederação publicar diferenças.
"""

from __future__ import annotations

from .spec import AgeDivisionSpec, FederationPreset, Gender, WeightSpec

# --- Idades (anos completos no ano de referência da competição) ---

AGE_DIVISIONS: tuple[AgeDivisionSpec, ...] = (
    AgeDivisionSpec("pre_mirim", "Pré-Mirim (4–5 anos)", 4, 5, 0),
    AgeDivisionSpec("mirim_1", "Mirim 1 (6–7 anos)", 6, 7, 1),
    AgeDivisionSpec("mirim_2", "Mirim 2 (8–9 anos)", 8, 9, 2),
    AgeDivisionSpec("mirim_3", "Mirim 3 (10–11 anos)", 10, 11, 3),
    AgeDivisionSpec("infantil_1", "Infantil 1 (12–13 anos)", 12, 13, 4),
    AgeDivisionSpec("infantil_2", "Infantil 2 (14–15 anos)", 14, 15, 5),
    AgeDivisionSpec("juvenil", "Juvenil (16–17 anos)", 16, 17, 6),
    AgeDivisionSpec("adult", "Adulto (18–29 anos)", 18, 29, 7),
    AgeDivisionSpec("master_1", "Master 1 (30–35 anos)", 30, 35, 8),
    AgeDivisionSpec("master_2", "Master 2 (36–40 anos)", 36, 40, 9),
    AgeDivisionSpec("master_3", "Master 3 (41–45 anos)", 41, 45, 10),
    AgeDivisionSpec("master_4", "Master 4 (46–50 anos)", 46, 50, 11),
    AgeDivisionSpec("master_5", "Master 5 (51–55 anos)", 51, 55, 12),
    AgeDivisionSpec("master_6", "Master 6 (56–60 anos)", 56, 60, 13),
    AgeDivisionSpec("master_7", "Master 7 (61+ anos)", 61, 99, 14),
)

KID_DIV_KEYS = (
    "pre_mirim",
    "mirim_1",
    "mirim_2",
    "mirim_3",
    "infantil_1",
    "infantil_2",
)

ADULT_LINE_KEYS = (
    "adult",
    "master_1",
    "master_2",
    "master_3",
    "master_4",
    "master_5",
    "master_6",
    "master_7",
)


def _gi_adult_male_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Galo", 57.5),
        ("Pluma", 64.0),
        ("Pena", 70.0),
        ("Leve", 76.0),
        ("Médio", 82.3),
        ("Meio-pesado", 88.3),
        ("Pesado", 94.3),
        ("Superpesado", 100.5),
        ("Pesadíssimo / absoluto", None),
    ]


def _gi_adult_female_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Galo", 48.5),
        ("Pluma", 53.5),
        ("Pena", 58.5),
        ("Leve", 64.0),
        ("Médio", 69.0),
        ("Meio-pesado", 74.0),
        ("Pesado", 79.3),
        ("Superpesado / absoluto", None),
    ]


def _nogi_adult_male_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Galo", 55.5),
        ("Pluma", 61.5),
        ("Pena", 67.5),
        ("Leve", 73.5),
        ("Médio", 79.5),
        ("Meio-pesado", 85.5),
        ("Pesado", 91.5),
        ("Superpesado", 97.5),
        ("Pesadíssimo / absoluto", None),
    ]


def _nogi_adult_female_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Pluma leve", 47.5),
        ("Pluma", 52.5),
        ("Pena", 57.5),
        ("Leve", 62.5),
        ("Médio", 67.5),
        ("Meio-pesado", 73.5),
        ("Pesado", 79.5),
        ("Superpesado / absoluto", None),
    ]


def _gi_juv_male_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Galo", 53.5),
        ("Pluma", 58.5),
        ("Pena", 64.0),
        ("Leve", 69.0),
        ("Médio", 74.0),
        ("Meio-pesado", 79.3),
        ("Pesado", 83.3),
        ("Superpesado", 87.3),
        ("Pesadíssimo", 91.5),
        ("Absoluto", None),
    ]


def _gi_juv_female_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Galo", 48.5),
        ("Pluma", 53.5),
        ("Pena", 58.5),
        ("Leve", 64.0),
        ("Médio", 69.0),
        ("Meio-pesado", 74.0),
        ("Pesado", 79.3),
        ("Absoluto", None),
    ]


def _nogi_juv_male_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Galo", 51.5),
        ("Pluma", 56.5),
        ("Pena", 61.5),
        ("Leve", 66.5),
        ("Médio", 71.5),
        ("Meio-pesado", 76.5),
        ("Pesado", 81.5),
        ("Superpesado", 86.5),
        ("Pesadíssimo", 91.5),
        ("Absoluto", None),
    ]


def _nogi_juv_female_pairs() -> list[tuple[str, float | None]]:
    return [
        ("Galo", 46.5),
        ("Pluma", 51.5),
        ("Pena", 56.5),
        ("Leve", 61.5),
        ("Médio", 66.5),
        ("Meio-pesado", 71.5),
        ("Pesado", 76.5),
        ("Absoluto", None),
    ]


def _weights_gi() -> tuple[WeightSpec, ...]:
    rows: list[WeightSpec] = []
    # Mirim/infantil: placeholder — tabela completa varia; organizador edita
    for dk in KID_DIV_KEYS:
        rows.append(
            WeightSpec(
                dk,
                "male",
                "Categoria única (defina subdivisões de peso)",
                None,
                0,
            )
        )
        rows.append(
            WeightSpec(
                dk,
                "female",
                "Categoria única (defina subdivisões de peso)",
                None,
                1,
            )
        )
    so = 0
    for label, mx in _gi_juv_male_pairs():
        rows.append(WeightSpec("juvenil", "male", label, mx, so))
        so += 1
    so = 0
    for label, mx in _gi_juv_female_pairs():
        rows.append(WeightSpec("juvenil", "female", label, mx, so))
        so += 1

    for dk in ADULT_LINE_KEYS:
        for i, (label, mx) in enumerate(_gi_adult_male_pairs()):
            rows.append(WeightSpec(dk, "male", label, mx, i))
        for i, (label, mx) in enumerate(_gi_adult_female_pairs()):
            rows.append(WeightSpec(dk, "female", label, mx, i))
    return tuple(rows)


def _weights_nogi() -> tuple[WeightSpec, ...]:
    rows: list[WeightSpec] = []
    for dk in KID_DIV_KEYS:
        rows.append(
            WeightSpec(
                dk,
                "male",
                "Categoria única (defina subdivisões de peso)",
                None,
                0,
                modality="nogi",
            )
        )
        rows.append(
            WeightSpec(
                dk,
                "female",
                "Categoria única (defina subdivisões de peso)",
                None,
                1,
                modality="nogi",
            )
        )
    so = 0
    for label, mx in _nogi_juv_male_pairs():
        rows.append(WeightSpec("juvenil", "male", label, mx, so, modality="nogi"))
        so += 1
    so = 0
    for label, mx in _nogi_juv_female_pairs():
        rows.append(WeightSpec("juvenil", "female", label, mx, so, modality="nogi"))
        so += 1

    for dk in ADULT_LINE_KEYS:
        for i, (label, mx) in enumerate(_nogi_adult_male_pairs()):
            rows.append(WeightSpec(dk, "male", label, mx, i, modality="nogi"))
        for i, (label, mx) in enumerate(_nogi_adult_female_pairs()):
            rows.append(WeightSpec(dk, "female", label, mx, i, modality="nogi"))
    return tuple(rows)


def _weights_gi_nogi_combined() -> tuple[WeightSpec, ...]:
    return _weights_gi() + _weights_nogi()


def _belt_triples() -> tuple[tuple[str, Gender, str], ...]:
    out: list[tuple[str, Gender, str]] = []
    kid_belts = ("branca", "cinza", "amarela", "laranja", "verde")
    for dk in KID_DIV_KEYS:
        for g in ("male", "female"):
            for b in kid_belts:
                out.append((dk, g, b))
    for g in ("male", "female"):
        for b in ("branca", "azul", "roxa"):
            out.append(("juvenil", g, b))
    adult_belts = ("branca", "azul", "roxa", "marrom", "preta")
    for dk in ADULT_LINE_KEYS:
        for g in ("male", "female"):
            for b in adult_belts:
                out.append((dk, g, b))
    return tuple(out)


_BELTS = _belt_triples()

_PRESET_IBJJF_GI = FederationPreset(
    code="ibjjf_gi",
    label="IBJJF — Kimono",
    description="Tabela vigente tipo IBJJF (kimono). Peso adulto/juvenil completo; mirim/infantil com categoria única para você subdividir.",
    federation="ibjjf",
    modality="gi",
    age_divisions=AGE_DIVISIONS,
    weights=_weights_gi(),
    belt_triples=_BELTS,
)

_PRESET_IBJJF_NOGI = FederationPreset(
    code="ibjjf_nogi",
    label="IBJJF — No-Gi",
    description="Tabela vigente tipo IBJJF (No-Gi). Mesma lógica de idades; pesos No-Gi em adulto/juvenil.",
    federation="ibjjf",
    modality="nogi",
    age_divisions=AGE_DIVISIONS,
    weights=_weights_nogi(),
    belt_triples=_BELTS,
)

_PRESET_CBJJ_GI = FederationPreset(
    code="cbjj_gi",
    label="CBJJ — Kimono",
    description="Modelo alinhado à prática usual CBJJ (kimono). Mesma grelha numérica mais comum; confira o regulamento CBJJ do ano.",
    federation="cbjj",
    modality="gi",
    age_divisions=AGE_DIVISIONS,
    weights=_weights_gi(),
    belt_triples=_BELTS,
)

_PRESET_CBJJ_NOGI = FederationPreset(
    code="cbjj_nogi",
    label="CBJJ — No-Gi",
    description="Modelo No-Gi para eventos CBJJ (grelha usual). Confirme pesos oficiais publicados pela confederação.",
    federation="cbjj",
    modality="nogi",
    age_divisions=AGE_DIVISIONS,
    weights=_weights_nogi(),
    belt_triples=_BELTS,
)

_PRESET_IBJJF_GI_NOGI = FederationPreset(
    code="ibjjf_gi_nogi",
    label="IBJJF — Kimono + No-Gi",
    description="Mesmo evento com tabelas de peso kimono e No-Gi (IBJJF). Idades e faixas partilhadas; inscrições escolhem a modalidade na categoria de peso.",
    federation="ibjjf",
    modality="both",
    age_divisions=AGE_DIVISIONS,
    weights=_weights_gi_nogi_combined(),
    belt_triples=_BELTS,
)

_PRESET_CBJJ_GI_NOGI = FederationPreset(
    code="cbjj_gi_nogi",
    label="CBJJ — Kimono + No-Gi",
    description="Mesmo evento com kimono e No-Gi (grelhas habituais CBJJ). Confirme regulamento oficial.",
    federation="cbjj",
    modality="both",
    age_divisions=AGE_DIVISIONS,
    weights=_weights_gi_nogi_combined(),
    belt_triples=_BELTS,
)

PRESETS_BY_CODE: dict[str, FederationPreset] = {
    p.code: p
    for p in (
        _PRESET_IBJJF_GI,
        _PRESET_IBJJF_NOGI,
        _PRESET_CBJJ_GI,
        _PRESET_CBJJ_NOGI,
        _PRESET_IBJJF_GI_NOGI,
        _PRESET_CBJJ_GI_NOGI,
    )
}


def get_preset(code: str) -> FederationPreset | None:
    return PRESETS_BY_CODE.get(code.strip().lower())


def list_preset_summaries() -> list[dict[str, str]]:
    ordered = (
        _PRESET_IBJJF_GI_NOGI,
        _PRESET_CBJJ_GI_NOGI,
        _PRESET_IBJJF_GI,
        _PRESET_IBJJF_NOGI,
        _PRESET_CBJJ_GI,
        _PRESET_CBJJ_NOGI,
    )
    return [
        {
            "code": p.code,
            "label": p.label,
            "description": p.description,
            "federation": p.federation,
            "modality": p.modality,
        }
        for p in ordered
    ]
