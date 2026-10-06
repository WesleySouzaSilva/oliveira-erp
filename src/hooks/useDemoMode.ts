import { useEffect, useState } from "react";

const KEY = "oa_demo_mode";
const EVT = "oa-demo-mode-change";

export function useDemoMode() {
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "1";
  });

  useEffect(() => {
    const root = document.body;
    if (on) root.classList.add("demo-mode");
    else root.classList.remove("demo-mode");
    localStorage.setItem(KEY, on ? "1" : "0");
  }, [on]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "boolean") setOn(detail);
    };
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  };

  return { on, toggle, setOn };
}