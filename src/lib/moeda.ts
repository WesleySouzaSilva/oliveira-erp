/**
 * Conversão de texto de valor monetário (pt-BR) para o número que vai na API.
 *
 * Regra do escritório (19/10/2026): dinheiro NUNCA passa por float/double com
 * arredondamento de piso binário — a API é `BigDecimal` e o banco `numeric(15,2)`,
 * então o front só pode mandar o valor EXATO em centavos inteiros.
 *
 * Aceita os formatos que o usuário digita no campo:
 *   "20000"      -> 20000
 *   "20000,50"   -> 20000.5
 *   "20.000,50"  -> 20000.5   (pontos de milhar caem quando há vírgula)
 *   "20000.5"    -> 20000.5   (ponto decimal também aceito)
 *
 * Retorna `null` para vazio e `Number.NaN` para formato inválido (a tela avisa
 * e o envio não sai).
 */
export function textoParaValor(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "").replace(/^R\$\s*/i, "");
  if (!limpo) return null;

  // Há vírgula = convenção brasileira: troca vírgula por ponto e descarta os
  // pontos de milhar ("20.000,50" -> "20000.50").
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return Number.NaN;

  // Centavos como INTEIRO: nada de multiplicar/dividir número quebrado.
  const [inteiro, fracionario = ""] = normal.split(".");
  const centavos = Number(inteiro) * 100 + Number((fracionario + "00").slice(0, 2));
  if (!Number.isSafeInteger(centavos)) return Number.NaN;

  // Divisão por 100: o JSON.stringify grava o texto curto ("19999.98") e o
  // BigDecimal da API lê esse texto — sem perda no caminho.
  return centavos / 100;
}
