from __future__ import annotations

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
    return {"status": "ok"}


@router.get("/v1/market/symbols", response_model=MarketSymbolsResponse)
def market_symbols() -> MarketSymbolsResponse:
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
    if payload.event == "touch":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="touch event not implemented",
        )

    try:
        df = loader.load(payload.symbol, payload.timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DataNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    try:
        result = calculator.calculate(df, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if cache.enabled:
        cache_key = cache.build_key(
            payload.symbol,
            payload.timeframe,
            payload.horizon,
            payload.lookback,
            payload.event,
            result.as_of,
            payload.targetX,
        )
        cache.set(cache_key, result.model_dump(mode="json"))

    return result


@router.post("/v1/probability/surface")
def probability_surface() -> dict[str, str]:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="surface not implemented",
    )
