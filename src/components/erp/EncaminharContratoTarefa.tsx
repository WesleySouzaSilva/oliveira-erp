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
import { criarTarefa } from "@/lib/api/tarefas";
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
  /** Garante UMA tarefa por contrato: nem o confirmar nem o fechar duplicam. */
  const criada = useRef(false);

  useEffect(() => {
    if (aberto) {
      setSetorId("");
      criada.current = false;
      void listarSetores()
        .then(setSetores)
        .catch(() => setSetores([]));
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
