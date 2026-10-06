import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lerTudo } from "@/lib/lerTudo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MovimentosDataJud } from "@/components/processo/MovimentosDataJud";
import { toast } from "sonner";

const dataBR = (s: string) => new Date(s).toLocaleDateString("pt-BR");

/** Movimentos novos do DataJud (depois da carga inicial), ainda não vistos, por responsável. */
export default function MovimentacoesNovasTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [resp, setResp] = useState("todos");
  const { data, isLoading } = useQuery({
    queryKey: ["datajud-movimentacoes-novas"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: movs, error } = await lerTudo(() => supabase.from("controladoria_datajud_movimentos")
        .select("id, numero_cnj, nome, data_hora, created_at").eq("carga_inicial", false).is("visto_em", null)
        .order("data_hora", { ascending: false }));
      if (error) throw error;
      const nums = [...new Set((movs ?? []).map((m: any) => m.numero_cnj))];
      const procs: any[] = [];
      for (let i = 0; i < nums.length; i += 200) {
        const { data: p } = await supabase.from("processos_judiciais")
          .select("numero_cnj, numero_cnj_formatado, advbox_responsavel_nome, processo_judicial_clientes(clientes(nome))")
          .in("numero_cnj", nums.slice(i, i + 200));
        procs.push(...(p ?? []));
      }
      const porNum = new Map(procs.map((p) => [p.numero_cnj, p]));
      return (movs ?? []).map((m: any) => ({ ...m, proc: porNum.get(m.numero_cnj) }));
    },
  });
  const lista = data ?? [];
  const resps = useMemo(() => [...new Set(lista.map((m: any) => m.proc?.advbox_responsavel_nome || "Sem responsável"))].sort(), [lista]);
  const grupos = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const m of lista) {
      const r = m.proc?.advbox_responsavel_nome || "Sem responsável";
      if (resp !== "todos" && r !== resp) continue;
      if (!g.has(r)) g.set(r, []);
      g.get(r)!.push(m);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [lista, resp]);

  const marcarVisto = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from("controladoria_datajud_movimentos")
        .update({ visto_em: new Date().toISOString(), visto_por: user?.id }).in("id", ids.slice(i, i + 200));
      if (error) { toast.error("Não foi possível marcar: " + error.message); return; }
    }
    qc.invalidateQueries({ queryKey: ["datajud-movimentacoes-novas"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={resp} onValueChange={setResp}>
          <SelectTrigger className="w-64" aria-label="Responsável"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os responsáveis</SelectItem>{resps.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{lista.length} movimentações novas (DataJud/CNJ)</span>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação nova.</p>}
      {grupos.map(([r, ms]) => (
        <Card key={r}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{r} ({ms.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => marcarVisto(ms.map((m) => m.id))}>Marcar todas como vistas</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {ms.slice(0, 300).map((m: any) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 pb-2">
                <span className="text-xs text-muted-foreground w-20">{dataBR(m.data_hora)}</span>
                <MovimentosDataJud numeroCnj={m.numero_cnj} titulo={m.proc?.numero_cnj_formatado}>
                  <button className="font-mono text-xs underline-offset-2 hover:underline">{m.proc?.numero_cnj_formatado || m.numero_cnj}</button>
                </MovimentosDataJud>
                <span className="flex-1">{m.nome}</span>
                <span className="text-xs text-muted-foreground">{(m.proc?.processo_judicial_clientes ?? []).map((c: any) => c.clientes?.nome).filter(Boolean).join(", ")}</span>
                <Button size="sm" variant="ghost" onClick={() => marcarVisto([m.id])}>Visto</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
