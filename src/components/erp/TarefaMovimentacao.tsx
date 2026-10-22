import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, CornerUpRight, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErroApi, mensagemDeErro } from "@/lib/api/http";
import {
  encaminharTarefa,
  listarHistoricoTarefa,
  baixarAnexoTarefa,
  type Tarefa,
  type TarefaHistorico,
} from "@/lib/api/tarefas";
import { listarSetores, type Setor } from "@/lib/api/setores";
import { listarMembros, type Membro } from "@/lib/api/membros";
import { baixarArquivoContrato, listarArquivos, type Arquivo } from "@/lib/api/contratos";
import { formatarTamanho } from "@/lib/formatarTamanho";

/**
 * Movimentação da tarefa, dentro do drawer de detalhe:
 *
 * - `EncaminharTarefa` — o "de X para Y" do ADVBOX: escolhe o SETOR (e, opcionalmente, o
 *   colaborador) e a API resolve quem recebe (menor carga, respeitando a faixa de valor).
 * - `TarefaTimeline` — a trilha completa (quem criou, quem editou o quê, quem encaminhou
 *   para quem, quem concluiu). O IP fica SÓ no banco (tela Auditoria, do admin) — não
 *   aparece aqui (decisão do titular 16/10/2026). Quem não tem direito leva 403 da API.
 *
 * É o módulo de auditoria de tarefas (plano `docs/plano-contratos-e-timeline.md`, §5.5/§5.7).
 */

const ROTULOS: Record<string, string> = {
  criada: "Tarefa criada",
  editada: "Editada",
  encaminhada: "Encaminhada",
  concluida: "Concluída",
  reaberta: "Reaberta",
};

const dataHora = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

/* -------------------------------------------------------------- timeline */

/**
 * Anexos do contrato (`arquivos_cliente`) já buscados, por contratoId — guardados em
 * módulo para a timeline não rebuscar a cada render/reabertura da janela (correção 2).
 * Falha não fica no cache: a próxima abertura tenta de novo.
 */
const cacheAnexosContrato = new Map<string, Promise<Arquivo[]>>();

function anexosDoContrato(contratoId: string): Promise<Arquivo[]> {
  const guardado = cacheAnexosContrato.get(contratoId);
  if (guardado) return guardado;
  const promessa = listarArquivos(contratoId).catch((erro) => {
    cacheAnexosContrato.delete(contratoId);
    throw erro;
  });
  cacheAnexosContrato.set(contratoId, promessa);
  return promessa;
}

