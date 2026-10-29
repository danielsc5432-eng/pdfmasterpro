/** These operations use pdf-lib/JSZip and do not require native binaries. */
const DIRECT_TOOLS = new Set([
  "juntar-pdf", "dividir-pdf", "girar-pdf", "organizar-pdf",
  "editar-metadados", "marca-dagua", "numerar-paginas",
]);
export const DIRECT_REQUEST_BYTES = 4 * 1024 * 1024;

/** Decide before consuming the body. Unknown/large uploads keep the worker path. */
export function useDirectProcessing(tool: string, declaredBytes: number, env: Record<string, string | undefined> = process.env) {
  return env.VERCEL === "1" && env.PROCESSING_FAST_LOCAL !== "0"
    && env.PROCESSING_WORKER_ONLY !== "1" && !env.PROCESSING_WORKER_ROUTES?.trim()
    && DIRECT_TOOLS.has(tool) && Number.isSafeInteger(declaredBytes)
    && declaredBytes > 0 && declaredBytes <= DIRECT_REQUEST_BYTES;
}
