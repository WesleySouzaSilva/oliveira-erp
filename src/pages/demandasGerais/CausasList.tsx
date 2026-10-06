import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gavel, Plus, Search } from "lucide-react";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { CausaFormDialog } from "./CausaFormDialog";
import { MATERIAS, MATERIA_LABEL, STATUS_LIST, STATUS_MAP, type CausaAvulsa } from "./constants";

const fmtMoeda = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function CausasList() {
  const navigate = useNavigate();
  const { members } = useOrgMembers();
  const [rows, setRows] = useState<CausaAvulsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);

  const [filters, setFilters] = useUrlFilters({
    q: "",
    status: "todos",
    materia: "todas",
    responsavel: "todos",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("causas_avulsas")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    setRows((data ?? []) as CausaAvulsa[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const nomePorUser = useMemo(() => {
    const m = new Map<string, string>();
    (members || []).forEach((x) => m.set(x.user_id, x.nome || x.user_id.slice(0, 8)));
    return m;
  }, [members]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.status !== "todos" && r.status !== filters.status) return false;
      if (filters.materia !== "todas" && r.materia !== filters.materia) return false;
      if (filters.responsavel !== "todos") {
        if (filters.responsavel === "__none__") { if (r.responsavel_id) return false; }
        else if (r.responsavel_id !== filters.responsavel) return false;
      }
      if (q) {
        const hay = [r.titulo, r.cliente_nome, r.parte_contraria, r.numero_processo]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const today = new Date().toISOString().slice(0, 10);

  const columns: DataTableColumn<CausaAvulsa>[] = [
    {
      key: "cliente_nome", header: "Cliente", sortable: true,
      render: (r) => <span className="font-medium">{r.cliente_nome}</span>,
    },
    { key: "titulo", header: "Título", sortable: true },
    {
      key: "materia", header: "Matéria", sortable: true,
      render: (r) => <StatusBadge tone="neutral" label={MATERIA_LABEL[r.materia] ?? r.materia} />,
    },
    {
      key: "status", header: "Status", sortable: true,
      render: (r) => {
        const s = STATUS_MAP[r.status] ?? { tone: "neutral" as const, label: r.status };
        return <StatusBadge tone={s.tone} label={s.label} />;
      },
    },
    {
      key: "responsavel_id", header: "Responsável", sortable: true,
      sortAccessor: (r) => (r.responsavel_id ? nomePorUser.get(r.responsavel_id) ?? "" : ""),
      render: (r) => r.responsavel_id ? (nomePorUser.get(r.responsavel_id) ?? "—") : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "prazo", header: "Prazo", sortable: true,
      sortAccessor: (r) => r.prazo ?? "",
      render: (r) => {
        if (!r.prazo) return <span className="text-muted-foreground">—</span>;
        const vencido = r.prazo < today && !["concluido","arquivado"].includes(r.status);
        return (
          <span className={vencido ? "text-destructive font-semibold" : ""}>
            {fmtData(r.prazo)}
          </span>
        );
      },
    },
    {
      key: "valor_causa", header: "Valor", sortable: true, align: "right",
      sortAccessor: (r) => r.valor_causa ?? 0,
      render: (r) => fmtMoeda(r.valor_causa),
      initiallyHidden: false,
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        icon={Gavel}
        title="Causas Avulsas"
        subtitle="Trabalhos pontuais de outras matérias — trabalhista, cível, família, previdenciário, consumidor, outros."
        breadcrumb={[{ label: "Demandas complexas" }, { label: "Causas" }]}
        actions={
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova causa
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, título, processo…"
            className="pl-9"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => setFilters({ status: v })}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_LIST.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.materia} onValueChange={(v) => setFilters({ materia: v })}>
          <SelectTrigger><SelectValue placeholder="Matéria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as matérias</SelectItem>
            {MATERIAS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.responsavel} onValueChange={(v) => setFilters({ responsavel: v })}>
          <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos responsáveis</SelectItem>
            <SelectItem value="__none__">Sem responsável</SelectItem>
            {(members || []).map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        loading={loading}
        getRowId={(r) => r.id}
        defaultSort={{ key: "prazo", dir: "asc" }}
        onRowClick={(r) => navigate(`/causas/${r.id}`)}
        emptyState={{
          icon: Gavel,
          title: rows.length === 0 ? "Nenhuma causa cadastrada" : "Nenhuma causa com esses filtros",
          description: rows.length === 0
            ? "Cadastre trabalhos pontuais de outras matérias que não são do Agro nem da Consultoria Empresarial."
            : "Ajuste os filtros ou limpe a busca.",
          action: rows.length === 0 ? { label: "Nova causa", onClick: () => setOpenNew(true), icon: Plus } : undefined,
        }}
      />

      <CausaFormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onSaved={(id) => { load(); navigate(`/causas/${id}`); }}
      />
    </AppLayout>
  );
}