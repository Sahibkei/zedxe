"""Load local OHLC data from CSV files."""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from app.core.symbol_meta import SymbolMeta

logger = logging.getLogger("probability_service.data_loader")


class DataNotFoundError(RuntimeError):
    """Raised when expected OHLC data cannot be loaded."""


class DataLoader:
    """Load OHLC data for configured symbols/timeframes."""

    def __init__(self, symbol_meta: SymbolMeta) -> None:
        """Initialize the loader with the symbol metadata registry."""
        self.symbol_meta = symbol_meta
        self.data_dir = Path(self.symbol_meta.data_dir)

    def load(self, symbol: str, timeframe: str) -> pd.DataFrame:
        """Load OHLC data for a given symbol and timeframe."""
        symbol = symbol.strip()
        timeframe = timeframe.strip()
        self.symbol_meta.ensure_allowed(symbol, timeframe)

        filename = f"{symbol}_{timeframe}.csv"
        filepath = self.data_dir / filename
        if not filepath.exists():
            sample_path = self.data_dir / f"{symbol}_{timeframe}.sample.csv"
            if sample_path.exists():
                filepath = sample_path
            else:
                logger.warning("Missing data file for %s %s", symbol, timeframe)
                raise DataNotFoundError(f"no data file for {symbol} {timeframe}")

        df = pd.read_csv(filepath)
        df = self._normalize(df)

        if df.empty:
            raise DataNotFoundError(f"no valid rows for {symbol} {timeframe}")

        return df

    @staticmethod
    def _normalize(df: pd.DataFrame) -> pd.DataFrame:
        """Normalize and validate incoming OHLC dataframes."""
        expected = {"timestamp", "open", "high", "low", "close"}
        missing = expected - set(df.columns)
        if missing:
            raise DataNotFoundError(f"missing columns: {', '.join(sorted(missing))}")

        df = df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
        df = df.dropna(subset=["timestamp", "open", "high", "low", "close"])
        df = df.sort_values("timestamp")
        return df.reset_index(drop=True)