export function TarefaTimeline({
  tarefaId,
  contratoId,
}: {
  tarefaId: string;
  /**
   * Contrato da tarefa (opcional): na linha `criada` a trilha lista os anexos DO CONTRATO
   * (`arquivos_cliente`) — nada os copia para `tarefas_anexos`, então sem este vínculo o
   * primeiro item do histórico ficava sem arquivo (correção 2, Fase 1 do plano).
   */
  contratoId?: string | null;
}) {
  const [linhas, setLinhas] = useState<TarefaHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [mostrarEdicoes, setMostrarEdicoes] = useState<Set<string>>(new Set());
  /** Anexos do contrato (busca única por contratoId, cache acima). */
  const [anexosContrato, setAnexosContrato] = useState<Arquivo[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setSemPermissao(false);
    try {
      setLinhas(await listarHistoricoTarefa(tarefaId));
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 403) {
        setSemPermissao(true);
        setLinhas([]);
      } else {
        toast.error(mensagemDeErro(erro));
      }
    } finally {
      setCarregando(false);
    }
  }, [tarefaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Anexos do contrato: 1 busca por contratoId (o cache de módulo evita rebuscar ao
  // reabrir a janela); tarefa sem vínculo não tem o que buscar.
  useEffect(() => {
    if (!contratoId) {
      setAnexosContrato([]);
      return;
    }
    let ativo = true;
    anexosDoContrato(contratoId)
      .then((lista) => {
        if (ativo) setAnexosContrato(lista);
      })
      .catch((erro) => {
        if (ativo) {
          setAnexosContrato([]);
          toast.error(mensagemDeErro(erro));
        }
      });
    return () => {
      ativo = false;
    };
  }, [contratoId]);

  const alternarEdicoes = (id: string) =>
    setMostrarEdicoes((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  if (carregando) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-2 py-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando histórico...
      </p>
    );
  }

  if (semPermissao) {
    return (
      <p className="text-xs text-muted-foreground bg-secondary/60 rounded-md p-3">
        A trilha desta tarefa é restrita a administradores, gestores e às pessoas envolvidas.
      </p>
    );
  }

  if (linhas.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">Nenhum movimento registrado ainda.</p>;
  }

  return (
    <ol className="space-y-3">
      {linhas.map((linha) => {
        const temDiff = Boolean(linha.campos && linha.campos.length > 0);
        const edicoesAbertas = mostrarEdicoes.has(linha.id);
        // Anexos da ação: nas encaminhadas vêm da própria linha (`tarefas_anexos`, V12);
        // na "criada" de tarefa vêm DO CONTRATO (arquivos_cliente) — nada copia os arquivos
        // do contrato para a linha, então o vínculo traz os arquivos do primeiro item.
        const anexosDaLinha = [
          ...(linha.acao === "criada" && contratoId
            ? anexosContrato.map((arquivo) => ({
                id: arquivo.id,
                nomeOriginal: arquivo.nomeOriginal,
                tamanhoBytes: arquivo.tamanhoBytes,
                baixar: () => baixarArquivoContrato(arquivo.id, arquivo.nomeOriginal),
              }))
            : []),
          ...(linha.anexos ?? []).map((anexo) => ({
            id: anexo.id,
            nomeOriginal: anexo.nomeOriginal,
            tamanhoBytes: anexo.tamanhoBytes,
            baixar: () => baixarAnexoTarefa(anexo.id, anexo.nomeOriginal),
          })),
        ];
        return (
          <li key={linha.id} className="relative pl-5 border-l border-border">
            <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent" />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs font-semibold text-foreground">
                {ROTULOS[linha.acao] ?? linha.acao}
              </span>
              <span className="text-[11px] text-muted-foreground">{dataHora(linha.dataAcao)}</span>
            </div>

            <p className="text-xs text-muted-foreground mt-0.5">
              por {linha.executadoPorNome || "usuário"}
              {linha.setorNome ? ` · setor ${linha.setorNome}` : ""}
            </p>

            {linha.acao === "encaminhada" && (
              <p className="text-xs mt-0.5 flex items-center gap-1 text-foreground">
                <CornerUpRight className="w-3.5 h-3.5 text-accent" />
                de {linha.deUsuarioNome || "—"} para {linha.paraUsuarioNome || linha.setorNome || "—"}
              </p>
            )}

            {/* Recado escrito junto da ação (V12) */}
            {linha.mensagem && (
              <p className="text-xs mt-1 bg-secondary/60 rounded-md px-2 py-1.5 whitespace-pre-wrap text-foreground">
                {linha.mensagem}
              </p>
            )}

            {/* Anexos da ação: bytes na pasta do servidor, aqui só o nome (V12) — a
                linha "criada" de tarefa de contrato traz os anexos do próprio contrato */}
            {anexosDaLinha.length > 0 && (
              <ul className="mt-1 space-y-1">
                {anexosDaLinha.map((anexo) => (
                  <li key={anexo.id}>
                    <button
                      type="button"
                      onClick={() =>
                        anexo.baixar().catch((erro) => toast.error(mensagemDeErro(erro)))
                      }
                      className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3" />
                      {anexo.nomeOriginal}
                      {anexo.tamanhoBytes ? ` (${formatarTamanho(anexo.tamanhoBytes)})` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {temDiff && (
              <button
                type="button"
                onClick={() => alternarEdicoes(linha.id)}
                className="mt-1 text-[11px] text-accent hover:underline inline-flex items-center gap-1"
                aria-expanded={edicoesAbertas}
              >
                {edicoesAbertas ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {edicoesAbertas ? "Ocultar edições" : "Mostrar edições"}
              </button>
            )}

            {temDiff && edicoesAbertas && (
              <ul className="mt-1 space-y-1 bg-secondary/60 rounded-md p-2">
                {(linha.campos ?? []).map((campo) => (
                  <li key={campo.campo} className="text-[11px] text-foreground">
                    <span className="text-muted-foreground">{campo.campo}:</span>{" "}
                    <span className="line-through">{campo.de ?? "—"}</span> →{" "}
                    <span className="font-medium">{campo.para ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}

          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------- encaminhar */

export function EncaminharTarefa({
  tarefa,
  onAtualizada,
}: {
  tarefa: Tarefa;
  onAtualizada?: (tarefa: Tarefa) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [setorDestino, setSetorDestino] = useState("");
  const [membroDestino, setMembroDestino] = useState("");
  /** Recado em texto + arquivos que acompanham o encaminhamento (V12). */
  const [recado, setRecado] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Listas carregadas na primeira abertura: setor (obrigatório) e colaborador (opcional).
  useEffect(() => {
    if (!aberto || setores.length > 0) return;
    Promise.all([listarSetores(), listarMembros()])
      .then(([listaSetores, listaMembros]) => {
        setSetores(listaSetores);
        setMembros(listaMembros);
      })
      .catch((erro) => toast.error(mensagemDeErro(erro)));
  }, [aberto, setores.length]);

  const enviar = async () => {
    if (!setorDestino && !membroDestino) {
      toast.error("Escolha o setor (ou o colaborador) de destino.");
      return;
    }
    setEnviando(true);
    try {
      const movimentada = await encaminharTarefa(tarefa.id, {
        setorId: setorDestino || null,
        responsavelId: membroDestino || null,
        mensagem: recado,
        anexos: arquivos,
      });
      toast.success("Tarefa encaminhada.");
      setAberto(false);
      setSetorDestino("");
      setMembroDestino("");
      setRecado("");
      setArquivos([]);
      onAtualizada?.(movimentada);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-label="Responder ou encaminhar tarefa"
      >
        <Send className="w-3.5 h-3.5 mr-1" /> Responder/Encaminhar Tarefa
      </Button>

      {aberto && (
        <div className="rounded-md border border-border bg-secondary/50 p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Escolha o setor: o servidor entrega para o colaborador com menor carga cuja faixa de
            valor cobre o contrato (ou escolha a pessoa embaixo).
          </p>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground" htmlFor="encaminhar-setor">
              Setor de destino
            </label>
            <select
              id="encaminhar-setor"
              value={setorDestino}
              onChange={(evento) => setSetorDestino(evento.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Selecione o setor</option>
              {setores.map((setor) => (
                <option key={setor.id} value={setor.id}>
                  {setor.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground" htmlFor="encaminhar-membro">
              Colaborador (opcional)
            </label>
            <select
              id="encaminhar-membro"
              value={membroDestino}
              onChange={(evento) => setMembroDestino(evento.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Deixar o servidor escolher pelo setor</option>
              {membros.map((membro) => (
                <option key={membro.id} value={membro.userId}>
                  {membro.nome || membro.email}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground" htmlFor="encaminhar-recado">
              Descrição do encaminhamento
            </label>
            <textarea
              id="encaminhar-recado"
              value={recado}
              onChange={(evento) => setRecado(evento.target.value)}
              rows={3}
              placeholder="Explique o que o próximo precisa saber (opcional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground" htmlFor="encaminhar-anexos">
              Anexos — fotos, documentos, vídeos, áudios etc. (qualquer arquivo; os bytes vão para o diretório de uploads configurado na API)
            </label>
            <input
              id="encaminhar-anexos"
              type="file"
              multiple
              onChange={(evento) => {
                const novos = Array.from(evento.target.files ?? []);
                setArquivos((atual) => [...atual, ...novos]);
                evento.target.value = "";
              }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-secondary/80"
            />
            {arquivos.length > 0 && (
              <ul className="space-y-1">
                {arquivos.map((arquivo, indice) => (
                  <li
                    key={`${arquivo.name}-${indice}`}
                    className="flex items-center justify-between gap-2 rounded-md bg-secondary/60 px-2 py-1 text-xs"
                  >
                    <span className="truncate inline-flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3 shrink-0" />
                      {arquivo.name}
                      <span className="text-muted-foreground">({formatarTamanho(arquivo.size)})</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover ${arquivo.name}`}
                      onClick={() =>
                        setArquivos((atual) => atual.filter((_, posicao) => posicao !== indice))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={enviar}
              disabled={enviando || (!setorDestino && !membroDestino)}
            >
              {enviando ? "Enviando..." : "Confirmar encaminhamento"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
