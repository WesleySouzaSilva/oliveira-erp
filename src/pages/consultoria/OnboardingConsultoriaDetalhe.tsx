import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Plus, Trash2, Building2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";

type Item = {
  id: string; titulo: string; concluido: boolean; ordem: number;
  observacao: string | null; concluido_em: string | null;
};
type Onboarding = {
  id: string; organizacao_id: string; empresa_id: string; avenca_id: string | null;
  status: "em_andamento" | "concluido"; responsavel_id: string | null;
  iniciado_em: string; concluido_em: string | null;
  empresa_nome?: string;
};

export default function OnboardingConsultoriaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ob, setOb] = useState<Onboarding | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [confirmConcluir, setConfirmConcluir] = useState(false);
  const [removerItem, setRemoverItem] = useState<Item | null>(null);

  const carregar = async () => {
    if (!id) return;
    setLoading(true);
    const { data: o } = await (supabase as any)
      .from("consultoria_onboarding").select("*").eq("id", id).maybeSingle();
    if (!o) { setLoading(false); return; }
    const { data: emp } = await (supabase as any)
      .from("empresas_consultoria")
      .select("razao_social, nome_fantasia").eq("id", o.empresa_id).maybeSingle();
    const { data: its } = await (supabase as any)
      .from("consultoria_onboarding_itens").select("*").eq("onboarding_id", id).order("ordem");
    setOb({ ...o, empresa_nome: emp?.nome_fantasia || emp?.razao_social || "Empresa" });
    setItens((its as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [id]);

  const stats = useMemo(() => {
    const t = itens.length;
    const ok = itens.filter((x) => x.concluido).length;
    return { t, ok, pct: t ? Math.round((ok / t) * 100) : 0 };
  }, [itens]);

  const toggleItem = async (it: Item, val: boolean) => {
    const patch: any = { concluido: val, concluido_em: val ? new Date().toISOString() : null };
    setItens((arr) => arr.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    const { error } = await (supabase as any)
      .from("consultoria_onboarding_itens").update(patch).eq("id", it.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
  };

  const salvarObs = async (it: Item, observacao: string) => {
    setItens((arr) => arr.map((x) => x.id === it.id ? { ...x, observacao } : x));
    await (supabase as any)
      .from("consultoria_onboarding_itens").update({ observacao: observacao || null }).eq("id", it.id);
  };

  const adicionarItem = async () => {
    if (!ob || !novoTitulo.trim()) return;
    const ordem = (itens[itens.length - 1]?.ordem || 0) + 1;
    const { data, error } = await (supabase as any)
      .from("consultoria_onboarding_itens")
      .insert({ organizacao_id: ob.organizacao_id, onboarding_id: ob.id, titulo: novoTitulo.trim(), ordem })
      .select("*").single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setItens((arr) => [...arr, data as Item]);
    setNovoTitulo("");
  };

  const excluirItem = async () => {
    if (!removerItem) return;
    const it = removerItem; setRemoverItem(null);
    await (supabase as any).from("consultoria_onboarding_itens").delete().eq("id", it.id);
    setItens((arr) => arr.filter((x) => x.id !== it.id));
  };

  const concluirOnboarding = async () => {
    if (!ob) return;
    setConfirmConcluir(false);
    const concluindo = ob.status !== "concluido";
    const patch = concluindo
      ? { status: "concluido", concluido_em: new Date().toISOString() }
      : { status: "em_andamento", concluido_em: null };
    const { error } = await (supabase as any)
      .from("consultoria_onboarding").update(patch).eq("id", ob.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setOb({ ...ob, ...(patch as any) });
    toast({ title: concluindo ? "Onboarding concluído" : "Onboarding reaberto" });
  };

  if (loading) return <AppLayout><p className="p-12 text-center text-muted-foreground">Carregando...</p></AppLayout>;
  if (!ob) return <AppLayout><p className="p-12 text-center text-muted-foreground">Onboarding não encontrado.</p></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <PageHeader
          backTo="/consultoria/onboarding"
          breadcrumb={[
            { label: "Empresarial" },
            { label: "Onboarding", to: "/consultoria/onboarding" },
            { label: ob.empresa_nome || "Onboarding" },
          ]}
          icon={Building2}
          title={ob.empresa_nome || "Onboarding"}
          subtitle={
            <span className="inline-flex items-center gap-2">
              <Badge variant={ob.status === "concluido" ? "default" : "outline"} className="text-[10px]">
                {ob.status === "concluido"
                  ? <CheckCircle2 className="w-3 h-3 mr-1" />
                  : <Clock className="w-3 h-3 mr-1" />}
                {ob.status === "concluido" ? "Concluído" : "Em andamento"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Iniciado em {new Date(ob.iniciado_em).toLocaleDateString("pt-BR")}
              </span>
            </span>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => navigate(`/consultoria/empresas/${ob.empresa_id}`)}>
                Abrir empresa
              </Button>
              <Button
                onClick={() => setConfirmConcluir(true)}
                variant={ob.status === "concluido" ? "outline" : "default"}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {ob.status === "concluido" ? "Reabrir" : "Concluir onboarding"}
              </Button>
            </>
          }
        />

        <Card className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-semibold">{stats.ok}/{stats.t} ({stats.pct}%)</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${stats.pct}%` }} />
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-lg font-serif font-semibold">Checklist</h2>
          <div className="space-y-2">
            {itens.map((it) => (
              <div key={it.id} className="flex items-start gap-3 p-3 border rounded-md">
                <Checkbox
                  checked={it.concluido}
                  onCheckedChange={(v) => toggleItem(it, Boolean(v))}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className={`text-sm font-medium ${it.concluido ? "line-through text-muted-foreground" : ""}`}>
                    {it.titulo}
                  </div>
                  <Input
                    value={it.observacao || ""}
                    onChange={(e) => setItens((arr) => arr.map((x) => x.id === it.id ? { ...x, observacao: e.target.value } : x))}
                    onBlur={(e) => salvarObs(it, e.target.value)}
                    placeholder="Observação (opcional)"
                    className="h-8 text-xs"
                  />
                  {it.concluido && it.concluido_em && (
                    <div className="text-[10px] text-muted-foreground">
                      Concluído em {new Date(it.concluido_em).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setRemoverItem(it)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {itens.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item no checklist.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") adicionarItem(); }}
              placeholder="Adicionar novo item ao checklist…"
              className="h-9"
            />
            <Button onClick={adicionarItem} disabled={!novoTitulo.trim()} variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </Card>

        <AlertDialog open={confirmConcluir} onOpenChange={setConfirmConcluir}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {ob.status === "concluido" ? "Reabrir onboarding?" : "Concluir onboarding?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {ob.status === "concluido"
                  ? "O onboarding voltará para 'em andamento' e a data de conclusão será limpa."
                  : `Marcar como concluído. Você tem ${stats.t - stats.ok} item(ns) pendente(s) — isso é permitido, mas confira se está tudo certo.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={concluirOnboarding}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!removerItem} onOpenChange={(o) => !o && setRemoverItem(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover item?</AlertDialogTitle>
              <AlertDialogDescription>"{removerItem?.titulo}" será removido do checklist.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={excluirItem} className="bg-destructive text-destructive-foreground">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}