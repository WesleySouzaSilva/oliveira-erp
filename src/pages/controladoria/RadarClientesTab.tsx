import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionRegion } from "@supabase/supabase-js";
import { lerTudo } from "@/lib/lerTudo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const FAIXAS: Record<string, string> = { confirmado: "Confirmado", provavel: "Provável", improvavel: "Improvável" };
const dataBR = (s?: string | null) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "·");

/** Radar de clientes: processos no DJEN contra clientes que ainda não conhecíamos. Sem avisos. */
export default function RadarClientesTab() {
  const qc = useQueryClient();
  const [faixa, setFaixa] = useState("todas");
  const [status, setStatus] = useState("novo");
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["radar-resultados"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await lerTudo(() => supabase.from("controladoria_radar_resultados")
        .select("*, clientes(nome, uf)").order("nota", { ascending: false }));
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const lista = useMemo(() => (data ?? []).filter((r) =>
    (faixa === "todas" || r.faixa === faixa) && (status === "todos" || r.status === status)), [data, faixa, status]);

  async function simular() {
    setRodando(true);
    try {
      const { data, error } = await supabase.functions.invoke("radar-clientes", { body: { acao: "simular", clientes: 10 }, region: FunctionRegion.SaEast1 });
      if (error) throw error;
      setResumo(data?.resultado?.[0] ?? null);
      qc.invalidateQueries({ queryKey: ["radar-resultados"] });
      toast.success("Simulação concluída");
    } catch (e: any) {
      toast.error(e?.message || "Falha na simulação");
    } finally { setRodando(false); }
  }

  async function decidir(id: string, decisao: "e_cliente" | "homonimo") {
    const { error } = await supabase.functions.invoke("radar-clientes", { body: { acao: "decidir", resultado_id: id, decisao } });
    if (error) return toast.error("Não foi possível registrar");
    toast.success(decisao === "e_cliente" ? "Marcado como do cliente" : "Marcado como homônimo");
    qc.invalidateQueries({ queryKey: ["radar-resultados"] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Radar de clientes (simulação: sem avisos)</CardTitle>
          <Button onClick={simular} disabled={rodando}>{rodando ? "Simulando…" : "Simular 10 clientes"}</Button>
        </CardHeader>
        {resumo && (
          <CardContent className="text-sm text-muted-foreground">
            {resumo.requisicoes} consultas em {resumo.segundos}s · {resumo.por_faixa?.confirmado || 0} confirmados ·{" "}
            {resumo.por_faixa?.provavel || 0} prováveis · {resumo.por_faixa?.improvavel || 0} improváveis ·{" "}
            {resumo.descartes?.ja_ligado || 0} já ligados
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Select value={faixa} onValueChange={setFaixa}>
          <SelectTrigger className="w-44" aria-label="Faixa"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as faixas</SelectItem>
            {Object.entries(FAIXAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="novo">A revisar</SelectItem>
            <SelectItem value="e_cliente">É do cliente</SelectItem>
            <SelectItem value="homonimo">Homônimo</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum resultado.</p>
      ) : lista.map((r) => (
        <Card key={r.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.clientes?.nome}</span>
              <Badge variant={r.faixa === "confirmado" ? "default" : "secondary"}>{FAIXAS[r.faixa]} · {r.nota}</Badge>
              {r.destaque && <Badge variant="destructive">Destaque</Badge>}
              {r.cliente_autor && <Badge variant="outline">Cliente autor</Badge>}
              {r.simulacao && <Badge variant="outline">Simulação</Badge>}
            </div>
            <div className="text-sm">
              {r.numero_processo_mascara || r.numero_processo} · {r.tribunal} · {r.classe} · {dataBR(r.data_disponibilizacao)}
            </div>
            <div className="text-xs text-muted-foreground">
              {(r.polos ?? []).map((p: any) => `${p.nome} (${p.polo === "A" ? "ativo" : p.polo === "P" ? "passivo" : p.polo || "?"})`).join(" · ")}
            </div>
            <ul className="text-xs space-y-0.5">
              {(r.sinais ?? []).map((s: any, i: number) => (
                <li key={i}>{s.pontos > 0 ? `+${s.pontos}` : s.pontos}: {s.sinal}</li>
              ))}
            </ul>
            {r.status === "novo" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => decidir(r.id, "e_cliente")}>É do cliente</Button>
                <Button size="sm" variant="outline" onClick={() => decidir(r.id, "homonimo")}>Homônimo</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
