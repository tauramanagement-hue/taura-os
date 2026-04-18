# QIE Router — Integration Guide

Minimal, surgical edits to roll the new QIE pipeline out. Nothing below is a
rewrite: every item is a targeted delta to an existing file.

---

## 0. Prerequisites (one-shot)

### 0.1 Apply migrations
```bash
npx supabase db push
```
Two new migrations ship with this PR:
- `supabase/migrations/20260417140000_ai_routing_logs.sql` — routing/telemetry
  table with `score_breakdown jsonb`, `data_quality`, `chain`, `response_time_ms`,
  `model_selected`. RLS SELECT-only via `profiles.agency_id`.
- `supabase/migrations/20260417141000_seed_ai_extracted_clauses.sql` —
  idempotently seeds realistic IT contract clause JSONB on up to 30 rows where
  `ai_extracted_clauses IS NULL` (8 variants: bevande, abbigliamento, beauty,
  automotive, energy, gaming, mandato agenzia, nutrition).

### 0.2 Deploy the edge function
```bash
npx supabase functions deploy qie-router --no-verify-jwt
```
The JWT is verified manually inside the handler (same pattern as `chat`).

### 0.3 Secrets (already present in the project)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (Sonnet L2, Opus L3)
- `GEMINI_API_KEY` (Flash L1)

No new secrets required.

---

## 1. Architecture — canonical module layout

Per spec, all reasoning logic lives under `src/lib/ai/`:

| Path                                   | Role                                  |
| -------------------------------------- | ------------------------------------- |
| `src/lib/ai/systemPrompt.ts`           | Layer 1 — opinionated system prompt   |
| `src/lib/ai/contextBuilder.ts`         | Layer 4 — live agency snapshot        |
| `src/lib/ai/qieDomainClassifier.ts`    | Layer 2 — deterministic QIE classify  |
| `src/lib/ai/qieDataFetchers.ts`        | Layer 2 — 16 domain fetchers          |
| `src/lib/ai/complexityRouter.ts`       | Layer 3 — L1/L2/L3 scoring            |
| `supabase/functions/qie-router/index.ts` | Layer 5 — orchestrator edge fn      |

The old `supabase/functions/_shared/*.ts` files are thin re-export shims
pointing at the canonical `src/lib/ai/*` modules, so nothing else needs to
change immediately.

Architectural law: **the LLM is a PRESENTER, not a FILTER.** It never queries
the DB. All numbers come from the pre-computed QIE payload.

---

## 2. AI Lab (already wired)

- `src/pages/AILab.tsx` — standalone chat UI calling `qie-router` with
  `lab_mode: true`. Right panel shows query_id, domain+confidence, chain,
  matched_rules, entities, score breakdown, level→model, override reason,
  data_quality, suggested_followups, needs_clarification.
- `src/App.tsx` — route `/ai-lab` **outside** `DashboardLayout`. Not in the
  sidebar — access via direct URL only.

Use it to iterate on classification + scoring without touching the prod chat.
Every test writes to `ai_routing_logs` so you can A/B decisions.

---

## 3. Production chat switchover (when lab is stable)

`src/components/taura/AIChatPanel.tsx` currently POSTs to `/functions/v1/chat`.
Three surgical edits flip it to `qie-router`:

### Edit 1 — endpoint URL
```ts
// BEFORE
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
// AFTER
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qie-router`;
```

### Edit 2 — add `thread_id` and use the constant
```ts
const response = await fetch(CHAT_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.access_token}`,
    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  },
  body: JSON.stringify({
    thread_id: `chat:${user?.id ?? "anon"}`,
    messages: allMessages.map(m => ({ role: m.role, content: m.content })),
  }),
});
```

The router also accepts the spec form
`{ message, conversation_history, attachments?, system_context? }` — use
whichever is more convenient on the client.

### Edit 3 — header rename
```ts
// BEFORE
const tier = response.headers.get("X-Model-Tier") ?? "";
// AFTER
const tier = response.headers.get("X-QIE-Level") ?? "";
// optional extras:
const dq = response.headers.get("X-QIE-Data-Quality") ?? "";
const qid = response.headers.get("X-QIE-Query-Id") ?? "";
```

SSE parsing loop stays identical — `qie-router` streams Anthropic SSE
pass-through.

### Rollback
Revert the URL + header names. No DB changes to roll back.

---

## 4. Keep `chat` around (deliberately)

Do **not** delete `supabase/functions/chat/index.ts`. It still owns:
- Commission fast-path
- Deliverable status bulk-update intent
- File upload → `parse-contract` orchestration

Those are write-path intent flows; `qie-router` is read/classify/route only.
After migration, use `qie-router` for conversation and the `action_request`
domain will emit `requires_confirmation: true` with a structured intent — the
UI can then hand confirmed actions to `chat` (or a new action executor) for
the mutation.

---

## 5. Observability

```sql
select
  domain,
  model_level,
  data_quality,
  count(*),
  avg(response_time_ms)::int as avg_ms,
  avg(domain_confidence)::numeric(4,2) as avg_conf
from ai_routing_logs
where created_at > now() - interval '1 day'
group by 1, 2, 3
order by count(*) desc;
```

Inspect score breakdowns directly:
```sql
select query_text, score, score_breakdown, override_reason
from ai_routing_logs
where override_reason is not null
order by created_at desc
limit 50;
```

Canary signals: repeated `general_conversation` fallbacks, L3 averages > 8s,
`data_quality='insufficient'` spikes on a specific domain.

---

## 6. File inventory

**New canonical modules (spec layout):**
- `src/lib/ai/systemPrompt.ts`
- `src/lib/ai/contextBuilder.ts`
- `src/lib/ai/qieDomainClassifier.ts`
- `src/lib/ai/qieDataFetchers.ts`
- `src/lib/ai/complexityRouter.ts`

**New edge function / migrations:**
- `supabase/functions/qie-router/index.ts`
- `supabase/migrations/20260417140000_ai_routing_logs.sql`
- `supabase/migrations/20260417141000_seed_ai_extracted_clauses.sql`

**Lab UI:**
- `src/pages/AILab.tsx`
- `src/App.tsx` — `+import AILab` and `+<Route path="/ai-lab" ...>`.

**Legacy shims (thin re-exports, kept for backward-compat imports):**
- `supabase/functions/_shared/system-prompt.ts`
- `supabase/functions/_shared/context-builder.ts`
- `supabase/functions/_shared/qie-classifier.ts`
- `supabase/functions/_shared/qie-fetchers.ts`
- `supabase/functions/_shared/complexity-router.ts`

**Existing files to modify when flipping prod chat (future PR):**
- `src/components/taura/AIChatPanel.tsx` — 3 edits listed in §3.
