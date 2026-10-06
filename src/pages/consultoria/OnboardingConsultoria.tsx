import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Plus, Search, CheckCircle2, Clock, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { ONBOARDING_CONSULTORIA_TEMPLATE } from "@/data/onboardingConsultoriaTemplate";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";

type Row = {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  status: "em_andamento" | "concluido";
  responsavel_id: string | null;
  responsavel_nome: string | null;
  iniciado_em: string;
  total: number;
  ok: number;
};

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null; organizacao_id: string };
type Avenca = { id: string; titulo: string | null; empresa_id: string };

export default function OnboardingConsultoria() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({ busca: "", filtroStatus: "todos" });
  const { busca, filtroStatus } = filters;

  const [novoOpen, setNovoOpen] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [avencas, setAvencas] = useState<Avenca[]>([]);
  const [empresaSel, setEmpresaSel] = useState<string>("");
  const [avencaSel, setAvencaSel] = useState<string>("");
  const [responsavelSel, setResponsavelSel] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data: obs } = await (supabase as any)
      .from("consultoria_onboarding")
      .select("id, empresa_id, status, responsavel_id, iniciado_em")
      .is("deleted_at", null)
      .order("iniciado_em", { ascending: false })
      .limit(200);

    const list = (obs as any[]) || [];
    if (!list.length) { setRows([]); setLoading(false); return; }

    const empresaIds = Array.from(new Set(list.map((o) => o.empresa_id)));
    const obIds = list.map((o) => o.id);

    const [{ data: emps }, { data: itens }, { data: profs }] = await Promise.all([
      (supabase as any).from("empresas_consultoria")
        .select("id, razao_social, nome_fantasia").in("id", empresaIds),
      (supabase as any).from("consultoria_onboarding_itens")
        .select("onboarding_id, concluido").in("onboarding_id", obIds),
      (supabase as any).from("profiles_publico")
        .select("id, nome").in("id", list.map((o) => o.responsavel_id).filter(Boolean)),
    ]);

    const empMap = new Map<string, Empresa>((emps || []).map((e: any) => [e.id, e]));
    const profMap = new Map<string, string>((profs || []).map((p: any) => [p.id, p.nome]));
    const stats = new Map<string, { total: number; ok: number }>();
    ((itens as any[]) || []).forEach((it) => {
      const s = stats.get(it.onboarding_id) || { total: 0, ok: 0 };
      s.total++;
      if (it.concluido) s.ok++;
      stats.set(it.onboarding_id, s);
    });

    setRows(list.map((o: any) => {
      const e = empMap.get(o.empresa_id);
      return {
        id: o.id,
        empresa_id: o.empresa_id,
        empresa_nome: e?.nome_fantasia || e?.razao_social || "Empresa",
        status: o.status,
        responsavel_id: o.responsavel_id,
        responsavel_nome: o.responsavel_id ? (profMap.get(o.responsavel_id) || null) : null,
        iniciado_em: o.iniciado_em,
        ...(stats.get(o.id) || { total: 0, ok: 0 }),
      };
    }));
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = async () => {
    setEmpresaSel(""); setAvencaSel(""); setResponsavelSel(user?.id || "");
    setNovoOpen(true);
    const { data: emps } = await (supabase as any)
      .from("empresas_consultoria")
      .select("id, razao_social, nome_fantasia, organizacao_id")
      .is("deleted_at", null)
      .order("razao_social");
    setEmpresas((emps as any[]) || []);
  };

  useEffect(() => {
    if (!empresaSel) { setAvencas([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("avencas")
        .select("id, titulo, empresa_id")
        .eq("empresa_id", empresaSel)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setAvencas((data as any[]) || []);
    })();
  }, [empresaSel]);

  const criar = async () => {
    if (!user || !empresaSel) {
      toast({ title: "Selecione uma empresa", variant: "destructive" });
      return;
    }
    const emp = empresas.find((e) => e.id === empresaSel);
    if (!emp) return;
    setSalvando(true);
    try {
      const { data: ob, error } = await (supabase as any)
        .from("consultoria_onboarding")
        .insert({
          organizacao_id: emp.organizacao_id,
          empresa_id: emp.id,
          avenca_id: avencaSel || null,
          responsavel_id: responsavelSel || user.id,
          status: "em_andamento",
        })
        .select("id")
        .single();
      if (error) throw error;
      const itens = ONBOARDING_CONSULTORIA_TEMPLATE.map((titulo, idx) => ({
        organizacao_id: emp.organizacao_id,
        onboarding_id: ob.id,
        titulo,
        ordem: idx + 1,
      }));
      const { error: e2 } = await (supabase as any)
        .from("consultoria_onboarding_itens").insert(itens);
      if (e2) throw e2;
      toast({ title: "Onboarding iniciado", description: `${itens.length} itens criados.` });
      setNovoOpen(false);
      navigate(`/consultoria/onboarding/${ob.id}`);
    } catch (e: any) {
      toast({ title: "Erro ao iniciar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const filtradas = useMemo(() => rows.filter((r) => {
    if (filtroStatus !== "todos" && r.status !== filtroStatus) return false;
    if (busca.trim() && !r.empresa_nome.toLowerCase().includes(busca.trim().toLowerCase())) return false;
    return true;
  }), [rows, busca, filtroStatus]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={ClipboardCheck}
          title="Onboarding Empresarial"
          subtitle="Checklist de início quando uma empresa fecha contrato de consultoria. Garante kickoff, documentação, escopo e portal configurados."
          breadcrumb={[{ label: "Empresarial" }, { label: "Onboarding" }]}
          actions={
            <Button onClick={abrirNovo}>
              <Plus className="w-4 h-4 mr-2" /> Iniciar onboarding
            </Button>
          }
        />

        <Card className="p-3 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setFilters({ busca: e.target.value })} placeholder="Buscar empresa" className="pl-9" />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => setFilters({ filtroStatus: v })}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhum onboarding ainda"
            description="Inicie o onboarding ao fechar um novo contrato de consultoria."
            action={{ label: "Iniciar onboarding", icon: Plus, onClick: () => setNovoOpen(true) }}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtradas.map((r) => {
              const pct = r.total ? Math.round((r.ok / r.total) * 100) : 0;
              return (
                <Card key={r.id}
                  className="p-4 space-y-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => navigate(`/consultoria/onboarding/${r.id}`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold text-sm truncate">{r.empresa_nome}</span>
                    </div>
                    <Badge variant={r.status === "concluido" ? "default" : "outline"} className="text-[10px]">
                      {r.status === "concluido"
                        ? <CheckCircle2 className="w-3 h-3 mr-1" />
                        : <Clock className="w-3 h-3 mr-1" />}
                      {r.status === "concluido" ? "Concluído" : "Em andamento"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Checklist</span>
                      <span className="font-medium">{r.ok}/{r.total} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground pt-1 border-t flex justify-between">
                    <span>Iniciado {new Date(r.iniciado_em).toLocaleDateString("pt-BR")}</span>
                    <span>{r.responsavel_nome || "—"}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Iniciar onboarding empresarial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Empresa *</Label>
              <Select value={empresaSel} onValueChange={setEmpresaSel}>
                <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contrato de consultoria (opcional)</Label>
              <Select value={avencaSel} onValueChange={setAvencaSel} disabled={!empresaSel || avencas.length === 0}>
                <SelectTrigger><SelectValue placeholder={avencas.length ? "Vincule um contrato" : "Sem contratos nesta empresa"} /></SelectTrigger>
                <SelectContent>
                  {avencas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.titulo || "Contrato de consultoria"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={responsavelSel} onValueChange={setResponsavelSel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.papel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Serão criados <strong>{ONBOARDING_CONSULTORIA_TEMPLATE.length}</strong> itens padrão de checklist. Você pode adicionar, marcar ou remover itens depois.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando || !empresaSel}
              className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {salvando ? "Criando..." : "Iniciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}