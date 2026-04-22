# Guida operativa: come rimanere compliant passo passo

**A chi serve**: al titolare Alessandro Martano, come promemoria operativo.
**Quando usarla**: ogni volta che si aggiunge un fornitore, si modifica un trattamento, si verifica un incidente, o come routine periodica.

---

## 1. Retention policy — valori di default attivi

| Categoria dati | Retention | Implementazione |
|---|---|---|
| Account utente attivi | Per durata rapporto | Nessun job — cancellabile on-demand |
| Account soft-deleted | 30 giorni → hard-delete | `pg_cron` gdpr-hard-delete-daily |
| Contratti e deal | 10 anni dal termine | Art. 2220 c.c. — **non cancellare prima** |
| Dati atleti | 24 mesi dopo termine rapporto | Modificabile con richiesta utente prima |
| Chat AI (cronologia locale) | 12 mesi | `pg_cron` gdpr-chat-retention-weekly |
| Audit log | 24 mesi | `pg_cron` gdpr-audit-retention-weekly |
| Waitlist | 12 mesi o fino a opt-out | `pg_cron` gdpr-waitlist-retention-weekly |
| Export URL firmati | 7 giorni | `pg_cron` gdpr-export-url-cleanup-daily |
| Log Anthropic (presso provider) | 30 giorni | Gestito da Anthropic |
| Consenso genitoriale minore | Finché minorenne + 24 mesi dal 18° | Cancellabile on-demand |

### Come verificare che i job siano attivi

