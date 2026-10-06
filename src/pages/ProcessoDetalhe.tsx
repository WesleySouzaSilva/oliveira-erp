import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, CheckCircle2, Circle, Plus, Trash2, FileText, LayoutDashboard, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProcessoTimeline } from "@/components/processo/ProcessoTimeline";
import { AIResumoProcessoButton } from "@/components/processo/AIResumoProcessoButton";
import { ProcessoPainel } from "@/components/processo/ProcessoPainel";
import { AdvboxVinculoCard } from "@/components/processo/AdvboxVinculoCard";
import { AdvboxAndamentosTimeline } from "@/components/processo/AdvboxAndamentosTimeline";
import { FaseContent } from "@/components/processo/FaseContent";
import { PrazoFaseDialog } from "@/components/processo/PrazoFaseDialog";
import { PerfilClienteDrawer } from "@/components/processo/PerfilClienteDrawer";
import { ClienteVinculoCard } from "@/components/processo/ClienteVinculoCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTrackRecentItem } from "@/hooks/useRecentItems";
import { useTarefas } from "@/hooks/useTarefas";
import { criarTarefaFase, criarTarefaJudicial } from "@/hooks/useWorkflowTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Processo, FaseProcesso, Alerta, Movimentacao } from "@/data/mockProcessos";

