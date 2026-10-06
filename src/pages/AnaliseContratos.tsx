import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSearch, Upload, X, FileText, Save, FileDown, RotateCcw, Eye, Scale, Gavel, MessageSquare, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";

type Sem = "verde" | "amarelo" | "vermelho";
type Citacao = { tipo?: string; referencia?: string; ementa_ou_descricao?: string };
type Resumo = {
  identificacao?: Record<string, string>;
  comparativo_bacen?: {
    cet_contratado_mensal?: string;
    cet_medio_bacen_periodo?: string;
    diferenca_percentual?: string;
    avaliacao?: "abaixo_media" | "alinhado" | "acima_media" | "muito_acima_media";
    observacao?: string;
  };
  semaforo?: Record<string, Sem>;
  citacoes?: Citacao[];
  recomendacao_curta?: string;
  classificacao?: "favoravel" | "atencao" | "risco_elevado";
  desclassificacao_rural?: {
    cabivel?: boolean;
    fundamento_resumo?: string;
    efeito_pratico?: string;
  };
};

const semColor: Record<Sem, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-red-500",
};

const classBadge: Record<string, { label: string; cls: string }> = {
  favoravel: { label: "Contrato favorável", cls: "bg-emerald-600 text-white" },
  atencao: { label: "Atenção requerida", cls: "bg-amber-500 text-white" },
  risco_elevado: { label: "Risco elevado", cls: "bg-red-600 text-white" },
};

const bacenBadge: Record<string, { label: string; cls: string }> = {
  abaixo_media: { label: "Abaixo da média", cls: "bg-emerald-600 text-white" },
  alinhado: { label: "Alinhado ao mercado", cls: "bg-muted text-foreground" },
  acima_media: { label: "Acima da média", cls: "bg-amber-500 text-white" },
  muito_acima_media: { label: "Muito acima da média", cls: "bg-red-600 text-white" },
};

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseResposta(raw: string): { resumo: Resumo | null; parecer: string } {
  const idx = raw.indexOf("---PARECER---");
  const head = idx >= 0 ? raw.slice(0, idx) : raw;
  const tail = idx >= 0 ? raw.slice(idx + "---PARECER---".length).trim() : "";
  // tenta extrair JSON
  const jsonMatch = head.match(/\{[\s\S]*\}/);
  let resumo: Resumo | null = null;
  if (jsonMatch) {
    try {
      resumo = JSON.parse(jsonMatch[0]);
    } catch {
      resumo = null;
    }
  }
  return { resumo, parecer: tail || head };
}

