"""API routes for the probability service."""

from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, HTTPException, status

from app.cache.redis_cache import RedisCache
from app.core.data_loader import DataLoader, DataNotFoundError
from app.core.probability_now import ProbabilityCalculator
from app.core.schemas import (
    MarketSymbolsResponse,
    ProbabilityQueryRequest,
    ProbabilityQueryResponse,
)
from app.core.symbol_meta import SymbolMeta

router = APIRouter()

symbol_meta = SymbolMeta()
loader = DataLoader(symbol_meta)
calculator = ProbabilityCalculator()
cache = RedisCache()


@router.get("/health")
def health() -> dict[str, str]:
    """Return a basic health check payload."""
    return {"status": "ok"}


@router.get("/v1/market/symbols", response_model=MarketSymbolsResponse)
def market_symbols() -> MarketSymbolsResponse:
    """List available symbols and their metadata."""
    symbols = [
        {
            "symbol": info.symbol,
            "timeframes": info.timeframes,
            "pip_size": info.pip_size,
            "point_size": info.point_size,
        }
        for info in symbol_meta.list_symbols()
    ]
    return MarketSymbolsResponse(symbols=symbols)


@router.post("/v1/probability/query", response_model=ProbabilityQueryResponse)
def probability_query(payload: ProbabilityQueryRequest) -> ProbabilityQueryResponse:
    """Calculate probabilities for the END event."""
    if payload.event == "touch":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="touch event not implemented",
        )

    payload.symbol = symbol_meta.normalize_symbol(payload.symbol)
    payload.timeframe = symbol_meta.normalize_timeframe(payload.timeframe)

    try:
        df = loader.load(payload.symbol, payload.timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DataNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    required_columns = {"timestamp", "close"}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        detail = f"Missing required columns: {', '.join(sorted(missing_columns))}"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    if len(df.index) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough candles to compute as_of; need at least 2 rows.",
        )

    entry_time = df["timestamp"].iloc[-2]
    as_of = pd.Timestamp(entry_time).isoformat()
    cache_key = cache.build_key(
        payload.symbol,
        payload.timeframe,
        payload.horizon,
        payload.lookback,
        payload.event,
        payload.targetX,
        as_of,
    )

    if cache.enabled:
        cached = cache.get(cache_key)
        if cached:
            return ProbabilityQueryResponse.model_validate(cached)

    try:
        result = calculator.calculate(df, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if cache.enabled:
        cache.set(cache_key, result.model_dump(mode="json"))

    return result


@router.post("/v1/probability/surface")
def probability_surface() -> dict[str, str]:
    """Stub endpoint for probability surface queries."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="surface not implemented",
    )
