/**
 * CONFIGURAÇÃO DA API — arquivo único a alterar.
 *
 * Mudou host, porta ou versão da API? Edite `API_BASE_URL` aqui (ou defina `VITE_API_URL` no
 * `.env` para sobrescrever sem tocar no código). Nenhum outro arquivo do front deve montar
 * URL de API: tudo passa por `apiUrl()` / `apiFetch()` de `src/lib/api/http.ts`.
 *
 * Em produção o front e a API servem do mesmo domínio (`/api` via proxy reverso), aí basta
 * definir `VITE_API_URL=/api/v1` — ver `oliveira-api/docs/COMO-RODAR.md`.
 */

/**
 * URL base da API, sem barra no final (ex.: `http://localhost:8080/api/v1`).
 *
 * Sem `VITE_API_URL`, a API é procurada no MESMO host que serviu o front — assim o mesmo
 * código vale no desktop (`localhost:8080`) e no celular pela rede local
 * (`http://192.168.x.x:5173` → API em `http://192.168.x.x:8080`), desde que a API esteja na
 * mesma máquina. Para API em outra máquina/domínio, defina `VITE_API_URL` no `.env`; em
 * produção use o caminho relativo do proxy (ex.: `/api/v1`), que não passa por aqui.
 */
function urlPadraoDaApi(): string {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  return `http://${host || "localhost"}:8080/api/v1`;
}

const URL_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? urlPadraoDaApi();

/** URL base da API, sem barra no final (ex.: `http://localhost:8080/api/v1`). */
export const API_BASE_URL = URL_BASE.replace(/\/+$/, "");

/** Tempo máximo de uma chamada antes de abortar (ms). */
export const API_TIMEOUT_MS = 15000;

/**
 * Monta a URL de um recurso: `apiUrl("/clientes", { nome: "João" })`
 * → `http://localhost:8080/api/v1/clientes?nome=Jo%C3%A3o`.
 * Chaves com valor `undefined`/`null`/`""` são ignoradas.
 */
export function apiUrl(caminho: string, params?: Record<string, string | number | null | undefined>): string {
  const url = `${API_BASE_URL}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
  if (!params) return url;

  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === "") continue;
    consulta.set(chave, String(valor));
  }
  const texto = consulta.toString();
  return texto ? `${url}?${texto}` : url;
}
