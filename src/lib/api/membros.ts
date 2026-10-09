import { apiFetch } from "@/lib/api/http";

/**
 * Colaboradores da organizacao (`GET /api/v1/membros`) — modulo `identity/membro`.
 *
 * Leitura aberta a qualquer membro (a API so exige estar autenticado): serve para o
 * nome na coluna "Responsavel" da lista de tarefas, para o select de encaminhar e para
 * a visao de equipe. Os campos casam com `MembroDTO`.
 */
export interface Setor {
  id: string;
  nome: string;
  ordem?: number;
  ativo?: boolean;
}

export interface Membro {
  id: string;
  /** `usuarios.id` — e o que a tarefa guarda em `responsavelId`. */
  userId: string;
  email?: string | null;
  nome?: string | null;
  papel?: string | null;
  ceo: boolean;
  setores?: Setor[] | null;
}

export function listarMembros(): Promise<Membro[]> {
  return apiFetch<Membro[]>("/membros");
}

/**
 * Mapa `userId -> nome` para a lista de tarefas nomear o responsavel sem N+1.
 * Fica vazio se a chamada falhar — a coluna mostra o id, a tela nao quebra.
 */
export async function mapaDeNomes(): Promise<Map<string, string>> {
  try {
    const membros = await listarMembros();
    return new Map(membros.map((membro) => [membro.userId, membro.nome || membro.email || "—"]));
  } catch {
    return new Map();
  }
}
