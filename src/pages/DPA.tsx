import LegalLayout from "@/components/taura/LegalLayout";

const DPA = () => (
  <LegalLayout title="Data Processing Addendum (DPA)" version="2026-04-21" lastUpdated="21 aprile 2026">
    <p>
      Il presente Data Processing Addendum ("<strong>DPA</strong>") integra i Termini di Servizio tra il
      Cliente ("<strong>Titolare del trattamento</strong>" ai sensi dell'Art. 4.7 GDPR) e{" "}
      <strong>Alessandro Martano</strong>, P.IVA <strong>17902421001</strong> ("<strong>Responsabile
      del trattamento</strong>" ai sensi dell'Art. 4.8 GDPR), con riferimento al trattamento dei dati
      personali effettuato attraverso la piattaforma Taura OS.
    </p>

    <h2>1. Oggetto e durata</h2>
    <p>
      Il Responsabile tratta i dati personali per conto del Titolare al fine di erogare il Servizio Taura OS
      (gestione roster, archiviazione contratti, elaborazione AI, notifiche, campagne). Il trattamento avviene
      per tutta la durata del contratto e per i termini di legge successivi.
    </p>

    <h2>2. Categorie di interessati e di dati</h2>
    <ul>
      <li>Talent e atleti gestiti dal Titolare (nome, data nascita, contatti, contratti, metriche social).</li>
      <li>Brand e controparti commerciali (ragione sociale, referenti, importi).</li>
      <li>Dipendenti e collaboratori del Titolare con accesso alla piattaforma.</li>
      <li>Categorie di dati: identificativi, contrattuali, economici, di contenuto (chat, file), log di utilizzo.</li>
    </ul>

    <h2>3. Istruzioni documentate</h2>
    <p>
      Il Responsabile tratta i dati esclusivamente sulla base di istruzioni documentate del Titolare, fornite
      attraverso la sottoscrizione dei Termini, la configurazione della piattaforma, e ogni comunicazione
      scritta successiva. Il Responsabile informa immediatamente il Titolare qualora ritenga che un'istruzione
      violi il GDPR o altra normativa applicabile.
    </p>

    <h2>4. Riservatezza</h2>
    <p>
      Il Responsabile garantisce che le persone autorizzate al trattamento siano vincolate da obbligo di
      riservatezza o abbiano adeguato obbligo legale.
    </p>

    <h2>5. Misure di sicurezza (Art. 32 GDPR)</h2>
    <ul>
      <li>Cifratura at-rest (AES-256) e in-transit (TLS 1.3).</li>
      <li>Row-Level Security (RLS) per isolamento multi-tenant.</li>
      <li>Autenticazione multi-fattore per amministratori.</li>
      <li>Audit log di tutti gli accessi e operazioni sensibili (conservazione 24 mesi).</li>
      <li>Backup giornalieri cifrati con retention 30 giorni.</li>
      <li>Controllo accessi basato su ruolo (RBAC).</li>
      <li>Monitoraggio vulnerabilità e aggiornamenti di sicurezza.</li>
    </ul>

    <h2>6. Sub-responsabili (Art. 28.2 GDPR)</h2>
    <p>
      Il Titolare autorizza in via generale l'utilizzo dei seguenti sub-responsabili:
    </p>
    <table>
      <thead>
        <tr><th>Sub-responsabile</th><th>Servizio</th><th>Localizzazione</th></tr>
      </thead>
      <tbody>
        <tr><td>Supabase Inc.</td><td>Database, auth, storage, edge functions</td><td>AWS eu-north-1 (Stockholm, UE)</td></tr>
        <tr><td>Anthropic PBC</td><td>Modelli AI Claude</td><td>USA (SCC + DPA)</td></tr>
        <tr><td>Google Cloud</td><td>Vertex AI — Gemini</td><td>europe-west1 (UE)</td></tr>
        <tr><td>Vercel Inc.</td><td>Hosting frontend</td><td>CDN globale (DPA + SCC)</td></tr>
      </tbody>
    </table>
    <p>
      Il Responsabile informa il Titolare con preavviso di 30 giorni di eventuali modifiche all'elenco dei
      sub-responsabili. Il Titolare può opporsi entro 15 giorni; in caso di impossibilità di proseguire il
      servizio, il Titolare può recedere senza penale.
    </p>

    <h2>7. Trasferimenti extra-UE</h2>
    <p>
      I trasferimenti verso sub-responsabili extra-UE (Anthropic) avvengono sulla base delle Standard
      Contractual Clauses (SCC) approvate dalla Commissione Europea (Decisione 2021/914), integrate da un
      Transfer Impact Assessment (TIA) e da misure supplementari (anonimizzazione preventiva, retention
      minima, no-training).
    </p>

    <h2>8. Assistenza nei diritti dell'interessato (Art. 28.3.e)</h2>
    <p>
      Il Responsabile assiste il Titolare, tenuto conto della natura del trattamento e con misure tecniche
      e organizzative adeguate, nel rispondere alle richieste degli interessati relative ai diritti previsti
      dagli Art. 15-22 GDPR. Strumenti disponibili: export JSON completo, cancellazione account, revoca
      consensi, rettifica dati.
    </p>

    <h2>9. Data Breach notification (Art. 33)</h2>
    <p>
      In caso di violazione dei dati personali il Responsabile notifica il Titolare senza ingiustificato
      ritardo e comunque entro 48 ore dalla conoscenza, fornendo:
    </p>
    <ul>
      <li>natura della violazione e categorie di dati/interessati coinvolti;</li>
      <li>probabili conseguenze;</li>
      <li>misure adottate o proposte per mitigare i rischi.</li>
    </ul>

    <h2>10. DPIA (Art. 35) e consultazione preventiva (Art. 36)</h2>
    <p>
      Il Responsabile assiste il Titolare nello svolgimento delle Valutazioni di Impatto sulla Protezione
      dei Dati fornendo documentazione tecnica, ROPA, e la presente documentazione DPA.
    </p>

    <h2>11. Audit (Art. 28.3.h)</h2>
    <p>
      Il Titolare ha diritto di effettuare audit sul rispetto del DPA, con preavviso scritto di almeno 30
      giorni e frequenza massima annuale (salvo data breach o segnalazione specifica). Il Responsabile mette
      a disposizione documentazione, certificazioni ISO 27001 dei propri sub-responsabili e report di
      penetration test.
    </p>

    <h2>12. Cessazione del trattamento (Art. 28.3.g)</h2>
    <p>
      Alla cessazione del contratto, su scelta del Titolare il Responsabile:
    </p>
    <ul>
      <li>consegna i dati in formato strutturato (JSON) al Titolare entro 30 giorni;</li>
      <li>cancella definitivamente i dati entro 30 giorni, fatti salvi obblighi di conservazione di legge.</li>
    </ul>

    <h2>13. Accettazione</h2>
    <p>
      Il presente DPA si intende accettato dal Titolare con la sottoscrizione dei Termini di Servizio e
      l'attivazione del piano. Per controfirma formale contattare{" "}
      <a href="mailto:info@tauramanagement.com">info@tauramanagement.com</a>.
    </p>
  </LegalLayout>
);

export default DPA;
