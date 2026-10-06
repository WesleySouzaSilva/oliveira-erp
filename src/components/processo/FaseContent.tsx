import { useState, useEffect, useCallback } from "react";
import type { Processo, FaseProcesso, Movimentacao } from "@/data/mockProcessos";

import {
  FileText,
  Download,
  Eye,
  Send,
  Bot,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Gavel,
  Plus,
  RefreshCw,
  Loader2,
  Save,
  Trash2,
  MapPin,
  Landmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { notifyOrg } from "@/lib/orgNotify";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface FaseContentProps {
  processo: Processo;
  fase: FaseProcesso;
  onSaveFaseData?: (fase: FaseProcesso, data: Record<string, any>) => Promise<void>;
  onAdvanceFase?: (fromFase: FaseProcesso) => Promise<void>;
  laudoId?: string;
  processoId?: string;
  movimentacoes?: Movimentacao[];
  onMovimentacaoAdded?: () => void;
}

export function FaseContent({ processo, fase, onSaveFaseData, onAdvanceFase, laudoId, processoId, movimentacoes, onMovimentacaoAdded }: FaseContentProps) {
  switch (fase) {
    case 1:
      return <Fase1Content processo={processo} laudoId={laudoId} onAdvance={onAdvanceFase} />;
    case 2:
      return <Fase2Content processo={processo} onSave={onSaveFaseData} onAdvance={onAdvanceFase} laudoId={laudoId} processoId={processoId} />;
    case 3:
      return <Fase3Content processo={processo} onSave={onSaveFaseData} onAdvance={onAdvanceFase} laudoId={laudoId} />;
    case 4:
      return <Fase4Content processo={processo} onSave={onSaveFaseData} onAdvance={onAdvanceFase} processoId={processoId} movimentacoes={movimentacoes} onMovimentacaoAdded={onMovimentacaoAdded} />;
    case 5:
      return <Fase5Content processo={processo} onSave={onSaveFaseData} />;
  }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-card">
      <h3 className="text-sm font-semibold text-foreground mb-4 font-body">{title}</h3>
      {children}
    </div>
  );
}

