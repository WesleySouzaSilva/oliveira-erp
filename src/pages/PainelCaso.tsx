import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Leaf,
  Gavel,
  FileText,
  Bot,
  LayoutTemplate,
  Send,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Save,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Papel = "agronomo" | "juridico";

// ============ Templates ============
const TEMPLATE_NOTIFICACAO = `NOTIFICAÇÃO EXTRAJUDICIAL

Ao
{{BANCO}}
{{ENDERECO_BANCO}}

Ref.: Contrato nº {{NUMERO_CONTRATO}}

Prezados Senhores,

O(A) Sr(a). {{PRODUTOR}}, CPF {{CPF}}, produtor(a) rural com propriedade localizada em {{MUNICIPIO}}/{{UF}}, vem por meio desta, com fundamento no Manual de Crédito Rural (MCR), Seção 2.6.4, e na Lei nº 4.829/65, NOTIFICAR essa instituição financeira para que proceda à PRORROGAÇÃO da(s) parcela(s) vincenda(s)/vencida(s) do contrato de crédito rural nº {{NUMERO_CONTRATO}}, considerando:

1. Que o mutuário sofreu frustração de safra da cultura de {{CULTURA}}, safra {{SAFRA}}, conforme comprova o LAUDO TÉCNICO AGRONÔMICO nº {{NUMERO_LAUDO}}, elaborado pelo Eng. Agrônomo {{AGRONOMO}}, CREA {{CREA}};

2. Que a perda de produtividade foi de {{PERDA_PERCENTUAL}}%, causada por {{EVENTO_CLIMATICO}}, conforme dados meteorológicos do INMET;

3. Que o MCR 2.6.4 prevê expressamente a possibilidade de prorrogação nas hipóteses de:
{{HIPOTESES_MCR}}

4. Que a Súmula 298 do STJ determina que "O alongamento de dívida originária do crédito rural é direito do devedor (...)";

REQUER, portanto, no prazo de 15 (quinze) dias úteis:

a) A PRORROGAÇÃO do vencimento da(s) parcela(s) pelo prazo de {{PRAZO_SOLICITADO}} meses;
b) A manutenção das condições originais de taxa de juros;
c) A suspensão de quaisquer medidas restritivas (SERASA, SPC, protesto) durante a análise.

Fica ciente essa instituição que o silêncio ou a negativa sem fundamentação técnica ensejará as medidas judiciais cabíveis.

{{CIDADE}}/{{UF_CIDADE}}, {{DATA}}

_______________________________
{{PRODUTOR}}
CPF: {{CPF}}

_______________________________
{{ADVOGADO}}
OAB: {{OAB}}
`;

