import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Landmark, LifeBuoy, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { CHAMADO_STATUS_LABEL, CHAMADO_TIPO_LABEL, type ChamadoStatus, type PortalChamado } from "@/hooks/usePortalCliente";
import { ChamadoStatusBadge, ChamadoTipoBadge, tempoRelativo } from "@/components/portal/portalUi";
import { cn } from "@/lib/utils";

type Linha = PortalChamado & { cliente_nome: string };

/**
 * Caixa de entrada dos chamados abertos pelos clientes no PORTAL.
 * Fila da equipe de pós-venda: filtra por status, tipo, responsável e cliente.
 */
export default function ChamadosPortal() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState("");

  const status = (params.get("status") || "abertos") as "abertos" | ChamadoStatus | "todos";
  const tipo = params.get("tipo") || "todos";
  const resp = params.get("resp") || "todos";

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (!v || v === "todos" || (k === "status" && v === "abertos")) p.delete(k); else p.set(k, v);
    setParams(p, { replace: true });
  };

  const chamados = useQuery({
    queryKey: ["chamados-internos", "lista"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const db = supabase as any;
      const { data: rows } = await db
        .from("portal_chamados")
        .select("*")
        .order("ultima_mensagem_em", { ascending: false })
        .limit(500);
      const ids = Array.from(new Set((rows || []).map((r: any) => r.cliente_id)));
      let nomes = new Map<string, string>();
      if (ids.length) {
        const { data: cls } = await supabase.from("clientes").select("id, nome").in("id", ids as string[]);
        nomes = new Map((cls || []).map((c) => [c.id, c.nome]));
      }
      return (rows || []).map((r: any) => ({ ...r, cliente_nome: nomes.get(r.cliente_id) || "Cliente" })) as Linha[];
    },
  });

  const nomeMembro = useMemo(() => new Map(members.map((m) => [m.user_id, m.nome || "Membro"])), [members]);

  const lista = useMemo(() => {
    let l = chamados.data || [];
    if (status === "abertos") l = l.filter((c) => c.status !== "resolvido");
    else if (status !== "todos") l = l.filter((c) => c.status === status);
    if (tipo !== "todos") l = l.filter((c) => c.tipo === tipo);
    if (resp === "meus") l = l.filter((c) => c.responsavel_id === user?.id);
    else if (resp === "sem") l = l.filter((c) => !c.responsavel_id);
    else if (resp !== "todos") l = l.filter((c) => c.responsavel_id === resp);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      l = l.filter((c) => c.titulo.toLowerCase().includes(q) || c.cliente_nome.toLowerCase().includes(q) || (c.banco || "").toLowerCase().includes(q));
    }
    const ordem: Record<ChamadoStatus, number> = { aberto: 0, em_andamento: 1, aguardando_cliente: 2, resolvido: 3 };
    return [...l].sort((a, b) => ordem[a.status] - ordem[b.status] || b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em));
  }, [chamados.data, status, tipo, resp, busca, user?.id]);

  const total = chamados.data || [];
  const kpis = {
    abertos: total.filter((c) => c.status === "aberto").length,
    banco: total.filter((c) => c.tipo === "banco" && c.status !== "resolvido").length,
    semResp: total.filter((c) => !c.responsavel_id && c.status !== "resolvido").length,
    meus: total.filter((c) => c.responsavel_id === user?.id && c.status !== "resolvido").length,
  };

  return (
    <AppLayout>
      <PageHeader
        icon={LifeBuoy}
        title="Chamados do portal"
        subtitle="O que os clientes abriram pelo Portal do Cliente: contatos do banco, dúvidas, documentos e pedidos de pós-venda."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi rotulo="Novos (sem resposta)" valor={kpis.abertos} onClick={() => setParam("status", "aberto")} ativo={status === "aberto"} />
        <Kpi rotulo="Contato do banco" valor={kpis.banco} tom="warning" onClick={() => setParam("tipo", "banco")} ativo={tipo === "banco"} />
        <Kpi rotulo="Sem responsável" valor={kpis.semResp} tom={kpis.semResp ? "danger" : undefined} onClick={() => setParam("resp", "sem")} ativo={resp === "sem"} />
        <Kpi rotulo="Meus" valor={kpis.meus} onClick={() => setParam("resp", "meus")} ativo={resp === "meus"} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, título ou banco" className="pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abertos">Em aberto</SelectItem>
            {(Object.keys(CHAMADO_STATUS_LABEL) as ChamadoStatus[]).map((s) => <SelectItem key={s} value={s}>{CHAMADO_STATUS_LABEL[s]}</SelectItem>)}
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={(v) => setParam("tipo", v)}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(CHAMADO_TIPO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={resp} onValueChange={(v) => setParam("resp", v)}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer responsável</SelectItem>
            <SelectItem value="meus">Meus</SelectItem>
            <SelectItem value="sem">Sem responsável</SelectItem>
            {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {chamados.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <EmptyState icon={Inbox} title="Nenhum chamado aqui" description="Quando um cliente abrir um chamado pelo portal, ele aparece nesta fila e o responsável de pós-venda é notificado." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {lista.map((c) => (
            <li key={c.id}>
              <Link to={`/pos-venda/chamados/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40">
                <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", c.tipo === "banco" ? "bg-warning/15 text-warning-foreground" : "bg-primary/8 text-primary")}>
                  {c.tipo === "banco" ? <Landmark className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{c.cliente_nome}</p>
                    <ChamadoTipoBadge tipo={c.tipo} />
                    {c.prioridade === "alta" && <StatusBadge tone="danger" size="sm">Alta</StatusBadge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.titulo}{c.banco ? ` · ${c.banco}` : ""}</p>
                </div>
                <div className="hidden sm:block text-right text-[11px] text-muted-foreground w-36 shrink-0">
                  <p className="truncate">{c.responsavel_id ? nomeMembro.get(c.responsavel_id) || "Membro" : "Sem responsável"}</p>
                  <p>{tempoRelativo(c.ultima_mensagem_em)}</p>
                </div>
                <ChamadoStatusBadge status={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  );
}

function Kpi({ rotulo, valor, tom, onClick, ativo }: { rotulo: string; valor: number; tom?: "warning" | "danger"; onClick: () => void; ativo: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border bg-card px-4 py-3 transition-colors hover:border-accent/60",
        ativo ? "border-accent" : "border-border",
      )}
    >
      <p className={cn("text-2xl font-semibold leading-none", tom === "danger" ? "text-destructive" : tom === "warning" ? "text-warning-foreground" : "text-foreground")}>{valor}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{rotulo}</p>
    </button>
  );
}
