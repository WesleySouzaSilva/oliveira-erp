/** Mapeia um registro de `clientes` para os campos da etapa 1 do laudo. */
export interface ClienteLaudo {
  id: string;
  nome: string;
  cpf_cnpj?: string | null;
  rg?: string | null;
  telefone?: string | null;
  email?: string | null;
  municipio?: string | null;
  uf?: string | null;
  endereco?: string | null;
  area_hectares?: number | null;
  cultura_principal?: string | null;
  nome_propriedade?: string | null;
  estado_civil?: string | null;
  profissao?: string | null;
  nacionalidade?: string | null;
}

export const CLIENTE_SELECT =
  "id, nome, cpf_cnpj, rg, telefone, email, municipio, uf, endereco, area_hectares, cultura_principal, nome_propriedade, estado_civil, profissao, nacionalidade";

export function mapClienteParaEtapa1(
  c: ClienteLaudo,
  extras: Record<string, any> = {},
): Record<string, any> {
  return {
    _clientSource: "existente",
    _clienteId: c.id,
    nome: c.nome,
    nomeProdutor: c.nome,
    cpf: c.cpf_cnpj || "",
    cpfCnpj: c.cpf_cnpj || "",
    rg: c.rg || "",
    telefone: c.telefone || "",
    email: c.email || "",
    municipio: c.municipio || "",
    uf: c.uf || "",
    endereco: c.endereco || "",
    area: c.area_hectares ?? "",
    areaHectares: c.area_hectares ?? "",
    cultura: c.cultura_principal || "",
    culturaPrincipal: c.cultura_principal || "",
    nomePropriedade: c.nome_propriedade || "",
    estadoCivil: c.estado_civil || "",
    profissao: c.profissao || "Produtor Rural",
    nacionalidade: c.nacionalidade || "Brasileira",
    ...extras,
  };
}