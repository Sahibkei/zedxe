from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProbabilityQueryRequest(BaseModel):
    symbol: str
    timeframe: str
    horizon: int = Field(..., ge=1)
    lookback: int = Field(..., ge=50)
    targetX: float = Field(..., ge=1)
    event: Literal["end", "touch"]

    @field_validator("symbol", "timeframe")
    @classmethod
    def strip_values(cls, value: str) -> str:
        return value.strip()


class ProbabilityMeta(BaseModel):
    entry: float
    sigma_1: float
    sigma_h: float
    sigma_scale: float
    notes: str | None = None


class ProbabilityQueryResponse(BaseModel):
    mode: Literal["service"] = "service"
    as_of: str
    symbol: str
    timeframe: str
    horizon: int
    lookback: int
    targetX: float
    event: Literal["end"]
    p_up_ge_x: float
    p_dn_ge_x: float
    p_within_pm_x: float
    meta: ProbabilityMeta


class SymbolMetaEntry(BaseModel):
    symbol: str
    timeframes: list[str]
    pip_size: float
    point_size: float


class MarketSymbolsResponse(BaseModel):
    symbols: list[SymbolMetaEntry]
