import type { Contrato } from "@/lib/api/contratos";

/**
 * A seta da linha deve indicar que AQUI VALE ABRIR? A lista usa isto para dar a cor do
 * marcador discreto — o verde (accent) é o "expandível", o cinza é "não tem nada".
 *
 * A expansão hoje mostra descrição E anexos (`DetalheContrato`), e o anexo só dá pra saber
 * perguntando à API (`GET /contratos/{id}/arquivos`) — a lista não faz essa pergunta antes
 * do clique. Então a seta é sempre expandível: contrato sem descrição e com anexo não pode
 * parecer vazio (correção 1, Fase 1 de `docs/plano-correcoes-comercial-contratos-tarefas.md`).
 *
 * Fica em `lib/` porque o contrato e' um tipo do cliente de API: tanto a lista do
 * dialog de contratos quanto a tela de Contratos Clientes consultam.
 */
export function temDetalhes(contrato: Contrato): boolean {
  // A assinatura fica (as duas listas chamam pelo mesmo lugar) — por ora não lê nada do
  // contrato: sem a pergunta à API não há como distinguir "vazio" de "só com anexo".
  return true;
}
