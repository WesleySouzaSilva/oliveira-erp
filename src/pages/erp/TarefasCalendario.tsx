import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tarefa } from "@/lib/api/tarefas";

/**
 * Calendario mensal interativo do Quadro de Tarefas — a `simple-calendar` do exemplo do
 * ADVBOX (`docs/exemplo-quadro-tarefas.html`):
 *
 * - cabecalho `◀ Outubro 2026 [45] ▶` com o total de tarefas pendentes;
 * - grade Dom..Sáb com os dias do mes anterior/proximo esmaecidos;
 * - todo dia com tarefa ganha contagem (tooltip "N tarefas") e um marcador por tarefa;
 * - o dia de hoje fica destacado; dias atrasados ganham marcador vermelho;
 * - clicar num dia abre a lista do dia (o painel "N Eventos / Fechar" do legado).
 *
 * Conta so as PENDENTES, como a barra de total do legado. A data usada e o prazo fatal
 * (ou, na falta dele, o vencimento) — e o que dispara o alerta por dia.
 */
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const HOJE_ISO = new Date().toISOString().split("T")[0];

/** Data que marca o dia da tarefa: prazo fatal, ou o vencimento se nao houver prazo. */
const prazoDaTarefa = (tarefa: Tarefa) => tarefa.prazoFatal ?? tarefa.dataVencimento;

const chaveDoDia = (dia: Date) => format(dia, "yyyy-MM-dd");

export function CalendarioTarefas({
  tarefas, onAbrir, onNova,
}: {
  tarefas: Tarefa[];
  onAbrir: (tarefa: Tarefa) => void;
  /** Abre o form de nova tarefa com o vencimento ja no dia indicado (ou hoje). */
  onNova: (data: string) => void;
}) {
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  const pendentes = useMemo(() => tarefas.filter((tarefa) => !tarefa.concluida), [tarefas]);

  /** prazo (yyyy-MM-dd) -> tarefas daquele dia */
  const porDia = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>();
    pendentes.forEach((tarefa) => {
      const dia = prazoDaTarefa(tarefa);
      const lista = mapa.get(dia);
      if (lista) lista.push(tarefa);
      else mapa.set(dia, [tarefa]);
    });
    return mapa;
  }, [pendentes]);

  const primeiroDia = startOfWeek(startOfMonth(mes));
  const ultimoDia = startOfWeek(endOfMonth(mes), { weekStartsOn: 0 });
  const celulas: Date[] = [];
  for (let dia = primeiroDia; dia <= ultimoDia; dia = addDays(dia, 1)) celulas.push(dia);

  const totalDoMes = useMemo(() => {
    let total = 0;
    porDia.forEach((lista, dia) => {
      if (dia >= format(startOfMonth(mes), "yyyy-MM-dd") && dia <= format(endOfMonth(mes), "yyyy-MM-dd")) {
        total += lista.length;
      }
    });
    return total;
  }, [porDia, mes]);

  const tarefasDoDiaAberto = diaAberto ? porDia.get(diaAberto) ?? [] : [];
  const diaAbertoDate = diaAberto ? new Date(`${diaAberto}T12:00:00`) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-lg border bg-card">
        {/* cabecalho: mes + total + navegacao */}
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMes((atual) => addMonths(atual, -1))}
              aria-label="Mês anterior"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold capitalize flex items-center gap-2">
              {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
              <span
                className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium"
                title="Tarefas pendentes neste mês"
              >
                {totalDoMes}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setMes((atual) => addMonths(atual, 1))}
              aria-label="Próximo mês"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMes(startOfMonth(new Date()))}
            className="text-xs text-accent font-medium hover:underline"
          >
            Hoje
          </button>
        </div>

        {/* semana */}
        <div className="grid grid-cols-7 border-b text-[11px] uppercase tracking-wide text-muted-foreground">
          {DIAS_SEMANA.map((nome) => (
            <div key={nome} className="px-2 py-2 text-center font-medium">
              {nome}
            </div>
          ))}
        </div>

        {/* grade */}
        <div className="grid grid-cols-7">
          {celulas.map((dia) => {
            const chave = chaveDoDia(dia);
            const lista = porDia.get(chave) ?? [];
            const outroMes = !isSameMonth(dia, mes);
            const hoje = isSameDay(dia, new Date());
            const atrasado = chave < HOJE_ISO && lista.length > 0;
            const selecionado = diaAberto === chave;
            return (
              <button
                key={chave}
                type="button"
                onClick={() => setDiaAberto(selecionado ? null : chave)}
                className={`min-h-[4.5rem] border-r border-b p-1.5 text-left align-top transition-colors ${
                  outroMes ? "opacity-40" : ""
                } ${selecionado ? "bg-accent/10" : "hover:bg-secondary/60"}`}
                title={lista.length > 0 ? `${lista.length} tarefa(s) neste dia` : undefined}
              >
                <span
                  className={`inline-flex items-baseline gap-1 text-xs font-medium ${
                    hoje
                      ? "px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold"
                      : atrasado
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {format(dia, "d")}
                  {lista.length > 0 && <b className="text-[10px]">{lista.length}</b>}
                </span>

                <span className="flex flex-wrap gap-1 mt-1">
                  {lista.slice(0, 6).map((tarefa) => {
                    const prazo = prazoDaTarefa(tarefa);
                    const tom =
                      prazo < HOJE_ISO ? "bg-destructive" : prazo === HOJE_ISO ? "bg-warning" : "bg-accent/70";
                    return <i key={tarefa.id} className={`block w-2 h-2 rounded-full ${tom}`} title={tarefa.titulo} />;
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* painel do dia (o "N Eventos / Fechar" do legado) */}
      <aside className="rounded-lg border bg-card self-start">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {diaAbertoDate ? (
              <>
                {format(diaAbertoDate, "dd/MM/yyyy", { locale: ptBR })}
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {tarefasDoDiaAberto.length} {tarefasDoDiaAberto.length === 1 ? "tarefa" : "tarefas"}
                </span>
              </>
            ) : (
              "Escolha um dia"
            )}
          </h3>
          {diaAberto && (
            <button
              type="button"
              onClick={() => setDiaAberto(null)}
              aria-label="Fechar"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="divide-y max-h-96 overflow-y-auto">
          {!diaAberto && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Clique num dia com marcador para ver as tarefas.
            </p>
          )}
          {diaAberto && tarefasDoDiaAberto.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Nenhuma tarefa com prazo neste dia.
            </p>
          )}
          {tarefasDoDiaAberto.map((tarefa) => (
            <button
              key={tarefa.id}
              type="button"
              onClick={() => onAbrir(tarefa)}
              className="w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors"
            >
              <p className="text-sm font-medium truncate">{tarefa.titulo}</p>
              {tarefa.nomeCliente && (
                <p className="text-[11px] text-accent font-medium mt-0.5">Cliente: {tarefa.nomeCliente}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {tarefa.prazoFatal ? "Prazo fatal" : "Vencimento"} {format(new Date(`${prazoDaTarefa(tarefa)}T12:00:00`), "dd/MM/yyyy")}
                {tarefa.prioridade === "urgente" && (
                  <span className="ml-2 text-destructive font-semibold uppercase text-[9px]">urgente</span>
                )}
              </p>
            </button>
          ))}
        </div>

        <div className="p-3 border-t">
          <Button size="sm" className="w-full" onClick={() => onNova(diaAberto ?? HOJE_ISO)}>
            Nova tarefa neste dia
          </Button>
        </div>
      </aside>
    </div>
  );
}
