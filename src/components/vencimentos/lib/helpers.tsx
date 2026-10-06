import { CheckCircle, AlertTriangle, Clock } from "lucide-react";

export const formatSyncSummary = (data: any) => {
  const created = Number(data?.created ?? 0);
  const updated = Number(data?.updated ?? 0);
  const skipped = Number(data?.skipped ?? 0);
  const conflicts = Number(data?.duplicate_conflicts ?? 0);

  const summary = [`${created} novos`, `${updated} atualizados`];
  if (skipped > 0) summary.push(`${skipped} ignorados`);
  if (conflicts > 0) summary.push(`${conflicts} conflitos de duplicidade`);

  return summary.join(", ");
};

export const formatCurrency = (v: number | null) =>
  v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

export const isOverdue = (date: string | null) => {
  if (!date) return false;
  // Parse YYYY-MM-DD as local date to avoid UTC timezone shift
  const [y, m, d] = date.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dt < today;
};

export const formatDateBR = (date: string | null | undefined) => {
  if (!date) return "—";
  const [y, m, d] = date.split("T")[0].split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
};

export const getStatusIcon = (status: string | null) => {
  switch (status) {
    case "Em dia":
      return <CheckCircle className="w-4 h-4 text-success" />;
    case "Em atraso":
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    case "Renegociado":
      return <Clock className="w-4 h-4 text-accent" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};
