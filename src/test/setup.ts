import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom não tem ResizeObserver — Radix (Popover/Dialog) e cmdk (Command) chamam no mount
// e derrubariam o teste com "ResizeObserver is not defined".
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: ResizeObserverStub,
  });
}

// cmdk (Command) rola o item selecionado com scrollIntoView — jsdom não implementa.
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom não implementa pointer capture — o Radix Select chama
// `hasPointerCapture` no pointerdown e derrubaria o teste com erro não tratado.
if (typeof Element !== "undefined" && typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// Ambientes sem localStorage (node --experimental-... / jsdom enxuto): o Layout do ERP
// lê/escreve escolhas de menu (recolhido, grupos) — sem stub o componente quebra no mount.
if (typeof window.localStorage === "undefined" || window.localStorage === null) {
  const mapa = new Map<string, string>();
  const stub = {
    getItem: (chave: string) => mapa.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void mapa.set(chave, String(valor)),
    removeItem: (chave: string) => void mapa.delete(chave),
    clear: () => mapa.clear(),
    key: (indice: number) => [...mapa.keys()][indice] ?? null,
    get length() {
      return mapa.size;
    },
  };
  Object.defineProperty(window, "localStorage", { writable: true, value: stub });
}
