/**
 * Wrapper legado dos status de laudo. Mantém a MESMA API/props que os
 * call-sites do Agro já usam, mas delega ao `StatusBadge` semântico em
 * `src/components/ui/status-badge.tsx` — assim o app inteiro fica com um
 * único visual de badge, sem precisar tocar em cada call-site.
 *
 * Mapa status → tom semântico (mesmo significado, só visual unificado):
 *   rascunho   → neutral, "Rascunho"
 *   analise    → info,    "Em análise"
 *   finalizado → success, "Finalizado"
 *   exportado  → gold,    "Exportado"
 */
import { StatusBadge as SemanticStatusBadge, type StatusTone } from "@/components/ui/status-badge";

type Status = "rascunho" | "pendente" | "analise" | "revisao" | "finalizado" | "retificacao" | "exportado";

const MAP: Record<Status, { tone: StatusTone; label: string }> = {
  rascunho:    { tone: "neutral", label: "Rascunho" },
  pendente:    { tone: "warning", label: "Pendente doc." },
  analise:     { tone: "info",    label: "Em análise" },
  revisao:     { tone: "info",    label: "Revisão" },
  finalizado:  { tone: "success", label: "Finalizado" },
  retificacao: { tone: "danger",  label: "Retificação" },
  exportado:   { tone: "gold",    label: "Exportado" },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = MAP[status] ?? { tone: "neutral" as StatusTone, label: String(status) };
  return <SemanticStatusBadge tone={cfg.tone} label={cfg.label} />;
}
