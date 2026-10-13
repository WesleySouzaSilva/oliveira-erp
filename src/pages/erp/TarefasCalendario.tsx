import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Tarefa } from "@/lib/api/tarefas";
import { prazoDaTarefa } from "@/lib/api/tarefas";

/**
 * Calendario de tarefas — reproducao da `.simple-calendar` do ADVBOX dentro da aba
 * Lista (`docs/exemplo-quadro-tarefas.html`).
 *
 * No original o calendario NAO tem aba propria: ele fica num card de 270px no canto
 * direito do topo (`.col-md-small-fixed`), com a tabela embaixo. O plugin e iniciado
 * com `type:"selector"` e, ao clicar num dia, o callback `done` grava a data nos filtros
 * `start_from`/`start_until` e dispara o submit — ou seja, **clique no dia = filtra a
 * tabela abaixo** (o tour oficial dele: "Clicando no dia, você visualiza seus
 * compromissos da data desejada"). Por isso nao ha overlay `.add-event` aqui: esse painel
 * so abre quando o plugin e chamado sem `type`.
 *
 * Fidelidade com o CSS original:
 * - `.header`: `◀` + `Mes Ano` + `.total-bar` (bolinha vermelha com o total de pendentes)
 *   + `▶`, e por baixo a linha `.day-names` (Dom..Sáb) DENTRO do cabecalho;
 * - `.days`: celulas de 34px; o numero fica em `<span>` (circulo) e a contagem do dia em
 *   `<b>` vermelho no canto superior direito do circulo;
 * - hoje = circulo escuro com texto claro; dia de fora do mes esmaecido.
 *
 * A data que marca o dia e a mesma da tabela (`prazoDaTarefa`): prazo fatal, ou o
 * vencimento quando nao ha prazo — assim o badge do calendario e a linha filtrada
 * sempre batem.
 */
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const chaveDoDia = (dia: Date) => format(dia, "yyyy-MM-dd");

export function CalendarioTarefas({
  tarefas,
  diaSelecionado,
  onSelecionar,
  className = "",
}: {
  tarefas: Tarefa[];
  /** `yyyy-MM-dd` escolhido (filtra a tabela abaixo do card) ou `null` = sem filtro. */
  diaSelecionado: string | null;
  onSelecionar: (dia: string | null) => void;
  className?: string;
}) {
  const [mes, setMes] = useState(() => startOfMonth(new Date()));

  const pendentes = useMemo(() => tarefas.filter((tarefa) => !tarefa.concluida), [tarefas]);

  /** prazo (yyyy-MM-dd) -> quantidade de pendentes naquele dia */
  const porDia = useMemo(() => {
    const mapa = new Map<string, number>();
    pendentes.forEach((tarefa) => {
      const dia = prazoDaTarefa(tarefa);
      mapa.set(dia, (mapa.get(dia) ?? 0) + 1);
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
    porDia.forEach((quantidade, dia) => {
      if (dia >= inicioMes && dia <= fimMes) total += quantidade;
    });
    return total;
  }, [porDia, inicioMes, fimMes]);

  const hoje = new Date();

  return (
    <div className={className}>
      <div className="rounded-lg border bg-card px-3 pt-3 pb-2 select-none">
        {/* -------------------- .header: setas + mes + total-bar + day-names */}
        <div className="relative border-b border-transparent">
          <button
            type="button"
            onClick={() => setMes((atual) => addMonths(atual, -1))}
            aria-label="Mês anterior"
            className="absolute right-10 top-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-foreground hover:bg-secondary"
          >
            <ChevronLeft className="w-7 h-7" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setMes((atual) => addMonths(atual, 1))}
            aria-label="Próximo mês"
            className="absolute right-0 top-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-foreground hover:bg-secondary"
          >
            <ChevronRight className="w-7 h-7" strokeWidth={1.5} />
          </button>

          <h1 className="relative inline-block text-[18px] leading-[30px] mb-5 text-foreground capitalize">
            {format(mes, "MMMM yyyy", { locale: ptBR })}
            {totalDoMes > 0 && (
              <span
                className="absolute -right-[15px] top-0 w-3.5 h-3.5 rounded-full bg-[#ff4b4b] text-white text-[8px] leading-[14px] text-center font-normal"
                title="Tarefas pendentes"
              >
                {totalDoMes}
              </span>
            )}
          </h1>

          <div className="grid grid-cols-7 my-[15px] text-center">
            {DIAS_SEMANA.map((nome) => (
              <h2 key={nome} className="text-[13px] leading-5 font-bold text-[#838383] dark:text-muted-foreground">
                {nome}
              </h2>
            ))}
          </div>
        </div>

        {/* -------------------- .days */}
        <div className="grid grid-cols-7">
          {celulas.map((dia) => {
            const chave = chaveDoDia(dia);
            const quantidade = porDia.get(chave) ?? 0;
            const outroMes = !isSameMonth(dia, mes);
            const ehHoje = isSameDay(dia, hoje);
            const selecionado = diaSelecionado === chave;

            return (
              <button
                key={chave}
                type="button"
                onClick={() => onSelecionar(selecionado ? null : chave)}
                disabled={outroMes}
                className={`h-[44px] leading-[44px] ${outroMes ? "opacity-60 cursor-default" : ""}`}
                title={quantidade > 0 ? `${quantidade} tarefas` : undefined}
              >
                <span
                  className={`relative inline-block w-10 h-10 leading-10 rounded-full border border-transparent text-sm font-bold transition-colors ${
                    ehHoje
                      ? "bg-foreground text-background"
                      : selecionado
                      ? "bg-accent text-accent-foreground ring-1 ring-ring"
                      : outroMes
                      ? "text-muted-foreground opacity-70"
                      : "text-[#586069] dark:text-muted-foreground cursor-pointer hover:bg-[#f4f6f9] dark:hover:bg-secondary"
                  }`}
                >
                  {format(dia, "d")}
                  {quantidade > 0 && (
                    <b className="absolute right-0 -top-0.5 inline-block w-3.5 h-3.5 rounded-lg bg-[#ff4b4b] text-white text-[8px] leading-[14px] font-normal">
                      {quantidade}
                    </b>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground mt-1.5">
        Clique num dia para ver só as tarefas dele na tabela abaixo. O número vermelho é a
        contagem de pendentes do dia.
      </p>
    </div>
  );
}
