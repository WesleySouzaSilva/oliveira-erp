import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Briefcase, FileText, Target, Calendar, ClipboardList, Award } from "lucide-react";

interface HistoricoEntry {
  id: string;
  tipo_evento: string;
  descricao: string;
  created_at: string;
}

interface HistoricoTimelineProps {
  historico: HistoricoEntry[];
}

const EVENT_ICONS: Record<string, any> = {
  admissao: Briefcase,
  cargo: Award,
  regime: Briefcase,
  documento: FileText,
  meta: Target,
  reuniao: Calendar,
  pdi: ClipboardList,
};

const EVENT_COLORS: Record<string, string> = {
  admissao: "bg-emerald-500/10 border-emerald-500 text-emerald-600",
  cargo: "bg-violet-500/10 border-violet-500 text-violet-600",
  regime: "bg-blue-500/10 border-blue-500 text-blue-600",
  documento: "bg-amber-500/10 border-amber-500 text-amber-600",
  meta: "bg-emerald-500/10 border-emerald-500 text-emerald-600",
  reuniao: "bg-blue-500/10 border-blue-500 text-blue-600",
  pdi: "bg-violet-500/10 border-violet-500 text-violet-600",
};

export function HistoricoTimeline({ historico }: HistoricoTimelineProps) {
  if (historico.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação registrada.</p>;
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
      {historico.map((h) => {
        const Icon = EVENT_ICONS[h.tipo_evento] || History;
        const colorClass = EVENT_COLORS[h.tipo_evento] || "bg-muted border-muted-foreground text-muted-foreground";
        return (
          <div key={h.id} className="relative">
            <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${colorClass}`}>
              <Icon className="w-2.5 h-2.5" />
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium capitalize">{h.tipo_evento.replace(/_/g, " ")}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(h.created_at), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
              <p className="text-sm">{h.descricao}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
