import { MODELS, type ModelLevel } from "./anthropic.ts";

export interface RoutingInput {
  text: string;
  hasAttachment: boolean;
  attachmentPages?: number;
  multipleAttachments?: boolean;
  conversationLength: number;
  userTier: "starter" | "professional" | "enterprise";
}

export interface RoutingResult {
  model: string;
  level: ModelLevel;
  score: number;
  reasoning: string;
}

const DEEP_PATTERNS = [
  // Existing strategic/legal patterns
  /analizza\s+(tutti|intero|completo|ogni)/i,
  /strategia\s+negozial/i,
  /confronta\s+.*\s+con\s+/i,
  /cross[\s-]?check/i,
  /multi[\s-]?documento/i,
  /clausola.*ambigua/i,
  /interpreta.*contratto/i,
  /analisi\s+comparativa/i,
  /due\s+diligence/i,
  /valutazione\s+complessiva/i,

  // Recommendation & advisory (user asks for judgment, not just lookup)
  /cosa\s+farei|cosa\s+faresti|al\s+posto\s+(mio|tuo)/i,
  /consiglier(ei|esti|ebbe)|cosa\s+consig/i,
  /cosa\s+(dovremmo|dovrei|dovresti)\s+(fare|mandare|proporre|chiedere)/i,
  /mi\s+consigli|dà?mi\s+il\s+tuo\s+consiglio/i,

  // Time-horizon strategic analysis
  /nei\s+prossimi\s+\d+\s+(giorni|mesi|settimane)/i,
  /prossimi\s+60\s+giorni|prossimi\s+30\s+giorni|prossimo\s+trimestre/i,
  /entro\s+(giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gennaio|febbraio|marzo|aprile|maggio)\s+\d{4}/i,

  // Full-entity situational analysis
  /situazione\s+(contrattuale|complessiva|attuale)\s+(di|del)/i,
  /analizza\s+la\s+situazione/i,
  /dimmi\s+tutto\s+su\s+/i,
  /tutto\s+su\s+[A-Z]/i,

  // Conflict / exclusivity deep check
  /c[i']è\s+(un\s+)?conflitto|ci\s+sono\s+conflitti/i,
  /ha\s+esclusività|sovrapposiz|categor.*conflitt/i,
  /potrebbe\s+avere\s+un\s+conflitto/i,

  // Multi-entity ranking/comparison
  /ranking\s+(degli\s+)?atleti|dal\s+più\s+al\s+meno/i,
  /chi\s+è\s+il\s+(nostro\s+)?(migliore|più\s+redditiz|più\s+valutat)/i,
  /classifica.*atleti|ordina.*per.*valore/i,

  // Good deal / offer evaluation
  /è\s+un\s+buon\s+deal|è\s+conveniente|vale\s+la\s+pena/i,
  /valuta\s+(questa\s+)?offerta|analizza\s+(questa\s+)?proposta/i,
];

const MEDIUM_PATTERNS = [
  /analizza|esamina|verifica/i,
  /genera.*report|proof.*package/i,
  /conflitt|esclusivit|penale/i,
  /contratto|clausola|rescission/i,
  /campagna|deliverable|brief/i,
  /pipeline|deal|proposta/i,
  /pitch.*deck|presentazion/i,
  /riepilogo|riassumi/i,
  /scadenz|rinnov/i,
  /cosa.*deve.*fare|istruzioni/i,
  /manca|mancano|da pubblicare|non pubblicat|pendenti/i,
  /cosa.*post|post.*manca|pubblic/i,
  /elenco|elenca|lista|tutti/i,
  /zalando|nike|gucci|armani|samsung|loreal|myprotein|ita airways|booking/i,
  /sofia|giulia|beatrice|chiara|valentina|luca|marco|elisa|aurora|davide/i,
  /cosa|cosa c|cosa manca|dimmi|mostrami|dammi/i,
];

const SIMPLE_PATTERNS = [
  /^(ciao|salve|buongiorno|hey|ok|grazie|perfetto|va bene|capito|si|no)\b/i,
  /^mostra|^visualizza|^apri|^vai/i,
  /^quanti|^quanto|^lista|^elenco/i,
];

export function routeRequest(input: RoutingInput): RoutingResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Lunghezza input
  const tokenEstimate = input.text.length / 4;
  if (tokenEstimate > 2000) {
    score += 20;
    reasons.push("input lungo");
  } else if (tokenEstimate > 500) {
    score += 10;
    reasons.push("input medio");
  } else {
    score += 5;
  }

  // 2. Allegati
  if (input.hasAttachment) {
    score += 15;
    reasons.push("allegato");
    if (input.attachmentPages && input.attachmentPages > 10) {
      score += 10;
      reasons.push(">10pp");
    }
    if (input.multipleAttachments) {
      score += 10;
      reasons.push("multi-file");
    }
  }

  // 3. Pattern matching
  const deepMatch = DEEP_PATTERNS.some((p) => p.test(input.text));
  const mediumMatch = MEDIUM_PATTERNS.some((p) => p.test(input.text));
  const simpleMatch = SIMPLE_PATTERNS.some((p) => p.test(input.text));

  if (deepMatch) {
    score += 40;   // was 30 — deep queries need to reliably clear L3 threshold
    reasons.push("complesso");
  } else if (mediumMatch) {
    score += 15;
    reasons.push("medio");
  } else if (simpleMatch) {
    score -= 5;
    reasons.push("semplice");
  }

  // 4. Multi-step
  const connectors = (input.text.match(/\be\b|\bpoi\b|\binoltre\b|\banche\b/gi) || []).length;
  if (connectors >= 3) {
    score += 15;
    reasons.push("multi-step");
  } else if (connectors >= 2) {
    score += 8;
  }

  // 5. Conversazione lunga
  if (input.conversationLength > 10) {
    score += 10;
    reasons.push("conv lunga");
  } else if (input.conversationLength > 5) {
    score += 5;
  }

  // 6. Cross-reference
  if (/roster|tutti.*atleti|tutti.*talent|tutti.*contratti/i.test(input.text)) {
    score += 15;
    reasons.push("cross-ref");
  }

  score = Math.max(0, Math.min(100, score));

  // Tier caps — Starter non accede mai a L3
  const tierConfig: Record<
    string,
    { l2: number; l3: number; maxLevel: ModelLevel }
  > = {
    starter: { l2: 20, l3: 999, maxLevel: "L2" },
    professional: { l2: 15, l3: 45, maxLevel: "L3" }, // was 60 — deep queries score ~45-55
    enterprise: { l2: 10, l3: 35, maxLevel: "L3" },   // was 50 — enterprise gets L3 more easily
  };

  const cfg = tierConfig[input.userTier] ?? tierConfig.starter;

  let level: ModelLevel;
  let model: string;

  if (score >= cfg.l3 && cfg.maxLevel === "L3") {
    level = "L3";
    model = MODELS.OPUS;
  } else if (score >= cfg.l2) {
    level = "L2";
    model = MODELS.L2_SONNET;
  } else {
    level = "L1";
    model = MODELS.L1_GEMINI_FAST;
  }

  return { model, level, score, reasoning: reasons.join(", ") };
}
