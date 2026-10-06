import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";

type Empresa = {
  id: string;
  organizacao_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  setor: string | null;
  porte: string | null;
  status: "ativa" | "suspensa" | "encerrada";
  responsavel_id: string | null;
  created_at?: string;
};

const STATUS_STYLE: Record<string, string> = {
  ativa: "bg-primary/15 text-primary",
  suspensa: "bg-yellow-500/15 text-yellow-700",
  encerrada: "bg-muted text-muted-foreground",
};

export default function EmpresasConsultoria() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({ busca: "", ord: "recente" });
  const { busca } = filters;
  const ord = filters.ord as "recente" | "alfa";
  const [novoOpen, setNovoOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("empresas_consultoria")
      .select("id,organizacao_id,razao_social,nome_fantasia,cnpj,setor,porte,status,responsavel_id,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar empresas", description: error.message, variant: "destructive" });
    } else {
      setEmpresas((data || []) as Empresa[]);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let arr = empresas.filter((e) => {
      if (!q) return true;
      return [e.razao_social, e.nome_fantasia, e.cnpj, e.setor].some((v) => (v || "").toLowerCase().includes(q));
    });
    if (ord === "alfa") arr = [...arr].sort((a, b) => a.razao_social.localeCompare(b.razao_social));
    return arr;
  }, [empresas, busca, ord]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={Building2}
          title="Empresas"
          subtitle="Empresas em consultoria fixa (contrato mensal)"
          breadcrumb={[{ label: "Empresarial" }, { label: "Empresas" }]}
          actions={
            <Button onClick={() => setNovoOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova empresa
            </Button>
          }
        />

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setFilters({ busca: e.target.value })}
              placeholder="Buscar por razão social, fantasia, CNPJ ou setor..."
              className="pl-9"
            />
          </div>
          <Select value={ord} onValueChange={(v) => setFilters({ ord: v })}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recente">Mais recentes</SelectItem>
              <SelectItem value="alfa">Ordem alfabética</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable<Empresa>
          data={lista}
          loading={loading}
          getRowId={(e) => e.id}
          onRowClick={(e) => navigate(`/consultoria/empresas/${e.id}`)}
          tableId="empresas-consultoria"
          columnsToggle
          emptyState={{
            icon: Building2,
            title: "Nenhuma empresa cadastrada",
            description: "Cadastre a primeira empresa atendida em contrato de consultoria.",
            action: { label: "Nova empresa", icon: Plus, onClick: () => setNovoOpen(true) },
          }}
          columns={[
            {
              key: "razao_social",
              header: "Razão social",
              sortAccessor: (e) => e.razao_social,
              alwaysVisible: true,
              render: (e) => (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{e.razao_social}</div>
                    {e.nome_fantasia && (
                      <div className="text-xs text-muted-foreground truncate">{e.nome_fantasia}</div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "cnpj",
              header: "CNPJ",
              sortAccessor: (e) => e.cnpj,
              render: (e) => e.cnpj || "—",
            },
            {
              key: "setor",
              header: "Setor",
              sortAccessor: (e) => e.setor,
              render: (e) => e.setor || "—",
            },
            {
              key: "porte",
              header: "Porte",
              sortAccessor: (e) => e.porte,
              render: (e) => e.porte || "—",
            },
            {
              key: "status",
              header: "Status",
              sortAccessor: (e) => e.status,
              alwaysVisible: true,
              render: (e) => (
                <StatusBadge status={e.status} label={e.status} />
              ),
            },
          ] as DataTableColumn<Empresa>[]}
        />

        <NovaEmpresaDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          onSaved={(id) => { setNovoOpen(false); load(); navigate(`/consultoria/empresas/${id}`); }}
        />
      </div>
    </AppLayout>
  );
}

function NovaEmpresaDialog({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: (id: string) => void }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    razao_social: "", nome_fantasia: "", cnpj: "", setor: "", porte: "", observacoes: "",
  });

  const salvar = async () => {
    if (!user || !form.razao_social.trim()) return;
    setSaving(true);
    try {
      const { data: membro } = await supabase.from("membros").select("organizacao_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!membro?.organizacao_id) throw new Error("Sem organização vinculada.");
      const { data, error } = await (supabase as any).from("empresas_consultoria").insert({
        organizacao_id: membro.organizacao_id,
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia.trim() || null,
        cnpj: form.cnpj.trim() || null,
        setor: form.setor.trim() || null,
        porte: form.porte.trim() || null,
        observacoes: form.observacoes.trim() || null,
        created_by: user.id,
      }).select("id").single();
      if (error) throw error;
      toast({ title: "Empresa cadastrada" });
      onSaved(data.id);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif">Nova empresa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Razão social *</Label>
            <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome fantasia</Label>
              <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <MaskedInput mask="cnpj" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} placeholder="00.000.000/0000-00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Porte</Label>
              <Select value={form.porte} onValueChange={(v) => setForm({ ...form, porte: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEI">MEI</SelectItem>
                  <SelectItem value="ME">ME</SelectItem>
                  <SelectItem value="EPP">EPP</SelectItem>
                  <SelectItem value="Médio">Médio</SelectItem>
                  <SelectItem value="Grande">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={salvar}
            disabled={saving || !form.razao_social.trim()}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}