const TEMPLATE_PETICAO = `EXCELENTÍSSIMO(A) SENHOR(A) JUIZ(A) DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE {{COMARCA}}/{{UF}}

{{PRODUTOR}}, {{QUALIFICACAO}}, vem, respeitosamente, à presença de Vossa Excelência, por seu advogado que esta subscreve, propor a presente

AÇÃO DE OBRIGAÇÃO DE FAZER C/C PEDIDO DE TUTELA DE URGÊNCIA

em face de {{BANCO}}, CNPJ {{CNPJ_BANCO}}, pelos fatos e fundamentos a seguir expostos:

I — DOS FATOS

1. O Autor é produtor rural e firmou com o Réu o contrato de crédito rural nº {{NUMERO_CONTRATO}}, no valor de R$ {{VALOR_CONTRATO}}, destinado ao {{ENQUADRAMENTO}} da cultura de {{CULTURA}}, safra {{SAFRA}}.

2. Ocorre que o Autor sofreu frustração de safra, conforme demonstrado pelo LAUDO TÉCNICO AGRONÔMICO nº {{NUMERO_LAUDO}} (doc. anexo), que atesta perda de {{PERDA_PERCENTUAL}}% na produtividade esperada, decorrente de {{EVENTO_CLIMATICO}}.

3. O Autor notificou extrajudicialmente o Réu em {{DATA_NOTIFICACAO}}, requerendo a prorrogação nos termos do MCR 2.6.4, tendo o banco {{RESPOSTA_BANCO}}.

II — DO DIREITO

4. O Manual de Crédito Rural (MCR), Seção 2.6.4, estabelece que as instituições financeiras DEVEM prorrogar as dívidas oriundas de crédito rural quando comprovada a frustração de safra por eventos adversos.

5. A Súmula 298 do STJ consolidou: "O alongamento de dívida originária do crédito rural é direito do devedor e não faculdade da instituição financeira."

6. O art. 4º, § 1º, da Lei nº 4.829/65, determina que as operações de crédito rural devem observar o princípio da proteção ao produtor rural.

III — DA TUTELA DE URGÊNCIA

7. A probabilidade do direito resta demonstrada pelo laudo técnico, pela notificação extrajudicial e pela fundamentação legal supra.

8. O perigo de dano é evidenciado pela iminência de:
   a) Inscrição do nome do Autor em cadastros restritivos;
   b) Execução do contrato com penhora de bens rurais;
   c) Impossibilidade de obter novo crédito para a safra seguinte.

IV — DOS PEDIDOS

Ante o exposto, requer:

a) A concessão de TUTELA DE URGÊNCIA para determinar ao Réu que se abstenha de negativar o nome do Autor e suspenda quaisquer medidas executórias;
b) A CITAÇÃO do Réu para contestar;
c) No mérito, a PROCEDÊNCIA da ação para determinar ao Réu a prorrogação do contrato nº {{NUMERO_CONTRATO}} pelo prazo de {{PRAZO_SOLICITADO}} meses, mantidas as condições originais;
d) A condenação do Réu em custas e honorários advocatícios.

Dá-se à causa o valor de R$ {{VALOR_CAUSA}}.

Termos em que,
Pede deferimento.

{{CIDADE}}/{{UF_CIDADE}}, {{DATA}}

_______________________________
{{ADVOGADO}}
OAB/{{OAB_UF}} nº {{OAB_NUMERO}}
`;

