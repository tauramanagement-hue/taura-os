import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

interface EmbeddingRequest {
  contract_ids?: string[];
}

interface ContractRow {
  id: string;
  brand: string;
  contract_type: string;
  value: number | null;
  start_date: string;
  end_date: string;
  exclusivity_category: string | null;
  exclusivity_territory: string | null;
  ai_extracted_clauses: Record<string, unknown> | null;
  athlete_id: string;
  athletes: { full_name: string } | null;
  obligations: string | null;
  social_obligations: string | null;
  penalties: string | null;
  renewal_clause: string | null;
  image_rights: string | null;
}

interface GeminiEmbeddingResponse {
  embedding?: { values: number[] };
  error?: { message: string };
}

/**
 * Build a text chunk from contract data for embedding.
 */
function buildTextChunk(contract: ContractRow): string {
  const clauses = contract.ai_extracted_clauses ?? {};
  const keyTerms = Array.isArray(clauses.key_terms)
    ? (clauses.key_terms as string[]).join(", ")
    : "";
  const nonCompete =
    typeof clauses.non_compete === "string" ? clauses.non_compete : "";
  const obligations = Array.isArray(clauses.obligations)
    ? (clauses.obligations as string[]).join(", ")
    : contract.obligations ?? "";
  const socialObligations = Array.isArray(clauses.social_obligations)
    ? (clauses.social_obligations as string[]).join(", ")
    : contract.social_obligations ?? "";
  const penalties =
    typeof clauses.penalties === "string"
      ? clauses.penalties
      : contract.penalties ?? "";
  const renewalClause =
    typeof clauses.renewal_clause === "string"
      ? clauses.renewal_clause
      : contract.renewal_clause ?? "";
  const imageRights =
    typeof clauses.image_rights === "string"
      ? clauses.image_rights
      : contract.image_rights ?? "";

  const athleteName = contract.athletes?.full_name ?? "N/D";
  const value =
    contract.value != null ? `\u20AC${contract.value.toLocaleString("it-IT")}` : "N/D";

  return [
    `Brand: ${contract.brand}`,
    `Tipo: ${contract.contract_type}`,
    `Atleta: ${athleteName}`,
    `Valore: ${value}`,
    `Periodo: ${contract.start_date} - ${contract.end_date}`,
    `Esclusivit\u00E0: ${contract.exclusivity_category ?? "N/D"} (${contract.exclusivity_territory ?? "N/D"})`,
    `Clausole chiave: ${keyTerms || "N/D"}`,
    `Non compete: ${nonCompete || "N/D"}`,
    `Obblighi: ${obligations || "N/D"}`,
    `Obblighi social: ${socialObligations || "N/D"}`,
    `Penali: ${penalties || "N/D"}`,
    `Rinnovo: ${renewalClause || "N/D"}`,
    `Diritti immagine: ${imageRights || "N/D"}`,
  ].join("\n");
}

/**
 * Call Gemini text-embedding-004 to generate a 768-dim vector.
 */
async function generateEmbedding(
  text: string,
  apiKey: string,
): Promise<number[]> {
  // Try text-embedding-004 first (768-dim), fallback to embedding-001 (768-dim)
  for (const model of ["text-embedding-004", "embedding-001"]) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
      }),
    });

    if (response.status === 404) continue; // try next model

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini embedding API error (${response.status}): ${errorBody}`);
    }

    const data: GeminiEmbeddingResponse = await response.json();
    if (data.error) throw new Error(`Gemini embedding error: ${data.error.message}`);
    if (!data.embedding?.values?.length) throw new Error("Gemini returned empty embedding");
    return data.embedding.values;
  }
  throw new Error("No embedding model available (tried text-embedding-004, embedding-001)");
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // --- Validate env ---
    const googleAiKey = Deno.env.get("GEMINI_API_KEY");
    if (!googleAiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Auth: verify JWT and resolve agency_id ---
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
    } = await adminClient.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Non autenticato" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .single();

    if (!profile?.agency_id) {
      return new Response(
        JSON.stringify({ error: "Nessuna agenzia associata" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const agencyId = profile.agency_id;

    // --- Parse request body ---
    const body: EmbeddingRequest = await req.json();
    const requestedIds = Array.isArray(body.contract_ids)
      ? body.contract_ids
      : [];

    // --- Fetch contracts ---
    let contractQuery = adminClient
      .from("contracts")
      .select(
        "id, brand, contract_type, value, start_date, end_date, " +
          "exclusivity_category, exclusivity_territory, ai_extracted_clauses, " +
          "athlete_id, athletes(full_name), obligations, social_obligations, " +
          "penalties, renewal_clause, image_rights",
      )
      .eq("agency_id", agencyId);

    if (requestedIds.length > 0) {
      // Process only the specified contracts
      contractQuery = contractQuery.in("id", requestedIds);
    } else {
      // Process all contracts that don't have embeddings yet
      const { data: existingEmbeddings } = await adminClient
        .from("contract_embeddings")
        .select("contract_id")
        .eq("chunk_index", 0);

      const embeddedIds = (existingEmbeddings || []).map(
        (e: { contract_id: string }) => e.contract_id,
      );

      if (embeddedIds.length > 0) {
        contractQuery = contractQuery.not(
          "id",
          "in",
          `(${embeddedIds.join(",")})`,
        );
      }
    }

    const { data: contracts, error: fetchErr } = await contractQuery;

    if (fetchErr) {
      throw new Error(`Errore fetch contratti: ${fetchErr.message}`);
    }

    if (!contracts || contracts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, errors: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Generate embeddings and upsert ---
    let processed = 0;
    const errors: Array<{ contract_id: string; error: string }> = [];

    for (const contract of contracts as ContractRow[]) {
      try {
        const textChunk = buildTextChunk(contract);
        const embedding = await generateEmbedding(textChunk, googleAiKey);

        const { error: upsertErr } = await adminClient
          .from("contract_embeddings")
          .upsert(
            {
              contract_id: contract.id,
              chunk_index: 0,
              content: textChunk,
              embedding,
            },
            { onConflict: "contract_id,chunk_index" },
          );

        if (upsertErr) {
          throw new Error(upsertErr.message);
        }

        processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(
          `Embedding error for contract ${contract.id}:`,
          message,
        );
        errors.push({ contract_id: contract.id, error: message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const traceId = crypto.randomUUID();
    console.error("[generate-embeddings] fatal", { trace_id: traceId, message: e instanceof Error ? e.message : "unknown" });
    return new Response(
      JSON.stringify({ code: "INTERNAL", message: "Errore interno.", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
