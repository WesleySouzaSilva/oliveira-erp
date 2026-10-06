import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { useAcordos, AcordoTarefa } from "@/hooks/useAcordos";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle, Handshake, Calendar, CheckCircle2, Clock,
  AlertTriangle, RefreshCw, Search,
} from "lucide-react";
import { format, isPast, isToday, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AcordoKanban } from "@/components/acordos/AcordoKanban";
import { HistoricoContrato } from "@/components/acordos/HistoricoContrato";
import { AuditoriaAcordos } from "@/components/acordos/AuditoriaAcordos";
import { VisivelClienteToggle } from "@/components/portal/VisivelClienteToggle";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";

const RESULTADO_OPTIONS: { value: string; label: string; tone: StatusTone }[] = [
  { value: "acordo_fechado", label: "Acordo Fechado", tone: "success" },
  { value: "sem_resposta",   label: "Sem Resposta",   tone: "neutral" },
  { value: "recusado",       label: "Recusado",       tone: "danger" },
  { value: "reagendar",      label: "Reagendar",      tone: "warning" },
];

const PRIORIDADE_TONE: Record<string, StatusTone> = {
  alta: "danger",
  normal: "info",
  baixa: "neutral",
};

function AcordoFormDialog({
  open,
  onClose,
  orgId,
  members,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string | null;
  members: any[];
  onSubmit: (data: Partial<AcordoTarefa>) => Promise<any>;
}) {
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    nome_cliente: "",
    responsavel_id: "",
    data_vencimento: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    prioridade: "normal",
    recorrente: true,
    intervalo_recorrencia: "quinzenal",
    contrato_id: "",
    observacoes: "",
  });

  // Cadência de acordos é diligenciada pelo time de Pós-Venda.
  const POS_VENDA_ROLES = new Set([
    "admin",
    "gestor_pos_venda",
    "advogado_pos_venda",
    "estagiario_pos_venda",
    "pos_venda",
  ]);
  const responsaveisElegiveis = members.filter((m: any) => POS_VENDA_ROLES.has(m.papel));
  const [contratos, setContratos] = useState<any[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load contracts for linking
  const loadContratos = async () => {
    if (!orgId) return;
    setLoadingContratos(true);
    const { data } = await supabase
      .from("contratos_vencimentos")
      .select("id, nome_cliente, banco, numero_contrato")
      .eq("organizacao_id", orgId)
      .is("deleted_at", null)
      .eq("resolvido", false)
      .order("nome_cliente")
      .limit(200);
    setContratos(data || []);
    setLoadingContratos(false);
  };

  useState(() => { loadContratos(); });

  const handleSubmit = async () => {
    if (!form.titulo || !form.data_vencimento) return;
    setSubmitting(true);
    await onSubmit({
      titulo: form.titulo,
      descricao: form.descricao || null,
      nome_cliente: form.nome_cliente || null,
      responsavel_id: form.responsavel_id || undefined,
      data_vencimento: form.data_vencimento,
      prioridade: form.prioridade,
      recorrente: form.recorrente,
      intervalo_recorrencia: form.recorrente ? form.intervalo_recorrencia : null,
      contrato_id: form.contrato_id || null,
      observacoes: form.observacoes || null,
    });
    setSubmitting(false);
    setForm({
      titulo: "", descricao: "", nome_cliente: "", responsavel_id: "",
      data_vencimento: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      prioridade: "normal", recorrente: false, intervalo_recorrencia: "mensal",
      contrato_id: "", observacoes: "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-primary" />
            Nova Tarefa de Acordo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Tentativa de acordo - João Silva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Vencimento *</Label>
              <Input type="date" value={form.data_vencimento} onChange={(e) => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Cliente</Label>
            <Input value={form.nome_cliente} onChange={(e) => setForm(f => ({ ...f, nome_cliente: e.target.value }))} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>Vincular a Contrato (opcional)</Label>
            <Select value={form.contrato_id || "__none__"} onValueChange={(v) => {
              const val = v === "__none__" ? "" : v;
              setForm(f => ({ ...f, contrato_id: val }));
              const ct = contratos.find(c => c.id === v);
              if (ct && !form.nome_cliente) setForm(f => ({ ...f, nome_cliente: ct.nome_cliente }));
            }}>
              <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem vínculo</SelectItem>
                {contratos.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_cliente} — {c.banco || "S/B"} {c.numero_contrato ? `(${c.numero_contrato})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={form.responsavel_id} onValueChange={(v) => setForm(f => ({ ...f, responsavel_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione um responsável de Pós-Venda" /></SelectTrigger>
              <SelectContent>
                {responsaveisElegiveis.map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {(m.nome || m.user_id.slice(0, 8))}
                  </SelectItem>
                ))}
                {responsaveisElegiveis.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Cadastre um Gestor, Advogado ou Estagiário de Pós-Venda em Equipe.
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Apenas cargos de Pós-Venda diligenciam a cadência de acordos.
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Switch checked={form.recorrente} onCheckedChange={(v) => setForm(f => ({ ...f, recorrente: v }))} />
            <div className="flex-1">
              <p className="text-sm font-medium">Tarefa Recorrente</p>
              <p className="text-xs text-muted-foreground">Gera nova tarefa automaticamente ao concluir</p>
            </div>
            {form.recorrente && (
              <Select value={form.intervalo_recorrencia} onValueChange={(v) => setForm(f => ({ ...f, intervalo_recorrencia: v }))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} placeholder="Detalhes da tentativa de acordo..." />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
          </div>
          <Button onClick={handleSubmit} disabled={!form.titulo || !form.data_vencimento || submitting} className="w-full">
            <PlusCircle className="w-4 h-4 mr-2" />
            Criar Tarefa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConcluirDialog({
  tarefa,
  open,
  onClose,
  onConcluir,
}: {
  tarefa: AcordoTarefa | null;
  open: boolean;
  onClose: () => void;
  onConcluir: (id: string, resultado: string, valor?: number) => Promise<boolean>;
}) {
  const [resultado, setResultado] = useState("");
  const [valor, setValor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!tarefa) return null;

  const handleSubmit = async () => {
    if (!resultado) return;
    setSubmitting(true);
    await onConcluir(tarefa.id, resultado, valor ? parseFloat(valor) : undefined);
    setSubmitting(false);
    setResultado("");
    setValor("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{tarefa.titulo}</p>
          <div>
            <Label>Resultado da Tentativa *</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger><SelectValue placeholder="Selecione o resultado" /></SelectTrigger>
              <SelectContent>
                {RESULTADO_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {resultado === "acordo_fechado" && (
            <div>
              <Label>Valor do Acordo (R$)</Label>
              <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
          )}
          {tarefa.recorrente && resultado !== "acordo_fechado" && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              <RefreshCw className="w-3 h-3 inline mr-1" />
              Uma nova tarefa será gerada automaticamente ({tarefa.intervalo_recorrencia}).
            </p>
          )}
          <Button onClick={handleSubmit} disabled={!resultado || submitting} className="w-full">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TarefaCard({
  tarefa,
  members,
  onConcluir,
}: {
  tarefa: AcordoTarefa;
  members: any[];
  onConcluir: (t: AcordoTarefa) => void;
}) {
  const vencida = isPast(new Date(tarefa.data_vencimento)) && !isToday(new Date(tarefa.data_vencimento));
  const hoje = isToday(new Date(tarefa.data_vencimento));
  const resp = members.find(m => m.user_id === tarefa.responsavel_id);

  return (
    <Card className={`transition-all hover:shadow-md ${vencida && !tarefa.concluida ? "border-destructive/50" : ""} ${tarefa.concluida ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-medium text-sm truncate">{tarefa.titulo}</h4>
              {tarefa.recorrente && (
                <StatusBadge
                  tone="info"
                  size="sm"
                  icon={<RefreshCw />}
                  label={tarefa.intervalo_recorrencia}
                />
              )}
            </div>
            {tarefa.nome_cliente && (
              <p className="text-xs text-muted-foreground mb-1">Cliente: {tarefa.nome_cliente}</p>
            )}
            <div className="mb-1">
              <VisivelClienteToggle
                table="acordos_tarefas"
                id={tarefa.id}
                value={!!(tarefa as any).visivel_cliente}
                hint={
                  (tarefa as any).cliente_id
                    ? undefined
                    : "Sem cliente vinculado — não aparece no Portal até vincular pelo processo."
                }
                size="xs"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <StatusBadge
                tone={PRIORIDADE_TONE[tarefa.prioridade] ?? "neutral"}
                label={tarefa.prioridade}
              />
              <span className={`flex items-center gap-1 ${vencida ? "text-destructive font-medium" : hoje ? "text-yellow-600" : "text-muted-foreground"}`}>
                {vencida ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                {format(new Date(tarefa.data_vencimento), "dd/MM/yyyy")}
              </span>
              {resp && <span className="text-muted-foreground">• {resp.nome || "Membro"}</span>}
            </div>
            {tarefa.resultado_tentativa && (() => {
              const opt = RESULTADO_OPTIONS.find(r => r.value === tarefa.resultado_tentativa);
              return opt ? (
                <div className="mt-2">
                  <StatusBadge tone={opt.tone} size="sm" label={opt.label} />
                </div>
              ) : null;
            })()}
          </div>
          {!tarefa.concluida && (
            <Button size="sm" variant="outline" onClick={() => onConcluir(tarefa)} className="shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Acordos() {
  const { tarefas, loading, criarTarefa, atualizarTarefa, concluirTarefa } = useAcordos();
  const { members, orgId } = useOrgMembers();
  const [showForm, setShowForm] = useState(false);
  const [concluirTarget, setConcluirTarget] = useState<AcordoTarefa | null>(null);
  const [busca, setBusca] = useState("");

  // Wrapper: ao concluir com "acordo_fechado", marca o contrato vinculado como resolvido
  const handleConcluir = async (id: string, resultado: string, valor?: number) => {
    const ok = await concluirTarefa(id, resultado, valor);
    if (ok && resultado === "acordo_fechado") {
      const t = tarefas.find(x => x.id === id);
      if (t?.contrato_id) {
        await supabase
          .from("contratos_vencimentos")
          .update({
            resolvido: true,
            motivo_resolucao: `Acordo fechado${valor ? ` — R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`,
          })
          .eq("id", t.contrato_id);
      }
    }
    return ok;
  };

  const pendentes = useMemo(() =>
    tarefas.filter(t => !t.concluida).filter(t =>
      !busca || t.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      t.nome_cliente?.toLowerCase().includes(busca.toLowerCase())
    ), [tarefas, busca]);

  const concluidas = useMemo(() =>
    tarefas.filter(t => t.concluida).filter(t =>
      !busca || t.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      t.nome_cliente?.toLowerCase().includes(busca.toLowerCase())
    ), [tarefas, busca]);

  const stats = useMemo(() => {
    const active = tarefas.filter(t => !t.concluida);
    const atrasadas = active.filter(t => isPast(new Date(t.data_vencimento)) && !isToday(new Date(t.data_vencimento)));
    const acordosFechados = tarefas.filter(t => t.resultado_tentativa === "acordo_fechado");
    const valorTotal = acordosFechados.reduce((sum, t) => sum + (t.valor_acordo || 0), 0);
    return {
      total: active.length,
      atrasadas: atrasadas.length,
      fechados: acordosFechados.length,
      valorTotal,
      recorrentes: active.filter(t => t.recorrente).length,
    };
  }, [tarefas]);

  const handleMoveStatus = async (id: string, newStatus: string) => {
    await atualizarTarefa(id, { status: newStatus });
  };

  const handleWhatsApp = (t: AcordoTarefa) => {
    const msg = encodeURIComponent(`Olá! Referente ao acordo: ${t.titulo}${t.nome_cliente ? ` - Cliente: ${t.nome_cliente}` : ""}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleEmail = (t: AcordoTarefa) => {
    const subject = encodeURIComponent(`Acordo: ${t.titulo}`);
    const body = encodeURIComponent(`Prezado(a),\n\nReferente ao acordo "${t.titulo}"${t.nome_cliente ? ` do cliente ${t.nome_cliente}` : ""}.\n\nAtenciosamente.`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          icon={Handshake}
          title="Setor de Acordos"
          subtitle="Gerencie tentativas de acordos com tarefas recorrentes"
          breadcrumb={[{ label: "Agro" }, { label: "Acordos" }]}
          actions={
            <Button onClick={() => setShowForm(true)}>
              <PlusCircle className="w-4 h-4 mr-2" /> Nova Tarefa
            </Button>
          }
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{stats.atrasadas}</p><p className="text-xs text-muted-foreground">Atrasadas</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{stats.fechados}</p><p className="text-xs text-muted-foreground">Acordos Fechados</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p><p className="text-xs text-muted-foreground">Valor Total</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold flex items-center justify-center gap-1"><RefreshCw className="w-4 h-4" /> {stats.recorrentes}</p><p className="text-xs text-muted-foreground">Recorrentes</p></CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por título ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>

        {/* Tabs: Kanban, Lista, Histórico */}
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="pendentes">
              <Clock className="w-4 h-4 mr-1" /> Pendentes ({pendentes.length})
            </TabsTrigger>
            <TabsTrigger value="concluidas">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Concluídas ({concluidas.length})
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            {loading ? (
              <ListSkeleton rows={4} />
            ) : (
              <AcordoKanban
                tarefas={tarefas}
                members={members}
                busca={busca}
                onConcluir={setConcluirTarget}
                onMoveStatus={handleMoveStatus}
                onWhatsApp={handleWhatsApp}
                onEmail={handleEmail}
              />
            )}
          </TabsContent>

          <TabsContent value="pendentes" className="mt-4">
            {loading ? (
              <ListSkeleton rows={4} />
            ) : pendentes.length === 0 ? (
              <EmptyState
                icon={Handshake}
                title="Nenhuma tarefa pendente"
                description="Crie uma nova tarefa de acordo para começar."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {pendentes.map(t => (
                  <TarefaCard key={t.id} tarefa={t} members={members} onConcluir={setConcluirTarget} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="concluidas" className="mt-4">
            {concluidas.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">Nenhuma tarefa concluída ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {concluidas.map(t => (
                  <TarefaCard key={t.id} tarefa={t} members={members} onConcluir={setConcluirTarget} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <HistoricoContrato tarefas={tarefas} />
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4">
            <AuditoriaAcordos tarefas={tarefas} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <AcordoFormDialog open={showForm} onClose={() => setShowForm(false)} orgId={orgId} members={members} onSubmit={criarTarefa} />
        <ConcluirDialog tarefa={concluirTarget} open={!!concluirTarget} onClose={() => setConcluirTarget(null)} onConcluir={handleConcluir} />
      </div>
    </AppLayout>
  );
}
