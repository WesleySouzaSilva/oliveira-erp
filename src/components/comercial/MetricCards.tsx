import { Card } from "@/components/ui/card";
import { Users, UserCheck, Phone, Video, FileText, Handshake, DollarSign, TrendingUp } from "lucide-react";

interface Props {
  metrics: {
    totalLeads: number;
    mqls: number;
    sqls: number;
    ligacoes: number;
    reunioesVideo: number;
    reunioesPresencial: number;
    propostas: number;
    fechamentos: number;
    valorTotal: number;
    ticketMedio: number;
    taxaConversao: number;
  };
}

export function MetricCards({ metrics }: Props) {
  const cards = [
    { label: "Total Leads", value: metrics.totalLeads, icon: Users, color: "text-blue-600" },
    { label: "MQLs", value: metrics.mqls, icon: Users, color: "text-indigo-600" },
    { label: "SQLs", value: metrics.sqls, icon: UserCheck, color: "text-purple-600" },
    { label: "Ligações", value: metrics.ligacoes, icon: Phone, color: "text-amber-600" },
    { label: "Reuniões Vídeo", value: metrics.reunioesVideo, icon: Video, color: "text-teal-600" },
    { label: "Propostas", value: metrics.propostas, icon: FileText, color: "text-orange-600" },
    { label: "Fechamentos", value: metrics.fechamentos, icon: Handshake, color: "text-emerald-600" },
    { label: "Ticket Médio", value: `R$ ${metrics.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`, icon: DollarSign, color: "text-accent" },
    { label: "Valor Total", value: `R$ ${metrics.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`, icon: DollarSign, color: "text-emerald-700" },
    { label: "Taxa Conversão", value: `${metrics.taxaConversao.toFixed(1)}%`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
            </div>
            <p className="text-xl font-bold">{c.value}</p>
          </Card>
        );
      })}
    </div>
  );
}
