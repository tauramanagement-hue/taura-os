import { useState } from "react";
import LegalLayout from "@/components/taura/LegalLayout";
import CookieConsentBanner from "@/components/taura/CookieConsentBanner";

const Cookies = () => {
  const [showBanner, setShowBanner] = useState(false);

  return (
    <>
      <LegalLayout title="Informativa Cookie" version="2026-04-21" lastUpdated="21 aprile 2026">
        <p>
          La presente informativa è redatta in conformità al Provvedimento del Garante per la Protezione
          dei Dati Personali "Linee guida cookie e altri strumenti di tracciamento" del 10 giugno 2021
          (doc. web n. 9677876) e all'Art. 122 del Codice Privacy.
        </p>

        <h2>1. Cosa sono i cookie</h2>
        <p>
          I cookie sono piccoli file di testo salvati sul dispositivo dell'utente dal sito web visitato.
          Insieme ad altri strumenti di tracciamento (pixel, local storage, session storage) permettono di
          riconoscere l'utente, memorizzare preferenze e raccogliere statistiche di utilizzo.
        </p>

        <h2>2. Cookie utilizzati</h2>

        <h3>Cookie tecnici (sempre attivi)</h3>
        <p>
          Necessari per il funzionamento del sito. Non richiedono consenso.
        </p>
        <table>
          <thead>
            <tr><th>Nome</th><th>Finalità</th><th>Durata</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sb-auth-token</code></td>
              <td>Autenticazione utente (Supabase)</td>
              <td>Sessione</td>
            </tr>
            <tr>
              <td><code>sb-refresh-token</code></td>
              <td>Rinnovo token di sessione</td>
              <td>30 giorni</td>
            </tr>
            <tr>
              <td><code>taura:theme</code></td>
              <td>Preferenza tema chiaro/scuro</td>
              <td>Permanente</td>
            </tr>
            <tr>
              <td><code>taura:cookies:v1</code></td>
              <td>Memorizzazione scelte consenso cookie</td>
              <td>12 mesi</td>
            </tr>
          </tbody>
        </table>

        <h3>Cookie statistici (opt-in)</h3>
        <p>
          Attualmente <strong>non utilizziamo</strong> strumenti di analytics di terze parti. Qualora in
          futuro venissero attivati, sarà raccolto un consenso specifico tramite il banner.
        </p>

        <h3>Cookie di marketing (opt-in)</h3>
        <p>
          Attualmente <strong>non utilizziamo</strong> cookie di marketing o profilazione pubblicitaria.
        </p>

        <h2>3. Come gestire le preferenze</h2>
        <p>
          Puoi modificare in qualsiasi momento le tue scelte cliccando sul pulsante sottostante.
          Puoi inoltre configurare il tuo browser per bloccare o cancellare i cookie già memorizzati;
          tuttavia la disattivazione dei cookie tecnici potrebbe compromettere il corretto funzionamento
          del servizio (es. impossibilità di mantenere l'autenticazione).
        </p>
        <p>
          <button
            onClick={() => setShowBanner(true)}
            className="inline-flex items-center gap-2 text-[12px] font-semibold px-4 py-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 transition-all"
          >
            Gestisci preferenze cookie
          </button>
        </p>

        <h2>4. Trasferimento dati extra-UE</h2>
        <p>
          I cookie tecnici necessari sono gestiti da Supabase (dati in UE, regione AWS eu-north-1 Stockholm).
          Nessun cookie comporta trasferimenti non protetti fuori dallo Spazio Economico Europeo.
        </p>

        <h2>5. Diritti dell'interessato</h2>
        <p>
          Per le modalità di esercizio dei tuoi diritti fai riferimento alla{" "}
          <a href="/privacy">Informativa Privacy</a>.
        </p>

        <h2>6. Aggiornamenti</h2>
        <p>
          La presente informativa può essere modificata. Le modifiche saranno pubblicate con indicazione
          della data di ultimo aggiornamento.
        </p>
      </LegalLayout>

      {showBanner && <CookieConsentBanner forceOpen onClose={() => setShowBanner(false)} />}
    </>
  );
};

export default Cookies;
