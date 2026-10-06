import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Save, ClipboardList, MessageSquare, UserCheck, NotebookPen, PanelRightClose, PanelRightOpen, Users } from "lucide-react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { EtapaIdentificacao } from "@/components/laudo/EtapaIdentificacao";
import { EtapaDocumentos } from "@/components/laudo/EtapaDocumentos";
import { EtapaEnquadramento } from "@/components/laudo/EtapaEnquadramento";
import { EtapaSafra } from "@/components/laudo/EtapaSafra";
import { EtapaCapacidade } from "@/components/laudo/EtapaCapacidade";
import { EtapaProjecao } from "@/components/laudo/EtapaProjecao";
import { EtapaFinalizacao } from "@/components/laudo/EtapaFinalizacao";
import { DadosExternosLaudo } from "@/components/laudo/DadosExternosLaudo";
import { ChecklistProdutor } from "@/components/laudo/ChecklistProdutor";
import { LaudoChatPanel } from "@/components/laudo/LaudoChatPanel";
import { SelecionarClienteLaudo } from "@/components/laudo/SelecionarClienteLaudo";
import { EntrevistaProdutor } from "@/components/laudo/EntrevistaProdutor";
import { supabase } from "@/integrations/supabase/client";
import { upsertClienteFromLaudo } from "@/lib/upsertCliente";
import { CLIENTE_SELECT, mapClienteParaEtapa1, type ClienteLaudo } from "@/lib/mapClienteParaEtapa1";
import { toast } from "sonner";

const ALL_STEPS = [
  { key: "identificacao", label: "Identificação", tipos: ["perda", "capacidade", "ambos"] },
  { key: "documentos", label: "Documentos & IA", tipos: ["perda", "capacidade", "ambos"] },
  { key: "enquadramento", label: "Enquadramento MCR", tipos: ["perda", "ambos"] },
  { key: "safra", label: "Dados da Safra", tipos: ["perda", "ambos"] },
  { key: "capacidade", label: "Capacidade Pgto.", tipos: ["capacidade", "ambos"] },
  { key: "projecao", label: "Projeção Financ.", tipos: ["capacidade", "ambos"] },
  { key: "finalizacao", label: "Finalização", tipos: ["perda", "capacidade", "ambos"] },
] as const;