/* FASE 1 — Laudo Técnico */
function Fase1Content({ processo, laudoId, onAdvance }: { processo: Processo; laudoId?: string; onAdvance?: (fromFase: FaseProcesso) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [externalDocs, setExternalDocs] = useState<Array<{ id: string; nome_arquivo: string; storage_path: string; tamanho_bytes: number }>>([]);

  // Check if this is an external laudo (no score, no hipoteses)
  const isExternalLaudo = processo.scoreEnquadramento === 0 && processo.hipotesesMcr.length === 0;

  const scoreColor =
    processo.scoreEnquadramento >= 70
      ? "text-success border-success/30 bg-success/5"
      : processo.scoreEnquadramento >= 40
      ? "text-accent border-accent/30 bg-accent/5"
      : "text-destructive border-destructive/30 bg-destructive/5";

  // Load existing external laudo documents
  useEffect(() => {
    if (!laudoId) return;
    supabase
      .from("documentos")
      .select("id, nome_arquivo, storage_path, tamanho_bytes")
      .eq("laudo_id", laudoId)
      .eq("categoria", "laudo_externo")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setExternalDocs(data as any);
      });
  }, [laudoId]);

  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!laudoId) {
      toast.error("Processo sem laudo vinculado.");
      return;
    }
    setUploading(true);
    const arr = Array.from(files);
    let firstUrl: string | null = null;
    const inserted: typeof externalDocs = [];
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      for (const file of arr) {
        const safeName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${userId}/external/${laudoId}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from("laudos")
          .upload(filePath, file, { contentType: file.type || "application/pdf" });
        if (uploadErr) {
          console.error("Upload error:", uploadErr);
          toast.error(`Erro ao enviar ${file.name}: ${uploadErr.message}`);
          continue;
        }
        const { data: urlData } = supabase.storage.from("laudos").getPublicUrl(filePath);
        if (!firstUrl) firstUrl = urlData.publicUrl;

        const { data: doc } = await supabase
          .from("documentos")
          .insert({
            laudo_id: laudoId,
            nome_arquivo: file.name,
            categoria: "laudo_externo",
            storage_path: filePath,
            tamanho_bytes: file.size,
            user_id: userId!,
          })
          .select("id, nome_arquivo, storage_path, tamanho_bytes")
          .single();
        if (doc) inserted.push(doc as any);
      }

      if (inserted.length) {
        setExternalDocs((prev) => [...inserted, ...prev]);
        // Update laudo with first URL if not yet set + garantir vínculo com cliente para
        // que apareça no Drive do Cliente (aba "Laudos")
        const { data: laudoAtual } = await supabase
          .from("laudos")
          .select("dados_etapa1, organizacao_id")
          .eq("id", laudoId)
          .maybeSingle();
        const etapa1: any = (laudoAtual?.dados_etapa1 as any) || {};
        if (processo?.produtor && !etapa1.nomeProdutor) {
          etapa1.nomeProdutor = processo.produtor;
        }
        await supabase
          .from("laudos")
          .update({ pdf_url: firstUrl, status: "finalizado", dados_etapa1: etapa1 })
          .eq("id", laudoId);

        // Espelhar no Drive do Cliente (pasta "Laudos") para acesso rápido
        const nomeCli =
          processo?.produtor ||
          etapa1.nomeProdutor ||
          etapa1.produtor ||
          etapa1.nome ||
          etapa1.nomePropriedade;
        if (nomeCli && userId) {
          await supabase.from("arquivos_cliente").insert(
            inserted.map((d: any) => ({
              user_id: userId,
              organizacao_id: laudoAtual?.organizacao_id ?? null,
              nome_cliente: nomeCli,
              nome_arquivo: d.nome_arquivo,
              storage_path: d.storage_path,
              tamanho_bytes: d.tamanho_bytes,
              pasta: "Laudos",
            }))
          );
          await notifyOrg({
            organizacaoId: laudoAtual?.organizacao_id ?? null,
            authorUserId: userId,
            mensagem: `Novo laudo anexado para ${nomeCli} (Fase 1)`,
            tipo: "info",
          });
        }
        toast.success(`${inserted.length} laudo(s) anexado(s) com sucesso!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer upload");
    }
    setUploading(false);
  }, [laudoId]);

  const handleRemoveDoc = async (doc: { id: string; storage_path: string }) => {
    await supabase.storage.from("laudos").remove([doc.storage_path]);
    await supabase.from("documentos").delete().eq("id", doc.id);
    setExternalDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Laudo removido");
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length) handleUploadFiles(files);
    };
    input.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📋</span>
        <h2 className="text-lg font-display font-bold text-foreground">
          Fase 1 — Laudo Técnico
        </h2>
        {processo.statusFases[1] === "concluida" && (
          <span className="status-badge bg-success/15 text-success text-xs">Concluído</span>
        )}
        {processo.statusFases[1] === "em_andamento" && (
          <span className="status-badge bg-accent/15 text-accent text-xs">Em andamento</span>
        )}
      </div>

      {!isExternalLaudo && (
        /* Normal laudo view */
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Score */}
          <div className={`rounded-lg border p-4 text-center ${scoreColor}`}>
            <p className="text-3xl font-display font-bold">{processo.scoreEnquadramento || "—"}</p>
            <p className="text-xs mt-1">Score de Enquadramento</p>
          </div>

          {/* Hipóteses */}
          <SectionCard title="Hipóteses MCR">
            <div className="flex flex-wrap gap-2">
              {processo.hipotesesMcr.length > 0 ? (
                processo.hipotesesMcr.map((h) => (
                  <span
                    key={h}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20"
                  >
                    MCR 2.6.4-{h}
                  </span>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma hipótese selecionada no laudo</p>
              )}
            </div>
          </SectionCard>

          {/* Contrato */}
          <SectionCard title="Contrato">
            <div className="space-y-1.5 text-xs">
              <p><span className="text-muted-foreground">Banco:</span> <span className="font-medium text-foreground">{processo.banco}</span></p>
              <p><span className="text-muted-foreground">Valor:</span> <span className="font-medium text-foreground">{processo.saldoDevedor}</span></p>
              <p><span className="text-muted-foreground">Cultura:</span> <span className="font-medium text-foreground">{processo.cultura}</span></p>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Anexos de laudos externos — sempre disponível */}
      <SectionCard title="Laudos Externos Anexados">
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files);
            }}
            onClick={openFilePicker}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
              dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
            }`}
          >
            <Upload className={`w-8 h-8 mx-auto mb-2 ${dragging ? "text-accent" : "text-muted-foreground"}`} />
            {uploading ? (
              <p className="text-sm text-accent font-medium">Enviando...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Arraste vários arquivos aqui ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Word, imagens — anexe múltiplos laudos externos
                </p>
              </>
            )}
          </div>

          {externalDocs.length > 0 && (
            <div className="space-y-2">
              {externalDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.nome_arquivo}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(doc.tamanho_bytes)}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const { data } = await supabase.storage.from("laudos").createSignedUrl(doc.storage_path, 3600);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                    }}
                    className="text-muted-foreground hover:text-accent transition-colors"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveDoc(doc)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <div className="flex gap-3">
        {laudoId && !isExternalLaudo && (
          <a
            href={`/novo-laudo?id=${laudoId}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Eye className="w-4 h-4" /> Ver laudo completo
          </a>
        )}
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <Download className="w-4 h-4" /> Baixar PDF do laudo
        </button>
      </div>

      {/* Avançar para próxima fase */}
      {processo.statusFases[1] !== "concluida" && onAdvance && (
        <div className="pt-4 border-t border-border flex justify-end">
          <button
            onClick={() => onAdvance(1)}
            disabled={!isExternalLaudo && externalDocs.length === 0 && !laudoId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
          >
            Avançar para Fase 2 — Notificação <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* FASE 2 — Notificação Extrajudicial */
function Fase2Content({
  processo,
  onSave,
  onAdvance,
  laudoId,
  processoId,
}: {
  processo: Processo;
  onSave?: (fase: FaseProcesso, data: Record<string, any>) => Promise<void>;
  onAdvance?: (fromFase: FaseProcesso) => Promise<void>;
  laudoId?: string;
  processoId?: string;
}) {
  const isEnviada = !!processo.dataEnvioNotificacao;
  const [generatingNotif, setGeneratingNotif] = useState(false);
  const [notifText, setNotifText] = useState("");
  const dadosFase2 = (processo as any).dadosFase2 || {};
  type Anexo = {
    id: string;
    nome: string;
    storage_path: string;
    tamanho: number;
    tipo?: string;
  };
  type Envio = {
    id: string;
    via: string;
    viaOutro?: string;
    data: string;
    destinatario?: string;
    superintendencia?: string;
    protocoloAR?: string;
    observacao?: string;
    externa?: boolean; // notificação registrada por fora da plataforma
    anexos?: Anexo[];
  };
  const initialEnvios: Envio[] = Array.isArray(dadosFase2.envios)
    ? dadosFase2.envios
    : processo.viaEnvio || processo.dataEnvioNotificacao
    ? [{
        id: crypto.randomUUID(),
        via: processo.viaEnvio || "",
        data: processo.dataEnvioNotificacao || "",
      }]
    : [];
  const [envios, setEnvios] = useState<Envio[]>(initialEnvios);
  const [saving, setSaving] = useState(false);

  const VIAS_ENVIO = [
    "Cartório de Títulos e Documentos (recomendado)",
    "Correios com AR",
    "Protocolo direto na agência (gerente)",
    "consumidor.gov",
    "E-mail certificado",
    "Outro",
  ];

  const novoEnvio = (externa = false): Envio => ({
    id: crypto.randomUUID(),
    via: "",
    data: new Date().toISOString().split("T")[0],
    externa,
  });

  const updateEnvio = (id: string, patch: Partial<Envio>) =>
    setEnvios((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const removeEnvio = (id: string) =>
    setEnvios((prev) => prev.filter((e) => e.id !== id));

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handleUploadAnexos = async (envioId: string, files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploadingId(envioId);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Sessão expirada. Faça login novamente.");
        setUploadingId(null);
        return;
      }
      const baseFolder = processoId || laudoId || "sem-id";
      const novos: Anexo[] = [];
      for (const file of arr) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${userId}/notificacoes/${baseFolder}/${envioId}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from("laudos")
          .upload(filePath, file, { contentType: file.type || "application/octet-stream" });
        if (error) {
          toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
          continue;
        }
        novos.push({
          id: crypto.randomUUID(),
          nome: file.name,
          storage_path: filePath,
          tamanho: file.size,
          tipo: file.type,
        });
        // Also register in documentos table for visibility in Drive
        if (laudoId && userId) {
          await supabase.from("documentos").insert({
            laudo_id: laudoId,
            nome_arquivo: file.name,
            categoria: "notificacao_externa",
            storage_path: filePath,
            tamanho_bytes: file.size,
            user_id: userId,
          });
        }
      }
      if (novos.length) {
        setEnvios((prev) =>
          prev.map((e) =>
            e.id === envioId ? { ...e, anexos: [...(e.anexos || []), ...novos] } : e
          )
        );
        toast.success(`${novos.length} anexo(s) adicionado(s)`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar anexos");
    }
    setUploadingId(null);
  };

  const handleRemoveAnexo = async (envioId: string, anexo: Anexo) => {
    await supabase.storage.from("laudos").remove([anexo.storage_path]);
    setEnvios((prev) =>
      prev.map((e) =>
        e.id === envioId ? { ...e, anexos: (e.anexos || []).filter((a) => a.id !== anexo.id) } : e
      )
    );
    toast.success("Anexo removido");
  };

  const openAnexo = async (path: string) => {
    const { data } = await supabase.storage.from("laudos").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleGenerateNotification = async () => {
    setGeneratingNotif(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-laudo", {
        body: {
          action: "generate_notification",
          context: {
            produtor: processo.produtor,
            banco: processo.banco,
            contratos: processo.contrato.split(", ").filter(Boolean),
            saldoDevedor: processo.saldoDevedor,
            cultura: processo.cultura,
            safra: processo.safra,
            municipio: processo.municipio,
            uf: processo.uf,
            scoreEnquadramento: processo.scoreEnquadramento,
            hipoteses: processo.hipotesesMcr,
            prazoSolicitado: processo.prazoSolicitado,
          },
        },
      });

      if (error) throw error;

      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result.error) throw new Error(result.error);
      setNotifText(result.content || "");
      toast.success("Notificação gerada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar notificação");
    }
    setGeneratingNotif(false);
  };

  const handleSaveEnvios = async (avancar: boolean) => {
    if (!onSave) return;
    const validos = envios.filter((e) => e.via && e.data);
    if (validos.length === 0) {
      toast.error("Adicione ao menos um envio com via e data preenchidas.");
      return;
    }
    setSaving(true);

    // Use earliest sent date as the reference for the bank response deadline
    const datasOrdenadas = validos
      .map((e) => e.data)
      .sort((a, b) => a.localeCompare(b));
    const primeiraData = datasOrdenadas[0];
    const envioDate = new Date(primeiraData);
    envioDate.setDate(envioDate.getDate() + 21);
    const prazoResposta = envioDate.toISOString().split("T")[0];

    const principal = validos[0];
    await onSave(2, {
      envios: validos,
      viaEnvio: principal.via === "Outro" ? principal.viaOutro || "Outro" : principal.via,
      dataEnvioNotificacao: primeiraData,
      prazoRespostaBanco: prazoResposta,
      protocoloAR: principal.protocoloAR || "",
      destinatario: principal.destinatario || "",
      superintendencia: principal.superintendencia || "",
      notificacaoTexto: notifText,
    });

    if (avancar && onAdvance) {
      await onAdvance(2);
    } else {
      toast.success("Envios salvos.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📨</span>
        <h2 className="text-lg font-display font-bold text-foreground">
          Fase 2 — Notificação Extrajudicial
        </h2>
        {processo.statusFases[2] === "concluida" && (
          <span className="status-badge bg-success/15 text-success text-xs">Concluída</span>
        )}
        {processo.statusFases[2] === "em_andamento" && (
          <span className="status-badge bg-accent/15 text-accent text-xs">Em andamento</span>
        )}
      </div>

      {/* Gerar Notificação */}
      <SectionCard title="Geração da Notificação">
        <p className="text-sm text-muted-foreground mb-4">
          A IA gera uma notificação extrajudicial completa com base no laudo técnico,
          fundamentada no MCR 2.6.4, Súmula 298 do STJ e legislação aplicável.
        </p>
        <button
          onClick={handleGenerateNotification}
          disabled={generatingNotif}
          className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
        >
          {generatingNotif ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Bot className="w-5 h-5" />
          )}
          {generatingNotif ? "Gerando notificação..." : "Gerar notificação extrajudicial com IA"}
        </button>
      </SectionCard>

      {/* Editor */}
      <SectionCard title="Editor da Notificação">
        {notifText ? (
          <textarea
            value={notifText}
            onChange={(e) => setNotifText(e.target.value)}
            rows={20}
            className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono leading-relaxed"
          />
        ) : (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Gere a notificação com IA para editá-la aqui.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Editor com formatação e exportação DOCX/PDF.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Dados do envio — múltiplos pedidos */}
      <SectionCard title="Dados do Envio">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cada envio representa um pedido enviado ao banco. Adicione um por vez — você pode registrar várias vias (ex.: protocolo na agência + consumidor.gov).
          </p>

          {envios.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-6 text-center">
              <Send className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
            </div>
          )}

          {envios.map((envio, idx) => (
            <div key={envio.id} className="rounded-xl border border-border bg-background/50 p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {envio.externa ? "Notificação externa" : "Envio"} #{idx + 1}
                  </span>
                  {envio.externa && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                      Fora da plataforma
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeEnvio(envio.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  title="Remover envio"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Via de envio</label>
                  <select
                    value={envio.via}
                    onChange={(e) => updateEnvio(envio.id, { via: e.target.value })}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Selecione...</option>
                    {VIAS_ENVIO.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de envio</label>
                  <input
                    type="date"
                    value={envio.data}
                    onChange={(e) => updateEnvio(envio.id, { data: e.target.value })}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {envio.via === "Outro" && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Descreva a via</label>
                    <input
                      type="text"
                      value={envio.viaOutro || ""}
                      onChange={(e) => updateEnvio(envio.id, { viaOutro: e.target.value })}
                      placeholder="Ex.: WhatsApp do gerente, Ouvidoria interna..."
                      className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Destinatário</label>
                  <input
                    type="text"
                    value={envio.destinatario || ""}
                    onChange={(e) => updateEnvio(envio.id, { destinatario: e.target.value })}
                    placeholder="Ex.: Gerente Sr., Ouvidoria"
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Superintendência regional</label>
                  <input
                    type="text"
                    value={envio.superintendencia || ""}
                    onChange={(e) => updateEnvio(envio.id, { superintendencia: e.target.value })}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Nº protocolo / AR / referência
                  </label>
                  <input
                    type="text"
                    value={envio.protocoloAR || ""}
                    onChange={(e) => updateEnvio(envio.id, { protocoloAR: e.target.value })}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                  <textarea
                    value={envio.observacao || ""}
                    onChange={(e) => updateEnvio(envio.id, { observacao: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Anexos do envio */}
              <div className="pt-3 border-t border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-foreground">
                    Anexos {envio.externa ? "(comprovante/notificação enviada por fora)" : "(comprovante de envio)"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.multiple = true;
                      input.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic";
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files && files.length) handleUploadAnexos(envio.id, files);
                      };
                      input.click();
                    }}
                    disabled={uploadingId === envio.id}
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                  >
                    {uploadingId === envio.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Adicionar anexo
                  </button>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length) handleUploadAnexos(envio.id, e.dataTransfer.files);
                  }}
                  className="border border-dashed border-border rounded-lg p-3 bg-muted/20"
                >
                  {(envio.anexos || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Arraste arquivos aqui ou clique em "Adicionar anexo".
                      {envio.externa && " Anexe a notificação que foi feita por fora da plataforma."}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(envio.anexos || []).map((a) => (
                        <div key={a.id} className="flex items-center gap-2 bg-card border border-border rounded-md px-2.5 py-1.5">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{a.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{formatSize(a.tamanho)}</p>
                          </div>
                          <button
                            onClick={() => openAnexo(a.storage_path)}
                            className="text-muted-foreground hover:text-accent transition-colors p-1"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveAnexo(envio.id, a)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEnvios((prev) => [...prev, novoEnvio(false)])}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card hover:bg-secondary transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar envio
            </button>
          </div>

          {envios.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <button
                onClick={() => handleSaveEnvios(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar envios
              </button>
              <button
                onClick={() => handleSaveEnvios(true)}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Salvar e avançar para próxima fase
              </button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

/* FASE 3 — Resposta do Banco */
function Fase3Content({
  processo,
  onSave,
  onAdvance,
  laudoId,
}: {
  processo: Processo;
  onSave?: (fase: FaseProcesso, data: Record<string, any>) => Promise<void>;
  onAdvance?: (fromFase: FaseProcesso) => Promise<void>;
  laudoId?: string;
}) {
  // Lista de contratos vindos do processo (string separada por vírgulas)
  const contratosLista = (processo.contrato || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  // Banco principal (model atual armazena 1 banco por processo)
  const bancoPrincipal = processo.banco || "Banco";

  type RespostaContrato = {
    contrato: string;
    banco: string;
    tipoResposta: string;
    dataResposta?: string;
    prazoConcedido?: string;
    fundamentosNegativa?: string;
    observacoes?: string;
  };

  // Carrega respostas previamente salvas (dados_fase3.respostasPorContrato)
  const respostasIniciais: RespostaContrato[] = (() => {
    const salvas = (processo as any).dadosFase3?.respostasPorContrato as RespostaContrato[] | undefined;
    if (salvas && Array.isArray(salvas) && salvas.length > 0) {
      // Garante que todos os contratos atuais estejam presentes
      const map = new Map(salvas.map((r) => [r.contrato, r]));
      return contratosLista.map(
        (c) =>
          map.get(c) || {
            contrato: c,
            banco: bancoPrincipal,
            tipoResposta: "",
          },
      );
    }
    // Migração: só aplica o status legado quando há UM único contrato.
    // Com múltiplos contratos, o status legado é ambíguo (o "pior" foi salvo
    // como agregado) e não deve ser propagado a todos — cada contrato deve
    // ser preenchido individualmente.
    const aplicarLegado = contratosLista.length === 1;
    return contratosLista.map((c) => ({
      contrato: c,
      banco: bancoPrincipal,
      tipoResposta: aplicarLegado ? (processo.tipoRespostaBanco || "") : "",
      dataResposta: aplicarLegado ? (processo.dataRespostaBanco || "") : "",
      prazoConcedido: aplicarLegado ? (processo.prazoConcedido?.toString() || "") : "",
    }));
  })();

  const [respostas, setRespostas] = useState<RespostaContrato[]>(respostasIniciais);
  const [saving, setSaving] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const askConfirm = useConfirm();

  const respostaConfig = {
    aceito: { icon: CheckCircle2, color: "text-success", label: "Banco aceitou — prorrogação concedida" },
    negado: { icon: XCircle, color: "text-destructive", label: "Banco negou com fundamentação escrita" },
    silencio: { icon: Clock, color: "text-muted-foreground", label: "Silêncio — banco não respondeu no prazo" },
    aguardando: { icon: Clock, color: "text-info", label: "Aguardando resposta (dentro do prazo)" },
    documentos_complementares: { icon: RefreshCw, color: "text-accent", label: "Banco pediu documentos complementares" },
  };

  const updateResposta = (idx: number, patch: Partial<RespostaContrato>) => {
    setRespostas((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removerContrato = async (idx: number) => {
    const alvo = respostas[idx];
    if (!alvo) return;
    const ok = await askConfirm({
      title: "Remover contrato",
      description: `Remover o contrato "${alvo.contrato}" deste processo? Ele será excluído da Fase 1 (laudo) e desta fase. Esta ação não pode ser desfeita.`,
      destructive: true,
      confirmText: "Remover",
    });
    if (!ok) return;
    if (!laudoId) {
      toast.error("Laudo deste processo não encontrado.");
      return;
    }
    setRemovingIdx(idx);
    try {
      // 1. Atualiza o laudo (dados_etapa1.contratos) — fonte de verdade dos contratos
      const { data: laudo, error: errFetch } = await supabase
        .from("laudos")
        .select("dados_etapa1")
        .eq("id", laudoId)
        .single();
      if (errFetch) throw errFetch;

      const etapa1 = (laudo?.dados_etapa1 || {}) as Record<string, any>;
      let novosContratos: any = etapa1.contratos;
      if (Array.isArray(novosContratos)) {
        novosContratos = novosContratos.filter((c: string) => c !== alvo.contrato);
      } else if (typeof novosContratos === "string") {
        novosContratos = novosContratos
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c && c !== alvo.contrato)
          .join(", ");
      }
      const novaEtapa1 = { ...etapa1, contratos: novosContratos };
      const { error: errUpd } = await supabase
        .from("laudos")
        .update({ dados_etapa1: novaEtapa1 })
        .eq("id", laudoId);
      if (errUpd) throw errUpd;

      // 2. Remove a resposta correspondente em dados_fase3
      const novasRespostas = respostas.filter((_, i) => i !== idx);
      setRespostas(novasRespostas);
      if (onSave) {
        await onSave(3, { respostasPorContrato: novasRespostas });
      }
      toast.success("Contrato removido do processo.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover contrato");
    } finally {
      setRemovingIdx(null);
    }
  };

  const algumaRespostaPreenchida = respostas.some((r) => Boolean(r.tipoResposta));
  const todosPreenchidos = respostas.length > 0 && respostas.every((r) => r.tipoResposta);
  const todosAceitos = todosPreenchidos && respostas.every((r) => r.tipoResposta === "aceito");
  const algumNegadoOuSilencio = respostas.some((r) => r.tipoResposta === "negado" || r.tipoResposta === "silencio");

  const handleSave = async (options?: { advanceToFase4?: boolean }) => {
    if (!onSave || !algumaRespostaPreenchida) return;
    setSaving(true);

    // Resumo agregado: usa o "pior" status para preencher o campo legado
    const piorStatus = respostas.some((r) => r.tipoResposta === "negado")
      ? "negado"
      : respostas.some((r) => r.tipoResposta === "silencio")
        ? "silencio"
        : respostas.some((r) => r.tipoResposta === "documentos_complementares")
          ? "documentos_complementares"
          : respostas.some((r) => r.tipoResposta === "aguardando")
            ? "aguardando"
            : "aceito";

    try {
      await onSave(3, {
        tipoRespostaBanco: piorStatus,
        respostasPorContrato: respostas,
      });

      // Avança para Fase 4 somente por ação explícita do usuário.
      if (options?.advanceToFase4 && algumNegadoOuSilencio && onAdvance) {
        await onAdvance(3);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🏦</span>
        <h2 className="text-lg font-display font-bold text-foreground">
          Fase 3 — Resposta do Banco
        </h2>
      </div>

      {contratosLista.length === 0 && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 text-sm text-muted-foreground">
          Nenhum contrato cadastrado neste processo. Adicione contratos na Fase 1 para registrar as respostas.
        </div>
      )}

      {/* Resumo de destinos por contrato */}
      {contratosLista.length > 0 && respostas.some((r) => r.tipoResposta) && (() => {
        const aceitos = respostas.filter((r) => r.tipoResposta === "aceito");
        const judiciais = respostas.filter(
          (r) => r.tipoResposta === "negado" || r.tipoResposta === "silencio",
        );
        const pendentes = respostas.filter(
          (r) => r.tipoResposta === "aguardando" || r.tipoResposta === "documentos_complementares",
        );
        return (
          <div className="grid sm:grid-cols-3 gap-2.5">
            <div className="rounded-lg border-2 border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <p className="text-[11px] uppercase tracking-wide font-bold text-success">
                  Administrativo · {aceitos.length}
                </p>
              </div>
              {aceitos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum contrato aceito.</p>
              ) : (
                <p className="text-xs text-foreground break-words">
                  {aceitos.map((r) => r.contrato).join(", ")}
                </p>
              )}
            </div>
            <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Gavel className="w-4 h-4 text-destructive" />
                <p className="text-[11px] uppercase tracking-wide font-bold text-destructive">
                  Judicial · {judiciais.length}
                </p>
              </div>
              {judiciais.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum contrato para via judicial.</p>
              ) : (
                <p className="text-xs text-foreground break-words">
                  {judiciais
                    .map((r) => `${r.contrato} (${r.tipoResposta === "negado" ? "negado" : "silêncio"})`)
                    .join(", ")}
                </p>
              )}
            </div>
            <div className="rounded-lg border-2 border-info/30 bg-info/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-4 h-4 text-info" />
                <p className="text-[11px] uppercase tracking-wide font-bold text-info">
                  Pendente · {pendentes.length}
                </p>
              </div>
              {pendentes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum contrato pendente.</p>
              ) : (
                <p className="text-xs text-foreground break-words">
                  {pendentes.map((r) => r.contrato).join(", ")}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Card por contrato */}
      {respostas.map((resp, idx) => {
        const tipo = resp.tipoResposta;
        return (
          <SectionCard
            key={resp.contrato + idx}
            title={`${resp.banco} — Contrato ${resp.contrato}`}
          >
            <div className="flex justify-end -mt-2 mb-2">
              <button
                type="button"
                onClick={() => removerContrato(idx)}
                disabled={removingIdx === idx}
                className="inline-flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 disabled:opacity-50"
                title="Remover este contrato do processo"
              >
                {removingIdx === idx ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Remover contrato
              </button>
            </div>
            <div className="space-y-3">
              {(Object.entries(respostaConfig) as [string, typeof respostaConfig.aceito][]).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  const isSelected = tipo === key;
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`tipo_resposta_${idx}`}
                        checked={isSelected}
                        onChange={() => updateResposta(idx, { tipoResposta: key })}
                        className="accent-accent w-4 h-4"
                      />
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <span className="text-sm text-foreground">{config.label}</span>
                    </label>
                  );
                },
              )}
            </div>

            {tipo === "aceito" && (
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="floating-label-group">
                  <input
                    type="date"
                    placeholder=" "
                    value={resp.dataResposta || ""}
                    onChange={(e) => updateResposta(idx, { dataResposta: e.target.value })}
                  />
                  <label>Data da resposta</label>
                </div>
                <div className="floating-label-group">
                  <input
                    type="number"
                    placeholder=" "
                    value={resp.prazoConcedido || ""}
                    onChange={(e) => updateResposta(idx, { prazoConcedido: e.target.value })}
                  />
                  <label>Prazo concedido (meses)</label>
                </div>
              </div>
            )}

            {tipo === "negado" && (
              <div className="mt-4 floating-label-group">
                <textarea
                  placeholder=" "
                  rows={3}
                  value={resp.fundamentosNegativa || ""}
                  onChange={(e) => updateResposta(idx, { fundamentosNegativa: e.target.value })}
                  className="w-full px-4 pt-5 pb-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <label className="top-2 text-xs text-accent translate-y-0">
                  Fundamentos da negativa
                </label>
              </div>
            )}

            {tipo === "silencio" && (
              <div className="mt-4 bg-accent/5 border border-accent/20 rounded-lg p-3 text-xs text-muted-foreground">
                Silêncio é elemento probatório favorável ao produtor em eventual ação judicial
                (TJPR 0002389-06.2010). Este contrato será incluído na via judicial.
              </div>
            )}

            {tipo === "aguardando" && processo.prazoRespostaBanco && (
              <div className="mt-4 bg-info/5 border border-info/20 rounded-lg p-3 text-xs text-muted-foreground">
                Prazo para resposta:{" "}
                {new Date(processo.prazoRespostaBanco).toLocaleDateString("pt-BR")}
              </div>
            )}

            <div className="mt-3 floating-label-group">
              <textarea
                placeholder=" "
                rows={2}
                value={resp.observacoes || ""}
                onChange={(e) => updateResposta(idx, { observacoes: e.target.value })}
                className="w-full px-4 pt-5 pb-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <label className="top-2 text-xs text-accent translate-y-0">
                Observações deste contrato
              </label>
            </div>
          </SectionCard>
        );
      })}

      {/* Save actions */}
      {algumaRespostaPreenchida && (
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-secondary text-secondary-foreground border border-border disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar respostas"}
          </button>
          {algumNegadoOuSilencio && (
            <button
              onClick={() => handleSave({ advanceToFase4: true })}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
              Salvar e ir para Fase 4
            </button>
          )}
          {algumNegadoOuSilencio && (
            <p className="text-xs text-muted-foreground max-w-md">
              Os contratos negados/sem resposta seguem para a via judicial. Os aceitos ficam
              registrados como prorrogação administrativa neste processo.
            </p>
          )}
          {!todosPreenchidos && (
            <p className="text-xs text-muted-foreground max-w-md">
              Contratos sem resposta permanecem em aberto; o que foi marcado já pode ser salvo.
            </p>
          )}
          {todosAceitos && (
            <p className="text-xs text-muted-foreground max-w-md">
              Todos os contratos foram aceitos; salve para registrar a prorrogação administrativa.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* FASE 4 — Via Judicial */
function Fase4Content({
  processo,
  onSave,
  onAdvance,
  processoId,
  movimentacoes = [],
  onMovimentacaoAdded,
}: {
  processo: Processo;
  onSave?: (fase: FaseProcesso, data: Record<string, any>) => Promise<void>;
  onAdvance?: (fromFase: FaseProcesso) => Promise<void>;
  processoId?: string;
  movimentacoes?: Movimentacao[];
  onMovimentacaoAdded?: () => void;
}) {
  const { user } = useAuth();
  const [cnj, setCnj] = useState(processo.numeroProcessoCnj || "");
  const [comarca, setComarca] = useState(processo.comarca || "");
  const [estado, setEstado] = useState((processo as any).estado || "");
  const [tribunal, setTribunal] = useState((processo as any).tribunal || "");
  const [tutela, setTutela] = useState(processo.statusTutela || "pendente");
  const [saving, setSaving] = useState(false);
  const [showMovForm, setShowMovForm] = useState(false);
  const [movDescricao, setMovDescricao] = useState("");
  const [movTipo, setMovTipo] = useState("despacho");
  const [movAnexo, setMovAnexo] = useState<File | null>(null);
  const [savingMov, setSavingMov] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    await onSave(4, {
      numeroProcessoCnj: cnj,
      comarca,
      estado,
      tribunal,
      statusTutela: tutela,
    });
    setSaving(false);
  };

  const checklistItems = [
    { label: "Laudo técnico agronômico", done: true },
    { label: "Notificação extrajudicial com comprovante", done: processo.statusFases[2] === "concluida" },
    { label: "Comprovante de resposta (negativa ou silêncio)", done: processo.statusFases[3] === "concluida" },
    { label: "Contrato de financiamento / CCR / CCB", done: false },
    
    { label: "Notas fiscais de venda", done: false },
    { label: "Planilha de fluxo de caixa", done: false },
  ];
  const completude = Math.round(
    (checklistItems.filter((c) => c.done).length / checklistItems.length) * 100
  );

  // Contratos provenientes da Fase 3 — destacar quais seguem na via judicial
  type RespostaContrato = {
    contrato: string;
    banco: string;
    tipoResposta: string;
    dataResposta?: string;
    fundamentosNegativa?: string;
    observacoes?: string;
  };
  const respostasFase3: RespostaContrato[] =
    ((processo as any).dadosFase3?.respostasPorContrato as RespostaContrato[] | undefined) || [];
  const contratosJudiciais = respostasFase3.filter(
    (r) => r.tipoResposta === "negado" || r.tipoResposta === "silencio",
  );
  const contratosAdministrativos = respostasFase3.filter((r) => r.tipoResposta === "aceito");

  const tipoConfig: Record<string, { label: string; classes: string; icon: typeof XCircle }> = {
    negado: {
      label: "Negado",
      classes: "bg-destructive/10 text-destructive border-destructive/30",
      icon: XCircle,
    },
    silencio: {
      label: "Silêncio",
      classes: "bg-muted text-muted-foreground border-border",
      icon: Clock,
    },
  };

  // Jurisdição: UF do cliente x Tribunal/UF do processo
  const ufCliente = (processo as any).uf || "—";
  const municipioCliente = (processo as any).municipio || "";
  // Inferir UF do tribunal a partir da comarca/vara digitada (procura sufixo "/UF")
  const inferirUfTribunal = (txt: string): string | null => {
    const m = (txt || "").toUpperCase().match(/\b([A-Z]{2})\b\s*$/);
    return m ? m[1] : null;
  };
  const ufTribunal =
    (estado || "").toUpperCase() ||
    inferirUfTribunal(comarca) ||
    ufCliente;
  const tribunalLabel =
    tribunal?.trim()
      ? tribunal
      : ufTribunal && ufTribunal !== "—"
      ? `TJ-${ufTribunal}`
      : "Não informado";
  const foraDoEstado =
    ufCliente && ufTribunal && ufCliente !== "—" && ufTribunal !== "—" && ufCliente !== ufTribunal;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">⚖️</span>
        <h2 className="text-lg font-display font-bold text-foreground">
          Fase 4 — Via Judicial
        </h2>
        {tutela === "deferida" && (
          <span className="status-badge bg-success/15 text-success text-xs">
            Tutela deferida
          </span>
        )}
      </div>

      {/* Contratos em discussão judicial (provenientes da Fase 3) */}
      {respostasFase3.length > 0 && (
        <SectionCard
          title={`Contratos em Discussão Judicial (${contratosJudiciais.length})`}
        >
          {contratosJudiciais.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum contrato com resposta negativa ou silêncio foi marcado na Fase 3.
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30">
                <Gavel className="w-4 h-4 text-accent shrink-0" />
                <p className="text-xs text-foreground">
                  <span className="font-semibold">{contratosJudiciais.length} contrato(s)</span>{" "}
                  seguem para discussão judicial com base nas respostas da Fase 3.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {contratosJudiciais.map((r, i) => {
                  const cfg = tipoConfig[r.tipoResposta] || tipoConfig.silencio;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={`${r.contrato}-${i}`}
                      className={`flex items-start gap-3 rounded-lg border-2 p-3 shadow-sm ${cfg.classes}`}
                    >
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-wide opacity-80 font-medium">
                          {r.banco}
                        </p>
                        <p className="text-sm font-bold break-all">
                          Contrato {r.contrato}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-background/60">
                            {cfg.label}
                          </span>
                          {r.dataResposta && (
                            <span className="text-xs opacity-80">
                              Resposta em {new Date(r.dataResposta).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                        {r.fundamentosNegativa && (
                          <p className="text-xs mt-1.5 opacity-90 line-clamp-2">
                            <span className="font-medium">Fundamentos:</span>{" "}
                            {r.fundamentosNegativa}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {contratosAdministrativos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {contratosAdministrativos.length}
                  </span>{" "}
                  contrato(s) aceito(s) administrativamente — não fazem parte desta ação:{" "}
                  <span className="italic">
                    {contratosAdministrativos.map((r) => r.contrato).join(", ")}
                  </span>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {/* Localização & Jurisdição */}
      <SectionCard title="Localização & Jurisdição">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-accent" />
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Estado do Cliente
              </p>
            </div>
            <p className="text-sm font-bold text-foreground">
              {municipioCliente ? `${municipioCliente} / ` : ""}
              <span className="text-accent">{ufCliente}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {processo.produtor}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="w-4 h-4 text-accent" />
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Tribunal / UF do Processo
              </p>
            </div>
            <p className="text-sm font-bold text-foreground">
              <span className="text-accent">{tribunalLabel}</span>
              {comarca && (
                <span className="font-normal text-muted-foreground"> · {comarca}</span>
              )}
            </p>
          {estado && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Estado: {estado}
            </p>
          )}
          </div>
        </div>
        {foraDoEstado && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
            <span className="text-foreground">
              <span className="font-semibold">Atenção:</span> O cliente é de{" "}
              <span className="font-semibold">{ufCliente}</span> e o processo está
              tramitando em <span className="font-semibold">{ufTribunal}</span>. Confirme
              a competência territorial.
            </span>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          Informe o Estado e o Tribunal em que o processo tramita nos campos abaixo.
        </p>
      </SectionCard>

      {/* Checklist */}
      <SectionCard title="Dossiê para Petição Inicial">
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Completude do dossiê</span>
            <span className="font-semibold text-foreground">{completude}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{ width: `${completude}%` }}
            />
          </div>
        </div>
        <div className="space-y-2.5">
          {checklistItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
              )}
              <span
                className={`text-sm ${
                  item.done ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
              {!item.done && (
                <button className="ml-auto text-xs text-accent font-medium hover:underline flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Anexar
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Gerar Petição */}
      <SectionCard title="Minuta de Petição Inicial">
        <p className="text-sm text-muted-foreground mb-4">
          Gere uma minuta de Ação de Obrigação de Fazer com pedido de tutela de urgência,
          fundamentada no MCR 2.6.4, Súmula 298 do STJ e jurisprudência.
        </p>
        <button className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all">
          <Gavel className="w-5 h-5" /> Gerar minuta de petição inicial
        </button>
      </SectionCard>

      {/* Dados do processo */}
      <SectionCard title="Dados do Processo Judicial">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="floating-label-group">
            <input
              type="text"
              placeholder=" "
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
            />
            <label>Nº do processo (CNJ)</label>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={comarca} onChange={(e) => setComarca(e.target.value)} />
            <label>Comarca</label>
          </div>
          <div className="floating-label-group">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full"
            >
              <option value="">—</option>
              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            <label>Estado (UF)</label>
          </div>
          <div className="floating-label-group">
            <input
              type="text"
              placeholder=" "
              value={tribunal}
              onChange={(e) => setTribunal(e.target.value)}
            />
            <label>Tribunal (ex: TJ-BA, TRF-1)</label>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Status da tutela de urgência</p>
            <div className="flex gap-3">
              {["pendente", "deferida", "negada"].map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-foreground cursor-pointer capitalize">
                  <input
                    type="radio"
                    name="tutela"
                    checked={tutela === s}
                    onChange={() => setTutela(s as any)}
                    className="accent-accent w-4 h-4"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar dados judiciais"}
        </button>
      </SectionCard>

      {/* Movimentações */}
      <SectionCard title="Movimentações Judiciais">
        <button
          onClick={() => setShowMovForm(!showMovForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors mb-4"
        >
          <Plus className="w-4 h-4" /> Adicionar movimentação
        </button>

        {showMovForm && (
          <div className="mb-4 p-4 border border-border rounded-lg bg-background space-y-3">
            <select
              value={movTipo}
              onChange={(e) => setMovTipo(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="despacho">Despacho</option>
              <option value="decisao">Decisão</option>
              <option value="liminar_concedida">Liminar concedida</option>
              <option value="liminar_negada">Liminar negada</option>
              <option value="intimacao">Intimação</option>
              <option value="audiencia">Audiência</option>
              <option value="sentenca_procedente">Sentença procedente</option>
              <option value="sentenca_improcedente">Sentença improcedente</option>
              <option value="acordo_homologado">Acordo homologado</option>
              <option value="recurso">Recurso</option>
              <option value="outro">Outro</option>
            </select>
            <textarea
              value={movDescricao}
              onChange={(e) => setMovDescricao(e.target.value)}
              placeholder="Descreva a movimentação judicial..."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
            />
            <div className="flex items-center gap-3">
              {movAnexo ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-accent shrink-0" />
                  <span className="truncate text-foreground">{movAnexo.name}</span>
                  <button onClick={() => setMovAnexo(null)} className="ml-auto text-muted-foreground hover:text-destructive">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) setMovAnexo(f);
                    };
                    input.click();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary border border-dashed border-border"
                >
                  <Upload className="w-4 h-4" /> Anexar decisão/documento
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!movDescricao.trim() || !processoId || !user) {
                    toast.error("Preencha a descrição");
                    return;
                  }
                  setSavingMov(true);
                  try {
                    let documentoUrl: string | null = null;

                    if (movAnexo) {
                      const safeName = movAnexo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                      const path = `${user.id}/movimentacoes/${processoId}/${Date.now()}_${safeName}`;
                      const { error: upErr } = await supabase.storage.from("cliente-drive").upload(path, movAnexo);
                      if (upErr) throw new Error("Erro ao enviar anexo");
                      documentoUrl = path;

                      // Also register in arquivos_cliente so it shows in Drive
                      await supabase.from("arquivos_cliente").insert({
                        user_id: user.id,
                        nome_cliente: processo.produtor,
                        nome_arquivo: movAnexo.name,
                        storage_path: path,
                        tamanho_bytes: movAnexo.size,
                        pasta: "Jurídico",
                      });
                    }

                    const { error } = await supabase.from("movimentacoes").insert({
                      processo_id: processoId,
                      fase: "4" as any,
                      tipo: movTipo,
                      descricao: movDescricao.trim(),
                      user_id: user.id,
                      documento_url: documentoUrl,
                    });
                    if (error) throw error;

                    toast.success("Movimentação registrada");
                    // Notifica equipe
                    try {
                      const { data: proc } = await supabase
                        .from("processos")
                        .select("organizacao_id")
                        .eq("id", processoId)
                        .maybeSingle();
                      await notifyOrg({
                        organizacaoId: proc?.organizacao_id ?? null,
                        authorUserId: user.id,
                        mensagem: `Nova movimentação (${movTipo}) em ${processo.produtor || "processo"}`,
                        tipo: "info",
                        processoId,
                      });
                    } catch {}
                    setMovDescricao("");
                    setMovTipo("despacho");
                    setMovAnexo(null);
                    setShowMovForm(false);
                    onMovimentacaoAdded?.();
                  } catch (err: any) {
                    toast.error(err.message || "Erro ao salvar");
                  }
                  setSavingMov(false);
                }}
                disabled={savingMov}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-foreground disabled:opacity-50"
              >
                {savingMov ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingMov ? "Salvando..." : "Registrar"}
              </button>
              <button
                onClick={() => { setShowMovForm(false); setMovDescricao(""); setMovAnexo(null); }}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* List existing movimentações */}
        {movimentacoes.filter(m => m.fase === 4).length > 0 ? (
          <div className="space-y-2">
            {movimentacoes.filter(m => m.fase === 4).map((mov) => (
              <div key={mov.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      {mov.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(mov.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{mov.descricao}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{mov.usuario}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Registre decisões, intimações, despachos, audiências e sentenças.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

/* FASE 5 — Encerrado */
function Fase5Content({
  processo,
  onSave,
}: {
  processo: Processo;
  onSave?: (fase: FaseProcesso, data: Record<string, any>) => Promise<void>;
}) {
  const [tipoEncerramento, setTipoEncerramento] = useState(processo.tipoEncerramento || "");
  const [dataEncerramento, setDataEncerramento] = useState(processo.dataEncerramento || "");
  const [prazoConcedido, setPrazoConcedido] = useState(processo.prazoConcedido?.toString() || "");
  const [saving, setSaving] = useState(false);

  const encerramentoOptions = [
    { value: "admin_aceito", label: "✅ Concedido administrativamente", desc: "Banco aceitou após notificação" },
    { value: "judicial_aceito", label: "✅ Concedido judicialmente", desc: "Sentença ou acordo em juízo" },
    { value: "nao_prosseguir", label: "❌ Produtor optou por não prosseguir", desc: "" },
    { value: "negado_definitivo", label: "❌ Negado definitivamente", desc: "Trânsito em julgado" },
    { value: "outro", label: "🔄 Outro motivo", desc: "" },
  ];

  const handleSave = async () => {
    if (!onSave || !tipoEncerramento) return;
    setSaving(true);
    await onSave(5, {
      tipoEncerramento,
      dataEncerramento: dataEncerramento || new Date().toISOString().split("T")[0],
      prazoConcedido: prazoConcedido ? Number(prazoConcedido) : null,
    });
    setSaving(false);
  };

  // Calc duration
  const inicio = new Date(processo.createdAt);
  const fim = processo.dataEncerramento ? new Date(processo.dataEncerramento) : new Date();
  const duracaoDias = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">✅</span>
        <h2 className="text-lg font-display font-bold text-foreground">
          Fase 5 — Encerramento
        </h2>
      </div>

      {processo.tipoEncerramento ? (
        <>
          {/* Result card */}
          <div className="bg-success/5 border border-success/20 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-success mb-3">Resultado do Processo</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{duracaoDias}</p>
                <p className="text-xs text-muted-foreground">Dias de duração</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">Fase {processo.faseAtual}</p>
                <p className="text-xs text-muted-foreground">Resolvido na fase</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">
                  {processo.prazoConcedido || "—"} meses
                </p>
                <p className="text-xs text-muted-foreground">Prazo conquistado</p>
              </div>
            </div>
          </div>

          <SectionCard title="Detalhes do Encerramento">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                <span className="font-medium text-foreground">
                  {encerramentoOptions.find((e) => e.value === processo.tipoEncerramento)?.label}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Data:</span>{" "}
                <span className="font-medium text-foreground">
                  {processo.dataEncerramento && new Date(processo.dataEncerramento).toLocaleDateString("pt-BR")}
                </span>
              </p>
            </div>
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard title="Tipo de Encerramento">
            <div className="space-y-3">
              {encerramentoOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    tipoEncerramento === opt.value
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="encerramento"
                    checked={tipoEncerramento === opt.value}
                    onChange={() => setTipoEncerramento(opt.value)}
                    className="accent-accent w-4 h-4"
                  />
                  <div>
                    <span className="text-sm text-foreground">{opt.label}</span>
                    {opt.desc && <p className="text-xs text-muted-foreground">{opt.desc}</p>}
                  </div>
                </label>
              ))}
            </div>
          </SectionCard>

          {tipoEncerramento && (
            <SectionCard title="Dados do Encerramento">
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div className="floating-label-group">
                  <input
                    type="date"
                    placeholder=" "
                    value={dataEncerramento}
                    onChange={(e) => setDataEncerramento(e.target.value)}
                  />
                  <label>Data do encerramento</label>
                </div>
                {(tipoEncerramento === "admin_aceito" || tipoEncerramento === "judicial_aceito") && (
                  <div className="floating-label-group">
                    <input
                      type="number"
                      placeholder=" "
                      value={prazoConcedido}
                      onChange={(e) => setPrazoConcedido(e.target.value)}
                    />
                    <label>Prazo concedido (meses)</label>
                  </div>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Salvando..." : "Encerrar processo"}
              </button>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
