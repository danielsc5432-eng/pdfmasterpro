import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compressPdf, extractRange, imagesToPdf, mergePdfs, reorderPdf, renderPdfToZip, rotatePdf, splitPdfToZip, verifyOutput } from "@/lib/processing/pdf";
import { checkedPdfToDocx } from "@/lib/processing/docx-auto";
import { addWatermark, editMetadata, extractPdfText, numberPages, ocrImage, ocrPdf, protectPdf, redactPdf, signPdf, verifyProtectedPdf, wordToPdf } from "@/lib/processing/extended";
import { type FileKind, validateFile, safeFilename } from "@/lib/processing/validate";
import { attachSessionCookie, countRecentTasks, createProcessingTask, getSessionContext, markProcessingTaskCompleted, markProcessingTaskFailed } from "@/lib/db/tasks";
import { getTool } from "@/lib/tools/catalog";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import { PLAN_HEADER, PLAN_SIGNATURE_HEADER, signPlanHeaders } from "@/lib/billing/plan-token";
import type { Plan } from "@/lib/plans";
import { getCurrentUser } from "@/lib/auth/session";
import { testingTaskLimit } from "@/lib/billing/testing-quota";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_REQUEST_BYTES = 130 * 1024 * 1024;
const angleSchema = z.coerce.number().int().refine((value) => [90, 180, 270].includes(value), "O ângulo deve ser 90, 180 ou 270 graus.");
const pageSchema = z.coerce.number().int().min(1, "A página deve ser um número inteiro positivo.");
const positionSchema = z.enum(["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"]);
function errorResponse(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function contentDisposition(filename: string) { return `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}"`; }
function publicError(error: unknown) { const raw = error instanceof Error ? error.message : ""; if (raw.includes("não está configurado") || raw.includes("Nenhum resultado fictício")) return raw; if (/OCR será necessário|não contém texto extraível|não é uma área válida/i.test(raw)) return raw; if (/parse|header|invalid|unexpected|corrupt|encrypted|syntax|Failed to/i.test(raw)) return "Não foi possível ler o arquivo. Verifique se ele não está corrompido, protegido ou incompleto."; if (/timeout|memory|resource/i.test(raw)) return "O processamento excedeu os limites desta tarefa. Tente um arquivo menor ou menos páginas."; if (raw.startsWith("O ") || raw.startsWith("A ") || raw.startsWith("Este ") || raw.startsWith("WEBP")) return raw; return "O processador não conseguiu concluir a tarefa. Tente novamente com outro arquivo."; }
function finish<T extends NextResponse>(response: T, request: NextRequest, session: ReturnType<typeof getSessionContext>) { return session.isNew ? attachSessionCookie(response, session.token, request) : response; }
function numberField(form: FormData, key: string, fallback: number) { const value = Number(form.get(key) ?? fallback); return Number.isFinite(value) ? value : fallback; }
function planLabel(plan: Plan) { return plan.id === "free" ? "plano grátis" : "plano Premium"; }

export async function POST(request: NextRequest) {
  const tool = request.nextUrl.searchParams.get("tool"); if (!tool) return errorResponse("Selecione uma ferramenta de processamento.");
  const toolDefinition = getTool(tool);
  if (!toolDefinition) return errorResponse("Ferramenta desconhecida.", 404);
  const entitlements = await resolveEntitlements(request);
  const limits = entitlements.plan.limits;

  if (toolDefinition?.premium && !limits.premiumTools) return errorResponse(`A ferramenta "${toolDefinition.name}" é exclusiva do plano Premium. Assine para liberar todas as ferramentas.`, 402);

  const session = getSessionContext(request);
  const dailyLimit = testingTaskLimit(getCurrentUser(request)?.email, limits.tasksPerDay);
  // The authenticated proxy already checks quota. A worker must not apply a
  // second free-plan quota to requests carrying a verified plan signature.
  if (Number.isFinite(dailyLimit) && entitlements.source !== "signed") {
    const used = await countRecentTasks(session.hash);
    if (used >= dailyLimit) return errorResponse(`Você usou as ${dailyLimit} tarefas disponíveis nas últimas 24 horas. Aguarde a renovação da cota ou assine o Premium para processar sem limites.`, 429);
  }

  const workerUrl = process.env.PROCESSING_WORKER_URL?.trim();
  if (workerUrl) {
    // O worker é um processador sem estado: não tem banco nem sessão. A
    // persistência do histórico e a contagem do limite diário acontecem aqui,
    // no único tier que enxerga o Postgres. Sem isso o histórico nunca grava.
    //
    // `content-length` é o tamanho do corpo multipart (inclui fronteiras e
    // campos do formulário), então `input_bytes` é uma estimativa por excesso:
    // serve para o histórico, mas os limites de plano continuam sendo validados
    // pelo próprio worker, que vê os arquivos já decodificados.
    const declared = Number(request.headers.get("content-length") || 0);
    const taskId = await createProcessingTask({ sessionHash: session.hash, toolSlug: tool, fileCount: 1, inputBytes: Number.isFinite(declared) && declared > 0 ? declared : 0 });
    try {
      const target = `${workerUrl.replace(/\/$/, "")}/api/v1/process${request.nextUrl.search}`;
      const proxyHeaders = new Headers(request.headers);
      proxyHeaders.set("accept-encoding", "identity");
      proxyHeaders.delete(PLAN_HEADER);
      proxyHeaders.delete(PLAN_SIGNATURE_HEADER);
      const signed = signPlanHeaders(entitlements.plan.id);
      if (signed) for (const [key, value] of Object.entries(signed)) proxyHeaders.set(key, value);
      const response = await fetch(target, {
        method: "POST",
        headers: proxyHeaders,
        body: request.body,
        duplex: "half",
      } as RequestInit);
      const headers = new Headers(response.headers);
      // O fetch já entrega o corpo decodificado: cabeçalhos de entidade do upstream ficariam inconsistentes.
      headers.delete("transfer-encoding");
      const outputBytes = Number(headers.get("content-length") || 0);
      headers.delete("content-length");
      headers.delete("content-encoding");
      const outputType = (headers.get("content-type") || "application/octet-stream").slice(0, 100);
      await (response.ok ? markProcessingTaskCompleted(taskId, Number.isFinite(outputBytes) ? outputBytes : 0, outputType) : markProcessingTaskFailed(taskId, `worker_${response.status}`)).catch(() => undefined);
      return finish(new NextResponse(response.body, { status: response.status, headers }), request, session);
    } catch (error) {
      await markProcessingTaskFailed(taskId, "worker_unreachable").catch(() => undefined);
      const message = error instanceof Error ? error.message : "Falha ao contatar o worker de processamento.";
      return finish(errorResponse(`Não foi possível encaminhar a tarefa: ${message}`, 503), request, session);
    }
  }
  const declaredLength = Number(request.headers.get("content-length") || 0); if (declaredLength > MAX_REQUEST_BYTES) return errorResponse("A tarefa excede o limite de upload desta versão. Use arquivos menores ou menos arquivos.", 413);
  let form: FormData; try { form = await request.formData(); } catch { return errorResponse("Não foi possível receber os arquivos. Tente novamente.", 400); }
  const entries = form.getAll("files").filter((value): value is File => typeof value !== "string" && value instanceof File); if (!entries.length) return errorResponse("Envie pelo menos um arquivo."); if (entries.length > limits.maxFilesPerTask) return errorResponse(`Seu ${planLabel(entitlements.plan)} permite até ${limits.maxFilesPerTask} arquivos por tarefa.`);
  const multiFileTool = tool === "juntar-pdf" || tool === "imagens-para-pdf"; if (!multiFileTool && entries.length > 1) return errorResponse("Esta ferramenta processa um arquivo por vez. Remova os arquivos extras e tente novamente.");
  const isImages = tool === "imagens-para-pdf"; const isWord = tool === "word-para-pdf"; const isOcr = tool === "ocr-pdf";
  const allowed: FileKind[] = isImages ? ["jpg", "png", "webp"] : isWord ? ["doc", "docx"] : isOcr ? ["pdf", "jpg", "png"] : ["pdf"];
  const fileLimits = { maxFileBytes: limits.maxFileBytes, planLabel: planLabel(entitlements.plan) };
  const files: { name: string; bytes: Uint8Array; kind: FileKind }[] = [];
  for (const entry of entries) { const bytes = new Uint8Array(await entry.arrayBuffer()); const result = validateFile(entry.name, bytes, allowed, entry.type, fileLimits); if (!result.ok) return errorResponse(result.message, 422); files.push({ name: entry.name, bytes, kind: result.kind }); }
  const taskId = await createProcessingTask({ sessionHash: session.hash, toolSlug: tool, fileCount: files.length, inputBytes: files.reduce((total, file) => total + file.bytes.byteLength, 0) });
  const invalidTask = async (message: string, status = 400) => { await markProcessingTaskFailed(taskId, "invalid_options").catch(() => undefined); return finish(errorResponse(message, status), request, session); };
  try {
    let output: Uint8Array; let filename = `${safeFilename(files[0].name, "documento")}-resultado.pdf`;
    const qualityHeaders: Record<string,string> = {};
    if (tool === "juntar-pdf") { output = await mergePdfs(files.map((file) => file.bytes)); filename = "pdf-master-combinado.pdf"; }
    else if (tool === "dividir-pdf") { const mode = String(form.get("mode") || "range"); if (mode === "pages") { output = await splitPdfToZip(files[0].bytes); filename = `${safeFilename(files[0].name, "documento")}-paginas.zip`; } else { const start = pageSchema.parse(form.get("start") || 1); const rawEnd = String(form.get("end") || "").trim(); const end = rawEnd ? pageSchema.parse(rawEnd) : 0; if (end && end < start) return invalidTask("O intervalo de páginas é inválido."); output = await extractRange(files[0].bytes, start, end); filename = `${safeFilename(files[0].name, "documento")}-recorte.pdf`; } }
    else if (tool === "girar-pdf") { const angle = angleSchema.parse(form.get("angle") || 90); output = await rotatePdf(files[0].bytes, angle); filename = `${safeFilename(files[0].name, "documento")}-girado.pdf`; }
    else if (tool === "organizar-pdf") { const rawOrder = String(form.get("order") || "").trim(); const order = rawOrder ? rawOrder.split(",").map((value) => pageSchema.parse(value.trim())) : []; output = await reorderPdf(files[0].bytes, order); filename = `${safeFilename(files[0].name, "documento")}-organizado.pdf`; }
    else if (tool === "imagens-para-pdf") { const pageSize = String(form.get("pageSize") || "auto"); if (!["auto", "a4", "letter"].includes(pageSize)) return invalidTask("O tamanho de página informado não é suportado."); const margin = Math.max(0, Math.min(144, numberField(form, "margin", 0))); output = await imagesToPdf(files.map((file) => ({ bytes: file.bytes, kind: file.kind as "jpg" | "png" | "webp" })), pageSize, margin); filename = "pdf-master-imagens.pdf"; }
    else if (tool === "pdf-para-imagens") { const start = pageSchema.parse(form.get("start") || 1); const rawEnd = String(form.get("end") || "").trim(); const end = rawEnd ? pageSchema.parse(rawEnd) : 0; if (end && end < start) return invalidTask("O intervalo de páginas é inválido."); output = await renderPdfToZip(files[0].bytes, start, end); filename = `${safeFilename(files[0].name, "documento")}-imagens.zip`; }
    else if (tool === "pdf-para-word") { const result = await checkedPdfToDocx(files[0].bytes, files[0].name); output = result.output; qualityHeaders["X-PDFMaster-Fidelity"] = result.status; if(result.report) { qualityHeaders["X-PDFMaster-Source-Pages"] = String(result.report.sourcePages); qualityHeaders["X-PDFMaster-Output-Pages"] = String(result.report.outputPages); qualityHeaders["X-PDFMaster-OCR-Review"] = String(result.report.ocrReview); } filename = `${safeFilename(files[0].name, "documento")}-texto.docx`; }
    else if (tool === "word-para-pdf") { output = await wordToPdf(files[0].bytes, files[0].name); filename = `${safeFilename(files[0].name, "documento")}-convertido.pdf`; }
    else if (tool === "ocr-pdf") { const language = String(form.get("language") || "por"); if (!["por", "eng", "por+eng"].includes(language)) return invalidTask("Selecione um idioma válido para OCR."); output = files[0].kind === "pdf" ? await ocrPdf(files[0].bytes, language) : await ocrImage(files[0].bytes, files[0].kind as "jpg" | "png", language); filename = `${safeFilename(files[0].name, "documento")}-ocr.pdf`; }
    else if (tool === "extrair-texto") { output = await extractPdfText(files[0].bytes); filename = `${safeFilename(files[0].name, "documento")}-texto.txt`; }
    else if (tool === "marca-dagua") { const position = positionSchema.parse(String(form.get("position") || "center")); output = await addWatermark(files[0].bytes, { text: String(form.get("text") || "PDF Master Pro"), opacity: Math.max(0.05, Math.min(1, numberField(form, "opacity", 0.2))), rotation: numberField(form, "rotation", 45), position, color: String(form.get("color") || "#202431") }); filename = `${safeFilename(files[0].name, "documento")}-marca-dagua.pdf`; }
    else if (tool === "numerar-paginas") { const position = positionSchema.parse(String(form.get("position") || "bottom-center")); output = await numberPages(files[0].bytes, { format: String(form.get("format") || "{n}"), position, start: Math.max(1, Math.round(numberField(form, "start", 1))), size: numberField(form, "size", 12), color: String(form.get("color") || "#202431") }); filename = `${safeFilename(files[0].name, "documento")}-numerado.pdf`; }
    else if (tool === "assinar-pdf") { const position = positionSchema.parse(String(form.get("position") || "bottom-right")); output = await signPdf(files[0].bytes, { text: String(form.get("text") || "Assinado"), position }); filename = `${safeFilename(files[0].name, "documento")}-assinado.pdf`; }
    else if (tool === "proteger-pdf") { const password = String(form.get("password") || ""); if (password.length < 6 || password !== String(form.get("passwordConfirm") || "")) return invalidTask("A senha deve ter pelo menos 6 caracteres e ser confirmada."); output = await protectPdf(files[0].bytes, password); filename = `${safeFilename(files[0].name, "documento")}-protegido.pdf`; }
    else if (tool === "editar-metadados") { output = await editMetadata(files[0].bytes, { title: String(form.get("title") || ""), author: String(form.get("author") || ""), subject: String(form.get("subject") || ""), keywords: String(form.get("keywords") || "") }); filename = `${safeFilename(files[0].name, "documento")}-metadados.pdf`; }
    else if (tool === "redigir-pdf") { const page = Math.max(0, Math.round(numberField(form, "page", 0))); const x = Math.max(0, numberField(form, "x", 36)); const y = Math.max(0, numberField(form, "y", 36)); const width = Math.max(1, numberField(form, "width", 144)); const height = Math.max(1, numberField(form, "height", 36)); output = await redactPdf(files[0].bytes, { page, x, y, width, height }); filename = `${safeFilename(files[0].name, "documento")}-redigido.pdf`; }
    else if (tool === "comprimir-pdf") { output = await compressPdf(files[0].bytes); filename = `${safeFilename(files[0].name, "documento")}-comprimido.pdf`; }
    else return invalidTask("Esta ferramenta ainda não possui um processador habilitado.", 409);
    if (!output.byteLength) throw new Error("O processador retornou um arquivo vazio."); if (filename.endsWith(".txt")) { if (!new TextDecoder().decode(output).trim()) throw new Error("O arquivo de texto ficou vazio."); } else if (tool === "proteger-pdf") { await verifyProtectedPdf(output, String(form.get("password") || "")); } else await verifyOutput(filename, output);
    const outputType = filename.endsWith(".zip") ? "application/zip" : filename.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : filename.endsWith(".txt") ? "text/plain; charset=utf-8" : "application/pdf";
    await markProcessingTaskCompleted(taskId, output.byteLength, outputType);
    return finish(new NextResponse(output as BodyInit, { status: 200, headers: { "Content-Type": outputType, "Content-Length": String(output.byteLength), "Content-Disposition": contentDisposition(filename), "Cache-Control": "private, no-store", ...qualityHeaders, ...(taskId ? { "X-PDFMaster-Task-Id": taskId } : {}) } }), request, session);
  } catch (error) { await markProcessingTaskFailed(taskId, error instanceof Error && error.message.includes("não está configurado") ? "processor_unavailable" : "processing_failed").catch(() => undefined); const message = publicError(error); return finish(errorResponse(message, message.includes("não está configurado") ? 503 : 422), request, session); }
}
