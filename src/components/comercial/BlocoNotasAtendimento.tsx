import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, MessageCircle, Copy, FileText, Loader2, NotebookPen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { RichText } from "@/components/RichTextarea";

type Origem = "avulso" | "calculadora" | "lead";

interface Props {
  origem: Origem;
  leadId?: string | null;
  honorarioCalculoId?: string | null;
  clienteNomeInicial?: string;
  clienteContatoInicial?: string;
  contextoExtra?: string;
  /** Quando true, mostra apenas a forma compacta (sem header de página) */
  compact?: boolean;
  onSalvo?: (id: string) => void;
}

export function BlocoNotasAtendimento({
  origem,
  leadId = null,
  honorarioCalculoId = null,
  clienteNomeInicial = "",
  clienteContatoInicial = "",
  contextoExtra = "",
  compact = false,
  onSalvo,
}: Props) {
  const { user } = useAuth();
  const [notaId, setNotaId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [clienteNome, setClienteNome] = useState(clienteNomeInicial);
  const [clienteContato, setClienteContato] = useState(clienteContatoInicial);
  const [notas, setNotas] = useState("");
  const [relatorio, setRelatorio] = useState("");
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("membros").select("organizacao_id").eq("user_id", user.id).limit(1).maybeSingle()
      .then(({ data }) => setOrgId(data?.organizacao_id ?? null));
  }, [user]);

  useEffect(() => { setClienteNome(clienteNomeInicial); }, [clienteNomeInicial]);
  useEffect(() => { setClienteContato(clienteContatoInicial); }, [clienteContatoInicial]);

  const podeGerar = notas.trim().length >= 20 && clienteNome.trim().length > 0 && !gerando;

  const gerarRelatorio = async () => {
    if (!podeGerar) return;
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-relatorio-atendimento", {
        body: {
          notas: notas.trim(),
          cliente_nome: clienteNome.trim(),
          contexto: contextoExtra,
          organizacao_id: orgId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRelatorio((data as any)?.relatorio || "");
      toast({ title: "Relatório gerado", description: "Revise antes de enviar ao cliente." });
    } catch (e: any) {
      toast({ title: "Falha ao gerar", description: e.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const salvar = async (statusFinal: "rascunho" | "finalizado" = "rascunho") => {
    if (!user || !clienteNome.trim() || !notas.trim()) {
      toast({ title: "Preencha cliente e notas", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        operador_id: user.id,
        organizacao_id: orgId,
        origem,
        lead_id: leadId,
        honorario_calculo_id: honorarioCalculoId,
        cliente_nome: clienteNome.trim(),
        cliente_contato: clienteContato.trim() || null,
        titulo: titulo.trim() || null,
        notas_brutas: notas,
        relatorio_cliente: relatorio || null,
        relatorio_gerado_em: relatorio ? new Date().toISOString() : null,
        status: statusFinal,
      };
      if (notaId) {
        const { error } = await supabase.from("atendimentos_notas").update(payload).eq("id", notaId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("atendimentos_notas").insert(payload).select("id").single();
        if (error) throw error;
        setNotaId(data.id);
        onSalvo?.(data.id);
      }
      toast({ title: statusFinal === "finalizado" ? "Atendimento finalizado" : "Atendimento salvo" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const copiarRelatorio = async () => {
    if (!relatorio) return;
    await navigator.clipboard.writeText(relatorio);
    toast({ title: "Relatório copiado" });
  };

  const enviarWhats = () => {
    if (!relatorio) return;
    const tel = clienteContato.replace(/\D/g, "");
    const baseUrl = tel.length >= 10 ? `https://wa.me/55${tel}` : "https://wa.me/";
    window.open(`${baseUrl}?text=${encodeURIComponent(relatorio)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center gap-2">
          <NotebookPen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Bloco de Notas de Atendimento</h2>
          <Badge variant="outline" className="text-[10px] ml-2">{origem}</Badge>
        </div>
      )}

      <Card className="p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div className="space-y-1.5">
            <Label>Contato</Label>
            <Input value={clienteContato} onChange={(e) => setClienteContato(e.target.value)} placeholder="Telefone (DDD)" />
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Reunião inicial" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notas do atendimento *</Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={8}
            placeholder="Escreva livremente: o que foi conversado, dores do cliente, números mencionados, próximos passos combinados... A IA vai estruturar tudo."
            className="resize-y"
          />
          <p className="text-[11px] text-muted-foreground">
            Mínimo de ~20 caracteres. Quanto mais detalhe, melhor o relatório.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={gerarRelatorio} disabled={!podeGerar}>
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {gerando ? "Gerando..." : relatorio ? "Regenerar relatório" : "Gerar relatório (IA)"}
          </Button>
          <Button variant="outline" onClick={() => salvar("rascunho")} disabled={salvando}>
            <Save className="w-4 h-4 mr-2" /> Salvar rascunho
          </Button>
          {relatorio && (
            <Button variant="outline" onClick={() => salvar("finalizado")} disabled={salvando}>
              <FileText className="w-4 h-4 mr-2" /> Finalizar atendimento
            </Button>
          )}
        </div>
      </Card>

      {relatorio && (
        <Card className="p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Relatório para o cliente</h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copiarRelatorio}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
              </Button>
              <Button size="sm" onClick={enviarWhats} style={{ backgroundColor: "#25D366", color: "#fff" }}>
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
              </Button>
            </div>
          </div>
          <div className="bg-background rounded-md border p-4 max-h-[500px] overflow-y-auto">
            <RichText text={relatorio} className="text-sm leading-relaxed" />
          </div>
          <Textarea
            value={relatorio}
            onChange={(e) => setRelatorio(e.target.value)}
            rows={6}
            className="text-xs font-mono"
            placeholder="Edite o markdown do relatório se necessário"
          />
        </Card>
      )}
    </div>
  );
}