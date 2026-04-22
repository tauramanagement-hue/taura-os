import LegalLayout from "@/components/taura/LegalLayout";

const AIDisclosure = () => (
  <LegalLayout title="Informativa AI Processing" version="2026-04-21" lastUpdated="21 aprile 2026">
    <p>
      La presente informativa descrive come Taura OS utilizza sistemi di Intelligenza Artificiale,
      in ottemperanza all'Art. 13.2.f GDPR (informativa su processi decisionali automatizzati) e
      all'Art. 52 del Regolamento UE 2024/1689 ("<strong>AI Act</strong>") in materia di trasparenza
      dei sistemi di AI.
    </p>

    <h2>1. Sistemi AI utilizzati</h2>
    <p>
      Taura OS integra modelli di AI generativa forniti da provider terzi selezionati in base alle
      garanzie contrattuali e di sicurezza:
    </p>
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Modello</th>
          <th>Funzione</th>
          <th>Region</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Google Cloud (Vertex AI)</td><td>Gemini 2.5 Flash / Flash-Lite</td><td>Classificazione query, ranking, estrazione dati strutturati</td><td>europe-west1 (UE)</td></tr>
        <tr><td>Anthropic</td><td>Claude Sonnet</td><td>Chat assistente, generazione testo, ragionamento intermedio</td><td>USA (SCC + DPA)</td></tr>
        <tr><td>Anthropic</td><td>Claude Opus</td><td>Ragionamento complesso, analisi contratti</td><td>USA (SCC + DPA)</td></tr>
      </tbody>
    </table>

    <h2>2. Architettura di routing (L1/L2/L3)</h2>
    <p>
      Ogni richiesta utente viene instradata automaticamente su uno di tre livelli, in base alla
      complessità stimata:
    </p>
    <ul>
      <li><strong>L1 (Gemini Flash-Lite)</strong> — query semplici, classificazione, operazioni rapide. Rimane in UE.</li>
      <li><strong>L2 (Claude Sonnet)</strong> — chat conversazionale, generazione testo, reasoning standard.</li>
      <li><strong>L3 (Claude Opus)</strong> — analisi complesse, ragionamento su contratti, richieste articolate.</li>
    </ul>

    <h2>3. Trattamento dei dati e no-training</h2>
    <p>
      I provider AI utilizzati offrono garanzie contrattuali verificate:
    </p>
    <ul>
      <li><strong>Nessun training</strong> sui dati dei clienti (confermato contrattualmente).</li>
      <li><strong>Retention limitata:</strong> Anthropic elimina i dati entro 30 giorni; Vertex AI secondo
        le impostazioni di progetto (no storage prolungato).</li>
      <li><strong>Cifratura end-to-end</strong> nel trasferimento.</li>
      <li><strong>Anonimizzazione preventiva:</strong> prima dell'invio applichiamo tecniche di
        minimizzazione che mascherano email, numeri di telefono, codici fiscali, IBAN, carte di credito
        quando non sono strettamente necessari al reasoning.</li>
    </ul>

    <h2>4. Cosa l'AI NON fa</h2>
    <ul>
      <li><strong>Nessuna decisione automatizzata con effetti giuridici</strong> ai sensi dell'Art. 22 GDPR.</li>
      <li><strong>Nessuna profilazione</strong> finalizzata a pubblicità comportamentale.</li>
      <li><strong>Nessuna valutazione creditizia, assicurativa o occupazionale</strong>.</li>
      <li><strong>Nessuna consulenza legale, fiscale, medica</strong>: gli output vanno sempre verificati.</li>
    </ul>

    <h2>5. Diritto all'intervento umano</h2>
    <p>
      Tutti gli output AI sono suggerimenti che l'utente può accettare, modificare o rifiutare. Nessuna
      azione con impatto esterno (es. invio email, modifica contratti, creazione deal) avviene senza
      conferma esplicita dell'utente tramite il pattern "Azione richiesta → Conferma/Annulla".
    </p>

    <h2>6. Categorie di dati inviati all'AI</h2>
    <ul>
      <li>Messaggi scritti dall'utente nella chat AI.</li>
      <li>File caricati per elaborazione (contratti, brief brand).</li>
      <li>Contesto strutturato: nomi degli atleti, brand, date, importi <em>previa anonimizzazione PII non necessaria</em>.</li>
    </ul>
    <p>
      <strong>Non</strong> vengono inviati all'AI: credenziali, token, dati bancari completi,
      codici fiscali o IBAN in chiaro quando non funzionali alla richiesta.
    </p>

    <h2>7. Limiti e rischi noti</h2>
    <p>
      I modelli AI possono produrre contenuti inesatti, incompleti, o apparentemente plausibili ma
      errati ("allucinazioni"). È responsabilità dell'utente verificare la correttezza degli output
      prima di utilizzarli operativamente, in particolare per:
    </p>
    <ul>
      <li>clausole contrattuali estratte automaticamente;</li>
      <li>importi, scadenze, percentuali;</li>
      <li>messaggi da inviare ai talent;</li>
      <li>analisi strategiche o decisioni commerciali.</li>
    </ul>

    <h2>8. I tuoi diritti</h2>
    <p>
      Puoi in qualsiasi momento:
    </p>
    <ul>
      <li>Revocare il consenso al trattamento AI (le funzionalità AI saranno disattivate).</li>
      <li>Chiedere la cancellazione della cronologia chat.</li>
      <li>Esportare tutte le conversazioni (Art. 20 GDPR).</li>
      <li>Contestare un output AI scrivendo a{" "}
        <a href="mailto:info@tauramanagement.com">info@tauramanagement.com</a>.</li>
    </ul>

    <h2>9. Aggiornamenti</h2>
    <p>
      L'elenco dei modelli e dei provider può evolvere. Le modifiche sostanziali saranno notificate
      e potranno richiedere un nuovo consenso.
    </p>
  </LegalLayout>
);

export default AIDisclosure;
