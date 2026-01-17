"""EWMA volatility calculations."""

from __future__ import annotations

import math
from typing import Iterable


def ewma_volatility(returns: Iterable[float], lam: float) -> float:
    """Compute EWMA volatility for a series of returns."""
    if not 0.0 <= lam <= 1.0:
        raise ValueError("EWMA lambda must be between 0 and 1")

    iterator = iter(returns)
    try:
        first = next(iterator)
    except StopIteration:
        raise ValueError("returns are required") from None

    ewma_var = first * first
    for value in iterator:
        ewma_var = lam * ewma_var + (1 - lam) * (value * value)

    return math.sqrt(ewma_var)
