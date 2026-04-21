/**
 * Route-aware suggested prompts for AIChatPanel.
 * Pure data + lookup. No React, no API calls.
 *
 * Matching strategy: longest-prefix wins, so /contracts/upload picks
 * /contracts, and /athletes/123 picks /athletes.
 */

export const DEFAULT_PROMPTS: readonly string[] = [
  "Scadenze urgenti",
  "Conflitti attivi",
  "Riepilogo roster",
];

export const CONTEXTUAL_PROMPTS: Readonly<Record<string, readonly string[]>> = {
  "/dashboard": [
    "Cosa devo fare oggi?",
    "Riepilogo della settimana",
    "Scadenze critiche prossimi 30 giorni",
  ],
  "/athletes": [
    "Chi sono i miei top performer?",
    "Quali atleti hanno contratti in scadenza?",
    "Confronta valore di mercato dei miei atleti",
  ],
  "/contracts": [
    "Quali contratti scadono nei prossimi 90 giorni?",
    "Dammi il monte contratti per anno",
    "Trova clausole di rinnovo automatico",
  ],
  "/deals": [
    "Pipeline deal per stage",
    "Quali deal sono bloccati da più di 30 giorni?",
    "Valore totale pipeline ponderato",
  ],
  "/campaigns": [
    "Quali campagne sono attive ora?",
    "Deliverable in scadenza questa settimana",
    "Performance media campagne ultimo trimestre",
  ],
  "/deadlines": [
    "Scadenze critiche prossimi 7 giorni",
    "Tutte le scadenze di questo mese",
    "Quali scadenze sono già passate?",
  ],
  "/calendar": [
    "Cosa ho oggi?",
    "Eventi della settimana",
    "Prossimi deliverable",
  ],
  "/portfolio": [
    "Monte contratti totale",
    "Distribuzione revenue per atleta",
    "Trend Q4 vs Q3",
  ],
  "/reports": [
    "Genera report monte contratti",
    "Analisi commissioni anno corrente",
    "Top 5 atleti per revenue",
  ],
  "/transfers": [
    "Trasferimenti in trattativa",
    "Finestre di mercato aperte ora",
    "Atleti free agent prossimi 6 mesi",
  ],
  "/mandates": [
    "Mandati in scadenza",
    "Mandati da depositare",
    "Mandati FIGC attivi",
  ],
  "/scouting": [
    "Top prospect in pipeline",
    "Prospect in trattativa avanzata",
    "Free agent monitorati",
  ],
  "/settings": [
    "Come invito un membro del team?",
    "Cambia il piano della mia agenzia",
    "Esporta i dati dell'agenzia",
  ],
};

/**
 * Returns the suggested prompts for the current route.
 * Falls back to DEFAULT_PROMPTS when no route key prefix-matches.
 */
export function getPromptsForRoute(pathname: string): readonly string[] {
  const keys = Object.keys(CONTEXTUAL_PROMPTS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      return CONTEXTUAL_PROMPTS[key];
    }
  }
  return DEFAULT_PROMPTS;
}
