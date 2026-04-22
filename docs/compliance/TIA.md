# TIA — Transfer Impact Assessment (post-Schrems II)

**Versione**: 2026-04-21 · **Titolare**: Alessandro Martano — P.IVA 17902421001

Valutazione ex Art. 46 GDPR + raccomandazioni EDPB 01/2020 sul trasferimento di dati personali verso Paesi terzi a seguito della sentenza CGUE C-311/18 (Schrems II).

## 1. Trasferimenti valutati

| Destinatario | Paese | Categoria | Meccanismo | Volume |
|---|---|---|---|---|
| Anthropic PBC | USA (California) | Responsabile (chat AI, parsing testo) | SCC 2021/914 Modulo 2 + DPA Anthropic Commercial | Alto (chiamate in tempo reale) |
| Google Cloud — Vertex AI | UE (`europe-west1`) | Responsabile (Gemini) | CDPA Google + SCC UE | Alto |
| Vercel Inc. | USA / EU (regional) | Responsabile (hosting frontend statico) | DPA Vercel + SCC | Alto (traffico web) |
| Supabase Inc. | **UE — AWS eu-north-1 Stoccolma** | Responsabile (DB/Auth/Storage/Functions) | DPA Supabase (no transfer per storage) | Alto |

**Nota**: Supabase è entità USA ma i dati risiedono fisicamente in UE. Configurazione applicativa impone region `eu-north-1` — nessun transfer per il dato a riposo. Resta applicabile il CLOUD Act in astratto per richieste alla parent company → mitigato con SCC nel DPA.

## 2. Analisi della legislazione dei Paesi terzi

### Stati Uniti (Anthropic, Vercel)

Leggi rilevanti:
- **FISA Section 702** — autorizza sorveglianza di "electronic communication service providers" su dati di non-US persons. Applicabile ad Anthropic e Vercel in quanto ECSP.
- **Executive Order 12333** — raccolta SIGINT extraterritoriale.
- **CLOUD Act** (2018) — obbliga provider USA a consegnare dati anche se storati fuori USA.

Tutela per interessati UE:
- **Data Privacy Framework** (luglio 2023) — Anthropic risulta **non certificata DPF** al 2026-04-21. Verifica: <https://www.dataprivacyframework.gov/list>. Pertanto il trasferimento si basa esclusivamente su SCC + misure supplementari.
- Redress mechanism DPF non invocabile per Anthropic → interessato ha solo via giudiziale + reclamo Garante.

### UE (Vertex AI)

Location `europe-west1` (Belgio). Nessun trasferimento extra-UE **se correttamente configurato**. Rischio residuo: Google Cloud è entità USA → CLOUD Act astrattamente applicabile alla parent. Mitigazione: SCC firmate nel CDPA, dati cifrati at-rest con chiavi gestite da Google (o CMEK in futuro).

## 3. Misure supplementari adottate

| Misura | Descrizione | Riferimento codice |
|---|---|---|
| **Minimizzazione** | Solo messaggi utente + contesto strutturato essenziale; no dump di interi record | `supabase/functions/chat/index.ts` — context builder |
| **Anonimizzazione PII** | Regex mascheramento email/telefono/IBAN/CF/P.IVA/carte prima dell'invio al modello (quando non funzionali al reasoning) | `supabase/functions/_shared/anonymize.ts` |
| **No training garantito** | Contrattualmente Anthropic non usa i dati per addestrare modelli (Commercial API terms) | DPA Anthropic |
| **Retention minima** | Anthropic: 30 giorni max. Vertex: no storage prolungato. | Confermato via DPA |
| **Cifratura in transit** | TLS 1.2+ obbligatorio; certificati validati | Standard HTTPS |
| **Audit log** | Ogni chiamata AI registrata con metadata (tier, model, tokens) — no contenuto | `_shared/audit.ts` |
| **Controllo accessi** | Token service-role mai esposto al client; JWT utente convalidato su ogni request | Edge functions architecture |
| **Consenso granulare** | Utente può revocare `ai_processing` e disattivare tutte le funzioni AI | `user_consents` + `has_active_consent()` |
| **No decisioni automatizzate** | Output AI = suggerimento; azione sempre con conferma utente esplicita | `ConfirmActionCard` pattern |
| **Diritto all'opposizione** | Revoca consenso immediata, cancellazione cronologia chat on-demand | `DataRightsPanel` |

## 4. Analisi del rischio (EDPB 6-step test)

1. **Know your transfer** ✅ — trasferimenti mappati in sezione 1 e ROPA.
2. **Verify the tool** ✅ — SCC 2021/914 Modulo 2 firmate con Anthropic; CDPA con Google; DPA Supabase e Vercel.
3. **Assess the law/practice of the 3rd country** ✅ — FISA 702 e EO 12333 potenzialmente applicabili ad Anthropic. Valutato rischio "non manifestamente sproporzionato" per la categoria di dati trattata (business B2B, no dati sensibili, no profilazione massiva) + misure supplementari efficaci.
4. **Identify supplementary measures** ✅ — elencate in sezione 3.
5. **Formal procedural steps** ✅ — DPA firmati; SCC annesse; ROPA aggiornato; TIA documentata (questo file).
6. **Re-evaluate** — revisione minimo annuale o dopo evoluzione legislativa rilevante (prossima sentenza CGUE, riforma DPF, ecc.).

## 5. Rischio residuo accettato

- Anthropic USA non-ZDR (Zero Data Retention disponibile solo su piano Enterprise): permanenza dei prompt 30gg presso il provider.
  - **Mitigazione**: anonimizzazione PII non funzionale + no dati sensibili/giudiziari nei prompt.
  - **Rischio accettato** in quanto: (a) dati trattati = testo commerciale B2B a basso impatto; (b) finalità = erogazione funzionalità core con base Art. 6.1.b; (c) costo Enterprise non proporzionato alla dimensione attuale dell'attività.
  - **Trigger di riesame**: (i) gestione regolare dati sanitari/giudiziari; (ii) clienti enterprise con richiesta ZDR contrattuale; (iii) volume prompt > 100k/mese.

- CLOUD Act astrattamente applicabile a Supabase, Google Cloud, Vercel, Anthropic.
  - **Mitigazione**: SCC + trasparenza attiva (i provider pubblicano transparency report).
  - **Rischio accettato** in quanto non esiste alternativa europea equivalente funzionalmente.

## 6. Conclusione

Il trasferimento è consentito ex Art. 46 GDPR con le misure supplementari indicate. I rischi residui sono documentati, accettati e sotto monitoraggio. Il titolare rivaluta il presente documento ogni 12 mesi e ad ogni evento rilevante (nuovo sub-processor, riforma legislativa, data breach).

## 7. Revisione

| Data | Autore | Modifica |
|---|---|---|
| 2026-04-21 | A. Martano | Prima emissione |
