# Guida passo passo: vedere il progetto funzionante

Segui questi passi **nell'ordine**. Se qualcosa non funziona, fermati e controlla il passo corrispondente.

---

## Passo 1: Installare Node.js

Node.js serve per eseguire il progetto.

1. Vai su: **https://nodejs.org**
2. Scarica la versione **LTS** (pulsante verde "Consigliata per la maggior parte degli utenti").
3. Esegui il file scaricato e installa:
   - Spunta **"Add to PATH"** se c'è l'opzione.
   - Clicca **Next** fino a **Finish**.
4. **Chiudi e riapri Cursor** (o il computer) così il terminale riconosce Node.

**Verifica:** apri il terminale in Cursor (menu **Terminal** → **New Terminal**) e scrivi:
```text
node -v
```
Deve uscire un numero (es. `v20.10.0`). Poi scrivi:
```text
npm -v
```
Anche qui deve uscire un numero. Se uno dei due dà errore, Node non è installato correttamente o non è nel PATH.

---

## Passo 2: Aprire il terminale nella cartella del progetto

1. In Cursor: menu **Terminal** → **New Terminal** (oppure premi **Ctrl+ù**).
2. In basso compare il terminale. Assicurati di essere nella cartella del progetto. Se non lo sei, scrivi (copia-incolla):

   **Su Windows (PowerShell):**
   ```powershell
   cd "e:\Taura\Taura\Sport Management\Code SaaS\roster-rise-ai-main\roster-rise-ai-main"
   ```

3. Premi **Invio**. Il prompt dovrebbe mostrare un percorso che termina con `roster-rise-ai-main`.

---

## Passo 3: Installare le dipendenze

Nel **stesso terminale** scrivi:

```text
npm i
```

Premi **Invio** e attendi (può richiedere 1–2 minuti).  
Alla fine non devono esserci errori in rosso. Se vedi "added XXX packages", va bene.

---

## Passo 4: File .env (chiavi Supabase)

L'app usa Supabase (database e login). Serve un file `.env` nella cartella del progetto con queste due righe (sostituisci con i tuoi valori):

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- Se **hai già** un file `.env` in questa cartella con queste variabili, **non fare nulla** e vai al Passo 5.
- Se **non ce l'hai** o non sei sicuro:
  - Vai su **https://supabase.com** e accedi al tuo progetto (o creane uno).
  - In **Project Settings** → **API** trovi **Project URL** e **anon public** key: usali per `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - Crea il file `.env` nella stessa cartella di `package.json` con quelle due righe e salva.

Senza `.env` corretto l'app si apre ma login e dati potrebbero non funzionare.

---

## Passo 5: Avviare il server

Nel **stesso terminale** (sempre nella cartella del progetto) scrivi:

```text
npm run dev
```

Premi **Invio**.

- Dopo qualche secondo dovresti vedere qualcosa del tipo:
  ```text
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:8080/
  ```
- **Non chiudere il terminale**: se lo chiudi, il server si spegne e il sito non si carica più.

---

## Passo 6: Aprire il progetto nel browser

1. Apri il browser (Chrome, Edge, Firefox, ecc.).
2. Nella barra degli indirizzi scrivi:
   ```text
   http://localhost:8080
   ```
3. Premi **Invio**.

Dovresti vedere la **landing page** del progetto (Roster Rise AI). Da lì puoi provare **Login** o **Registrati** (se hai configurato Supabase).

---

## Riepilogo comandi (dopo aver installato Node)

Apri il terminale, vai nella cartella del progetto e esegui in ordine:

```powershell
cd "e:\Taura\Taura\Sport Management\Code SaaS\roster-rise-ai-main\roster-rise-ai-main"
npm i
npm run dev
```

Poi nel browser apri: **http://localhost:8080**

---

## Problemi comuni

| Problema | Cosa fare |
|----------|-----------|
| `npm non è riconosciuto` | Node non è installato o non è nel PATH. Reinstalla Node (Passo 1) e **riavvia Cursor**. |
| `Connessione negata` su localhost:8080 | Il server non è avviato. Esegui `npm run dev` e **lascia il terminale aperto**. |
| Pagina bianca o errori in console | Controlla che il file `.env` esista e abbia `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` corretti. |
| Porta 8080 già in uso | Un'altra app usa la porta 8080. Chiudi l'altra app oppure chiedi di cambiare la porta nel progetto. |

Se ti blocchi su un passo preciso, scrivi quale (es. "Passo 3" o "npm non è riconosciuto") e cosa vedi a schermo.
