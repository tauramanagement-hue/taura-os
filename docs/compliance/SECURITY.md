# Security Policy — Taura OS

**Versione**: 2026-04-21 · **Titolare**: Alessandro Martano — P.IVA 17902421001

## Contatto di sicurezza

- Email: **info@tauramanagement.com**
- PEC: **alessandromartano@pecprivato.it**

Se ritieni di aver individuato una vulnerabilità, ti preghiamo di segnalarcela in modo responsabile (responsible disclosure) prima di divulgarla pubblicamente. Ci impegniamo a rispondere entro 5 giorni lavorativi e a riconoscere il merito dei reporter responsabili (previo consenso).

## Principi

- **Least privilege** — ogni chiave ha lo scope minimo necessario.
- **Defense in depth** — RLS Postgres + validazione applicativa + guardrail prompt.
- **Minimizzazione** — raccogliamo e inviamo ai terzi solo ciò che serve.
- **Fail secure** — in caso di errore, blocchiamo, non esponiamo.

## Controlli tecnici

### Dati a riposo
- Postgres cifrato at-rest (AES-256) — default Supabase AWS eu-north-1.
- Storage bucket cifrato at-rest; signed URL obbligatori, no bucket pubblici.
- Password hash bcrypt tramite Supabase Auth (mai in chiaro nel codice).

### Dati in transito
- TLS 1.2+ obbligatorio su tutti gli endpoint.
- HSTS preload (via hosting).
- Nessun fallback HTTP.

### Accesso DB
- **Row-Level Security (RLS) abilitata su tutte le tabelle con dati utente**. Ogni policy verifica `auth.uid()` e/o `agency_id`.
- `service_role` key usata **solo** da edge functions, mai esposta al client.
- `anon` key usata dal client con policy RLS stringenti.

### Autenticazione
- Supabase Auth — JWT RS256.
- Durata sessione configurabile; refresh token rotazione attiva.
- 2FA disponibile (roadmap: obbligatorio per ruolo admin).

### Segreti
- Mai committati nel repo (`.gitignore` copre `.env*`).
- Gestiti via Supabase Functions secrets + Vercel env vars.
- Rotazione: almeno annuale; obbligatoria dopo data breach.

### Edge functions
- Validazione del JWT utente su ogni request protetta.
- CORS headers espliciti (`corsHeaders` in `_shared/cors.ts`).
- Input validation prima di qualsiasi query DB.
- Guard rail prompt-injection e out-of-scope in `chat/index.ts`.

### Client frontend
- `rehype-sanitize` attivo su tutti i render Markdown (chat AI, report).
- CSP (Content-Security-Policy) gestita a livello di hosting.
- No `dangerouslySetInnerHTML` senza sanitizzazione.
- Validazione input lato client **E** server.

## Gestione vulnerabilità

- Dipendenze: verifica `npm audit` settimanale; patch critiche < 7 giorni.
- Supabase advisor: controllo mensile (`mcp__...__get_advisors`).
- Monitoraggio advisory provider (Anthropic, Google, Vercel).

## Backup e disaster recovery

- Backup Postgres giornalieri — gestiti da Supabase, retention 7gg (piano corrente); upgrade a 30gg quando il business lo giustifica.
- Point-in-time recovery fino al piano Pro.
- Storage bucket con versioning quando abilitato.
- Export manuale periodico (trimestrale) del DB schema e dati aggregati.

## Log e monitoraggio

- `audit_log` table con log applicativi (azioni utente, chiamate AI, export/delete dati).
- Supabase logs per edge functions.
- Hosting logs (Vercel) per richieste HTTP.
- Retention audit_log: 24 mesi (Art. 32 GDPR + raccomandazione Garante per log amministrativi).

## Formazione

- Il titolare legge periodicamente: OWASP Top 10, Linee Guida Garante, EDPB updates.
- In caso di futuri collaboratori: training obbligatorio pre-onboarding + attestazione scritta.

## Test

- Attuali: revisione manuale PR, smoke test pre-deploy.
- Roadmap: penetration test esterno entro 12 mesi dall'apertura early access; vulnerability scanning continuo (es. Aikido, Snyk).
