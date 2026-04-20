# AIChatPanel — Streaming Chat Component

Loaded only when working in `src/components/taura/`. Do not duplicate this in the root CLAUDE.md.

# STATE SHAPE

```ts
type Msg =
  | { role: "user" | "assistant"; content: string; modelTier?: string; modelName?: string }
  | { role: "confirm"; message: string; confirmation: ConfirmationPayload; action_payload: ActionPayload; dismissed?: boolean }
  | { role: "error"; content: string }
  | { role: "typing" };
```

# STREAMING RULES

- `isLoading=false` immediately after `response.headers` are read — before `reader.read()` — so the user can type the next message while the stream renders.
- RAF flush pattern: tokens accumulate in `assistantSoFar` (closure `let`); `requestAnimationFrame` commits to state max once per frame. `rafPendingRef` gates scheduling, `rafIdRef` allows cancellation.
- Final flush: `cancelAnimationFrame(rafIdRef.current)` + sync `setMessages(assistantSoFar)` after the while loop exits.
- `tier` and `modelName` **must be hoisted as `let` before `try{}`** — `const` inside try is not visible in `finally`. Current location: lines ~99-100.

# CONFIRMATION FLOW

1. Edge function returns `{ requires_confirmation: true, ... }` as JSON (not SSE).
2. `AIChatPanel` adds a `{ role: "confirm", ... }` message — rendered as `<ConfirmActionCard>`.
3. User clicks Conferma → `handleConfirmAction(action_payload)` → POST with `execute_confirmed_action: true`.
4. User clicks Annulla → `handleCancelAction()` → appends "Azione annullata" assistant message.
5. Dismissed cards render `null` (not removed from array — preserves scroll position).

# FILE UPLOAD FLOW

`sha256Hex(file)` → upload to `contracts` bucket → `parse-contract` dry_run → if `needs_confirmation`: show athlete selection popup (`pendingConfirmation` state) → `finalizeChatUpload()` with confirmed athletes.

# RELATED FILES

- `ConfirmActionCard.tsx` — renders confirmation UI; `ACTION_QUESTIONS` and `FIELD_LABELS` maps are here
- `ChatErrorBoundary.tsx` — wraps this component in `DashboardLayout.tsx`; increments `errorKey` to force clean remount on crash
- `supabase/functions/chat/index.ts` — the edge function this component calls
