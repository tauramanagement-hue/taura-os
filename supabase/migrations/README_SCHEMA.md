# Schema & "table not in schema cache" fix

## Tables: migrations vs frontend

**Frontend** (`src/integrations/supabase/types.ts`) expects these `public` tables:

| Table | In existing migrations? | In baseline migration? |
|-------|-------------------------|-------------------------|
| activities | Yes (20260224145452) | Yes |
| agencies | Yes (20260224145452) | Yes |
| athletes | Yes (20260224145452) | Yes |
| campaign_deliverables | Yes (20260224171439 + 20260226113622) | Yes |
| campaigns | Yes (20260224171439) | Yes |
| chat_messages | Yes (20260224145452) | Yes |
| chat_threads | Yes (20260224145452) | Yes |
| conflicts | Yes (20260224145452 + 20260224175113) | Yes |
| contracts | Yes (20260224145452) | Yes |
| deals | Yes (20260224145452) | Yes |
| notifications | Yes (20260224145452) | Yes |
| profiles | Yes (20260224145452 + 20260226113622) | Yes |
| reports | Yes (20260226113622) | Yes |
| clauses | **No** (not in types.ts; added per request) | Yes |

So **no table is missing from the migration files**. The error  
`Could not find the table 'public.agencies' in the schema cache`  
usually means **migrations have not been applied** to the Supabase project you’re using (e.g. new project, or DB was reset).

## How to fix

1. **Apply migrations**  
   From the project root:
   ```bash
   npx supabase db push
   ```
   Or link the project first: `npx supabase link --project-ref <your-ref>` then `npx supabase db push`.

2. **Or run the baseline migration manually**  
   If you prefer a single script (e.g. on a fresh project or in SQL Editor):
   - Open Supabase Dashboard → SQL Editor.
   - Run the contents of:
     **`20260227220000_baseline_public_tables_if_missing.sql`**

   That migration creates all tables with `CREATE TABLE IF NOT EXISTS`, adds any missing columns, enables RLS, creates policies, the `handle_new_user` trigger, and realtime for `deals`, `notifications`, `chat_messages`. It is idempotent (safe to run more than once).

3. **Refresh schema cache**  
   After applying migrations, the schema cache usually updates automatically. If the app still shows the error, wait a few seconds and reload, or in Dashboard go to **Settings → API** and confirm the project is the one your app uses.

## Tables created by the baseline migration

- **agencies** – tenant/agency
- **profiles** – user profile (auth.users), optional `agency_id`, `last_briefing_date`
- **athletes** – roster, optional `social_enriched_at`
- **contracts** – contracts with `ai_extracted_clauses` (JSONB)
- **conflicts** – contract conflicts, `resolution_note`
- **deals** – deal pipeline
- **activities** – activity log
- **chat_threads** / **chat_messages** – AI chat
- **notifications**
- **campaigns** / **campaign_deliverables** – campaigns and deliverables (with impressions, engagement_rate, reach, link_clicks)
- **reports**
- **clauses** – optional table for normalized contract clauses (not in frontend types yet)

All tables have RLS enabled and agency/user-scoped policies consistent with the existing migrations.
