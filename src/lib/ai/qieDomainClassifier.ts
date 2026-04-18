/**
 * QIE — Query Intelligence Engine: domain classifier.
 *
 * Deterministic regex classification into exactly one of 16 domains.
 * ZERO LLM calls. Handles Italian AND English input.
 *
 * Output: {domain, confidence, entities, matched_rules} — the orchestrator
 * uses entities + matched_rules to decide routing + complexity.
 */

import type { SystemContext } from "./contextBuilder";

export type QIEDomain =
  | "roster_overview"
  | "athlete_detail"
  | "athlete_ranking"
  | "contract_lookup"
  | "contract_expiry"
  | "conflict_check"
  | "deal_pipeline"
  | "deal_detail"
  | "revenue_query"
  | "campaign_status"
  | "exclusivity_check"
  | "deadline_alert"
  | "comparison"
  | "market_intel"
  | "action_request"
  | "general_conversation";

export interface ExtractedEntities {
  athlete_ids: string[];
  brands: string[];
  date_range?: { from?: string; to?: string };
  categories: string[];
  numbers: number[];
  mentions_legal: boolean;
  mentions_multi_step: boolean;
  mentions_penalty_over_threshold: boolean; // heuristic: €10k+ mentioned w/ penalty
}

export interface QIEClassification {
  domain: QIEDomain;
  confidence: number;
  entities: ExtractedEntities;
  matched_rules: string[];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Rule table — regex with a domain + weight.
// ---------------------------------------------------------------------------

interface DomainRule {
  domain: QIEDomain;
  label: string;
  regex: RegExp;
  weight: number;
}

const RULES: DomainRule[] = [
  // roster_overview (IT+EN)
  { domain: "roster_overview", label: "roster count", weight: 3, regex: /\b(quanti atleti|quanti talent|quanti creator|quanti ho in roster|mostrami il roster|lista roster|mostra roster|tutti (gli )?atleti|chi gestisco|how many athletes|show roster|list roster|who do i manage)\b/i },
  { domain: "roster_overview", label: "roster breakdown", weight: 2, regex: /\b(roster|portfolio atleti)\b.*\b(breakdown|split|suddivis|per sport|per categoria|by sport)\b/i },

  // athlete_ranking
  { domain: "athlete_ranking", label: "ranking keyword", weight: 4, regex: /\b(migliore|peggiore|top|best|worst|classifica|ranking|chi genera di piu|piu forte|piu redditizio|piu ingaggiato|chi vale di piu|who is the best|who is the top|most valuable|highest earning)\b/i },
  { domain: "athlete_ranking", label: "ordering", weight: 2, regex: /\b(ordina|sort|classifica per|rank by|order by)\b/i },

  // athlete_detail
  { domain: "athlete_detail", label: "about athlete", weight: 3, regex: /\b(dimmi (tutto )?(di|su)|parlami di|info su|come sta (andando)?|profilo di|situazione di|status di|tell me about|info on|profile of)\b/i },

  // contract_lookup
  { domain: "contract_lookup", label: "contracts of", weight: 3, regex: /\b(contratti di|contratti con|contratti attivi|elenca contratti|mostra contratti|mostrami (gli )?accordi|list contracts|contracts of|show contracts|agreements with)\b/i },
  { domain: "contract_lookup", label: "clauses", weight: 3, regex: /\b(clausola|clausole|obblighi|penali|rescission|esclusivit|diritti (d[ei] )?immagine|non compete|rinnovo|durata contratto|legal|penalty|termination|exclusivity clause)\b/i },

  // contract_expiry
  { domain: "contract_expiry", label: "expiry window", weight: 4, regex: /\b(scade|scadon|scadut|scadenza|scadenze|in scadenza|rinnovi|expire|expiring|expires|deadline|renewal).{0,40}\b(settiman|mese|mesi|giorni|gg|trimestr|quarter|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gennaio|febbraio|marzo|aprile|maggio|week|month|days|next|prossim)\b/i },
  { domain: "contract_expiry", label: "expiry direct", weight: 3, regex: /\b(cosa scade|cosa c'? e in scadenza|contratti (in )?scadenza|what expires|expiring contracts|upcoming renewals)\b/i },

  // conflict_check
  { domain: "conflict_check", label: "conflict", weight: 4, regex: /\b(conflitt|conflict|c'?\s*e (un )?conflitto|check (su )?conflitti|clash)\b/i },
  { domain: "conflict_check", label: "possible deal", weight: 3, regex: /\b(posso (fare|firmare) (un )?deal|posso fare deal con|can i sign|can we sign|compatibil[ea] (con|with)|check .* per .*)\b/i },

  // deal_pipeline
  { domain: "deal_pipeline", label: "pipeline", weight: 4, regex: /\b(pipeline|deal in corso|deal aperti|trattative|in negoziazione|negotiation|closing|proposte|in inbound|open deals|active negotiations)\b/i },

  // deal_detail
  { domain: "deal_detail", label: "deal detail", weight: 3, regex: /\b(stato (della )?trattativa|dimmi del deal|stato deal|dove siamo col deal|a che punto (siamo col|e il) deal|deal con [A-Z]|trattativa [A-Z]|status of the deal|offer status)\b/i },

  // revenue_query
  { domain: "revenue_query", label: "revenue", weight: 4, regex: /\b(revenue|monte deal|monte contratti|quanto ha (fatto|generato|guadagnato)|incassi|fatturato|totale ricavi|commission|commissioni|how much (did|has) .* (earn|generate)|earnings|total billing)\b/i },

  // campaign_status
  { domain: "campaign_status", label: "campaign", weight: 4, regex: /\b(campagna|campaign|deliverable|post da pubblicare|cosa manca (da )?(postare|pubblicare)|approvaz|pubblicat|campagne attive|campaign status)\b/i },

  // exclusivity_check
  { domain: "exclusivity_check", label: "exclusivity", weight: 5, regex: /\b(esclusiv|exclusive|esclusivit|esclusiva (su|per)|chi ha esclusiva|can we pitch|possiamo pitchare|si puo proporre|categoria libera|is .* free|who has exclusivity)\b/i },

  // deadline_alert
  { domain: "deadline_alert", label: "week plan", weight: 3, regex: /\b(cosa devo fare (oggi|domani|questa settimana|this week)|alert|scadenze settimana|cose urgenti|priorit[aà] della settimana|what should i focus on|to ?do|urgent|urgente)\b/i },

  // comparison
  { domain: "comparison", label: "comparison vs", weight: 5, regex: /\b(confronta|compare|\bvs\b|a confronto|versus|meglio ([a-zA-Z]+ )?o ([a-zA-Z]+)|differenza tra)\b/i },

  // market_intel
  { domain: "market_intel", label: "benchmark", weight: 5, regex: /\b(quanto vale (un|il|una)|mercato|benchmark|media di settore|qual[eè] il prezzo|fair price|quanto potremmo chiedere|quanto si paga|market rate|forchetta|price range|average deal|median deal)\b/i },

  // action_request (create/update/delete intents)
  { domain: "action_request", label: "write intent", weight: 5, regex: /\b(crea (un|il|la)|nuovo|aggiungi|add|create|aggiorna|update|sposta (in|a)|cambia stage|segna come|flagga|mark as|salva|firma (il )?deal|chiudi il deal|elimina|delete|rimuovi|cancella|remove)\b/i },
];

const LEGAL_KEYWORDS = /\b(clausol|penal|esclusiv|rescission|obblig|diritti (d[ei] )?immagine|non compete|recesso|foro competente|inadempiment|penalty|termination|breach)/i;
const MULTISTEP_CONNECTORS = /\b(\be\s+poi\b|\be\s+(controlla|verifica|aggiungi|confronta)|\bpoi\b|\binoltre\b|\banche\b|\bthen\b|\band then\b|\bplus\b|\bAND\b)\b/i;
const CATEGORY_REGEX = /\b(bevande|alcol|energy drink|abbigliamento|sportswear|cosmetica|moda|tecnologia|gaming|automotive|food|beauty|finance|nutrition|integrator|nutrition\/integratori|automobile|auto|telco)\b/i;
const PENALTY_NUMBER = /\b(penale|penalty|inadempiment|breach).{0,30}(\d{1,3}[.,]?\d{3,}|\d+\s*k|\d+\s*mila|\d+\s*mln|\d+\s*milion|million)/i;

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

function extractEntities(text: string, ctx: SystemContext | null): ExtractedEntities {
  const nt = normalize(text);
  const athleteIds = new Set<string>();
  const brands: string[] = [];
  const categories: string[] = [];
  const numbers: number[] = [];

  // Athlete name match using roster (full name match or unique single-token match)
  if (ctx) {
    for (const a of ctx.roster.athletes) {
      const fullNorm = normalize(a.full_name);
      if (!fullNorm) continue;
      if (nt.includes(fullNorm)) {
        athleteIds.add(a.id);
        continue;
      }
      const parts = fullNorm.split(" ");
      const words = nt.split(" ");
      for (const p of parts) {
        if (p.length < 4) continue;
        if (words.includes(p)) {
          const collisions = ctx.roster.athletes.filter((o) =>
            normalize(o.full_name).split(" ").includes(p),
          );
          if (collisions.length === 1) athleteIds.add(a.id);
          break;
        }
      }
    }
  }

  // Brand heuristic: capitalized tokens ≥3 chars in original text
  const origTokens = text.match(/\b[A-Z][a-zA-Z][a-zA-Z]+\b/g) || [];
  const skip = new Set(["Io", "Il", "La", "Le", "Lo", "Ho", "Hai", "The", "And", "What", "Who", "How"]);
  for (const t of origTokens) {
    if (!brands.includes(t) && !skip.has(t)) brands.push(t);
  }

  // Categories
  const catMatch = text.match(CATEGORY_REGEX);
  if (catMatch) categories.push(catMatch[0].toLowerCase());

  // Numbers
  const numMatches = text.match(/\d+([.,]\d+)?/g) || [];
  for (const n of numMatches) {
    const v = parseFloat(n.replace(",", "."));
    if (!isNaN(v)) numbers.push(v);
  }

  return {
    athlete_ids: Array.from(athleteIds),
    brands,
    categories,
    numbers,
    mentions_legal: LEGAL_KEYWORDS.test(text),
    mentions_multi_step: MULTISTEP_CONNECTORS.test(text),
    mentions_penalty_over_threshold: PENALTY_NUMBER.test(text),
  };
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

const SIMPLE_GREETING = /^\s*(ciao|salve|hey|hi|hello|buongiorno|buonasera|grazie|thanks|ok|perfetto|capito|va bene|yo)\s*[!.?]?\s*$/i;

export function classifyQuery(text: string, ctx: SystemContext | null): QIEClassification {
  const entities = extractEntities(text, ctx);
  const matched: string[] = [];

  if (SIMPLE_GREETING.test(text.trim())) {
    return {
      domain: "general_conversation",
      confidence: 0.95,
      entities,
      matched_rules: ["greeting"],
    };
  }

  // Score each domain from rule matches
  const scores: Partial<Record<QIEDomain, number>> = {};
  for (const r of RULES) {
    if (r.regex.test(text)) {
      scores[r.domain] = (scores[r.domain] ?? 0) + r.weight;
      matched.push(`${r.domain}:${r.label}`);
    }
  }

  // Entity boosts
  if (entities.athlete_ids.length >= 2) {
    scores.comparison = (scores.comparison ?? 0) + 3;
    matched.push("comparison:multi-athlete");
  }
  if (entities.athlete_ids.length === 1 && !scores.athlete_ranking && !scores.contract_lookup) {
    scores.athlete_detail = (scores.athlete_detail ?? 0) + 2;
    matched.push("athlete_detail:entity");
  }
  if (entities.mentions_legal) {
    scores.contract_lookup = (scores.contract_lookup ?? 0) + 2;
    matched.push("contract_lookup:legal");
  }

  // Disambiguation: exclusivity_check overrides conflict_check when user asks "posso"
  if (scores.exclusivity_check && scores.conflict_check) {
    if (/\b(posso|can i|possiamo|can we)\b/i.test(text)) {
      scores.exclusivity_check = (scores.exclusivity_check ?? 0) + 2;
    }
  }

  // Pick winning domain
  const sorted = (Object.entries(scores) as [QIEDomain, number][]).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { domain: "general_conversation", confidence: 0.4, entities, matched_rules: [] };
  }

  const [topDomain, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] ?? 0;
  const confidence = Math.min(0.99, 0.4 + topScore / 10 - secondScore / 20);

  return {
    domain: topDomain,
    confidence: Math.round(confidence * 100) / 100,
    entities,
    matched_rules: matched,
  };
}

/**
 * Multi-step chain detection — if user asked more than one thing in one turn,
 * return ordered list of sub-domains to execute before the LLM pass.
 */
export function detectChain(classification: QIEClassification, text: string): QIEDomain[] {
  if (!classification.entities.mentions_multi_step) return [classification.domain];

  const chain: QIEDomain[] = [classification.domain];
  if (/esclusiv|exclusiv/i.test(text) && !chain.includes("exclusivity_check")) chain.push("exclusivity_check");
  if (/conflitt|conflict/i.test(text) && !chain.includes("conflict_check")) chain.push("conflict_check");
  if (/scadenz|expir/i.test(text) && !chain.includes("contract_expiry")) chain.push("contract_expiry");
  if (/ranking|classifica|migliore|top|best/i.test(text) && !chain.includes("athlete_ranking")) chain.push("athlete_ranking");

  return Array.from(new Set(chain));
}
