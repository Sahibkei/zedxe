from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class SymbolMetaInfo:
    symbol: str
    timeframes: list[str]
    pip_size: float
    point_size: float


class SymbolMeta:
    def __init__(self) -> None:
        self.data_dir = Path(
            os.getenv(
                "OHLC_DATA_DIR",
                Path(__file__).resolve().parents[2] / "data",
            )
        )
        self._symbols = self._load_symbols()

    def _load_symbols(self) -> dict[str, SymbolMetaInfo]:
        symbols: dict[str, SymbolMetaInfo] = {}
        if not self.data_dir.exists():
            return symbols

        for path in self.data_dir.glob("*.csv"):
            name = path.stem
            if name.endswith(".sample"):
                name = name[: -len(".sample")]
            if "_" not in name:
                continue
            symbol, timeframe = name.split("_", 1)
            info = symbols.get(symbol)
            if info:
                timeframes = sorted(set(info.timeframes + [timeframe]))
                symbols[symbol] = SymbolMetaInfo(
                    symbol=symbol,
                    timeframes=timeframes,
                    pip_size=info.pip_size,
                    point_size=info.point_size,
                )
            else:
                pip_size, point_size = self._default_sizes(symbol)
                symbols[symbol] = SymbolMetaInfo(
                    symbol=symbol,
                    timeframes=[timeframe],
                    pip_size=pip_size,
                    point_size=point_size,
                )

        return symbols

    def _default_sizes(self, symbol: str) -> tuple[float, float]:
        if symbol.upper().endswith("JPY"):
            return 0.01, 0.0001
        if symbol.upper().startswith("XAU"):
            return 0.1, 0.01
        if symbol.upper().startswith("US"):
            return 1.0, 0.1
        return 0.0001, 0.00001

    def list_symbols(self) -> list[SymbolMetaInfo]:
        return sorted(self._symbols.values(), key=lambda item: item.symbol)

    def ensure_allowed(self, symbol: str, timeframe: str) -> None:
        info = self._symbols.get(symbol)
        if not info or timeframe not in info.timeframes:
            raise ValueError(f"symbol/timeframe not available: {symbol} {timeframe}")
