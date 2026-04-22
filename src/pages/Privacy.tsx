import LegalLayout from "@/components/taura/LegalLayout";

const Privacy = () => (
  <LegalLayout title="Informativa sulla Privacy" version="2026-04-21" lastUpdated="21 aprile 2026">
    <p>
      La presente informativa descrive le modalità di trattamento dei dati personali degli utenti di
      <strong> Taura OS</strong>, piattaforma SaaS per la gestione di agenzie sportive e di talent,
      ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 ("GDPR") e del D.Lgs. 196/2003
      ("Codice Privacy") come modificato dal D.Lgs. 101/2018.
    </p>

    <h2>1. Titolare del trattamento</h2>
    <p>
      Il Titolare del trattamento è <strong>Alessandro Martano</strong>, titolare della ditta individuale con
      P.IVA <strong>17902421001</strong>, Codice Fiscale <strong>MRTLSN06H08H501S</strong>, con sede operativa
      in <strong>Via Rumenia 210, 00071 Roma</strong>. PEC: <strong>alessandromartano@pecprivato.it</strong>. Email privacy:{" "}
      <a href="mailto:info@tauramanagement.com">info@tauramanagement.com</a>.
    </p>
    <p>
      Non è stato designato un Data Protection Officer (DPO) in quanto il trattamento non rientra nei
      casi obbligatori previsti dall'Art. 37 GDPR. Il referente privacy è il Titolare stesso.
    </p>

    <h2>2. Categorie di dati trattati</h2>
    <ul>
      <li><strong>Dati identificativi:</strong> nome, cognome, email, numero di telefono.</li>
      <li><strong>Dati account:</strong> credenziali hashate, ruolo, preferenze interfaccia, timestamp accessi.</li>
      <li><strong>Dati professionali:</strong> ruolo in agenzia, nome agenzia, settore sportivo, piano abbonamento.</li>
      <li><strong>Dati dei talent gestiti:</strong> nome, data di nascita, informazioni contrattuali, social handle, metriche.</li>
      <li><strong>Dati contenuti nei contratti e brief caricati:</strong> importi, clausole, brand, durata, deliverable.</li>
      <li><strong>Conversazioni con l'AI:</strong> messaggi scambiati con l'assistente, file allegati.</li>
      <li><strong>Dati di utilizzo:</strong> log di accesso, IP (salvato in formato hash SHA-256), user-agent hash.</li>
      <li><strong>Dati di minori:</strong> qualora siano trattati dati di talent minorenni, è richiesto il consenso
        documentato del genitore o tutore legale (Art. 8 GDPR).</li>
    </ul>

    <h2>3. Finalità del trattamento e basi giuridiche</h2>
    <table>
      <thead>
        <tr>
          <th>Finalità</th>
          <th>Base giuridica</th>
          <th>Conservazione</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Erogazione del servizio (account, gestione roster, contratti)</td>
          <td>Esecuzione del contratto — Art. 6.1.b GDPR</td>
          <td>Per tutta la durata del rapporto</td>
        </tr>
        <tr>
          <td>Elaborazione AI (chat, estrazione clausole, brief)</td>
          <td>Consenso esplicito — Art. 6.1.a GDPR</td>
          <td>Revocabile in qualsiasi momento</td>
        </tr>
        <tr>
          <td>Adempimenti fiscali e contabili</td>
          <td>Obbligo di legge — Art. 6.1.c GDPR</td>
          <td>10 anni (art. 2220 c.c.)</td>
        </tr>
        <tr>
          <td>Sicurezza della piattaforma, prevenzione frodi</td>
          <td>Legittimo interesse — Art. 6.1.f GDPR</td>
          <td>24 mesi (log amministrativi)</td>
        </tr>
        <tr>
          <td>Comunicazioni marketing</td>
          <td>Consenso — Art. 6.1.a GDPR</td>
          <td>Fino a revoca</td>
        </tr>
      </tbody>
    </table>

    <h2>4. Elaborazione tramite Intelligenza Artificiale</h2>
    <p>
      Taura OS utilizza servizi di AI generativa per automatizzare alcune funzionalità (chat assistente,
      estrazione automatica di clausole da contratti, generazione di messaggi per i talent). I fornitori
      di AI selezionati sono soggetti a contratti di trattamento dati (DPA) che garantiscono:
    </p>
    <ul>
      <li><strong>Anthropic (Claude):</strong> Commercial API con DPA firmato, Standard Contractual Clauses (SCC)
        per il trasferimento verso gli Stati Uniti, <em>nessun training</em> sui dati dei clienti, retention 30 giorni.</li>
      <li><strong>Google Cloud (Gemini via Vertex AI):</strong> CDPA firmato, regione <strong>europe-west1</strong>,
        nessun training sui dati (piano a pagamento).</li>
    </ul>
    <p>
      Prima di inviare i contenuti ai modelli AI, applichiamo tecniche di minimizzazione e anonimizzazione
      dei dati personali non strettamente necessari (email, numeri di telefono, codici fiscali, IBAN).
      Per dettagli completi consulta l'<a href="/ai-disclosure">Informativa AI Processing</a>.
    </p>

    <h2>5. Destinatari e sub-responsabili</h2>
    <p>I dati possono essere trattati da:</p>
    <ul>
      <li><strong>Supabase Inc.</strong> — infrastruttura database, autenticazione, storage (regione AWS eu-north-1 Stockholm, dati in UE).</li>
      <li><strong>Anthropic PBC</strong> — modelli Claude (USA, SCC + DPA).</li>
      <li><strong>Google Cloud Italy Srl / Google Ireland Ltd</strong> — Vertex AI (UE, europe-west1).</li>
      <li><strong>Vercel Inc.</strong> — hosting frontend (CDN globale, DPA firmato).</li>
      <li>Consulenti fiscali, legali, commercialista del Titolare.</li>
    </ul>

    <h2>6. Trasferimento dei dati extra-UE</h2>
    <p>
      I trasferimenti verso Anthropic (USA) avvengono in conformità agli Art. 44-49 GDPR, tramite le
      Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea, integrate da un Transfer
      Impact Assessment (TIA) che valuta le misure supplementari adottate: anonimizzazione preventiva,
      retention minima, divieto di training. Nessun dato personale in chiaro viene inviato fuori dall'UE
      per finalità non strettamente necessarie.
    </p>

    <h2>7. Diritti dell'interessato</h2>
    <p>Ai sensi degli Art. 15-22 GDPR hai diritto a:</p>
    <ul>
      <li><strong>Accesso</strong> ai tuoi dati (Art. 15)</li>
      <li><strong>Rettifica</strong> di dati inesatti (Art. 16)</li>
      <li><strong>Cancellazione</strong> ("diritto all'oblio") (Art. 17)</li>
      <li><strong>Limitazione</strong> del trattamento (Art. 18)</li>
      <li><strong>Portabilità</strong> in formato strutturato e leggibile (Art. 20)</li>
      <li><strong>Opposizione</strong> al trattamento per marketing e legittimo interesse (Art. 21)</li>
      <li><strong>Revoca del consenso</strong> in qualsiasi momento (Art. 7.3), senza pregiudizio per la
        liceità del trattamento basata sul consenso precedentemente espresso</li>
    </ul>
    <p>
      Puoi esercitare tali diritti direttamente dalla sezione <strong>Impostazioni → Privacy e Dati</strong>
      del tuo account, oppure scrivendo a <a href="mailto:info@tauramanagement.com">info@tauramanagement.com</a>. Le richieste
      saranno riscontrate entro 30 giorni, prorogabili di ulteriori 60 per richieste complesse (Art. 12.3 GDPR).
    </p>
    <p>
      Hai inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali
      (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">garanteprivacy.it</a>).
    </p>

    <h2>8. Dati di minori</h2>
    <p>
      Il servizio è destinato a professionisti maggiorenni. Qualora i Clienti Titolari (agenzie) trattino
      dati di talent minorenni attraverso la piattaforma, essi sono tenuti a raccogliere il consenso
      genitoriale documentato e a caricarlo nella scheda atleta. Taura OS come Responsabile del trattamento
      verifica la presenza del documento prima di attivare funzionalità sensibili.
    </p>

    <h2>9. Sicurezza</h2>
    <p>
      Adottiamo misure tecniche e organizzative adeguate (Art. 32 GDPR): cifratura at-rest (AES-256) e
      in-transit (TLS 1.3), autenticazione multi-fattore per amministratori, Row-Level Security su tutti
      i dati tenant, audit log, backup giornalieri cifrati, penetration test periodici.
    </p>

    <h2>10. Cookie</h2>
    <p>
      L'uso dei cookie è dettagliato nell'<a href="/cookies">Informativa Cookie</a>. Utilizziamo esclusivamente
      cookie tecnici necessari al funzionamento; eventuali cookie analitici o di marketing sono attivati
      solo previo consenso opt-in.
    </p>

    <h2>11. Modifiche all'informativa</h2>
    <p>
      La presente informativa può essere aggiornata. Le modifiche sostanziali saranno notificate tramite
      email e richiederanno un nuovo consenso prima della prosecuzione del servizio.
    </p>
  </LegalLayout>
);

export default Privacy;
