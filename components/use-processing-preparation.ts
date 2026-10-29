"use client";
import { useEffect } from "react";

/** Prepare only after the user selects a file; never poll or keep a service awake. */
export function useProcessingPreparation(tool: string, bytes: number) {
  useEffect(() => {
    if (!bytes) return;
    const controller = new AbortController();
    void fetch("/api/processing/prepare", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, bytes }), signal: controller.signal,
    }).then(response => {
      if (response.ok && !controller.signal.aborted && tool === "resumir-pdf-ia") window.dispatchEvent(new Event("arquivelio:processor-ready"));
    }).catch(() => undefined); // Readiness never bypasses normal processing or quota checks.
    return () => controller.abort();
  }, [tool, bytes]);
}
