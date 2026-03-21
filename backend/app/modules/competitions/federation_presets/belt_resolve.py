"""Mapeia chaves canónicas de faixa para `Faixa.id` do dojo (por nome)."""

from __future__ import annotations

import unicodedata
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.faixa import Faixa

# Chave canónica → possíveis nomes no cadastro do dojo (PT/EN), sem acentos na comparação
CANONICAL_ALIASES: dict[str, tuple[str, ...]] = {
    "branca": ("branca", "white", "branco"),
    "cinza": ("cinza", "grey", "gray", "gray belt"),
    "amarela": ("amarela", "yellow"),
    "laranja": ("laranja", "orange"),
    "verde": ("verde", "green"),
    "azul": ("azul", "blue"),
    "roxa": ("roxa", "purple", "roxo"),
    "marrom": ("marrom", "brown"),
    "preta": ("preta", "black"),
}


def normalize_belt_text(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower().strip())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    if s.startswith("faixa "):
        s = s[6:].strip()
    return s


def resolve_faixa_id_for_canonical(faixas: list[Faixa], canonical: str) -> int | None:
    aliases = CANONICAL_ALIASES.get(canonical, (canonical,))
    want = {normalize_belt_text(a) for a in aliases}
    for f in faixas:
        if normalize_belt_text(f.name) in want:
            return f.id
    return None


def collect_unique_canonicals(belt_triples: tuple[tuple[str, str, str], ...]) -> list[str]:
    return sorted({b for (_, _, b) in belt_triples})
