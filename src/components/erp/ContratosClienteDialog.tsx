import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileSignature,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mensagemDeErro } from "@/lib/api/http";
import { CaixaAnexo } from "@/components/ui/CaixaAnexo";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { listarTiposObjeto, type TipoObjeto } from "@/lib/api/objetos";
import {
  anexarArquivos,
  atualizarContrato,
  baixarArquivoContrato,
  criarContrato,
  excluirArquivo,
  excluirContrato,
  listarArquivos,
  listarContratos,
  type Arquivo,
  type Contrato,
} from "@/lib/api/contratos";
import { formatarTamanho } from "@/lib/formatarTamanho";
import { DetalheContrato } from "@/components/erp/DetalheContrato";
import { EncaminharContratoTarefa } from "@/components/erp/EncaminharContratoTarefa";
import { temDetalhes } from "@/lib/contratoDetalhes";
import { listarSetores, type Setor } from "@/lib/api/setores";
import { textoParaValor } from "@/lib/moeda";

/**
 * Contratos do cliente — a 1a etapa do cliente (1..N por cliente). Dialog com a
 * lista + formulário: numero, objeto (select do tipo de objeto/categoria), valor,
 * data de abertura (AUTOMÁTICA — só o servidor grava, o form só mostra) e descricao.
 *
 * A lista mostra só número, objeto, valor, abertura, situação e ações: a descrição
 * NUNCA aparece nela — cada linha tem uma seta que abre o detalhe embaixo (decisão 6
 * de `docs/plano-contratos-e-timeline.md`).
 *
 * Abre em dois modos: lista (padrão) ou com o formulário de novo contrato já aberto
 * (`iniciandoComFormulario`) — é o que o botão "Salvar e gerar contrato" do cadastro
 * de cliente usa.
 */
interface Props {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  clienteId: string;
  clienteNome: string;
  /** Abre já no formulário de novo contrato (depois de salvar o cliente). */
  iniciandoComFormulario?: boolean;
  /** Chamado depois de criar o primeiro contrato (para a tela pai recarregar). */
  onContratoCriado?: () => void;
}

interface Formulario {
  objetoId: string;
  valor: string;
  descricao: string;
}

const FORM_VAZIO: Formulario = { objetoId: "", valor: "", descricao: "" };

