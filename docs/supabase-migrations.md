# Supabase migrations

## Migration file location

The SQL migration for PR-2 lives at:

```
/supabase/migrations/202602141200_sql_phase_pr2.sql
```

## Apply in the Supabase dashboard (SQL editor)

1. Open the Supabase dashboard for your project.
2. Go to **SQL Editor**.
3. Copy the contents of the migration file above and paste them into a new query.
4. Run the query to create the tables, indexes, RLS settings, and retention function.

## RLS notes

Row Level Security is enabled on `orderflow_trades`, `model_cache`, and `retention_runs`.
Only the **service role** key can bypass RLS; no anon policies are created.

## Verify tables

After running the migration, you can confirm creation with simple checks:

```sql
select count(*) from public.orderflow_trades;
select count(*) from public.model_cache;
select count(*) from public.retention_runs;
```
