from __future__ import annotations

import math
from typing import Iterable


def ewma_volatility(returns: Iterable[float], lam: float) -> float:
    iterator = iter(returns)
    try:
        first = next(iterator)
    except StopIteration:
        raise ValueError("returns are required")

    ewma_var = first * first
    for value in iterator:
        ewma_var = lam * ewma_var + (1 - lam) * (value * value)

    return math.sqrt(ewma_var)
