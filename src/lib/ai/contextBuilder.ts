/**
 * Taura AI — Context builder.
 *
 * buildSystemContext() produces a structured snapshot of the agency's live
 * state, fetched in parallel with per-query error isolation. Called ONCE
 * per conversation session (result cached upstream per thread).
 *
 * Accepts any SupabaseClient (browser anon client OR edge-function service-role
 * client) — caller decides which client to pass based on auth context.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AgencyProfile {
  id: string;
  name: string;
  type: "sport" | "influencer" | "talent" | "mixed" | "unknown";
  plan: string;
  defaultCommissionType: "pct" | "fixed";
  defaultCommissionValue: number;
}

export interface RosterAthleteStat {
  id: string;
  full_name: string;
  sport: string | null;
  category: string | null;
  status: string | null;
  active_contracts: number;
  total_contract_value: number;
  dominant_exclusivities: string[];
  social_reach: number;
  pipeline_deals: number;
  pipeline_weighted_value: number;
}

export interface ConflictSummary {
  id: string;
  severity: "high" | "medium" | "low";
  description: string;
  athlete_name: string | null;
  brands: string[];
}

export interface DeadlineSummary {
  contract_id: string;
  brand: string;
  athlete_name: string | null;
  end_date: string;
  days_remaining: number;
  value: number | null;
  is_agency_mandate: boolean;
}

export interface PipelineStageSummary {
  stage: string;
  count: number;
  total_value: number;
  weighted_value: number;
}

/** Structured snapshot passed to the LLM via the system prompt template. */
export interface SystemContext {
  agency: AgencyProfile;
  roster: {
    total: number;
    active: number;
    athletes: RosterAthleteStat[];
  };
  conflicts: ConflictSummary[];
  deadlines: {
    next_30d: DeadlineSummary[];
    next_90d_count: number;
  };
  pipeline: {
    stages: PipelineStageSummary[];
    total_count: number;
    total_weighted_value: number;
  };
  revenue: {
    monte_deal_ytd: number;
    active_brand_deal_count: number;
    estimated_commissions_ytd: number;
  };
  /** Sections that failed to fetch, for telemetry. Never blocks the chat. */
  unavailable_sections: string[];
  generated_at: string;
}

/** Legacy alias retained for edge-function imports that were using it. */
export type TauraContext = SystemContext;

const AGENCY_AGREEMENT_TYPES = [
  "esclusiva",
  "accordo",
  "mandato",
  "rappresentanza",
  "agenzia",
  "gestione",
];

export function isAgencyMandate(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return AGENCY_AGREEMENT_TYPES.some((k) => t.includes(k));
}

function inferAgencyType(sector: string | null): AgencyProfile["type"] {
  if (!sector) return "unknown";
  const s = sector.toLowerCase();
  if (s.includes("sport")) return "sport";
  if (s.includes("influenc") || s.includes("creator") || s.includes("talent")) return "influencer";
  if (s.includes("mix") || s.includes("multi")) return "mixed";
  return "unknown";
}

async function safeQuery<T>(
  fn: () => Promise<{ data: T | null; error: unknown }>,
  fallback: T,
  label: string,
  unavailable: string[],
): Promise<T> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.warn(`[contextBuilder] ${label}:`, error);
      unavailable.push(label);
      return fallback;
    }
    return (data as T) ?? fallback;
  } catch (e) {
    console.warn(`[contextBuilder] ${label} threw:`, e);
    unavailable.push(label);
    return fallback;
  }
}

type AthleteRow = {
  id: string;
  full_name: string;
  sport: string | null;
  category: string | null;
  status: string | null;
  instagram_followers: number | null;
  tiktok_followers: number | null;
  youtube_followers: number | null;
};

type ContractRow = {
  id: string;
  athlete_id: string;
  brand: string;
  contract_type: string;
  value: number | string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  exclusivity_category: string | null;
  exclusivity_territory: string | null;
  commission_type: string | null;
  commission_value: number | string | null;
};

type DealRow = {
  id: string;
  athlete_id: string;
  brand: string;
  value: number | string | null;
  stage: string | null;
  probability: number | null;
  expected_close_date: string | null;
};

type ConflictRow = {
  id: string;
  severity: string | null;
  description: string | null;
  status: string | null;
  contract_a_id: string;
  contract_b_id: string | null;
};

