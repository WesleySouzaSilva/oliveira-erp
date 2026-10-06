import { Card } from "@/components/ui/card";
import { Users, FileText, Target, Calendar, AlertTriangle, ClipboardList } from "lucide-react";
import type { RHRole } from "@/hooks/usePermissions";

interface DashboardData {
  totalColaboradores: number;
  docsPendentes: number;
  contratosPendentes: number;
  metasAndamento: number;
  proximos1on1: number;
  pdisAndamento: number;
}

interface RHDashboardProps {
  role: RHRole;
  data: DashboardData;
}

export function RHDashboard({ role, data }: RHDashboardProps) {
  const adminCards = [
    { icon: Users, label: "Colaboradores", value: data.totalColaboradores, color: "text-primary" },
    { icon: FileText, label: "Docs Pendentes", value: data.docsPendentes, color: "text-amber-500" },
    { icon: AlertTriangle, label: "Contratos Pendentes", value: data.contratosPendentes, color: "text-destructive" },
    { icon: Target, label: "Metas em Andamento", value: data.metasAndamento, color: "text-emerald-500" },
    { icon: Calendar, label: "Próximos 1:1", value: data.proximos1on1, color: "text-blue-500" },
    { icon: ClipboardList, label: "PDIs em Andamento", value: data.pdisAndamento, color: "text-violet-500" },
  ];

  const coordCards = [
    { icon: Users, label: "Liderados", value: data.totalColaboradores, color: "text-primary" },
    { icon: Target, label: "Metas da Equipe", value: data.metasAndamento, color: "text-emerald-500" },
    { icon: Calendar, label: "Próximos Alinhamentos", value: data.proximos1on1, color: "text-blue-500" },
    { icon: ClipboardList, label: "PDIs da Equipe", value: data.pdisAndamento, color: "text-violet-500" },
  ];

  const selfCards = [
    { icon: Target, label: "Minhas Metas", value: data.metasAndamento, color: "text-emerald-500" },
    { icon: FileText, label: "Meus Documentos", value: data.docsPendentes, color: "text-amber-500" },
    { icon: Calendar, label: "Próximo Alinhamento", value: data.proximos1on1, color: "text-blue-500" },
    { icon: ClipboardList, label: "Meu PDI", value: data.pdisAndamento, color: "text-violet-500" },
  ];

  const cards = role === "admin" ? adminCards : role === "coordenador" ? coordCards : selfCards;

  return (
    <div className={`grid gap-4 mb-8 ${cards.length > 4 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 lg:grid-cols-4"}`}>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <Card key={i} className="p-4 border-border/60">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