export default function NovoLaudo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [laudoId, setLaudoId] = useState<string | null>(searchParams.get("id"));
  const [saving, setSaving] = useState(false);

  // State per step
  const [etapa1, setEtapa1] = useState<Record<string, any>>({});
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [hipoteses, setHipoteses] = useState<string[]>([]);
  const [etapa3Data, setEtapa3Data] = useState<Record<string, any>>({});
  const [etapa4Data, setEtapa4Data] = useState<Record<string, any>>({});
  const [etapa5Data, setEtapa5Data] = useState<Record<string, any>>({});
  const [etapa6Data, setEtapa6Data] = useState<Record<string, any>>({});
  const [textoNarrativa, setTextoNarrativa] = useState("");
  const [textoConclusao, setTextoConclusao] = useState("");
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({});

  // Passo 0 — cliente obrigatório antes de qualquer coisa
  const temCliente = !!(etapa1.nome || etapa1.nomeProdutor);
  const precisaEscolherCliente = !laudoId && !temCliente && !searchParams.get("cliente_id") && !searchParams.get("cliente");

  // Filter steps based on tipo_laudo
  const tipoLaudo = (etapa1.tipo_laudo as string) || "ambos";
  const visibleSteps = ALL_STEPS.filter((s) => s.tipos.includes(tipoLaudo as any));
  const steps = visibleSteps.map((s) => s.label);
  const activeKey = visibleSteps[currentStep]?.key ?? "identificacao";

  // Clamp currentStep if tipo changes and current index becomes invalid
  useEffect(() => {
    if (currentStep >= visibleSteps.length) setCurrentStep(visibleSteps.length - 1);
  }, [visibleSteps.length, currentStep]);

  // Cria o laudo apenas depois que um cliente é escolhido (evita rascunhos vazios)
  const criarLaudoParaCliente = useCallback(async (dadosCliente: Record<string, any>) => {
    setEtapa1((prev) => ({ ...prev, ...dadosCliente }));
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const numero = `LAU-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from("laudos")
      .insert({ user_id: user.user.id, numero_laudo: numero, dados_etapa1: dadosCliente as any })
      .select("id")
      .single();
    if (!error && data) {
      setLaudoId(data.id);
      window.history.replaceState(null, "", `/novo-laudo?id=${data.id}`);
    }
  }, []);

  // Pre-fill client data from URL params (cliente_id has priority over cliente name)
  useEffect(() => {
    if (laudoId || Object.keys(etapa1).length > 0) return;
    const clienteId = searchParams.get("cliente_id");
    const clienteParam = searchParams.get("cliente");
    const atendimentoId = searchParams.get("atendimento_id");
    const processoId = searchParams.get("processo_id");

    if (clienteId) {
      (async () => {
        const { data } = await supabase
          .from("clientes")
          .select(CLIENTE_SELECT)
          .eq("id", clienteId)
          .maybeSingle();
        if (data) {
          setEtapa1((prev) => ({
            ...prev,
            ...mapClienteParaEtapa1(data as any as ClienteLaudo, {
              _atendimentoOrigemId: atendimentoId || undefined,
              _processoOrigemId: processoId || undefined,
            }),
          }));
          return;
        }
        if (clienteParam) {
          setEtapa1((prev) => ({
            ...prev,
            nome: clienteParam,
            _clientSource: "existente",
            _processoOrigemId: processoId || undefined,
          }));
        }
      })();
    } else if (clienteParam) {
      setEtapa1((prev) => ({
        ...prev,
        nome: clienteParam,
        _clientSource: "existente",
        _atendimentoOrigemId: atendimentoId || undefined,
        _processoOrigemId: processoId || undefined,
      }));
    }
  }, [searchParams, laudoId]);

  // Load existing laudo
  useEffect(() => {
    if (!laudoId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("laudos")
        .select("*")
        .eq("id", laudoId)
        .single();
      if (error || !data) return;
      const d1 = (data.dados_etapa1 || {}) as Record<string, any>;
      const d3 = (data.dados_etapa3 || {}) as Record<string, any>;
      const d4 = (data.dados_etapa4 || {}) as Record<string, any>;
      const d5 = (data.dados_etapa5 || {}) as Record<string, any>;
      setEtapa1(d1);
      setEtapa3Data(d3);
      setEtapa4Data(d4);
      setEtapa5Data(d5);
      const d6 = (data.dados_etapa6 || {}) as Record<string, any>;
      setEtapa6Data(d6);
      setHipoteses(data.hipoteses_selecionadas || []);
      setTextoNarrativa(data.texto_analise_narrativa || "");
      setTextoConclusao(data.texto_conclusao || "");

      const { data: docs } = await supabase
        .from("documentos")
        .select("*")
        .eq("laudo_id", laudoId);
      if (docs) setDocumentos(docs);
    };
    load();
  }, [laudoId]);

  const saveToSupabase = useCallback(async () => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Não autenticado");

      const payload = {
        user_id: user.user.id,
        dados_etapa1: etapa1 as any,
        dados_etapa3: etapa3Data as any,
        dados_etapa4: etapa4Data as any,
        dados_etapa5: etapa5Data as any,
        dados_etapa6: etapa6Data as any,
        hipoteses_selecionadas: hipoteses,
        texto_analise_narrativa: textoNarrativa || null,
        texto_conclusao: textoConclusao || null,
      };

      if (laudoId) {
        const { error } = await supabase
          .from("laudos")
          .update(payload)
          .eq("id", laudoId);
        if (error) throw error;
      } else {
        const numero = `LAU-${Date.now().toString(36).toUpperCase()}`;
        const { data, error } = await supabase
          .from("laudos")
          .insert({ ...payload, numero_laudo: numero })
          .select("id")
          .single();
        if (error) throw error;
        setLaudoId(data.id);
        window.history.replaceState(null, "", `/novo-laudo?id=${data.id}`);
      }

      // Auto-create/update client record from laudo data
      await upsertClienteFromLaudo(user.user.id, etapa1);

      toast.success("Rascunho salvo");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [laudoId, etapa1, etapa3Data, etapa4Data, etapa5Data, etapa6Data, hipoteses, textoNarrativa, textoConclusao]);

  const goNext = async () => {
    await saveToSupabase();
    setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
  };

  const goPrev = () => setCurrentStep(Math.max(0, currentStep - 1));

  const voltar = () => {
    const idx = (window.history.state as any)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate("/laudos");
  };

  return (
    <AppLayout>
      {precisaEscolherCliente ? (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={voltar}
            className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <SelecionarClienteLaudo
            onSelect={(c) => criarLaudoParaCliente(mapClienteParaEtapa1(c))}
          />
        </div>
      ) : (
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="min-w-0">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={voltar}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all shrink-0"
            title="Voltar para a página anterior"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">
            {etapa1.nome || etapa1.nomeProdutor || "Novo laudo"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(etapa1.nome || etapa1.nomeProdutor) && (
            <>
              <Link
                to={`/clientes/${encodeURIComponent(etapa1.nome || etapa1.nomeProdutor)}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
                title="Abrir ficha do cliente"
              >
                <UserCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Ficha do cliente</span>
              </Link>
              <Link
                to={`/comercial/atendimentos?cliente=${encodeURIComponent(etapa1.nome || etapa1.nomeProdutor)}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
                title="Atendimentos deste cliente"
              >
                <NotebookPen className="w-4 h-4" />
                <span className="hidden sm:inline">Atendimentos</span>
              </Link>
            </>
          )}
          <button
            onClick={() => setChecklistOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
            title="Checklist do Produtor"
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Checklist</span>
          </button>
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
            title={chatOpen ? "Ocultar chat com IA" : "Mostrar chat com IA"}
          >
            {chatOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            <span className="hidden sm:inline">Chat IA</span>
          </button>
        </div>
      </div>

        <>
          <ChecklistProdutor
            open={checklistOpen}
            onClose={() => setChecklistOpen(false)}
            checked={checklistChecked}
            onCheckedChange={setChecklistChecked}
            notes={checklistNotes}
            onNotesChange={setChecklistNotes}
          />

          {/* Progress bar — clickable steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              {steps.map((step, i) => (
                <button
                  key={step}
                  onClick={() => setCurrentStep(i)}
                  className="flex items-center gap-1.5 group cursor-pointer"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                      i === currentStep
                        ? "bg-accent text-accent-foreground"
                        : i < currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-secondary"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={`hidden sm:block text-xs font-medium transition-colors ${
                      i === currentStep
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {step}
                  </span>
                  {i < steps.length - 1 && (
                    <div
                      className={`hidden sm:block w-6 lg:w-12 h-0.5 mx-1 ${
                        i < currentStep ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-accent h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Step content */}
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            {activeKey === "identificacao" && (
              <>
                <EtapaIdentificacao data={etapa1} onChange={setEtapa1} />
                <div className="mt-8 pt-6 border-t border-border">
                  <EntrevistaProdutor
                    data={etapa1.entrevista || {}}
                    onChange={(next) => setEtapa1((prev) => ({ ...prev, entrevista: next }))}
                  />
                </div>
                <div className="mt-8 pt-6 border-t border-border">
                  <DadosExternosLaudo
                    municipio={etapa1.municipio}
                    uf={etapa1.uf}
                    cultura={etapa1.entrevista?.cultura || etapa1.culturas?.[0] || etapa1.cultura || etapa1.produto}
                    latitude={etapa1.latitude ? parseFloat(etapa1.latitude) : undefined}
                    longitude={etapa1.longitude ? parseFloat(etapa1.longitude) : undefined}
                  />
                </div>
              </>
            )}
            {activeKey === "documentos" && (
              <EtapaDocumentos
                laudoId={laudoId}
                documentos={documentos}
                onDocumentosChange={setDocumentos}
                municipio={etapa1.municipio}
                uf={etapa1.uf}
                cultura={etapa1.culturas?.[0] || etapa1.cultura || etapa1.produto}
                safra={etapa1.safra}
              />
            )}
            {activeKey === "enquadramento" && <EtapaEnquadramento selected={hipoteses} onChange={setHipoteses} data={etapa3Data} onDataChange={setEtapa3Data} />}
            {activeKey === "safra" && <EtapaSafra data={etapa4Data} onChange={setEtapa4Data} />}
            {activeKey === "capacidade" && <EtapaCapacidade data={etapa5Data} onChange={setEtapa5Data} />}
            {activeKey === "projecao" && <EtapaProjecao data={etapa6Data} onChange={setEtapa6Data} />}
            {activeKey === "finalizacao" && (
              <EtapaFinalizacao
                laudoId={laudoId}
                etapa1={etapa1}
                hipoteses={hipoteses}
                etapa3Data={etapa3Data}
                etapa4Data={etapa4Data}
                etapa5Data={etapa5Data}
                etapa6Data={etapa6Data}
                textoConlusao={textoConclusao}
                onConclusaoChange={setTextoConclusao}
                textoNarrativa={textoNarrativa}
                onNarrativaChange={setTextoNarrativa}
              />
            )}
          </motion.div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={goPrev}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Anterior
            </button>

            <button
              onClick={saveToSupabase}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
            >
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar rascunho"}
            </button>

            <button
              onClick={goNext}
              disabled={currentStep === steps.length - 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-40 transition-all"
            >
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      </div>

      {chatOpen && (
        <aside className="lg:sticky lg:top-6">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
            <MessageSquare className="w-4 h-4" /> Chat com IA
          </div>
          <LaudoChatPanel laudoId={laudoId} nomeCliente={etapa1.nome || etapa1.nomeProdutor} />
        </aside>
      )}
      </div>
      )}
    </AppLayout>
  );
}
