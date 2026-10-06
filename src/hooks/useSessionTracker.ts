import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buscarMembroAtual } from "@/hooks/useMembroAtual";

const SESSION_KEY = "oa_session_id";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Module-level guard para evitar inserts duplicados em StrictMode / remounts
let inFlightInsert: Promise<string | null> | null = null;

/**
 * Registra UMA sessão por aba do navegador em `user_sessions`.
 * - Reutiliza sessão via sessionStorage (não cria nova a cada navegação SPA)
 * - Heartbeat de 30s atualiza last_seen_at
 * - Em beforeunload usa fetch keepalive para garantir gravação de ended_at
 */
export function useSessionTracker() {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const startedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    let heartbeat: number | undefined;

    const getAuthHeader = async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || SUPABASE_KEY;
    };

    const patchSession = (id: string, body: Record<string, any>) => {
      // Usa fetch keepalive para resistir a unload
      void getAuthHeader().then((token) => {
        fetch(`${SUPABASE_URL}/rest/v1/user_sessions?id=eq.${id}`, {
          method: "PATCH",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(body),
        }).catch(() => {});
      });
    };

    (async () => {
      // Reaproveita sessão da aba se existir
      const existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) {
        sessionIdRef.current = existing;
        patchSession(existing, { last_seen_at: new Date().toISOString(), ended_at: null });
      } else {
        if (!inFlightInsert) {
          inFlightInsert = (async () => {
            const m = await buscarMembroAtual(user.id).catch(() => null);
            const orgId = m?.principal?.organizacao_id ?? null;
            const { data, error } = await supabase
              .from("user_sessions")
              .insert({ user_id: user.id, organizacao_id: orgId, user_agent: navigator.userAgent })
              .select("id")
              .single();
            if (error || !data) return null;
            sessionStorage.setItem(SESSION_KEY, data.id);
            return data.id;
          })();
        }
        const id = await inFlightInsert;
        if (cancelled || !id) return;
        sessionIdRef.current = id;
      }

      const ping = () => {
        if (!sessionIdRef.current) return;
        patchSession(sessionIdRef.current, { last_seen_at: new Date().toISOString() });
      };

      // Heartbeat 30s
      heartbeat = window.setInterval(ping, 30_000);

      const close = () => {
        if (!sessionIdRef.current) return;
        const iso = new Date().toISOString();
        patchSession(sessionIdRef.current, { ended_at: iso, last_seen_at: iso });
      };

      const onVis = () => {
        if (document.visibilityState === "hidden") {
          ping();
        } else {
          ping();
        }
      };

      window.addEventListener("beforeunload", close);
      window.addEventListener("pagehide", close);
      document.addEventListener("visibilitychange", onVis);

      return () => {
        window.removeEventListener("beforeunload", close);
        window.removeEventListener("pagehide", close);
        document.removeEventListener("visibilitychange", onVis);
      };
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      // Não fecha a sessão no unmount do hook — só ao fechar a aba
    };
  }, [user?.id]);
}
