import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Clock, User, FileEdit, Plus, CheckCircle2, Trash2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { AcordoTarefa } from "@/hooks/useAcordos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type HistRow = {
  id: string;
  tarefa_id: string;
  user_id: string | null;
  acao: string;
  campos_alterados: string[] | null;
  dados_anteriores: any;
  dados_novos: any;
  created_at: string;
};

const ACAO_META: Record<string, { label: string; icon: any; color: string }> = {
  criado: { label: "Criou", icon: Plus, color: "text-blue-600" },
  atualizado: { label: "Atualizou", icon: FileEdit, color: "text-amber-600" },
  status_alterado: { label: "Alterou status", icon: ArrowRight, color: "text-purple-600" },
  concluido: { label: "Concluiu", icon: CheckCircle2, color: "text-green-600" },
  excluido: { label: "Excluiu", icon: Trash2, color: "text-destructive" },
};

const CAMPO_LABEL: Record<string, string> = {
  titulo: "Título", descricao: "Descrição", nome_cliente: "Cliente",
  status: "Status", prioridade: "Prioridade", data_vencimento: "Vencimento",
  responsavel_id: "Responsável", observacoes: "Observações",
  valor_acordo: "Valor do acordo", resultado_tentativa: "Resultado",
  concluida: "Concluída", recorrente: "Recorrente",
  intervalo_recorrencia: "Recorrência", contrato_id: "Contrato",
  proxima_geracao: "Próxima geração",
};

const fmtVal = (v: any) =>
  v === null || v === undefined || v === "" ? "—" :
  typeof v === "boolean" ? (v ? "Sim" : "Não") :
  typeof v === "object" ? JSON.stringify(v) : String(v);

interface Props { tarefas: AcordoTarefa[] }

export function AuditoriaAcordos({ tarefas }: Props) {
  const { members } = useOrgMembers();
  const [hist, setHist] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("acordos_historico")
        .select("id, tarefa_id, user_id, acao, campos_alterados, dados_anteriores, dados_novos, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (mounted) {
        setHist((data as HistRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [tarefas.length]);

  const tarefaMap = useMemo(() => {
    const m = new Map<string, AcordoTarefa>();
    tarefas.forEach((t) => m.set(t.id, t));
    return m;
  }, [tarefas]);

  const memberMap = useMemo(() => {
    const m = new Map<string, any>();
    members.forEach((mb: any) => m.set(mb.user_id, mb));
    return m;
  }, [members]);

  const filtrado = hist.filter((h) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    const t = tarefaMap.get(h.tarefa_id);
    const u = memberMap.get(h.user_id || "");
    return (
      (t?.titulo || "").toLowerCase().includes(q) ||
      (t?.nome_cliente || "").toLowerCase().includes(q) ||
      (u?.nome || u?.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tarefa, cliente ou usuário..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando histórico...</p>
      ) : filtrado.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Nenhuma alteração registrada.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtrado.map((h) => {
            const meta = ACAO_META[h.acao] || ACAO_META.atualizado;
            const Icon = meta.icon;
            const tarefa = tarefaMap.get(h.tarefa_id);
            const usuario = memberMap.get(h.user_id || "");
            const nomeUsuario = usuario?.nome || usuario?.email || "Sistema";
            const tituloTarefa = tarefa?.titulo || h.dados_novos?.titulo || h.dados_anteriores?.titulo || "Tarefa removida";
            const cliente = tarefa?.nome_cliente || h.dados_novos?.nome_cliente || h.dados_anteriores?.nome_cliente;
            return (
              <Card key={h.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-start gap-2 flex-1">
                      <Icon className={`w-4 h-4 mt-0.5 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-semibold">{nomeUsuario}</span>
                          <span className="text-muted-foreground"> · {meta.label} · </span>
                          <span className="font-medium">{tituloTarefa}</span>
                          {cliente && <span className="text-muted-foreground"> · {cliente}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{h.acao}</Badge>
                  </div>

                  {h.campos_alterados && h.campos_alterados.length > 0 && (
                    <div className="pl-6 space-y-1">
                      {h.campos_alterados.filter((c) => CAMPO_LABEL[c]).map((c) => {
                        const before = h.dados_anteriores?.[c];
                        const after = h.dados_novos?.[c];
                        return (
                          <div key={c} className="text-xs flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground font-medium">{CAMPO_LABEL[c]}:</span>
                            <span className="line-through text-muted-foreground">{fmtVal(before)}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{fmtVal(after)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}