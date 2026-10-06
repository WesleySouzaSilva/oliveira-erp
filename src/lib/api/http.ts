import { API_BASE_URL, API_TIMEOUT_MS, apiUrl } from "@/config/api";

/**
 * HTTP da API própria: token de acesso, timeout e o modelo de erro RFC 7807 da API
 * (`status`, `tipo`, `titulo`, `detalhe`, `listaCampos`).
 *
 * Autenticação: `POST /api/v1/auth/login` devolve o access token (guardado em `localStorage`);
 * a refresh token continua no cookie `httpOnly` da API — a renovação automática entra na
 * próxima etapa. Enquanto isso, expirou o token → volta para a tela de entrada.
 */

const CHAVE_TOKEN = "oliveira.api.token";
const CHAVE_EXPIRA_EM = "oliveira.api.expiraEm";
const CHAVE_USUARIO = "oliveira.api.usuario";

export interface CampoProblema {
  nome: string;
  mensagem: string;
}

export interface UsuarioApi {
  id: string;
  email: string;
  nome?: string;
  organizacaoId?: string;
  perfis?: string[];
  permissoes?: string[];
}

/** Erro de domínio vindo da API (ou falha de rede, com `status = 0`). */
export class ErroApi extends Error {
  readonly status: number;
  readonly tipo?: string;
  readonly detalhe?: string;
  readonly campos: CampoProblema[];

  constructor(mensagem: string, opcoes: { status?: number; tipo?: string; detalhe?: string; campos?: CampoProblema[] } = {}) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = opcoes.status ?? 0;
    this.tipo = opcoes.tipo;
    this.detalhe = opcoes.detalhe;
    this.campos = opcoes.campos ?? [];
  }
}

/** Mensagem amigável para a tela (o `detalhe` da API quando existe). */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi) return erro.detalhe || erro.message;
  if (erro instanceof Error) return erro.message;
  return "Erro inesperado.";
}

export function tokenApi(): string | null {
  try {
    const expiraEm = localStorage.getItem(CHAVE_EXPIRA_EM);
    if (expiraEm && new Date(expiraEm).getTime() <= Date.now()) {
      limparSessao();
      return null;
    }
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function usuarioApi(): UsuarioApi | null {
  try {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    return bruto ? (JSON.parse(bruto) as UsuarioApi) : null;
  } catch {
    return null;
  }
}

/** Sessão da API válida? Usado pelo `LayoutErp` para redirecionar ao login. */
export function autenticadoApi(): boolean {
  return tokenApi() !== null;
}

function guardarSessao(resposta: {
  accessToken: string;
  expiraEm: string;
  usuario?: UsuarioApi;
}): void {
  localStorage.setItem(CHAVE_TOKEN, resposta.accessToken);
  localStorage.setItem(CHAVE_EXPIRA_EM, resposta.expiraEm);
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(resposta.usuario ?? {}));
}

function limparSessao(): void {
  try {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_EXPIRA_EM);
    localStorage.removeItem(CHAVE_USUARIO);
  } catch {
    /* sem localStorage (SSR/bloqueio): nada a limpar */
  }
}

/**
 * Chamada autenticada à API.
 * - monta a URL a partir de `src/config/api.ts`;
 * - aborta em `API_TIMEOUT_MS`;
 * - converte o corpo RFC 7807 em `ErroApi`;
 * - em 401 limpa a sessão (o guard manda para a tela de entrada).
 */
async function chamada<T>(
  caminho: string,
  opcoes: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; params?: Record<string, string | number | null | undefined> } = {},
): Promise<T> {
  const { method = "GET", body, params } = opcoes;
  const token = tokenApi();

  const cabecalhos: Record<string, string> = {};
  if (body !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (token) cabecalhos["Authorization"] = `Bearer ${token}`;

  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), API_TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(apiUrl(caminho, params), {
      method,
      headers: cabecalhos,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controle.signal,
      // cookie httpOnly da refresh token: precisa de credenciais cross-origin (localhost:5173 -> 8080)
      credentials: "include",
    });
  } catch (erro) {
    throw new ErroApi(
      controle.signal.aborted
        ? `A API não respondeu em ${API_TIMEOUT_MS} ms (${API_BASE_URL}).`
        : `Não foi possível falar com a API em ${API_BASE_URL}. Verifique se ela está no ar.`,
      { status: 0 },
    );
  } finally {
    clearTimeout(tempo);
  }

  const conteudo = await lerCorpo(resposta);

  if (resposta.ok) return conteudo as T;

  if (resposta.status === 401) limparSessao();

  const problema = (conteudo ?? {}) as {
    status?: number;
    tipo?: string;
    titulo?: string;
    detalhe?: string;
    listaCampos?: CampoProblema[];
  };
  throw new ErroApi(problema.detalhe || problema.titulo || `Falha na requisição (HTTP ${resposta.status}).`, {
    status: resposta.status,
    tipo: problema.tipo,
    detalhe: problema.detalhe,
    campos: problema.listaCampos,
  });
}

/**
 * Chamada pública: se a API responder 401 (access token de 15 min expirado), tenta renovar a
 * sessão com o cookie `refresh_token` e repete a chamada uma vez. Renovou? Ninguém percebe;
 * não renovou → sessão limpa e a tela manda para o login.
 */
export async function apiFetch<T>(
  caminho: string,
  opcoes: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; params?: Record<string, string | number | null | undefined> } = {},
): Promise<T> {
  try {
    return await chamada<T>(caminho, opcoes);
  } catch (erro) {
    const expirou = erro instanceof ErroApi && erro.status === 401 && !caminho.startsWith("/auth/");
    if (expirou && (await renovarSessao())) {
      return chamada<T>(caminho, opcoes);
    }
    throw erro;
  }
}

/** `POST /auth/refresh` usando o cookie httpOnly (rotaciona a refresh token). */
async function renovarSessao(): Promise<boolean> {
  try {
    const resposta = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!resposta.ok) return false;
    const sessao = (await resposta.json()) as {
      accessToken: string;
      expiraEm: string;
      usuario?: UsuarioApi;
    };
    if (!sessao?.accessToken) return false;
    guardarSessao(sessao);
    return true;
  } catch {
    return false;
  }
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  if (resposta.status === 204) return null;
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** Login na API própria. Guarda token/usuário e devolve o usuário autenticado. */
export async function loginApi(email: string, senha: string): Promise<UsuarioApi> {
  const sessao = await apiFetch<{ accessToken: string; tokenType: string; expiraEm: string; usuario: UsuarioApi }>(
    "/auth/login",
    { method: "POST", body: { email, senha } },
  );
  guardarSessao(sessao);
  return sessao.usuario;
}

/** `GET /auth/me`: confirma o token e devolve o usuário do vínculo atual. */
export async function buscarUsuarioAtual(): Promise<UsuarioApi> {
  const usuario = await apiFetch<UsuarioApi>("/auth/me");
  try {
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
  } catch {
    /* sem localStorage: segue com o usuário só em memória */
  }
  return usuario;
}

/** Logout (revoga a refresh token) e limpa a sessão local — nunca falha para a tela. */
export async function logoutApi(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  } catch {
    /* já sem sessão local ou API fora do ar: seguimos com o logout da tela */
  } finally {
    limparSessao();
  }
}
