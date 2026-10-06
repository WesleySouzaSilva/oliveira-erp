import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Search, ShieldAlert, UserCog, Tag } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DemandaExternaDialog } from "@/components/consultoria/DemandaExternaDialog";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { toast } from "@/hooks/use-toast";

export type DemandaExterna = {
  id: string;
  empresa_id: string;
  titulo: string;
  tipo: string;
  parte_contraria: string | null;
  valor: number | null;
  status: string;
  responsavel_id: string | null;
  prazo: string | null;
  descricao: string | null;
  empresa?: { razao_social: string; nome_fantasia: string | null } | null;
};

export const TIPOS = [
  { v: "cobranca", l: "Cobrança" },
  { v: "acao_judicial", l: "Ação judicial" },
  { v: "notificacao", l: "Notificação" },
  { v: "divida", l: "Dívida" },
  { v: "outro", l: "Outro" },
];
export const STATUS = [
  { v: "aberta", l: "Aberta" },
  { v: "em_negociacao", l: "Em negociação" },
  { v: "acordo_proposto", l: "Acordo proposto" },
  { v: "acordo_fechado", l: "Acordo fechado" },
  { v: "judicializada", l: "Judicializada" },
  { v: "encerrada", l: "Encerrada" },
];
export const STATUS_STYLE: Record<string, string> = {
  aberta: "bg-yellow-500/15 text-yellow-700",
  em_negociacao: "bg-blue-500/15 text-blue-700",
  acordo_proposto: "bg-purple-500/15 text-purple-700",
  acordo_fechado: "bg-primary/15 text-primary",
  judicializada: "bg-red-500/15 text-red-700",
  encerrada: "bg-muted text-muted-foreground",
};

const fmtBRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DemandasExternas() {
  const navigate = useNavigate();
  const { members } = useOrgMembers();
  const [rows, setRows] = useState<DemandaExterna[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaOpen, setNovaOpen] = useState(false);

  const [filters, setFilters] = useUrlFilters({
    q: "",
    fStatus: "todos",
    fTipo: "todos",
    fEmpresa: "todas",
  });
  const { q, fStatus, fTipo, fEmpresa } = filters;

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("empresa_demandas_externas")
      .select("id,empresa_id,titulo,tipo,parte_contraria,valor,status,responsavel_id,prazo,descricao,empresa:empresas_consultoria(razao_social,nome_fantasia)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setRows((data || []) as DemandaExterna[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const bulkAtribuir = async (ids: string[], userId: string | null) => {
    const { error } = await (supabase as any)
      .from("empresa_demandas_externas")
      .update({ responsavel_id: userId })
      .in("id", ids);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, responsavel_id: userId } : r));
    toast({ title: `${ids.length} demanda(s) atualizada(s)` });
  };
  const bulkStatus = async (ids: string[], status: string) => {
    const { error } = await (supabase as any)
      .from("empresa_demandas_externas")
      .update({ status })
      .in("id", ids);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status } : r));
    toast({ title: `Status atualizado em ${ids.length} item(ns)` });
  };

  const empresasOpts = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.empresa) m.set(r.empresa_id, r.empresa.nome_fantasia || r.empresa.razao_social);
    });
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus !== "todos" && r.status !== fStatus) return false;
      if (fTipo !== "todos" && r.tipo !== fTipo) return false;
      if (fEmpresa !== "todas" && r.empresa_id !== fEmpresa) return false;
      if (!term) return true;
      const hay = `${r.titulo} ${r.parte_contraria ?? ""} ${r.empresa?.razao_social ?? ""} ${r.empresa?.nome_fantasia ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, fStatus, fTipo, fEmpresa]);

  const respNome = (id: string | null) =>
    !id ? "—" : (members.find((m) => m.user_id === id)?.nome || "—");

  const columns: DataTableColumn<DemandaExterna>[] = [
    {
      key: "empresa", header: "Empresa",
      render: (r) => r.empresa?.nome_fantasia || r.empresa?.razao_social || "—",
      sortAccessor: (r) => r.empresa?.nome_fantasia || r.empresa?.razao_social || "",
      alwaysVisible: true,
    },
    { key: "titulo", header: "Título", render: (r) => r.titulo, sortAccessor: (r) => r.titulo, alwaysVisible: true },
    { key: "tipo", header: "Tipo",
      render: (r) => TIPOS.find((t) => t.v === r.tipo)?.l ?? r.tipo,
      sortAccessor: (r) => r.tipo },
    { key: "parte_contraria", header: "Parte contrária",
      render: (r) => r.parte_contraria ?? "—",
      sortAccessor: (r) => r.parte_contraria ?? "" },
    { key: "valor", header: "Valor", align: "right",
      render: (r) => fmtBRL(r.valor),
      sortAccessor: (r) => r.valor ?? null },
    { key: "status", header: "Status",
      render: (r) => (
        <StatusBadge
          status={r.status}
          label={STATUS.find((s) => s.v === r.status)?.l ?? r.status}
        />
      ),
      sortAccessor: (r) => r.status, alwaysVisible: true },
    { key: "responsavel", header: "Responsável",
      render: (r) => respNome(r.responsavel_id),
      sortAccessor: (r) => respNome(r.responsavel_id) },
    { key: "prazo", header: "Prazo",
      render: (r) => r.prazo ? new Date(r.prazo).toLocaleDateString("pt-BR") : "—",
      sortAccessor: (r) => r.prazo ? new Date(r.prazo) : null },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={ShieldAlert}
          title="Demandas externas & Acordos"
          subtitle="Cobranças, ações e dívidas que vêm de fora contra as empresas atendidas."
          breadcrumb={[{ label: "Empresarial" }, { label: "Demandas externas" }]}
          actions={
            <Button onClick={() => setNovaOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova demanda externa
            </Button>
          }
        />

        <Card className="p-4 grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setFilters({ q: e.target.value })} placeholder="Buscar..." className="pl-8" />
          </div>
          <Select value={fStatus} onValueChange={(v) => setFilters({ fStatus: v })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTipo} onValueChange={(v) => setFilters({ fTipo: v })}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fEmpresa} onValueChange={(v) => setFilters({ fEmpresa: v })}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {empresasOpts.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>

        <DataTable
          data={filtered}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          onRowClick={(r) => navigate(`/consultoria/demandas-externas/${r.id}`)}
          defaultSort={{ key: "prazo", dir: "asc" }}
          selectable
          tableId="demandas-externas"
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
                    {STATUS.map((s) => (
                      <DropdownMenuItem key={s.v} onClick={async () => { await bulkStatus(ids, s.v); clear(); }}>
                        {s.l}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            );
          }}
          emptyState={{
            icon: ShieldAlert,
            title: "Nenhuma demanda externa",
            description: "Cadastre cobranças, notificações e ações contra empresas atendidas.",
            action: { label: "Nova demanda externa", icon: Plus, onClick: () => setNovaOpen(true) },
          }}
        />

        <DemandaExternaDialog
          open={novaOpen}
          onClose={() => setNovaOpen(false)}
          onSaved={() => { setNovaOpen(false); load(); }}
        />
      </div>
    </AppLayout>
  );
}