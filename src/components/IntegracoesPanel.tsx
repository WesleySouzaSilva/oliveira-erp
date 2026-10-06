import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Plug,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdvboxIntegration } from "./AdvboxIntegration";
import { ApiKeysManager } from "./ApiKeysManager";

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  configured: boolean;
  status: "ok" | "error" | "not_configured" | "skipped";
  message?: string;
  latency_ms?: number;
  docs_url?: string;
}

const statusUI: Record<
  Integration["status"],
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    label: "Conectado",
    cls: "bg-success/10 text-success border-success/30",
    Icon: CheckCircle2,
  },
  error: {
    label: "Erro",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: XCircle,
  },
  not_configured: {
    label: "Não conectado",
    cls: "bg-muted text-muted-foreground border-border",
    Icon: AlertCircle,
  },
  skipped: {
    label: "Não testado",
    cls: "bg-muted text-muted-foreground border-border",
    Icon: AlertCircle,
  },
};

export function IntegracoesPanel() {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("integrations-status");
    setLoading(false);
    if (error) {
      toast({
        title: "Erro ao testar integrações",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setItems(data?.integrations || []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" /> Integrações
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Veja o status de todos os serviços conectados e teste cada conexão.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Testar todas
        </button>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-3">
        {loading && items.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg bg-muted/40 animate-pulse"
              />
            ))
          : items.map((it) => {
              const s = statusUI[it.status];
              const isAdvbox = it.id === "advbox";
              const isOpen = expanded === it.id;
              return (
                <motion.div
                  key={it.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-lg border border-border shadow-card p-4 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {it.name}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {it.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {it.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border flex items-center gap-1 ${s.cls}`}
                    >
                      <s.Icon className="w-3 h-3" />
                      {s.label}
                    </span>
                  </div>

                  {it.message && (
                    <p
                      className={`text-[11px] mt-1 ${
                        it.status === "error"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {it.message}
                      {typeof it.latency_ms === "number" &&
                        ` · ${it.latency_ms}ms`}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {it.status === "not_configured" && it.docs_url && (
                      <a
                        href={it.docs_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg bg-accent text-accent-foreground font-medium hover:shadow-card-hover transition-all flex items-center gap-1"
                      >
                        Conectar <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {isAdvbox && it.configured && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : it.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1"
                      >
                        {isOpen ? (
                          <>
                            Ocultar painel <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Abrir painel <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {isAdvbox && isOpen && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <AdvboxIntegration />
                    </div>
                  )}
                </motion.div>
              );
            })}
      </div>

      <div className="border-t border-border pt-6 mt-6">
        <ApiKeysManager />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Para adicionar novas chaves de API de terceiros (Advbox, Meta, Claude), acesse as configurações de Lovable
        Cloud do projeto. As chaves ficam armazenadas com segurança e nunca são
        expostas no navegador.
      </p>
    </div>
  );
}