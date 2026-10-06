import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel } from "lucide-react";
import { MovimentosDataJud } from "@/components/processo/MovimentosDataJud";

/** Processos judiciais importados do ADVBOX ligados ao cliente (somente leitura). */
export function ProcessosJudiciaisCliente({ clienteId }: { clienteId?: string | null }) {
  const { data = [] } = useQuery({
    queryKey: ["processos-judiciais-cliente", clienteId],
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_judicial_clientes")
        .select("processos_judiciais(id, numero_cnj, numero_cnj_formatado, grupo, fase, etapa, advbox_responsavel_nome, status_closure_bruto, djen_comunicacoes(count))")
        .eq("cliente_id", clienteId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.processos_judiciais).filter(Boolean);
    },
  });
  if (!clienteId || data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Gavel className="h-4 w-4" /> Processos judiciais ({data.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((p: any) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 pb-2">
            {p.numero_cnj ? (
              <MovimentosDataJud numeroCnj={p.numero_cnj} titulo={p.numero_cnj_formatado}>
                <button className="font-mono underline-offset-2 hover:underline" title="Ver andamentos (DataJud)">{p.numero_cnj_formatado || p.numero_cnj}</button>
              </MovimentosDataJud>
            ) : <span className="font-mono">Sem número</span>}
            {p.grupo && <Badge variant="outline">{p.grupo}</Badge>}
            <span className="text-muted-foreground">{[p.fase, p.etapa].filter(Boolean).join(" · ")}</span>
            {p.advbox_responsavel_nome && <span className="text-muted-foreground">Resp.: {p.advbox_responsavel_nome}</span>}
            {p.djen_comunicacoes?.[0]?.count > 0 && <Badge variant="secondary">{p.djen_comunicacoes[0].count} intimações</Badge>}
            {p.status_closure_bruto && (
              <span className="text-xs text-muted-foreground" title="Data de fechamento no ADVBOX; não significa encerrado.">
                Fechamento ADVBOX: {p.status_closure_bruto} (não significa encerrado)
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
