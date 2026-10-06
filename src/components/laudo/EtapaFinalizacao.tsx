import { useState, useEffect } from "react";
import { CheckCircle, FileText, Download, Eye, Sparkles, Loader2, Layers, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { criarTarefaConferenciaLaudo } from "@/hooks/useWorkflowTasks";

interface Props {
  laudoId: string | null;
  etapa1: Record<string, any>;
  hipoteses: string[];
  etapa3Data: Record<string, any>;
  etapa4Data: Record<string, any>;
  etapa5Data: Record<string, any>;
  etapa6Data: Record<string, any>;
  textoConlusao: string;
  onConclusaoChange: (texto: string) => void;
  textoNarrativa: string;
  onNarrativaChange: (texto: string) => void;
}

interface Template {
  id: string;
  nome: string;
  conteudo: string;
  hipotese_mcr: string | null;
}

export function EtapaFinalizacao({
  laudoId, etapa1, hipoteses, etapa3Data, etapa4Data, etapa5Data, etapa6Data,
  textoConlusao, onConclusaoChange, textoNarrativa, onNarrativaChange,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [mesclando, setMesclando] = useState(false);
  const [gerandoDocx, setGerandoDocx] = useState<"perda" | "capacidade" | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("templates_conclusao")
      .select("id, nome, conteudo, hipotese_mcr")
      .then(({ data }) => { if (data) setTemplates(data); });
  }, []);

  const replaceVars = (texto: string) => {
    return texto
      .replace("{PRODUTOR}", etapa1.nome || "[produtor]")
      .replace("{CULTURA}", (etapa1.culturas || [etapa1.cultura]).filter(Boolean).join(", ") || "[cultura]")
      .replace("{SAFRA}", etapa1.safra || "[safra]")
      .replace("{MUNICIPIO}", etapa1.municipio || "[município]")
      .replace("{UF}", etapa1.uf || "[UF]");
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const aplicarConcatenar = () => {
    const textos = selectedTemplates
      .map((id) => templates.find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => replaceVars(t!.conteudo));
    onConclusaoChange(textos.join("\n\n---\n\n"));
    toast.success(`${textos.length} template(s) aplicado(s)`);
  };

  const aplicarComIA = async () => {
    if (selectedTemplates.length === 0) return;
    setMesclando(true);
    try {
      const textos = selectedTemplates
        .map((id) => templates.find((t) => t.id === id))
        .filter(Boolean)
        .map((t) => replaceVars(t!.conteudo));

      const { data, error } = await supabase.functions.invoke("ai-laudo", {
        body: {
          action: "merge_conclusions",
          context: {
            textos,
            produtor: etapa1.nome,
            cultura: (etapa1.culturas || []).join(", "),
            safra: etapa1.safra,
            hipoteses,
          },
        },
      });
      if (error) throw error;
      onConclusaoChange(data.content || "");
      toast.success("Conclusão unificada gerada com IA");
    } catch (err: any) {
      toast.error(err.message || "Erro ao mesclar com IA");
    } finally {
      setMesclando(false);
    }
  };

  const gerarNarrativaIA = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-laudo", {
        body: {
          action: "generate_narrative",
          context: {
            produtor: etapa1.nome,
            propriedade: etapa1.nomePropriedade,
            municipio: etapa1.municipio,
            uf: etapa1.uf,
            cultura: (etapa1.culturas || [etapa1.cultura]).filter(Boolean).join(", "),
            safra: etapa1.safra,
            areaCultivada: etapa1.areaCultivada,
            produtividadeRealizada: etapa4Data.produtividadeRealizada,
            produtividadeEsperada: etapa4Data.produtividadeEsperada,
            mediaHistorica: etapa4Data.mediaHistorica,
            receitaBruta: etapa5Data.receitaBruta,
            custoTotal: etapa5Data.custoTotal,
            saldoDevedor: etapa5Data.saldoDevedor,
            culturasReceita: etapa6Data.culturasReceita,
            custoMedioProducao: etapa6Data.custoMedioProducao,
            despesasPessoais: etapa6Data.despesasPessoais,
            hipoteses,
            justificativa: etapa3Data.justificativa,
          },
        },
      });
      if (error) throw error;
      onNarrativaChange(data.content || "");
      toast.success("Narrativa gerada com IA");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar narrativa");
    } finally {
      setGerando(false);
    }
  };

  // ─── Generate full DOCX laudo ───
  const gerarLaudoCompleto = async (tipo: "perda" | "capacidade") => {
    setGerandoDocx(tipo);
    const toastId = toast.loading(
      tipo === "perda" 
        ? "Gerando Laudo de Perda de Safra... (pode levar até 2 min)" 
        : "Gerando Laudo de Capacidade de Pagamento... (pode levar até 2 min)"
    );

    try {
      // Step 1: Generate structured content via AI
      const allData = {
        ...etapa1,
        ...etapa4Data,
        ...etapa5Data,
        ...etapa6Data,
        hipoteses,
        justificativa: etapa3Data.justificativa,
      };

      const { data: aiResult, error: aiError } = await supabase.functions.invoke("gerar-laudo-completo", {
        body: { tipo, dados: allData },
      });

      if (aiError) throw aiError;
      if (aiResult?.error) throw new Error(aiResult.error);

      const laudoData = aiResult?.laudo;
      if (!laudoData) throw new Error("Nenhum conteúdo retornado pela IA");

      // Step 2: Generate DOCX from structured data
      const { data: docxResult, error: docxError } = await supabase.functions.invoke("gerar-laudo-docx", {
        body: {
          laudo_data: laudoData,
          tipo,
          laudo_id: laudoId,
        },
      });

      if (docxError) throw docxError;

      // If we got a direct buffer (Content-Type: docx), download it
      if (docxResult instanceof Blob || docxResult instanceof ArrayBuffer) {
        const blob = docxResult instanceof Blob ? docxResult : new Blob([docxResult]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `laudo_${tipo}_${Date.now()}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Laudo .docx gerado e baixado!", { id: toastId });
      } else if (docxResult?.success) {
        toast.success("Laudo .docx gerado e salvo!", { id: toastId });
      } else {
        throw new Error(docxResult?.error || "Erro desconhecido na geração do DOCX");
      }
    } catch (err: any) {
      console.error("Erro ao gerar laudo completo:", err);
      const msg = err.message || "Erro ao gerar laudo";
      if (msg.includes("429") || msg.includes("Rate") || msg.includes("limite")) {
        toast.error("Limite de requisições excedido. Aguarde alguns instantes.", { id: toastId });
      } else if (msg.includes("402") || msg.includes("créditos") || msg.includes("Payment")) {
        toast.error("Créditos de IA esgotados. Adicione créditos ao workspace.", { id: toastId });
      } else {
        toast.error(msg, { id: toastId });
      }
    } finally {
      setGerandoDocx(null);
    }
  };

  const checklistItems = [
    { label: "Dados do produtor", done: !!etapa1.nome && !!etapa1.documento },
    { label: "Dados da propriedade", done: !!etapa1.municipio && !!etapa1.areaTotal },
    { label: "Dados do financiamento", done: !!(etapa1.contratos?.length > 0 && etapa1.contratos[0]?.valorOriginal) },
    { label: "Enquadramento MCR", done: hipoteses.length > 0 },
    { label: "Dados da safra", done: !!etapa4Data.produtividadeRealizada },
    { label: "Capacidade de pagamento", done: !!etapa5Data.receitaBruta },
    { label: "Projeção financeira", done: !!(etapa6Data.producoes?.length > 0) },
    { label: "Texto de conclusão", done: !!textoConlusao },
  ];

  const completedCount = checklistItems.filter((i) => i.done).length;
  const allDone = completedCount === checklistItems.length;
  const minDataForDocx = !!etapa1.nome && !!etapa1.municipio && hipoteses.length > 0;

  return (
    <div className="space-y-8">
      {/* Conteúdo gerado pela Olívia (via chat) */}
      {(etapa6Data?.conteudo_perda || etapa6Data?.conteudo_capacidade) && (
        <section className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Conteúdo gerado pela Olívia</h3>
          </div>
          {(["perda", "capacidade"] as const).map((k) => {
            const obj = etapa6Data?.[k === "perda" ? "conteudo_perda" : "conteudo_capacidade"];
            const texto: string = obj?.laudo || (typeof obj === "string" ? obj : "");
            if (!texto) return null;
            const label = k === "perda" ? "Parte I — Perda de Safra" : "Parte II — Capacidade de Pagamento";
            return (
              <div key={k} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onNarrativaChange(texto); toast.success("Texto inserido na narrativa"); }}
                      className="text-xs px-2.5 py-1 rounded-md bg-accent text-accent-foreground hover:opacity-90"
                    >
                      Inserir na narrativa
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(texto); toast.success("Copiado"); }}
                      className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto text-xs whitespace-pre-wrap bg-background/60 border border-border rounded-md p-3 text-muted-foreground">
                  {texto.slice(0, 1200)}{texto.length > 1200 ? "…" : ""}
                </div>
              </div>
            );
          })}
          {etapa6Data?.gerado_em && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Gerado em {new Date(etapa6Data.gerado_em).toLocaleString("pt-BR")}
            </p>
          )}
        </section>
      )}

      {/* Checklist */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Finalização do Laudo</h2>
        <p className="text-sm text-muted-foreground mb-4">Revise, gere a narrativa e exporte o laudo completo.</p>

        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Checklist de preenchimento</h3>
            <span className={`text-xs font-bold ${allDone ? "text-success" : "text-accent"}`}>
              {completedCount}/{checklistItems.length}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mb-4">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${allDone ? "bg-success" : "bg-accent"}`}
              style={{ width: `${(completedCount / checklistItems.length) * 100}%` }}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {checklistItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <CheckCircle className={`w-4 h-4 ${item.done ? "text-success" : "text-border"}`} />
                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GERAR LAUDO COMPLETO (.docx) ─── */}
      <section className="bg-card border-2 border-accent/30 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileDown className="w-5 h-5 text-accent" />
          <h3 className="text-base font-semibold text-foreground">Gerar Laudo Completo (.docx)</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          A IA gera o laudo técnico profissional completo (18-25 páginas) com base nos dados preenchidos, usando o Gemini 2.5 Pro. 
          O documento é gerado no formato Word (.docx) com formatação profissional, tabelas, cabeçalhos e rodapé.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => gerarLaudoCompleto("perda")}
            disabled={!minDataForDocx || gerandoDocx !== null}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-40"
          >
            {gerandoDocx === "perda" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {gerandoDocx === "perda" ? "Gerando Parte I..." : "Parte I — Perda de Safra"}
          </button>
          <button
            onClick={() => gerarLaudoCompleto("capacidade")}
            disabled={!minDataForDocx || gerandoDocx !== null}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:shadow-card-hover transition-all disabled:opacity-40"
          >
            {gerandoDocx === "capacidade" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {gerandoDocx === "capacidade" ? "Gerando Parte II..." : "Parte II — Capacidade de Pagamento"}
          </button>
        </div>

        {!minDataForDocx && (
          <p className="text-xs text-muted-foreground mt-3">
            Preencha pelo menos: nome do produtor, município e hipóteses MCR para gerar o laudo.
          </p>
        )}
      </section>

      {/* Narrativa IA (legacy) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Análise Narrativa (texto simples)</h3>
          <button
            onClick={gerarNarrativaIA}
            disabled={gerando}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-50 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {gerando ? "Gerando..." : "Gerar com IA"}
          </button>
        </div>
        <div className="floating-label-group">
          <textarea placeholder=" " rows={6} value={textoNarrativa} onChange={(e) => onNarrativaChange(e.target.value)} />
          <label>Texto da análise narrativa</label>
        </div>
      </section>

      {/* Conclusão — multi-select templates */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Conclusão</h3>
        </div>

        {templates.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Selecione um ou mais templates para combinar:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {templates.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-xs ${
                    selectedTemplates.includes(t.id)
                      ? "border-accent bg-accent/10 text-foreground font-medium"
                      : "border-border bg-muted text-muted-foreground hover:border-accent/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedTemplates.includes(t.id)}
                    onCheckedChange={() => toggleTemplate(t.id)}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                  />
                  {t.nome}
                </label>
              ))}
            </div>

            {selectedTemplates.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={aplicarConcatenar}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-all"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Concatenar ({selectedTemplates.length})
                </button>
                <button
                  onClick={aplicarComIA}
                  disabled={mesclando}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-50 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {mesclando ? "Mesclando..." : "Mesclar com IA"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="floating-label-group">
          <textarea placeholder=" " rows={6} value={textoConlusao} onChange={(e) => onConclusaoChange(e.target.value)} />
          <label>Texto de conclusão do laudo</label>
        </div>
      </section>

      {/* Actions (legacy PDF) */}
      <section className="flex flex-wrap gap-3">
        <button
          onClick={async () => {
            if (!laudoId) { toast.error("Salve o laudo primeiro"); return; }
            setGerandoPdf(true);
            try {
              const { data, error } = await supabase.functions.invoke("gerar-pdf", {
                body: { laudo_id: laudoId },
              });
              if (error) throw error;
              await supabase.from("laudos").update({ status: "finalizado" }).eq("id", laudoId);
              const { data: userData } = await supabase.auth.getUser();
              const nomeCliente = etapa1.nome || etapa1.produtor || "Cliente";
              if (userData.user) {
                await criarTarefaConferenciaLaudo(laudoId, userData.user.id, nomeCliente);
              }
              toast.success("Laudo finalizado! Tarefa de conferência criada automaticamente.");
              setPreviewHtml(data.html);
            } catch (err: any) {
              toast.error(err.message || "Erro ao finalizar");
            } finally {
              setGerandoPdf(false);
            }
          }}
          disabled={!allDone || gerandoPdf}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-all disabled:opacity-40"
        >
          {gerandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {gerandoPdf ? "Finalizando..." : "Finalizar (PDF legado)"}
        </button>
        <button
          onClick={() => {
            if (previewHtml) {
              const w = window.open("", "_blank");
              if (w) { w.document.write(previewHtml); w.document.close(); }
            } else {
              toast.info("Finalize o laudo primeiro para pré-visualizar");
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary transition-all"
        >
          <Eye className="w-4 h-4" /> Pré-visualizar
        </button>
        <button
          onClick={() => {
            if (!previewHtml) { toast.info("Finalize o laudo primeiro"); return; }
            const w = window.open("", "_blank");
            if (w) {
              w.document.write(previewHtml);
              w.document.close();
              setTimeout(() => w.print(), 500);
            }
          }}
          disabled={!allDone}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary transition-all disabled:opacity-40"
        >
          <Download className="w-4 h-4" /> Exportar PDF
        </button>
      </section>
    </div>
  );
}
