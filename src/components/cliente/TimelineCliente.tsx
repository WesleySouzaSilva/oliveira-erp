import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, FileText, CheckSquare, Gavel, MessageSquare, Loader2,
} from "lucide-react";

type EventoTipo = "movimentacao" | "atividade" | "tarefa" | "laudo";
type Evento = {
  id: string;
  tipo: EventoTipo;
  data: string;
  titulo: string;
  descricao?: string;
  link?: string;
};

const ICONS: Record<EventoTipo, any> = {
  movimentacao: Gavel,
  atividade: MessageSquare,
  tarefa: CheckSquare,
  laudo: FileText,
};

function fmt(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Linha do tempo unificada do cliente: atividades, tarefas, laudos e
 * movimentações de processos vinculados — ordenadas por data.
 */
export function TimelineCliente({ nomeCliente }: { nomeCliente: string }) {
  const [loading, setLoading] = useState(true);
  const [eventos, setEventos] = useState<Evento[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!nomeCliente) return;
      setLoading(true);
      try {
        const [ativRes, tarefasRes, laudosRes] = await Promise.all([
          supabase
            .from("atividades_clientes")
            .select("id, descricao, tipo, created_at, data_atividade").is("deleted_at", null)
            .eq("nome_cliente", nomeCliente)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("tarefas")
            .select("id, titulo, descricao, created_at, concluida, data_vencimento")
            .eq("nome_cliente", nomeCliente)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("laudos")
            .select("id, numero_laudo, status, created_at, dados_etapa1")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        const laudosCliente = (laudosRes.data || []).filter((l: any) => {
          const n = (l.dados_etapa1?.nomeProdutor || l.dados_etapa1?.nome || "").trim();
          return n.toLowerCase() === nomeCliente.trim().toLowerCase();
        });

        // movimentações dos processos do cliente (via laudos)
        const laudoIds = laudosCliente.map((l: any) => l.id);
        let movs: any[] = [];
        if (laudoIds.length) {
          const procRes = await supabase
            .from("processos")
            .select("id, laudo_id")
            .in("laudo_id", laudoIds)
            .is("deleted_at", null);
          const procIds = (procRes.data || []).map((p) => p.id);
          if (procIds.length) {
            const movRes = await supabase
              .from("movimentacoes")
              .select("id, tipo, descricao, fase, created_at, processo_id")
              .in("processo_id", procIds)
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(30);
            movs = movRes.data || [];
          }
        }

        const lista: Evento[] = [
          ...(ativRes.data || []).map((a: any) => ({
            id: `a-${a.id}`,
            tipo: "atividade" as EventoTipo,
            data: a.created_at,
            titulo: a.tipo || "Atendimento",
            descricao: a.descricao,
          })),
          ...(tarefasRes.data || []).map((t: any) => ({
            id: `t-${t.id}`,
            tipo: "tarefa" as EventoTipo,
            data: t.created_at,
            titulo: (t.concluida ? "✓ " : "") + t.titulo,
            descricao: t.descricao || undefined,
            link: `/tarefas?id=${t.id}`,
          })),
          ...laudosCliente.map((l: any) => ({
            id: `l-${l.id}`,
            tipo: "laudo" as EventoTipo,
            data: l.created_at,
            titulo: `Laudo ${l.numero_laudo || ""} · ${l.status}`,
            link: `/laudo/${l.id}`,
          })),
          ...movs.map((m: any) => ({
            id: `m-${m.id}`,
            tipo: "movimentacao" as EventoTipo,
            data: m.created_at,
            titulo: `${m.tipo} (${m.fase})`,
            descricao: m.descricao,
            link: `/processo/${m.processo_id}`,
          })),
        ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

        if (alive) setEventos(lista);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [nomeCliente]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Linha do tempo
          <span className="text-xs text-muted-foreground font-normal">({eventos.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : eventos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nada por aqui ainda. As atividades, tarefas, laudos e movimentações aparecerão na linha do tempo.
          </p>
        ) : (
          <div className="relative pl-5 space-y-3 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border">
            {eventos.slice(0, 40).map((e) => {
              const Icon = ICONS[e.tipo];
              const content = (
                <div className="relative">
                  <span className="absolute -left-[18px] top-1 h-3 w-3 rounded-full bg-primary/15 border-2 border-background flex items-center justify-center">
                    <Icon className="w-2 h-2 text-primary" />
                  </span>
                  <p className="text-xs font-medium leading-tight">{e.titulo}</p>
                  {e.descricao && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{e.descricao}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(e.data)}</p>
                </div>
              );
              return e.link ? (
                <Link key={e.id} to={e.link} className="block hover:bg-muted/40 -mx-2 px-2 py-1 rounded">
                  {content}
                </Link>
              ) : (
                <div key={e.id} className="py-1">{content}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TimelineCliente;