"""Pydantic schemas for probability requests/responses."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProbabilityQueryRequest(BaseModel):
    """Request payload for probability query endpoint."""

    symbol: str
    timeframe: str
    horizon: int = Field(..., ge=1)
    lookback: int = Field(..., ge=50)
    targetX: float = Field(..., ge=1)
    event: Literal["end", "touch"]

    @field_validator("symbol", "timeframe")
    @classmethod
    def strip_values(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("symbol and timeframe cannot be blank")
        return stripped


class ProbabilityMeta(BaseModel):
    """Metadata returned with probability calculations."""

    entry: float
    sigma_1: float
    sigma_h: float
    sigma_scale: float
    notes: str | None = None


class ProbabilityQueryResponse(BaseModel):
    """Response payload for probability query endpoint."""

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
    """Symbol metadata entry for market symbols endpoint."""

    symbol: str
    timeframes: list[str]
    pip_size: float
    point_size: float


class MarketSymbolsResponse(BaseModel):
    """Response payload for available market symbols."""

    symbols: list[SymbolMetaEntry]
