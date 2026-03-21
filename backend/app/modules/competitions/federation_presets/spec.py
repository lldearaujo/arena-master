"""Estrutura de presets de federação (IBJJF / CBJJ, GI / No-Gi)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Gender = Literal["male", "female"]


@dataclass(frozen=True)
class AgeDivisionSpec:
    key: str
    label: str
    age_min: int
    age_max: int
    sort_order: int = 0


@dataclass(frozen=True)
class WeightSpec:
    division_key: str
    gender: Gender
    label: str
    max_kg: float | None
    sort_order: int = 0
    modality: Literal["gi", "nogi"] = "gi"


@dataclass(frozen=True)
class FederationPreset:
    code: str
    label: str
    description: str
    federation: Literal["ibjjf", "cbjj"]
    modality: Literal["gi", "nogi", "both"]
    age_divisions: tuple[AgeDivisionSpec, ...]
    weights: tuple[WeightSpec, ...]
    # (division_key, gender, canonical_belt_key)
    belt_triples: tuple[tuple[str, Gender, str], ...]
