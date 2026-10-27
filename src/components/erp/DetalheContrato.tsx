import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip } from "lucide-react";
import {
  baixarArquivoContrato,
  listarArquivos,
  type Arquivo,
  type Contrato,
} from "@/lib/api/contratos";
import { mensagemDeErro } from "@/lib/api/http";
import { formatarTamanho } from "@/lib/formatarTamanho";

/**
 * Painel de detalhe do contrato que abre ABAIXO da linha da lista (padrao "olhar dentro"
 * da linha): a descricao NUNCA aparece na tabela em si — so quando a pessoa aperta a seta
 * daquela linha.
 *
 * Só a descrição + ANEXOS: banco, datas e observações ficaram de fora a pedido do titular
 * (15/10/2026); os anexos entraram na correção 1 (Fase 1 de
 * `docs/plano-correcoes-comercial-contratos-tarefas.md`) — são os arquivos do contrato
 * (`arquivos_cliente` com FK `contrato_id`), buscados AQUI, por expansão: 1 request por
 * linha aberta (nada de carregar tudo na "Expandir tudo") e a falha na busca só mostra o
 * aviso, sem derrubar a descrição nem a lista.
 *
 * O mesmo componente serve a lista do dialog de contratos do cliente e a tela de
 * Contratos Clientes (plano `docs/plano-contratos-e-timeline.md`, Fases 1 e 3), para os
 * dois lugares falarem a mesma linguagem.
 */

export function DetalheContrato({ contrato, id }: { contrato: Contrato; id?: string }) {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [carregando, setCarregando] = useState(true);
  /** Falhou a busca dos anexos: mostramos o aviso no lugar da lista (a descrição fica). */
  const [erroAnexos, setErroAnexos] = useState(false);

  useEffect(() => {
    // `ativo` descarta a resposta se a linha for recolhida antes de terminar.
    let ativo = true;
    setCarregando(true);
    setErroAnexos(false);
    setArquivos([]);
    listarArquivos(contrato.id)
      .then((lista) => {
        if (ativo) setArquivos(lista);
      })
      .catch(() => {
        if (ativo) {
          setArquivos([]);
          setErroAnexos(true);
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [contrato.id]);

  return (
    <div id={id} className="text-sm bg-secondary/40 rounded-lg p-3 border border-border">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <FileText className="w-3.5 h-3.5" /> Descrição
      </p>
      <p className="mt-1 text-foreground whitespace-pre-wrap">
        {contrato.descricao?.trim() || <span className="text-muted-foreground">Sem descrição.</span>}
      </p>

      {/* Anexos do contrato — mesmo padrão da trilha de tarefa (TarefaMovimentacao):
          papelzinho + nome + tamanho + clique baixa o conteúdo. */}
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Paperclip className="w-3.5 h-3.5" /> Anexos
      </p>
      {carregando ? (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando anexos...
        </p>
      ) : erroAnexos ? (
        <p className="mt-1 text-foreground">
          <span className="text-muted-foreground">Não foi possível carregar os anexos.</span>
        </p>
      ) : arquivos.length === 0 ? (
        <p className="mt-1 text-foreground">
          <span className="text-muted-foreground">Sem anexos.</span>
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {arquivos.map((arquivo) => (
            <li key={arquivo.id}>
              <button
                type="button"
                onClick={() =>
                  baixarArquivoContrato(arquivo.id, arquivo.nomeOriginal).catch((erro) =>
                    toast.error(mensagemDeErro(erro)),
                  )
                }
                className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
              >
                <Paperclip className="w-3 h-3" />
                {arquivo.nomeOriginal}
                {arquivo.tamanhoBytes ? ` (${formatarTamanho(arquivo.tamanhoBytes)})` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
