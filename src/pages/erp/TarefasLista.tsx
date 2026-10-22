import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, Lock, X } from "lucide-react";
import type { Tarefa } from "@/lib/api/tarefas";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
 * Filtro por coluna (Correção 6, 22/10/2026) — LOCAL: `tarefas` já é um recorte de até
 * 200 itens carregado na tela, então filtrar em memória é instantâneo e não mexe na API.
 *
 * Cada campo casa com o TEXTO DA CÉLULA (mais o valor cru, para colar o ISO), sem
 * diferenciar maiúsculas de minúsculas, e todos valem juntos (E) — junto com a busca de
 * texto, o chip do dia do calendário e o card-filtro, que já chegam aplicados em
 * `tarefas`. Cada coluna tem o seu (x) de limpar.
 *
 * A coluna "Tarefa" traz tipo, descrição, setor e contrato na mesma célula, e por ela
 * também se filtra o processo: não há coluna própria até o módulo de processos existir
 * (D5 do plano) — colar o UUID acha a linha.
 */
const FILTROS = [
  { campo: "tarefa", rotulo: "Tarefa", placeholder: "Tipo, descrição...", largura: "w-36" },
  { campo: "cliente", rotulo: "Cliente", placeholder: "Cliente...", largura: "w-32" },
  { campo: "prioridade", rotulo: "Prioridade", placeholder: "Prioridade...", largura: "w-24" },
  { campo: "compromisso", rotulo: "Data compromisso", placeholder: "dd/mm/aaaa", largura: "w-32" },
  { campo: "prazoFatal", rotulo: "Prazo fatal", placeholder: "dd/mm/aaaa", largura: "w-32" },
  { campo: "responsavel", rotulo: "Responsável", placeholder: "Responsável...", largura: "w-32" },
] as const;

type CampoFiltro = (typeof FILTROS)[number]["campo"];
type FiltrosColuna = Record<CampoFiltro, string>;

const FILTROS_VAZIOS: FiltrosColuna = {
  tarefa: "",
  cliente: "",
  prioridade: "",
  compromisso: "",
  prazoFatal: "",
  responsavel: "",
};

/** Texto da célula da coluna (o que a linha mostra + o valor cru) para o `.includes`. */
function textoDaColuna(
  campo: CampoFiltro,
  tarefa: Tarefa,
  nomeDeResponsavel: (userId: string) => string,
): string {
  switch (campo) {
    case "tarefa":
      return [
        tarefa.titulo,
        tarefa.descricao,
        tarefa.tipoNome,
        tarefa.setorNome,
        tarefa.contratoNumero,
        tarefa.processoId,
      ]
        .filter(Boolean)
        .join(" ");
    case "cliente":
      return tarefa.nomeCliente ?? "";
    case "prioridade":
      return tarefa.prioridade ?? "";
    case "compromisso":
      // a célula mostra data + hora; o ISO cru também serve para colar
      return tarefa.dataCompromisso
        ? `${compromissoBr(tarefa.dataCompromisso)} ${tarefa.dataCompromisso}`
        : "";
    case "prazoFatal": {
      // mesma regra da célula: prazo fatal, ou o vencimento quando não há (D6)
      const prazo = tarefa.prazoFatal ?? tarefa.dataVencimento;
      return `${dataBr(prazo)} ${prazo}`;
    }
    case "responsavel":
      return nomeDeResponsavel(tarefa.responsavelId);
    default:
      return "";
  }
}