Ogni **3 mesi**, eseguire in SQL editor Supabase:
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'gdpr-%';
```
Tutti devono essere `active=true`. Se uno è disattivato → riattivare o documentare il motivo.

### Come modificare un valore di retention

1. Aggiornare il `CRON` job in Supabase (SQL editor).
2. Aggiornare la Privacy Policy pubblica (`src/pages/Privacy.tsx`) con il nuovo valore.
3. Aggiornare `ROPA.md` con il nuovo valore.
4. Bump `privacy_versions` (vedi § 6) → ConsentVersionGate notifica utenti.

---

## 2. Cosa fare PRIMA di integrare Stripe (nei prossimi 15 giorni)

Stripe tratta dati finanziari → trattamento critico. Checklist obbligatoria:

1. **Firmare il DPA Stripe** — <https://stripe.com/legal/dpa> (accettazione via dashboard account).
2. **Entità contraente**: Stripe Payments Europe Ltd (Dublino, Irlanda) — UE, niente Schrems II.
3. **Aggiornare Privacy Policy** (`src/pages/Privacy.tsx`):
   - Aggiungere finalità "Gestione pagamenti e sottoscrizioni".
   - Base giuridica Art. 6.1.b + Art. 6.1.c (obblighi fiscali).
   - Aggiungere Stripe come sub-processor.
4. **Aggiornare `ROPA.md`** → convertire il Trattamento 8 da "FUTURO" ad attivo.
5. **Aggiornare `subprocessors.md`** → spostare Stripe in tabella "Attivi".
6. **Bump `privacy_versions`** (vedi § 6).
7. **Configurare webhook Stripe** (secret separato dalle altre chiavi; `STRIPE_WEBHOOK_SECRET` in Supabase Functions secrets).
8. **Mai salvare PAN/CVV** — Stripe Elements gestisce i dati carta; noi salviamo solo `stripe_customer_id` e `subscription_id`.
9. **PCI DSS scope**: SAQ A (minimo) — solo se integrazione con Stripe Checkout/Elements, senza mai toccare carte lato nostro server.
10. **Attivare Stripe Radar** per fraud detection (incluso nel piano standard).
11. **Invoice retention**: 10 anni (Art. 2220 c.c.) — scaricare fatture generate e archiviarle.

**Tempistica dell'aggiornamento legale**: Privacy Policy → bump versione → re-consent utenti esistenti **almeno 15 giorni prima** del go-live Stripe. Tempo minimo di notifica per modifiche sostanziali (Art. 12 GDPR — informativa trasparente).

---

## 3. Error tracking — cos'è e quali scelte fare

### Cos'è
Un "error tracking" è un servizio che **riceve dal client (browser o edge function) gli errori runtime non gestiti** (es. exception JavaScript, crash, errori di rete 500), li aggrega e ti avvisa quando succedono. Oggi se un utente ha un crash, tu non lo sai finché non te lo segnala. Con error tracking vedi:
- stack trace dell'errore;
- browser/OS della vittima;
- sequenza di click/azioni che ha portato al crash (breadcrumbs);
- quante persone hanno avuto lo stesso errore.

### Perché serve
- Migliore UX (fix prima che l'utente si lamenti).
- Obbligo implicito Art. 32 GDPR — "misure tecniche e organizzative adeguate" implica sapere quando l'app si rompe.
- Fa parte del playbook breach (Fase 1 — rilevazione).

### Implicazioni GDPR
Un error tracker cattura spesso:
- URL visitato (può contenere ID atleta/contratto → PII);
- stack trace (può contenere email, token se mal passati);
- IP dell'utente;
- breadcrumbs azioni.

→ è **sub-processor** a tutti gli effetti. Serve DPA firmato, region UE, clausole no-training, anonimizzazione opzioni.

### Opzioni consigliate

| Prodotto | Pro | Contro | Region UE |
|---|---|---|---|
| **Sentry** | Standard di fatto, ottimo stack trace, free tier 5k events/mese | USA-centric (Sentry Inc.), ma ha region EU dedicata a richiesta | Sì (EU data residency add-on) |
| **PostHog** (error tracking + analytics combinato) | EU cloud (Frankfurt), open-source, include analytics | Curva di apprendimento | Sì (posthog.com/eu) |
| **Highlight.io** | Session replay integrato | Vendor USA | Sì (self-hosted possibile) |
| **Vercel Observability** | Zero setup se hosting su Vercel | Feature limitate vs Sentry | Sì (eu-west) |

### Raccomandazione
Per Taura oggi (early-stage, volume basso): **PostHog EU** oppure **Sentry con EU data residency**. Entrambi hanno piano free sufficiente.

### Checklist di attivazione (quale che sia)
- [ ] Firmare DPA.
- [ ] Selezionare region UE.
- [ ] Attivare `beforeSend` scrubber per rimuovere email/token/CF da ogni evento prima dell'invio.
- [ ] Disabilitare raccolta automatica di body POST.
- [ ] Aggiornare ROPA + subprocessors + Privacy Policy.
- [ ] Bump `privacy_versions`.

---

## 4. Analytics — cosa scegliere

Oggi **non** usiamo analytics. Quando servirà misurare usage:

### Opzioni
| Prodotto | Cookie banner richiesto? | Region |
|---|---|---|
| **Vercel Analytics** (web vitals, no identificazione individuale) | No se in modalità "aggregata anonima" | EU edge |
| **Plausible** (EU, Germania) | No (cookieless) | EU |
| **PostHog EU** | Sì se identificazione utente | EU |
| **Google Analytics 4** | Sì sempre (ePrivacy + TIA) | USA — **sconsigliato** per GDPR in Italia (Garante ha sanzionato GA4 in passato) |

### Raccomandazione
**Plausible** o **Vercel Analytics in modalità anonima** → niente cookie banner obbligatorio, niente nuovo consenso.

### Se invece attivi analytics con identificazione
- Aggiungi categoria "Statistici" al `CookieConsentBanner` (già predisposta).
- Aggiorna Cookie Policy (`src/pages/Cookies.tsx`) elencando gli specifici cookie.
- Aggiorna Privacy Policy.
- Bump `privacy_versions`.

---

## 5. Quando bumpare `privacy_versions`

Ogni modifica **sostanziale** delle informative richiede re-consent. Criterio Art. 13 GDPR + Linee Guida EDPB.

### Modifiche che richiedono bump (SÌ)
- Nuovo sub-processor (Stripe, analytics, email provider).
- Nuova finalità di trattamento.
- Modifica della base giuridica.
- Modifica sostanziale retention (es. da 12 a 24 mesi).
- Introduzione di nuova categoria di dati.
- Modifica dell'identità del titolare.

### Modifiche che NON richiedono bump (NO)
- Correzioni tipografiche / refactoring testo.
- Aggiornamento URL interni.
- Precisazioni che non modificano diritti/obblighi.

### Procedura bump

1. Modifica la `lastUpdated` prop in `LegalLayout` (es. `Privacy.tsx`, `Terms.tsx`).
2. Insert nella tabella `privacy_versions`:
   ```sql
   UPDATE public.privacy_versions SET is_current = false WHERE consent_type = 'privacy_policy';
   INSERT INTO public.privacy_versions (consent_type, version, is_current, released_at)
   VALUES ('privacy_policy', '2026-05-15', true, now());
   ```
3. `ConsentVersionGate` al prossimo login mostra modal re-consent.
4. Documenta nel `ROPA.md` cosa è cambiato.

---

## 6. Routine periodica (calendar)

### Settimanale (lunedì mattina)
- [ ] Verifica advisories Supabase/Anthropic/Google/Vercel (email + status page).
- [ ] Check `audit_log` per anomalie (picchi di `data_export`, `login` da IP nuovi).

### Mensile (primo del mese)
- [ ] `npm audit` + aggiornamento dipendenze critiche.
- [ ] Verifica job `pg_cron` ancora attivi (query § 1).
- [ ] Revisione DSR in `dsr_requests` — tutte le richieste sotto SLA 30 giorni?
- [ ] Lettura Supabase advisor.

### Trimestrale
- [ ] Revisione `subprocessors.md`: lista aggiornata? certificazioni ancora valide?
- [ ] Test esercitazione breach (tabletop scenario).
- [ ] Export manuale schema DB per backup offline.

### Annuale
- [ ] Revisione completa ROPA.
- [ ] Revisione DPIA.
- [ ] Revisione TIA.
- [ ] Rotazione chiavi (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, altri secret).
- [ ] Lettura nuove Linee Guida EDPB e Provvedimenti Garante → aggiornamento policy.
- [ ] Pen-test esterno quando budget lo consente.

### Event-driven
- [ ] Nuovo sub-processor → aggiungere a `subprocessors.md` + `ROPA.md` + Privacy Policy + bump version.
- [ ] Nuova feature che tratta nuove categorie di dati → aggiornare ROPA, eventualmente DPIA.
- [ ] Data breach → attivare `breach-playbook.md` immediatamente.
- [ ] Crescita oltre 100 utenti attivi → rivalutare obbligo DPO.
- [ ] Ingresso primo utente enterprise (agenzia grande) → valutare upgrade ad Anthropic ZDR + DPA custom.

---

## 7. Come gestire una richiesta di esercizio diritti (DSR)

1. Interessato scrive a `info@tauramanagement.com` (o clicca in `DataRightsPanel`).
2. **Verifica identità**: se richiesta via email ed è utente registrato → abbastanza. Se richiesta da terzo → richiedi documento.
3. **Prendi nota** in `dsr_requests` (già automatico via DataRightsPanel; manuale via `INSERT` se richiesta via email).
4. **Evadi entro 30 giorni** (estensibile a 60 per richieste complesse, con preavviso).
5. Per export: `DataRightsPanel` → invia signed URL 7 giorni.
6. Per cancellazione: `DataRightsPanel` → soft-delete immediato, hard-delete a 30gg.
7. Registra evasione in `audit_log` (automatico) + risposta email all'interessato.

**Rifiuto**: documentato in `dsr_requests.rejection_reason`. Motivi ammessi: richiesta manifestamente infondata, richieste ripetitive vessatorie, conflitto con obblighi di conservazione (es. cancellazione contratto entro 10 anni non possibile per obbligo fiscale → comunicare limitazione parziale).

---

## 8. Tre cose che NON devi mai fare

1. **Non rispondere "non posso fornire i dati" senza documentare la motivazione legale**. L'Art. 12.4 GDPR impone di rispondere entro 30 giorni anche se è un rifiuto — con ragione scritta.
2. **Non modificare silenziosamente la Privacy Policy**. Ogni modifica sostanziale richiede notifica agli utenti attivi (ConsentVersionGate).
3. **Non inviare dati personali ad un nuovo provider prima di aver firmato il DPA**. Anche un singolo test "solo una volta per vedere se funziona" è una violazione dell'Art. 28.
