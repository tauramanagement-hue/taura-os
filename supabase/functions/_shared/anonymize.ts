// PII anonymization for AI prompts (GDPR Art.25 — privacy by design)
// Maschera email, telefoni, CF, P.IVA, IBAN, indirizzi prima di inviare a LLM.
// Usato in chat/index.ts quando il contesto contiene PII non necessaria al reasoning.

const PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: "email",    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "[EMAIL]" },
  { name: "phone_it", regex: /\b(?:\+?39)?[\s.-]?(?:3\d{2}|0\d{1,3})[\s.-]?\d{3,7}[\s.-]?\d{3,4}\b/g, replacement: "[TELEFONO]" },
  { name: "iban",     regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g, replacement: "[IBAN]" },
  { name: "piva",     regex: /\b(?:IT)?\d{11}\b/g, replacement: "[P_IVA]" },
  { name: "cf",       regex: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g, replacement: "[CF]" },
  { name: "credit",   regex: /\b(?:\d[ -]?){13,19}\b/g, replacement: "[CARD]" },
];

export interface AnonymizeResult {
  text: string;
  matches: Record<string, number>;
}

export function anonymizePII(input: string): AnonymizeResult {
  if (!input) return { text: input, matches: {} };
  let text = input;
  const matches: Record<string, number> = {};
  for (const p of PATTERNS) {
    const before = text;
    text = text.replace(p.regex, p.replacement);
    const count = (before.match(p.regex) || []).length;
    if (count > 0) matches[p.name] = count;
  }
  return { text, matches };
}

export function anonymizeMessages<T extends { content: string }>(msgs: T[]): { messages: T[]; totalMatches: Record<string, number> } {
  const total: Record<string, number> = {};
  const out = msgs.map(m => {
    const r = anonymizePII(m.content);
    for (const [k, v] of Object.entries(r.matches)) total[k] = (total[k] || 0) + v;
    return { ...m, content: r.text };
  });
  return { messages: out, totalMatches: total };
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
