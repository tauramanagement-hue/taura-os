/**
 * file-processor — Taura OS edge function.
 *
 * Handles two scenarios:
 *
 * A) action = "extract"   (on-demand, called by chat when a file is mentioned)
 *    Input:  { bucket, path, agency_id }
 *    Output: { text: string, mime: string, size_kb: number }
 *
 * B) action = "process_and_save"  (called after upload to auto-populate DB)
 *    Input:  { bucket, path, agency_id, entity_type, entity_id }
 *    Output: { saved: boolean, field_updated: string }
 *
 * Always uses service-role key → can read private buckets.
 * PDF extraction uses Gemini Vision (supports inline PDF base64).
 * Images use Gemini Vision as well.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateMagicBytes } from "../_shared/file-validation.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_VISION_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB hard limit for inline extraction

type Bucket = "contracts" | "briefs" | "deliverables" | "media-kits" | string;
type EntityType = "contract" | "campaign" | "deliverable" | "athlete";

interface ExtractRequest {
  action: "extract" | "process_and_save";
  bucket: Bucket;
  path: string;
  agency_id: string;
  entity_type?: EntityType;
  entity_id?: string;
}

// ── MIME detection from path extension ─────────────────────────────────────
function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] ?? "application/octet-stream";
}

// ── Gemini Vision extraction ────────────────────────────────────────────────
async function extractWithGemini(
  base64Data: string,
  mimeType: string,
  fileName: string,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY non configurata");
  }

  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    return "(estrazione testo non supportata per questo tipo di file)";
  }

  const instruction = isPdf
    ? `Estrai il testo completo di questo documento PDF. Preserva la struttura (titoli, paragrafi, tabelle). Includi TUTTO il testo, senza riassumere. Se si tratta di un contratto sportivo o commerciale, evidenzia: parti, durata, valore economico, clausole di esclusività, obblighi, penali, rinnovo.`
    : `Descrivi e trascrivi tutto il testo visibile in questa immagine. Se è un documento, trascrivi il contenuto completo. File: ${fileName}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: instruction },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  const res = await fetch(`${GEMINI_VISION_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Vision error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini non ha restituito testo");
  return text;
}

// ── DB save after extraction ────────────────────────────────────────────────
async function saveExtraction(
  supabase: ReturnType<typeof createClient>,
  entityType: EntityType,
  entityId: string,
  extractedText: string,
): Promise<{ saved: boolean; field_updated: string }> {
  let table: string;
  let field: string;

  switch (entityType) {
    case "contract":
      table = "contracts";
      // Store in ai_extracted_clauses as { full_text: ... }
      field = "ai_extracted_clauses";
      break;
    case "campaign":
      table = "campaigns";
      field = "description";
      break;
    case "deliverable":
      table = "campaign_deliverables";
      field = "ai_overview";
      break;
    case "athlete":
      table = "athletes";
      field = "notes"; // fallback — athletes don't have a text blob column
      break;
    default:
      return { saved: false, field_updated: "" };
  }

  const value =
    entityType === "contract"
      ? { full_text: extractedText, extracted_at: new Date().toISOString() }
      : extractedText.slice(0, 8000); // cap for text columns

  const { error } = await supabase
    .from(table)
    .update({ [field]: value })
    .eq("id", entityId);

  if (error) {
    console.error(`[file-processor] save error (${table}.${field}):`, error);
    return { saved: false, field_updated: field };
  }

  return { saved: true, field_updated: field };
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ExtractRequest = await req.json();
    const { action, bucket, path, agency_id, entity_type, entity_id } = body;

    if (!bucket || !path || !agency_id) {
      return new Response(JSON.stringify({ error: "bucket, path, agency_id richiesti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user belongs to this agency
    const { data: profile } = await adminClient
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.agency_id !== agency_id) {
      return new Response(JSON.stringify({ error: "Accesso non autorizzato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the file from Storage
    const { data: fileData, error: downloadErr } = await adminClient
      .storage
      .from(bucket)
      .download(path);

    if (downloadErr || !fileData) {
      console.warn("[file-processor] download error:", downloadErr?.message);
      return new Response(
        JSON.stringify({ code: "FILE_NOT_FOUND", message: "File non trovato." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const arrayBuf = await fileData.arrayBuffer();
    const sizeBytes = arrayBuf.byteLength;

    if (sizeBytes > MAX_FILE_BYTES) {
      return new Response(
        JSON.stringify({ error: `File troppo grande (${Math.round(sizeBytes / 1024)}KB > 10MB)` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mimeType = mimeFromPath(path);
    const fileName = path.split("/").pop() ?? path;

    const uint8 = new Uint8Array(arrayBuf);

    // Defense against content-type spoofing: confirm the first bytes match the
    // declared extension before we hand the bytes to Gemini Vision.
    const magic = validateMagicBytes(uint8, fileName);
    if (!magic.ok) {
      console.warn(`[file-processor] magic-bytes rejected ${fileName}: ${magic.reason}`);
      return new Response(
        JSON.stringify({
          code: "INVALID_FILE_TYPE",
          message: "Il contenuto del file non corrisponde all'estensione.",
        }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Convert to base64
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const base64 = btoa(binary);

    // Extract text via Gemini Vision
    const extractedText = await extractWithGemini(base64, mimeType, fileName);

    const result: Record<string, unknown> = {
      text: extractedText,
      mime: mimeType,
      size_kb: Math.round(sizeBytes / 1024),
      path,
      bucket,
    };

    // If process_and_save: persist extraction to DB
    if (action === "process_and_save" && entity_type && entity_id) {
      const saveResult = await saveExtraction(adminClient, entity_type, entity_id, extractedText);
      result.saved = saveResult.saved;
      result.field_updated = saveResult.field_updated;
    }

    console.log(`[file-processor] ${action} ${bucket}/${path} → ${extractedText.length} chars`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const traceId = crypto.randomUUID();
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[file-processor] fatal", { trace_id: traceId, message: msg });
    return new Response(
      JSON.stringify({ code: "INTERNAL", message: "Errore interno.", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
