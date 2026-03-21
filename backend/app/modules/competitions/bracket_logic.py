"""Utilitários de ordem de chave e heurística anti team-kill."""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def next_power_of_2(n: int) -> int:
    p = 1
    while p < n:
        p *= 2
    return p


def bracket_seed_positions(n: int) -> list[int]:
    """Para n potência de 2, retorna o número do seed (1..n) em cada slot linear."""
    if n == 1:
        return [1]
    half = n // 2
    prev = bracket_seed_positions(half)
    out: list[int] = []
    for s in prev:
        out.append(s)
        out.append(n + 1 - s)
    return out


def try_reduce_same_dojo_pairings(
    regs_sorted: list[T],
    key_dojo: Callable[[T], int | None],
    max_swaps: int = 48,
) -> list[T]:
    """Tenta permutar atletas de ranking similar para reduzir pares mesma academia no 1º round."""
    if len(regs_sorted) <= 1:
        return list(regs_sorted)

    import random

    best = list(regs_sorted)
    n = next_power_of_2(len(best))
    positions = bracket_seed_positions(n)

    def slots_for(order: list[T]) -> list:
        slots: list = [None] * n
        for seed in range(1, len(order) + 1):
            try:
                idx = positions.index(seed)
            except ValueError:
                continue
            slots[idx] = order[seed - 1]
        return slots

    def penalty(order: list[T]) -> int:
        slots = slots_for(order)
        pen = 0
        for p in range(0, n, 2):
            a, b = slots[p], slots[p + 1]
            if a is not None and b is not None and key_dojo(a) == key_dojo(b) and key_dojo(a) is not None:
                pen += 1
        return pen

    current_pen = penalty(best)
    rng = random.Random(42)
    for _ in range(max_swaps):
        if current_pen == 0:
            break
        i, j = rng.randrange(len(best)), rng.randrange(len(best))
        if i == j:
            continue
        trial = list(best)
        trial[i], trial[j] = trial[j], trial[i]
        tpen = penalty(trial)
        if tpen <= current_pen:
            best = trial
            current_pen = tpen
    return best
