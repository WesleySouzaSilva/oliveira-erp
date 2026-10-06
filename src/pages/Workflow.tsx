import { useEffect, useMemo, useState } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Workflow as WorkflowIcon, Search, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { diasRestantes } from "@/hooks/useOperacoesCredito";
import { ListSkeleton } from "@/components/ui/loaders";

type EtapaKey = "fechamento" | "onboarding" | "mapeamento" | "notificacao" | "desfecho";

const ETAPAS: { key: EtapaKey; label: string; descricao: string; cor: string }[] = [
  { key: "fechamento", label: "1. Fechamento & Distribuição", descricao: "Cliente novo aguardando responsável de carteira", cor: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { key: "onboarding", label: "2. Onboarding & Checklist", descricao: "Reunião e coleta de documentos do produtor", cor: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  { key: "mapeamento", label: "3. Mapeamento & Laudo", descricao: "Conferência dos contratos e laudo técnico", cor: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  { key: "notificacao", label: "4. Notificação & Prazo 15d", descricao: "Bancos notificados, contagem dos 15 dias", cor: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30" },
  { key: "desfecho", label: "5. Desfecho & Alongamento", descricao: "Resposta do banco, cautelar ou alongamento", cor: "bg-primary/15 text-primary border-primary/30" },
];

type Cliente = {
  id: string;
  nome: string;
  grupo: string | null;
  responsavel_pos_venda: string | null;
  aguardando_distribuicao: boolean | null;
};

type Operacao = {
  cliente_id: string | null;
  banco: string | null;
  vence_em: string | null;
  saldo_devedor: number | null;
  notificado_em: string | null;
  protocolo_ref: string | null;
  laudo_status: string | null;
  data_conferida: boolean | null;
};

type CardCliente = {
  id: string;
  nome: string;
  grupo: string | null;
  responsavelNome: string | null;
  etapa: EtapaKey;
  operacoes: number;
  saldo: number;
  naoConferidas: number;
  aguardaLaudo: number;
  docsOk: number;
  docsTotal: number;
  diasPrazo: number | null;
  urgente: boolean;
  proximoPasso: string;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function WorkflowPage() {
  const navigate = useNavigate();
  const { members } = useOrgMembers();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [onboardings, setOnboardings] = useState<{ id: string; cliente_id: string | null; cliente_nome: string; status: string }[]>([]);
  const [itens, setItens] = useState<{ onboarding_id: string; status: string }[]>([]);
  const [processos, setProcessos] = useState<{ cliente_id: string | null; fase_atual: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroResp, setFiltroResp] = useState<string>("todos");

  const carregar = async () => {
    setLoading(true);
    const [c, o, ob, pr] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, grupo, responsavel_pos_venda, aguardando_distribuicao")
        .is("deleted_at", null)
        .eq("situacao", "ativo")
        .eq("base_historica_advbox", false)
        .order("nome"),
      supabase
        .from("operacoes_credito")
        .select("cliente_id, banco, vence_em, saldo_devedor, notificado_em, protocolo_ref, laudo_status, data_conferida")
        .is("deleted_at", null),
      supabase.from("pos_venda_onboardings").select("id, cliente_id, cliente_nome, status"),
      lerTudo(() => supabase.from("processos").select("cliente_id, fase_atual").is("deleted_at", null)),
    ]);
    if (c.error) toast({ title: "Erro ao carregar a jornada", description: c.error.message, variant: "destructive" });
    setClientes((c.data as Cliente[]) ?? []);
    setOperacoes((o.data as Operacao[]) ?? []);
    const obs = (ob.data as any[]) ?? [];
    setOnboardings(obs);
    setProcessos((pr.data as any[]) ?? []);
    if (obs.length) {
      const { data: it } = await supabase
        .from("pos_venda_checklist_itens")
        .select("onboarding_id, status")
        .is("arquivado_em", null)
        .in("onboarding_id", obs.map((x) => x.id));
      setItens((it as any[]) ?? []);
    } else {
      setItens([]);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const nomeMembro = (userId: string | null) =>
    userId ? members.find((m) => m.user_id === userId)?.nome ?? null : null;

  const cards = useMemo<CardCliente[]>(() => {
    const opsPorCliente = new Map<string, Operacao[]>();
    operacoes.forEach((op) => {
      if (!op.cliente_id) return;
      const arr = opsPorCliente.get(op.cliente_id) ?? [];
      arr.push(op);
      opsPorCliente.set(op.cliente_id, arr);
    });

    const obPorCliente = new Map<string, { id: string; status: string }>();
    const obPorNome = new Map<string, { id: string; status: string }>();
    onboardings.forEach((x) => {
      if (x.cliente_id) obPorCliente.set(x.cliente_id, { id: x.id, status: x.status });
      obPorNome.set((x.cliente_nome || "").toLowerCase().trim(), { id: x.id, status: x.status });
    });

    const itensPorOb = new Map<string, { total: number; ok: number }>();
    itens.forEach((it) => {
      const s = itensPorOb.get(it.onboarding_id) ?? { total: 0, ok: 0 };
      s.total++;
      if (["ok", "conferido", "recebido", "nao_aplica", "dispensado"].includes(it.status)) s.ok++;
      itensPorOb.set(it.onboarding_id, s);
    });

    const faseProcesso = new Map<string, number>();
    processos.forEach((p) => {
      if (!p.cliente_id) return;
      const f = Number(p.fase_atual) || 1;
      faseProcesso.set(p.cliente_id, Math.max(faseProcesso.get(p.cliente_id) ?? 0, f));
    });

    return clientes.map((cl) => {
      const ops = opsPorCliente.get(cl.id) ?? [];
      const ob = obPorCliente.get(cl.id) ?? obPorNome.get(cl.nome.toLowerCase().trim());
      const docs = ob ? itensPorOb.get(ob.id) ?? { total: 0, ok: 0 } : { total: 0, ok: 0 };
      const fase = faseProcesso.get(cl.id) ?? 0;

      const protocoladas = ops.filter((o) => o.protocolo_ref || o.notificado_em);
      const naoConferidas = ops.filter((o) => o.data_conferida === false).length;
      const aguardaLaudo = ops.filter((o) => o.laudo_status && !["nao_precisa", "pronto"].includes(o.laudo_status)).length;
      const saldo = ops.reduce((s, o) => s + (Number(o.saldo_devedor) || 0), 0);

      // Dias restantes do prazo de 15 dias a partir da notificação mais recente
      let diasPrazo: number | null = null;
      const datasNotif = protocoladas
        .map((o) => o.notificado_em)
        .filter(Boolean)
        .sort() as string[];
      if (datasNotif.length) {
        const base = new Date(datasNotif[datasNotif.length - 1] + "T00:00:00");
        base.setDate(base.getDate() + 15);
        diasPrazo = diasRestantes(base.toISOString().slice(0, 10));
      }

      const urgente = ops.some((o) => o.vence_em && diasRestantes(o.vence_em) <= 60);

      let etapa: EtapaKey;
      let proximoPasso: string;
      if (fase >= 4) {
        etapa = "desfecho";
        proximoPasso = "Acompanhar cautelar / alongamento";
      } else if (protocoladas.length && diasPrazo !== null && diasPrazo < 0) {
        etapa = "desfecho";
        proximoPasso = "Prazo de 15 dias encerrado — avaliar cautelar";
      } else if (protocoladas.length) {
        etapa = "notificacao";
        proximoPasso = diasPrazo !== null ? `Aguardando resposta do banco (${diasPrazo} dias)` : "Aguardando resposta do banco";
      } else if (!cl.responsavel_pos_venda || cl.aguardando_distribuicao) {
        etapa = "fechamento";
        proximoPasso = "Distribuir responsável de carteira";
      } else if (ops.length === 0 || (docs.total > 0 && docs.ok < docs.total && docs.ok / Math.max(docs.total, 1) < 0.5)) {
        etapa = "onboarding";
        proximoPasso = ops.length === 0 ? "Coletar contratos do produtor" : `Documentos pendentes (${docs.ok}/${docs.total})`;
      } else {
        etapa = "mapeamento";
        proximoPasso = naoConferidas
          ? `Conferir ${naoConferidas} vencimento(s)`
          : aguardaLaudo
            ? "Aguardando laudo técnico"
            : "Pronto para notificar o banco";
      }

      return {
        id: cl.id,
        nome: cl.nome,
        grupo: cl.grupo,
        responsavelNome: nomeMembro(cl.responsavel_pos_venda),
        etapa,
        operacoes: ops.length,
        saldo,
        naoConferidas,
        aguardaLaudo,
        docsOk: docs.ok,
        docsTotal: docs.total,
        diasPrazo,
        urgente,
        proximoPasso,
      };
    });
  }, [clientes, operacoes, onboardings, itens, processos, members]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cards.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q) && !(c.grupo || "").toLowerCase().includes(q)) return false;
      if (filtroResp === "todos") return true;
      if (filtroResp === "sem") return !c.responsavelNome;
      return c.responsavelNome === filtroResp;
    });
  }, [cards, busca, filtroResp]);

  const responsaveis = useMemo(
    () => Array.from(new Set(cards.map((c) => c.responsavelNome).filter(Boolean))) as string[],
    [cards],
  );

  return (
    <AppLayout>
      <div className="max-w-[1500px] mx-auto p-6 space-y-5">
        <PageHeader
          icon={WorkflowIcon}
          title="Jornada do Produtor"
          subtitle="Onde cada cliente ativo está hoje — do fechamento ao alongamento. Atualiza sozinho com os dados do cadastro, do onboarding e do radar."
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar produtor ou grupo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={filtroResp === "todos" ? "default" : "outline"} onClick={() => setFiltroResp("todos")}>Todos</Button>
            <Button size="sm" variant={filtroResp === "sem" ? "default" : "outline"} onClick={() => setFiltroResp("sem")}>Sem responsável</Button>
            {responsaveis.map((r) => (
              <Button key={r} size="sm" variant={filtroResp === r ? "default" : "outline"} onClick={() => setFiltroResp(r)}>{r}</Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={carregar}><RefreshCw className="w-4 h-4 mr-1" />Atualizar</Button>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-start">
            {ETAPAS.map((etapa) => {
              const items = filtrados.filter((c) => c.etapa === etapa.key);
              return (
                <div key={etapa.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide">{etapa.label}</h3>
                    <Badge variant="outline" className={etapa.cor}>{items.length}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{etapa.descricao}</p>
                  <div className="space-y-2 min-h-[120px]">
                    {items.length === 0 ? (
                      <Card className="p-4 text-[11px] text-center text-muted-foreground border-dashed">Nenhum produtor nesta etapa</Card>
                    ) : items.map((c) => (
                      <Card
                        key={c.id}
                        className="p-3 space-y-1.5 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/clientes/${encodeURIComponent(c.nome)}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{c.nome}</p>
                          {c.urgente && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] shrink-0">
                              <AlertTriangle className="w-3 h-3 mr-0.5" />Prazo
                            </Badge>
                          )}
                        </div>
                        {c.grupo && c.grupo !== c.nome && (
                          <p className="text-[11px] text-muted-foreground">Grupo: {c.grupo}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {c.responsavelNome ? `Responsável: ${c.responsavelNome}` : "Aguardando distribuição"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.operacoes} contrato(s){c.saldo > 0 ? ` · ${brl(c.saldo)}` : ""}
                        </p>
                        {c.docsTotal > 0 && (
                          <p className="text-[11px] text-muted-foreground">Documentos: {c.docsOk}/{c.docsTotal}</p>
                        )}
                        <p className="text-[11px] font-medium text-primary">{c.proximoPasso}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
