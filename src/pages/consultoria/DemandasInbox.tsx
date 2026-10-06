import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Inbox, List, LayoutGrid, UserCog, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  NovaDemandaDialog, STATUS_LABEL,
} from "@/components/consultoria/NovaDemandaDialog";
import { DemandaKanban } from "@/components/consultoria/DemandaKanban";
import { toast } from "@/hooks/use-toast";
import { ListSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Demanda = {
  id: string;
  assunto: string;
  area: string | null;
  prioridade: string;
  status: string;
  responsavel_id: string | null;
  prazo: string | null;
  created_at: string;
  empresa_id: string;
  empresa: { razao_social: string; nome_fantasia: string | null } | null;
};

const PRIORIDADE_ORDER = ["urgente", "alta", "media", "baixa"];
const PRIORIDADE_LABEL: Record<string, string> = {
  urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa",
};
const STATUS_LIST = ["aberta", "em_analise", "aguardando_empresa", "concluida", "cancelada"];

export default function DemandasInbox() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { members } = useOrgMembers();
  const [rows, setRows] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaOpen, setNovaOpen] = useState(false);

  const [filters, setFilters] = useUrlFilters({
    q: "",
    fStatus: "abertas",
    fPrio: "todas",
    fResp: "todos",
    fEmpresa: "todas",
    ordem: "prazo",
  });
  const { q, fStatus, fPrio, fResp, fEmpresa } = filters;

  const [view, setView] = useState<"lista" | "quadro">(() => {
    if (typeof window === "undefined") return "lista";
    return (window.localStorage.getItem("demandas:view") as "lista" | "quadro") || "lista";
  });
  const setViewPersist = (v: "lista" | "quadro") => {
    setView(v);
    try { window.localStorage.setItem("demandas:view", v); } catch { /* ignore */ }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("consultoria_demandas")
      .select("id,assunto,area,prioridade,status,responsavel_id,prazo,created_at,empresa_id,empresa:empresas_consultoria(razao_social,nome_fantasia)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!error) setRows((data || []) as Demanda[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Move status com optimistic update; reverte em erro.
  const moverStatus = async (id: string, newStatus: string) => {
    const prev = rows;
    const patch: any = { status: newStatus };
    if (newStatus === "concluida") patch.concluida_em = new Date().toISOString();
    const wasConcluida = rows.find((r) => r.id === id)?.status === "concluida";
    if (wasConcluida && newStatus !== "concluida") patch.concluida_em = null;

    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    const { error } = await (supabase as any)
      .from("consultoria_demandas")
      .update(patch)
      .eq("id", id);
    if (error) {
      setRows(prev);
      toast({ title: "Não foi possível mover", description: error.message, variant: "destructive" });
    }
  };

  const bulkAtribuir = async (ids: string[], userId: string | null) => {
    const ok = await confirm({
      title: userId ? "Atribuir responsável?" : "Remover responsável?",
      description: `Essa ação será aplicada em ${ids.length} demanda(s).`,
    });
    if (!ok) return;
    const { error } = await (supabase as any)
      .from("consultoria_demandas")
      .update({ responsavel_id: userId })
      .in("id", ids);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, responsavel_id: userId } : r));
    toast({ title: `${ids.length} demanda(s) atualizada(s)` });
  };

  const bulkStatus = async (ids: string[], status: string) => {
    const ok = await confirm({
      title: `Mudar status para "${STATUS_LABEL[status]}"?`,
      description: `Essa ação será aplicada em ${ids.length} demanda(s).`,
      destructive: status === "cancelada",
    });
    if (!ok) return;
    const patch: any = { status };
    if (status === "concluida") patch.concluida_em = new Date().toISOString();
    else patch.concluida_em = null;
    const { error } = await (supabase as any)
      .from("consultoria_demandas")
      .update(patch)
      .in("id", ids);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status } : r));
    toast({ title: `Status atualizado em ${ids.length} item(ns)` });
  };

  const empresasOpts = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.empresa) map.set(r.empresa_id, r.empresa.nome_fantasia || r.empresa.razao_social);
    });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const arr = rows.filter((r) => {
      if (fStatus === "abertas" && (r.status === "concluida" || r.status === "cancelada")) return false;
      if (fStatus !== "abertas" && fStatus !== "todas" && r.status !== fStatus) return false;
      if (fPrio !== "todas" && r.prioridade !== fPrio) return false;
      if (fResp !== "todos" && r.responsavel_id !== fResp) return false;
      if (fEmpresa !== "todas" && r.empresa_id !== fEmpresa) return false;
      if (term && !`${r.assunto} ${r.area || ""} ${r.empresa?.razao_social || ""} ${r.empresa?.nome_fantasia || ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
    return arr;
  }, [rows, q, fStatus, fPrio, fResp, fEmpresa]);

  const nomeResp = (uid: string | null) => {
    if (!uid) return "—";
    const m = members.find((x) => x.user_id === uid);
    return m?.nome || uid.slice(0, 8);
  };

  const columns: DataTableColumn<Demanda>[] = [
    {
      key: "assunto", header: "Assunto",
      render: (r) => <span className="font-medium text-primary hover:underline">{r.assunto}</span>,
      sortAccessor: (r) => r.assunto,
      alwaysVisible: true,
    },
    {
      key: "empresa", header: "Empresa",
      render: (r) => r.empresa?.nome_fantasia || r.empresa?.razao_social || "—",
      sortAccessor: (r) => r.empresa?.nome_fantasia || r.empresa?.razao_social || "",
    },
    {
      key: "area", header: "Área",
      render: (r) => r.area || "—",
      sortAccessor: (r) => r.area || "",
    },
    {
      key: "prioridade", header: "Prioridade",
      render: (r) => <StatusBadge status={r.prioridade} label={PRIORIDADE_LABEL[r.prioridade] ?? r.prioridade} />,
      // Ordena por severidade (urgente → baixa), não alfabética.
      sortAccessor: (r) => {
        const i = PRIORIDADE_ORDER.indexOf(r.prioridade);
        return i === -1 ? 999 : i;
      },
    },
    {
      key: "status", header: "Status",
      render: (r) => <StatusBadge status={r.status} label={STATUS_LABEL[r.status] ?? r.status} />,
      sortAccessor: (r) => r.status,
      alwaysVisible: true,
    },
    {
      key: "responsavel", header: "Responsável",
      render: (r) => nomeResp(r.responsavel_id),
      sortAccessor: (r) => nomeResp(r.responsavel_id),
    },
    {
      key: "prazo", header: "Prazo",
      render: (r) => {
        if (!r.prazo) return "—";
        const venc = Math.floor((new Date(r.prazo).getTime() - Date.now()) / 86400000);
        const cls = venc < 0 ? "text-destructive font-semibold" : venc <= 3 ? "text-amber-600 font-medium" : "";
        return (
          <span className={cls}>
            {new Date(r.prazo).toLocaleDateString("pt-BR")}
            <span className="text-xs text-muted-foreground ml-1">
              ({venc < 0 ? `${Math.abs(venc)}d atraso` : `${venc}d`})
            </span>
          </span>
        );
      },
      sortAccessor: (r) => r.prazo ? new Date(r.prazo) : null,
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={Inbox}
          title="Demandas de Consultoria"
          subtitle="Central de tickets das empresas com contrato de consultoria."
          breadcrumb={[{ label: "Empresarial" }, { label: "Demandas" }]}
          actions={
            <Button onClick={() => setNovaOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova demanda
            </Button>
          }
        />

        <Card className="p-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar assunto, empresa, área..." value={q} onChange={(e) => setFilters({ q: e.target.value })} />
          </div>
          <Select value={fStatus} onValueChange={(v) => setFilters({ fStatus: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="abertas">Abertas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="aguardando_empresa">Aguardando empresa</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fPrio} onValueChange={(v) => setFilters({ fPrio: v })}>
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas prioridades</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fResp} onValueChange={(v) => setFilters({ fResp: v })}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos responsáveis</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fEmpresa} onValueChange={(v) => setFilters({ fEmpresa: v })}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas empresas</SelectItem>
              {empresasOpts.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="md:col-span-6 flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setViewPersist("lista")}
                className={`px-3 py-1.5 text-xs flex items-center gap-1 transition ${
                  view === "lista" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/40"
                }`}
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button
                type="button"
                onClick={() => setViewPersist("quadro")}
                className={`px-3 py-1.5 text-xs flex items-center gap-1 transition border-l border-border ${
                  view === "quadro" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/40"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Quadro
              </button>
            </div>
            {view === "quadro" && (
              <span className="text-[11px] text-muted-foreground">
                Arraste cartões entre colunas para mudar o status.
              </span>
            )}
          </div>
        </Card>

        {view === "lista" ? (
          <DataTable
            data={filtered}
            columns={columns}
            loading={loading}
            getRowId={(r) => r.id}
            onRowClick={(r) => navigate(`/consultoria/demandas/${r.id}`)}
            defaultSort={{ key: "prazo", dir: "asc" }}
            selectable
            tableId="consultoria-demandas"
            columnsToggle
            bulkActions={(selRows, clear) => {
              const ids = selRows.map((r) => r.id);
              return (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7">
                        <UserCog className="w-3.5 h-3.5 mr-1" /> Atribuir
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-auto">
                      <DropdownMenuLabel>Atribuir responsável</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={async () => { await bulkAtribuir(ids, null); clear(); }}>
                        Remover responsável
                      </DropdownMenuItem>
                      {members.map((m) => (
                        <DropdownMenuItem key={m.user_id} onClick={async () => { await bulkAtribuir(ids, m.user_id); clear(); }}>
                          {m.nome || m.user_id.slice(0, 8)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7">
                        <Tag className="w-3.5 h-3.5 mr-1" /> Mudar status
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>Mudar status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {STATUS_LIST.map((s) => (
                        <DropdownMenuItem key={s} onClick={async () => { await bulkStatus(ids, s); clear(); }}>
                          {STATUS_LABEL[s]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              );
            }}
            emptyState={{
              icon: Inbox,
              title: "Nenhuma demanda",
              description: "Ajuste os filtros ou crie uma nova demanda.",
              action: { label: "Nova demanda", icon: Plus, onClick: () => setNovaOpen(true) },
            }}
          />
        ) : (
          loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <DemandaKanban
              demandas={filtered}
              members={members}
              onMoveStatus={moverStatus}
            />
          )
        )}

        <NovaDemandaDialog
          open={novaOpen}
          onClose={() => setNovaOpen(false)}
          onSaved={() => { setNovaOpen(false); load(); }}
        />
      </div>
    </AppLayout>
  );
}