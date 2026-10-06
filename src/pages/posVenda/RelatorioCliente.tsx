import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Copy, Save, CheckCircle2, FileText, History, Download, X, Users } from "lucide-react";
import { ClientSearchInput } from "@/components/ClientSearchInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { gerarRelatorioClientePDF, nomeArquivoRelatorio } from "@/lib/pdfRelatorioCliente";

interface Historico {
  id: string;
  cliente_nome: string;
  status: string;
  created_at: string;
}

export default function RelatorioCliente() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [clientesNomes, setClientesNomes] = useState<string[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [fontes, setFontes] = useState<Record<string, number> | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("membros").select("organizacao_id").eq("user_id", user.id).limit(1).maybeSingle()
      .then(({ data }) => setOrgId(data?.organizacao_id ?? null));
  }, [user]);

  const carregarHistorico = async () => {
    const { data } = await supabase
      .from("relatorios_cliente")
      .select("id,cliente_nome,status,created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setHistorico((data as Historico[]) || []);
  };
  useEffect(() => { carregarHistorico(); }, []);

  const podeGerar = useMemo(() => clientesNomes.length >= 1 && !gerando, [clientesNomes, gerando]);
  const clientesLabel = useMemo(() => clientesNomes.join(" + "), [clientesNomes]);
  const isFamilia = clientesNomes.length > 1;

  const adicionarCliente = (nome: string) => {
    const limpo = nome.trim();
    if (!limpo) return;
    setClientesNomes((prev) => (prev.some((n) => n.toLowerCase() === limpo.toLowerCase()) ? prev : [...prev, limpo]));
    setBuscaCliente("");
  };
  const removerCliente = (nome: string) => {
    setClientesNomes((prev) => prev.filter((n) => n !== nome));
  };

  const gerar = async () => {
    if (!podeGerar) return;
    setGerando(true);
    setRegistroId(null);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-relatorio-cliente", {
        body: {
          clientes_nomes: clientesNomes,
          cliente_nome: clientesNomes[0],
          organizacao_id: orgId,
          observacoes: observacoes.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setConteudo((data as any)?.relatorio || "");
      setFontes((data as any)?.fontes || null);
      toast({ title: "Relatório gerado", description: "Revise o rascunho antes de qualquer envio." });
    } catch (e: any) {
      toast({ title: "Falha ao gerar", description: e.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const salvar = async (status: "rascunho" | "finalizado") => {
    if (!user || !orgId) {
      toast({ title: "Organização não encontrada", variant: "destructive" });
      return;
    }
    if (clientesNomes.length === 0 || !conteudo.trim()) {
      toast({ title: "Selecione um cliente e gere o relatório", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        organizacao_id: orgId,
        cliente_nome: clientesLabel,
        conteudo,
        status,
        gerado_por: user.id,
      };
      if (registroId) {
        const { error } = await supabase.from("relatorios_cliente").update(payload).eq("id", registroId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("relatorios_cliente").insert(payload).select("id").single();
        if (error) throw error;
        setRegistroId(data.id);
      }
      toast({ title: status === "finalizado" ? "Relatório finalizado" : "Rascunho salvo" });
      carregarHistorico();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(conteudo);
    toast({ title: "Copiado para a área de transferência" });
  };

  const exportarPDF = async () => {
    if (!conteudo.trim()) return;
    try {
      const blob = await gerarRelatorioClientePDF({
        clienteNome: clientesLabel || "Cliente",
        conteudoMarkdown: conteudo,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivoRelatorio(clientesLabel || "cliente");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF gerado" });
    } catch (e: any) {
      toast({ title: "Falha ao gerar PDF", description: e.message, variant: "destructive" });
    }
  };

  const abrirHistorico = async (id: string) => {
    const { data, error } = await supabase
      .from("relatorios_cliente")
      .select("id,cliente_nome,conteudo,status")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return;
    setRegistroId(data.id);
    setClientesNomes(
      data.cliente_nome
        ? data.cliente_nome.split(/\s*\+\s*/).map((s: string) => s.trim()).filter(Boolean)
        : [],
    );
    setConteudo(data.conteudo);
    setFontes(null);
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> Relatório ao Cliente (IA)
        </h1>
        <p className="text-sm text-muted-foreground">
          Gera um overview claro, em linguagem acessível, sobre tudo o que o escritório está fazendo pelo cliente.
          O texto é apenas um rascunho — revise antes de qualquer envio. Nada é enviado automaticamente.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Cliente(s)
                {isFamilia && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Users className="w-3 h-3" /> Grupo familiar
                  </Badge>
                )}
              </Label>
              <ClientSearchInput
                value={buscaCliente}
                onChange={setBuscaCliente}
                onSelectClient={(c) => adicionarCliente(c.nome_cliente)}
                placeholder="Buscar produtor pelo nome e adicionar…"
              />
              {clientesNomes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {clientesNomes.map((nome) => (
                    <Badge key={nome} variant="secondary" className="gap-1 pr-1">
                      <span className="text-xs">{nome}</span>
                      <button
                        type="button"
                        onClick={() => removerCliente(nome)}
                        aria-label={`Remover ${nome}`}
                        className="rounded-full hover:bg-accent/40 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Para famílias, adicione cada integrante. A IA produzirá um relatório único cobrindo todos.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Observações para a IA (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: foque no andamento da ação cautelar e nas tratativas com o Banco X."
                rows={3}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={gerar} disabled={!podeGerar}>
                {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Gerar relatório
              </Button>
              {fontes && (
                <div className="flex flex-wrap gap-1 items-center text-xs text-muted-foreground">
                  <span>Fontes:</span>
                  <Badge variant="secondary">{fontes.processos} processos</Badge>
                  <Badge variant="secondary">{fontes.vencimentos} vencimentos</Badge>
                  <Badge variant="secondary">{fontes.atendimentos} atendimentos</Badge>
                  <Badge variant="secondary">{fontes.laudos} laudos</Badge>
                  <Badge variant="secondary">{fontes.acordos} acordos</Badge>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Rascunho (editor)</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copiar} disabled={!conteudo}>
                  <Copy className="w-4 h-4 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="outline" onClick={exportarPDF} disabled={!conteudo} aria-label="Exportar PDF">
                  <Download className="w-4 h-4 mr-1" /> Exportar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => salvar("rascunho")} disabled={salvando || !conteudo}>
                  <Save className="w-4 h-4 mr-1" /> Salvar rascunho
                </Button>
                <Button size="sm" onClick={() => salvar("finalizado")} disabled={salvando || !conteudo}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Finalizar
                </Button>
              </div>
            </div>
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="O conteúdo gerado pela IA aparecerá aqui para revisão."
              rows={22}
              className="font-mono text-sm"
            />
          </Card>
        </div>

        <Card className="p-4 space-y-3 h-fit">
          <div className="flex items-center gap-2 text-sm font-medium">
            <History className="w-4 h-4" /> Histórico recente
          </div>
          {historico.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum relatório salvo ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {historico.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => abrirHistorico(h.id)}
                    className="w-full text-left rounded-md p-2 hover:bg-accent/10 transition-colors"
                  >
                    <div className="font-medium truncate">{h.cliente_nome}</div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      <Badge variant={h.status === "finalizado" ? "default" : "secondary"} className="text-[10px]">
                        {h.status}
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}