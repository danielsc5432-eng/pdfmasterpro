"use client";

import { FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DragEvent, useRef, useState } from "react";

export function HomeDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  function accept(files: FileList | null) { if (files) setNames(Array.from(files).slice(0, 5).map((file) => file.name)); }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files); }
  return <div className="upload-card"><div className="upload-card-top"><span className="upload-card-title">Comece com seus arquivos</span><span className="upload-card-badge">Até 25 MB</span></div><div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}><input ref={inputRef} className="file-input" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.txt" onChange={(event) => accept(event.target.files)} /><span className="dropzone-icon"><FileUp size={25} /></span>{names.length === 0 ? <><strong>Arraste ou escolha um arquivo</strong><span>PDF, documentos, planilhas, apresentações e imagens</span></> : <><strong>{names.length} arquivo(s) selecionado(s)</strong><span>{names.slice(0, 2).join(", ")}{names.length > 2 ? "…" : ""}</span></>}</div>{names.length > 0 && <div style={{ marginTop: 15, display: "flex", gap: 9, alignItems: "center", justifyContent: "space-between" }}><span style={{ color: "var(--muted)", fontSize: 12 }}>Seleção local concluída. Escolha um fluxo para enviar.</span><Link className="button button-primary" href="/ferramentas/juntar-pdf" onClick={(event) => event.stopPropagation()}>Juntar PDFs</Link></div>}<div className="hero-note"><ShieldCheck size={14} /> Nenhum arquivo é enviado nesta área de descoberta.</div></div>;
}
