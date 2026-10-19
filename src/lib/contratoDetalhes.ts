import type { Contrato } from "@/lib/api/contratos";

/**
 * O contrato tem descrição para mostrar quando a linha expande? A lista usa isto para dar a
 * cor da seta — o marcador discreto que diz "aqui vale abrir".
 *
 * Só a descrição conta: banco, datas e observações não entram no painel (pedido do titular
 * em 15/10/2026).
 *
 * Fica em `lib/` porque o contrato e' um tipo do cliente de API: tanto a lista do
 * dialog de contratos quanto a tela de Contratos Clientes consultam.
 */
export function temDetalhes(contrato: Contrato): boolean {
  return Boolean(contrato.descricao?.trim());
}