type AgencyRow = {
  id: string;
  name: string | null;
  plan: string | null;
  sport_sector: string | null;
  default_commission_type: string | null;
  default_commission_value: number | string | null;
};

/**
 * Build the full context snapshot for an agency.
 *
 * Never throws: if any fetch fails, that section is filled with defaults and
 * added to `unavailable_sections`. A partial context is better than a broken
 * chat.
 */
export async function buildSystemContext(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<SystemContext> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const unavailable: string[] = [];

  const [agencyRes, athletesRes, contractsRes, conflictsRes, dealsRes] = await Promise.all([
    safeQuery<AgencyRow | null>(
      () =>
        supabase
          .from("agencies")
          .select("id, name, plan, sport_sector, default_commission_type, default_commission_value")
          .eq("id", agencyId)
          .maybeSingle() as unknown as Promise<{ data: AgencyRow | null; error: unknown }>,
      null,
      "agencies",
      unavailable,
    ),
    safeQuery<AthleteRow[]>(
      () =>
        supabase
          .from("athletes")
          .select("id, full_name, sport, category, status, instagram_followers, tiktok_followers, youtube_followers")
          .eq("agency_id", agencyId) as unknown as Promise<{ data: AthleteRow[]; error: unknown }>,
      [],
      "athletes",
      unavailable,
    ),
    safeQuery<ContractRow[]>(
      () =>
        supabase
          .from("contracts")
          .select(
            "id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category, exclusivity_territory, commission_type, commission_value",
          )
          .eq("agency_id", agencyId) as unknown as Promise<{ data: ContractRow[]; error: unknown }>,
      [],
      "contracts",
      unavailable,
    ),
    safeQuery<ConflictRow[]>(
      () =>
        supabase
          .from("conflicts")
          .select("id, severity, description, status, contract_a_id, contract_b_id")
          .eq("agency_id", agencyId)
          .eq("status", "open") as unknown as Promise<{ data: ConflictRow[]; error: unknown }>,
      [],
      "conflicts",
      unavailable,
    ),
    safeQuery<DealRow[]>(
      () =>
        supabase
          .from("deals")
          .select("id, athlete_id, brand, value, stage, probability, expected_close_date")
          .eq("agency_id", agencyId) as unknown as Promise<{ data: DealRow[]; error: unknown }>,
      [],
      "deals",
      unavailable,
    ),
  ]);

  const agency: AgencyProfile = {
    id: agencyId,
    name: agencyRes?.name ?? "Agenzia",
    type: inferAgencyType(agencyRes?.sport_sector ?? null),
    plan: agencyRes?.plan ?? "starter",
    defaultCommissionType: agencyRes?.default_commission_type === "fixed" ? "fixed" : "pct",
    defaultCommissionValue: Number(agencyRes?.default_commission_value ?? 15),
  };

  const contracts = contractsRes ?? [];
  const athletesList = athletesRes ?? [];
  const deals = dealsRes ?? [];
  const conflicts = conflictsRes ?? [];

  const athleteMap = new Map<string, AthleteRow>();
  for (const a of athletesList) athleteMap.set(a.id, a);

  const contractsByAthlete = new Map<string, ContractRow[]>();
  for (const c of contracts) {
    const list = contractsByAthlete.get(c.athlete_id) ?? [];
    list.push(c);
    contractsByAthlete.set(c.athlete_id, list);
  }

  const dealsByAthlete = new Map<string, DealRow[]>();
  for (const d of deals) {
    const list = dealsByAthlete.get(d.athlete_id) ?? [];
    list.push(d);
    dealsByAthlete.set(d.athlete_id, list);
  }

  // Roster stats per athlete
  const rosterAthletes: RosterAthleteStat[] = athletesList.map((a) => {
    const aContracts = contractsByAthlete.get(a.id) ?? [];
    const active = aContracts.filter((c) => c.status === "active" || !c.status);
    const excl = Array.from(
      new Set(active.map((c) => c.exclusivity_category).filter((x): x is string => !!x)),
    );
    const totalValue = active.reduce((s, c) => s + (Number(c.value) || 0), 0);
    const aDeals = (dealsByAthlete.get(a.id) ?? []).filter((d) => d.stage !== "signed");
    const pipelineWeighted = aDeals.reduce(
      (s, d) => s + ((Number(d.value) || 0) * (Number(d.probability) || 50)) / 100,
      0,
    );
    const social =
      (a.instagram_followers ?? 0) + (a.tiktok_followers ?? 0) + (a.youtube_followers ?? 0);

    return {
      id: a.id,
      full_name: a.full_name,
      sport: a.sport,
      category: a.category,
      status: a.status,
      active_contracts: active.length,
      total_contract_value: totalValue,
      dominant_exclusivities: excl.slice(0, 3),
      social_reach: social,
      pipeline_deals: aDeals.length,
      pipeline_weighted_value: pipelineWeighted,
    };
  });

  // Conflicts enriched with athlete names
  const contractById = new Map<string, ContractRow>();
  for (const c of contracts) contractById.set(c.id, c);

  const conflictSummary: ConflictSummary[] = conflicts.map((k) => {
    const ca = contractById.get(k.contract_a_id);
    const cb = k.contract_b_id ? contractById.get(k.contract_b_id) : null;
    const athlete = ca ? athleteMap.get(ca.athlete_id) : null;
    const brands = [ca?.brand, cb?.brand].filter((x): x is string => !!x);
    const sev = (k.severity ?? "low").toLowerCase();
    const severity: ConflictSummary["severity"] =
      sev === "high" || sev === "medium" || sev === "low" ? (sev as ConflictSummary["severity"]) : "low";
    return {
      id: k.id,
      severity,
      description: k.description ?? "",
      athlete_name: athlete?.full_name ?? null,
      brands,
    };
  });

  // Deadlines
  const allDeadlines: DeadlineSummary[] = contracts
    .filter((c): c is ContractRow & { end_date: string } => !!c.end_date)
    .map((c) => {
      const end = new Date(c.end_date);
      const days = Math.ceil((end.getTime() - now.getTime()) / 864e5);
      return {
        contract_id: c.id,
        brand: c.brand,
        athlete_name: athleteMap.get(c.athlete_id)?.full_name ?? null,
        end_date: c.end_date,
        days_remaining: days,
        value: c.value != null ? Number(c.value) : null,
        is_agency_mandate: isAgencyMandate(c.contract_type),
      };
    })
    .filter((d) => d.days_remaining >= 0)
    .sort((a, b) => a.days_remaining - b.days_remaining);

  const deadlines30 = allDeadlines.filter((d) => d.days_remaining <= 30);
  const deadlines90Count = allDeadlines.filter((d) => d.days_remaining <= 90).length;

  // Pipeline stages
  const stageBucket: Record<string, { count: number; total_value: number; weighted_value: number }> = {};
  for (const d of deals) {
    if (d.stage === "signed") continue;
    const k = d.stage || "inbound";
    stageBucket[k] ??= { count: 0, total_value: 0, weighted_value: 0 };
    const v = Number(d.value) || 0;
    const p = Number(d.probability) || 50;
    stageBucket[k].count++;
    stageBucket[k].total_value += v;
    stageBucket[k].weighted_value += (v * p) / 100;
  }
  const stages: PipelineStageSummary[] = Object.entries(stageBucket).map(([stage, v]) => ({ stage, ...v }));
  const pipelineTotalCount = stages.reduce((s, x) => s + x.count, 0);
  const pipelineTotalWeighted = stages.reduce((s, x) => s + x.weighted_value, 0);

  // Revenue YTD: brand deals started this year, active
  const brandDeals = contracts.filter((c) => !isAgencyMandate(c.contract_type));
  const ytdBrandDeals = brandDeals.filter((c) => {
    if (!c.start_date) return false;
    return new Date(c.start_date) >= new Date(yearStart);
  });
  const activeBrandDeals = ytdBrandDeals.filter((c) => c.status === "active" || !c.status);
  const monteDealYtd = activeBrandDeals.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const commissionsYtd = activeBrandDeals.reduce((s, c) => {
    const type = c.commission_type || agency.defaultCommissionType;
    const val = c.commission_value ?? agency.defaultCommissionValue;
    const v = type === "fixed" ? Number(val) : ((Number(c.value) || 0) * Number(val)) / 100;
    return s + v;
  }, 0);

  return {
    agency,
    roster: {
      total: rosterAthletes.length,
      active: rosterAthletes.filter((a) => a.status === "active").length,
      athletes: rosterAthletes,
    },
    conflicts: conflictSummary,
    deadlines: { next_30d: deadlines30, next_90d_count: deadlines90Count },
    pipeline: {
      stages,
      total_count: pipelineTotalCount,
      total_weighted_value: pipelineTotalWeighted,
    },
    revenue: {
      monte_deal_ytd: monteDealYtd,
      active_brand_deal_count: activeBrandDeals.length,
      estimated_commissions_ytd: commissionsYtd,
    },
    unavailable_sections: unavailable,
    generated_at: now.toISOString(),
  };
}

