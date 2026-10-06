
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Users,
  Scale,
  ListTodo,
  Loader2,
  Zap,
  Activity,
} from "lucide-react";
import { useAdvboxSync } from "@/hooks/useAdvboxSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AdvboxIntegration() {
  const {
    loading,
    connected,
    syncLogs,
    testConnection,
    syncAll,
    syncCustomers,
    syncLawsuits,
    syncTasks,
    fetchLogs,
  } = useAdvboxSync();

  const [syncingMovs, setSyncingMovs] = useState(false);
  const [conferindo, setConferindo] = useState<"previa" | "auditoria" | null>(null);
  const [previa, setPrevia] = useState<any[] | null>(null);
  const [auditoria, setAuditoria] = useState<any[] | null>(null);
  const [auditoriaOutras, setAuditoriaOutras] = useState<any[] | null>(null);
  const [semNumero, setSemNumero] = useState(0);
  const [casando, setCasando] = useState(false);

  const contarSemNumero = async () => {
    const { count } = await supabase
      .from("advbox_tarefas_criadas")
      .select("id", { count: "exact", head: true })
      .is("advbox_post_id", null);
    setSemNumero(count ?? 0);
  };

  const casarNumeros = async () => {
    setCasando(true);
    try {
      const { data, error } = await supabase.functions.invoke("advbox-sync", {
        body: { action: "casar_post_ids" },
      });
      if (error) throw error;
      const d = (data as any)?.data ?? data;
      toast.success(
        `${d?.casadas ?? 0} tarefa(s) com número recuperado; ${d?.ainda_sem_numero ?? 0} ainda sem número.`,
      );
      contarSemNumero();
    } catch (e: any) {
      toast.error("Não foi possível buscar os números", { description: e?.message || String(e) });
    } finally {
      setCasando(false);
    }
  };

  const dataBr = (iso?: string | null) =>
    iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "-";

  const rodarConferencia = async (modo: "previa" | "auditoria") => {
    setConferindo(modo);
    try {
      const body =
        modo === "previa"
          ? { action: "sync_tarefas", params: { dry_run: true } }
          : { action: "auditoria_datas", params: {} };
      const { data, error } = await supabase.functions.invoke("advbox-sync", { body });
      if (error) throw error;
      if (modo === "previa") {
        setPrevia(((data as any)?.tarefas ?? []) as any[]);
        setAuditoria(null);
        setAuditoriaOutras(null);
      } else {
        setAuditoria(((data as any)?.tarefas ?? []) as any[]);
        setAuditoriaOutras(((data as any)?.tarefas_outras_areas ?? []) as any[]);
        setPrevia(null);
      }
    } catch (e: any) {
      toast.error("Não foi possível conferir", { description: e?.message || String(e) });
    } finally {
      setConferindo(null);
    }
  };

  const syncMovementsAll = async () => {
    setSyncingMovs(true);
    try {
      const { data, error } = await supabase.functions.invoke("advbox-sync", {
        body: { action: "sync_movements" }, // sem processo_id = todos da org do usuário
      });
      if (error) throw error;
      const procs = (data as any)?.processos_sincronizados ?? 0;
      const novos = (data as any)?.andamentos_novos ?? 0;
      toast.success(`${procs} processo(s) sincronizado(s), ${novos} novo(s) andamento(s).`);
      fetchLogs();
    } catch (e: any) {
      toast.error("Erro ao sincronizar andamentos", { description: e?.message || String(e) });
    } finally {
      setSyncingMovs(false);
    }
  };

  useEffect(() => {
    testConnection();
    fetchLogs();
    contarSemNumero();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Status Card */}
      <div className="bg-card rounded-lg border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Advbox</h3>
              <p className="text-xs text-muted-foreground">
                Sistema jurídico integrado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected === null ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
              </span>
            ) : connected ? (
              <span className="text-xs text-success flex items-center gap-1.5 bg-success/10 px-2.5 py-1 rounded-full font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
              </span>
            ) : (
              <span className="text-xs text-destructive flex items-center gap-1.5 bg-destructive/10 px-2.5 py-1 rounded-full font-medium">
                <XCircle className="w-3.5 h-3.5" /> Desconectado
              </span>
            )}
            <button
              onClick={testConnection}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors"
              title="Testar conexão"
            >
              <RefreshCw
                className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Sincronize clientes, processos e tarefas entre o Oliveira Agro App e o
          Advbox automaticamente.
        </p>

        {/* Sync Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            onClick={syncAll}
            disabled={loading || !connected}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors disabled:opacity-40"
          >
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-xs font-medium text-foreground">Tudo</span>
          </button>
          <button
            onClick={syncCustomers}
            disabled={loading || !connected}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors disabled:opacity-40"
          >
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Clientes</span>
          </button>
          <button
            onClick={syncLawsuits}
            disabled={loading || !connected}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors disabled:opacity-40"
          >
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Processos</span>
          </button>
          <button
            onClick={syncTasks}
            disabled={loading || !connected}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors disabled:opacity-40"
          >
            <ListTodo className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Tarefas</span>
          </button>
          <button
            onClick={syncMovementsAll}
            disabled={syncingMovs || !connected}
            title="Sincroniza andamentos de TODOS os processos vinculados ao ADVBOX da sua organização"
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            {syncingMovs ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <Activity className="w-4 h-4 text-primary" />
            )}
            <span className="text-xs font-medium text-foreground">Andamentos</span>
          </button>
        </div>

        {semNumero > 0 && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-xs text-foreground">
              {semNumero} tarefa(s) foram criadas no ADVBOX sem guardar o número aqui. Sem esse
              número não dá para apontar qual tarefa concluir quando uma data muda.
            </p>
            <button
              onClick={casarNumeros}
              disabled={casando || !connected}
              className="mt-2 text-xs font-medium px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary/50 disabled:opacity-40"
            >
              {casando ? "Buscando no ADVBOX..." : "Buscar os números no ADVBOX"}
            </button>
          </div>
        )}


        {/* Conferência de datas */}
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground mb-1">Conferência de datas</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Veja a próxima rodada antes de criar qualquer tarefa e as que já foram criadas com data
            em sábado, domingo ou feriado (essas precisam ser corrigidas na tela do ADVBOX).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => rodarConferencia("previa")}
              disabled={!!conferindo || !connected}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-secondary/50 disabled:opacity-40"
            >
              {conferindo === "previa" ? "Conferindo..." : "Conferir próxima rodada"}
            </button>
            <button
              onClick={() => rodarConferencia("auditoria")}
              disabled={!!conferindo || !connected}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-secondary/50 disabled:opacity-40"
            >
              {conferindo === "auditoria" ? "Conferindo..." : "Tarefas em dia não útil"}
            </button>
          </div>

          {previa && (
            <div className="mt-3 overflow-x-auto">
              {previa.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nada a criar na próxima rodada.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-1 pr-3">Tarefa</th>
                      <th className="py-1 pr-3">Cliente</th>
                      <th className="py-1 pr-3">Banco</th>
                      <th className="py-1 pr-3">Responsável</th>
                      <th className="py-1 pr-3">Data do evento</th>
                      <th className="py-1">Prazo fatal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.map((t, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1 pr-3">{t.tipo ?? "-"}</td>
                        <td className="py-1 pr-3">{t.cliente ?? "-"}</td>
                        <td className="py-1 pr-3">{t.banco ?? "-"}</td>
                        <td className="py-1 pr-3">{t.responsavel ?? t.users_id ?? "-"}</td>
                        <td className="py-1 pr-3">{dataBr(t.data_evento)}</td>
                        <td className="py-1">{t.date_deadline ?? dataBr(t.prazo_fatal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {auditoria && (
            <div className="mt-3 overflow-x-auto">
              <p className="text-xs font-semibold text-foreground mb-1">
                Criadas pela integração — corrigir na tela do ADVBOX
              </p>
              {auditoria.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma tarefa com data em dia não útil.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-1 pr-3">Tarefa</th>
                      <th className="py-1 pr-3">Processo</th>
                      <th className="py-1 pr-3">Responsável</th>
                      <th className="py-1 pr-3">Data do evento</th>
                      <th className="py-1 pr-3">Prazo fatal</th>
                      <th className="py-1">Sugestão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoria.map((t, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1 pr-3">{t.tarefa ?? "-"}</td>
                        <td className="py-1 pr-3">{t.processo ?? "-"}</td>
                        <td className="py-1 pr-3">{t.responsaveis ?? "-"}</td>
                        <td className="py-1 pr-3">{t.data_evento ?? "-"}</td>
                        <td className="py-1 pr-3">{t.prazo_fatal ?? "-"}</td>
                        <td className="py-1">
                          {t.sugestao_data_evento ?? "-"} / {t.sugestao_prazo_fatal ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {auditoriaOutras && auditoriaOutras.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <p className="text-xs font-semibold text-foreground mb-1">
                De outras áreas do escritório — apenas aviso
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Não são da integração e podem estar nessa data de propósito.
              </p>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-3">Tarefa</th>
                    <th className="py-1 pr-3">Processo</th>
                    <th className="py-1 pr-3">Responsável</th>
                    <th className="py-1 pr-3">Data do evento</th>
                    <th className="py-1">Prazo fatal</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoriaOutras.map((t, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1 pr-3">{t.tarefa ?? "-"}</td>
                      <td className="py-1 pr-3">{t.processo ?? "-"}</td>
                      <td className="py-1 pr-3">{t.responsaveis ?? "-"}</td>
                      <td className="py-1 pr-3">{t.data_evento ?? "-"}</td>
                      <td className="py-1">{t.prazo_fatal ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando...
          </div>
        )}
      </div>

      {/* Sync Logs */}
      {syncLogs.length > 0 && (
        <div className="bg-card rounded-lg border border-border shadow-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Histórico de Sincronizações
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/30 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      log.status === "concluido"
                        ? "bg-success"
                        : log.status === "erro"
                          ? "bg-destructive"
                          : "bg-warning"
                    }`}
                  />
                  <span className="font-medium text-foreground capitalize">
                    {log.tipo_sync === "all"
                      ? "Completa"
                      : log.tipo_sync === "list_customers"
                        ? "Clientes"
                        : log.tipo_sync === "list_lawsuits"
                          ? "Processos"
                          : log.tipo_sync === "list_posts"
                            ? "Tarefas"
                            : log.tipo_sync === "movements"
                              ? "Andamentos"
                              : log.tipo_sync === "movements_cron"
                                ? "Andamentos (auto)"
                                : log.tipo_sync}
                  </span>
                  <span className="text-muted-foreground">
                    {log.registros_sincronizados} registros
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {format(new Date(log.created_at), "dd/MM HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
