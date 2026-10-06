// Limites de upload aplicados nas telas (o bucket também limita o tamanho).
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const EXTENSOES_PERMITIDAS = ["pdf", "jpg", "jpeg", "png", "docx", "xlsx"] as const;

/** Atributo accept para <input type="file"> */
export const ACCEPT_ARQUIVOS =
  ".pdf,.jpg,.jpeg,.png,.docx,.xlsx,application/pdf,image/jpeg,image/png," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Retorna null quando o arquivo é aceito, ou a mensagem de erro em PT-BR. */
export function validarArquivo(file: File): string | null {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!(EXTENSOES_PERMITIDAS as readonly string[]).includes(ext)) {
    return `"${file.name}": tipo não permitido. Envie apenas PDF, JPG, PNG, DOCX ou XLSX.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}": arquivo maior que ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

/** Valida uma lista; retorna a primeira mensagem de erro ou null. */
export function validarArquivos(files: File[] | FileList): string | null {
  for (const f of Array.from(files)) {
    const erro = validarArquivo(f);
    if (erro) return erro;
  }
  return null;
}
