/**
 * Lê todas as linhas de uma consulta em blocos de 1.000, contornando o teto
 * de linhas da API (que cortaria a lista em silêncio). Devolve o mesmo formato
 * { data, error } de uma consulta comum.
 *
 * Uso: lerTudo(() => supabase.from("clientes").select("id, nome").is("deleted_at", null))
 * A função precisa criar a consulta de novo a cada chamada.
 */
const BLOCO = 1000;

export async function lerTudo<T = any>(
  montar: () => any,
): Promise<{ data: T[] | null; error: any }> {
  const todas: T[] = [];
  for (let de = 0; ; de += BLOCO) {
    // "id" como desempate garante blocos estáveis entre as páginas.
    const { data, error } = await montar().order("id", { ascending: true }).range(de, de + BLOCO - 1);
    if (error) return { data: de === 0 ? null : todas, error };
    const linhas = (data || []) as T[];
    todas.push(...linhas);
    if (linhas.length < BLOCO) break;
  }
  return { data: todas, error: null };
}
