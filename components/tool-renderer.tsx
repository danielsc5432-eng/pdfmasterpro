"use client";
import dynamic from "next/dynamic";
import type { ToolDefinition } from "@/lib/tools/catalog";
import { isLegalSuiteSlug } from "@/lib/legal/suite-config";
const General=dynamic(()=>import("./tool-workspace").then(m=>m.ToolWorkspace));
const Divergence=dynamic(()=>import("./divergences/workspace").then(m=>m.DivergenceWorkspace));
const Clone=dynamic(()=>import("./clonemaster/workspace").then(m=>m.CloneMasterWorkspace));
const Summary=dynamic(()=>import("./summary/workspace").then(m=>m.SummaryWorkspace));
const Legal=dynamic(()=>import("./legal/workspace").then(m=>m.LegalWorkspace));
const Analysis=dynamic(()=>import("./legal/analysis-workspace").then(m=>m.LegalAnalysisWorkspace));
export function ToolRenderer({tool}:{tool:ToolDefinition}) {
 if(isLegalSuiteSlug(tool.slug))return tool.slug==="prova-compare"?<Legal variant="proof"/>:<Analysis tool={tool.slug}/>;
 if(tool.slug==="pdf-timemachine-juridico")return <Legal/>;
 if(tool.slug==="clonemaster-ai")return <Clone/>;
 if(tool.slug==="resumir-pdf-ia")return <Summary/>;
 if(tool.slug==="detector-divergencias")return <Divergence/>;
 return <General tool={tool}/>;
}
