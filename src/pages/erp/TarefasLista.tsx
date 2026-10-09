import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Circle, Eye, EyeOff, Lock, Star } from "lucide-react";
import type { Tarefa } from "@/lib/api/tarefas";

/** Coluna do marcador: clique troca na hora (otimista) e volta se a API negar. */
type Marcador = "importante" | "urgente" | "lido";

export interface TabelaTarefasProps {
  /** O conjunto carregado; a pagina e so recorte em memoria (a carga traz ate 200). */
  tarefas: Tarefa[];
  pagina: number;
  porPagina: number;
  onPagina: (pagina: number) => void;
  onPorPagina: (quantidade: number) => void;
  onAbrir: (tarefa: Tarefa) => void;
  onAlternar: (tarefa: Tarefa, concluida: boolean) => void;
  onMarcar: (tarefa: Tarefa, campo: Marcador, valor: boolean) => void;
  nomeDeResponsavel: (userId: string) => string;
}

const HOJE = new Date().toISOString().split("T")[0];

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

/** "2026-10-13T10:30:00Z" -> "13/10/2026 07:30" (ou o horario local). */
function compromissoBr(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return `${data.toLocaleDateString("pt-BR")} ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Lista de tarefas no padrão ADVBOX (`docs/exemplo-detalhado-tarefa.html`): uma tabela
 * com os quatro marcadores clicaveis (Resolvido, Importante, Urgente, Lido), o titulo
 * com o cliente, as DUAS datas (Data compromisso e Prazo fatal), o responsavel e
 * paginacao — em vez de secoes ou cards.
 *
 * A linha inteira abre o drawer de detalhe; os marcadores param a propagacao para nao
 * abrir junto. Linha atrasada ganha o fundo vermelho, como o `.late` do legado.
 */
export function TabelaTarefas({
  tarefas, pagina, porPagina, onPagina, onPorPagina, onAbrir, onAlternar, onMarcar, nomeDeResponsavel,
}: TabelaTarefasProps) {
  const inicio = pagina * porPagina;
  const visiveis = tarefas.slice(inicio, inicio + porPagina);
  const total = tarefas.length;
  const ultima = Math.max(0, Math.ceil(total / porPagina) - 1);
  const de = total === 0 ? 0 : inicio + 1;
  const ate = Math.min(inicio + porPagina, total);

  return (
    <div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left w-10" title="Resolvido">OK</th>
              <th className="px-3 py-2.5 text-left w-12" title="Importante">Imp</th>
              <th className="px-3 py-2.5 text-left w-14" title="Urgente">Urg</th>
              <th className="px-3 py-2.5 text-left w-12" title="Lido">Lido</th>
              <th className="px-3 py-2.5 text-left">Tarefa</th>
              <th className="px-3 py-2.5 text-left">Cliente</th>
              <th className="px-3 py-2.5 text-left whitespace-nowrap">Data compromisso</th>
              <th className="px-3 py-2.5 text-left whitespace-nowrap">Prazo fatal</th>
              <th className="px-3 py-2.5 text-left">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((tarefa) => {
              const prazoFatal = tarefa.prazoFatal ?? tarefa.dataVencimento;
              const atrasada = !tarefa.concluida && prazoFatal < HOJE;
              const hoje = !tarefa.concluida && prazoFatal === HOJE;
              const urgente = tarefa.prioridade === "urgente";
              return (
                <tr
                  key={tarefa.id}
                  onClick={() => onAbrir(tarefa)}
                  className={`border-t cursor-pointer transition-colors hover:bg-secondary/40 ${
                    atrasada ? "bg-destructive/5" : ""
                  } ${tarefa.concluida ? "opacity-70" : ""}`}
                >
                  <td className="px-3 py-2.5" title={tarefa.concluida ? "Reabrir tarefa" : "Marcar como resolvida"}>
                    <button
                      type="button"
                      onClick={(evento) => { evento.stopPropagation(); onAlternar(tarefa, !tarefa.concluida); }}
                      aria-label={tarefa.concluida ? "Reabrir tarefa" : "Marcar como resolvida"}
                      className="shrink-0"
                    >
                      {tarefa.concluida ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground hover:text-accent transition-colors" />
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-2.5" title={tarefa.importante ? "Importante" : "Marcar como importante"}>
                    <button
                      type="button"
                      onClick={(evento) => { evento.stopPropagation(); onMarcar(tarefa, "importante", !tarefa.importante); }}
                      aria-label="Importante"
                    >
                      <Star
                        className={`w-4 h-4 transition-colors ${
                          tarefa.importante ? "text-warning fill-warning" : "text-muted-foreground hover:text-warning"
                        }`}
                      />
                    </button>
                  </td>

                  <td className="px-3 py-2.5" title={urgente ? "Urgente" : "Marcar como urgente"}>
                    <button
                      type="button"
                      onClick={(evento) => { evento.stopPropagation(); onMarcar(tarefa, "urgente", !urgente); }}
                      aria-label="Urgente"
                    >
                      <AlertTriangle
                        className={`w-4 h-4 transition-colors ${
                          urgente ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                        }`}
                      />
                    </button>
                  </td>

                  <td className="px-3 py-2.5" title={tarefa.lido ? "Nao lida" : "Marcar como lida"}>
                    <button
                      type="button"
                      onClick={(evento) => { evento.stopPropagation(); onMarcar(tarefa, "lido", !tarefa.lido); }}
                      aria-label="Lido"
                    >
                      {tarefa.lido ? (
                        <Eye className="w-4 h-4 text-accent" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground hover:text-accent transition-colors" />
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-2.5 min-w-[22rem] max-w-[40rem]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium truncate ${
                          tarefa.concluida ? "line-through text-muted-foreground" : ""
                        }`}
                        title={tarefa.descricao || tarefa.titulo}
                      >
                        {tarefa.titulo}
                      </span>
                      {tarefa.privada && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="Privada" />}
                    </div>
                    {tarefa.descricao && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{tarefa.descricao}</p>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {tarefa.nomeCliente ? (
                      <span className="text-accent font-medium truncate block max-w-[18rem]" title={tarefa.nomeCliente}>
                        {tarefa.nomeCliente}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {tarefa.dataCompromisso ? (
                      <span title={tarefa.dataCompromisso}>{compromissoBr(tarefa.dataCompromisso)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={atrasada ? "text-destructive font-medium" : hoje ? "text-warning font-medium" : ""}
                      title={tarefa.prazoFatal ? undefined : `Sem prazo fatal — vale o vencimento ${dataBr(tarefa.dataVencimento)}`}
                    >
                      {dataBr(prazoFatal)}
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span className="w-6 h-6 rounded-full bg-secondary grid place-items-center text-[10px] font-semibold">
                        {nomeDeResponsavel(tarefa.responsavelId).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs">{nomeDeResponsavel(tarefa.responsavelId)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nada nesta página.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacao, no formato do DataTable do legado: "1-50 de 55" + registros por pagina */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm text-muted-foreground">
        <span>
          {de}–{ate} de {total}
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            Registros por página
            <select
              value={porPagina}
              onChange={(evento) => onPorPagina(Number(evento.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
            >
              {[25, 50, 100, 200].map((opcao) => (
                <option key={opcao} value={opcao}>{opcao}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPagina(Math.max(0, pagina - 1))}
              disabled={pagina === 0}
              aria-label="Página anterior"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-input disabled:opacity-40 hover:bg-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPagina(Math.min(ultima, pagina + 1))}
              disabled={pagina >= ultima}
              aria-label="Próxima página"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-input disabled:opacity-40 hover:bg-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
