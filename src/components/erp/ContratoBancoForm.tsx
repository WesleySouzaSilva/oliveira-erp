import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mensagemDeErro } from "@/lib/api/http";
import { listarBancos, type Banco } from "@/lib/api/bancos";
import {
  atualizarContratoBanco,
  criarContratoBanco,
  type ContratoBanco,
  type ContratoBancoNovo,
} from "@/lib/api/contratosBanco";
import { textoParaValor } from "@/lib/moeda";

/**
 * Formulário de contrato do cliente com o BANCO — extraído de propósito aqui
 * (correção 4): o MESMO bloco é usado pela tela geral (`/erp/contratos-banco`) e pelo
 * dialog "Com o banco" da lista de clientes, que nasce já com o `clienteId` do cliente
 * da linha. Só a moldura muda; o pai decide onde o `<form>` é renderizado (dialog, página).
 *
 * Campos espelham o fonte antigo: banco (select com a lista do CADASTRO de Bancos
 * filtrada por `ativo`; "Outro" abre texto livre), nº do contrato, valor total e parcela
 * (R$, parse em centavos via `src/lib/moeda.ts`), 1º/próximo/último vencimento e
 * observações. `clienteId` e `banco` são os únicos obrigatórios da API — o banco é
 * validado aqui antes de enviar.
 *
 * A lista deixa de ser fixa no fonte (correção 5): vem de `GET /bancos` a cada abertura
 * do form e só os ATIVOS entram no seletor. Sem nenhum cadastrado, o aviso aponta para
 * Cadastro > Bancos — e o "Outro" (texto livre) continua valendo como saída.
 */

/**
 * Valor do select que abre o campo de banco livre — sentinela interna, não um nome de
 * banco: assim um banco registrado chamado "Outro" não colide com a opção de texto livre.
 */
const BANCO_OUTRO = "__outro__";

/** Rótulo visível da opção de texto livre (o que o teste e a pessoa enxergam). */
const BANCO_OUTRO_ROTULO = "Outro";

interface Formulario {
  banco: string;
  bancoOutro: string;
  numeroContrato: string;
  valorTotal: string;
  valorParcela: string;
  primeiroVencimento: string;
  vencimentoProximaParcela: string;
  vencimentoUltimaParcela: string;
  observacoes: string;
}

const FORM_VAZIO: Formulario = {
  banco: "",
  bancoOutro: "",
  numeroContrato: "",
  valorTotal: "",
  valorParcela: "",
  primeiroVencimento: "",
  vencimentoProximaParcela: "",
  vencimentoUltimaParcela: "",
  observacoes: "",
};

/**
 * Edição: o contrato existente vira o formulário com o banco GRAVADO nele, seja ele da
 * lista de cadastro ou texto livre antigo — quem decide se o valor vira opção extra do
 * select é o componente (a lista só chega depois, assíncrona). Nada de editar se perde.
 */
function paraFormulario(contrato: ContratoBanco | null | undefined): Formulario {
  if (!contrato) return FORM_VAZIO;
  return {
    banco: contrato.banco ?? "",
    bancoOutro: "",
    numeroContrato: contrato.numeroContrato ?? "",
    valorTotal:
      contrato.valorTotalOperacao === null || contrato.valorTotalOperacao === undefined
        ? ""
        : String(contrato.valorTotalOperacao),
    valorParcela:
      contrato.valorParcela === null || contrato.valorParcela === undefined
        ? ""
        : String(contrato.valorParcela),
    primeiroVencimento: contrato.primeiroVencimento ?? "",
    vencimentoProximaParcela: contrato.vencimentoProximaParcela ?? "",
    vencimentoUltimaParcela: contrato.vencimentoUltimaParcela ?? "",
    observacoes: contrato.observacoes ?? "",
  };
}

interface Props {
  /** Cliente a quem o contrato pertence — vem do contexto da tela/dialog. */
  clienteId: string;
  /** Contrato em edição: presente → PUT; ausente → POST. */
  contrato?: ContratoBanco | null;
  /** Depois de salvar (criar/atualizar) — o pai recarrega a lista e fecha o form. */
  onSalvo?: (contrato: ContratoBanco) => void;
  onCancelar: () => void;
}

