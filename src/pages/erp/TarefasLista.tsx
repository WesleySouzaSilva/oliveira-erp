import { ChevronLeft, ChevronRight, History, Lock } from "lucide-react";
import type { Tarefa } from "@/lib/api/tarefas";
import { Badge } from "@/components/ui/badge";
import { corDePrioridade } from "@/lib/prioridade";

export interface TabelaTarefasProps {
  /** O conjunto carregado; a pagina e so recorte em memoria (a carga traz ate 200). */
  tarefas: Tarefa[];
  pagina: number;
  porPagina: number;
  onPagina: (pagina: number) => void;
  onPorPagina: (quantidade: number) => void;
  onAbrir: (tarefa: Tarefa) => void;
  /**
   * Botão "Histórico" da linha: abre a JANELA CENTRAL grande com a timeline inteira da
   * tarefa (quem criou/recebeu/encaminhou, recados e anexos).
   */
  onHistorico: (tarefa: Tarefa) => void;
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
 * Lista de tarefas no padrão ADVBOX, atualizada em 16/10/2026 (pedido do titular):
 *
 * - os quatro marcadores antigos (OK, Importante, Urgente, Lido) SAIRAM — o OK virou o
 *   campo **Status** (Aberta/Concluída) no detalhe, e Importante/Urgente/Lido não existem
 *   mais;
 * - Prioridade virou CAMPO DE TEXTO (ex.: "Alta", "Baixa") — coluna própria;
 * - coluna Tarefa enxuta (base 1366x768) para o botão Histórico ficar visível sem rolar.
 *
 * A linha inteira abre a janela central de detalhe; linha atrasada ganha fundo vermelho.
 */
export function TabelaTarefas({
  tarefas, pagina, porPagina, onPagina, onPorPagina, onAbrir, onHistorico, nomeDeResponsavel,
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
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-left">Tarefa</th>
              <th className="px-3 py-2.5 text-left">Cliente</th>
              <th className="px-3 py-2.5 text-left">Prioridade</th>
              <th className="px-3 py-2.5 text-left whitespace-nowrap">Data compromisso</th>
              <th className="px-3 py-2.5 text-left whitespace-nowrap">Prazo fatal</th>
              <th className="px-3 py-2.5 text-left">Responsável</th>
              <th className="px-3 py-2.5 text-left">Histórico</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((tarefa) => {
              const prazoFatal = tarefa.prazoFatal ?? tarefa.dataVencimento;
              const atrasada = !tarefa.concluida && prazoFatal < HOJE;
              const hoje = !tarefa.concluida && prazoFatal === HOJE;
              return (
                <tr
                  key={tarefa.id}
                  onClick={() => onAbrir(tarefa)}
                  className={`border-t cursor-pointer transition-colors hover:bg-secondary/40 ${
                    atrasada ? "bg-destructive/5" : ""
                  } ${tarefa.concluida ? "opacity-70" : ""}`}
                >
                  <td className="px-3 py-2.5">
                    <Badge variant={tarefa.concluida ? "outline" : "secondary"}>
                      {tarefa.concluida ? "Concluída" : "Aberta"}
                    </Badge>
                  </td>

                  {/* Tarefa: coluna enxuta (base 1366x768) — o titulo trunca e o botao
                      Historico da linha fica sempre visivel sem rolar a tabela */}
                  <td className="px-3 py-2.5 min-w-[12rem] max-w-[18rem]">
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
                    {/* Setor que enviou + numero do contrato (16/10/2026): o cliente tem
                        coluna propria e a descricao sai daqui (fica no tooltip do titulo) */}
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {tarefa.setorNome ? `Setor: ${tarefa.setorNome}` : "—"}
                      {tarefa.contratoNumero ? ` · Contrato nº ${tarefa.contratoNumero}` : ""}
                    </p>
                  </td>

                  <td className="px-3 py-2.5">
                    {tarefa.nomeCliente ? (
                      <span className="text-accent font-medium truncate block max-w-[10rem]" title={tarefa.nomeCliente}>
                        {tarefa.nomeCliente}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {tarefa.prioridade ? (
                      <span className={`text-xs capitalize ${corDePrioridade(tarefa.prioridade)}`}>
                        {tarefa.prioridade}
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

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(evento) => { evento.stopPropagation(); onHistorico(tarefa); }}
                      aria-label={`Histórico da tarefa ${tarefa.titulo}`}
                      title="Ver toda a movimentação da tarefa"
                      className="inline-flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <History className="w-3.5 h-3.5" /> Histórico
                    </button>
                  </td>
                </tr>
              );
            })}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