export default function ProcessoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [alertas, _setAlertas] = useState<Alerta[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [faseAtiva, setFaseAtiva] = useState<FaseProcesso>(1);
  const [rawProcessoId, setRawProcessoId] = useState<string>("");
  const [rawLaudoId, setRawLaudoId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [sugestaoNomeCliente, setSugestaoNomeCliente] = useState<string>("");
  useTrackRecentItem(
    processo
      ? {
          type: "processo",
          id: id || processo.id || "",
          title: processo.produtor || "Processo",
          subtitle: `Processo · ${processo.produtor || ""}`,
          path: `/processos/${id || processo.id || ""}`,
        }
      : null
  );
  const [responsaveisFases, setResponsaveisFases] = useState<Record<string, string>>({});
  const { members, orgId, isAdmin } = useOrgMembers();
  const { tarefas, toggleConcluida, createTarefa, deleteTarefa } = useTarefas({ processoId: id });
  const askConfirm = useConfirm();
  const confirmDelete = async (tid: string) => {
    if (await askConfirm({ title: "Excluir tarefa", description: "Esta ação não pode ser desfeita.", destructive: true, confirmText: "Excluir" })) {
      await deleteTarefa(tid);
    }
  };
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ titulo: "", responsavel_id: "", data_vencimento: "" });
  const [showPrazoDialog, setShowPrazoDialog] = useState(false);
  const [pendingFaseAdvance, setPendingFaseAdvance] = useState<FaseProcesso | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [andamentosReloadKey, setAndamentosReloadKey] = useState(0);

  const loadProcesso = async () => {
    if (!id || !user) return;
    setLoading(true);

    const { data: proc } = await supabase
      .from("processos")
      .select("*, laudos(dados_etapa1, dados_etapa3, hipoteses_selecionadas, texto_analise_narrativa, texto_conclusao)")
      .eq("id", id)
      .single();

    if (!proc) {
      setLoading(false);
      return;
    }

    setRawProcessoId(proc.id);
    setRawLaudoId(proc.laudo_id);
    setResponsaveisFases(((proc as any).responsaveis_fases || {}) as Record<string, string>);
    // Vínculo real cliente↔processo vem SEMPRE do banco (processos.cliente_id).
    // Nunca inferimos pelo nome — o casamento por nome/CPF passa a ser apenas sugestão visual.
    setClienteId((proc as any).cliente_id || "");

    const laudoData = (proc as any).laudos || {};
    const etapa1 = (laudoData.dados_etapa1 || {}) as Record<string, any>;
    const etapa3 = (laudoData.dados_etapa3 || {}) as Record<string, any>;
    const statusFases = (proc.status_fases || {}) as Record<string, string>;
    const datasFases = (proc.datas_fases || {}) as Record<string, { inicio?: string; fim?: string }>;
    const faseAtualNum = Number(proc.fase_atual) as FaseProcesso;
    setSugestaoNomeCliente(etapa1.produtor || etapa1.nome || "");

    // Pull score from etapa3 (enquadramento data)
    const score = etapa3.scoreTotal || etapa3.score || 0;
    const hipoteses = laudoData.hipoteses_selecionadas || [];

    // Get profile name for responsável
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, crea_numero, crea_uf")
      .eq("id", user.id)
      .single();

    const fase2Data = (proc.dados_fase2 || {}) as Record<string, any>;
    const fase3Raw = (proc.dados_fase3 || {}) as Record<string, any>;
    const fase3Nested =
      fase3Raw.dadosFase3 && typeof fase3Raw.dadosFase3 === "object" && !Array.isArray(fase3Raw.dadosFase3)
        ? (fase3Raw.dadosFase3 as Record<string, any>)
        : {};
    const { dadosFase3: _legacyDadosFase3, ...fase3Data } = { ...fase3Nested, ...fase3Raw };
    const fase4Data = (proc.dados_fase4 || {}) as Record<string, any>;
    const fase5Data = (proc.dados_fase5 || {}) as Record<string, any>;

    const mapped: Processo = {
      id: proc.id,
      laudoId: proc.laudo_id,
      produtor: etapa1.produtor || etapa1.nome || "Sem nome",
      banco: etapa1.banco || "",
      contrato: Array.isArray(etapa1.contratos)
        ? etapa1.contratos.join(", ")
        : (etapa1.contratos || etapa1.contrato || ""),
      saldoDevedor: etapa1.saldoDevedor
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(etapa1.saldoDevedor)
        : "—",
      cultura: etapa1.cultura || "",
      safra: etapa1.safra || "",
      municipio: etapa1.municipio || "",
      uf: etapa1.uf || "",
      faseAtual: faseAtualNum,
      statusFases: {
        1: (statusFases["1"] || "pendente") as any,
        2: (statusFases["2"] || "pendente") as any,
        3: (statusFases["3"] || "pendente") as any,
        4: (statusFases["4"] || "bloqueada") as any,
        5: (statusFases["5"] || "pendente") as any,
      },
      datasFases: {
        1: datasFases["1"] || {},
        2: datasFases["2"] || {},
        3: datasFases["3"] || {},
        4: datasFases["4"] || {},
        5: datasFases["5"] || {},
      },
      responsavelJuridico: "—",
      responsavelAgronomo: profile?.nome
        ? `${profile.nome}${profile.crea_numero ? ` (CREA ${profile.crea_uf}-${profile.crea_numero})` : ""}`
        : "—",
      scoreEnquadramento: score,
      hipotesesMcr: hipoteses,
      prazoSolicitado: etapa1.prazoSolicitado || 36,
      createdAt: proc.created_at,
      // Phase-specific data
      viaEnvio: fase2Data.viaEnvio,
      dataEnvioNotificacao: fase2Data.dataEnvioNotificacao,
      prazoRespostaBanco: fase2Data.prazoRespostaBanco,
      tipoRespostaBanco: fase3Data.tipoRespostaBanco,
      dataRespostaBanco: fase3Data.dataRespostaBanco,
      numeroProcessoCnj: fase4Data.numeroProcessoCnj,
      comarca: fase4Data.comarca,
      vara: fase4Data.vara,
      estado: fase4Data.estado,
      tribunal: fase4Data.tribunal,
      statusTutela: fase4Data.statusTutela,
      tipoEncerramento: fase5Data.tipoEncerramento,
      dataEncerramento: fase5Data.dataEncerramento,
      prazoConcedido: fase5Data.prazoConcedido,
      // Raw phase data so child components can read everything that was saved
      // (respostasPorContrato, envios, anexos, etc.) — sem isso, ao recarregar
      // a tela, as seleções da Fase 3 sumiam e a Fase 4 não conseguia listar
      // os contratos em discussão judicial.
      ...( { dadosFase2: fase2Data, dadosFase3: fase3Data, dadosFase4: fase4Data, dadosFase5: fase5Data } as any ),
    };

    setProcesso(mapped);
    setFaseAtiva(faseAtualNum);

    // Load movimentacoes
    const { data: movs } = await supabase
      .from("movimentacoes")
      .select("*")
      .eq("processo_id", id)
      .order("created_at", { ascending: true });

    if (movs) {
      setMovimentacoes(movs.map(m => ({
        id: m.id,
        fase: Number(m.fase) as FaseProcesso,
        tipo: m.tipo,
        descricao: m.descricao,
        usuario: profile?.nome || "Usuário",
        createdAt: m.created_at,
      })));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProcesso();
  }, [id, user]);

  // Save phase data to database
  const saveFaseData = async (fase: FaseProcesso, data: Record<string, any>) => {
    if (!rawProcessoId) return;
    const column = `dados_fase${fase}` as "dados_fase2" | "dados_fase3" | "dados_fase4" | "dados_fase5";
    if (fase === 1) return; // Fase 1 is the laudo itself

    const currentPhaseData = ((processo as any)?.[`dadosFase${fase}`] || {}) as Record<string, any>;
    const legacyNested =
      fase === 3 && currentPhaseData.dadosFase3 && typeof currentPhaseData.dadosFase3 === "object" && !Array.isArray(currentPhaseData.dadosFase3)
        ? (currentPhaseData.dadosFase3 as Record<string, any>)
        : {};
    const nextData = { ...currentPhaseData, ...legacyNested, ...data };
    if (fase === 3) delete nextData.dadosFase3;

    const { error } = await supabase
      .from("processos")
      .update({ [column]: nextData })
      .eq("id", rawProcessoId);

    if (error) {
      toast.error("Erro ao salvar dados da fase");
    } else {
      toast.success("Dados salvos");
      await loadProcesso();
    }
  };

  // Advance to next phase — now opens prazo dialog first
  const advanceFase = async (fromFase: FaseProcesso) => {
    if (!rawProcessoId || fromFase >= 5) return;
    const nextFase = (fromFase + 1) as FaseProcesso;

    // For phases 1-3, show prazo dialog before advancing
    if (nextFase <= 4) {
      setPendingFaseAdvance(fromFase);
      setShowPrazoDialog(true);
      return;
    }

    // Phase 5 (encerramento) advances directly
    await executeAdvanceFase(fromFase);
  };

  // Actually execute the phase advance (after prazo dialog confirmation)
  const executeAdvanceFase = async (fromFase: FaseProcesso) => {
    if (!rawProcessoId || fromFase >= 5) return;
    const nextFase = (fromFase + 1) as FaseProcesso;
    const currentStatus = processo?.statusFases || {};

    const newStatus = {
      ...Object.fromEntries(
        ([1, 2, 3, 4, 5] as FaseProcesso[]).map(f => [
          String(f),
          f < nextFase ? "concluida" : f === nextFase ? "em_andamento" : currentStatus[f] || "pendente",
        ])
      ),
    };

    const currentDates = (processo?.datasFases || {}) as Record<number, { inicio?: string; fim?: string }>;
    const newDates = {
      ...Object.fromEntries(
        ([1, 2, 3, 4, 5] as FaseProcesso[]).map(f => [
          String(f),
          f === fromFase
            ? { ...currentDates[f], fim: new Date().toISOString().split("T")[0] }
            : f === nextFase
              ? { inicio: new Date().toISOString().split("T")[0] }
              : currentDates[f] || {},
        ])
      ),
    };

    const { error } = await supabase
      .from("processos")
      .update({
        fase_atual: String(nextFase) as "1" | "2" | "3" | "4" | "5",
        status_fases: newStatus,
        datas_fases: newDates,
      })
      .eq("id", rawProcessoId);

    if (error) {
      toast.error("Erro ao avançar fase");
    } else {
      toast.success(`Avançou para ${nextFase === 2 ? "Notificação" : nextFase === 3 ? "Resposta do Banco" : nextFase === 4 ? "Via Judicial" : "Encerramento"}`);
      await loadProcesso();
    }
  };

  // Handle prazo dialog confirmation
  const handlePrazoConfirm = async (prazoDias: number, responsavelId: string, dataCustom?: string) => {
    if (!pendingFaseAdvance || !rawProcessoId || !orgId || !user) return;

    const nextFase = (pendingFaseAdvance + 1) as FaseProcesso;

    // Create the task
    await criarTarefaFase({
      fase: nextFase,
      prazoDias,
      processoId: rawProcessoId,
      organizacaoId: orgId,
      responsavelId,
      userId: user.id,
      nomeCliente: processo?.produtor || "",
      dataBase: dataCustom,
    });

    // Execute the phase advance
    await executeAdvanceFase(pendingFaseAdvance);
    setPendingFaseAdvance(null);
    toast.success("Tarefa criada com prazo definido!");
  };

  // Handle phase 3 response (silence/denied → auto-create judicial task)
  const saveFaseDataWithTasks = async (fase: FaseProcesso, data: Record<string, any>) => {
    await saveFaseData(fase, data);

    // When phase 3 result is silence or denied, auto-create judicial task
    if (fase === 3 && (data.tipoRespostaBanco === "silencio" || data.tipoRespostaBanco === "negado")) {
      if (orgId && user && rawProcessoId) {
        // Find advogado for responsible
        const advogado = members.find(m => 
          ["advogado", "assessor_juridico", "admin"].includes(m.papel)
        );
        
        await criarTarefaJudicial({
          processoId: rawProcessoId,
          organizacaoId: orgId,
          responsavelId: advogado?.user_id || user.id,
          userId: user.id,
          nomeCliente: processo?.produtor || "",
          motivo: data.tipoRespostaBanco as "silencio" | "negado",
        });
        toast.success("Tarefa judicial criada automaticamente (prazo: 15 dias)");
      }
    }
  };

  if (!processo) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Processo não encontrado.</p>
          <Link to="/processos" className="text-accent text-sm hover:underline mt-2 inline-block">
            ← Voltar aos processos
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
        <span>Agro</span>
        <ChevronRight className="w-3 h-3 opacity-50" />
        <Link to="/processos" className="hover:text-foreground transition-colors">Processos</Link>
        <ChevronRight className="w-3 h-3 opacity-50" />
        <span className="text-foreground font-medium truncate max-w-[260px]" data-private>
          {processo?.produtor || rawProcessoId}
        </span>
      </nav>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <Link
            to="/processos"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar aos processos
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPerfilOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" /> Perfil 360
            </button>
            {clienteId && (
            <button
              onClick={() =>
                navigate(
                  `/novo-laudo?cliente_id=${clienteId}&cliente=${encodeURIComponent(processo.produtor)}&processo_id=${rawProcessoId}`
                )
              }
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
            >
              <FileText className="w-4 h-4" /> Novo laudo para este cliente
            </button>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              {processo.produtor.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                <Link
                  to={`/clientes/${encodeURIComponent(processo.produtor)}`}
                  className="hover:text-primary transition-colors"
                  title="Abrir Perfil 360 do cliente"
                >
                  {processo.produtor}
                </Link>
              </h1>
              <p className="text-sm text-muted-foreground">
                {processo.banco} · {processo.contrato} · {processo.municipio}/{processo.uf}
              </p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <AIResumoProcessoButton
              processoId={processo.id}
              contextoTexto={`Produtor: ${processo.produtor}\nBanco: ${processo.banco}\nContrato: ${processo.contrato}\nMunicípio: ${processo.municipio}/${processo.uf}\nFase atual: ${processo.faseAtual}\nResumo do processo: ${JSON.stringify(processo).slice(0, 4000)}`}
            />
          </div>
        </div>
      </div>

      <PerfilClienteDrawer
        open={perfilOpen}
        onOpenChange={setPerfilOpen}
        produtor={processo.produtor}
      />

      {/* 3-column layout */}
      <div className="flex gap-5">
        {/* Left — Timeline */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block w-[220px] shrink-0"
        >
          <ProcessoTimeline
            processo={processo}
            onFaseClick={setFaseAtiva}
            faseAtiva={faseAtiva}
          />
        </motion.div>

        {/* Center — Phase content */}
        <motion.div
          key={faseAtiva}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 min-w-0"
        >
          {/* Mobile timeline selector */}
          <div className="lg:hidden mb-5">
            <select
              value={faseAtiva}
              onChange={(e) => setFaseAtiva(Number(e.target.value) as FaseProcesso)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {([1, 2, 3, 4, 5] as FaseProcesso[]).map((f) => (
                <option key={f} value={f} disabled={processo.statusFases[f] === "pendente" || processo.statusFases[f] === "bloqueada"}>
                  Fase {f} — {f === 1 ? "Laudo" : f === 2 ? "Notificação" : f === 3 ? "Resposta" : f === 4 ? "Judicial" : "Encerrado"}
                </option>
              ))}
            </select>
          </div>

          <FaseContent
            processo={processo}
            fase={faseAtiva}
            onSaveFaseData={saveFaseDataWithTasks}
            onAdvanceFase={advanceFase}
            laudoId={rawLaudoId}
            processoId={rawProcessoId}
            movimentacoes={movimentacoes}
            onMovimentacaoAdded={loadProcesso}
          />

          {/* Phase override — disponível para toda a equipe */}
          {(
            <div className="mt-4 bg-card rounded-lg border border-border p-4">
              <Label className="text-xs text-muted-foreground mb-2 block">Alterar Fase Manualmente</Label>
              <Select
                value={String(faseAtiva)}
                onValueChange={async (v) => {
                  const newFase = Number(v);
                  if (!rawProcessoId) return;
                  const newStatus: Record<string, string> = {};
                  const newDates: Record<string, any> = {};
                  for (let f = 1; f <= 5; f++) {
                    const key = String(f);
                    if (f < newFase) {
                      newStatus[key] = "concluida";
                      newDates[key] = processo?.datasFases?.[f as FaseProcesso] || {};
                    } else if (f === newFase) {
                      newStatus[key] = "em_andamento";
                      newDates[key] = { inicio: new Date().toISOString().split("T")[0] };
                    } else {
                      newStatus[key] = "pendente";
                      newDates[key] = {};
                    }
                  }
                  const { error } = await supabase
                    .from("processos")
                    .update({
                      fase_atual: v as "1" | "2" | "3" | "4" | "5",
                      status_fases: newStatus,
                      datas_fases: newDates,
                    })
                    .eq("id", rawProcessoId);
                  if (error) {
                    toast.error("Erro ao alterar fase");
                  } else {
                    toast.success(`Fase alterada para ${v}`);
                    await loadProcesso();
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {([1, 2, 3, 4, 5] as const).map(f => (
                    <SelectItem key={f} value={String(f)}>
                      Fase {f} — {f === 1 ? "Laudo" : f === 2 ? "Notificação" : f === 3 ? "Resposta" : f === 4 ? "Judicial" : "Encerrado"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Responsável pela fase — editável por toda a equipe */}
          {(
            <div className="mt-4 bg-card rounded-lg border border-border p-4">
              <Label className="text-xs text-muted-foreground mb-2 block">Responsável pela Fase {faseAtiva}</Label>
              <Select
                value={responsaveisFases[String(faseAtiva)] || ""}
                onValueChange={async (v) => {
                  const updated = { ...responsaveisFases, [String(faseAtiva)]: v };
                  setResponsaveisFases(updated);
                  await supabase.from("processos").update({ responsaveis_fases: updated } as any).eq("id", rawProcessoId);
                  toast.success("Responsável atualizado");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.nome || "Sem nome"} ({m.papel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tasks for this process */}
          <div className="mt-4 bg-card rounded-lg border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-accent" /> Tarefas do Processo
              </h3>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setShowCreateTask(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tarefa
                </Button>
              )}
            </div>
            {tarefas.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma tarefa.</div>
            ) : (
              <div className="divide-y divide-border">
                {tarefas.map(t => (
                  <div key={t.id} className="p-3 flex items-center gap-2">
                    <button onClick={() => toggleConcluida(t.id, !t.concluida)} className="shrink-0">
                      {t.concluida
                        ? <CheckCircle2 className="w-4 h-4 text-success" />
                        : <Circle className="w-4 h-4 text-muted-foreground hover:text-accent transition-colors" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", t.concluida && "line-through text-muted-foreground")}>{t.titulo}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {members.find(m => m.user_id === t.responsavel_id)?.nome || "—"} · {new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => confirmDelete(t.id)} className="p-1 hover:bg-destructive/10 rounded shrink-0">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right — Panel */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden xl:block w-[300px] shrink-0"
        >
          <ProcessoPainel
            processo={processo}
            alertas={alertas}
            movimentacoes={movimentacoes}
          />
          <div className="mt-4 space-y-4">
            <AdvboxVinculoCard
              processoId={rawProcessoId}
              organizacaoId={orgId}
              onSyncDone={() => setAndamentosReloadKey((k) => k + 1)}
            />
            <ClienteVinculoCard
              processoId={rawProcessoId}
              organizacaoId={orgId}
              clienteIdAtual={clienteId || null}
              sugestaoNome={sugestaoNomeCliente}
              onChanged={loadProcesso}
            />
            <AdvboxAndamentosTimeline processoId={rawProcessoId} reloadKey={andamentosReloadKey} />
          </div>
        </motion.div>
      </div>

      {/* Create task dialog */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Tarefa para este Processo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={taskForm.titulo} onChange={e => setTaskForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Responsável *</Label>
              <Select value={taskForm.responsavel_id} onValueChange={v => setTaskForm(f => ({ ...f, responsavel_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || "Sem nome"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={taskForm.data_vencimento} onChange={e => setTaskForm(f => ({ ...f, data_vencimento: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTask(false)}>Cancelar</Button>
            <Button className="bg-accent text-accent-foreground" onClick={async () => {
              if (!taskForm.titulo || !taskForm.responsavel_id || !taskForm.data_vencimento || !orgId) {
                toast.error("Preencha todos os campos"); return;
              }
              const { error } = await createTarefa({
                organizacao_id: orgId,
                processo_id: rawProcessoId,
                fase: String(faseAtiva),
                responsavel_id: taskForm.responsavel_id,
                titulo: taskForm.titulo,
                descricao: null,
                data_vencimento: taskForm.data_vencimento,
                concluida: false,
              });
              if (error) toast.error("Erro ao criar tarefa");
              else { toast.success("Tarefa criada"); setShowCreateTask(false); setTaskForm({ titulo: "", responsavel_id: "", data_vencimento: "" }); }
            }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prazo fase dialog */}
      <PrazoFaseDialog
        open={showPrazoDialog}
        onOpenChange={(open) => {
          setShowPrazoDialog(open);
          if (!open) setPendingFaseAdvance(null);
        }}
        fase={pendingFaseAdvance ? (pendingFaseAdvance + 1) : 1}
        nomeCliente={processo?.produtor || ""}
        members={members.map(m => ({ user_id: m.user_id, nome: m.nome, papel: m.papel }))}
        currentResponsavel={
          pendingFaseAdvance
            ? responsaveisFases[String(pendingFaseAdvance + 1)] || user?.id
            : user?.id
        }
        onConfirm={handlePrazoConfirm}
      />
    </AppLayout>
  );
}
