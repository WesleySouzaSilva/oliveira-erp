import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOAD_KEY = "lazy-chunk-reloaded";

type Preloadable<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  /** Baixa o pedaço de código da tela sem renderizar (mesma função de import). */
  preload: () => Promise<unknown>;
};

/**
 * React.lazy com resiliência a chunks obsoletos (após um novo deploy o hash
 * dos arquivos muda e o import dinâmico antigo retorna 404).
 * Tenta novamente uma vez e, se ainda falhar, recarrega a página uma única vez.
 * Expõe `.preload()` para baixar o código antes do clique, reaproveitando o mesmo import.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): Preloadable<T> {
  const Comp = lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      // segunda tentativa (pode ser falha de rede momentânea)
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      } catch (err2) {
        if (sessionStorage.getItem(RELOAD_KEY) !== "1") {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err2;
      }
    }
  }) as Preloadable<T>;
  let pending: Promise<unknown> | null = null;
  Comp.preload = () => {
    // Falha no pré-carregamento é silenciosa: o clique tenta de novo normalmente.
    pending ??= factory().catch(() => { pending = null; });
    return pending;
  };
  return Comp;
}

// ─── Pré-carregamento de telas (etapa 1B) ───────────────────────────────────

const rotas = new Map<string, { preload: () => Promise<unknown> }>();

export function registrarRotas(mapa: Record<string, { preload: () => Promise<unknown> }>) {
  Object.entries(mapa).forEach(([p, c]) => rotas.set(p, c));
}

/** Conexão lenta ou economia de dados ligada: não baixa nada a mais. */
function conexaoEconomica(): boolean {
  const c = (navigator as any).connection;
  if (!c) return false;
  return !!c.saveData || /(^|-)2g$/.test(String(c.effectiveType || ""));
}

/** Baixa o código da tela de um caminho (ex.: ao passar o mouse no menu). */
export function preloadRota(pathname: string) {
  if (conexaoEconomica()) return;
  const limpo = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  rotas.get(limpo)?.preload();
}

const MAIS_USADAS = [
  "/", "/clientes", "/controladoria", "/tarefas", "/agenda",
  "/vencimentos", "/processos", "/inbox", "/assinaturas", "/treinamentos",
];

let agendado = false;
/** Depois da primeira tela, com o navegador ocioso, baixa as telas mais usadas, uma de cada vez. */
export function preloadMaisUsadasQuandoOcioso() {
  if (agendado || typeof window === "undefined") return;
  agendado = true;
  const ocioso = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback as undefined | ((f: () => void, o?: any) => number);
    if (ric) ric(cb, { timeout: 5000 });
    else setTimeout(cb, 2500);
  };
  const fila = [...MAIS_USADAS];
  const proxima = () => {
    if (conexaoEconomica()) return;
    const p = fila.shift();
    if (!p) return;
    const r = rotas.get(p);
    (r ? r.preload() : Promise.resolve()).finally(() => ocioso(proxima));
  };
  const iniciar = () => ocioso(proxima);
  if (document.readyState === "complete") setTimeout(iniciar, 1500);
  else window.addEventListener("load", () => setTimeout(iniciar, 1500), { once: true });
}
