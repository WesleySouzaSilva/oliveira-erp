import { useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * "Ver como": o admin/CEO confere a interface com os olhos de outra pessoa.
 * EXCLUSIVAMENTE VISUAL E SOMENTE LEITURA: não troca a sessão, não emite
 * token, não altera auth.uid(). O RLS continua sendo o do admin; o modo só
 * FILTRA a interface. Toda escrita é barrada antes da chamada pelo guarda
 * instalado no cliente do banco (instalarGuardaVerComo).
 */
export interface AlvoVerComo { user_id: string; nome: string }

const KEY = "oliveira:ver-como";
let alvo: AlvoVerComo | null = (() => {
  try { const s = sessionStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
})();
const ouvintes = new Set<() => void>();

export function getVerComo() { return alvo; }
export function setVerComo(novo: AlvoVerComo | null) {
  alvo = novo;
  try { novo ? sessionStorage.setItem(KEY, JSON.stringify(novo)) : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  ouvintes.forEach((f) => f());
}
function assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

/** Alvo atual (ou null). */
export function useVerComo() {
  return useSyncExternalStore(assinar, getVerComo, getVerComo);
}
/** true quando a interface deve se comportar como somente leitura. */
export function useSomenteLeitura() { return !!useVerComo(); }

/**
 * Usuário "efetivo" para LEITURA de telas pessoais (meus treinamentos etc.):
 * no modo, o id da pessoa vista. Nunca use para gravar: nesse modo nada grava.
 */
export function useUsuarioEfetivo() {
  const { user } = useAuth();
  const a = useVerComo();
  if (a) return { user: { id: a.user_id, email: undefined as string | undefined }, somenteLeitura: true, real: user };
  return { user: user ? { id: user.id, email: user.email } : null, somenteLeitura: false, real: user };
}

export const MSG_BLOQUEIO = "Modo ver como: somente leitura. Nada foi gravado.";

/**
 * Funções do banco que só LEEM e podem rodar no modo. Qualquer outra é barrada.
 * Na dúvida, fica fora da lista (bloquear é o lado seguro).
 */
const RPC_LEITURA = new Set([
  "trein_meu_papel", "trein_papel_de", "trein_quiz_perguntas", "tem_codigos_tribunais",
  "ver_como_pode", "get_proximos_vencimentos_kanban",
]);
const RPC_PREFIXOS_LEITURA = ["get_", "is_", "has_", "can_", "user_org_ids", "shares_org"];

export function rpcPermitidaNoModo(nome: string) {
  return RPC_LEITURA.has(nome) || RPC_PREFIXOS_LEITURA.some((p) => nome.startsWith(p));
}

const ESCRITA_TABELA = new Set(["insert", "update", "upsert", "delete"]);
const ESCRITA_STORAGE = new Set(["upload", "update", "remove", "move", "copy", "uploadToSignedUrl", "createSignedUploadUrl"]);

/** Resultado "falso" encadeável: qualquer .eq/.select/.single volta a si mesmo; await dá erro. */
function bloqueado(): any {
  const res = { data: null, error: { message: MSG_BLOQUEIO, code: "VER_COMO" }, count: null, status: 403, statusText: "ver_como" };
  const p: any = new Proxy(function () { /* noop */ }, {
    get(_t, prop) {
      if (prop === "then") return (ok: any, fail: any) => Promise.resolve(res).then(ok, fail);
      if (prop === "catch" || prop === "finally") return (f: any) => Promise.resolve(res)[prop as "finally"](f);
      return p;
    },
    apply() { return p; },
  });
  return p;
}

let instalado = false;
/**
 * Envolve o cliente do banco: com o modo ativo, insert/update/upsert/delete,
 * RPCs que não são de leitura, funções (edge) e uploads/remoções no storage
 * retornam erro sem sair do navegador. Leituras seguem normais.
 */
export function instalarGuardaVerComo(client: any, ativo: () => boolean = () => !!alvo) {
  if (client.__guardaVerComo) return client;
  const from = client.from.bind(client);
  client.from = (tabela: string) => {
    const qb = from(tabela);
    return new Proxy(qb, {
      get(t, prop, r) {
        if (typeof prop === "string" && ESCRITA_TABELA.has(prop) && ativo()) return () => bloqueado();
        const v = Reflect.get(t, prop, r);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
  };
  const rpc = client.rpc.bind(client);
  client.rpc = (nome: string, ...args: any[]) => (ativo() && !rpcPermitidaNoModo(nome) ? bloqueado() : rpc(nome, ...args));
  // `functions` é um getter que cria um cliente novo a cada acesso: embrulha o getter.
  const proto = Object.getPrototypeOf(client);
  const desc = Object.getOwnPropertyDescriptor(client, "functions") || Object.getOwnPropertyDescriptor(proto, "functions");
  if (desc) {
    const pegar = desc.get ? () => desc.get!.call(client) : () => desc.value;
    Object.defineProperty(client, "functions", {
      configurable: true,
      get() {
        const fns = pegar();
        return new Proxy(fns, {
          get(t, prop, r) {
            if (prop === "invoke" && ativo()) return () => bloqueado();
            const v = Reflect.get(t, prop, r);
            return typeof v === "function" ? v.bind(t) : v;
          },
        });
      },
    });
  }
  if (client.storage?.from) {
    const sfrom = client.storage.from.bind(client.storage);
    client.storage.from = (bucket: string) => {
      const b = sfrom(bucket);
      return new Proxy(b, {
        get(t, prop, r) {
          if (typeof prop === "string" && ESCRITA_STORAGE.has(prop) && ativo()) return () => bloqueado();
          const v = Reflect.get(t, prop, r);
          return typeof v === "function" ? v.bind(t) : v;
        },
      });
    };
  }
  client.__guardaVerComo = true;
  instalado = true;
  return client;
}
export function guardaInstalada() { return instalado; }
