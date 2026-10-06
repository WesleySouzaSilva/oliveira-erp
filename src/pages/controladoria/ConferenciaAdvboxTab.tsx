import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brData } from "@/lib/controladoria";

type Linha = {
  id: string; numero_cnj: string; data: string | null; lado: "so_advbox" | "so_app";
  trecho: string | null; criado_em: string; resolvido_em: string | null;
};

const LADO: Record<string, string> = { so_advbox: "Só no ADVBOX", so_app: "Só no app" };
const cnjFmt = (n: string) =>
  n.length === 20 ? `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16)}` : n;

export default function ConferenciaAdvboxTab() {
  const qc = useQueryClient();
  const [lado, setLado] = useState("todos");
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["controladoria_conferencia"],
    queryFn: async () => {
      const desde30 = new Date(Date.now() - 30 * 86400e3).toISOString();
      const desde7 = new Date(Date.now() - 7 * 86400e3).toISOString();
      const t = supabase as any;
      const [linhas, semana, total] = await Promise.all([
        t.from("controladoria_conferencia_advbox").select("id, numero_cnj, data, lado, trecho, criado_em, resolvido_em")
          .gte("criado_em", desde30).order("criado_em", { ascending: false }).limit(1000),
        t.from("controladoria_conferencia_processos").select("processo_judicial_id", { count: "exact", head: true }).gte("conferido_em", desde7),
        supabase.from("processos_judiciais").select("id", { count: "exact", head: true }).not("advbox_lawsuit_id", "is", null),
      ]);
      return { linhas: (linhas.data as Linha[]) || [], semana: semana.count ?? 0, total: total.count ?? 0 };
    },
  });

  const linhas = data?.linhas ?? [];
  const lim7 = Date.now() - 7 * 86400e3;
  const conta = (l: string, dias7: boolean) => linhas.filter((x) => x.lado === l && (!dias7 || new Date(x.criado_em).getTime() >= lim7)).length;
  const visiveis = linhas.filter((x) => (lado === "todos" || x.lado === lado) && (mostrarResolvidas || !x.resolvido_em));

  async function resolver(id: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error, data: d } = await (supabase as any).from("controladoria_conferencia_advbox")
      .update({ resolvido_em: new Date().toISOString(), resolvido_por: u.user?.id }).eq("id", id).select("id");
    if (error || !d?.length) { toast.error("Não foi possível marcar como resolvido."); return; }
    toast.success("Marcado como resolvido");
    qc.invalidateQueries({ queryKey: ["controladoria_conferencia"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Só no ADVBOX · 7 dias</p><p className="text-2xl font-semibold text-destructive">{conta("so_advbox", true)}</p><p className="text-xs text-muted-foreground">30 dias: {conta("so_advbox", false)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Só no app · 7 dias</p><p className="text-2xl font-semibold">{conta("so_app", true)}</p><p className="text-xs text-muted-foreground">30 dias: {conta("so_app", false)}</p></Card>
        <Card className="p-4 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Cobertura da semana</p>
          <p className="text-2xl font-semibold">{data?.semana ?? 0} <span className="text-base font-normal text-muted-foreground">de {data?.total ?? 0} processos conferidos</span></p>
          <p className="text-xs text-muted-foreground">A conferência roda sozinha toda noite, das 02h às 05h.</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={lado} onValueChange={setLado}>
          <SelectTrigger className="w-48" aria-label="Filtrar por lado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os lados</SelectItem>
            <SelectItem value="so_advbox">Só no ADVBOX</SelectItem>
            <SelectItem value="so_app">Só no app</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setMostrarResolvidas((v) => !v)}>
          {mostrarResolvidas ? "Esconder resolvidas" : "Mostrar resolvidas"}
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : visiveis.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Nenhuma diferença pendente.</Card>
      ) : (
        <div className="space-y-2">
          {visiveis.map((x) => (
            <Card key={x.id} className="p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={x.lado === "so_advbox" ? "destructive" : "secondary"}>{LADO[x.lado]}</Badge>
                <span className="font-mono">{cnjFmt(x.numero_cnj)}</span>
                <span className="text-muted-foreground">{brData(x.data)}</span>
                <span className="flex-1" />
                {x.resolvido_em ? <Badge variant="outline">Resolvido</Badge> : <Button size="sm" variant="outline" onClick={() => resolver(x.id)}>Resolvido</Button>}
              </div>
              {x.trecho && <p className="text-xs text-muted-foreground line-clamp-3">{x.trecho}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
