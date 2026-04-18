/**
 * QIE — Query Intelligence Engine: data fetchers.
 *
 * One fetcher per domain. Each returns a typed QIEPayload that becomes
 * ground-truth data for the LLM. The LLM NEVER queries the DB.
 *
 * Contract per spec:
 *   - data: Record<string, unknown>  (structured payload)
 *   - data_quality: full | partial | insufficient
 *   - data_quality_note?: string
 *   - suggested_followups: string[]
 *   - requires_confirmation?: boolean  (for action_request)
 *
 * Plus renderer helpers (summary, rendered) so the orchestrator can embed
 * the payload as a text block into the system prompt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { QIEClassification, QIEDomain, ExtractedEntities } from "./qieDomainClassifier";
import type { SystemContext, RosterAthleteStat } from "./contextBuilder";
import { isAgencyMandate } from "./contextBuilder";

export type DataQuality = "full" | "partial" | "insufficient";

export interface QIEPayload {
  domain: QIEDomain;
  data: Record<string, unknown>;
  data_quality: DataQuality;
  data_quality_note?: string;
  suggested_followups: string[];
  requires_confirmation?: boolean;
  /** Short human-readable headline, used by the LLM block header. */
  summary: string;
  /** Ready-to-embed text block injected into the system prompt. */
  rendered: string;
  /** When set, the LLM should ask this question before taking any action. */
  needs_clarification?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) =>
  n >= 1_000_000
    ? `€${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `€${Math.round(n / 1_000)}k`
      : `€${Math.round(n)}`;

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 864e5);
}

function parseWindow(text: string, now: Date): { from: Date; to: Date } | null {
  const t = text.toLowerCase();
  if (/settimana|week/.test(t)) return { from: now, to: new Date(now.getTime() + 7 * 864e5) };
  if (/mese|month/.test(t)) return { from: now, to: new Date(now.getTime() + 30 * 864e5) };
  if (/trimestre|quarter/.test(t)) return { from: now, to: new Date(now.getTime() + 90 * 864e5) };
  const daysMatch = t.match(/(\d+)\s*(giorni|gg|days)/);
  if (daysMatch) return { from: now, to: new Date(now.getTime() + parseInt(daysMatch[1], 10) * 864e5) };
  const monthMap: Record<string, number> = {
    gennaio: 0, january: 0, febbraio: 1, february: 1, marzo: 2, march: 2,
    aprile: 3, april: 3, maggio: 4, may: 4, giugno: 5, june: 5,
    luglio: 6, july: 6, agosto: 7, august: 7, settembre: 8, september: 8,
    ottobre: 9, october: 9, novembre: 10, november: 10, dicembre: 11, december: 11,
  };
  for (const [name, idx] of Object.entries(monthMap)) {
    if (t.includes(name)) {
      const y = now.getFullYear();
      return { from: new Date(y, idx, 1), to: new Date(y, idx + 1, 0, 23, 59, 59) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fetchers (16 total)
// ---------------------------------------------------------------------------

async function fetch_roster_overview(
  _supabase: SupabaseClient,
  _agencyId: string,
  _entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  const bySport: Record<string, number> = {};
  for (const a of ctx.roster.athletes) {
    const k = a.sport ?? "Altro";
    bySport[k] = (bySport[k] ?? 0) + 1;
  }
  const lines = [
    `Totale roster: ${ctx.roster.total} atleti (${ctx.roster.active} attivi).`,
    `Suddivisione per sport/categoria:`,
    ...Object.entries(bySport).sort((a, b) => b[1] - a[1]).map(([s, n]) => `- ${s}: ${n}`),
    `Monte contratti roster (attivi YTD): ${fmt(ctx.revenue.monte_deal_ytd)}.`,
  ];
  return {
    domain: "roster_overview",
    data: { total: ctx.roster.total, active: ctx.roster.active, by_sport: bySport },
    data_quality: ctx.roster.total > 0 ? "full" : "insufficient",
    data_quality_note: ctx.roster.total === 0 ? "Roster vuoto" : undefined,
    suggested_followups: [
      "Classifica roster per monte contratti",
      "Atleti senza contratti attivi",
    ],
    summary: `${ctx.roster.total} atleti (${ctx.roster.active} attivi)`,
    rendered: lines.join("\n"),
  };
}

async function fetch_athlete_detail(
  supabase: SupabaseClient,
  agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  if (entities.athlete_ids.length === 0) {
    return {
      domain: "athlete_detail",
      data: {},
      data_quality: "insufficient",
      data_quality_note: "Nessun atleta identificato nella query",
      suggested_followups: [],
      summary: "atleta non identificato",
      rendered: "Nessun atleta identificato nella query.",
      needs_clarification: "Di quale atleta/talent vuoi il profilo?",
    };
  }
  const id = entities.athlete_ids[0];
  const athleteStat = ctx.roster.athletes.find((a) => a.id === id);

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id, brand, contract_type, value, start_date, end_date, status, exclusivity_category, exclusivity_territory",
    )
    .eq("agency_id", agencyId)
    .eq("athlete_id", id)
    .order("end_date", { ascending: true });

  const { data: deals } = await supabase
    .from("deals")
    .select("id, brand, stage, value, probability, expected_close_date")
    .eq("agency_id", agencyId)
    .eq("athlete_id", id);

  type CRow = { brand: string; contract_type: string; value: number | string | null; start_date: string | null; end_date: string | null; status: string | null; exclusivity_category: string | null };
  type DRow = { brand: string; stage: string | null; value: number | string | null; probability: number | null };

  const activeContracts = (contracts as CRow[] | null ?? []).filter((c) => c.status === "active" || !c.status);
  const pipeline = (deals as DRow[] | null ?? []).filter((d) => d.stage !== "signed");

  const lines: string[] = [];
  lines.push(`ATLETA: ${athleteStat?.full_name ?? "?"}`);
  if (athleteStat) {
    lines.push(`Sport/cat: ${athleteStat.sport ?? "?"}${athleteStat.category ? " · " + athleteStat.category : ""}`);
    lines.push(`Social reach: ${athleteStat.social_reach.toLocaleString("it-IT")}`);
  }
  const totalContractValue = activeContracts.reduce((s, c) => s + (Number(c.value) || 0), 0);
  lines.push(`Contratti attivi: ${activeContracts.length} · valore totale ${fmt(totalContractValue)}`);
  for (const c of activeContracts.slice(0, 10)) {
    lines.push(
      `- ${c.brand} (${c.contract_type}) · ${fmt(Number(c.value) || 0)} · ${c.start_date} → ${c.end_date}${c.exclusivity_category ? ` · escl ${c.exclusivity_category}` : ""}`,
    );
  }
  lines.push(`Pipeline: ${pipeline.length} deal in corso`);
  for (const d of pipeline.slice(0, 5)) {
    lines.push(`- ${d.brand} [${d.stage}] · ${fmt(Number(d.value) || 0)} @${d.probability}%`);
  }

  return {
    domain: "athlete_detail",
    data: { athlete: athleteStat, contracts: activeContracts, pipeline },
    data_quality: athleteStat ? "full" : "partial",
    data_quality_note: athleteStat ? undefined : "Atleta presente in contratti ma non nel roster aggregato",
    suggested_followups: [
      `Scadenze contratti di ${athleteStat?.full_name ?? "questo atleta"}`,
      `Ci sono conflitti aperti su ${athleteStat?.full_name ?? "questo atleta"}?`,
    ],
    summary: `${athleteStat?.full_name ?? "atleta"} — ${activeContracts.length} contratti, ${pipeline.length} deal`,
    rendered: lines.join("\n"),
  };
}

async function fetch_athlete_ranking(
  _supabase: SupabaseClient,
  _agencyId: string,
  _entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  if (ctx.roster.athletes.length === 0) {
    return {
      domain: "athlete_ranking",
      data: { rankings: {} },
      data_quality: "insufficient",
      data_quality_note: "Roster vuoto",
      suggested_followups: [],
      summary: "roster vuoto",
      rendered: "Roster vuoto: nessun atleta da classificare.",
    };
  }

  const byValue = [...ctx.roster.athletes]
    .sort((a, b) => b.total_contract_value - a.total_contract_value)
    .slice(0, 10);
  const byReach = [...ctx.roster.athletes]
    .sort((a, b) => b.social_reach - a.social_reach)
    .slice(0, 10);
  const byPipeline = [...ctx.roster.athletes]
    .sort((a, b) => b.pipeline_weighted_value - a.pipeline_weighted_value)
    .slice(0, 10);

  // Median + delta vs median for top 3
  const values = ctx.roster.athletes.map((a) => a.total_contract_value).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : 0;
  const topThreeDelta = byValue.slice(0, 3).map((a) => ({
    name: a.full_name,
    value: a.total_contract_value,
    delta_vs_median: a.total_contract_value - median,
  }));

  const render = (title: string, list: RosterAthleteStat[], val: (a: RosterAthleteStat) => string) =>
    `${title}:\n${list.map((a, i) => `${i + 1}. ${a.full_name} — ${val(a)}`).join("\n")}`;

  const rendered = [
    render("TOP per monte contratti (valore attivo)", byValue, (a) => `${fmt(a.total_contract_value)} · ${a.active_contracts} contratti`),
    `\nMediana roster: ${fmt(median)}. Delta top 3 vs mediana:`,
    ...topThreeDelta.map((t) => `- ${t.name}: +${fmt(t.delta_vs_median)}`),
    "",
    render("TOP per reach social", byReach, (a) =>
      a.social_reach >= 1000 ? `${Math.round(a.social_reach / 1000)}K follower` : `${a.social_reach} follower`,
    ),
    "",
    render("TOP per pipeline ponderata", byPipeline, (a) => `${fmt(a.pipeline_weighted_value)} · ${a.pipeline_deals} deal`),
  ].join("\n");

  const quality: DataQuality = ctx.roster.athletes.length < 3 ? "partial" : "full";

  return {
    domain: "athlete_ranking",
    data: { by_value: byValue, by_reach: byReach, by_pipeline: byPipeline, median, top_three_delta: topThreeDelta },
    data_quality: quality,
    data_quality_note: quality === "partial" ? `Roster piccolo (n=${ctx.roster.athletes.length}): classifica poco significativa` : undefined,
    suggested_followups: [
      "Confronta i primi due per pipeline",
      "Chi ha più potenziale inesplorato (alta reach, bassi contratti)?",
    ],
    summary: `Top ${byValue.length} per valore/reach/pipeline`,
    rendered,
  };
}

async function fetch_contract_lookup(
  supabase: SupabaseClient,
  agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  if (entities.athlete_ids.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select(
        "id, brand, contract_type, value, start_date, end_date, status, exclusivity_category, obligations, penalties, renewal_clause, ai_extracted_clauses",
      )
      .eq("agency_id", agencyId)
      .in("athlete_id", entities.athlete_ids)
      .order("end_date", { ascending: false });

    type CRow = { brand: string; contract_type: string; value: number | string | null; start_date: string | null; end_date: string | null; status: string | null; ai_extracted_clauses: Record<string, unknown> | null };
    const items = ((contracts as CRow[] | null) ?? []).slice(0, 10);
    const athleteNames = entities.athlete_ids
      .map((id) => ctx.roster.athletes.find((a) => a.id === id)?.full_name)
      .filter((x): x is string => !!x);

    const lines: string[] = [];
    lines.push(`Contratti di ${athleteNames.join(", ")}: ${items.length}`);
    for (const c of items) {
      lines.push(`- ${c.brand} (${c.contract_type}) · ${fmt(Number(c.value) || 0)} · ${c.start_date}→${c.end_date} · ${c.status}`);
      if (entities.mentions_legal && c.ai_extracted_clauses) {
        const cl = c.ai_extracted_clauses as Record<string, unknown>;
        if (cl.exclusivity) lines.push(`  · esclusività: ${JSON.stringify(cl.exclusivity).slice(0, 160)}`);
        if (cl.penalties) lines.push(`  · penali: ${JSON.stringify(cl.penalties).slice(0, 160)}`);
        if (cl.obligations) lines.push(`  · obblighi: ${Array.isArray(cl.obligations) ? cl.obligations.join("; ").slice(0, 160) : JSON.stringify(cl.obligations).slice(0, 160)}`);
      }
    }

    return {
      domain: "contract_lookup",
      data: { contracts: items, athletes: athleteNames },
      data_quality: items.length > 0 ? "full" : "insufficient",
      data_quality_note: items.length === 0 ? `Nessun contratto per ${athleteNames.join(", ")}` : undefined,
      suggested_followups: [
        `Scadenze di ${athleteNames.join(", ")}`,
        `Conflitti attivi su ${athleteNames.join(", ")}`,
      ],
      summary: `${items.length} contratti per ${athleteNames.join(", ")}`,
      rendered: lines.join("\n"),
    };
  }

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, athlete_id, brand, contract_type, value, end_date, status")
    .eq("agency_id", agencyId)
    .eq("status", "active")
    .order("value", { ascending: false })
    .limit(20);

  type CRow = { athlete_id: string; brand: string; contract_type: string; value: number | string | null; end_date: string | null };
  const items = (contracts as CRow[] | null) ?? [];
  const lines: string[] = [];
  lines.push(`Contratti attivi totali: ${items.length}.`);
  for (const c of items) {
    const name = ctx.roster.athletes.find((a) => a.id === c.athlete_id)?.full_name ?? "?";
    lines.push(`- ${name} / ${c.brand} · ${fmt(Number(c.value) || 0)} · fino a ${c.end_date}`);
  }

  return {
    domain: "contract_lookup",
    data: { contracts: items },
    data_quality: items.length > 0 ? "full" : "insufficient",
    suggested_followups: ["Classifica per monte contratti", "Scadenze nei prossimi 60gg"],
    summary: `${items.length} contratti attivi`,
    rendered: lines.join("\n"),
  };
}

async function fetch_contract_expiry(
  supabase: SupabaseClient,
  agencyId: string,
  _entities: ExtractedEntities,
  ctx: SystemContext,
  rawText: string,
): Promise<QIEPayload> {
  const now = new Date();
  const win = parseWindow(rawText, now) ?? { from: now, to: new Date(now.getTime() + 60 * 864e5) };

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, athlete_id, brand, contract_type, value, end_date, status")
    .eq("agency_id", agencyId)
    .gte("end_date", win.from.toISOString().slice(0, 10))
    .lte("end_date", win.to.toISOString().slice(0, 10))
    .order("end_date", { ascending: true });

  type CRow = { athlete_id: string; brand: string; contract_type: string; value: number | string | null; end_date: string };
  const items = ((contracts as CRow[] | null) ?? []).map((c) => ({
    ...c,
    days: daysBetween(now, new Date(c.end_date)),
    athlete_name: ctx.roster.athletes.find((a) => a.id === c.athlete_id)?.full_name ?? "?",
    is_mandate: isAgencyMandate(c.contract_type),
  }));

  const lines: string[] = [];
  lines.push(
    `Scadenze tra ${win.from.toISOString().slice(0, 10)} e ${win.to.toISOString().slice(0, 10)}: ${items.length}`,
  );
  for (const c of items.slice(0, 15)) {
    lines.push(
      `- ${c.days}gg · ${c.athlete_name} / ${c.brand} (${c.is_mandate ? "MANDATO" : "DEAL"}) · ${fmt(Number(c.value) || 0)}`,
    );
  }

  return {
    domain: "contract_expiry",
    data: { window: { from: win.from.toISOString(), to: win.to.toISOString() }, items },
    data_quality: items.length > 0 ? "full" : "partial",
    data_quality_note: items.length === 0 ? "Nessuna scadenza nel range" : undefined,
    suggested_followups: ["Quali rinnovi sono prioritari?", "Chi ha penale di rescissione alta?"],
    summary: `${items.length} scadenze nel range`,
    rendered: lines.join("\n"),
  };
}

async function fetch_conflict_check(
  supabase: SupabaseClient,
  agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  // Two modes:
  //   (A) PROSPECTIVE — user asks "can X take a deal with brand in category Y?"
  //       => check athlete's active exclusivity vs proposed category
  //   (B) RETROSPECTIVE — user asks "what conflicts do I have?"
  //       => list open conflicts (optionally filtered by athlete)
  const hasProposedCategory = entities.categories.length > 0;
  const hasTargetAthlete = entities.athlete_ids.length === 1;

  if (hasProposedCategory && hasTargetAthlete) {
    const athleteId = entities.athlete_ids[0];
    const athleteName = ctx.roster.athletes.find((a) => a.id === athleteId)?.full_name ?? "?";
    const proposedCategory = entities.categories[0];

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, brand, contract_type, value, end_date, exclusivity_category, exclusivity_territory, status")
      .eq("agency_id", agencyId)
      .eq("athlete_id", athleteId)
      .eq("status", "active")
      .not("exclusivity_category", "is", null);

    type CRow = {
      id: string; brand: string; contract_type: string; value: number | string | null;
      end_date: string | null; exclusivity_category: string | null; exclusivity_territory: string | null;
    };
    const rows = (contracts as CRow[] | null) ?? [];
    const conflicting = rows.filter((c) =>
      c.exclusivity_category && c.exclusivity_category.toLowerCase().includes(proposedCategory),
    );
    const hasConflict = conflicting.length > 0;
    const severity: "high" | "medium" | "low" =
      hasConflict && conflicting.some((c) => Number(c.value) >= 50_000) ? "high" : hasConflict ? "medium" : "low";

    const lines: string[] = [];
    lines.push(
      `CHECK ESCLUSIVITÀ — "${athleteName}" può firmare deal in categoria "${proposedCategory}"?`,
    );
    if (hasConflict) {
      lines.push(`**CONFLITTO: SÌ** — ${conflicting.length} contratto/i attivo/i in conflitto:`);
      for (const c of conflicting) {
        lines.push(
          `- ${c.brand} (${c.contract_type}) · ${fmt(Number(c.value) || 0)} · esclusiva "${c.exclusivity_category}"${c.exclusivity_territory ? ` in ${c.exclusivity_territory}` : ""} · fino a ${c.end_date}`,
        );
      }
      lines.push(`Severità stimata: ${severity}. Suggerimento: verifica clausola esclusività e penale prima di procedere.`);
    } else {
      lines.push(`**CONFLITTO: NO** — ${athleteName} non ha esclusive attive in "${proposedCategory}".`);
    }

    return {
      domain: "conflict_check",
      data: {
        mode: "prospective",
        athlete: athleteName,
        proposed_category: proposedCategory,
        has_conflict: hasConflict,
        conflicting_contracts: conflicting,
        severity,
        suggestion: hasConflict
          ? "Verifica clausola esclusività (categoria, territorio, penale) nei contratti indicati."
          : `Nessuna esclusiva attiva in "${proposedCategory}": ${athleteName} può essere pitchato.`,
      },
      data_quality: "full",
      suggested_followups: hasConflict
        ? ["Qual è la penale del contratto in conflitto?", "Quando scade il contratto bloccante?"]
        : [`Quanto vale un deal medio in "${proposedCategory}"?`],
      summary: hasConflict ? `Conflitto SI (${severity})` : "Nessun conflitto",
      rendered: lines.join("\n"),
    };
  }

  // Retrospective: list open conflicts
  const { data: conflicts } = await supabase
    .from("conflicts")
    .select("id, severity, description, suggestion, status, contract_a_id, contract_b_id")
    .eq("agency_id", agencyId)
    .eq("status", "open");

  type KRow = { id: string; severity: string | null; description: string | null; suggestion: string | null; contract_a_id: string; contract_b_id: string | null };
  let filtered = (conflicts as KRow[] | null) ?? [];

  if (entities.athlete_ids.length > 0) {
    const { data: affected } = await supabase
      .from("contracts")
      .select("id, athlete_id")
      .eq("agency_id", agencyId)
      .in("athlete_id", entities.athlete_ids);
    type AR = { id: string; athlete_id: string };
    const ids = new Set(((affected as AR[] | null) ?? []).map((c) => c.id));
    filtered = filtered.filter((k) => ids.has(k.contract_a_id) || (k.contract_b_id !== null && ids.has(k.contract_b_id)));
  }

  const lines: string[] = [];
  lines.push(`Conflitti aperti: ${filtered.length}${entities.athlete_ids.length ? " (filtrati su atleta)" : ""}.`);
  for (const k of filtered.slice(0, 10)) {
    lines.push(`- [${k.severity}] ${k.description}${k.suggestion ? ` · suggerimento: ${k.suggestion}` : ""}`);
  }

  return {
    domain: "conflict_check",
    data: {
      mode: "retrospective",
      conflicts: filtered,
      total_open: ctx.conflicts.length,
    },
    data_quality: "full",
    suggested_followups: [
      "Qual è il conflitto più urgente da risolvere?",
      "Chi è l'atleta con più conflitti?",
    ],
    summary: `${filtered.length} conflitti aperti`,
    rendered: lines.join("\n"),
  };
}

async function fetch_deal_pipeline(
  supabase: SupabaseClient,
  agencyId: string,
  _entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  const { data: deals } = await supabase
    .from("deals")
    .select("id, athlete_id, brand, stage, value, probability, expected_close_date, updated_at")
    .eq("agency_id", agencyId)
    .neq("stage", "signed")
    .order("probability", { ascending: false })
    .limit(20);

  type DRow = { athlete_id: string; brand: string; stage: string; value: number | string | null; probability: number | null };
  const rows = (deals as DRow[] | null) ?? [];

  const lines: string[] = [];
  lines.push(`Pipeline CRM: ${ctx.pipeline.total_count} deal in corso · ponderato ${fmt(ctx.pipeline.total_weighted_value)}`);
  for (const s of ctx.pipeline.stages) {
    lines.push(`- ${s.stage}: ${s.count} deal · ${fmt(s.weighted_value)} ponderato`);
  }
  lines.push("Top deal per probabilità:");
  for (const d of rows.slice(0, 10)) {
    const name = ctx.roster.athletes.find((a) => a.id === d.athlete_id)?.full_name ?? "?";
    lines.push(`- ${name} / ${d.brand} [${d.stage}] · ${fmt(Number(d.value) || 0)} @${d.probability}%`);
  }

  return {
    domain: "deal_pipeline",
    data: { stages: ctx.pipeline.stages, top_deals: rows, total_weighted: ctx.pipeline.total_weighted_value },
    data_quality: ctx.pipeline.total_count > 0 ? "full" : "insufficient",
    suggested_followups: [
      "Quali deal sono a rischio stallo?",
      "Chi è il rappresentante più produttivo?",
    ],
    summary: `${ctx.pipeline.total_count} deal, ${fmt(ctx.pipeline.total_weighted_value)} ponderato`,
    rendered: lines.join("\n"),
  };
}

async function fetch_deal_detail(
  supabase: SupabaseClient,
  agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  const brandMatch = entities.brands.length > 0 ? entities.brands[0] : null;
  let query = supabase
    .from("deals")
    .select("id, athlete_id, brand, stage, value, probability, expected_close_date, notes, contact_name, contact_email, updated_at")
    .eq("agency_id", agencyId);
  if (brandMatch) query = query.ilike("brand", `%${brandMatch}%`);
  if (entities.athlete_ids.length > 0) query = query.in("athlete_id", entities.athlete_ids);
  const { data: deals } = await query.order("updated_at", { ascending: false }).limit(5);

  type DRow = { athlete_id: string; brand: string; stage: string; value: number | string | null; probability: number | null; expected_close_date: string | null; notes: string | null; contact_name: string | null; contact_email: string | null };
  const items = (deals as DRow[] | null) ?? [];
  if (items.length === 0) {
    return {
      domain: "deal_detail",
      data: { items: [] },
      data_quality: "insufficient",
      data_quality_note: "Nessun deal corrispondente",
      suggested_followups: ["Mostra tutta la pipeline", "Deal con brand simile"],
      summary: "nessun deal trovato",
      rendered: `Nessun deal trovato${brandMatch ? ` per brand "${brandMatch}"` : ""}${entities.athlete_ids.length ? " per gli atleti indicati" : ""}.`,
    };
  }

  const lines: string[] = [];
  for (const d of items) {
    const name = ctx.roster.athletes.find((a) => a.id === d.athlete_id)?.full_name ?? "?";
    lines.push(`DEAL ${d.brand} × ${name}`);
    lines.push(`Stage: ${d.stage} · Valore: ${fmt(Number(d.value) || 0)} · Probabilità: ${d.probability}%`);
    if (d.expected_close_date) lines.push(`Close atteso: ${d.expected_close_date}`);
    if (d.contact_name) lines.push(`Contatto: ${d.contact_name}${d.contact_email ? ` <${d.contact_email}>` : ""}`);
    if (d.notes) lines.push(`Note: ${String(d.notes).slice(0, 300)}`);
    lines.push("");
  }

  return {
    domain: "deal_detail",
    data: { deals: items },
    data_quality: "full",
    suggested_followups: [
      "Storico attività su questo deal",
      "Qual è la probabilità realistica di chiusura?",
    ],
    summary: `${items.length} deal trovati`,
    rendered: lines.join("\n"),
  };
}

async function fetch_revenue_query(
  supabase: SupabaseClient,
  agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  if (entities.athlete_ids.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, brand, value, status, start_date, end_date, commission_type, commission_value")
      .eq("agency_id", agencyId)
      .in("athlete_id", entities.athlete_ids);

    type CRow = { brand: string; value: number | string | null; status: string | null; commission_type: string | null; commission_value: number | string | null };
    const all = (contracts as CRow[] | null) ?? [];
    const active = all.filter((c) => c.status === "active" || !c.status);
    const total = active.reduce((s, c) => s + (Number(c.value) || 0), 0);
    const commission = active.reduce((s, c) => {
      const t = c.commission_type || ctx.agency.defaultCommissionType;
      const v = c.commission_value ?? ctx.agency.defaultCommissionValue;
      return s + (t === "fixed" ? Number(v) : ((Number(c.value) || 0) * Number(v)) / 100);
    }, 0);

    const names = entities.athlete_ids
      .map((id) => ctx.roster.athletes.find((a) => a.id === id)?.full_name)
      .filter((x): x is string => !!x);

    return {
      domain: "revenue_query",
      data: { athletes: names, monte: total, commissioni: commission, contracts: active, count: active.length },
      data_quality: active.length > 0 ? "full" : "insufficient",
      suggested_followups: [
        `Commissioni YTD agenzia vs ${names.join(", ")}`,
        `Quanto potrebbe generare ${names.join(", ")} con il brand X?`,
      ],
      summary: `${names.join(", ")}: ${fmt(total)} monte · ${fmt(commission)} commissioni`,
      rendered: [
        `${names.join(", ")} — ${active.length} contratti attivi`,
        `Monte deal: ${fmt(total)}`,
        `Commissioni stimate: ${fmt(commission)}`,
        ...active.map((c) => `- ${c.brand}: ${fmt(Number(c.value) || 0)}`),
      ].join("\n"),
    };
  }

  return {
    domain: "revenue_query",
    data: {
      monte_deal_ytd: ctx.revenue.monte_deal_ytd,
      active_brand_deal_count: ctx.revenue.active_brand_deal_count,
      estimated_commissions_ytd: ctx.revenue.estimated_commissions_ytd,
      pipeline_weighted: ctx.pipeline.total_weighted_value,
    },
    data_quality: ctx.revenue.active_brand_deal_count > 0 ? "full" : "insufficient",
    suggested_followups: ["Chi genera più commissioni?", "Revenue per quarter"],
    summary: `Monte YTD ${fmt(ctx.revenue.monte_deal_ytd)}`,
    rendered: [
      "Revenue agenzia — YTD",
      `Monte deal attivi: ${fmt(ctx.revenue.monte_deal_ytd)} (${ctx.revenue.active_brand_deal_count} deal brand)`,
      `Commissioni stimate YTD: ${fmt(ctx.revenue.estimated_commissions_ytd)}`,
      `Pipeline ponderata (non firmata): ${fmt(ctx.pipeline.total_weighted_value)}`,
    ].join("\n"),
  };
}

async function fetch_campaign_status(
  supabase: SupabaseClient,
  agencyId: string,
  _entities: ExtractedEntities,
  _ctx: SystemContext,
): Promise<QIEPayload> {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, brand, status, start_date, end_date")
    .eq("agency_id", agencyId)
    .order("updated_at", { ascending: false })
    .limit(10);

  type CampaignRow = { id: string; name: string | null; brand: string; status: string | null };
  const camps = (campaigns as CampaignRow[] | null) ?? [];
  const ids = camps.map((c) => c.id);
  const deliverableStats: Record<string, { total: number; approved: number; posted: number; pending: number }> = {};
  if (ids.length) {
    const { data: dels } = await supabase
      .from("campaign_deliverables")
      .select("campaign_id, status")
      .in("campaign_id", ids);
    type DelRow = { campaign_id: string; status: string | null };
    for (const d of (dels as DelRow[] | null) ?? []) {
      const k = d.campaign_id;
      deliverableStats[k] ??= { total: 0, approved: 0, posted: 0, pending: 0 };
      deliverableStats[k].total++;
      if (d.status === "approved") deliverableStats[k].approved++;
      else if (d.status === "posted") deliverableStats[k].posted++;
      else deliverableStats[k].pending++;
    }
  }

  const lines: string[] = [];
  lines.push(`Campagne recenti: ${camps.length}.`);
  for (const c of camps) {
    const s = deliverableStats[c.id] ?? { total: 0, approved: 0, posted: 0, pending: 0 };
    lines.push(
      `- ${c.name ?? c.brand} [${c.status ?? "?"}] · ${s.posted}/${s.total} post · ${s.approved} approvati · ${s.pending} da fare`,
    );
  }

  return {
    domain: "campaign_status",
    data: { campaigns: camps, deliverable_stats: deliverableStats },
    data_quality: camps.length > 0 ? "full" : "insufficient",
    suggested_followups: ["Quale campagna è in ritardo?", "Deliverable da approvare questa settimana"],
    summary: `${camps.length} campagne`,
    rendered: lines.join("\n"),
  };
}

async function fetch_exclusivity_check(
  supabase: SupabaseClient,
  agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, athlete_id, brand, contract_type, exclusivity_category, exclusivity_territory, end_date, status")
    .eq("agency_id", agencyId)
    .eq("status", "active")
    .not("exclusivity_category", "is", null);

  type CRow = { id: string; athlete_id: string; brand: string; exclusivity_category: string | null; exclusivity_territory: string | null; end_date: string | null };
  const rows = ((contracts as CRow[] | null) ?? []).map((c) => ({
    ...c,
    athlete_name: ctx.roster.athletes.find((a) => a.id === c.athlete_id)?.full_name ?? "?",
  }));

  let filtered = rows;
  if (entities.categories.length > 0) {
    const cat = entities.categories[0];
    filtered = rows.filter((c) => c.exclusivity_category && c.exclusivity_category.toLowerCase().includes(cat));
  }
  if (entities.athlete_ids.length > 0) {
    filtered = filtered.filter((c) => entities.athlete_ids.includes(c.athlete_id));
  }

  const lines: string[] = [];
  lines.push(`Esclusive attive: ${filtered.length} (roster agenzia).`);
  for (const c of filtered.slice(0, 15)) {
    lines.push(
      `- ${c.athlete_name} → ${c.brand} · categoria "${c.exclusivity_category}"${c.exclusivity_territory ? ` in ${c.exclusivity_territory}` : ""} · fino a ${c.end_date}`,
    );
  }

  return {
    domain: "exclusivity_check",
    data: { exclusivities: filtered, filter: { category: entities.categories[0] ?? null, athletes: entities.athlete_ids } },
    data_quality: "full",
    suggested_followups: entities.categories.length
      ? [`Atleti LIBERI in "${entities.categories[0]}"?`]
      : ["Quali categorie sono sature?"],
    summary: `${filtered.length} esclusive`,
    rendered: lines.join("\n"),
  };
}

async function fetch_deadline_alert(
  _supabase: SupabaseClient,
  _agencyId: string,
  _entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  const urgent = ctx.deadlines.next_30d.filter((d) => d.days_remaining <= 14);
  const week = ctx.deadlines.next_30d.filter((d) => d.days_remaining > 14);

  const lines: string[] = [];
  lines.push(`URGENTI ≤14gg: ${urgent.length}`);
  for (const d of urgent.slice(0, 10)) {
    lines.push(`- ${d.days_remaining}gg · ${d.athlete_name} / ${d.brand} · ${d.value ? fmt(d.value) : "—"}`);
  }
  lines.push(`\nENTRO 30gg: ${week.length}`);
  for (const d of week.slice(0, 8)) {
    lines.push(`- ${d.days_remaining}gg · ${d.athlete_name} / ${d.brand}`);
  }
  if (ctx.conflicts.length > 0) {
    lines.push(`\nCONFLITTI APERTI DA GESTIRE: ${ctx.conflicts.length}`);
    for (const k of ctx.conflicts.slice(0, 3)) {
      lines.push(`- [${k.severity}] ${k.athlete_name ?? "?"} — ${k.brands.join(" vs ")}`);
    }
  }

  return {
    domain: "deadline_alert",
    data: { urgent, week, conflicts: ctx.conflicts },
    data_quality: "full",
    suggested_followups: ["Quale scadenza è più rischiosa per il fatturato?", "Chi dovrei chiamare per primo?"],
    summary: `${urgent.length} urgenti, ${week.length} entro 30gg`,
    rendered: lines.join("\n"),
  };
}

async function fetch_comparison(
  _supabase: SupabaseClient,
  _agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
): Promise<QIEPayload> {
  if (entities.athlete_ids.length < 2) {
    return {
      domain: "comparison",
      data: { subjects: [] },
      data_quality: "insufficient",
      data_quality_note: "Confronto richiede almeno 2 atleti identificati",
      suggested_followups: [],
      summary: "confronto ambiguo",
      rendered: "Per confrontare servono almeno due atleti identificati.",
      needs_clarification: "Quali due (o più) atleti vuoi confrontare?",
    };
  }

  const subjects = entities.athlete_ids
    .map((id) => ctx.roster.athletes.find((a) => a.id === id))
    .filter((x): x is RosterAthleteStat => !!x);

  const lines: string[] = [];
  lines.push(`CONFRONTO (${subjects.length} atleti)`);
  for (const s of subjects) {
    lines.push(
      `- ${s.full_name}: monte ${fmt(s.total_contract_value)} · ${s.active_contracts} contratti · reach ${s.social_reach.toLocaleString("it-IT")} · pipeline ${fmt(s.pipeline_weighted_value)} (${s.pipeline_deals})`,
    );
  }
  const byValue = [...subjects].sort((a, b) => b.total_contract_value - a.total_contract_value)[0];
  const byReach = [...subjects].sort((a, b) => b.social_reach - a.social_reach)[0];
  const byPipe = [...subjects].sort((a, b) => b.pipeline_weighted_value - a.pipeline_weighted_value)[0];
  lines.push(`\nLEADER: valore=${byValue.full_name} · reach=${byReach.full_name} · pipeline=${byPipe.full_name}`);

  return {
    domain: "comparison",
    data: { subjects, leaders: { by_value: byValue, by_reach: byReach, by_pipeline: byPipe } },
    data_quality: "full",
    suggested_followups: ["Qual è l'atleta con più margine di crescita?", "Confronto storico revenue"],
    summary: `confronto ${subjects.length} atleti`,
    rendered: lines.join("\n"),
  };
}

async function fetch_market_intel(
  supabase: SupabaseClient,
  agencyId: string,
  _entities: ExtractedEntities,
  _ctx: SystemContext,
): Promise<QIEPayload> {
  const { data: all } = await supabase
    .from("contracts")
    .select("id, contract_type, value, exclusivity_category, start_date")
    .eq("agency_id", agencyId)
    .eq("status", "active");

  type CRow = { contract_type: string | null; value: number | string | null };
  const rows = (all as CRow[] | null) ?? [];
  const values = rows.map((c) => Number(c.value) || 0).filter((v) => v > 0).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : 0;
  const p25 = values.length ? values[Math.floor(values.length * 0.25)] : 0;
  const p75 = values.length ? values[Math.floor(values.length * 0.75)] : 0;
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

  const byType: Record<string, number[]> = {};
  for (const c of rows) {
    const k = (c.contract_type || "generic").toLowerCase();
    byType[k] ??= [];
    if (Number(c.value)) byType[k].push(Number(c.value));
  }
  const typeMedians = Object.entries(byType).map(([k, arr]) => {
    const s = [...arr].sort((a, b) => a - b);
    return { type: k, n: arr.length, median: s[Math.floor(s.length / 2)] ?? 0 };
  });

  const isInsufficient = values.length < 5;

  const lines: string[] = [];
  lines.push(`BENCHMARK INTERNO (agenzia) — base: ${values.length} contratti attivi`);
  if (isInsufficient) {
    lines.push(`⚠ Dataset insufficiente (n=${values.length} < 5): il benchmark è solo indicativo.`);
  }
  lines.push(`Mediana: ${fmt(median)} · P25: ${fmt(p25)} · P75: ${fmt(p75)} · Media: ${fmt(avg)}`);
  lines.push(`Per tipo contratto:`);
  for (const t of typeMedians.sort((a, b) => b.n - a.n).slice(0, 6)) {
    lines.push(`- ${t.type}: mediana ${fmt(t.median)} (n=${t.n})`);
  }
  lines.push(`\nNOTA: benchmark interno — non ho dati di mercato esterni per confrontare con altre agenzie.`);

  return {
    domain: "market_intel",
    data: { median, p25, p75, avg, n: values.length, by_type: typeMedians },
    data_quality: isInsufficient ? "insufficient" : "full",
    data_quality_note: isInsufficient ? `Solo ${values.length} deal comparabili nel DB (<5): stima indicativa` : undefined,
    suggested_followups: [
      "Vuoi un confronto con un tipo di contratto specifico?",
      "Qual è il contratto più recente di questo tipo?",
    ],
    summary: `Mediana interna ${fmt(median)}${isInsufficient ? " (dataset piccolo)" : ""}`,
    rendered: lines.join("\n"),
  };
}

// --- Action intent parsing (for action_request) ----------------------------
interface ActionIntent {
  action_type: "create" | "update" | "delete" | "assign" | "unknown";
  entity: "contract" | "athlete" | "deal" | "campaign" | "deliverable" | "unknown";
  parameters: Record<string, unknown>;
  preview_description: string;
}

function parseActionIntent(text: string, entities: ExtractedEntities): ActionIntent {
  const t = text.toLowerCase();
  let action: ActionIntent["action_type"] = "unknown";
  if (/\b(crea|nuovo|add|create|aggiungi)\b/i.test(t)) action = "create";
  else if (/\b(aggiorna|update|sposta|cambia|modifica|segna come|flagga|mark as|salva)\b/i.test(t)) action = "update";
  else if (/\b(elimina|delete|rimuovi|cancella|remove)\b/i.test(t)) action = "delete";
  else if (/\b(assegna|assign)\b/i.test(t)) action = "assign";

  let entity: ActionIntent["entity"] = "unknown";
  if (/\bcontratt|contract\b/i.test(t)) entity = "contract";
  else if (/\batlet|talent|athlete\b/i.test(t)) entity = "athlete";
  else if (/\bdeal|trattativa\b/i.test(t)) entity = "deal";
  else if (/\bcampagna|campaign\b/i.test(t)) entity = "campaign";
  else if (/\bdeliverable|post\b/i.test(t)) entity = "deliverable";

  const parameters: Record<string, unknown> = {};
  if (entities.athlete_ids.length > 0) parameters.athlete_ids = entities.athlete_ids;
  if (entities.brands.length > 0) parameters.brands = entities.brands;
  if (entities.numbers.length > 0) parameters.numbers = entities.numbers;
  if (entities.categories.length > 0) parameters.categories = entities.categories;

  const preview_description = `${action === "unknown" ? "Azione" : action.toUpperCase()} su ${entity === "unknown" ? "entità non chiara" : entity}`
    + (entities.athlete_ids.length ? ` · atleti: ${entities.athlete_ids.length}` : "")
    + (entities.brands.length ? ` · brand: ${entities.brands.slice(0, 3).join(", ")}` : "");

  return { action_type: action, entity, parameters, preview_description };
}

async function fetch_action_request(
  _supabase: SupabaseClient,
  _agencyId: string,
  entities: ExtractedEntities,
  _ctx: SystemContext,
  rawText: string,
): Promise<QIEPayload> {
  const intent = parseActionIntent(rawText, entities);
  const rendered = [
    `AZIONE RICHIESTA — conferma necessaria:`,
    `- Tipo: ${intent.action_type}`,
    `- Entità: ${intent.entity}`,
    `- Preview: ${intent.preview_description}`,
    `- Parametri rilevati: ${JSON.stringify(intent.parameters)}`,
    ``,
    `Non eseguire: mostra all'utente questo intent e chiedi "procedo?" prima di qualsiasi scrittura.`,
    `Se l'intent è ambiguo (entity=unknown o action=unknown), chiedi chiarimento.`,
  ].join("\n");

  return {
    domain: "action_request",
    data: { intent },
    data_quality: intent.action_type === "unknown" || intent.entity === "unknown" ? "insufficient" : "full",
    data_quality_note: intent.action_type === "unknown" ? "Intent di azione non riconosciuto" : undefined,
    suggested_followups: [],
    requires_confirmation: true,
    summary: `AZIONE: ${intent.action_type} ${intent.entity}`,
    rendered,
    needs_clarification:
      intent.action_type === "unknown" || intent.entity === "unknown"
        ? "Vuoi creare, aggiornare o eliminare? E su quale entità (contratto/atleta/deal/campagna)?"
        : "Confermi l'azione?",
  };
}

