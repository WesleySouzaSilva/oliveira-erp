import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotebookPen, Plus, Search, FileText, FileDown, UserPlus, Check, ExternalLink, FilePlus2, Workflow } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BlocoNotasAtendimento } from "@/components/comercial/BlocoNotasAtendimento";
import { RichText } from "@/components/RichTextarea";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { iniciarWorkflowAposVenda } from "@/lib/workflow";
import { useAuth } from "@/contexts/AuthContext";

type Nota = {
  id: string;
  cliente_nome: string;
  cliente_contato: string | null;
  titulo: string | null;
  origem: string;
  status: string;
  notas_brutas: string;
  relatorio_cliente: string | null;
  created_at: string;
  cliente_id: string | null;
};

type ClienteOpt = { id: string; nome: string; cpf_cnpj: string | null };

export default function AtendimentosComercial() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [verNota, setVerNota] = useState<Nota | null>(null);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [vinculando, setVinculando] = useState(false);
  const [iniciandoWf, setIniciandoWf] = useState(false);

  const iniciarWorkflow = async (n: Nota) => {
    if (!user) return;
    if (!n.relatorio_cliente || n.relatorio_cliente.trim().length < 10) {
      toast({ title: "Falta o relatório de venda", description: "Gere o relatório do atendimento antes de iniciar o workflow.", variant: "destructive" });
      return;
    }
    setIniciandoWf(true);
    try {
      await iniciarWorkflowAposVenda({
        userId: user.id,
        clienteNome: n.cliente_nome,
        clienteId: n.cliente_id,
        atendimentoId: n.id,
      });
      toast({ title: "Workflow iniciado", description: "Tarefa de cadastro criada. Conclua para gerar o onboarding." });
      navigate("/workflow");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIniciandoWf(false);
    }
  };

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("atendimentos_notas")
      .select("id, cliente_nome, cliente_contato, titulo, origem, status, notas_brutas, relatorio_cliente, created_at, cliente_id")
      .order("created_at", { ascending: false })
      .limit(200);
    setNotas((data as Nota[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  // Pre-fill search when arriving from another module via ?cliente=
  useEffect(() => {
    const clienteParam = searchParams.get("cliente");
    if (clienteParam) setBusca(clienteParam);
  }, [searchParams]);

  // Auto-open a specific note when ?open=<id> is present
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || notas.length === 0) return;
    const found = notas.find((n) => n.id === openId);
    if (found) setVerNota(found);
  }, [searchParams, notas]);

  useEffect(() => {
    if (!vincularOpen) return;
    const q = buscaCliente.trim();
    const run = async () => {
      let query = supabase.from("clientes").select("id, nome, cpf_cnpj").is("deleted_at", null).order("nome").limit(30);
      if (q.length >= 2) {
        query = supabase.rpc("search_clientes_norm", { q }) as any;
      }
      const { data } = await query;
      setClientes(((data as any[]) ?? []).map((c) => ({ id: c.id, nome: c.nome, cpf_cnpj: c.cpf_cnpj ?? null })));
    };
    run();
  }, [vincularOpen, buscaCliente]);

  const vincularCliente = async (clienteId: string, nome: string) => {
    if (!verNota) return;
    setVinculando(true);
    const { error } = await supabase
      .from("atendimentos_notas")
      .update({ cliente_id: clienteId, cliente_nome: nome })
      .eq("id", verNota.id);
    setVinculando(false);
    if (error) {
      toast({ title: "Falha ao vincular", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cliente vinculado" });
    setVerNota({ ...verNota, cliente_id: clienteId, cliente_nome: nome });
    setVincularOpen(false);
    carregar();
  };

  const exportarPDF = (n: Nota) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    let y = margin;

    const ensure = (h: number) => {
      if (y + h > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };
    const writeBlock = (text: string, size: number, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach((ln: string) => {
        ensure(size + 4);
        doc.text(ln, margin, y);
        y += size + 4;
      });
    };

    // Cabeçalho
    doc.setFillColor(34, 84, 53);
    doc.rect(0, 0, pageW, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório Comercial de Atendimento", margin, 38);
    doc.setTextColor(20, 20, 20);
    y = 90;

    writeBlock(`Cliente: ${n.cliente_nome}`, 12, true);
    if (n.titulo) writeBlock(`Assunto: ${n.titulo}`, 11);
    writeBlock(`Data: ${new Date(n.created_at).toLocaleString("pt-BR")}`, 10);
    writeBlock(`Origem: ${n.origem}  ·  Status: ${n.status}`, 10);
    y += 8;

    if (n.relatorio_cliente) {
      writeBlock("Relatório do atendimento", 13, true);
      y += 4;
      // Remove marcações markdown simples
      const limpo = n.relatorio_cliente
        .replace(/^#+\s*/gm, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/^- /gm, "• ");
      writeBlock(limpo, 11);
    } else {
      writeBlock("Notas do atendimento", 13, true);
      y += 4;
      writeBlock(n.notas_brutas, 11);
    }

    // Rodapé
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Página ${i} de ${total}  ·  Se é Agro, começa aqui`, margin, pageH - 20);
    }

    const fname = `relatorio-${n.cliente_nome.replace(/\s+/g, "-").toLowerCase()}-${n.id.slice(0, 8)}.pdf`;
    doc.save(fname);
  };

  const filtradas = notas.filter((n) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      n.cliente_nome.toLowerCase().includes(q) ||
      (n.titulo || "").toLowerCase().includes(q) ||
      n.notas_brutas.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <NotebookPen className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-semibold">Bloco de Notas — Atendimentos</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Registre atendimentos comerciais e gere relatórios profissionais com IA para envio ao cliente.
            </p>
          </div>
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo atendimento
          </Button>
        </header>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, título ou conteúdo"
              className="pl-9"
            />
          </div>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            Nenhum atendimento registrado ainda.
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtradas.map((n) => (
              <Card
                key={n.id}
                className="p-4 space-y-2 cursor-pointer hover:border-primary transition-colors"
                onClick={() => setVerNota(n)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm" data-private>{n.cliente_nome}</div>
                  <Badge variant={n.status === "finalizado" ? "default" : "outline"} className="text-[10px]">
                    {n.status}
                  </Badge>
                </div>
                {n.titulo && <div className="text-xs text-muted-foreground">{n.titulo}</div>}
                <p className="text-xs text-muted-foreground line-clamp-3">{n.notas_brutas}</p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                  <span>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{n.origem}</Badge>
                    {n.relatorio_cliente && <FileText className="w-3 h-3 text-primary" />}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={novoOpen} onOpenChange={(o) => { setNovoOpen(o); if (!o) carregar(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader>
          <BlocoNotasAtendimento origem="avulso" compact onSalvo={() => carregar()} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!verNota} onOpenChange={(o) => {
        if (!o) {
          setVerNota(null);
          if (searchParams.get("open")) {
            searchParams.delete("open");
            setSearchParams(searchParams, { replace: true });
          }
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle><span data-private>{verNota?.cliente_nome}</span> {verNota?.titulo && <span className="text-muted-foreground font-normal">· {verNota.titulo}</span>}</DialogTitle>
          </DialogHeader>
          {verNota && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => exportarPDF(verNota)}>
                  <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setBuscaCliente(""); setVincularOpen(true); }}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {verNota.cliente_id ? "Trocar cliente vinculado" : "Vincular a cliente cadastrado"}
                </Button>
                {verNota.cliente_id && (
                  <>
                    <Badge variant="default" className="flex items-center gap-1">
                      <Check className="w-3 h-3" /> Cliente vinculado
                    </Badge>
                    <Button size="sm" variant="secondary" asChild>
                      <Link to={`/clientes/${encodeURIComponent(verNota.cliente_nome)}`}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Abrir ficha do cliente
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(
                        `/novo-laudo?cliente_id=${verNota.cliente_id}` +
                        `&cliente=${encodeURIComponent(verNota.cliente_nome)}` +
                        `&atendimento_id=${verNota.id}`
                      )}
                    >
                      <FilePlus2 className="w-4 h-4 mr-2" /> Gerar laudo a partir deste atendimento
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => iniciarWorkflow(verNota)}
                      disabled={iniciandoWf}
                      title="Marca a venda como fechada e dispara o workflow Comercial → Pós-venda → Laudo"
                    >
                      <Workflow className="w-4 h-4 mr-2" />
                      {iniciandoWf ? "Iniciando…" : "Fechar contrato → iniciar workflow"}
                    </Button>
                  </>
                )}
                {!verNota.cliente_id && (
                  <span className="text-xs text-muted-foreground self-center">
                    Vincule um cliente para gerar laudo a partir deste atendimento.
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notas brutas</h4>
                <Card className="p-3 bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{verNota.notas_brutas}</p>
                </Card>
              </div>
              {verNota.relatorio_cliente && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Relatório para o cliente</h4>
                  <Card className="p-4">
                    <RichText text={verNota.relatorio_cliente} className="text-sm leading-relaxed" />
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={vincularOpen} onOpenChange={setVincularOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Vincular a um cliente cadastrado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Buscar cliente por nome..."
                className="pl-9"
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {clientes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente encontrado.</p>
              ) : (
                clientes.map((c) => (
                  <button
                    key={c.id}
                    disabled={vinculando}
                    onClick={() => vincularCliente(c.id, c.nome)}
                    className="w-full text-left p-3 rounded-md hover:bg-muted border transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-sm">{c.nome}</div>
                    {c.cpf_cnpj && <div className="text-xs text-muted-foreground">{c.cpf_cnpj}</div>}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}