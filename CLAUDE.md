# Taura OS — Sport & Talent Management SaaS

Stack: Vite + React 18 · TypeScript strict · Tailwind v4 · Supabase (Postgres + Auth + Storage + Edge Functions) · Deno · Radix UI · React Router

# ARCHITECTURE

**Frontend** (`src/`)
- `src/components/taura/` — feature components (AIChatPanel, ConfirmActionCard, DashboardLayout…)
- `src/hooks/` — useAuth, useAgencyContext (reset on logout — avoid stale agency data)
- `src/lib/ai/` — QIE classifier, complexity router, context builder
- `src/pages/` — one file per route

**Edge Functions** (`supabase/functions/`)
- `chat/` — LLM orchestrator: routing → context → action detection → stream
- `_shared/anthropic.ts` — `callAnthropic()`, `sanitizeMessages()` — **always use this, never call Anthropic directly**
- `_shared/llm-router.ts` — L1/L2/L3 scoring: DEEP +40, MEDIUM +15, SIMPLE −10
- `_shared/gemini.ts` — L1 Gemini Flash
- `parse-contract/`, `parse-brief/`, `file-processor/` — document ingestion

**DB:** only via edge functions or `src/integrations/supabase/client.ts`
**Auth:** `ProtectedRoute.tsx` already wired — do not re-wrap
**RLS:** active on all tables — `agency_id`-scope every query

# RULES

- **Plan before touching >2 files.** State "I'll touch X to do Y, then Z" and wait for confirmation.
- **Supabase nested filters silently ignored.** `.eq("joined.col", val)` without `!inner` = no-op. Two-step: fetch IDs → `.in("id", ids)`.
- **No `temperature` in Anthropic calls.** HTTP 400. `callAnthropic()` already strips it — never add it back.
- **Deno: explicit `.ts` extensions** on all relative imports in `supabase/functions/` and `src/lib/ai/`.
- **`sanitizeMessages()` before every Anthropic call.** Exported from `_shared/anthropic.ts`.
- **Agency isolation.** Every user-data query must `.eq("agency_id", agencyId)` — missing this = cross-tenant leak.
- **No new npm deps without approval.** Check Radix UI / Tailwind first.
- **Structured errors:** `{ code, message, details }` — frontend contract.

# PATTERNS

**New edge function:**
1. Shared logic → `_shared/`. New function → own folder.
2. `corsHeaders` on every response (OPTIONS + actual).
3. Auth token → resolve `agency_id` from profile → then DB work.
4. `streamDirectText(msg, corsHeaders)` for instant no-LLM responses.

**LLM router (`_shared/llm-router.ts`):**
- DEEP_PATTERNS → +40 (L3 at ≥40/50 by tier)
- MEDIUM_PATTERNS → +15. Must require an object word after the verb — avoid bare `/cosa|dimmi/i`.
- SIMPLE_PATTERNS → −10. Use `^` anchors for short queries.
- Thresholds: starter L2≥25 / professional L2≥20 L3≥50 / enterprise L2≥15 L3≥40.

**AIChatPanel streaming:**
- Set `isLoading=false` right after `response.headers` — before the stream loop.
- RAF pattern: accumulate tokens in closure, flush via `requestAnimationFrame`. Final flush: `cancelAnimationFrame` + sync `setMessages`.
- Hoist `tier` and `modelName` as `let` before `try{}` so `finally{}` can read them.

**File uploads:** `sha256Hex()` dedup → `contracts` bucket → `parse-contract` → dry_run → confirm athletes → finalize.

# CONSTRAINTS

- No hardcoded secrets — `Deno.env` / `import.meta.env`
- No `window.confirm()` for destructive actions — use `ConfirmActionCard`
- No `(data as any)` — fix the type
- Keep `rehype-sanitize` on ReactMarkdown — never remove
- Prompt injection + out-of-scope guards in `chat/index.ts` — do not move downstream

# KNOWN GOTCHAS

| Symptom | Cause | Fix |
|---|---|---|
| Anthropic HTTP 400 | `temperature` in payload | Remove it — never include |
| Deploy: module not found | Missing `.ts` in Deno import | Add explicit extension |
| Write action: deliverable not found | Nested `.eq()` ignored by Supabase JS | Two-step with `.in()` |
| Input blocked after response | `setIsLoading(false)` called after stream | Call it after `response.headers` |
| Simple query → L2 | MEDIUM_PATTERNS too broad | Require object word after verb |
| Ranking query → 22s timeout | Context block 14k chars sent to Opus | Use `compressContextForRanking()` in `chat/index.ts` |
| Chat crashes on render | `tier` undefined in `finally` | Hoist as `let` before `try{}` |
