# Data Breach Playbook — Procedura di gestione violazioni

**Versione**: 2026-04-21 · **Titolare**: Alessandro Martano — P.IVA 17902421001

Riferimenti: Artt. 33–34 GDPR · Linee Guida EDPB 9/2022 · Provvedimento Garante 29 luglio 2021.

## Obiettivo

Garantire la notifica al Garante entro **72 ore** dalla conoscenza di un data breach che comporti rischio per i diritti e le libertà degli interessati, e la comunicazione agli interessati in caso di rischio elevato.

## Definizione di "data breach"

Qualunque violazione di sicurezza che comporti, accidentalmente o illecitamente:
- **Distruzione** di dati personali
- **Perdita** di dati personali
- **Modifica** non autorizzata
- **Divulgazione** non autorizzata
- **Accesso** non autorizzato

Tre categorie (EDPB 1/2021):
1. Confidentiality breach — accesso/divulgazione non autorizzata.
2. Integrity breach — modifica non autorizzata.
3. Availability breach — perdita o indisponibilità.

## Fase 1 — Rilevazione (T0 = momento di conoscenza)

Canali di rilevazione attivi:
- Segnalazione utente → `info@tauramanagement.com`.
- Advisory automatico Supabase / Anthropic / Google / Vercel.
- Anomalie audit_log (es. accessi da IP inconsueti, burst di data_export).
- Monitoraggio manuale dashboard provider.

Chi riceve la segnalazione: il titolare (Alessandro Martano).

**T0** = quando il titolare acquisisce **ragionevole certezza** che un incidente di sicurezza ha riguardato dati personali (non la mera ipotesi).

## Fase 2 — Triage (T0 → T0+6h)

Il titolare:
1. Apre un **incident log** in `docs/compliance/incidents/YYYY-MM-DD_shortname.md`.
2. Identifica:
   - natura della violazione (conf/integ/avail);
   - categorie e numero approssimativo di interessati;
   - categorie e volume di dati;
   - probabili conseguenze;
   - misure adottate o proposte.
3. Contiene il danno (es. rotazione chiavi, sospensione account compromesso, revoca token).

Checklist di contenimento:
- [ ] Ruotare `SUPABASE_SERVICE_ROLE_KEY` se compromessa → via dashboard Supabase.
- [ ] Ruotare `ANTHROPIC_API_KEY` → dashboard Anthropic.
- [ ] Ruotare JWT signing secret Supabase (invalida tutte le sessioni).
- [ ] Revocare sessioni compromesse (`supabase.auth.admin.signOut(userId, "global")`).
- [ ] Disabilitare temporaneamente funzionalità affetta (es. toggle env `VERTEX_ENABLED=false`).
- [ ] Snapshot di backup per forensics.

## Fase 3 — Valutazione del rischio (T0+6h → T0+24h)

Matrice probabilità × impatto:

| Livello | Criteri | Azione |
|---|---|---|
| **Basso** | Dati cifrati, accesso rientrato, no esfiltrazione | Log interno, nessuna notifica |
| **Medio** | Esposizione limitata, dati non sensibili, interessati ≤ 100 | **Notifica Garante 72h**, no comunicazione interessati |
| **Alto** | Dati sensibili, volume > 1000 interessati, credenziali/password, dati finanziari, dati minori | **Notifica Garante 72h** + **Comunicazione interessati** |

## Fase 4 — Notifica Garante (entro 72h da T0)

**Canale**: portale dedicato <https://servizi.gpdp.it/databreach/s/> (richiede SPID/CIE del titolare).

**Contenuto minimo** (Art. 33.3 GDPR):
a) natura della violazione, categorie e numero approssimativo interessati + categorie e numero record;
b) dati di contatto del referente privacy (titolare);
c) probabili conseguenze;
d) misure adottate o proposte per rimediare e attenuare gli effetti.

Se non tutte le informazioni sono disponibili, è ammessa notifica in fasi: una prima entro 72h + integrazione successiva con giustificazione del ritardo.

### Template email interno (per documentazione)

```
Oggetto: [INCIDENT YYYY-MM-DD] Notifica data breach al Garante
Da: Alessandro Martano — info@tauramanagement.com
A: (registrazione interna — invio effettivo via portale Garante)

T0 (rilevazione): YYYY-MM-DD HH:MM CET
Tipo: [confidentiality / integrity / availability]
Descrizione sintetica: ...
Categorie interessati: (es. utenti agenzie registrati)
Numero approssimativo interessati: ~XX
Categorie dati coinvolti: (es. email, nome, agenzia)
Dati sensibili coinvolti: [sì/no]
Minori coinvolti: [sì/no]
Causa probabile: ...
Misure di contenimento già adottate: ...
Misure correttive previste: ...
Referente: Alessandro Martano — info@tauramanagement.com — PEC alessandromartano@pecprivato.it
```

## Fase 5 — Comunicazione agli interessati (se rischio elevato)

Trigger: rischio **elevato** per diritti e libertà.

**Canale**:
- Email all'indirizzo dell'interessato (estratto da `profiles.email`).
- Banner in-app bloccante al prossimo login (componente `IncidentNotice.tsx` da attivare se necessario).
- Per waitlist compromessa: email singola a ciascun indirizzo.

### Template comunicazione interessati (in italiano)

```
Oggetto: Comunicazione importante relativa alla sicurezza dei tuoi dati su Taura OS

Gentile utente,

il [DATA] abbiamo rilevato un incidente di sicurezza che ha coinvolto i seguenti dati
che ti riguardano: [ELENCO CATEGORIE DATI].

Cosa è successo: [DESCRIZIONE IN LINGUAGGIO CHIARO].

Conseguenze potenziali: [ELENCO].

Misure da noi adottate: [ELENCO].

Cosa ti raccomandiamo di fare:
- [AZIONE 1, es. cambiare password]
- [AZIONE 2]

Hai diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati
Personali (garanteprivacy.it).

Per qualsiasi informazione: info@tauramanagement.com — alessandromartano@pecprivato.it

Ci scusiamo per il disagio.
Alessandro Martano — Titolare del trattamento
```

## Fase 6 — Documentazione (sempre, anche senza notifica)

Art. 33.5 GDPR obbliga a **documentare ogni violazione** anche se non notificata. Mantieni `docs/compliance/incidents/` con:
- cronologia eventi (T0, T0+6h, T0+24h, T0+72h, risoluzione);
- decisione di notificare/non notificare + giustificazione;
- copia della notifica al Garante;
- copia della comunicazione agli interessati (se inviata);
- lessons learned e modifiche di processo.

## Fase 7 — Post-mortem (entro 30 giorni)

1. Aggiornamento `ROPA.md` se il trattamento ha subito modifiche.
2. Aggiornamento `DPIA.md` se il rischio residuo è cambiato.
3. Aggiornamento misure di sicurezza (`SECURITY.md`).
4. Revisione DPA sub-processor se la causa è riconducibile a un fornitore.
5. Eventuale formazione integrativa (per il titolare stesso nella fase attuale).

## Contatti rapidi

- **Autorità Garante** — <https://www.garanteprivacy.it> · portale breach <https://servizi.gpdp.it/databreach/s/>
- **Supabase Support** — support@supabase.io · status.supabase.com
- **Anthropic Trust** — trust@anthropic.com · privacy@anthropic.com
- **Google Cloud Support** — via console
- **Vercel Security** — security@vercel.com

## Esercitazioni

Raccomandato un **tabletop test** ogni 6 mesi: simulare uno scenario (es. chiave service-role esposta in repo pubblico) e verificare che il playbook produca tempi corretti.
