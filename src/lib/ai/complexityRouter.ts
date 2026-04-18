/**
 * Taura AI — Complexity router (Layer 3).
 *
 * Runs AFTER QIE classification. Deterministic scoring picks L1/L2/L3.
 * Zero LLM calls. Output feeds the router edge function which dispatches
 * to Gemini Flash (L1), Sonnet (L2) or Opus (L3).
 *
 * Exports:
 *  - routeRequest(input) → RoutingDecision   (primary, spec name)
 *  - routeComplexity(input)                  (legacy alias)
 *  - modelNameForLevel(level)
 *  - tokenCount(text)                        (words × 1.3 per spec)
 */
import type { QIEClassification } from "./qieDomainClassifier";

export type ModelLevel = "L1" | "L2" | "L3";
export type DataQuality = "full" | "partial" | "insufficient";

export interface RoutingInput {
  text: string;
  classification: QIEClassification;
  attachmentCount: number;
  multiplePdfs: boolean;
  legalPdf: boolean;
  conversationLength: number;
  threadSameTopicTurns: number;
  bigPenaltyDetected: boolean;
  dataQuality?: DataQuality;
}

export interface RoutingDecision {
  score: number;
  level: ModelLevel;
  reasons: string[];
  score_breakdown: Record<string, number>;
  override?: string;
}

interface ScoringRule {
  label: string;
  points: number;
  test: (i: RoutingInput) => boolean;
}

const LEGAL_KEYWORDS =
  /\b(clausol|penal|esclusiv|rescission|inadempiment|foro competente|non compete|recesso|termination|breach|exclusivity)\b/i;

/** Token estimate: words × 1.3 per spec (no external tokenizer). */
export function tokenCount(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

const RULES: ScoringRule[] = [
  { label: "tokens 0-200", points: 5, test: (i) => tokenCount(i.text) <= 200 },
  { label: "tokens 201-500", points: 10, test: (i) => { const t = tokenCount(i.text); return t > 200 && t <= 500; } },
  { label: "tokens 501-2000", points: 15, test: (i) => { const t = tokenCount(i.text); return t > 500 && t <= 2000; } },
  { label: "tokens 2000+", points: 20, test: (i) => tokenCount(i.text) > 2000 },

  { label: "PDF attachment", points: 20, test: (i) => i.attachmentCount >= 1 },
  { label: "Multiple PDFs", points: 30, test: (i) => i.multiplePdfs },

  { label: "domain:ranking/comparison", points: 10, test: (i) => i.classification.domain === "athlete_ranking" || i.classification.domain === "comparison" },
  { label: "domain:conflict/exclusivity", points: 20, test: (i) => i.classification.domain === "conflict_check" || i.classification.domain === "exclusivity_check" },
  { label: "domain:contract+legal", points: 15, test: (i) => i.classification.domain === "contract_lookup" && LEGAL_KEYWORDS.test(i.text) },
  { label: "domain:action_request", points: 5, test: (i) => i.classification.domain === "action_request" },
  { label: "domain:market_intel", points: 15, test: (i) => i.classification.domain === "market_intel" },

  { label: "multi-step chain", points: 20, test: (i) => i.classification.entities.mentions_multi_step },
  { label: "long conversation", points: 10, test: (i) => i.threadSameTopicTurns > 5 || i.conversationLength > 5 },
  { label: "cross-entity", points: 15, test: (i) => i.classification.entities.athlete_ids.length >= 2 || (i.classification.entities.athlete_ids.length >= 1 && i.classification.entities.brands.length >= 1) },
  { label: "legal keywords", points: 20, test: (i) => LEGAL_KEYWORDS.test(i.text) },
  { label: "low confidence", points: 10, test: (i) => i.classification.confidence < 0.55 },
];

function bump(level: ModelLevel): ModelLevel {
  return level === "L1" ? "L2" : level === "L2" ? "L3" : "L3";
}

export function routeRequest(input: RoutingInput): RoutingDecision {
  const score_breakdown: Record<string, number> = {};
  const reasons: string[] = [];
  let score = 0;

  for (const r of RULES) {
    if (r.test(input)) {
      score += r.points;
      score_breakdown[r.label] = r.points;
      reasons.push(`+${r.points} ${r.label}`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  let level: ModelLevel = score <= 30 ? "L1" : score <= 65 ? "L2" : "L3";
  let override: string | undefined;

  // Hard overrides (spec)
  if (input.legalPdf && level === "L1") {
    level = "L2";
    override = "legal PDF detected — minimum L2";
    reasons.push(override);
  }
  if (input.bigPenaltyDetected && level !== "L3") {
    level = "L3";
    override = "penalty ≥ €10k — forced L3";
    reasons.push(override);
  }
  if (input.classification.domain === "action_request" && level === "L1") {
    level = "L2";
    override = "action_request — minimum L2 for confirmation reasoning";
    reasons.push(override);
  }
  if (input.dataQuality === "insufficient") {
    const bumped = bump(level);
    if (bumped !== level) {
      level = bumped;
      override = "data_quality insufficient — bumped +1 level";
      reasons.push(override);
    }
  }

  return { score, level, reasons, score_breakdown, override };
}

/** Legacy alias. */
export const routeComplexity = routeRequest;

export function modelNameForLevel(level: ModelLevel): string {
  switch (level) {
    case "L1":
      return "gemini-2.5-flash";
    case "L2":
      return "claude-sonnet-4-5-20250929";
    case "L3":
      return "claude-opus-4-20250514";
  }
}
