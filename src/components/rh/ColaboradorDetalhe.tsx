import { invalidarMembrosOrg } from "@/hooks/useOrgMembers";
import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Plus, User, Calendar, FileText, Briefcase, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SalarioTimeline } from "./SalarioTimeline";
import { FeedbackForm } from "./FeedbackForm";
import { MetaCard } from "./MetaCard";
import { MetaForm } from "./MetaForm";
import { Reuniao1on1Form } from "./Reuniao1on1Form";
import { PDIForm } from "./PDIForm";
import { PDICard } from "./PDICard";
import { DocumentoRHForm } from "./DocumentoRHForm";
import { ContratoRHForm } from "./ContratoRHForm";
import { HistoricoTimeline } from "./HistoricoTimeline";
import { PermissoesTab } from "./PermissoesTab";
import { VinculoAcessoBlock } from "./VinculoAcessoBlock";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { RHRole } from "@/hooks/usePermissions";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Convert empty strings to null so Postgres date/uuid fields don't reject them
const sanitize = <T extends Record<string, any>>(data: T): T => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out as T;
};

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador", agronomo: "Agrônomo", advogado: "Advogado",
  engenheiro_agronomo: "Eng. Agrônomo", estagiario_direito: "Estagiário",
  assessor_juridico: "Assessor Jurídico", pos_venda: "Pós-Venda",
  coordenador: "Coordenador", gestor_pos_venda: "Gestor de Pós-Venda",
  advogado_pos_venda: "Advogado de Pós-Venda", estagiario_pos_venda: "Estagiário de Pós-Venda",
  comercial: "Comercial", closer: "Closer", sdr: "SDR", social_seller: "Social Seller",
  marketing: "Marketing", gerente_marketing: "Ger. Marketing", criacao: "Criação",
  copywriter: "Copywriter", social_media: "Social Media",
};

const ALL_ROLES: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor_pos_venda", label: "Gestor de Pós-Venda" },
  { value: "pos_venda", label: "Pós-Venda" },
  { value: "advogado_pos_venda", label: "Advogado de Pós-Venda" },
  { value: "estagiario_pos_venda", label: "Estagiário de Pós-Venda" },
  { value: "agronomo", label: "Agrônomo" },
  { value: "engenheiro_agronomo", label: "Eng. Agrônomo" },
  { value: "advogado", label: "Advogado" },
  { value: "assessor_juridico", label: "Assessor Jurídico" },
  { value: "estagiario_direito", label: "Estagiário" },
  { value: "comercial", label: "Comercial" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
  { value: "social_seller", label: "Social Seller" },
  { value: "marketing", label: "Marketing" },
  { value: "gerente_marketing", label: "Ger. Marketing" },
  { value: "criacao", label: "Criação" },
  { value: "copywriter", label: "Copywriter" },
  { value: "social_media", label: "Social Media" },
];

interface Colaborador {
  membroId: string;
  userId: string;
  nome: string | null;
  papel: string;
  fotoUrl: string | null;
  ativo: boolean;
  orgId: string;
  cargo?: string | null;
  setor?: string | null;
  dataEntrada?: string | null;
  regimeTrabalho?: string | null;
  liderNome?: string | null;
}

interface ColaboradorDetalheProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaborador: Colaborador | null;
  viewerRole: RHRole;
}

