import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tarefa } from "@/lib/api/tarefas";

/**
 * Calendario de tarefas — reproducao da `.simple-calendar` do exemplo do ADVBOX
 * (`docs/exemplo-quadro-tarefas.html`). Mesma estrutura do original:
 *
 * - `.header`: `◀` + `Mes Ano` + `.total-bar` (total de pendentes) + `▶`, e por baixo a
 *   linha `.day-names` (Dom..Sáb) DENTRO do cabecalho — nao e uma faixa separada;
 * - `.days`: grade de 7 colunas; cada `.day` traz o numero em `<span>` e a contagem em
 *   `<b>` ao lado, com um `.event-single` por tarefa embaixo. Dias de fora do mes ficam
 *   esmaecidos (`.day` sem `.this-month`); o de hoje leva `.today`;
 * - clicar num dia abre `.add-event`: um overlay DENTRO do calendario com `N Eventos`,
 *   a lista do dia e o botao `Fechar` — nao uma coluna ao lado.
 *
 * Conta so as PENDENTES (o `total-bar` do original tambem e de pendentes). A data do dia
 * e o prazo fatal, ou o vencimento quando nao ha prazo.
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

  const inicioMes = format(startOfMonth(mes), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(mes), "yyyy-MM-dd");

  const totalDoMes = useMemo(() => {
    let total = 0;
    porDia.forEach((lista, dia) => {
      if (dia >= inicioMes && dia <= fimMes) total += lista.length;
    });
    return total;
  }, [porDia, inicioMes, fimMes]);

  const tarefasDoDiaAberto = diaAberto ? porDia.get(diaAberto) ?? [] : [];
  const diaAbertoDate = diaAberto ? new Date(`${diaAberto}T12:00:00`) : null;

  return (
    <div className="max-w-[36rem]">
      <div className="relative rounded-lg border bg-card overflow-hidden">
        {/* -------------------- .header (mes + total + navegacao) */}
        <div className="px-3 pt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMes((atual) => addMonths(atual, -1))}
            aria-label="Mês anterior"
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <h3 className="flex items-center gap-2 text-sm font-semibold capitalize">
            {format(mes, "MMMM yyyy", { locale: ptBR })}
            <span
              className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium"
              title="Tarefas pendentes"
            >
              {totalDoMes}
            </span>
          </h3>

          <button
            type="button"
            onClick={() => setMes((atual) => addMonths(atual, 1))}
            aria-label="Próximo mês"
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* -------------------- .day-names (dentro do cabecalho, como no original) */}
        <div className="grid grid-cols-7 mt-2 border-b">
          {DIAS_SEMANA.map((nome) => (
            <h2 key={nome} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-center pb-1.5">
              {nome}
            </h2>
          ))}
        </div>

        {/* -------------------- .days */}
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
                className={`relative min-h-[3.5rem] border-r border-t p-1.5 text-left align-top transition-colors ${
                  outroMes ? "opacity-40" : "hover:bg-secondary/60"
                } ${hoje ? "bg-accent/10" : ""} ${selecionado ? "ring-1 ring-inset ring-accent" : ""}`}
                title={lista.length > 0 ? `${lista.length} tarefas - 0 intimações` : undefined}
              >
                <span
                  className={`inline-flex items-baseline gap-0.5 text-xs leading-none ${
                    hoje
                      ? "px-1.5 py-1 -mx-1.5 -my-1 rounded-full bg-accent text-accent-foreground font-semibold"
                      : atrasado
                      ? "text-destructive font-medium"
                      : "text-foreground"
                  }`}
                >
                  {format(dia, "d")}
                  {lista.length > 0 && <b className="text-[10px] font-semibold">{lista.length}</b>}
                </span>

                <span className="flex flex-wrap gap-1 mt-1.5">
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

        {/* -------------------- .add-event (overlay do dia, dentro do calendario) */}
        {diaAberto && (
          <div className="absolute inset-0 z-20 bg-card/97 flex flex-col">
            <div className="px-4 py-3 border-b flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {tarefasDoDiaAberto.length} Eventos
                </h3>
                <p className="text-xs text-muted-foreground">
                  {diaAbertoDate ? format(diaAbertoDate, "dd/MM/yyyy", { locale: ptBR }) : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiaAberto(null)}
                aria-label="Fechar"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y">
              {tarefasDoDiaAberto.length === 0 && (
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
                    {tarefa.prazoFatal ? "Prazo fatal" : "Vencimento"}{" "}
                    {format(new Date(`${prazoDaTarefa(tarefa)}T12:00:00`), "dd/MM/yyyy")}
                    {tarefa.prioridade === "urgente" && (
                      <span className="ml-2 text-destructive font-semibold uppercase text-[9px]">urgente</span>
                    )}
                  </p>
                </button>
              ))}
            </div>

            <div className="p-3 border-t flex items-center justify-between gap-2">
              <Button size="sm" onClick={() => onNova(diaAberto ?? HOJE_ISO)}>
                Nova tarefa neste dia
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDiaAberto(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Clique num dia para ver as tarefas daquele dia. O número ao lado da data é a contagem de tarefas
        pendentes (vermelho = atrasada, âmbar = hoje).
      </p>
    </div>
  );
}
