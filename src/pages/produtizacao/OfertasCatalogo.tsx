import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { CurrencyInput } from "@/components/CurrencyInput";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useIsCeo } from "@/hooks/useIsCeo";
import { toast } from "@/hooks/use-toast";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";

type Oferta = {
  id: string;
  organizacao_id: string;
  marca: "agro" | "juridico";
  modo: "assinatura" | "avulso";
  titulo: string;
  descricao: string | null;
  preco: number | null;
  publico: boolean;
  modo_contratacao: "solicitar" | "checkout";
  ativo: boolean;
  created_at: string;
};

const emptyForm = {
  marca: "juridico" as "agro" | "juridico",
  modo: "avulso" as "assinatura" | "avulso",
  titulo: "",
  descricao: "",
  preco: null as number | null,
  publico: false,
  modo_contratacao: "solicitar" as "solicitar" | "checkout",
  ativo: true,
};

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OfertasCatalogo() {
  const { user } = useAuth();
  const { orgId, isAdmin } = useOrgMembers();
  const { isCeo } = useIsCeo();
  const canWrite = isAdmin || isCeo; // coordenador é validado no RLS; UI segue papel mais comum
  const [rows, setRows] = useState<Oferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({ busca: "", marca: "todas", ativo: "todas" });
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Oferta | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("ofertas_catalogo")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    else setRows((data || []) as Oferta[]);
    setLoading(false);
  };
  useEffect(() => { if (user) load(); }, [user?.id]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDlgOpen(true); };
  const openEdit = (o: Oferta) => {
    setEditing(o);
    setForm({
      marca: o.marca, modo: o.modo, titulo: o.titulo, descricao: o.descricao || "",
      preco: o.preco, publico: o.publico, modo_contratacao: o.modo_contratacao, ativo: o.ativo,
    });
    setDlgOpen(true);
  };

  const salvar = async () => {
    if (!user || !orgId) return;
    if (!form.titulo.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        marca: form.marca,
        modo: form.modo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        preco: form.preco,
        publico: form.publico,
        modo_contratacao: form.modo_contratacao,
        ativo: form.ativo,
      };
      if (editing) {
        const { error } = await (supabase as any).from("ofertas_catalogo").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Oferta atualizada" });
      } else {
        const { error } = await (supabase as any).from("ofertas_catalogo").insert({
          ...payload, organizacao_id: orgId, created_by: user.id,
        });
        if (error) throw error;
        toast({ title: "Oferta criada" });
      }
      setDlgOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const excluir = async (o: Oferta) => {
    const ok = await confirm({
      title: "Excluir oferta?",
      description: `“${o.titulo}” será removida do catálogo.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await (supabase as any).from("ofertas_catalogo")
      .update({ deleted_at: new Date().toISOString() }).eq("id", o.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Excluída" }); load(); }
  };

  const lista = useMemo(() => {
    const q = filters.busca.trim().toLowerCase();
    return rows.filter((o) => {
      if (filters.marca !== "todas" && o.marca !== filters.marca) return false;
      if (filters.ativo === "ativas" && !o.ativo) return false;
      if (filters.ativo === "inativas" && o.ativo) return false;
      if (q && ![o.titulo, o.descricao || ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, filters]);

  const columns: DataTableColumn<Oferta>[] = [
    {
      key: "titulo", header: "Título", alwaysVisible: true,
      sortAccessor: (o) => o.titulo,
      render: (o) => (
        <div className="min-w-0">
          <div className="font-semibold truncate">{o.titulo}</div>
          {o.descricao && <div className="text-xs text-muted-foreground truncate">{o.descricao}</div>}
        </div>
      ),
    },
    {
      key: "marca", header: "Marca", sortAccessor: (o) => o.marca,
      render: (o) => (
        <Badge variant="outline" className={o.marca === "agro" ? "border-primary/40 text-primary" : "border-accent/40"}>
          {o.marca}
        </Badge>
      ),
    },
    { key: "modo", header: "Modo", sortAccessor: (o) => o.modo, render: (o) => o.modo },
    {
      key: "preco", header: "Preço",
      sortAccessor: (o) => o.preco ?? -1,
      render: (o) => (
        <div className="text-right tabular-nums">
          {formatBRL(o.preco)}
          {o.marca === "juridico" && o.publico && (
            <div className="text-[10px] text-muted-foreground">oculto no portal</div>
          )}
        </div>
      ),
      align: "right",
    },
    {
      key: "publico", header: "Público",
      sortAccessor: (o) => (o.publico ? 1 : 0),
      render: (o) => (o.publico ? <Badge>público</Badge> : <span className="text-muted-foreground text-xs">privado</span>),
    },
    {
      key: "modo_contratacao", header: "Contratação",
      sortAccessor: (o) => o.modo_contratacao,
      render: (o) => o.modo_contratacao,
    },
    {
      key: "ativo", header: "Status",
      sortAccessor: (o) => (o.ativo ? 1 : 0),
      render: (o) => o.ativo
        ? <Badge className="bg-primary/15 text-primary">ativa</Badge>
        : <Badge variant="outline">inativa</Badge>,
    },
    {
      key: "acoes", header: "", sortable: false,
      render: (o) => canWrite ? (
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(o); }}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); excluir(o); }}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ) : null,
      align: "right",
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={Package}
          title="Catálogo de Ofertas"
          subtitle="Produtos e serviços expostos no portal e/ou usados internamente."
          breadcrumb={[{ label: "Administração" }, { label: "Catálogo de Ofertas" }]}
          actions={canWrite ? (
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova oferta</Button>
          ) : null}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            className="max-w-sm"
            placeholder="Buscar por título ou descrição..."
            value={filters.busca}
            onChange={(e) => setFilters({ busca: e.target.value })}
          />
          <Select value={filters.marca} onValueChange={(v) => setFilters({ marca: v })}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as marcas</SelectItem>
              <SelectItem value="agro">Agro</SelectItem>
              <SelectItem value="juridico">Jurídico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.ativo} onValueChange={(v) => setFilters({ ativo: v })}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="ativas">Ativas</SelectItem>
              <SelectItem value="inativas">Inativas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable<Oferta>
          data={lista}
          loading={loading}
          getRowId={(o) => o.id}
          onRowClick={canWrite ? openEdit : undefined}
          tableId="ofertas-catalogo"
          columnsToggle
          emptyState={{
            icon: Package,
            title: "Nenhuma oferta cadastrada",
            description: canWrite
              ? "Crie a primeira oferta para exibir no portal ou usar em pedidos internos."
              : "Só admin/coordenador pode cadastrar ofertas.",
            action: canWrite ? { label: "Nova oferta", icon: Plus, onClick: openNew } : undefined,
          }}
          columns={columns}
        />

        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">{editing ? "Editar oferta" : "Nova oferta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Marca</Label>
                  <Select value={form.marca} onValueChange={(v: any) => setForm({ ...form, marca: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="juridico">Jurídico</SelectItem>
                      <SelectItem value="agro">Agro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Modo</Label>
                  <Select value={form.modo} onValueChange={(v: any) => setForm({ ...form, modo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assinatura">Assinatura</SelectItem>
                      <SelectItem value="avulso">Avulso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Preço</Label>
                  <CurrencyInput value={form.preco} onChange={(v) => setForm({ ...form, preco: v })} />
                  {form.marca === "juridico" && form.publico && (
                    <p className="text-[11px] text-muted-foreground">
                      Ofertas jurídicas não expõem o preço no portal — apenas para uso interno.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Modo de contratação</Label>
                  <Select value={form.modo_contratacao} onValueChange={(v: any) => setForm({ ...form, modo_contratacao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solicitar">Solicitar (fluxo de pedido)</SelectItem>
                      <SelectItem value="checkout">Checkout (Fase 2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Público no portal</div>
                  <div className="text-xs text-muted-foreground">Aparece na loja/catálogo do cliente.</div>
                </div>
                <Switch checked={form.publico} onCheckedChange={(v) => setForm({ ...form, publico: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Ativa</div>
                  <div className="text-xs text-muted-foreground">Ofertas inativas ficam ocultas em qualquer lugar.</div>
                </div>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving || !form.titulo.trim()}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}