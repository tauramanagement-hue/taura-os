# Sub-processor — Elenco e DPA

**Versione**: 2026-04-21 · **Titolare**: Alessandro Martano — P.IVA 17902421001

Elenco aggiornato dei responsabili del trattamento (sub-processor) utilizzati da Taura OS. Ai sensi dell'Art. 28.2 GDPR, ogni cliente è informato e può opporsi motivatamente all'aggiunta di nuovi sub-processor.

## Attivi

| Fornitore | Ruolo | Finalità | Region dati | Meccanismo trasferimento | DPA |
|---|---|---|---|---|---|
| **Supabase Inc.** | Hosting DB, Auth, Storage, Edge Functions | Backend della piattaforma | UE — AWS `eu-north-1` (Stoccolma) | Nessun transfer per storage. Entità USA → SCC nel DPA | <https://supabase.com/legal/dpa> |
| **Anthropic PBC** | LLM (Claude Sonnet, Claude Opus) | Chat AI, reasoning, analisi testo | USA (California) | SCC 2021/914 Modulo 2 + DPA Commercial API, no-training, retention 30gg | <https://www.anthropic.com/legal/commercial-terms> |
| **Google LLC — Google Cloud / Vertex AI** | LLM (Gemini 2.5 Flash / Flash-Lite) | Classificazione query, ranking | UE `europe-west1` (Belgio) | CDPA Google + SCC UE | <https://cloud.google.com/terms/data-processing-addendum> |
| **Vercel Inc.** | Hosting frontend statico | Delivery dell'app web | UE (edge network) / USA (fallback) | DPA Vercel + SCC | <https://vercel.com/legal/dpa> |

## In valutazione (non ancora attivi)

| Fornitore | Ruolo previsto | Stato | Azioni richieste prima del go-live |
|---|---|---|---|
| **Stripe (Ireland) Ltd** | Pagamenti, sottoscrizioni | Attivazione prevista entro maggio 2026 | (1) Firma DPA Stripe; (2) aggiornamento Privacy Policy § sub-processor; (3) bump `privacy_versions` → re-consent; (4) aggiornamento ROPA con nuova finalità Art. 6.1.b/c |
| **Error tracking** (Sentry / PostHog / Highlight) | Monitoraggio crash e errori | Da decidere | Vedi sezione "Error tracking" in `COMPLIANCE_GUIDE.md` |
| **Analytics** | Metriche utilizzo | Da decidere (probabilmente Vercel Analytics) | Verifica region dati; aggiornamento Cookie Policy se non edge-anonymous |
| **Email provider** (Resend / Postmark) | Email transazionali (conferme DSR, notifiche) | Da valutare quando volume lo giustifica | Firma DPA; region EU preferita; SPF/DKIM/DMARC |

## Template: procedura di aggiunta di un nuovo sub-processor

1. Il titolare identifica la necessità (nuovo fornitore).
2. Verifica: ha un DPA Art. 28 pubblicato? Rispetta `eu-north-1`-like o ha SCC? Ha certificazioni (ISO 27001, SOC 2, DPF) ?
3. Firma del DPA — **prima** di inviare dati.
4. Aggiornamento del presente file (`subprocessors.md`).
5. Aggiornamento di `ROPA.md` con la nuova finalità/destinatario.
6. Se rischio Schrems II → aggiornamento `TIA.md`.
7. Aggiornamento Privacy Policy pubblica (`src/pages/Privacy.tsx`).
8. Bump `privacy_versions` nella DB (seed) → ConsentVersionGate notifica agli utenti.
9. Email informativa ai clienti B2B attivi (30 giorni di preavviso se previsto dal DPA).

## Template: diritto di opposizione

Ai sensi dell'Art. 28.2 GDPR, un cliente può opporsi motivatamente all'aggiunta di un sub-processor. Procedura:
1. Cliente invia opposizione a `info@tauramanagement.com`.
2. Il titolare valuta: l'obiezione è motivata e ragionevolmente proporzionata?
3. Se accettata → configurazione dedicata senza il sub-processor (se tecnicamente possibile) oppure risoluzione del contratto con rimborso pro-rata.
4. Se respinta → motivazione scritta al cliente.

## Certificazioni dei sub-processor (verifica periodica)

| Fornitore | Certificazioni dichiarate | Link verifica |
|---|---|---|
| Supabase | SOC 2 Type II, HIPAA-ready | <https://supabase.com/security> |
| Anthropic | SOC 2 Type II | <https://trust.anthropic.com> |
| Google Cloud | ISO 27001, 27017, 27018, SOC 1/2/3, DPF | <https://cloud.google.com/security/compliance> |
| Vercel | SOC 2 Type II | <https://vercel.com/security> |
