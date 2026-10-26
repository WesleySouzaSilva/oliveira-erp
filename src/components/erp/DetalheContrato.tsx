import { FileText } from "lucide-react";
import type { Contrato } from "@/lib/api/contratos";

/**
 * Painel de detalhe do contrato que abre ABAIXO da linha da lista (padrao "olhar dentro"
 * da linha): a descricao NUNCA aparece na tabela em si — so quando a pessoa aperta a seta
 * daquela linha.
 *
 * Só a descrição: banco, datas e observações ficaram de fora a pedido do titular
 * (15/10/2026) — expandir a linha serve para ler o que se trata o contrato.
 *
 * O mesmo componente serve a lista do dialog de contratos do cliente e a tela de
 * Contratos Clientes (plano `docs/plano-contratos-e-timeline.md`, Fases 1 e 3), para os
 * dois lugares falarem a mesma linguagem.
 */

export function DetalheContrato({ contrato, id }: { contrato: Contrato; id?: string }) {
  return (
    <div id={id} className="text-sm bg-secondary/40 rounded-lg p-3 border border-border">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <FileText className="w-3.5 h-3.5" /> Descrição
      </p>
      <p className="mt-1 text-foreground whitespace-pre-wrap">
        {contrato.descricao?.trim() || <span className="text-muted-foreground">Sem descrição.</span>}
      </p>
    </div>
  );
}
