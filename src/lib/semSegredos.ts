// Impede que senhas, códigos de verificação ou logins do cliente (gov.br) sejam
// digitados em campos de texto do sistema. O app não guarda credenciais do cliente.

const GATILHOS = [
  /\bsenha\b/i,
  /\bpassword\b/i,
  /\bc[oó]digo\s+(de\s+)?(verifica|acesso|seguran)/i,
  /\bcodigo\s+sms\b/i,
  /\btoken\b/i,
  /\bpin\b\s*[:=]/i,
  /\blogin\s*[:=]/i,
  /\bgov\.?br\s*[:=]\s*\S+/i,
];

/** Retorna null quando o texto é seguro, ou a mensagem de recusa. */
export function checarSegredo(texto: string | null | undefined): string | null {
  const t = (texto || "").trim();
  if (!t) return null;
  if (GATILHOS.some((re) => re.test(t))) {
    return "Não guardamos senha, código ou login do cliente. Apague esse trecho para salvar.";
  }
  // sequência isolada de 4 a 8 dígitos costuma ser código de verificação
  if (/(^|\s)\d{4,8}(\s|$)/.test(t) && /(c[oó]digo|sms|autentic)/i.test(t)) {
    return "Não guardamos código de verificação. Apague esse trecho para salvar.";
  }
  return null;
}
