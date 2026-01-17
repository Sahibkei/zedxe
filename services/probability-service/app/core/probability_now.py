from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from app.core.ewma import ewma_volatility
from app.core.schemas import ProbabilityQueryRequest, ProbabilityQueryResponse, ProbabilityMeta


try:
    from scipy.stats import norm

    def normal_cdf(value: float) -> float:
        return norm.cdf(value)

except Exception:  # pragma: no cover - scipy optional

    def normal_cdf(value: float) -> float:
        return 0.5 * (1.0 + math.erf(value / math.sqrt(2)))


@dataclass
class CalculatorConfig:
    ewma_lambda: float
    sigma_scale: float


class ProbabilityCalculator:
    def __init__(self) -> None:
        self.config = CalculatorConfig(
            ewma_lambda=float(os.getenv("EWMA_LAMBDA", "0.94")),
            sigma_scale=float(os.getenv("SIGMA_SCALE", "1.0")),
        )

    def calculate(self, df: pd.DataFrame, payload: ProbabilityQueryRequest) -> ProbabilityQueryResponse:
        closes = df["close"].to_numpy()
        if closes.size < payload.lookback + 2:
            raise ValueError("insufficient data for lookback")

        entry_index = -2
        entry_price = float(closes[entry_index])
        entry_time = df["timestamp"].iloc[entry_index]

        window_start = entry_index - payload.lookback
        window_closes = closes[window_start : entry_index + 1]
        returns = np.diff(np.log(window_closes))

        sigma_1 = ewma_volatility(returns, self.config.ewma_lambda)
        sigma_h = sigma_1 * math.sqrt(payload.horizon) * self.config.sigma_scale
        sigma_h = max(sigma_h, 1e-12)

        r_up = math.log((entry_price + payload.targetX) / entry_price)
        if entry_price <= payload.targetX:
            r_dn = float("-inf")
        else:
            r_dn = math.log((entry_price - payload.targetX) / entry_price)

        z_up = r_up / sigma_h
        z_dn = r_dn / sigma_h

        p_up = 1.0 - normal_cdf(z_up)
        p_dn = normal_cdf(z_dn)
        p_within = max(0.0, 1.0 - p_up - p_dn)

        return ProbabilityQueryResponse(
            as_of=pd.Timestamp(entry_time).isoformat(),
            symbol=payload.symbol,
            timeframe=payload.timeframe,
            horizon=payload.horizon,
            lookback=payload.lookback,
            targetX=payload.targetX,
            event="end",
            p_up_ge_x=float(min(max(p_up, 0.0), 1.0)),
            p_dn_ge_x=float(min(max(p_dn, 0.0), 1.0)),
            p_within_pm_x=float(min(max(p_within, 0.0), 1.0)),
            meta=ProbabilityMeta(
                entry=entry_price,
                sigma_1=float(sigma_1),
                sigma_h=float(sigma_h),
                sigma_scale=self.config.sigma_scale,
            ),
        )
