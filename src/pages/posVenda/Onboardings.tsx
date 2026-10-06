import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClipboardCheck, Plus, Search, CheckCircle2, Clock, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { undoableDelete } from "@/lib/undoable";


import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";

type Row = {
  id: string;
  cliente_nome: string;
  cliente_contato: string | null;
  status: string;
  iniciado_em: string;
  concluido_em: string | null;
  total: number;
  ok: number;
};

export default function PosVendaOnboardings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({ busca: "" });
  const { busca } = filters;
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoContato, setNovoContato] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<Row | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data: ons } = await supabase
      .from("pos_venda_onboardings")
      .select("id, cliente_nome, cliente_contato, status, iniciado_em, concluido_em")
      .is("deleted_at", null)
      .order("iniciado_em", { ascending: false })
      .limit(200);
    const list = (ons as any[]) || [];
    if (list.length) {
      const ids = list.map((o) => o.id);
      const { data: itens } = await supabase
        .from("pos_venda_checklist_itens")
        .select("onboarding_id, status")
        .is("arquivado_em", null)
        .in("onboarding_id", ids);
      const stats = new Map<string, { total: number; ok: number }>();
      (itens as any[] || []).forEach((it) => {
        const s = stats.get(it.onboarding_id) || { total: 0, ok: 0 };
        s.total++;
        if (["ok", "conferido", "recebido", "nao_aplica", "dispensado"].includes(it.status)) s.ok++;
        stats.set(it.onboarding_id, s);
      });
      setRows(list.map((o) => ({ ...o, ...(stats.get(o.id) || { total: 0, ok: 0 }) })));
    } else {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const criar = async () => {
    if (!user || !novoNome.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const { data: m } = await supabase.from("membros").select("organizacao_id").eq("user_id", user.id).limit(1).maybeSingle();
      const orgId = m?.organizacao_id ?? null;
      const { data: ob, error } = await supabase
        .from("pos_venda_onboardings")
        .insert({
          responsavel_id: user.id,
          organizacao_id: orgId,
          cliente_nome: novoNome.trim(),
          cliente_contato: novoContato.trim() || null,
          status: "aberto",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Onboarding criado", description: "Responda as perguntas iniciais para gerar o checklist." });
      setNovoOpen(false);
      setNovoNome(""); setNovoContato("");
      navigate(`/pos-venda/onboarding/${ob.id}`);
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async (r: Row) => {
    setExcluir(null);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    await undoableDelete({
      label: `Onboarding de ${r.cliente_nome}`,
      commit: async () => {
        const { error } = await supabase
          .from("pos_venda_onboardings")
          .update({ deleted_at: new Date().toISOString(), deleted_motivo: "excluído pelo usuário" })
          .eq("id", r.id);
        if (error) throw error;
      },
      restore: async () => {
        const { error } = await supabase
          .from("pos_venda_onboardings")
          .update({ deleted_at: null, deleted_motivo: null })
          .eq("id", r.id);
        if (error) throw error;
        await carregar();
      },
    });
  };

  const filtradas = rows.filter((r) =>
    !busca.trim() || r.cliente_nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={ClipboardCheck}
          title="Onboarding Pós-Venda"
          subtitle="Checklist de documentação para alongamento bancário rural — organize tudo o que o cliente precisa entregar para o caso avançar."
          breadcrumb={[{ label: "Agro" }, { label: "Pós-Venda" }, { label: "Onboardings" }]}
          actions={
            <Button onClick={() => setNovoOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo onboarding
            </Button>
          }
        />

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setFilters({ busca: e.target.value })} placeholder="Buscar cliente" className="pl-9" />
          </div>
        </Card>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhum onboarding aberto"
            description="Inicie o onboarding ao fechar um novo cliente."
            action={{ label: "Novo onboarding", icon: Plus, onClick: () => setNovoOpen(true) }}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtradas.map((r) => {
              const pct = r.total ? Math.round((r.ok / r.total) * 100) : 0;
              return (
                <Card
                  key={r.id}
                  className="p-4 space-y-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => navigate(`/pos-venda/onboarding/${r.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm">{r.cliente_nome}</div>
                    <div className="flex items-center gap-1">
                      <Badge variant={r.status === "concluido" ? "default" : "outline"} className="text-[10px]">
                        {r.status === "concluido" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                        {r.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir onboarding de ${r.cliente_nome}`}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setExcluir(r); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {r.cliente_contato && <div className="text-xs text-muted-foreground">{r.cliente_contato}</div>}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Documentação</span>
                      <span className="font-medium">{r.ok}/{r.total} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground pt-1 border-t">
                    Iniciado em {new Date(r.iniciado_em).toLocaleDateString("pt-BR")}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              O onboarding de {excluir?.cliente_nome} sai da lista. Você tem alguns segundos para desfazer,
              e o registro fica guardado para consulta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && confirmarExclusao(excluir)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo onboarding pós-venda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome completo / razão social" />
            </div>
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <Input value={novoContato} onChange={(e) => setNovoContato(e.target.value)} placeholder="Telefone / e-mail" />
            </div>
            <p className="text-xs text-muted-foreground">
              Depois de criar, responda as perguntas iniciais para o sistema montar o checklist das 4 etapas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando}>{salvando ? "Criando..." : "Criar e abrir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}