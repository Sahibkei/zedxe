# Probability Service (FastAPI)

FastAPI service that powers `mode="service"` probability queries for ZedXe.

## Features
- `GET /health`
- `GET /v1/market/symbols`
- `POST /v1/probability/query` (event=`end` only)
- `POST /v1/probability/surface` (stub: 501)

## Local run
```bash
cd services/probability-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OHLC_DATA_DIR=./data
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Connect from ZedXe
```bash
export PROB_SERVICE_URL=http://localhost:8000
```
Then ZedXe `/models/probability` should return `mode="service"`.

## Data files
The service loads OHLC CSV files from `OHLC_DATA_DIR` if set, otherwise it uses
`services/probability-service/data`.

**Expected CSV format**
```
timestamp,open,high,low,close,volume
```
- `timestamp` is parsed with `pandas.to_datetime` (UTC is recommended).
- `volume` is optional; missing values are ignored.
- Rows are sorted ascending and NaNs are dropped.

File naming convention:
```
{SYMBOL}_{TIMEFRAME}.csv
```
Example: `EURUSD_M5.csv`.

A tiny sample file is included at `data/EURUSD_M5.sample.csv`.

## Probability model
- Entry price: last completed candle close (second-to-last row).
- Returns: log returns `log(C_t / C_{t-1})` over the lookback window.
- EWMA volatility with `EWMA_LAMBDA` (default `0.94`).
- Horizon volatility: `sigma_h = sigma_1 * sqrt(horizon) * SIGMA_SCALE`.
- Normal assumption for horizon return.

## Environment variables
- `OHLC_DATA_DIR`: path to OHLC CSVs.
- `EWMA_LAMBDA`: EWMA lambda (default `0.94`).
- `SIGMA_SCALE`: multiplier for sigma (default `1.0`).
- `REDIS_URL`: enable caching if set.
- `REDIS_TTL`: cache TTL seconds (default `90`).
- `LOG_LEVEL`: logging level (default `info`).

## Example request
```bash
curl -X POST http://localhost:8000/v1/probability/query \
  -H 'Content-Type: application/json' \
  -d '{
    "symbol": "EURUSD",
    "timeframe": "M5",
    "horizon": 12,
    "lookback": 100,
    "targetX": 5,
    "event": "end"
  }'
```
