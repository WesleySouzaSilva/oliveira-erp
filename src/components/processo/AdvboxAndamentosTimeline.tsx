import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Inbox, Activity, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type Andamento = {
  id: string;
  data: string;
  descricao: string;
  tipo: string | null;
  sincronizado_em: string;
  visivel_cliente: boolean;
};

interface Props {
  processoId: string;
  reloadKey?: number;
}

export function AdvboxAndamentosTimeline({ processoId, reloadKey }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Andamento[]>([]);

  const load = useCallback(async () => {
    if (!processoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("processo_andamentos")
      .select("id, data, descricao, tipo, sincronizado_em, visivel_cliente")
      .eq("processo_id", processoId)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setItems(data as Andamento[]);
    setLoading(false);
  }, [processoId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const toggleVisivel = async (a: Andamento) => {
    const novo = !a.visivel_cliente;
    setItems((cur) => cur.map((x) => (x.id === a.id ? { ...x, visivel_cliente: novo } : x)));
    const { error } = await supabase
      .from("processo_andamentos")
      .update({ visivel_cliente: novo })
      .eq("id", a.id);
    if (error) {
      setItems((cur) => cur.map((x) => (x.id === a.id ? { ...x, visivel_cliente: !novo } : x)));
      toast.error("Não foi possível atualizar visibilidade");
    } else {
      toast.success(novo ? "Visível ao cliente no portal" : "Oculto para o cliente");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Andamentos (ADVBOX)</h3>
        {!loading && items.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">{items.length} movimento(s)</span>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Inbox className="h-6 w-6 opacity-60" />
          <span>Nenhum andamento sincronizado ainda.</span>
          <span className="text-xs">Vincule ao ADVBOX e clique em "Sincronizar andamentos".</span>
        </div>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-4">
          {items.map((m) => (
            <li key={m.id} className="ml-4">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <time>{new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}</time>
                {m.tipo && (
                  <span className="px-1.5 py-0.5 rounded bg-muted text-foreground border border-border text-[10px] uppercase tracking-wide">
                    {m.tipo}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleVisivel(m)}
                  className={
                    "ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide transition-colors " +
                    (m.visivel_cliente
                      ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70")
                  }
                  title={m.visivel_cliente ? "Visível ao cliente no portal — clique para ocultar" : "Oculto — clique para liberar ao cliente"}
                >
                  {m.visivel_cliente ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {m.visivel_cliente ? "Cliente vê" : "Interno"}
                </button>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{m.descricao}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}