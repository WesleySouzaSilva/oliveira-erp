import { FaseProcesso, StatusFase, getStatusFaseColor, getFaseLabel, getFaseIcon } from "@/data/mockProcessos";
import type { Processo } from "@/data/mockProcessos";
import { CheckCircle2, Circle, Loader2, Lock } from "lucide-react";

interface ProcessoTimelineProps {
  processo: Processo;
  onFaseClick: (fase: FaseProcesso) => void;
  faseAtiva: FaseProcesso;
}

function StatusIcon({ status }: { status: StatusFase }) {
  switch (status) {
    case "concluida":
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    case "em_andamento":
      return <Loader2 className="w-5 h-5 text-accent animate-spin" style={{ animationDuration: "3s" }} />;
    case "pendente":
      return <Circle className="w-5 h-5 text-muted-foreground/40" />;
    case "bloqueada":
      return <Lock className="w-5 h-5 text-destructive/40" />;
  }
}

export function ProcessoTimeline({ processo, onFaseClick, faseAtiva }: ProcessoTimelineProps) {
  const fases: FaseProcesso[] = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 px-1">
        Fases do Processo
      </h3>
      {fases.map((fase, i) => {
        const status = processo.statusFases[fase];
        const datas = processo.datasFases[fase];
        const isActive = faseAtiva === fase;
        const isClickable = status === "concluida" || status === "em_andamento";
        const isLast = i === fases.length - 1;

        // Calculate days
        let diasInfo = "";
        if (status === "em_andamento" && datas.inicio) {
          const dias = Math.floor(
            (new Date().getTime() - new Date(datas.inicio).getTime()) / (1000 * 60 * 60 * 24)
          );
          diasInfo = `${dias} dias`;
        } else if (status === "concluida" && datas.fim) {
          diasInfo = `Concluído em ${new Date(datas.fim).toLocaleDateString("pt-BR")}`;
        }

        return (
          <div key={fase} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div
                className={`absolute left-[14px] top-[36px] w-0.5 h-6 ${
                  status === "concluida" ? "bg-success/30" : "bg-border"
                }`}
              />
            )}

            <button
              onClick={() => isClickable && onFaseClick(fase)}
              disabled={!isClickable}
              className={`w-full flex items-start gap-3 px-2 py-2.5 rounded-lg text-left transition-all duration-200 ${
                isActive
                  ? "bg-accent/10 border border-accent/20"
                  : isClickable
                  ? "hover:bg-secondary/50"
                  : "opacity-60 cursor-default"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                <StatusIcon status={status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{getFaseIcon(fase)}</span>
                  <span
                    className={`text-sm font-medium truncate ${
                      isActive ? "text-foreground" : getStatusFaseColor(status)
                    }`}
                  >
                    {getFaseLabel(fase)}
                  </span>
                </div>
                {diasInfo && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {diasInfo}
                  </p>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
