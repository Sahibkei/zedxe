# Data boundary: MongoDB vs Supabase

## MongoDB (system of record)
MongoDB owns user, auth, and application state:

- Users and profiles
- Sessions and authentication data
- Portfolios and positions
- Watchlists
- Alerts and notifications
- Waitlist entries

## Supabase (analytics + time-series)
Supabase owns time-series and analytics outputs:

- Orderflow data
- `model_cache`
- `model_equity_points`
- Other derived analytics tables

## Rules
- Orderflow data must not be stored in MongoDB going forward.
- MongoDB should only reference analytics outputs by ID or metadata.
- Supabase is the source of truth for time-series and model output data.

## Caching layer
Upstash Redis will be used to cache expensive endpoints in a later PR. The cache layer is optional and should never block core functionality if Redis is unavailable.