/** Input pequeno + (x) de limpar — montado dentro de cada `<th>`. */
function InputColuna({
  campo,
  filtros,
  aoMudar,
}: {
  campo: CampoFiltro;
  filtros: FiltrosColuna;
  aoMudar: (campo: CampoFiltro, valor: string) => void;
}) {
  const config = FILTROS.find((item) => item.campo === campo);
  if (!config) return null;
  const valor = filtros[campo];
  return (
    <div className="mt-1.5 flex items-center gap-1">
      <Input
        value={valor}
        onChange={(evento) => aoMudar(campo, evento.target.value)}
        placeholder={config.placeholder}
        aria-label={`Filtrar por ${config.rotulo}`}
        // `normal-case`: o `<tr>` do cabeçalho deixa tudo em caixa alta e o texto
        // digitado no input não deve herdar isso
        className={`h-7 px-2 text-xs normal-case ${config.largura}`}
      />
      {valor !== "" && (
        <button
          type="button"
          onClick={() => aoMudar(campo, "")}
          aria-label={`Limpar filtro de ${config.rotulo}`}
          title={`Limpar filtro de ${config.rotulo}`}
          className="shrink-0 w-5 h-5 inline-grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Lista de tarefas no padrão ADVBOX, atualizada em 16/10/2026 (pedido do titular):
 *
 * - os quatro marcadores antigos (OK, Importante, Urgente, Lido) SAIRAM — o OK virou o
 *   campo **Status** (Aberta/Concluída) no detalhe, e Importante/Urgente/Lido não existem
 *   mais;
 * - Prioridade virou CAMPO DE TEXTO (ex.: "Alta", "Baixa") — coluna própria;
 * - coluna Tarefa enxuta (base 1366x768) para o botão Histórico ficar visível sem rolar;
 * - filtro por coluna embaixo de cada cabeçalho (Correção 6) — local, em memória.
 *
 * A linha inteira abre a janela central de detalhe; linha atrasada ganha fundo vermelho.
 */
export function TabelaTarefas({
  tarefas, pagina, porPagina, onPagina, onPorPagina, onAbrir, onHistorico, nomeDeResponsavel,
}: TabelaTarefasProps) {
  /** Filtro por coluna (local, Correção 6) — vê FILTROS acima. */
  const [filtros, setFiltros] = useState<FiltrosColuna>(FILTROS_VAZIOS);

  const mudarFiltro = (campo: CampoFiltro, valor: string) =>
    setFiltros((atual) => ({ ...atual, [campo]: valor }));

  // Filtro mudou? Volta para a primeira página — senão o recorte pode cair numa
  // página que os itens filtrados não alcançam mais.
  useEffect(() => {
    onPagina(0);
  }, [filtros, onPagina]);

  const filtradas = useMemo(
    () =>
      tarefas.filter((tarefa) =>
        FILTROS.every(({ campo }) => {
          const termo = filtros[campo].trim().toLowerCase();
          if (!termo) return true;
          return textoDaColuna(campo, tarefa, nomeDeResponsavel)
            .toLowerCase()
            .includes(termo);
        }),
      ),
    // `nomeDeResponsavel` vem inline da tela e muda a cada render — inócuo (lista curta)
    [tarefas, filtros, nomeDeResponsavel],
  );

  const filtrando = FILTROS.some(({ campo }) => filtros[campo].trim() !== "");
  const inicio = pagina * porPagina;
  const visiveis = filtradas.slice(inicio, inicio + porPagina);
  const total = filtradas.length;
  const ultima = Math.max(0, Math.ceil(total / porPagina) - 1);
  const de = total === 0 ? 0 : inicio + 1;
  const ate = Math.min(inicio + porPagina, total);

  return (
    <div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left align-bottom">
                Status
                {/* respiro para a linha de filtros alinhar os rótulos das colunas */}
                <div className="mt-1.5 h-7" aria-hidden="true" />
              </th>
              {/* Input de filtro embaixo de cada coluna (Correção 6) — local, em
                  memória; os de Status e Histórico ficam de fora: Status já tem os
                  cards-filtro e Histórico é ação de linha. */}
              <th className="px-3 py-2.5 text-left align-bottom">
                Tarefa
                <InputColuna campo="tarefa" filtros={filtros} aoMudar={mudarFiltro} />
              </th>
              <th className="px-3 py-2.5 text-left align-bottom">
                Cliente
                <InputColuna campo="cliente" filtros={filtros} aoMudar={mudarFiltro} />
              </th>
              <th className="px-3 py-2.5 text-left align-bottom">
                Prioridade
                <InputColuna campo="prioridade" filtros={filtros} aoMudar={mudarFiltro} />
              </th>
              <th className="px-3 py-2.5 text-left align-bottom whitespace-nowrap">
                Data compromisso
                <InputColuna campo="compromisso" filtros={filtros} aoMudar={mudarFiltro} />
              </th>
              <th className="px-3 py-2.5 text-left align-bottom whitespace-nowrap">
                Prazo fatal
                <InputColuna campo="prazoFatal" filtros={filtros} aoMudar={mudarFiltro} />
              </th>
              <th className="px-3 py-2.5 text-left align-bottom">
                Responsável
                <InputColuna campo="responsavel" filtros={filtros} aoMudar={mudarFiltro} />
              </th>
              <th className="px-3 py-2.5 text-left align-bottom">
                Histórico
                <div className="mt-1.5 h-7" aria-hidden="true" />
              </th>
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
                  {filtrando ? "Nada com os filtros de coluna." : "Nada nesta página."}
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
