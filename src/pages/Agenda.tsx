import { useState, useMemo, useEffect } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { motion } from "framer-motion";
import {
  CalendarDays, Plus, CheckCircle2, Circle, Trash2, ChevronLeft, ChevronRight, User,
  CalendarClock, ArrowRight, Banknote, RefreshCw, Briefcase,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTarefas, type Tarefa } from "@/hooks/useTarefas";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdvboxSync } from "@/hooks/useAdvboxSync";
import { useConfirm } from "@/components/ui/confirm-dialog";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface ContratoVencimento {
  id: string;
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  vencimento_proxima_parcela: string | null;
  valor_parcela: number | null;
  valor_total_operacao: number | null;
}

interface AdvboxEvento {
  id: string;
  advbox_id: string;
  data: string;
  hora: string | null;
  titulo: string;
  descricao: string | null;
  cliente_nome: string | null;
  responsavel_id: string | null;
  responsavel_email: string | null;
  status: string | null;
  concluida: boolean;
}

export default function Agenda() {
  const { user } = useAuth();
  const { members, orgId, isAdmin } = useOrgMembers();
  const { tarefas, loading, toggleConcluida, createTarefa, deleteTarefa } = useTarefas();
  const askConfirm = useConfirm();
  const confirmDelete = async (id: string) => {
    if (await askConfirm({ title: "Excluir tarefa", description: "Esta ação não pode ser desfeita.", destructive: true, confirmText: "Excluir" })) {
      await deleteTarefa(id);
    }
  };
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterMember, setFilterMember] = useState<string>("todos");
  const [form, setForm] = useState({ titulo: "", descricao: "", responsavel_id: "", data_vencimento: "" });
  const [contratos, setContratos] = useState<ContratoVencimento[]>([]);
  const [advbox, setAdvbox] = useState<AdvboxEvento[]>([]);
  const { syncAgenda, loading: advboxLoading } = useAdvboxSync();

  // Load vencimentos
  useEffect(() => {
    if (!user) return;
    const loadContratos = async () => {
      const { data } = await lerTudo(() => supabase
        .from("contratos_vencimentos")
        .select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_parcela, valor_total_operacao"));
      if (data) setContratos(data as ContratoVencimento[]);
    };
    loadContratos();
  }, [user]);

  const loadAdvbox = async () => {
    const { data } = await supabase
      .from("advbox_agenda")
      .select("id, advbox_id, data, hora, titulo, descricao, cliente_nome, responsavel_id, responsavel_email, status, concluida")
      .order("data", { ascending: true });
    if (data) setAdvbox(data as AdvboxEvento[]);
  };

  useEffect(() => {
    if (!user) return;
    loadAdvbox();
  }, [user]);

  const handleSyncAdvbox = async () => {
    try {
      await syncAgenda();
      await loadAdvbox();
    } catch {
      // toast handled inside hook
    }
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const filteredTarefas = useMemo(() => {
    return tarefas.filter(t => {
      if (filterMember !== "todos" && t.responsavel_id !== filterMember) return false;
      return true;
    });
  }, [tarefas, filterMember]);

  const filteredAdvbox = useMemo(() => {
    return advbox.filter(a => {
      if (filterMember !== "todos" && a.responsavel_id !== filterMember) return false;
      return true;
    });
  }, [advbox, filterMember]);

  const tarefasByDate = useMemo(() => {
    const map = new Map<string, Tarefa[]>();
    filteredTarefas.forEach(t => {
      const key = t.data_vencimento;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filteredTarefas]);

  const vencimentosByDate = useMemo(() => {
    const map = new Map<string, ContratoVencimento[]>();
    contratos.forEach(c => {
      if (!c.vencimento_proxima_parcela) return;
      const key = c.vencimento_proxima_parcela;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [contratos]);

  const advboxByDate = useMemo(() => {
    const map = new Map<string, AdvboxEvento[]>();
    filteredAdvbox.forEach(a => {
      const key = a.data;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [filteredAdvbox]);

  const todayStr = new Date().toISOString().split("T")[0];

  const selectedTarefas = selectedDate ? (tarefasByDate.get(selectedDate) || []) : [];
  const selectedVencimentos = selectedDate ? (vencimentosByDate.get(selectedDate) || []) : [];
  const selectedAdvbox = selectedDate ? (advboxByDate.get(selectedDate) || []) : [];

  const handleCreate = async () => {
    if (!form.titulo || !form.responsavel_id || !form.data_vencimento || !orgId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const { error } = await createTarefa({
      organizacao_id: orgId,
      processo_id: null,
      fase: null,
      responsavel_id: form.responsavel_id,
      titulo: form.titulo,
      descricao: form.descricao || null,
      data_vencimento: form.data_vencimento,
      concluida: false,
    });
    if (error) toast.error("Erro ao criar tarefa");
    else {
      toast.success("Tarefa criada");
      setShowCreate(false);
      setForm({ titulo: "", descricao: "", responsavel_id: "", data_vencimento: "" });
    }
  };

  const handleCreateFromVencimento = (c: ContratoVencimento) => {
    const valor = c.valor_parcela
      ? `R$ ${c.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : c.valor_total_operacao
      ? `R$ ${c.valor_total_operacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "";
    setForm({
      titulo: `Vencimento: ${c.nome_cliente} - ${c.banco || ""}`,
      descricao: `Contrato ${c.numero_contrato || "s/n"}${valor ? ` · Valor: ${valor}` : ""}`,
      responsavel_id: "",
      data_vencimento: c.vencimento_proxima_parcela || selectedDate || "",
    });
    setShowCreate(true);
  };

  const getMemberName = (id: string) => members.find(m => m.user_id === id)?.nome || "Membro";

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthLabel = currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <AppLayout>
      <PageHeader
        icon={CalendarDays}
        title="Agenda"
        backTo="/"
        breadcrumb={[{ label: "Agro" }, { label: "Agenda" }]}
        actions={
          <div className="flex gap-2">
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por membro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os membros</SelectItem>
              {members.map(m => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.nome || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleSyncAdvbox}
              disabled={advboxLoading}
              title="Importar compromissos do Advbox"
            >
              <RefreshCw className={cn("w-4 h-4 mr-1", advboxLoading && "animate-spin")} />
              {advboxLoading ? "Sincronizando..." : "Sincronizar Advbox"}
            </Button>
          )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="lg:col-span-2 bg-card rounded-lg shadow-card border border-border">
          {/* Month nav */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="text-sm font-semibold text-foreground capitalize">{monthLabel}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-border/50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTarefas = tarefasByDate.get(dateStr) || [];
              const dayVencimentos = vencimentosByDate.get(dateStr) || [];
              const dayAdvbox = advboxByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const pendentes = dayTarefas.filter(t => !t.concluida).length;
              const concluidas = dayTarefas.filter(t => t.concluida).length;
              const vencCount = dayVencimentos.length;
              const advCount = dayAdvbox.length;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "min-h-[80px] p-1.5 border-b border-r border-border/50 text-left transition-colors hover:bg-secondary/50",
                    isSelected && "bg-accent/10 ring-1 ring-accent",
                    isToday && !isSelected && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : "text-foreground"
                  )}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {vencCount > 0 && (
                      <div className="text-[10px] bg-destructive/15 text-destructive rounded px-1 truncate flex items-center gap-0.5">
                        <Banknote className="w-2.5 h-2.5 shrink-0" />
                        {vencCount} venc.
                      </div>
                    )}
                    {advCount > 0 && (
                      <div className="text-[10px] bg-primary/15 text-primary rounded px-1 truncate flex items-center gap-0.5">
                        <Briefcase className="w-2.5 h-2.5 shrink-0" />
                        {advCount} Advbox
                      </div>
                    )}
                    {pendentes > 0 && (
                      <div className="text-[10px] bg-accent/20 text-accent rounded px-1 truncate">
                        {pendentes} pendente{pendentes > 1 ? "s" : ""}
                      </div>
                    )}
                    {concluidas > 0 && (
                      <div className="text-[10px] bg-success/20 text-success rounded px-1 truncate">
                        {concluidas} concluída{concluidas > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Day detail sidebar */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-accent" />
              {selectedDate
                ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
                : "Selecione um dia"}
            </h3>
          </div>

          {!selectedDate ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Clique em um dia do calendário para ver as tarefas e vencimentos.
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {/* Vencimentos do dia */}
              {selectedVencimentos.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-destructive/5 border-b border-border">
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5" />
                      Vencimentos ({selectedVencimentos.length})
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {selectedVencimentos.map(c => (
                      <div key={c.id} className="p-3 flex gap-2">
                        <Banknote className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.nome_cliente}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.banco || "—"} · {c.numero_contrato || "s/n"}
                            {c.valor_parcela && (
                              <> · <span className="font-medium">R$ {c.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></>
                            )}
                          </p>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleCreateFromVencimento(c)}
                            className="text-[10px] text-accent hover:underline shrink-0 flex items-center gap-0.5"
                            title="Criar tarefa a partir deste vencimento"
                          >
                            <Plus className="w-3 h-3" /> Tarefa
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tarefas do dia */}
              {selectedTarefas.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-accent/5 border-b border-t border-border">
                    <p className="text-xs font-semibold text-accent flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tarefas ({selectedTarefas.length})
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {selectedTarefas.map(t => (
                      <div key={t.id} className="p-3 flex gap-2">
                        <button
                          onClick={() => toggleConcluida(t.id, !t.concluida)}
                          className="mt-0.5 shrink-0"
                        >
                          {t.concluida
                            ? <CheckCircle2 className="w-4 h-4 text-success" />
                            : <Circle className="w-4 h-4 text-muted-foreground hover:text-accent transition-colors" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", t.concluida && "line-through text-muted-foreground")}>{t.titulo}</p>
                          {t.descricao && <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>}
                          <div className="flex items-center gap-1 mt-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">{getMemberName(t.responsavel_id)}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <button onClick={() => confirmDelete(t.id)} className="p-1 hover:bg-destructive/10 rounded shrink-0">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compromissos Advbox do dia */}
              {selectedAdvbox.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-primary/5 border-b border-t border-border">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" />
                      Advbox ({selectedAdvbox.length})
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {selectedAdvbox.map(a => (
                      <div key={a.id} className="p-3 flex gap-2">
                        <Briefcase className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", a.concluida && "line-through text-muted-foreground")}>
                            {a.hora && <span className="text-muted-foreground mr-1">{a.hora}</span>}
                            {a.titulo}
                          </p>
                          {a.cliente_nome && (
                            <p className="text-xs text-muted-foreground">Cliente: {a.cliente_nome}</p>
                          )}
                          {a.descricao && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.descricao}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              {a.responsavel_id
                                ? getMemberName(a.responsavel_id)
                                : a.responsavel_email || "Sem responsável vinculado"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {selectedTarefas.length === 0 && selectedVencimentos.length === 0 && selectedAdvbox.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma tarefa ou vencimento para este dia.
                  {isAdmin && (
                    <button
                      onClick={() => { setForm(f => ({ ...f, data_vencimento: selectedDate })); setShowCreate(true); }}
                      className="block mx-auto mt-2 text-accent hover:underline text-xs"
                    >
                      + Criar tarefa
                    </button>
                  )}
                </div>
              )}

              {/* Create from day */}
              {(selectedTarefas.length > 0 || selectedVencimentos.length > 0 || selectedAdvbox.length > 0) && isAdmin && (
                <div className="p-3 border-t border-border">
                  <button
                    onClick={() => { setForm(f => ({ ...f, data_vencimento: selectedDate! })); setShowCreate(true); }}
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Criar tarefa para este dia
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create task dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Enviar notificação ao banco" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes da tarefa..." rows={3} />
            </div>
            <div>
              <Label>Responsável *</Label>
              <Select value={form.responsavel_id} onValueChange={v => setForm(f => ({ ...f, responsavel_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.nome || "Sem nome"} ({m.papel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de vencimento *</Label>
              <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} className="bg-accent text-accent-foreground hover:bg-accent/90">Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
