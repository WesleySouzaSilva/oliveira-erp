import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loaders";
import { brData } from "@/lib/controladoria";
import { cn } from "@/lib/utils";

const COLS = [0, 1, 2, 3, 4, 5];

export default function PrazosD5Tab() {
  const qc = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["controladoria_d5"],
    queryFn: async () => {
      const { data: snap } = await supabase.from("controladoria_d5_snapshots")
        .select("*").order("gerado_em", { ascending: false }).limit(1).maybeSingle();
      if (!snap) return null;
      const itens: any[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data: d } = await supabase.from("controladoria_d5_itens").select("*").eq("snapshot_id", snap.id).range(from, from + 999);
        itens.push(...(d || []));
        if ((d || []).length < 1000) break;
      }
      const { data: profs } = await supabase.from("profiles").select("id, nome");
      const nomes = new Map(((profs as any[]) || []).map((p) => [p.id, p.nome]));
      return { snap, itens, nomes };
    },
  });

  const grupos = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, any[]>();
    for (const i of data.itens) {
      const k = (i.user_id && data.nomes.get(i.user_id)) || i.responsavel_nome || "Sem responsável";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  async function gerar() {
    setGerando(true);
    const { data: r, error } = await supabase.functions.invoke("controladoria-d5", { body: {} });
    setGerando(false);
    const e = error?.message || (r as any)?.resultado?.[0]?.erro;
    if (e) { toast.error(e); return; }
    toast.success("Retrato do dia gerado");
    qc.invalidateQueries({ queryKey: ["controladoria_d5"] });
  }

  if (isLoading) return <ListSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {data?.snap ? (
          <p className="text-sm text-muted-foreground">
            Retrato de {new Date(data.snap.gerado_em).toLocaleString("pt-BR")} · D-0 {brData(data.snap.d0)} até D-5 {brData(data.snap.janela_fim)} ·{" "}
            <strong>{data.snap.total_janela}</strong> na janela · <strong className="text-destructive">{data.snap.total_vencidas}</strong> vencidas
          </p>
        ) : <p className="text-sm text-muted-foreground">Nenhum retrato gerado ainda.</p>}
        <Button className="ml-auto" variant="outline" onClick={gerar} disabled={gerando}>
          <RefreshCw className={cn("w-4 h-4 mr-2", gerando && "animate-spin")} /> Gerar novamente
        </Button>
      </div>

      {grupos.map(([nome, itens]) => {
        const venc = itens.filter((i) => i.vencida).sort((a, b) => a.prazo.localeCompare(b.prazo));
        return (
          <Card key={nome} className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-semibold">{nome}</h3>
              <Badge variant="outline">{itens.length - venc.length} na janela</Badge>
              {venc.length > 0 && <Badge variant="destructive">{venc.length} vencidas</Badge>}
            </div>
            {venc.length > 0 && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 space-y-1">
                {venc.map((i) => <Linha key={i.id} i={i} vencida />)}
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-6">
              {COLS.map((n) => {
                const col = itens.filter((i) => !i.vencida && i.d_n === n);
                return (
                  <div key={n} className="rounded border p-2 min-h-16">
                    <div className="text-xs font-semibold mb-1">D-{n} <span className="text-muted-foreground">({col.length})</span></div>
                    <div className="space-y-1">{col.map((i) => <Linha key={i.id} i={i} compacta />)}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Linha({ i, vencida, compacta }: { i: any; vencida?: boolean; compacta?: boolean }) {
  return (
    <div className={cn("text-xs", vencida && "text-destructive")} title={`${i.titulo} ${i.processo ?? ""} ${i.cliente ?? ""}`}>
      {!compacta && <span className="font-medium mr-2">{brData(i.prazo)}</span>}
      <span className="font-medium">{i.titulo}</span>
      {i.cliente && <span className="text-muted-foreground"> · {i.cliente}</span>}
      {i.processo && <span className="text-muted-foreground font-mono"> · {i.processo}</span>}
      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">{i.origem}</Badge>
    </div>
  );
}