export function ContratosClienteDialog({
  aberto,
  onAbertoChange,
  clienteId,
  clienteNome,
  iniciandoComFormulario = false,
  onContratoCriado,
}: Props) {
  const confirmar = useConfirm();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tipos, setTipos] = useState<TipoObjeto[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  /** Setores escolhidos no cadastro: cada um vira uma tarefa no servidor (decisão 8). */
  const [setoresEnvio, setSetoresEnvio] = useState<string[]>([]);
  /**
   * Primeira tarefa do contrato (16/10/2026): depois de criar o contrato, a janela
   * "Primeira tarefa do contrato" pede o setor de encaminhamento. Só abre quando o
   * form NÃO marcou setores de envio (nesse caso a API já criou as tarefas por setor).
   * Guarda id + número: o id viaja como `contratoId` da tarefa (correção 2) — é o
   * vínculo que faz a timeline mostrar os anexos na linha "criada".
   */
  const [contratoNovo, setContratoNovo] = useState<{ id: string; numero: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  /** Ids das linhas com o detalhe aberto — a descrição só existe depois da seta. */
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  /**
   * Documentos anexados junto da descrição (19/10/2026) — mesmo jeito do encaminhar
   * da tarefa: os arquivos ficam na fila e vão para o servidor depois que o contrato
   * existe (`POST /contratos/{id}/arquivos`). A fila é só dos NOVOS.
   */
  const [arquivos, setArquivos] = useState<File[]>([]);
  /**
   * Anexos JÁ GRAVADOS do contrato em edição (`GET /contratos/{id}/arquivos`) — a edição
   * deixou de zerar a lista (correção 1): dá para baixar e excluir os que já estão lá,
   * enquanto os novos seguem na fila `arquivos` e vão no salvar.
   */
  const [arquivosExistentes, setArquivosExistentes] = useState<Arquivo[]>([]);
  const [carregandoAnexos, setCarregandoAnexos] = useState(false);

  // A data de abertura é automática: o form não tem o campo, só informa ao usuário.
  const hoje = new Date().toLocaleDateString("pt-BR");

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setExpandidos(new Set());
    // Independentes: a lista de setores não pode derrubar a lista de contratos.
    Promise.allSettled([
      listarContratos(clienteId),
      listarTiposObjeto(),
      listarSetores(),
    ]).then(([contratosResultado, tiposResultado, setoresResultado]) => {
      if (contratosResultado.status === "fulfilled") {
        setContratos(contratosResultado.value);
      } else {
        toast.error(mensagemDeErro(contratosResultado.reason));
        setContratos([]);
      }
      if (tiposResultado.status === "fulfilled") setTipos(tiposResultado.value);
      if (setoresResultado.status === "fulfilled") setSetores(setoresResultado.value);
    }).finally(() => setCarregando(false));
    if (iniciandoComFormulario) {
      setEditando(null);
      setForm(FORM_VAZIO);
      setArquivos([]);
      setSetoresEnvio([]);
      setFormAberto(true);
    }
  }, [aberto, clienteId, iniciandoComFormulario]);

  // Em edição, os anexos já gravados entram na lista em vez de zerar tudo (correção 1):
  // dá para baixar e excluir; os novos continuam na fila `arquivos` e vão no salvar.
  // Form de contrato NOVO não busca nada (ainda não existe id); `ativo` descarta a
  // resposta se a pessoa trocar de contrato (ou fechar o form) antes de terminar.
  useEffect(() => {
    if (!formAberto || !editando) {
      setArquivosExistentes([]);
      return;
    }
    let ativo = true;
    setCarregandoAnexos(true);
    setArquivosExistentes([]);
    listarArquivos(editando.id)
      .then((lista) => {
        if (ativo) setArquivosExistentes(lista);
      })
      .catch((erro) => {
        if (ativo) {
          setArquivosExistentes([]);
          toast.error(mensagemDeErro(erro));
        }
      })
      .finally(() => {
        if (ativo) setCarregandoAnexos(false);
      });
    return () => {
      ativo = false;
    };
  }, [formAberto, editando]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ...FORM_VAZIO, objetoId: tipos.length === 1 ? tipos[0].id : "" });
    setArquivos([]);
    setSetoresEnvio([]);
    setFormAberto(true);
  };

  /** Seta da linha: abre/fecha o detalhe (descrição, banco, datas) daquele contrato. */
  const alternarLinha = (id: string) => {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const expandirTodas = () => setExpandidos(new Set(contratos.map((contrato) => contrato.id)));
  const recolherTodas = () => setExpandidos(new Set());

  const abrirEdicao = (contrato: Contrato) => {
    setEditando(contrato);
    setArquivos([]);
    setForm({
      objetoId: contrato.objetoId ?? "",
      valor: contrato.valor === null || contrato.valor === undefined ? "" : String(contrato.valor),
      descricao: contrato.descricao ?? "",
    });
    setFormAberto(true);
  };

  const campo = (nome: keyof Formulario) => ({
    id: `contrato-${nome}`,
    value: form[nome],
    onChange: (evento: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  });

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setSalvando(true);
    try {
      // Dinheiro: parse em centavos inteiros (src/lib/moeda.ts) — sem float/double
      // quebrado no caminho; a API é BigDecimal e o banco numeric(15,2).
      const valor = textoParaValor(form.valor);
      if (Number.isNaN(valor)) {
        toast.error("Valor inválido — use algo como 20000, 20000,50 ou 20.000,50.");
        setSalvando(false);
        return;
      }
      const dados = {
        // Número automático (16/10/2026): o cadastro não pede mais — o servidor gera
        // CT-01, CT-02, ... (na edição mantém o número que já existe)
        numero: editando ? editando.numero : undefined,
        objetoId: form.objetoId || null,
        valor,
        descricao: form.descricao.trim() || null,
        // setor de envio: o servidor cria uma tarefa por setor (decisão 8 do plano)
        setores: setoresEnvio.length > 0 ? setoresEnvio : undefined,
      };
      let idContrato = editando?.id;
      if (editando) {
        await atualizarContrato(editando.id, dados);
        toast.success("Contrato atualizado.");
      } else {
        const criado = await criarContrato(clienteId, dados);
        idContrato = criado.id;
        toast.success("Contrato criado.");
        // Primeira tarefa do contrato: janela pedindo o setor de encaminhamento
        // (se o form já marcou setores de envio, a API criou as tarefas por setor).
        if (setoresEnvio.length === 0) {
          setContratoNovo({ id: criado.id, numero: criado.numero });
        }
        onContratoCriado?.();
      }
      // Anexos escolhidos junto da descrição: vão depois que o contrato existe
      // (o upload precisa do id — POST /contratos/{id}/arquivos).
      if (idContrato && arquivos.length > 0) {
        try {
          await anexarArquivos(idContrato, arquivos);
          toast.success(
            `${arquivos.length} documento(s) anexado(s) ao contrato.`,
          );
        } catch (erroAnexo) {
          // O contrato já foi salvo; só o anexo falhou. Fecha o form para não criar
          // contrato duplicado ao reenviar, e avisa para anexar de novo (ou tentar depois).
          toast.error(
            `${mensagemDeErro(erroAnexo)} — o contrato foi salvo, mas os documentos não foram anexados.`,
          );
          setFormAberto(false);
          setArquivos([]);
          setContratos(await listarContratos(clienteId));
          return;
        }
      }
      setFormAberto(false);
      setArquivos([]);
      setContratos(await listarContratos(clienteId));
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (contrato: Contrato) => {
    const confirmado = await confirmar({
      title: `Excluir o contrato ${contrato.numero}?`,
      description: "Os arquivos anexados ao contrato também serão excluídos.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirContrato(contrato.id);
      toast.success("Contrato excluído.");
      setContratos(await listarContratos(clienteId));
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  const nomeDoTipo = (id: string | null | undefined) =>
    tipos.find((tipo) => tipo.id === id)?.tipoObjeto ?? "—";

  /** Exclui um anexo JÁ GRAVADO do contrato em edição (exclusão imediata na API). */
  const excluirAnexoExistente = async (arquivo: Arquivo) => {
    const confirmado = await confirmar({
      title: `Excluir o anexo ${arquivo.nomeOriginal}?`,
      description: "O arquivo sai do contrato e não pode ser recuperado.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!confirmado) return;
    try {
      await excluirArquivo(arquivo.id);
      setArquivosExistentes((atual) => atual.filter((item) => item.id !== arquivo.id));
      toast.success("Anexo excluído.");
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contratos — {clienteNome}</DialogTitle>
          <DialogDescription>
            O contrato é a 1ª etapa do cliente: reúne os dados do que será feito antes de
            abrir o processo.
          </DialogDescription>
        </DialogHeader>

        {!formAberto && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {!carregando && contratos.length > 1 && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={expandirTodas}
                    disabled={expandidos.size === contratos.length}
                    aria-label="Expandir todas as descrições"
                  >
                    <ChevronsDownUp className="w-4 h-4 mr-1" /> Expandir tudo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={recolherTodas}
                    disabled={expandidos.size === 0}
                    aria-label="Recolher todas as descrições"
                  >
                    <ChevronsUpDown className="w-4 h-4 mr-1" /> Recolher tudo
                  </Button>
                </>
              )}
            </div>
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="w-4 h-4 mr-1" /> Novo contrato
            </Button>
          </div>
        )}

        {formAberto ? (
          <form onSubmit={salvar} className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {editando ? `Editar contrato ${editando.numero}` : "Novo contrato"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-md bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
                Número gerado automaticamente (CT-01, CT-02, ...) — sem preenchimento manual.
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="contrato-objetoId">
                  Objeto (categoria) *
                </Label>
                <select
                  id="contrato-objetoId"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...campo("objetoId")}
                >
                  <option value="">Selecione o objeto *</option>
                  {tipos.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.tipoObjeto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="contrato-valor">
                  Valor (R$) *
                </Label>
                <Input
                  {...campo("valor")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex.: 15000,00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de abertura</Label>
                <Input value={hoje} readOnly disabled aria-label="Data de abertura (automática)" />
                <p className="text-[11px] text-muted-foreground">Preenchida automaticamente.</p>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="contrato-descricao">
                  Descrição (resumo do que será feito para o cliente) *
                </Label>
                <textarea
                  id="contrato-descricao"
                  {...campo("descricao")}
                  required
                  rows={3}
                  placeholder="Resumo do que será feito para o cliente"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {/* Anexos junto da descrição (19/10/2026) — mesmo jeito do encaminhar
                    da tarefa: escolhe os arquivos e eles vão no salvar. */}
                <div className="space-y-1 pt-1.5">
                  <p className="block text-[11px] text-muted-foreground">
                    Anexar documentos — fotos, PDFs, planilhas etc. (os arquivos vão junto do
                    contrato no salvar)
                  </p>
                  <CaixaAnexo
                    arquivos={arquivos}
                    onAdicionar={(novos) => setArquivos((atual) => [...atual, ...novos])}
                    onRemover={(indice) =>
                      setArquivos((atual) => atual.filter((_, posicao) => posicao !== indice))
                    }
                  />
                </div>
                {/* Anexos JÁ GRAVADOS (só na edição — correção 1): baixam e excluem os que
                    já estão no contrato; a fila de cima continua sendo só dos novos. */}
                {editando && (
                  <div className="space-y-1 pt-1.5">
                    <p className="block text-[11px] text-muted-foreground">
                      Anexos já vinculados ao contrato
                    </p>
                    {carregandoAnexos ? (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Carregando anexos...
                      </p>
                    ) : arquivosExistentes.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Nenhum anexo gravado.</p>
                    ) : (
                      <ul className="space-y-1">
                        {arquivosExistentes.map((arquivo) => (
                          <li
                            key={arquivo.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-secondary/60 px-2 py-1 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                baixarArquivoContrato(arquivo.id, arquivo.nomeOriginal).catch(
                                  (erro) => toast.error(mensagemDeErro(erro)),
                                )
                              }
                              className="truncate inline-flex items-center gap-1.5 text-accent hover:underline"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              {arquivo.nomeOriginal}
                              {arquivo.tamanhoBytes ? (
                                <span className="text-muted-foreground">
                                  ({formatarTamanho(arquivo.tamanhoBytes)})
                                </span>
                              ) : null}
                            </button>
                            <button
                              type="button"
                              aria-label={`Excluir ${arquivo.nomeOriginal}`}
                              onClick={() => void excluirAnexoExistente(arquivo)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
            {!editando && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Setores de envio (o servidor cria uma tarefa em cada)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Será gerado histórico de tarefa com o primeiro registro como criação do
                  contrato e, na sequência, você deve enviar para o próximo setor responsável
                  ou usuário responsável (setor ou pessoa) — quem receber segue a regra de
                  rodízio (menor carga) quando você escolher só o setor.
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {setores.map((setor) => {
                    const marcado = setoresEnvio.includes(setor.id);
                    return (
                      <label
                        key={setor.id}
                        className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-secondary/60 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setSetoresEnvio((atual) =>
                              marcado ? atual.filter((id) => id !== setor.id) : [...atual, setor.id],
                            )
                          }
                          aria-label={`Enviar para ${setor.nome}`}
                        />
                        {setor.nome}
                      </label>
                    );
                  })}
                </div>
                {setores.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhum setor cadastrado — cadastre em Cadastro &gt; Setores.
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormAberto(false);
                  setForm(FORM_VAZIO);
                  setArquivos([]);
                  setEditando(null);
                }}
              >
                Voltar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar contrato"}
              </Button>
            </DialogFooter>
          </form>
        ) : carregando ? (
          <ListSkeleton />
        ) : contratos.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="Nenhum contrato"
            description="Crie o primeiro contrato do cliente — número e objeto são o bastante para começar."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">Detalhes</span>
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => {
                  const detalheAberto = expandidos.has(contrato.id);
                  return (
                    <Fragment key={contrato.id}>
                      <TableRow>
                        <TableCell className="px-2">
                          <button
                            type="button"
                            onClick={() => alternarLinha(contrato.id)}
                            aria-expanded={detalheAberto}
                            aria-controls={`contrato-detalhe-${contrato.id}`}
                            aria-label={
                              detalheAberto
                                ? `Recolher contrato ${contrato.numero}`
                                : `Ver descrição do contrato ${contrato.numero}`
                            }
                            title={
                              detalheAberto
                                ? "Recolher detalhe"
                                : temDetalhes(contrato)
                                  ? "Ver descrição"
                                  : "Ver detalhes"
                            }
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary transition-colors"
                          >
                            {detalheAberto ? (
                              <ChevronDown className="w-4 h-4 text-accent" />
                            ) : (
                              <ChevronRight
                                className={`w-4 h-4 ${temDetalhes(contrato) ? "text-accent" : "text-muted-foreground"}`}
                              />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{contrato.numero}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{nomeDoTipo(contrato.objetoId)}</Badge>
                        </TableCell>
                        <TableCell>
                          {contrato.valor === null || contrato.valor === undefined
                            ? "—"
                            : contrato.valor.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                        </TableCell>
                        <TableCell>
                          {contrato.dataAbertura
                            ? new Date(`${contrato.dataAbertura}T00:00:00`).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contrato.situacao === "ativo" ? "default" : "outline"}>
                            {contrato.situacao}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicao(contrato)}>
                            <Pencil className="w-4 h-4 mr-1" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => excluir(contrato)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                      {detalheAberto && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="bg-muted/30 px-4 py-3">
                            <DetalheContrato
                              contrato={contrato}
                              id={`contrato-detalhe-${contrato.id}`}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>

      {/* Primeira tarefa do contrato: janela pedindo o setor de encaminhamento (16/10/2026) */}
      <EncaminharContratoTarefa
        aberto={contratoNovo !== null}
        onFechar={() => setContratoNovo(null)}
        numero={contratoNovo?.numero ?? ""}
        contratoId={contratoNovo?.id ?? null}
        clienteNome={clienteNome}
      />
    </Dialog>
  );
}
