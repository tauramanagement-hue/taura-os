# ROPA — Registro dei trattamenti (Art. 30 GDPR)

**Titolare del trattamento**
- Alessandro Martano (ditta individuale)
- P.IVA 17902421001 — CF MRTLSN06H08H501S
- Sede: Via Rumenia 210, 00071 Roma
- PEC: alessandromartano@pecprivato.it
- Contatto privacy: info@tauramanagement.com

**Referente privacy**: il titolare stesso (no DPO designato — non obbligatorio ex Art. 37 GDPR per questa dimensione).

**Data ultimo aggiornamento**: 21 aprile 2026.

Obbligo di tenuta del registro: Art. 30.1 GDPR — applicabile in quanto il trattamento non è occasionale e può includere dati di minori (categoria a rischio).

---

## Trattamento 1 — Gestione account utenti della piattaforma

| Campo | Dettaglio |
|---|---|
| Finalità | Erogazione del servizio SaaS Taura OS (autenticazione, profilo agenzia, team) |
| Base giuridica | Art. 6.1.b — esecuzione del contratto |
| Categorie interessati | Utenti registrati (agenti sportivi, staff agenzie) |
| Categorie dati | Email, nome, ruolo, agenzia di appartenenza, hash password (gestito da Supabase Auth), log accesso |
| Destinatari | Supabase Inc. (responsabile — hosting DB/Auth) |
| Trasferimenti extra-UE | No. Supabase region `eu-north-1` (Stoccolma). |
| Retention | Durata del rapporto contrattuale + 30gg soft-delete → hard-delete via pg_cron |
| Misure di sicurezza | TLS 1.2+, RLS Postgres, bcrypt password, 2FA disponibile, backup cifrato |

## Trattamento 2 — Gestione atleti e roster agenzia

| Campo | Dettaglio |
|---|---|
| Finalità | Archiviazione dati atleti rappresentati per gestione contratti, deal, scadenze |
| Base giuridica | Art. 6.1.b (contratto cliente-Taura) + Art. 6.1.f (legittimo interesse agenzia che inserisce dati); per **minori** Art. 8 GDPR + consenso genitoriale documentato (parental_consent_url) |
| Categorie interessati | Atleti professionisti o emergenti, eventualmente minori |
| Categorie dati | Nome, sport, categoria, nazionalità, handle social, follower count, data di nascita, stato rapporto. NO dati sanitari, NO dati giudiziari. |
| Destinatari | Supabase (responsabile). Clienti agenzia (titolari autonomi) tramite DPA |
| Trasferimenti extra-UE | No per storage. Sì se rientrano nel contesto AI (vedi Trattamento 4). |
| Retention | Per durata del rapporto + 24 mesi (default modificabile); consenso genitoriale conservato finché atleta minorenne + 24 mesi dal 18° compleanno |
| Misure di sicurezza | RLS per agency_id, soft-delete, flag is_minor, audit log accessi |

## Trattamento 3 — Gestione contratti e deal commerciali

| Campo | Dettaglio |
|---|---|
| Finalità | Caricamento, parsing, archiviazione contratti tra atleti e brand; calcolo commissioni; scadenziario |
| Base giuridica | Art. 6.1.b — contratto; Art. 6.1.c — obbligo fiscale (conservazione 10 anni ex Art. 2220 c.c.) |
| Categorie interessati | Atleti, agenti, controparti brand |
| Categorie dati | PDF contratto, parti coinvolte, importi, date, clausole, deliverables, status |
| Destinatari | Supabase (responsabile); Anthropic (parsing AI — vedi Trattamento 4) |
| Trasferimenti extra-UE | Solo in fase di parsing AI, con anonimizzazione preventiva di PII non funzionali |
| Retention | 10 anni dal termine contratto (obbligo civilistico/fiscale) |
| Misure di sicurezza | Bucket Storage privato con signed URL, audit log upload/download, parse idempotente via hash sha256 |

## Trattamento 4 — Elaborazione AI (chat assistente e parsing documenti)

| Campo | Dettaglio |
|---|---|
| Finalità | Generazione risposte conversazionali, estrazione strutturata da contratti/brief, classificazione query |
| Base giuridica | Art. 6.1.b — esecuzione contratto (funzionalità core); consenso esplicito `ai_processing` revocabile |
| Categorie interessati | Utenti autenticati; indirettamente atleti/brand menzionati nel contesto |
| Categorie dati | Testo messaggi utente, file caricati, contesto strutturato (nomi, importi, date). NO IBAN/CF/carte in chiaro (anonimizzazione) |
| Destinatari | Anthropic (Claude — responsabile) · Google Cloud Vertex AI (Gemini — responsabile) |
| Trasferimenti extra-UE | Anthropic USA con SCC 2021/914 + DPA + TIA documentata. Vertex: `europe-west1` (nessun transfer). |
| Retention | Anthropic: 30 giorni presso il provider (da contratto). Vertex: nessuno storage prolungato. Cronologia chat locale: 12 mesi |
| Misure di sicurezza | TLS, no-training garantito contrattualmente, anonimizzazione regex PII, audit log per ogni chiamata, guard prompt injection lato edge function |

