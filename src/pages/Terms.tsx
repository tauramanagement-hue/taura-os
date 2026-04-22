import LegalLayout from "@/components/taura/LegalLayout";

const Terms = () => (
  <LegalLayout title="Termini e Condizioni di Servizio" version="2026-04-21" lastUpdated="21 aprile 2026">
    <p>
      I presenti Termini di Servizio ("<strong>Termini</strong>") disciplinano l'accesso e l'utilizzo della
      piattaforma <strong>Taura OS</strong> ("<strong>Servizio</strong>") offerta da{" "}
      <strong>Alessandro Martano</strong>, P.IVA <strong>17902421001</strong>, sede in{" "}
      <strong>Via Rumenia 210, 00071 Roma</strong>, PEC <strong>alessandromartano@pecprivato.it</strong> ("<strong>Fornitore</strong>").
    </p>

    <h2>1. Oggetto</h2>
    <p>
      Il Fornitore mette a disposizione una piattaforma SaaS per la gestione di agenzie sportive e di talent,
      comprendente: gestione roster, archiviazione contratti, elaborazione assistita da AI, notifiche,
      pianificazione campagne, analytics. Il Servizio è in versione commerciale a pagamento secondo i piani
      pubblicati sul sito.
    </p>

    <h2>2. Account e registrazione</h2>
    <p>
      Per accedere al Servizio l'Utente deve registrare un account fornendo dati veritieri e mantenendoli
      aggiornati. L'Utente è responsabile della riservatezza delle proprie credenziali e di ogni attività
      svolta tramite il proprio account. L'età minima per la registrazione è 18 anni.
    </p>

    <h2>3. Obblighi dell'Utente</h2>
    <ul>
      <li>Utilizzare il Servizio nel rispetto della legge, della morale e dell'ordine pubblico.</li>
      <li>Non caricare contenuti illeciti, lesivi di diritti di terzi, o contenenti malware.</li>
      <li>Raccogliere e gestire i dati dei propri talent nel rispetto del GDPR, in qualità di Titolare
        autonomo del trattamento (vedi <a href="/dpa">DPA</a>).</li>
      <li>Non tentare di aggirare meccanismi di sicurezza, rate limiting, o accesso ai dati di altri tenant.</li>
      <li>Non utilizzare il Servizio per attività automatizzate massive non autorizzate (scraping, bot).</li>
    </ul>

    <h2>4. Corrispettivi e fatturazione</h2>
    <p>
      L'utilizzo delle funzionalità commerciali è soggetto al pagamento del canone periodico indicato al
      momento della sottoscrizione del piano. La fatturazione avviene in formato elettronico secondo la
      normativa italiana. In caso di mancato pagamento, il Servizio può essere sospeso dopo comunicazione
      con preavviso di 15 giorni.
    </p>

    <h2>5. Intelligenza Artificiale — limitazioni</h2>
    <p>
      Il Servizio utilizza modelli di AI di terze parti (Anthropic Claude, Google Gemini) per automatizzare
      alcune operazioni. Gli output generati dall'AI:
    </p>
    <ul>
      <li><strong>non costituiscono consulenza legale, fiscale, finanziaria o medica</strong>;</li>
      <li>possono contenere errori, imprecisioni o omissioni ("allucinazioni");</li>
      <li>devono essere sempre verificati dall'Utente prima di essere utilizzati in decisioni operative;</li>
      <li>non sostituiscono il giudizio professionale umano.</li>
    </ul>
    <p>
      L'Utente è tenuto a rivedere tutti i contenuti generati dall'AI, in particolare clausole contrattuali
      estratte, messaggi ai talent, importi, scadenze. Il Fornitore declina ogni responsabilità per danni
      derivanti dall'uso acritico degli output AI.
    </p>

    <h2>6. Proprietà intellettuale</h2>
    <p>
      Il software, i marchi, i contenuti editoriali e i materiali grafici di Taura OS sono di esclusiva
      proprietà del Fornitore. L'Utente ottiene una licenza d'uso non esclusiva, non trasferibile, revocabile,
      limitata alla durata del piano sottoscritto. I dati caricati dall'Utente restano di sua proprietà.
    </p>

    <h2>7. Limitazione di responsabilità</h2>
    <p>
      Nei limiti massimi consentiti dalla legge, la responsabilità del Fornitore per qualunque danno
      derivante dall'uso del Servizio è limitata all'importo pagato dall'Utente nei dodici mesi precedenti
      l'evento dannoso. Il Fornitore non risponde di danni indiretti, perdita di profitto, perdita di
      opportunità commerciali, salvo i casi di dolo o colpa grave. Le limitazioni non si applicano ai danni
      alla persona né a quanto inderogabilmente previsto dalla legge.
    </p>

    <h2>8. Recesso e cessazione</h2>
    <p>
      L'Utente consumer ha diritto di recesso entro 14 giorni dalla sottoscrizione ai sensi del D.Lgs. 206/2005
      (Codice del Consumo), salvo il caso di inizio dell'esecuzione del Servizio con consenso espresso.
      La cessazione del piano comporta la disattivazione dell'account; i dati sono conservati per 30 giorni
      in modalità soft-delete prima della cancellazione definitiva (fatti salvi obblighi di conservazione
      di legge).
    </p>

    <h2>9. Modifiche ai Termini</h2>
    <p>
      Il Fornitore può modificare i presenti Termini con preavviso di almeno 15 giorni tramite email o
      notifica in-app. In caso di modifiche sostanziali sfavorevoli, l'Utente può recedere senza penale.
    </p>

    <h2>10. Legge applicabile e foro</h2>
    <p>
      I presenti Termini sono regolati dalla legge italiana. Per le controversie con utenti consumer è
      competente il foro di residenza o domicilio del consumatore. Per tutte le altre controversie è
      competente in via esclusiva il Foro di <strong>Roma</strong>.
    </p>

    <h2>11. Contatti</h2>
    <p>
      Per comunicazioni relative ai presenti Termini: <a href="mailto:info@tauramanagement.com">info@tauramanagement.com</a>. Per
      richieste privacy: <a href="mailto:info@tauramanagement.com">info@tauramanagement.com</a>.
    </p>
  </LegalLayout>
);

export default Terms;