export function ContratoBancoForm({ clienteId, contrato, onSalvo, onCancelar }: Props) {
  const [form, setForm] = useState<Formulario>(() => paraFormulario(contrato));
  const [salvando, setSalvando] = useState(false);
  /** Bancos do cadastro (só ATIVOS) — a lista fixa do fonte virou `GET /bancos`. */
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [carregandoBancos, setCarregandoBancos] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // A API devolve os dois lados; o seletor mostra só os ativos (desligar sai do form).
        const todos = await listarBancos();
        if (vivo) setBancos(todos.filter((banco) => banco.ativo));
      } catch (erro) {
        toast.error(mensagemDeErro(erro));
      } finally {
        if (vivo) setCarregandoBancos(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Opções do select: bancos ativos do cadastro + o banco GRAVADO no contrato em edição
   * que não está mais na lista (desligado, excluído ou texto livre antigo) — vira opção
   * extra para a edição não perder o valor. "Outro" (texto livre) fecha a lista.
   */
  const opcoes: Banco[] = [...bancos];
  const bancoGravado = contrato?.banco?.trim();
  if (bancoGravado && !opcoes.some((banco) => banco.nome === bancoGravado)) {
    opcoes.push({ id: `gravado-${bancoGravado}`, nome: bancoGravado, ativo: false });
  }

  const campo = (nome: keyof Formulario) => ({
    id: `contrato-banco-${nome}`,
    value: form[nome],
    onChange: (evento: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  });

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    // Obrigatório da API: banco (vem do select ou do texto livre quando "Outro").
    const banco = (form.banco === BANCO_OUTRO ? form.bancoOutro : form.banco).trim();
    if (!banco) {
      toast.error(form.banco === BANCO_OUTRO ? "Informe o nome do banco" : "Escolha o banco");
      return;
    }
    // Dinheiro: parse em centavos inteiros (src/lib/moeda.ts) — sem float quebrado.
    const valorTotalOperacao = textoParaValor(form.valorTotal);
    const valorParcela = textoParaValor(form.valorParcela);
    if (Number.isNaN(valorTotalOperacao) || Number.isNaN(valorParcela)) {
      toast.error("Valor inválido — use algo como 20000, 20000,50 ou 20.000,50.");
      return;
    }
    const vazio = (valor: string) => (valor.trim() ? valor.trim() : null);
    const dados: ContratoBancoNovo = {
      clienteId,
      banco,
      numeroContrato: vazio(form.numeroContrato),
      valorTotalOperacao,
      valorParcela,
      primeiroVencimento: vazio(form.primeiroVencimento),
      vencimentoProximaParcela: vazio(form.vencimentoProximaParcela),
      vencimentoUltimaParcela: vazio(form.vencimentoUltimaParcela),
      observacoes: vazio(form.observacoes),
    };
    setSalvando(true);
    try {
      const salvo = contrato
        ? await atualizarContratoBanco(contrato.id, dados)
        : await criarContratoBanco(dados);
      toast.success(contrato ? "Contrato com o banco atualizado." : "Contrato com o banco criado.");
      onSalvo?.(salvo);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">
        {contrato ? "Editar contrato com o banco" : "Novo contrato com o banco"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="contrato-banco-banco">
            Banco *
          </Label>
          <Select
            value={form.banco}
            onValueChange={(valor) => setForm((atual) => ({ ...atual, banco: valor }))}
          >
            <SelectTrigger id="contrato-banco-banco" aria-label="Banco" className="w-full">
              <SelectValue placeholder="Selecione o banco *" />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((banco) => (
                <SelectItem key={banco.id} value={banco.nome}>
                  {banco.nome}
                </SelectItem>
              ))}
              {/* Sempre por último: banco que não está no cadastro (nome livre). */}
              <SelectItem value={BANCO_OUTRO}>{BANCO_OUTRO_ROTULO}</SelectItem>
            </SelectContent>
          </Select>
          {/* Cadastro vazio: o form não trava (o "Outro" resolve), mas aponta onde cadastrar. */}
          {!carregandoBancos && bancos.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Nenhum banco cadastrado — cadastre em Cadastro &gt; Bancos
            </p>
          )}
          {form.banco === BANCO_OUTRO && (
            <Input
              id="contrato-banco-bancoOutro"
              value={form.bancoOutro}
              onChange={(evento) =>
                setForm((atual) => ({ ...atual, bancoOutro: evento.target.value }))
              }
              placeholder="Nome do banco"
              aria-label="Nome do banco (outro)"
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="contrato-banco-numeroContrato">
            Nº do contrato
          </Label>
          <Input {...campo("numeroContrato")} placeholder="Ex.: NB-001" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="contrato-banco-valorTotal">
            Valor total da operação (R$)
          </Label>
          <Input {...campo("valorTotal")} inputMode="decimal" placeholder="Ex.: 250000,00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="contrato-banco-valorParcela">
            Valor da parcela (R$)
          </Label>
          <Input {...campo("valorParcela")} inputMode="decimal" placeholder="Ex.: 4166,67" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="contrato-banco-primeiroVencimento">
            1º vencimento
          </Label>
          <Input {...campo("primeiroVencimento")} type="date" />
        </div>
        <div className="space-y-1.5">
          <Label
            className="text-xs text-muted-foreground"
            htmlFor="contrato-banco-vencimentoProximaParcela"
          >
            Próximo vencimento
          </Label>
          <Input {...campo("vencimentoProximaParcela")} type="date" />
        </div>
        <div className="space-y-1.5">
          <Label
            className="text-xs text-muted-foreground"
            htmlFor="contrato-banco-vencimentoUltimaParcela"
          >
            Último vencimento
          </Label>
          <Input {...campo("vencimentoUltimaParcela")} type="date" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground" htmlFor="contrato-banco-observacoes">
            Observações
          </Label>
          <textarea
            {...campo("observacoes")}
            rows={3}
            placeholder="Anotações sobre a operação (opcional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : contrato ? "Salvar alterações" : "Salvar contrato"}
        </Button>
      </DialogFooter>
    </form>
  );
}