/**
 * Serialize SystemContext into a compact text block for the system prompt.
 * Caps roster list at maxRoster to keep the prompt under ~3k tokens.
 */
export function serializeContextBlock(ctx: SystemContext, maxRoster = 30): string {
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `€${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `€${Math.round(n / 1_000)}k`
        : `€${Math.round(n)}`;

  const topRoster = [...ctx.roster.athletes]
    .sort((a, b) => b.total_contract_value - a.total_contract_value)
    .slice(0, maxRoster);

  const lines: string[] = [];
  lines.push(`AGENZIA: ${ctx.agency.name} (${ctx.agency.type}, piano ${ctx.agency.plan})`);
  lines.push(
    `COMMISSIONE DEFAULT: ${ctx.agency.defaultCommissionType === "pct" ? `${ctx.agency.defaultCommissionValue}%` : `€${ctx.agency.defaultCommissionValue}`}`,
  );
  lines.push("");
  lines.push(
    `ROSTER: ${ctx.roster.total} totali (${ctx.roster.active} attivi). Top ${topRoster.length} per valore contratti:`,
  );
  for (const a of topRoster) {
    const soc =
      a.social_reach >= 1_000_000
        ? `${(a.social_reach / 1_000_000).toFixed(1)}M`
        : a.social_reach >= 1_000
          ? `${Math.round(a.social_reach / 1_000)}K`
          : String(a.social_reach);
    const excl = a.dominant_exclusivities.length ? ` · escl: ${a.dominant_exclusivities.join("/")}` : "";
    lines.push(
      `- ${a.full_name} [${a.sport ?? "?"}] — ${a.active_contracts} contratti · ${fmt(a.total_contract_value)} · social ${soc}${excl} · pipeline ${a.pipeline_deals} deal (${fmt(a.pipeline_weighted_value)})`,
    );
  }
  if (ctx.roster.total > topRoster.length) {
    lines.push(`... +${ctx.roster.total - topRoster.length} altri atleti nel database`);
  }
  lines.push("");

  if (ctx.conflicts.length > 0) {
    lines.push(`CONFLITTI APERTI: ${ctx.conflicts.length}`);
    for (const k of ctx.conflicts.slice(0, 5)) {
      lines.push(`- [${k.severity}] ${k.athlete_name ?? "?"} — ${k.brands.join(" vs ")} — ${k.description}`);
    }
    lines.push("");
  } else {
    lines.push(`CONFLITTI: nessuno aperto`);
    lines.push("");
  }

  lines.push(`SCADENZE ≤30gg: ${ctx.deadlines.next_30d.length} (${ctx.deadlines.next_90d_count} entro 90gg)`);
  for (const d of ctx.deadlines.next_30d.slice(0, 8)) {
    const tag = d.is_agency_mandate ? "MANDATO" : "DEAL";
    lines.push(
      `- ${d.days_remaining}gg · ${d.athlete_name ?? "?"} / ${d.brand} (${tag}) · ${d.value ? fmt(d.value) : "—"}`,
    );
  }
  lines.push("");

  lines.push(
    `PIPELINE CRM: ${ctx.pipeline.total_count} deal in corso · atteso ${fmt(ctx.pipeline.total_weighted_value)}`,
  );
  for (const s of ctx.pipeline.stages) {
    lines.push(`- ${s.stage}: ${s.count} deal · ponderato ${fmt(s.weighted_value)}`);
  }
  lines.push("");

  lines.push(
    `REVENUE YTD: Monte Deal ${fmt(ctx.revenue.monte_deal_ytd)} su ${ctx.revenue.active_brand_deal_count} deal brand attivi · commissioni stimate ${fmt(ctx.revenue.estimated_commissions_ytd)}`,
  );

  if (ctx.unavailable_sections.length > 0) {
    lines.push("");
    lines.push(`NOTA: sezioni non disponibili in questa sessione: ${ctx.unavailable_sections.join(", ")}`);
  }

  return lines.join("\n");
}
