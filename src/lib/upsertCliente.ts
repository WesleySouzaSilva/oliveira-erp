import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-creates or updates a client record from laudo data.
 * Uses upsert on (user_id, nome) unique constraint.
 */
export async function upsertClienteFromLaudo(
  userId: string,
  dados: Record<string, any>
) {
  const nome = dados.nome || dados.nomeProdutor;
  if (!nome || typeof nome !== "string" || nome.trim().length < 2) return;

  const row: Record<string, any> = {
    user_id: userId,
    nome: nome.trim(),
  };

  // Resolve user's organization to ensure team-wide visibility (RLS shares_org)
  try {
    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (membro?.organizacao_id) row.organizacao_id = membro.organizacao_id;
  } catch {
    // best-effort
  }

  // Map common laudo fields to client profile
  if (dados.cpf) row.cpf_cnpj = dados.cpf;
  if (dados.cnpj) row.cpf_cnpj = dados.cnpj;
  if (dados.cpf_cnpj) row.cpf_cnpj = dados.cpf_cnpj;
  if (dados.rg) row.rg = dados.rg;
  if (dados.nacionalidade) row.nacionalidade = dados.nacionalidade;
  if (dados.estadoCivil || dados.estado_civil) row.estado_civil = dados.estadoCivil || dados.estado_civil;
  if (dados.profissao) row.profissao = dados.profissao;
  if (dados.endereco) row.endereco = dados.endereco;
  if (dados.municipio) row.municipio = dados.municipio;
  if (dados.uf) row.uf = dados.uf;
  if (dados.cep) row.cep = dados.cep;
  if (dados.telefone) row.telefone = dados.telefone;
  if (dados.email) row.email = dados.email;
  if (dados.nomePropriedade || dados.propriedade) row.nome_propriedade = dados.nomePropriedade || dados.propriedade;
  if (dados.areaHectares || dados.area_hectares || dados.area) {
    const area = dados.areaHectares || dados.area_hectares || dados.area;
    const parsed = parseFloat(area);
    if (!isNaN(parsed)) row.area_hectares = parsed;
  }
  if (dados.cultura || dados.culturas?.[0] || dados.cultura_principal) {
    row.cultura_principal = dados.cultura || dados.culturas?.[0] || dados.cultura_principal;
  }

  try {
    await supabase
      .from("clientes" as any)
      .upsert(row, { onConflict: "user_id,nome" });
  } catch {
    // Silent fail — client creation is a best-effort side effect
  }
}
