import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, MessageSquare, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { PRIORIDADE_STYLE, STATUS_STYLE, STATUS_LABEL } from "@/components/consultoria/NovaDemandaDialog";
import { PageHeader } from "@/components/ui/page-header";

type Demanda = {
  id: string; organizacao_id: string; empresa_id: string; contato_id: string | null; avenca_id: string | null;
  assunto: string; descricao: string | null; area: string | null; prioridade: string;
  status: string; responsavel_id: string | null; prazo: string | null; origem: string;
  aberta_por: string | null; concluida_em: string | null; created_at: string;
  empresa: { razao_social: string; nome_fantasia: string | null } | null;
  contato: { nome: string } | null;
  avenca: { titulo: string | null } | null;
};

type Interacao = {
  id: string; autor_id: string | null; tipo: string; conteudo: string; visivel_empresa: boolean; created_at: string;
};

export default function DemandaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [d, setD] = useState<Demanda | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [confirmar, setConfirmar] = useState<null | "concluida" | "cancelada">(null);
  const [enviando, setEnviando] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [dRes, iRes] = await Promise.all([
      (supabase as any).from("consultoria_demandas")
        .select("*, empresa:empresas_consultoria(razao_social,nome_fantasia), contato:empresa_contatos(nome), avenca:avencas(titulo)")
        .eq("id", id).maybeSingle(),
      (supabase as any).from("demanda_interacoes")
        .select("*").eq("demanda_id", id).order("created_at", { ascending: true }),
    ]);
    if (dRes.error || !dRes.data) {
      toast({ title: "Demanda não encontrada", variant: "destructive" });
      navigate("/consultoria/demandas");
      return;
    }
    setD(dRes.data as Demanda);
    setInteracoes((iRes.data || []) as Interacao[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const nomeResp = (uid: string | null) => {
    if (!uid) return "—";
    const m = members.find((x) => x.user_id === uid);
    return m?.nome || uid.slice(0, 8);
  };

  const enviarNota = async () => {
    if (!d || !novo.trim()) return;
    setEnviando(true);
    const { error } = await (supabase as any).from("demanda_interacoes").insert({
      organizacao_id: d.organizacao_id,
      demanda_id: d.id,
      autor_id: user?.id || null,
      tipo: "nota_interna",
      conteudo: novo.trim(),
      visivel_empresa: visivel,
    });
    setEnviando(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNovo(""); setVisivel(false); load();
  };

  const mudarStatus = async (status: string) => {
    if (!d) return;
    const patch: any = { status };
    if (status === "concluida") patch.concluida_em = new Date().toISOString();
    if (d.status === "concluida" && status !== "concluida") patch.concluida_em = null;
    const { error } = await (supabase as any).from("consultoria_demandas").update(patch).eq("id", d.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status atualizado" });
    setConfirmar(null);
    load();
  };

  const mudarResponsavel = async (uid: string) => {
    if (!d) return;
    await (supabase as any).from("consultoria_demandas").update({ responsavel_id: uid }).eq("id", d.id);
    load();
  };

  if (loading || !d) {
    return <AppLayout><div className="p-6 text-center text-muted-foreground">Carregando...</div></AppLayout>;
  }

  const empresaNome = d.empresa?.nome_fantasia || d.empresa?.razao_social || "Empresa";
  const venc = d.prazo ? Math.floor((new Date(d.prazo).getTime() - Date.now()) / 86400000) : null;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <PageHeader
          backTo="/consultoria/demandas"
          breadcrumb={[
            { label: "Empresarial" },
            { label: "Demandas", to: "/consultoria/demandas" },
            { label: d.assunto },
          ]}
          title={d.assunto}
          subtitle={
            <>
              <Link to={`/consultoria/empresas/${d.empresa_id}`} className="text-primary hover:underline">{empresaNome}</Link>
              {d.avenca?.titulo ? ` · ${d.avenca.titulo}` : ""}
              {d.area ? ` · ${d.area}` : ""}
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={d.prioridade} label={d.prioridade} />
              <StatusBadge status={d.status} label={STATUS_LABEL[d.status]} />
            </div>
          }
        />

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Solicitante</div>
              <div>{d.contato?.nome || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Prazo</div>
              <div className={venc !== null && venc < 0 ? "text-destructive font-semibold" : ""}>
                {d.prazo ? new Date(d.prazo).toLocaleDateString("pt-BR") : "—"}
                {venc !== null && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({venc < 0 ? `${Math.abs(venc)}d atraso` : `${venc}d`})
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Responsável</div>
              <Select value={d.responsavel_id || ""} onValueChange={mudarResponsavel}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <Select
                value={d.status}
                onValueChange={(v) => {
                  if (v === "concluida" || v === "cancelada") setConfirmar(v as any);
                  else mudarStatus(v);
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="aguardando_empresa">Aguardando empresa</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {d.descricao && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Descrição</div>
              <p className="text-sm whitespace-pre-wrap">{d.descricao}</p>
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-serif font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> Histórico
          </h2>

          {interacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma interação ainda.</p>
          ) : (
            <div className="space-y-3">
              {interacoes.map((i) => (
                <div key={i.id} className="border-l-2 border-primary/30 pl-3 py-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{nomeResp(i.autor_id)}</span>
                    <span>·</span>
                    <span>{new Date(i.created_at).toLocaleString("pt-BR")}</span>
                    {i.visivel_empresa ? (
                      <Badge variant="outline" className="text-[10px]">visível p/ empresa</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">interno</Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-1">{i.conteudo}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label className="text-sm">Adicionar nota</Label>
            <Textarea rows={3} value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Digite uma nota interna..." />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={visivel} onCheckedChange={(c) => setVisivel(Boolean(c))} />
                Marcar como visível para a empresa
                <span className="text-[10px] flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> sem efeito externo nesta fase</span>
              </label>
              <Button onClick={enviarNota} disabled={enviando || !novo.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Send className="w-4 h-4 mr-1" /> Enviar
              </Button>
            </div>
          </div>
        </Card>

        <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmar === "concluida" ? "Concluir demanda?" : "Cancelar demanda?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmar === "concluida"
                  ? "A demanda será marcada como concluída e a data atual ficará registrada."
                  : "A demanda será marcada como cancelada. O histórico permanece preservado."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmar && mudarStatus(confirmar)}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}