## Trattamento 5 — Cookie e analytics

| Campo | Dettaglio |
|---|---|
| Finalità | Cookie tecnici (sessione Supabase, preferenza tema/lingua). Analytics: **non attivi** al momento. Marketing: **non attivo**. |
| Base giuridica | Tecnici: Art. 6.1.f + esenzione Art. 122 Codice Privacy. Analytics/marketing: consenso esplicito Art. 6.1.a (attualmente raccolto ma nessun processor attivo) |
| Categorie dati | Token sessione auth, UUID anonimo preferenze UI |
| Retention | Sessione: scadenza JWT Supabase. LocalStorage preferenze: fino a revoca |

## Trattamento 6 — Waitlist landing page

| Campo | Dettaglio |
|---|---|
| Finalità | Raccolta email per notifica apertura early access |
| Base giuridica | Art. 6.1.a — consenso esplicito (checkbox privacy) |
| Categorie dati | Email, timestamp, IP hash |
| Retention | 12 mesi o fino a opt-out |
| Trasferimenti | Nessuno — DB eu-north-1 |

## Trattamento 7 — Audit log e sicurezza

| Campo | Dettaglio |
|---|---|
| Finalità | Rilevazione accessi, esercizio diritti interessato, indagini incident response |
| Base giuridica | Art. 6.1.c — obbligo legale (Art. 32 GDPR); Art. 6.1.f — legittimo interesse sicurezza |
| Categorie dati | user_id, action, timestamp, IP hash SHA-256 (no IP raw), user-agent hash, resource_id |
| Retention | 24 mesi (raccomandazione Garante log amministrativi) |

## Trattamento 8 — Pagamenti (FUTURO — Stripe)

**Stato**: da attivare nei prossimi 15 giorni.

**Prima dell'attivazione richiesto**:
- Firma DPA Stripe (https://stripe.com/legal/dpa)
- Verifica region: Stripe Ireland (UE) come entità contraente
- Aggiornamento Privacy Policy § Sub-processor
- Bump `privacy_versions` a `2026-05-XX` → ConsentVersionGate notifica utenti esistenti
- Aggiunta finalità al presente ROPA con base giuridica Art. 6.1.b + Art. 6.1.c

---

## Misure di sicurezza trasversali

- Cifratura at-rest (Supabase, Storage) e in-transit (TLS 1.2+).
- Row-Level Security (RLS) su tutte le tabelle con `agency_id`.
- Hash SHA-256 per IP e user-agent nei log di consenso/audit.
- Soft-delete + hard-delete automatico via `pg_cron` dopo 30 giorni.
- Separazione rigorosa chiavi: `anon`, `service_role` (solo edge functions), JWT utente.
- No commit di segreti nel repository (`.env` in `.gitignore`; secrets gestiti tramite Supabase/Vercel).
- Accesso amministrativo limitato al titolare.

## Base giuridica dei trasferimenti extra-UE

- **Anthropic (USA)**: SCC UE 2021/914 Modulo 2 (titolare → responsabile) firmate, DPA Anthropic Commercial, TIA documentata in [`TIA.md`](./TIA.md). Misure supplementari: anonimizzazione PII + retention 30gg.
- **Altri fornitori USA** (Vercel se non EU region): SCC standard, verifica periodica residency.

## Diritti degli interessati — Procedure operative

| Diritto | Implementazione | SLA |
|---|---|---|
| Accesso (Art. 15) | Edge function `export-user-data` + UI `DataRightsPanel` | 30 giorni |
| Portabilità (Art. 20) | Export JSON strutturato (stessa function) | 30 giorni |
| Rettifica (Art. 16) | UI Settings + edit atleti/contratti | Immediato |
| Cancellazione (Art. 17) | Edge function `delete-account` + soft-delete 30gg → hard-delete cron | 30 giorni |
| Limitazione (Art. 18) | Flag `deleted_at` + escludere in RLS | 30 giorni |
| Opposizione (Art. 21) | Revoca consenso `ai_processing` o `marketing` tramite DataRightsPanel | Immediato |
| Decisioni automatizzate (Art. 22) | Non applicabile — no decisioni con effetto giuridico |

---

## Revisione

Il presente ROPA deve essere rivisto:
- ad ogni nuovo sub-processor (es. Stripe, Resend, analytics);
- ad ogni nuova finalità (es. marketing attivo, programma referral);
- almeno annualmente;
- dopo ogni data breach.
