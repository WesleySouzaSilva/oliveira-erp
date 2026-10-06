/** Perguntas de entrevista específicas por cultura (reunião inicial com o produtor). */

export interface PerguntaEntrevista {
  key: string;
  label: string;
  tipo?: "texto" | "numero" | "longo";
  dica?: string;
}

export const CAUSAS_FRUSTRACAO = [
  "Estiagem / seca",
  "Geada",
  "Chuva excessiva",
  "Granizo",
  "Vendaval",
  "Praga ou doença",
  "Outra",
];

const GRAOS: PerguntaEntrevista[] = [
  { key: "produtividade_esperada", label: "Produtividade esperada (sc/ha)", tipo: "numero" },
  { key: "produtividade_colhida", label: "Produtividade colhida (sc/ha)", tipo: "numero" },
  { key: "area_plantada", label: "Área plantada da cultura (ha)", tipo: "numero" },
  { key: "data_plantio", label: "Data de plantio" },
  { key: "data_colheita", label: "Data da colheita" },
  { key: "talhoes", label: "Talhões afetados e observações", tipo: "longo" },
];

const PERENE: PerguntaEntrevista[] = [
  { key: "estagio_lavoura", label: "Estágio da lavoura (formação / produção)" },
  { key: "idade_lavoura", label: "Idade média da lavoura (anos)", tipo: "numero" },
  { key: "producao_esperada", label: "Produção esperada (sc/ha ou t/ha)", tipo: "numero" },
  { key: "producao_obtida", label: "Produção obtida (sc/ha ou t/ha)", tipo: "numero" },
  { key: "danos_plantas", label: "Danos às plantas (perda permanente?)", tipo: "longo" },
];

const PECUARIA: PerguntaEntrevista[] = [
  { key: "rebanho_total", label: "Rebanho total (cabeças)", tipo: "numero" },
  { key: "lotacao", label: "Lotação (UA/ha)", tipo: "numero" },
  { key: "mortalidade", label: "Mortalidade no período (cabeças)", tipo: "numero" },
  { key: "area_pastagem", label: "Área de pastagem afetada (ha)", tipo: "numero" },
  { key: "suplementacao", label: "Precisou de suplementação / compra de volumoso?", tipo: "longo" },
];

export const PERGUNTAS_POR_CULTURA: Record<string, PerguntaEntrevista[]> = {
  Soja: GRAOS,
  Milho: GRAOS,
  Arroz: GRAOS,
  Feijão: GRAOS,
  Trigo: GRAOS,
  Algodão: GRAOS,
  "Café Arábica": PERENE,
  "Café Conilon": PERENE,
  Laranja: PERENE,
  "Cana-de-açúcar": PERENE,
  Eucalipto: PERENE,
  Mandioca: GRAOS,
  Sericicultura: PERENE,
  "Pecuária Bovina de Corte": PECUARIA,
  "Pecuária Bovina Leiteira": PECUARIA,
};

const GENERICAS: PerguntaEntrevista[] = [
  { key: "producao_esperada", label: "Produção esperada", tipo: "numero" },
  { key: "producao_obtida", label: "Produção obtida", tipo: "numero" },
  { key: "area_afetada", label: "Área afetada (ha)", tipo: "numero" },
  { key: "observacoes_cultura", label: "Observações da cultura", tipo: "longo" },
];

export function perguntasDaCultura(cultura?: string): PerguntaEntrevista[] {
  if (!cultura) return GENERICAS;
  return PERGUNTAS_POR_CULTURA[cultura] || GENERICAS;
}

/** Documentos habitualmente recolhidos na reunião inicial. */
export const DOCUMENTOS_ENTREVISTA = [
  "Contratos de crédito rural",
  "Extratos / evolução da dívida",
  "Notas fiscais de venda da produção",
  "Notas fiscais de insumos",
  "Matrícula do imóvel / contrato de arrendamento",
  "CAR e/ou ITR",
  "Apólice de seguro agrícola / Proagro",
  "Laudos anteriores (se houver)",
  "Documentos pessoais (RG/CPF, comprovante de residência)",
  "Declaração de aptidão / DAP-CAF (se aplicável)",
];