export default function PainelCaso() {
  const { id } = useParams<{ id: string }>();
  const _navigate = useNavigate();
  const { user } = useAuth();
  const [papel, setPapel] = useState<Papel>("agronomo");
  const [processo, setProcesso] = useState<any>(null);
  const [laudo, setLaudo] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Document generation state
  const [docType, setDocType] = useState<"notificacao" | "peticao">("notificacao");
  const [genMode, setGenMode] = useState<"ia" | "template">("template");
  const [docContent, setDocContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      const [procRes, profileRes] = await Promise.all([
        supabase.from("processos").select("*, laudos(*)").eq("id", id).single(),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);
      if (procRes.data) {
        setProcesso(procRes.data);
        setLaudo(procRes.data.laudos);
      }
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    };
    load();
  }, [user, id]);

  const laudoData = useMemo(() => {
    if (!laudo) return {};
    const d1 = (laudo.dados_etapa1 || {}) as Record<string, any>;
    const d4 = (laudo.dados_etapa4 || {}) as Record<string, any>;
    return { ...d1, ...d4 };
  }, [laudo]);

  const fillTemplate = (template: string) => {
    const replacements: Record<string, string> = {
      "{{BANCO}}": laudoData.banco || "___",
      "{{ENDERECO_BANCO}}": "___",
      "{{NUMERO_CONTRATO}}": laudoData.numero_contrato || "___",
      "{{PRODUTOR}}": laudoData.nome || "___",
      "{{CPF}}": laudoData.cpf || "___",
      "{{MUNICIPIO}}": laudoData.municipio || "___",
      "{{UF}}": laudoData.uf || "___",
      "{{CULTURA}}": laudoData.cultura || "___",
      "{{SAFRA}}": laudoData.safra || "___",
      "{{NUMERO_LAUDO}}": laudo?.numero_laudo || "___",
      "{{AGRONOMO}}": profile?.nome || "___",
      "{{CREA}}": profile ? `${profile.crea_uf}-${profile.crea_numero}` : "___",
      "{{PERDA_PERCENTUAL}}": laudoData.perda_percentual || "___",
      "{{EVENTO_CLIMATICO}}": laudoData.evento_climatico || "seca prolongada",
      "{{HIPOTESES_MCR}}": (laudo?.hipoteses_selecionadas || []).map((h: string) => `   - Hipótese ${h}`).join("\n") || "___",
      "{{PRAZO_SOLICITADO}}": "36",
      "{{CIDADE}}": profile?.cidade || "___",
      "{{UF_CIDADE}}": profile?.uf || "___",
      "{{DATA}}": new Date().toLocaleDateString("pt-BR"),
      "{{ADVOGADO}}": "___",
      "{{OAB}}": "___",
      "{{OAB_UF}}": "___",
      "{{OAB_NUMERO}}": "___",
      "{{COMARCA}}": laudoData.municipio || "___",
      "{{QUALIFICACAO}}": "brasileiro(a), produtor(a) rural",
      "{{CNPJ_BANCO}}": "___",
      "{{VALOR_CONTRATO}}": laudoData.valor_operacao || "___",
      "{{ENQUADRAMENTO}}": laudoData.enquadramento || "custeio",
      "{{DATA_NOTIFICACAO}}": "___",
      "{{RESPOSTA_BANCO}}": "permanecido em silêncio / negado o pedido sem fundamentação técnica adequada",
      "{{VALOR_CAUSA}}": laudoData.valor_operacao || "___",
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.split(key).join(value);
    }
    return result;
  };

  const handleUseTemplate = () => {
    const template = docType === "notificacao" ? TEMPLATE_NOTIFICACAO : TEMPLATE_PETICAO;
    setDocContent(fillTemplate(template));
    toast.success("Template carregado! Edite os campos em branco (___) conforme necessário.");
  };

  const handleGenerateIA = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-documento-juridico", {
        body: {
          tipo: docType,
          laudo_dados: laudoData,
          numero_laudo: laudo?.numero_laudo,
          hipoteses: laudo?.hipoteses_selecionadas,
          perfil: {
            nome: profile?.nome,
            crea: profile ? `${profile.crea_uf}-${profile.crea_numero}` : null,
            cidade: profile?.cidade,
            uf: profile?.uf,
          },
        },
      });

      if (error) throw error;
      setDocContent(data?.documento || "Erro ao gerar documento.");
      toast.success(`${docType === "notificacao" ? "Notificação" : "Petição"} gerada com IA!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar documento");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!processo || !docContent) return;
    setSaving(true);
    try {
      const field = docType === "notificacao" ? "dados_fase2" : "dados_fase4";
      const current = processo[field] || {};
      await supabase
        .from("processos")
        .update({
          [field]: { ...current, [`documento_${docType}`]: docContent, [`${docType}_gerado_em`]: new Date().toISOString() },
        })
        .eq("id", processo.id);
      toast.success("Documento salvo!");
    } catch {
      toast.error("Erro ao salvar.");
    }
    setSaving(false);
  };

  const handleExportHTML = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;max-width:210mm;margin:40px auto;padding:40px 55px;line-height:1.8;font-size:12pt;color:#1a1a1a;white-space:pre-wrap;}h1{font-size:16pt;text-align:center;margin-bottom:24px;}@media print{body{padding:20px 30px;}}</style></head><body>${docContent.replace(/\n/g, "<br>")}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docType === "notificacao" ? "Notificacao_Extrajudicial" : "Peticao_Inicial"}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!processo) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Caso não encontrado.</p>
          <Link to="/processos" className="text-accent text-sm hover:underline mt-2 inline-block">
            ← Voltar aos processos
          </Link>
        </div>
      </AppLayout>
    );
  }

  const d1 = laudoData;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/processos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              {(d1.nome || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                {d1.nome || "Caso sem nome"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {d1.banco || "—"} · {d1.numero_contrato || "—"} · {d1.municipio || "—"}/{d1.uf || "—"}
              </p>
            </div>
          </div>

          {/* Role switcher */}
          <div className="flex bg-secondary/50 rounded-lg p-1">
            <button
              onClick={() => setPapel("agronomo")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                papel === "agronomo"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Leaf className="w-4 h-4" /> Agrônomo
            </button>
            <button
              onClick={() => setPapel("juridico")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                papel === "juridico"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Gavel className="w-4 h-4" /> Jurídico
            </button>
          </div>
        </div>
      </div>

      {/* Content based on role */}
      <AnimatePresence mode="wait">
        {papel === "agronomo" ? (
          <motion.div
            key="agro"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <AgronomoView laudo={laudo} laudoData={laudoData} processo={processo} />
          </motion.div>
        ) : (
          <motion.div
            key="juridico"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <JuridicoView
              processo={processo}
              laudoData={laudoData}
              laudo={laudo}
              profile={profile}
              docType={docType}
              setDocType={setDocType}
              genMode={genMode}
              setGenMode={setGenMode}
              docContent={docContent}
              setDocContent={setDocContent}
              generating={generating}
              saving={saving}
              onTemplate={handleUseTemplate}
              onGenerateIA={handleGenerateIA}
              onSave={handleSaveDoc}
              onExport={handleExportHTML}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// ============== AGRÔNOMO VIEW ==============
function AgronomoView({ laudo, laudoData }: { laudo: any; laudoData: any; processo?: any }) {
  const d = laudoData;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Leaf className="w-5 h-5 text-success" />
        <h2 className="text-lg font-display font-bold text-foreground">
          Área do Agrônomo — Laudo Técnico
        </h2>
        {laudo?.status === "finalizado" || laudo?.status === "exportado" ? (
          <span className="status-badge bg-success/15 text-success text-xs">Finalizado</span>
        ) : (
          <span className="status-badge bg-accent/15 text-accent text-xs">{laudo?.status || "Rascunho"}</span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Produtor">
          <InfoRow label="Nome" value={d.nome} />
          <InfoRow label="CPF" value={d.cpf} />
          <InfoRow label="Propriedade" value={d.propriedade} />
        </Card>
        <Card title="Cultura & Safra">
          <InfoRow label="Cultura" value={d.cultura} />
          <InfoRow label="Safra" value={d.safra} />
          <InfoRow label="Área" value={d.area ? `${d.area} ha` : undefined} />
        </Card>
        <Card title="Contrato">
          <InfoRow label="Banco" value={d.banco} />
          <InfoRow label="Contrato" value={d.numero_contrato} />
          <InfoRow label="Valor" value={d.valor_operacao} />
        </Card>
      </div>

      {laudo?.hipoteses_selecionadas?.length > 0 && (
        <Card title="Hipóteses MCR 2.6.4">
          <div className="flex flex-wrap gap-2">
            {laudo.hipoteses_selecionadas.map((h: string) => (
              <span key={h} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
                MCR 2.6.4-{h}
              </span>
            ))}
          </div>
        </Card>
      )}

      {laudo?.texto_conclusao && (
        <Card title="Conclusão do Laudo">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {laudo.texto_conclusao}
          </p>
        </Card>
      )}

      <div className="flex gap-3">
        <Link
          to={`/novo-laudo?id=${laudo?.id}`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <FileText className="w-4 h-4" /> Editar laudo
        </Link>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <Download className="w-4 h-4" /> Baixar PDF
        </button>
      </div>
    </div>
  );
}

// ============== JURÍDICO VIEW ==============
interface JuridicoViewProps {
  processo: any;
  laudoData: any;
  laudo: any;
  profile: any;
  docType: "notificacao" | "peticao";
  setDocType: (t: "notificacao" | "peticao") => void;
  genMode: "ia" | "template";
  setGenMode: (m: "ia" | "template") => void;
  docContent: string;
  setDocContent: (c: string) => void;
  generating: boolean;
  saving: boolean;
  onTemplate: () => void;
  onGenerateIA: () => void;
  onSave: () => void;
  onExport: () => void;
}

function JuridicoView({
  processo, laudoData, laudo, profile,
  docType, setDocType, genMode, setGenMode,
  docContent, setDocContent,
  generating, saving,
  onTemplate, onGenerateIA, onSave, onExport,
}: JuridicoViewProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Gavel className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-display font-bold text-foreground">
          Área Jurídica — Documentos
        </h2>
      </div>

      {/* Resumo do caso para o jurídico */}
      <div className="grid sm:grid-cols-4 gap-3">
        <MiniCard label="Produtor" value={laudoData.nome || "—"} />
        <MiniCard label="Banco" value={laudoData.banco || "—"} />
        <MiniCard label="Contrato" value={laudoData.numero_contrato || "—"} />
        <MiniCard label="Laudo" value={laudo?.numero_laudo || "—"} icon={laudo?.status === "finalizado" ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Clock className="w-3 h-3 text-warning" />} />
      </div>

      {/* Tipo de documento */}
      <Tabs value={docType} onValueChange={(v) => setDocType(v as any)}>
        <TabsList>
          <TabsTrigger value="notificacao" className="gap-1.5">
            <Send className="w-4 h-4" /> Notificação Administrativa
          </TabsTrigger>
          <TabsTrigger value="peticao" className="gap-1.5">
            <Gavel className="w-4 h-4" /> Petição Inicial
          </TabsTrigger>
        </TabsList>

        <TabsContent value={docType}>
          <div className="space-y-4 mt-4">
            {/* Modo de geração */}
            <div className="flex gap-3">
              <button
                onClick={() => { setGenMode("ia"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border-2 transition-all ${
                  genMode === "ia"
                    ? "border-accent bg-accent/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/30"
                }`}
              >
                <Bot className="w-5 h-5" /> Gerar com IA
              </button>
              <button
                onClick={() => { setGenMode("template"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border-2 transition-all ${
                  genMode === "template"
                    ? "border-accent bg-accent/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/30"
                }`}
              >
                <LayoutTemplate className="w-5 h-5" /> Usar template
              </button>
            </div>

            {/* Ação */}
            <div className="flex gap-3">
              {genMode === "ia" ? (
                <button
                  onClick={onGenerateIA}
                  disabled={generating}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  {generating
                    ? "Gerando..."
                    : `Gerar ${docType === "notificacao" ? "Notificação" : "Petição"} com IA`}
                </button>
              ) : (
                <button
                  onClick={onTemplate}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  Carregar Template de {docType === "notificacao" ? "Notificação" : "Petição"}
                </button>
              )}
            </div>

            {/* Editor */}
            <div className="bg-card rounded-lg border border-border shadow-card">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  {docType === "notificacao" ? "Notificação Extrajudicial" : "Petição Inicial"}
                </h3>
                <div className="flex gap-1.5">
                  <button
                    onClick={onSave}
                    disabled={saving || !docContent}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar
                  </button>
                  <button
                    onClick={onExport}
                    disabled={!docContent}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar
                  </button>
                </div>
              </div>
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder={`Clique em "Gerar com IA" ou "Carregar Template" para começar a redigir a ${docType === "notificacao" ? "notificação" : "petição"}...`}
                className="w-full min-h-[500px] p-5 text-sm text-foreground bg-transparent font-mono leading-relaxed resize-y focus:outline-none placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
              <span>
                {docType === "notificacao"
                  ? "A notificação extrajudicial é o primeiro passo formal. Deve ser enviada por meio com comprovante (Cartório de T.D., Correios com AR ou protocolo direto). O banco tem 15 dias úteis para responder."
                  : "A petição inicial deve ser ajuizada apenas após a negativa do banco ou silêncio após o prazo da notificação. Inclua o pedido de tutela de urgência para suspender negativações e cobranças."}
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== Helpers ==============
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 shadow-card">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right truncate ml-2">{value || "—"}</span>
    </div>
  );
}

function MiniCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 shadow-card">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
        {icon} {value}
      </p>
    </div>
  );
}
