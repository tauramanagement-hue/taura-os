// Magic-bytes file validation. Rejects files whose content doesn't match
// the declared extension — prevents malware renamed as PDF/image attacks.

type Signature = { type: string; bytes: number[]; offset?: number };

const SIGNATURES: Signature[] = [
  { type: "pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { type: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: "webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF .... WEBP
  { type: "zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // also docx/xlsx/pptx
  { type: "zip", bytes: [0x50, 0x4b, 0x05, 0x06] },
  // Legacy MS Office (.doc, .xls, .ppt): OLE2 Compound File Binary Format
  { type: "ole2", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
];

// Plain-text extensions: no reliable magic bytes, but we can check that the
// buffer looks like text (no NULs, valid UTF-8/ASCII in the first 512 bytes).
const TEXT_EXTS = new Set(["txt", "csv"]);

function looksLikeText(buf: Uint8Array): boolean {
  const sample = buf.slice(0, Math.min(buf.length, 512));
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    // Allow tab (0x09), LF (0x0a), CR (0x0d), and printable range.
    if (b === 0x00) return false;
    if (b < 0x09) return false;
    if (b > 0x0d && b < 0x20 && b !== 0x1b) return false;
  }
  return true;
}

export function detectFileType(buf: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buf.length < offset + sig.bytes.length) continue;
    let ok = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buf[offset + i] !== sig.bytes[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      // Distinguish WEBP (RIFF...WEBP) from other RIFF containers
      if (sig.type === "webp" && buf.length >= 12) {
        const tag = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
        if (tag !== "WEBP") continue;
      }
      return sig.type;
    }
  }
  return null;
}

const EXT_TO_TYPE: Record<string, string[]> = {
  pdf: ["pdf"],
  png: ["png"],
  jpg: ["jpg"],
  jpeg: ["jpg"],
  gif: ["gif"],
  webp: ["webp"],
  docx: ["zip"],
  xlsx: ["zip"],
  pptx: ["zip"],
  zip: ["zip"],
  doc: ["ole2"],
  xls: ["ole2"],
  ppt: ["ole2"],
};

export function validateMagicBytes(
  buf: Uint8Array,
  filename: string,
): { ok: boolean; detected: string | null; reason?: string } {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  // Text formats have no reliable signature — fall back to heuristic.
  if (TEXT_EXTS.has(ext)) {
    if (looksLikeText(buf)) return { ok: true, detected: ext };
    return { ok: false, detected: null, reason: `.${ext} is not plain text` };
  }

  const expected = EXT_TO_TYPE[ext];
  if (!expected) {
    return { ok: false, detected: null, reason: `unsupported extension: ${ext}` };
  }
  const detected = detectFileType(buf);
  if (!detected) {
    return { ok: false, detected: null, reason: "unrecognized file signature" };
  }
  if (!expected.includes(detected)) {
    return {
      ok: false,
      detected,
      reason: `extension .${ext} does not match content type ${detected}`,
    };
  }
  return { ok: true, detected };
}
