/**
 * Legacy shim. Canonical module now at `src/lib/ai/systemPrompt.ts` per spec.
 * Kept so existing edge function imports keep compiling during migration.
 */
// @ts-ignore Deno/esbuild resolves .ts extension
export * from "../../../src/lib/ai/systemPrompt.ts";