export function ColaboradorDetalhe({ open, onOpenChange, colaborador, viewerRole }: ColaboradorDetalheProps) {
  const { user } = useAuth();
  const [salarios, setSalarios] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<any[]>([]);
  const [pdis, setPdis] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [reuniaoOpen, setReuniaoOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState<any>(null);
  const [pdiOpen, setPdiOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [contratoOpen, setContratoOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<any>(null);
  const [editingPdi, setEditingPdi] = useState<any>(null);
  const [salarioFormOpen, setSalarioFormOpen] = useState(false);
  const [novoSalario, setNovoSalario] = useState({ valor: "", data_vigencia: "", motivo: "" });

  const isAdmin = viewerRole === "admin";
  const [savingRole, setSavingRole] = useState(false);
  const [currentPapel, setCurrentPapel] = useState<string>(colaborador?.papel || "");

  useEffect(() => {
    setCurrentPapel(colaborador?.papel || "");
  }, [colaborador?.membroId, colaborador?.papel]);

  const handleChangeRole = async (newRole: string) => {
    if (!colaborador || newRole === currentPapel) return;
    setSavingRole(true);
    const { error } = await supabase
      .from("membros")
      .update({ papel: newRole as any })
      .eq("id", colaborador.membroId); invalidarMembrosOrg();
    setSavingRole(false);
    if (error) {
      toast.error("Não foi possível alterar o cargo: " + error.message);
      return;
    }
    setCurrentPapel(newRole);
    toast.success("Cargo atualizado");
  };

  // Determine visible tabs
  const tabs: { value: string; label: string }[] = [];
  tabs.push({ value: "geral", label: "Visão Geral" });
  tabs.push({ value: "metas", label: "Metas" });
  tabs.push({ value: "1on1", label: "1:1" });
  if (isAdmin) tabs.push({ value: "feedbacks", label: "Feedbacks" });
  tabs.push({ value: "pdi", label: "PDI" });
  tabs.push({ value: "documentos", label: "Documentos" });
  if (isAdmin || viewerRole === "self") tabs.push({ value: "contrato", label: "Contrato" });
  if (isAdmin) tabs.push({ value: "salario", label: "Salário" });
  if (isAdmin) tabs.push({ value: "permissoes", label: "Permissões" });
  tabs.push({ value: "historico", label: "Histórico" });

  const fetchData = useCallback(async () => {
    if (!colaborador) return;
    const mid = colaborador.membroId;
    const [metasR, reunioesR, salR, fbR] = await Promise.all([
      supabase.from("rh_metas").select("*").eq("membro_id", mid).order("created_at", { ascending: false }),
      supabase.from("rh_reunioes_1on1").select("*").eq("membro_id", mid).order("data_reuniao", { ascending: false }),
      isAdmin ? supabase.from("rh_salarios").select("*").eq("membro_id", mid).order("data_vigencia", { ascending: false }) : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from("rh_feedbacks").select("*").eq("membro_id", mid).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    setMetas(metasR.data || []);
    setReunioes(reunioesR.data || []);
    setSalarios((salR as any).data || []);
    setFeedbacks((fbR as any).data || []);
    // Fetch new tables via REST to avoid type issues
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || anonKey;
    const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
    const fetchTable = async (table: string) => {
      const res = await fetch(`${baseUrl}/rest/v1/${table}?membro_id=eq.${mid}&order=created_at.desc`, { headers });
      return res.ok ? res.json() : [];
    };
    const [pdisD, docsD, contratosD, histD] = await Promise.all([
      fetchTable("rh_pdis"), fetchTable("rh_documentos"), fetchTable("rh_contratos"), fetchTable("rh_historico"),
    ]);
    setPdis(pdisD); setDocumentos(docsD); setContratos(contratosD); setHistorico(histD);

  }, [colaborador, isAdmin]);

  useEffect(() => {
    if (open && colaborador) fetchData();
  }, [open, colaborador, fetchData]);

  if (!colaborador) return null;

  const salarioAtual = salarios.length > 0 ? salarios[0].valor : null;

  // Handlers
  const handleFeedbackSubmit = async (data: any) => {
    setLoading(true);
    const payload = sanitize(data);
    const { error } = await supabase.from("rh_feedbacks").insert({
      membro_id: colaborador.membroId, organizacao_id: colaborador.orgId,
      autor_id: user!.id, ...payload,
    });
    setLoading(false);
    if (error) { console.error("rh_feedbacks insert", error); toast.error(`Erro ao salvar feedback: ${error.message}`); return; }
    toast.success("Feedback registrado!");
    setFeedbackOpen(false);
    fetchData();
  };

  const handleMetaSubmit = async (data: any) => {
    setLoading(true);
    const payload = sanitize(data);
    if (editingMeta) {
      const { error } = await supabase.from("rh_metas").update(payload).eq("id", editingMeta.id);
      if (error) { console.error("rh_metas update", error); toast.error(`Erro ao atualizar meta: ${error.message}`); setLoading(false); return; }
      toast.success("Meta atualizada!");
    } else {
      const { error } = await supabase.from("rh_metas").insert({
        membro_id: colaborador.membroId, organizacao_id: colaborador.orgId,
        created_by: user!.id, ...payload,
      });
      if (error) { console.error("rh_metas insert", error); toast.error(`Erro ao criar meta: ${error.message}`); setLoading(false); return; }
      toast.success("Meta criada!");
    }
    setLoading(false); setMetaOpen(false); setEditingMeta(null);
    fetchData();
  };

  const handleReuniaoSubmit = async (data: any) => {
    setLoading(true);
    const payload = sanitize(data);
    if (editingReuniao) {
      const { error } = await supabase.from("rh_reunioes_1on1").update(payload).eq("id", editingReuniao.id);
      setLoading(false);
      if (error) { console.error("rh_reunioes_1on1 update", error); toast.error(`Erro ao atualizar reunião: ${error.message}`); return; }
      toast.success("Reunião atualizada!");
    } else {
      const { error } = await supabase.from("rh_reunioes_1on1").insert({
        membro_id: colaborador.membroId, organizacao_id: colaborador.orgId,
        condutor_id: user!.id, ...payload,
      });
      setLoading(false);
      if (error) { console.error("rh_reunioes_1on1 insert", error); toast.error(`Erro ao salvar reunião: ${error.message}`); return; }
      toast.success("Reunião registrada!");
    }
    setReuniaoOpen(false); setEditingReuniao(null);
    fetchData();
  };

  const askConfirm = useConfirm();
  const handleReuniaoDelete = async (id: string) => {
    if (!(await askConfirm({ title: "Excluir reunião 1:1", description: "Excluir esta reunião 1:1?", destructive: true, confirmText: "Excluir" }))) return;
    const { error } = await supabase.from("rh_reunioes_1on1").delete().eq("id", id);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    toast.success("Reunião excluída!");
    fetchData();
  };

  const handlePdiSubmit = async (data: any) => {
    setLoading(true);
    const payload = sanitize(data);
    if (editingPdi) {
      const { error } = await supabase.from("rh_pdis").update(payload).eq("id", editingPdi.id);
      if (error) { console.error("rh_pdis update", error); toast.error(`Erro ao atualizar PDI: ${error.message}`); setLoading(false); return; }
      toast.success("PDI atualizado!");
    } else {
      const { error } = await supabase.from("rh_pdis").insert({
        membro_id: colaborador.membroId, organizacao_id: colaborador.orgId,
        created_by: user!.id, responsavel_id: user!.id, ...payload,
      });
      if (error) { console.error("rh_pdis insert", error); toast.error(`Erro ao criar PDI: ${error.message}`); setLoading(false); return; }
      toast.success("PDI criado!");
    }
    setLoading(false); setPdiOpen(false); setEditingPdi(null);
    fetchData();
  };

  const handleDocSubmit = async (data: any) => {
    setLoading(true);
    const payload = sanitize(data);
    const { error } = await supabase.from("rh_documentos").insert({
      membro_id: colaborador.membroId, organizacao_id: colaborador.orgId,
      uploaded_by: user!.id, ...payload,
    });
    setLoading(false);
    if (error) { console.error("rh_documentos insert", error); toast.error(`Erro ao salvar documento: ${error.message}`); return; }
    toast.success("Documento registrado!");
    setDocOpen(false);
    fetchData();
  };

  const handleContratoSubmit = async (data: any) => {
    setLoading(true);
    const payload = sanitize(data);
    const { error } = await supabase.from("rh_contratos").insert({
      membro_id: colaborador.membroId, organizacao_id: colaborador.orgId, ...payload,
    });
    setLoading(false);
    if (error) { console.error("rh_contratos insert", error); toast.error(`Erro ao salvar contrato: ${error.message}`); return; }
    toast.success("Contrato registrado!");
    setContratoOpen(false);
    fetchData();
  };

  const handleSalarioSubmit = async () => {
    if (!novoSalario.valor || !novoSalario.data_vigencia) return;
    setLoading(true);
    const { error } = await supabase.from("rh_salarios").insert({
      membro_id: colaborador.membroId, organizacao_id: colaborador.orgId,
      valor: parseFloat(novoSalario.valor), data_vigencia: novoSalario.data_vigencia,
      motivo: novoSalario.motivo || null, created_by: user!.id,
    });
    setLoading(false);
    if (error) { toast.error("Erro ao salvar salário"); return; }
    toast.success("Salário registrado!");
    setSalarioFormOpen(false); setNovoSalario({ valor: "", data_vigencia: "", motivo: "" });
    fetchData();
  };

  const tipoLabel: Record<string, string> = {
    desempenho: "Desempenho", comportamental: "Comportamental", tecnico: "Técnico",
  };

  const docTipoLabel: Record<string, string> = {
    contrato: "Contrato", aditivo: "Aditivo", termo_confidencialidade: "Termo de Conf.",
    politica_interna: "Política Interna", termo_equipamento: "Termo Equip.",
    advertencia: "Advertência", outros: "Outros",
  };

  const statusAssinaturaLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    pendente: { label: "Pendente", variant: "secondary" },
    assinado: { label: "Assinado", variant: "default" },
    recusado: { label: "Recusado", variant: "destructive" },
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-4 pb-2">
              {colaborador.fotoUrl ? (
                <img src={colaborador.fotoUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-7 h-7 text-muted-foreground" />
                </div>
              )}
              <div>
                <SheetTitle className="text-lg">{colaborador.nome || "Sem nome"}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {colaborador.cargo || PAPEL_LABEL[colaborador.papel] || colaborador.papel}
                  {colaborador.setor && ` · ${colaborador.setor}`}
                </p>
                {colaborador.liderNome && (
                  <p className="text-xs text-muted-foreground">Líder: {colaborador.liderNome}</p>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="geral" className="mt-4">
            <TabsList className={`w-full flex flex-wrap h-auto gap-1 p-1`}>
              {tabs.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs flex-1 min-w-[70px]">{t.label}</TabsTrigger>
              ))}
            </TabsList>

            {/* === VISÃO GERAL === */}
            <TabsContent value="geral" className="mt-4 space-y-4">
              <VinculoAcessoBlock
                membroId={colaborador.membroId}
                userId={colaborador.userId}
                papel={currentPapel || colaborador.papel}
                canEdit={isAdmin}
                onChanged={fetchData}
              />
              <div className="grid grid-cols-2 gap-3">
                {colaborador.dataEntrada && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Data de Entrada</p>
                    <p className="text-sm font-medium mt-1">{format(new Date(colaborador.dataEntrada), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                )}
                {colaborador.regimeTrabalho && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Regime</p>
                    <p className="text-sm font-medium mt-1 capitalize">{colaborador.regimeTrabalho}</p>
                  </div>
                )}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={colaborador.ativo ? "default" : "secondary"} className="mt-1">{colaborador.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
                {isAdmin && salarioAtual && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Salário Atual</p>
                    <p className="text-sm font-bold mt-1">R$ {Number(salarioAtual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-3">Resumo</p>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold">{metas.filter(m => m.status === "ativa").length}</p>
                    <p className="text-xs text-muted-foreground">Metas</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{reunioes.length}</p>
                    <p className="text-xs text-muted-foreground">1:1s</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{pdis.filter(p => p.status === "em_andamento").length}</p>
                    <p className="text-xs text-muted-foreground">PDIs</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{documentos.length}</p>
                    <p className="text-xs text-muted-foreground">Docs</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* === METAS === */}
            <TabsContent value="metas" className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Metas</h3>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingMeta(null); setMetaOpen(true); }}>
                    <Plus className="w-4 h-4 mr-1" /> Nova
                  </Button>
                )}
              </div>
              {metas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma meta registrada.</p>
              ) : (
                <div className="space-y-3">
                  {metas.map(m => (
                    <MetaCard key={m.id} id={m.id} titulo={m.titulo} descricao={m.descricao} prazo={m.prazo}
                      progresso={m.progresso} status={m.status}
                      onEdit={isAdmin ? (id) => { setEditingMeta(metas.find(x => x.id === id)); setMetaOpen(true); } : () => {}} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* === 1:1 === */}
            <TabsContent value="1on1" className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Reuniões 1:1</h3>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingReuniao(null); setReuniaoOpen(true); }}>
                    <Plus className="w-4 h-4 mr-1" /> Nova
                  </Button>
                )}
              </div>
              {reunioes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião registrada.</p>
              ) : (
                <div className="space-y-3">
                  {reunioes.map(r => (
                    <div key={r.id} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{format(new Date(r.data_reuniao), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.status_reuniao && <Badge variant="outline" className="text-[10px]">{r.status_reuniao}</Badge>}
                          {isAdmin && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingReuniao(r); setReuniaoOpen(true); }} aria-label="Editar reunião 1:1">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleReuniaoDelete(r.id)} aria-label="Excluir reunião 1:1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {r.pauta && <div><p className="text-xs font-medium text-muted-foreground">Pauta</p><p className="text-sm">{r.pauta}</p></div>}
                      {r.vitorias && <div><p className="text-xs font-medium text-emerald-600">Vitórias</p><p className="text-sm">{r.vitorias}</p></div>}
                      {r.dificuldades && <div><p className="text-xs font-medium text-amber-600">Dificuldades</p><p className="text-sm">{r.dificuldades}</p></div>}
                      {r.proximos_passos && <div><p className="text-xs font-medium text-muted-foreground">Próximos Passos</p><p className="text-sm">{r.proximos_passos}</p></div>}
                      {/* Self users only see resumo_visivel_colaborador */}
                      {viewerRole === "self" && r.resumo_visivel_colaborador && (
                        <div className="bg-muted/30 rounded p-2"><p className="text-xs font-medium text-muted-foreground">Resumo</p><p className="text-sm">{r.resumo_visivel_colaborador}</p></div>
                      )}
                      {isAdmin && r.nota_interna_admin && (
                        <div className="bg-destructive/5 border border-destructive/20 rounded p-2">
                          <p className="text-xs font-medium text-destructive">Nota Interna (só admin)</p>
                          <p className="text-sm">{r.nota_interna_admin}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* === FEEDBACKS (admin only) === */}
            {isAdmin && (
              <TabsContent value="feedbacks" className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Feedbacks</h3>
                  <Button size="sm" variant="outline" onClick={() => setFeedbackOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Novo
                  </Button>
                </div>
                {feedbacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum feedback registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {feedbacks.map(f => (
                      <div key={f.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i < f.nota ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{tipoLabel[f.tipo] || f.tipo}</Badge>
                            {f.status_feedback && <Badge variant={f.status_feedback === "aberto" ? "secondary" : "default"} className="text-[10px]">{f.status_feedback}</Badge>}
                          </div>
                        </div>
                        {f.contexto && <p className="text-xs text-muted-foreground mb-1"><span className="font-medium">Contexto:</span> {f.contexto}</p>}
                        <p className="text-sm">{f.comentario}</p>
                        {f.acao_esperada && <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Ação esperada:</span> {f.acao_esperada}</p>}
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {format(new Date(f.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          {f.prazo_revisao && ` · Revisão: ${format(new Date(f.prazo_revisao), "dd/MM/yyyy", { locale: ptBR })}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {/* === PDI === */}
            <TabsContent value="pdi" className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Plano de Desenvolvimento Individual</h3>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingPdi(null); setPdiOpen(true); }}>
                    <Plus className="w-4 h-4 mr-1" /> Novo
                  </Button>
                )}
              </div>
              {pdis.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum PDI registrado.</p>
              ) : (
                <div className="space-y-3">
                  {pdis.map(p => (
                    <PDICard key={p.id} id={p.id} objetivo={p.objetivo} competencia={p.competencia}
                      acao_pratica={p.acao_pratica} prazo={p.prazo} status={p.status}
                      evidencia_evolucao={p.evidencia_evolucao} canEdit={isAdmin}
                      onEdit={(id) => { setEditingPdi(pdis.find(x => x.id === id)); setPdiOpen(true); }} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* === DOCUMENTOS === */}
            <TabsContent value="documentos" className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Documentos</h3>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setDocOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Novo
                  </Button>
                )}
              </div>
              {documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento registrado.</p>
              ) : (
                <div className="space-y-3">
                  {documentos.map(d => {
                    const sa = statusAssinaturaLabel[d.status_assinatura] || statusAssinaturaLabel.pendente;
                    return (
                      <div key={d.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{d.nome}</p>
                            <p className="text-xs text-muted-foreground">{docTipoLabel[d.tipo] || d.tipo}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={sa.variant} className="text-[10px]">{sa.label}</Badge>
                          {d.validade && <span className="text-[10px] text-muted-foreground">Val: {format(new Date(d.validade), "dd/MM/yy")}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* === CONTRATO === */}
            {(isAdmin || viewerRole === "self") && (
              <TabsContent value="contrato" className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Contratos</h3>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setContratoOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Novo
                    </Button>
                  )}
                </div>
                {contratos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {contratos.map(c => (
                      <div key={c.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{c.tipo_vinculo}</span>
                          </div>
                          <Badge variant={c.status === "ativo" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          {c.regime_trabalho && <p>Regime: {c.regime_trabalho}</p>}
                          <p>Início: {format(new Date(c.data_inicio), "dd/MM/yyyy")}</p>
                          {c.data_fim && <p>Fim: {format(new Date(c.data_fim), "dd/MM/yyyy")}</p>}
                        </div>
                        {c.observacoes && <p className="text-xs text-muted-foreground mt-2">{c.observacoes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {/* === SALÁRIO (admin only) === */}
            {isAdmin && (
              <TabsContent value="salario" className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Histórico Salarial</h3>
                  <Button size="sm" variant="outline" onClick={() => setSalarioFormOpen(!salarioFormOpen)}>
                    <Plus className="w-4 h-4 mr-1" /> Registrar
                  </Button>
                </div>
                {salarioFormOpen && (
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Valor (R$)</label>
                      <input type="number" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={novoSalario.valor} onChange={(e) => setNovoSalario(p => ({ ...p, valor: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Data de Vigência</label>
                      <input type="date" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={novoSalario.data_vigencia} onChange={(e) => setNovoSalario(p => ({ ...p, data_vigencia: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Motivo</label>
                      <input type="text" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" placeholder="Ex: Promoção, Reajuste..." value={novoSalario.motivo} onChange={(e) => setNovoSalario(p => ({ ...p, motivo: e.target.value }))} />
                    </div>
                    <Button size="sm" onClick={handleSalarioSubmit} disabled={loading}>Salvar</Button>
                  </div>
                )}
                <SalarioTimeline salarios={salarios} />
              </TabsContent>
            )}

            {/* === HISTÓRICO === */}
            <TabsContent value="historico" className="mt-4 space-y-4">
              <h3 className="font-semibold text-sm">Histórico de Movimentações</h3>
              <HistoricoTimeline historico={historico} />
            </TabsContent>

            {/* === PERMISSÕES === */}
            {isAdmin && (
              <TabsContent value="permissoes" className="mt-4 space-y-4">
                <h3 className="font-semibold text-sm">Permissões deste colaborador</h3>
                <PermissoesTab
                  orgId={colaborador.orgId}
                  membroId={colaborador.membroId}
                  canEdit={isAdmin}
                />
              </TabsContent>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Forms */}
      <FeedbackForm open={feedbackOpen} onOpenChange={setFeedbackOpen} onSubmit={handleFeedbackSubmit} loading={loading} />
      <MetaForm open={metaOpen} onOpenChange={(o) => { setMetaOpen(o); if (!o) setEditingMeta(null); }} onSubmit={handleMetaSubmit} loading={loading}
        initial={editingMeta ? { titulo: editingMeta.titulo, descricao: editingMeta.descricao || "", prazo: editingMeta.prazo || "", progresso: editingMeta.progresso, status: editingMeta.status } : null} />
      <Reuniao1on1Form open={reuniaoOpen} onOpenChange={(o) => { setReuniaoOpen(o); if (!o) setEditingReuniao(null); }} onSubmit={handleReuniaoSubmit} loading={loading} isAdmin={isAdmin} initial={editingReuniao} />
      <PDIForm open={pdiOpen} onOpenChange={(o) => { setPdiOpen(o); if (!o) setEditingPdi(null); }} onSubmit={handlePdiSubmit} loading={loading} initial={editingPdi} />
      <DocumentoRHForm open={docOpen} onOpenChange={setDocOpen} onSubmit={handleDocSubmit} loading={loading} />
      <ContratoRHForm open={contratoOpen} onOpenChange={setContratoOpen} onSubmit={handleContratoSubmit} loading={loading} />
    </>
  );
}
