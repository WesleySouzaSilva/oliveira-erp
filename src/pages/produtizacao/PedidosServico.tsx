import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { Inbox } from "lucide-react";

type Pedido = {
  id: string;
  organizacao_id: string;
  empresa_id: string | null;
  cliente_id: string | null;
  oferta_id: string | null;
  marca: "agro" | "juridico";
  titulo: string | null;
  status: "solicitado" | "em_analise" | "proposta_enviada" | "aceito" | "recusado" | "concluido";
  origem: "portal" | "interno";
  observacao: string | null;
  responsavel_id: string | null;
  created_at: string;
  _empresa?: string | null;
  _cliente?: string | null;
  _oferta?: string | null;
};

const STATUS_OPTS: Pedido["status"][] = [
  "solicitado", "em_analise", "proposta_enviada", "aceito", "recusado", "concluido",
];

const STATUS_STYLE: Record<Pedido["status"], string> = {
  solicitado: "bg-blue-500/15 text-blue-700",
  em_analise: "bg-yellow-500/15 text-yellow-700",
  proposta_enviada: "bg-indigo-500/15 text-indigo-700",
  aceito: "bg-primary/15 text-primary",
  recusado: "bg-destructive/15 text-destructive",
  concluido: "bg-emerald-500/15 text-emerald-700",
};

export default function PedidosServico() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [rows, setRows] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({ busca: "", status: "todos", marca: "todas", origem: "todas" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("pedidos_servico")
      .select("id,organizacao_id,empresa_id,cliente_id,oferta_id,marca,titulo,status,origem,observacao,responsavel_id,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) { toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" }); setLoading(false); return; }
    const list = (data || []) as Pedido[];

    // Batch fetch labels (empresa/cliente/oferta)
    const empresaIds = Array.from(new Set(list.map((p) => p.empresa_id).filter(Boolean))) as string[];
    const clienteIds = Array.from(new Set(list.map((p) => p.cliente_id).filter(Boolean))) as string[];
    const ofertaIds = Array.from(new Set(list.map((p) => p.oferta_id).filter(Boolean))) as string[];

    const [emp, cli, ofe] = await Promise.all([
      empresaIds.length
        ? (supabase as any).from("empresas_consultoria").select("id,nome_fantasia,razao_social").in("id", empresaIds)
        : Promise.resolve({ data: [] }),
      clienteIds.length
        ? (supabase as any).from("clientes").select("id,nome").in("id", clienteIds)
        : Promise.resolve({ data: [] }),
      ofertaIds.length
        ? (supabase as any).from("ofertas_catalogo").select("id,titulo").in("id", ofertaIds)
        : Promise.resolve({ data: [] }),
    ]);

    const empMap = new Map((emp.data || []).map((e: any) => [e.id, e.nome_fantasia || e.razao_social]));
    const cliMap = new Map((cli.data || []).map((c: any) => [c.id, c.nome]));
    const ofeMap = new Map((ofe.data || []).map((o: any) => [o.id, o.titulo]));

    setRows(list.map((p) => ({
      ...p,
      _empresa: p.empresa_id ? (empMap.get(p.empresa_id) as string) : null,
      _cliente: p.cliente_id ? (cliMap.get(p.cliente_id) as string) : null,
      _oferta: p.oferta_id ? (ofeMap.get(p.oferta_id) as string) : p.titulo,
    })));
    setLoading(false);
  };
  useEffect(() => { if (user) load(); }, [user?.id]);

  const setStatus = async (id: string, status: Pedido["status"]) => {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    const { error } = await (supabase as any).from("pedidos_servico").update({ status }).eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); load(); }
  };

  const setResponsavel = async (id: string, responsavel_id: string | null) => {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, responsavel_id } : p)));
    const { error } = await (supabase as any).from("pedidos_servico").update({ responsavel_id }).eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar responsável", description: error.message, variant: "destructive" }); load(); }
  };

  const lista = useMemo(() => {
    const q = filters.busca.trim().toLowerCase();
    return rows.filter((p) => {
      if (filters.status !== "todos" && p.status !== filters.status) return false;
      if (filters.marca !== "todas" && p.marca !== filters.marca) return false;
      if (filters.origem !== "todas" && p.origem !== filters.origem) return false;
      if (q && ![p._empresa, p._cliente, p._oferta, p.titulo, p.observacao].some((v) => (v || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, filters]);

  const columns: DataTableColumn<Pedido>[] = [
    {
      key: "titulo", header: "Pedido", alwaysVisible: true,
      sortAccessor: (p) => p._oferta || p.titulo,
      render: (p) => (
        <div className="min-w-0">
          <div className="font-semibold truncate">{p._oferta || p.titulo || "—"}</div>
          {p.observacao && <div className="text-xs text-muted-foreground truncate">{p.observacao}</div>}
        </div>
      ),
    },
    {
      key: "empresa", header: "Empresa / Cliente",
      sortAccessor: (p) => p._empresa || p._cliente,
      render: (p) => p._empresa || p._cliente || "—",
    },
    {
      key: "marca", header: "Marca",
      sortAccessor: (p) => p.marca,
      render: (p) => <Badge variant="outline">{p.marca}</Badge>,
    },
    {
      key: "origem", header: "Origem",
      sortAccessor: (p) => p.origem,
      render: (p) => (
        <Badge variant={p.origem === "portal" ? "default" : "outline"} className="text-xs">
          {p.origem}
        </Badge>
      ),
    },
    {
      key: "status", header: "Status", alwaysVisible: true,
      sortAccessor: (p) => p.status,
      render: (p) => (
        <Select value={p.status} onValueChange={(v) => setStatus(p.id, v as any)}>
          <SelectTrigger className={`h-8 w-[170px] ${STATUS_STYLE[p.status]}`} onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "responsavel", header: "Responsável",
      sortAccessor: (p) => p.responsavel_id,
      render: (p) => (
        <Select
          value={p.responsavel_id || "__none"}
          onValueChange={(v) => setResponsavel(p.id, v === "__none" ? null : v)}
        >
          <SelectTrigger className="h-8 w-[180px]" onClick={(e) => e.stopPropagation()}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— sem responsável —</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "created_at", header: "Recebido",
      sortAccessor: (p) => p.created_at,
      render: (p) => new Date(p.created_at).toLocaleDateString("pt-BR"),
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={Inbox}
          title="Pedidos de Serviço"
          subtitle="Solicitações vindas do portal ou lançadas internamente."
          breadcrumb={[{ label: "Administração" }, { label: "Pedidos" }]}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            className="max-w-sm"
            placeholder="Buscar por empresa, cliente, oferta ou observação..."
            value={filters.busca}
            onChange={(e) => setFilters({ busca: e.target.value })}
          />
          <Select value={filters.status} onValueChange={(v) => setFilters({ status: v })}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.marca} onValueChange={(v) => setFilters({ marca: v })}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas marcas</SelectItem>
              <SelectItem value="agro">Agro</SelectItem>
              <SelectItem value="juridico">Jurídico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.origem} onValueChange={(v) => setFilters({ origem: v })}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda origem</SelectItem>
              <SelectItem value="portal">Portal</SelectItem>
              <SelectItem value="interno">Interno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable<Pedido>
          data={lista}
          loading={loading}
          getRowId={(p) => p.id}
          tableId="pedidos-servico"
          columnsToggle
          emptyState={{
            icon: Inbox,
            title: "Nenhum pedido",
            description: "Quando um cliente solicitar uma oferta pelo portal, aparece aqui.",
          }}
          columns={columns}
        />
      </div>
    </AppLayout>
  );
}