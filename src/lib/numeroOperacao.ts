/**
 * Trava contra o defeito de importação em que o número da operação veio
 * preenchido com o CPF do titular (o número do Banco do Brasil tem o mesmo
 * formato do começo de um CPF: três grupos de três dígitos).
 */

export const MSG_NUMERO_E_CPF = "Esse número é o CPF do titular, não o número do contrato";

export const ROTULO_NUMERO_INVALIDO = "número inválido — conferir na cédula";

export const soDigitos = (v: string | null | undefined) => (v || "").replace(/\D/g, "");

/**
 * Verdadeiro quando o número digitado é, na prática, o CPF/CNPJ de alguém do
 * grupo: igual ao documento inteiro, ou igual aos 9 primeiros dígitos de um CPF.
 */
export function numeroEhDocumento(numero: string | null | undefined, documentos: (string | null | undefined)[]): boolean {
  const n = soDigitos(numero);
  if (!n) return false;
  return documentos.some((doc) => {
    const d = soDigitos(doc);
    if (d.length !== 11 && d.length !== 14) return false;
    if (d === n) return true;
    return d.length === 11 && n.length === 9 && d.slice(0, 9) === n;
  });
}
