import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CornerUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { mensagemDeErro } from "@/lib/api/http";
import { criarTarefa, listarTiposTarefa, RECORRENCIAS_TAREFA, type TarefaTipo } from "@/lib/api/tarefas";
import { listarSetores, type Setor } from "@/lib/api/setores";

const HOJE = new Date().toISOString().split("T")[0];

/**
 * Primeira tarefa do contrato (pedido do titular 16/10/2026).
 *
 * Assim que o contrato termina de ser criado, esta janela já aparece PREENCHIDA com os
 * dados fixos (título/descrição "Criação do contrato nº X do cliente Y", vencimento =
 * hoje) e pede só o SETOR de encaminhamento:
 *
 * - Confirmou com setor → a tarefa nasce encaminhada; a API resolve o usuário da vez do
 *   setor (menor carga) e a pessoa recebe o alerta (notificação) na plataforma;
 * - Fechou sem escolher → a tarefa nasce mesmo assim, com o próprio criador.
 *
 * Não aparece quando o formulário do contrato já marcou "Setores de envio" — nesse caso a
 * API já criou as tarefas por setor (decisão 8 do plano) e uma a mais duplicaria.
 */
export function EncaminharContratoTarefa({
  aberto,
  onFechar,
  numero,
  clienteNome,
  contratoId,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** Número do contrato recém-criado (vai no título/descrição da tarefa). */
  numero: string;
  clienteNome: string;
  /**
   * Contrato recém-criado: vai em `criarTarefa` para a tarefa NASCER VINCULADA (nasce órfã
   * do contrato hoje) — é esse vínculo que faz a timeline listar os anexos do contrato na
   * linha "criada" (correção 2, Fase 1 de `docs/plano-correcoes-comercial-contratos-tarefas.md`).
   */
  contratoId?: string | null;
}) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useState("");
  const [enviando, setEnviando] = useState(false);
  /**
   * Campos novos OPCIONAIS (Fase 4, 22/10/2026): tipo de tarefa, data fatal e
   * recorrência. Sem tipo, o título do contrato continua sendo o da tarefa — com tipo,
   * a API grava o nome do tipo no lugar (o título enviado é ignorado).
   */
  const [tipos, setTipos] = useState<TarefaTipo[]>([]);
  const [tipoId, setTipoId] = useState("");
  const [prazoFatal, setPrazoFatal] = useState("");
  const [recorrencia, setRecorrencia] = useState("unica");
  /** Garante UMA tarefa por contrato: nem o confirmar nem o fechar duplicam. */
  const criada = useRef(false);

  useEffect(() => {
    if (aberto) {
      setSetorId("");
      setTipoId("");
      setPrazoFatal("");
      setRecorrencia("unica");
      criada.current = false;
      void listarSetores()
        .then(setSetores)
        .catch(() => setSetores([]));
      // Tipos ativos para o seletor (leitura aberta; erro só deixa o select vazio).
      void listarTiposTarefa()
        .then((lista) => setTipos(lista.filter((tipo) => tipo.ativo)))
        .catch(() => setTipos([]));
    }
  }, [aberto]);

  const titulo = `Criação do contrato nº ${numero} do cliente ${clienteNome}`;

  const criar = async (encaminhada: boolean) => {
    if (criada.current) return;
    criada.current = true;
    setEnviando(true);
    try {
      await criarTarefa({
        titulo,
        descricao: `Contrato nº ${numero} — primeira tarefa do fluxo, criada junto com o cadastro do contrato em ${new Date().toLocaleDateString("pt-BR")}.`,
        dataVencimento: HOJE,
        prazoFatal: prazoFatal || undefined,
        recorrencia,
        tipoId: tipoId || undefined,
        nomeCliente: clienteNome,
        // Vínculo com o contrato (correção 2): sem ele a tarefa nasce órfã e a timeline
        // não tem como mostrar os arquivos do contrato no primeiro item do histórico.
        contratoId: contratoId ?? undefined,
        setorId: encaminhada && setorId ? setorId : undefined,
        responsavelId: undefined,
      });
      if (encaminhada && setorId) {
        const nomeSetor = setores.find((setor) => setor.id === setorId)?.nome ?? "o setor";
        toast.success(`Tarefa criada e encaminhada para ${nomeSetor}.`);
      } else {
        toast.success("Primeira tarefa do contrato criada (fica com você).");
      }
      onFechar();
    } catch (erro) {
      criada.current = false;
      toast.error(mensagemDeErro(erro));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(novo) => {
        if (!novo) {
          // Fechar sem confirmar ainda gera a tarefa — com o criador como responsável.
          if (!enviando) void criar(false);
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerUpRight className="w-4 h-4 text-accent" />
            Primeira tarefa do contrato
          </DialogTitle>
          <DialogDescription>
            O contrato nº {numero} foi criado. Confirme o setor que recebe esta primeira tarefa —
            a pessoa da vez (menor carga) dentro do setor será notificada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título (fixo)</Label>
            <Input value={titulo} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Vencimento (fixo = hoje)</Label>
            <Input value={new Date(`${HOJE}T12:00:00`).toLocaleDateString("pt-BR")} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="tarefa-contrato-tipo">
              Tipo de tarefa (opcional)
            </Label>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger id="tarefa-contrato-tipo">
                <SelectValue placeholder="Sem tipo — usa o título do contrato" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((tipo) => (
                  <SelectItem key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Com tipo escolhido, o nome do tipo vira o título da tarefa (o texto acima é
              ignorado pela API).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="tarefa-contrato-fatal">
                Data fatal (opcional)
              </Label>
              <Input
                id="tarefa-contrato-fatal"
                type="date"
                value={prazoFatal}
                onChange={(evento) => setPrazoFatal(evento.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="tarefa-contrato-recorrencia">
                Recorrência
              </Label>
              <Select value={recorrencia} onValueChange={setRecorrencia}>
                <SelectTrigger id="tarefa-contrato-recorrencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORRENCIAS_TAREFA.map((item) => (
                    <SelectItem key={item.valor} value={item.valor}>
                      {item.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="tarefa-contrato-setor">
              Setor que recebe a tarefa
            </Label>
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger id="tarefa-contrato-setor">
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.id}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Sem escolher, a tarefa fica com você. Fechar esta janela também cria a tarefa (com
              você como responsável).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onFechar()} disabled={enviando}>
            Fechar (fica comigo)
          </Button>
          <Button type="button" onClick={() => void criar(true)} disabled={enviando || !setorId}>
            {enviando ? "Criando..." : "Criar e encaminhar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