export default function AnaliseContratos() {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState("");
  const [contexto, setContexto] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dataPresumida, setDataPresumida] = useState("");
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [parecer, setParecer] = useState("");
  const [fileHash, setFileHash] = useState<string>("");
  const [historico, setHistorico] = useState<any[]>([]);
  const [filtroHist, setFiltroHist] = useState("");
  const [viewing, setViewing] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Chat contextual
  type ChatMsg = { role: "user" | "assistant"; content: string };
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chat, chatLoading]);

  // Carrega histórico de chat persistido quando a análise é gerada/recuperada do cache
  useEffect(() => {
    if (!fileHash) return;
    (async () => {
      const { data } = await supabase
        .from("analise_chat_mensagens" as any)
        .select("role, content")
        .eq("arquivo_hash", fileHash)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data && data.length > 0) {
        setChat((data as any).map((m: any) => ({ role: m.role, content: m.content })));
      }
    })();
  }, [fileHash]);

  const enviarChat = async (textoForcado?: string) => {
    const texto = (textoForcado ?? chatInput).trim();
    if (!texto || chatLoading) return;
    if (!parecer && !resumo) {
      toast.error("Gere uma análise primeiro para iniciar o chat.");
      return;
    }
    const novas: ChatMsg[] = [...chat, { role: "user", content: texto }];
    setChat(novas);
    setChatInput("");
    setChatLoading(true);
    // Persiste mensagem do usuário (best-effort)
    if (fileHash) {
      supabase.from("analise_chat_mensagens" as any).insert({
        arquivo_hash: fileHash,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        role: "user",
        content: texto,
      }).then(({ error }) => { if (error) console.warn("persist user msg falhou", error.message); });
    }
    try {
      const { data, error } = await supabase.functions.invoke("analise-contrato-chat", {
        body: {
          cliente_nome: cliente,
          tipo_contrato: resumo?.identificacao?.tipo_contrato || "",
          resumo,
          parecer,
          mensagens: novas,
          arquivo_hash: fileHash || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply || "";
      setChat((prev) => [...prev, { role: "assistant", content: reply }]);
      // Persiste resposta do assistente
      if (fileHash && reply) {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        supabase.from("analise_chat_mensagens" as any).insert({
          arquivo_hash: fileHash,
          user_id: uid,
          role: "assistant",
          content: reply,
        }).then(({ error }) => { if (error) console.warn("persist assistant msg falhou", error.message); });
      }
    } catch (e: any) {
      toast.error(`Falha no chat: ${e?.message || "desconhecido"}`);
      setChat((prev) => prev.slice(0, -1));
      setChatInput(texto);
    } finally {
      setChatLoading(false);
    }
  };

  const sugestoesChat = [
    "Qual é a tese mais forte para revisão deste contrato?",
    "Redija o pedido principal pronto para colar em petição.",
    "Quais documentos eu devo solicitar ao cliente para reforçar o caso?",
    "Há fundamento para suspender a exigibilidade da dívida em tutela?",
  ];

  const canAnalyze = cliente.trim() && files.length > 0 && !loading;

  const loadHistorico = async () => {
    const { data } = await supabase
      .from("analises_contratos" as any)
      .select("id, created_at, cliente_nome, tipo_contrato, classificacao, resumo_executivo, comparativo_bacen, parecer_completo, citacoes, arquivo_hash")
      .order("created_at", { ascending: false })
      .limit(100);
    setHistorico((data as any) || []);
  };

  useEffect(() => {
    loadHistorico();
  }, []);

  const MAX_ARQUIVOS = 5;
  const handleFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const novos: File[] = [];
    for (const f of Array.from(list)) {
      const ok = [".pdf", ".doc", ".docx"].some((ext) => f.name.toLowerCase().endsWith(ext));
      if (!ok) { toast.error(`Formato não suportado: ${f.name}`); continue; }
      if (f.size > 20 * 1024 * 1024) { toast.error(`Arquivo acima de 20MB: ${f.name}`); continue; }
      novos.push(f);
    }
    setFiles((prev) => {
      if (prev.length + novos.length > MAX_ARQUIVOS) toast.warning(`Máximo de ${MAX_ARQUIVOS} contratos por análise.`);
      return [...prev, ...novos].slice(0, MAX_ARQUIVOS);
    });
  };
  const removerArquivo = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const analisar = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setResumo(null);
    setParecer("");
    setProgress(5);
    setProgressMsg("Calculando hash dos arquivos...");
    let progressTimer: number | undefined;
    try {
      const hashes = await Promise.all(files.map((f) => sha256Hex(f)));
      const hash = hashes.join("|");
      setFileHash(hash);

      if (files.length === 1) {
        setProgress(15);
        setProgressMsg("Verificando cache...");
        const { data: cached } = await supabase
          .from("analises_contratos" as any)
          .select("resumo_executivo, parecer_completo, comparativo_bacen")
          .eq("arquivo_hash", hash)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cached && (cached as any).parecer_completo) {
          const r = (cached as any).resumo_executivo || {};
          if ((cached as any).comparativo_bacen) r.comparativo_bacen = (cached as any).comparativo_bacen;
          setResumo(r as Resumo);
          setParecer((cached as any).parecer_completo);
          setProgress(100);
          toast.success("Análise recuperada do cache (sem novo consumo de IA).");
          return;
        }
      }

      setProgress(25);
      setProgressMsg("Preparando documentos...");
      const arquivos = await Promise.all(files.map(async (f) => ({
        base64: await fileToBase64(f),
        mime: f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
        nome: f.name,
      })));

      // progresso simulado durante chamada da IA
      setProgress(35);
      setProgressMsg(files.length > 1 ? `Analisando ${files.length} contratos em conjunto (IA)...` : "Enviando ao parecer jurídico (IA)...");
      let pct = 35;
      progressTimer = window.setInterval(() => {
        pct = Math.min(pct + 2, 92);
        setProgress(pct);
        if (pct < 50) setProgressMsg("Lendo cláusulas do contrato...");
        else if (pct < 70) setProgressMsg("Comparando com taxas BACEN do período...");
        else if (pct < 85) setProgressMsg("Avaliando garantias e encargos...");
        else setProgressMsg("Redigindo parecer técnico...");
      }, 1500);

      const { data, error } = await supabase.functions.invoke("analise-contrato", {
        body: {
          cliente_nome: cliente,
          tipo_contrato: "auto",
          contexto_adicional: contexto,
          data_assinatura_presumida: dataPresumida || null,
          arquivos,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const jobId = (data as any)?.jobId as string | undefined;
      let raw = (data as any)?.raw as string | undefined; // compat legado
      if (!raw && jobId) {
        setProgressMsg("Analisando contrato em segundo plano...");
        // Poll do job (até 5 min)
        const started = Date.now();
        const TIMEOUT_MS = 5 * 60 * 1000;
        while (Date.now() - started < TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, 3000));
          const { data: jobRow, error: jobErr } = await supabase
            .from("analise_contrato_jobs" as any)
            .select("status, result_raw, error")
            .eq("id", jobId)
            .maybeSingle();
          if (jobErr) continue;
          const status = (jobRow as any)?.status;
          if (status === "done") {
            raw = (jobRow as any)?.result_raw || "";
            break;
          }
          if (status === "error") {
            throw new Error((jobRow as any)?.error || "Falha na análise.");
          }
        }
        if (!raw) throw new Error("Tempo esgotado aguardando a análise. Tente novamente.");
      }
      const parsed = parseResposta(raw || "");
      setResumo(parsed.resumo);
      setParecer(parsed.parecer);
      setProgress(100);
      setProgressMsg("Concluído.");
      toast.success("Parecer gerado com sucesso.");
    } catch (e: any) {
      toast.error(`Falha na análise: ${e?.message || "Erro desconhecido"}`);
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setLoading(false);
      setTimeout(() => { setProgress(0); setProgressMsg(""); }, 1200);
    }
  };

  const salvar = async () => {
    if (!resumo && !parecer) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      // Recupera a organizacao_id do operador (RLS exige escopo de org)
      let orgId: string | null = null;
      if (uid) {
        const { data: membro } = await supabase
          .from("membros")
          .select("organizacao_id")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();
        orgId = (membro as any)?.organizacao_id ?? null;
      }
      const { error } = await supabase.from("analises_contratos" as any).insert({
        cliente_nome: cliente,
        tipo_contrato: resumo?.identificacao?.tipo_contrato || "Detectado pela IA",
        arquivo_nome: files.map((f) => f.name).join(" | ") || null,
        arquivo_hash: fileHash || null,
        contexto_adicional: contexto || null,
        resumo_executivo: resumo as any,
        comparativo_bacen: (resumo?.comparativo_bacen as any) || null,
        citacoes: (resumo?.citacoes as any) || null,
        parecer_completo: parecer,
        classificacao: resumo?.classificacao || null,
        operador_id: uid,
        organizacao_id: orgId,
      });
      if (error) throw error;
      toast.success("Análise salva.");
      loadHistorico();
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e?.message || "desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const novaAnalise = () => {
    setCliente("");
    setContexto("");
    setFiles([]);
    setDataPresumida("");
    setResumo(null);
    setParecer("");
    setFileHash("");
    setChat([]);
    setChatInput("");
  };

  const gerarPeticao = (r: Resumo | null, p: string, cli: string, tp: string) => {
    navigate("/peticoes", {
      state: {
        fromAnaliseContrato: {
          cliente: cli,
          tipo_contrato: tp,
          resumo: r,
          parecer: p,
        },
      },
    });
  };

  const exportarPDF = (r: Resumo | null, p: string, cli: string, tp: string) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Parecer Jurídico — Análise de Contrato", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, y);
    y += 18;
    doc.setTextColor(20);
    doc.setFontSize(10);
    doc.text(`Cliente: ${cli}`, margin, y); y += 12;
    doc.text(`Tipo de contrato: ${tp}`, margin, y); y += 16;

    if (r) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Resumo executivo", margin, y); y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const ident = r.identificacao || {};
      const lines = [
        `Tipo detectado: ${ident.tipo_contrato || "-"}`,
        `Credor: ${ident.credor || "-"}`,
        `Devedor: ${ident.devedor || "-"}`,
        `Valor principal: ${ident.valor_principal || "-"}`,
        `Prazo: ${ident.prazo || "-"}`,
        `Taxa de juros: ${ident.taxa_juros || "-"}`,
        `CET: ${ident.cet || "-"}`,
        `Data de assinatura: ${ident.data_assinatura || "-"}`,
      ];
      lines.forEach((l) => { doc.text(l, margin, y); y += 11; });
      y += 4;
      const b = r.comparativo_bacen;
      if (b) {
        doc.setFont("helvetica", "bold"); doc.text("Comparativo BACEN", margin, y); y += 12;
        doc.setFont("helvetica", "normal");
        const cb = [
          `CET contratado (mensal): ${b.cet_contratado_mensal || "-"}`,
          `CET médio BACEN: ${b.cet_medio_bacen_periodo || "-"}`,
          `Diferença: ${b.diferenca_percentual || "-"}`,
          `Avaliação: ${(b.avaliacao && bacenBadge[b.avaliacao]?.label) || b.avaliacao || "-"}`,
        ];
        cb.forEach((l) => { doc.text(l, margin, y); y += 11; });
        if (b.observacao) {
          const obs = doc.splitTextToSize(`Obs.: ${b.observacao}`, W - margin * 2);
          doc.text(obs, margin, y); y += obs.length * 11;
        }
        y += 4;
      }
      if (r.recomendacao_curta) {
        doc.setFont("helvetica", "bold"); doc.text("Recomendação", margin, y); y += 12;
        doc.setFont("helvetica", "normal");
        const rec = doc.splitTextToSize(r.recomendacao_curta, W - margin * 2);
        doc.text(rec, margin, y); y += rec.length * 11 + 6;
      }
    }

    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Parecer completo", margin, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const body = doc.splitTextToSize(p || "", W - margin * 2);
    body.forEach((line: string) => {
      if (y > H - margin - 30) { doc.addPage(); y = margin; }
      doc.text(line, margin, y); y += 11;
    });

    // rodapé em todas as páginas
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(120);
      doc.text(
        "Documento gerado pelo sistema Oliveira Agro — Oliveira Advogados, Castro/PR — OAB/PR 98.012",
        W / 2, H - 18, { align: "center" }
      );
    }
    doc.save(`parecer-${cli.replace(/\s+/g, "_")}.pdf`);
  };

  const renderResumo = (r: Resumo | null) => {
    if (!r) return <p className="text-sm text-muted-foreground">Resumo não disponível.</p>;
    const ident = r.identificacao || {};
    const b = r.comparativo_bacen;
    const sem = r.semaforo || {};
    const cls = r.classificacao && classBadge[r.classificacao];
    const cits = r.citacoes || [];
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Tipo:</span> {ident.tipo_contrato || "-"}</div>
            {ident.numero_contrato && <div><span className="text-muted-foreground">Nº contrato:</span> {ident.numero_contrato}</div>}
            <div><span className="text-muted-foreground">Credor:</span> {ident.credor || "-"}</div>
            <div><span className="text-muted-foreground">Devedor:</span> {ident.devedor || "-"}</div>
            <div><span className="text-muted-foreground">Valor principal:</span> {ident.valor_principal || "-"}</div>
            <div><span className="text-muted-foreground">Prazo:</span> {ident.prazo || "-"}</div>
            <div><span className="text-muted-foreground">Taxa de juros:</span> {ident.taxa_juros || "-"}</div>
            <div><span className="text-muted-foreground">CET:</span> {ident.cet || "-"}</div>
            {ident.iof && <div><span className="text-muted-foreground">IOF:</span> {ident.iof}</div>}
            {ident.tarifas && <div><span className="text-muted-foreground">Tarifas:</span> {ident.tarifas}</div>}
            {ident.garantias_resumo && <div><span className="text-muted-foreground">Garantias:</span> {ident.garantias_resumo}</div>}
            <div><span className="text-muted-foreground">Assinatura:</span> {ident.data_assinatura || "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Comparativo BACEN</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><span className="text-muted-foreground">CET contratado:</span> {b?.cet_contratado_mensal || "-"}</div>
            <div><span className="text-muted-foreground">CET médio BACEN:</span> {b?.cet_medio_bacen_periodo || "-"}</div>
            <div className="text-base font-semibold">Diferença: {b?.diferenca_percentual || "-"}</div>
            {b?.avaliacao && (
              <Badge className={bacenBadge[b.avaliacao]?.cls}>{bacenBadge[b.avaliacao]?.label}</Badge>
            )}
            {b?.observacao && <p className="text-xs text-muted-foreground">{b.observacao}</p>}
            <p className="text-[10px] text-muted-foreground pt-1">
              Referencial: SGS/BACEN — taxas médias de operações de crédito. Valor indicativo, não substitui cálculo pericial.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Semáforo de risco</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {[
              ["clausulas_abusivas", "Cláusulas abusivas"],
              ["garantias", "Garantias"],
              ["encargos", "Encargos"],
              ["cet_vs_mercado", "CET vs mercado"],
            ].map(([k, label]) => {
              const v = (sem as any)[k] as Sem | undefined;
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${v ? semColor[v] : "bg-muted"}`} />
                  <span>{label}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recomendação</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {cls && <Badge className={cls.cls}>{cls.label}</Badge>}
            <p>{r.recomendacao_curta || "-"}</p>
          </CardContent>
        </Card>
        {r.desclassificacao_rural?.cabivel && (
          <Card className="md:col-span-2 border-emerald-600/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald-600" />
                Desclassificação para crédito rural — cabível
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {r.desclassificacao_rural.fundamento_resumo && (
                <p><span className="text-muted-foreground">Fundamento:</span> {r.desclassificacao_rural.fundamento_resumo}</p>
              )}
              {r.desclassificacao_rural.efeito_pratico && (
                <p><span className="text-muted-foreground">Efeito prático:</span> {r.desclassificacao_rural.efeito_pratico}</p>
              )}
              <p className="text-[10px] text-muted-foreground">Lei 4.829/65 — a natureza rural decorre da destinação dos recursos, não do nome do contrato.</p>
            </CardContent>
          </Card>
        )}
        {cits.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" /> Citações e fundamentos</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {cits.map((c, i) => (
                <div key={i} className="rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase text-[10px]">{c.tipo || "ref"}</Badge>
                    <span className="font-medium">{c.referencia || "-"}</span>
                  </div>
                  {c.ementa_ou_descricao && <p className="mt-1 text-xs text-muted-foreground">{c.ementa_ou_descricao}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const temResultado = !!(resumo || parecer);

  return (
    <div className="container mx-auto py-6">
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileSearch className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Análise de Contratos Bancários</h1>
            <p className="text-sm text-muted-foreground">IA jurídica para contratos de crédito rural e bancário em geral</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Dados da análise</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome do cliente *</Label>
              <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex: João Maria / Fazenda Santa Cruz" maxLength={200} />
              <p className="mt-1 text-xs text-muted-foreground">
                O tipo do contrato (CCB, CPR, cédula rural, capital de giro, cartão, etc.) é identificado automaticamente pela IA. Inclusive contratos urbanos contratados por produtor rural — quando aplicável, a análise sugere a desclassificação para enquadramento como crédito rural (Lei 4.829/65 e MCR).
              </p>
            </div>

            <div>
              <Label>Upload dos contratos * <span className="text-xs text-muted-foreground">(até 5 — análise comparativa automática quando &gt; 1)</span></Label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Arraste e solte ou clique para enviar</p>
                <p className="text-xs text-muted-foreground">PDF, DOC ou DOCX — até 20MB cada</p>
                <input ref={inputRef} type="file" hidden multiple accept=".pdf,.doc,.docx" onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }} />
              </div>
              {files.length > 0 && (
                <div className="mt-2 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{i + 1}. {f.name}</p>
                          <p className="text-xs text-muted-foreground">{fmtSize(f.size)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removerArquivo(i); }}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Data presumida da assinatura (opcional)</Label>
              <Input
                type="date"
                value={dataPresumida}
                onChange={(e) => setDataPresumida(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Informe quando o contrato for escaneado e a IA puder ter dificuldade de ler a data — melhora a precisão do comparativo BACEN.
              </p>
            </div>

            <div>
              <Label>Contexto adicional (opcional)</Label>
              <Textarea
                value={contexto}
                onChange={(e) => setContexto(e.target.value.slice(0, 800))}
                placeholder="Informe contexto relevante: valor financiado, data de assinatura, banco credor, garantias oferecidas, ou qualquer ponto específico que deseja investigar..."
                rows={4}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{contexto.length}/800</p>
            </div>

            <Button onClick={analisar} disabled={!canAnalyze} className="w-full" size="lg">
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando contrato...</>) : "Analisar contrato"}
            </Button>
            {loading && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground text-center">{progressMsg}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {temResultado && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Parecer gerado</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar análise
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportarPDF(resumo, parecer, cliente, resumo?.identificacao?.tipo_contrato || "")}>
                  <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
                </Button>
                <Button size="sm" onClick={() => gerarPeticao(resumo, parecer, cliente, resumo?.identificacao?.tipo_contrato || "")}>
                  <Gavel className="mr-2 h-4 w-4" /> Gerar petição
                </Button>
                <Button size="sm" variant="ghost" onClick={novaAnalise}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Nova análise
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="resumo">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="resumo">Resumo executivo</TabsTrigger>
                  <TabsTrigger value="completo">Parecer completo</TabsTrigger>
                </TabsList>
                <TabsContent value="resumo" className="mt-4">{renderResumo(resumo)}</TabsContent>
                <TabsContent value="completo" className="mt-4">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{parecer || "—"}</div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {temResultado && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle>Chat com a IA sobre este contrato</CardTitle>
              </div>
              {chat.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setChat([])}>
                  <Trash2 className="mr-2 h-4 w-4" /> Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                A IA mantém o parecer, o resumo e o comparativo BACEN como contexto. Faça perguntas, peça trechos prontos para petição, peça estimativas ou aprofundamento de teses.
              </p>

              {chat.length === 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {sugestoesChat.map((s, i) => (
                    <Button key={i} size="sm" variant="outline" className="text-xs h-auto py-1.5 whitespace-normal text-left" onClick={() => enviarChat(s)} disabled={chatLoading}>
                      <Sparkles className="mr-1.5 h-3 w-3 shrink-0" /> {s}
                    </Button>
                  ))}
                </div>
              )}

              <div ref={chatScrollRef} className="max-h-[420px] overflow-y-auto rounded-lg border bg-muted/30 p-3 space-y-3">
                {chat.length === 0 && !chatLoading && (
                  <p className="text-center text-xs text-muted-foreground py-6">Nenhuma mensagem ainda. Use uma sugestão acima ou escreva sua pergunta.</p>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-headings:mt-2 prose-headings:mb-1">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border bg-background px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Analisando...
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarChat();
                    }
                  }}
                  placeholder="Ex.: Estime o valor a recalcular considerando capitalização mensal indevida..."
                  rows={2}
                  className="resize-none"
                  disabled={chatLoading}
                />
                <Button onClick={() => enviarChat()} disabled={chatLoading || !chatInput.trim()} className="self-end">
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Enter envia • Shift+Enter quebra linha • As últimas 20 mensagens são enviadas como contexto.</p>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Análises anteriores</CardTitle>
            <div className="w-full max-w-xs">
              <Input
                placeholder="Filtrar por cliente..."
                value={filtroHist}
                onChange={(e) => setFiltroHist(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const q = filtroHist.trim().toLowerCase();
              const lista = q ? historico.filter((h) => (h.cliente_nome || "").toLowerCase().includes(q)) : historico;
              if (historico.length === 0) {
                return <p className="text-sm text-muted-foreground">Nenhuma análise salva ainda.</p>;
              }
              if (lista.length === 0) {
                return <p className="text-sm text-muted-foreground">Nenhum resultado para "{filtroHist}".</p>;
              }
              return (
                <div className="divide-y">
                  {lista.map((h) => {
                    const cls = h.classificacao && classBadge[h.classificacao];
                    return (
                      <div key={h.id} className="flex items-center justify-between py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{h.cliente_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")} • {h.tipo_contrato}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {cls && <Badge className={cls.cls}>{cls.label}</Badge>}
                          <Button size="sm" variant="ghost" onClick={() => setViewing(h)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.cliente_nome} — {viewing?.tipo_contrato}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              {renderResumo({ ...(viewing.resumo_executivo || {}), comparativo_bacen: viewing.comparativo_bacen || viewing.resumo_executivo?.comparativo_bacen } as Resumo)}
              <div>
                <h3 className="mb-2 font-semibold">Parecer completo</h3>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{viewing.parecer_completo || "—"}</div>
              </div>
              <Button variant="outline" onClick={() => exportarPDF(viewing.resumo_executivo as Resumo, viewing.parecer_completo || "", viewing.cliente_nome, viewing.tipo_contrato)}>
                <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}