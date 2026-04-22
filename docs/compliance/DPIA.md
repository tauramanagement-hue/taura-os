# DPIA — Data Protection Impact Assessment (Art. 35 GDPR)

**Versione**: 2026-04-21 · **Titolare**: Alessandro Martano — P.IVA 17902421001

## 1. Contesto e necessità della DPIA

Taura OS comporta:
- uso **sistematico** di AI generativa su dati di terzi (atleti, brand);
- possibile trattamento di **dati di minori** (atleti minorenni rappresentati);
- trasferimenti **extra-UE** per componente AI;
- combinazione di grandi quantità di dati strutturati (contratti, deal, social).

Questi elementi, presi congiuntamente, rendono opportuna una DPIA ex Art. 35.3 GDPR, secondo le Linee Guida WP29 (WP248 rev.01) — la DPIA è consigliata quando ricorrono ≥ 2 criteri tra i 9 elencati: ricorrono (a) valutazione/scoring algoritmica leggera (classificazione query L1/L2/L3), (b) elaborazione su larga scala, (c) trasferimento extra-UE, (d) dati di soggetti vulnerabili (minori).

## 2. Descrizione del trattamento

### 2.1 Finalità
- Assistenza conversazionale agli agenti sportivi.
- Estrazione strutturata da contratti e brief.
- Suggerimenti su deal, atleti, scadenze.
- Invio automatico di azioni solo previa conferma esplicita dell'utente.

### 2.2 Categorie di dati
- Identificativi utente (email, nome).
- Dati atleti: nome, sport, social, data di nascita (derivata), status.
- Dati contrattuali: parti, importi, date, clausole.
- Testo libero utente e file caricati.

### 2.3 Flusso tecnico
```
Utente → Edge Function chat/
       → llm-router.ts (classifica L1/L2/L3)
       → L1: Gemini Flash-Lite (Vertex europe-west1)
       → L2: Claude Sonnet (Anthropic USA, SCC)
       → L3: Claude Opus (Anthropic USA, SCC)
       → stream SSE al client
       → audit_log (no contenuto, solo metadata)
```

## 3. Necessità e proporzionalità

- **Base giuridica**: Art. 6.1.b (esecuzione contratto SaaS). Per AI processing raccolta anche consenso Art. 6.1.a granulare e revocabile.
- **Minimizzazione**: inviati al modello solo messaggi strettamente necessari + contesto derivato. Nessun dump di intere tabelle.
- **Anonimizzazione**: regex PII mask prima dell'invio.
- **Alternative scartate**: modello self-hosted (Llama) — scartato per costi infrastrutturali e qualità output inferiore al caso d'uso. Rivalutabile quando il volume lo giustifichi.

## 4. Valutazione dei rischi

| Rischio | Probabilità | Impatto | Severità | Misure mitigative |
|---|---|---|---|---|
| Accesso non autorizzato a dati di un'agenzia da parte di un'altra (cross-tenant leak) | Bassa | Alto | Medio | RLS obbligatoria su `agency_id`; test automatici di isolamento; audit log |
| Esfiltrazione prompt da parte di provider AI | Bassa | Alto | Medio | SCC, DPA no-training, retention 30gg, anonimizzazione PII |
| Allucinazione AI → decisione commerciale errata | Media | Medio | Medio | Pattern conferma esplicita; disclaimer nelle UI; output AI = suggerimento |
| Prompt injection che estrae contesto di altri utenti | Bassa | Alto | Medio | Guard rail in `chat/index.ts`; contesto server-side solo per `agency_id` corrente |
| Data breach Anthropic/Vertex | Bassa | Medio | Basso | Retention minima; monitoraggio advisory provider; procedura notifica 72h |
| Esposizione dati di minore senza consenso genitoriale | Bassa | Alto | Medio | Flag `is_minor` + bloccante upload consenso genitoriale in form atleta |
| Persistenza dati oltre retention dichiarata | Media | Medio | Medio | `pg_cron` automatico; verifica mensile job attivi |
| Revoca consenso non propagata all'AI | Bassa | Medio | Basso | `has_active_consent()` verificato prima di ogni chiamata |
| Richiesta autorità USA (FISA 702) su Anthropic | Molto bassa | Alto | Basso-medio | Nessun dato sensibile nei prompt; SCC; transparency report provider |
| Errore dell'utente → upload PDF con dati sanitari | Media | Alto | Medio | Disclaimer upload; documentazione; warning UI; procedura cancellazione immediata su richiesta |

## 5. Misure di sicurezza tecniche e organizzative

**Tecniche**
- Cifratura in-transit (TLS 1.2+) e at-rest (Postgres + Storage).
- RLS Postgres con `agency_id`.
- SHA-256 hashing di IP/UA nei log.
- Soft-delete → hard-delete automatico 30gg (`pg_cron`).
- Segregazione chiavi: `anon`, `service_role` (solo edge), JWT utente.
- No decisioni automatizzate con effetti giuridici.
- Audit log di ogni chiamata AI.

**Organizzative**
- Accesso amministrativo limitato al titolare.
- Documentazione interna (ROPA, TIA, questo DPIA, playbook breach).
- Consenso granulare versionato + `ConsentVersionGate` per re-consent su modifiche sostanziali.
- Procedura DSR (Data Subject Request) con SLA 30 giorni via `DataRightsPanel`.
- Titolare funge da referente privacy; `info@tauramanagement.com` indirizzo dedicato.

## 6. Consultazione preventiva del Garante

Non necessaria se le misure mitigative sono giudicate sufficienti a ridurre i rischi a livello accettabile (Art. 36 GDPR). Valutazione: **rischio residuo accettabile** → no consultazione preventiva.

**Trigger per consultazione futura**:
- Introduzione di trattamento sistematico di dati sanitari/giudiziari.
- Profilazione con effetti giuridici.
- Volume tale da rientrare tra "very large online platform" (DSA).

## 7. Revisione

La DPIA va aggiornata:
- ad ogni modifica sostanziale del flusso AI;
- all'aggiunta di una categoria particolare di dati;
- al superamento di soglie di volume;
- almeno annualmente.

| Data | Autore | Modifica |
|---|---|---|
| 2026-04-21 | A. Martano | Prima emissione |
