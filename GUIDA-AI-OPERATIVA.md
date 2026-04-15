# Guida passo passo: rendere operativa l’AI (solo Gemini + Anthropic)

Nessun Lovable. Solo **Google Gemini** (L1 fast, L2 mid) e **Anthropic Claude** (L2 Sonnet mix, L3 Opus).

- **L1** → Gemini Fast (Google API)
- **L2** → mix: Gemini Mid (Google) + Claude Sonnet (Anthropic), alternati
- **L3** → Claude Opus (Anthropic)

---

## Passo 1: Chiave Google (Gemini) – obbligatoria per L1 e L2 mid

1. Vai su **https://aistudio.google.com/apikey** (Google AI Studio).
2. Accedi con il tuo account Google.
3. Clicca **Create API key** e scegli un progetto (o creane uno).
4. Copia la chiave (es. `AIza...`).  
   Tienila al sicuro.

---

## Passo 2: Chiave Anthropic – obbligatoria per L2 Sonnet e L3 Opus

1. Vai su **https://console.anthropic.com** e accedi (o registrati).
2. Apri **API Keys** (o **Settings → API Keys**).
3. Crea una nuova key e **cópiala subito** (es. `sk-ant-api03-...`).

Senza questa key L2 non userà Claude Sonnet (solo Gemini Mid) e L3 non funzionerà.

---

## Passo 3: Secrets in Supabase

1. Apri **https://supabase.com** → tuo progetto.
2. **Edge Functions** → tab **Secrets**.
3. Aggiungi due secret:

**Secret 1 – Gemini (L1 e L2 mid):**

- **Name:** `GEMINI_API_KEY`
- **Value:** la chiave Google AI Studio (Passo 1)  
- Salva.

**Secret 2 – Anthropic (L2 Sonnet e L3):**

- **Name:** `ANTHROPIC_API_KEY`
- **Value:** la chiave Anthropic (Passo 2)  
- Salva.

| Secret              | Uso                          |
|---------------------|------------------------------|
| `GEMINI_API_KEY`    | L1 (Gemini Fast), L2 (Gemini Mid nel mix), parsing file (PDF) |
| `ANTHROPIC_API_KEY` | L2 (Claude Sonnet nel mix), L3 (Opus) |

Entrambe sono necessarie per avere L1, L2 mix e L3 tutti operativi.

---

## Passo 4: Deploy delle Edge Functions

Nel terminale, dalla cartella del progetto:

```powershell
cd "e:\Taura\Taura\Sport Management\Code SaaS\roster-rise-ai-main\roster-rise-ai-main"
npx supabase link --project-ref <IL_TUO_PROJECT_REF>
npx supabase functions deploy chat
npx supabase functions deploy parse-contract
npx supabase functions deploy parse-brief
npx supabase functions deploy apply-resolution
npx supabase functions deploy enrich-social
npx supabase functions deploy generate-media-kit
```

Sostituisci `<IL_TUO_PROJECT_REF>` con il **Reference ID** (Supabase → **Project Settings** → **General**).

---

## Passo 5: Verifica

1. Avvia l’app: `npm run dev` e apri **http://localhost:8080**.
2. Apri la chat **Taura AI**.
3. Prova:
   - **Ciao** → risposta con badge **L1** (Gemini Fast).
   - **Riepilogo scadenze contratti** → **L2** (mix Gemini Mid / Sonnet).
   - **Analizza tutti i contratti e confronta le esclusività** → **L3** (Opus).

Se qualcosa fallisce, controlla i **Log** della function **chat** in Supabase e verifica che `GEMINI_API_KEY` e `ANTHROPIC_API_KEY` siano impostate.

---

## Riepilogo

1. **GEMINI_API_KEY** (Google AI Studio) in Supabase Secrets.
2. **ANTHROPIC_API_KEY** in Supabase Secrets.
3. Deploy delle 6 Edge Functions.
4. Test in chat: L1 / L2 / L3.

Lovable non è più usato: solo Gemini (Google) e Anthropic (Claude).