async function fetch_general_conversation(
  _supabase: SupabaseClient,
  _agencyId: string,
  _entities: ExtractedEntities,
  _ctx: SystemContext,
): Promise<QIEPayload> {
  return {
    domain: "general_conversation",
    data: {},
    data_quality: "full",
    suggested_followups: [],
    summary: "conversazione libera",
    rendered: "",
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

type Fetcher = (
  supabase: SupabaseClient,
  agencyId: string,
  entities: ExtractedEntities,
  ctx: SystemContext,
  rawText: string,
) => Promise<QIEPayload>;

const DISPATCH: Record<QIEDomain, Fetcher> = {
  roster_overview: fetch_roster_overview,
  athlete_detail: fetch_athlete_detail,
  athlete_ranking: fetch_athlete_ranking,
  contract_lookup: fetch_contract_lookup,
  contract_expiry: fetch_contract_expiry,
  conflict_check: fetch_conflict_check,
  deal_pipeline: fetch_deal_pipeline,
  deal_detail: fetch_deal_detail,
  revenue_query: fetch_revenue_query,
  campaign_status: fetch_campaign_status,
  exclusivity_check: fetch_exclusivity_check,
  deadline_alert: fetch_deadline_alert,
  comparison: fetch_comparison,
  market_intel: fetch_market_intel,
  action_request: fetch_action_request,
  general_conversation: fetch_general_conversation,
};

export async function runQIEFetch(
  supabase: SupabaseClient,
  agencyId: string,
  classification: QIEClassification,
  ctx: SystemContext,
  rawText: string,
): Promise<QIEPayload> {
  try {
    const fn = DISPATCH[classification.domain];
    return await fn(supabase, agencyId, classification.entities, ctx, rawText);
  } catch (e) {
    console.error("[qie-fetch]", classification.domain, e);
    return {
      domain: classification.domain,
      data: {},
      data_quality: "insufficient",
      data_quality_note: "Errore interno recupero dati",
      suggested_followups: [],
      summary: "errore fetch",
      rendered: `Errore interno nel recupero dati per ${classification.domain}. Rispondi dal contesto generale.`,
    };
  }
}

/**
 * Run a chain of domains for multi-step queries. Aggregates rendered blocks
 * and bubbles up the worst data_quality signal of the chain.
 */
export async function runQIEChain(
  supabase: SupabaseClient,
  agencyId: string,
  chain: QIEDomain[],
  classification: QIEClassification,
  ctx: SystemContext,
  rawText: string,
): Promise<QIEPayload> {
  if (chain.length <= 1) {
    return runQIEFetch(supabase, agencyId, classification, ctx, rawText);
  }

  const parts: QIEPayload[] = [];
  for (const d of chain) {
    const fn = DISPATCH[d];
    try {
      const p = await fn(supabase, agencyId, classification.entities, ctx, rawText);
      parts.push(p);
    } catch (e) {
      console.error("[qie-chain]", d, e);
    }
  }

  const rendered = parts.map((p, i) => `### STEP ${i + 1} — ${p.domain}\n${p.rendered}`).join("\n\n");
  const followups = Array.from(new Set(parts.flatMap((p) => p.suggested_followups))).slice(0, 4);
  const worstQuality: DataQuality = parts.some((p) => p.data_quality === "insufficient")
    ? "insufficient"
    : parts.some((p) => p.data_quality === "partial")
      ? "partial"
      : "full";
  const clarification = parts.find((p) => p.needs_clarification)?.needs_clarification;
  const requires = parts.some((p) => p.requires_confirmation);

  return {
    domain: classification.domain,
    data: { chain: parts.map((p) => ({ domain: p.domain, data: p.data })) },
    data_quality: worstQuality,
    data_quality_note: parts.map((p) => p.data_quality_note).filter(Boolean).join(" · ") || undefined,
    suggested_followups: followups,
    requires_confirmation: requires,
    summary: `chain: ${chain.join(" → ")}`,
    rendered,
    needs_clarification: clarification,
  };
}
