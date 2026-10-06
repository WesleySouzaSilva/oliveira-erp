import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MetaComercial } from "@/hooks/useComercial";
import type { OrgMember } from "@/hooks/useOrgMembers";

const TIPO_META_LABEL: Record<string, string> = {
  leads: "Leads",
  reunioes: "Reuniões",
  propostas: "Propostas",
  fechamentos: "Fechamentos",
  receita: "Receita",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ativa: { label: "Ativa", color: "bg-blue-100 text-blue-800" },
  concluida: { label: "Concluída", color: "bg-emerald-100 text-emerald-800" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-800" },
};

interface Props {
  metas: MetaComercial[];
  members: OrgMember[];
  onUpdateValorAtual?: (id: string, valor: number) => void;
}

export function MetasComercialList({ metas, members }: Props) {
  const getMemberName = (userId: string) => {
    const m = members.find(mb => mb.user_id === userId);
    return m?.nome || "—";
  };

  if (metas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhuma meta comercial cadastrada</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metas.map(meta => {
        const progresso = meta.valor_alvo > 0 ? Math.min((meta.valor_atual / meta.valor_alvo) * 100, 100) : 0;
        const statusCfg = STATUS_CONFIG[meta.status] || STATUS_CONFIG.ativa;
        const isReceita = meta.tipo_meta === "receita";

        return (
          <Card key={meta.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{meta.titulo}</p>
                <p className="text-xs text-muted-foreground">{getMemberName(meta.responsavel_id)}</p>
              </div>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${statusCfg.color}`}>
                {statusCfg.label}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{TIPO_META_LABEL[meta.tipo_meta] || meta.tipo_meta}</span>
                <span className="font-semibold">
                  {isReceita ? `R$ ${Number(meta.valor_atual).toLocaleString("pt-BR")}` : meta.valor_atual}
                  {" / "}
                  {isReceita ? `R$ ${Number(meta.valor_alvo).toLocaleString("pt-BR")}` : meta.valor_alvo}
                </span>
              </div>
              <Progress value={progresso} className="h-2" />
              <p className="text-[10px] text-right font-medium text-accent">{progresso.toFixed(0)}%</p>
            </div>

            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>
                {format(new Date(meta.periodo_inicio), "dd/MM", { locale: ptBR })} — {format(new Date(meta.periodo_fim), "dd/MM/yy", { locale: ptBR })}
              </span>
            </div>

            {meta.descricao && (
              <p className="text-xs text-muted-foreground line-clamp-2">{meta.descricao}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
