import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const dataBR = (s: string) => new Date(s).toLocaleDateString("pt-BR");

/** Linha do tempo de movimentos do DataJud (CNJ) para um número de processo. */
export function MovimentosDataJud({ numeroCnj, titulo, children }: { numeroCnj?: string | null; titulo?: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["datajud-movimentos", numeroCnj],
    enabled: aberto && !!numeroCnj,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [{ data: proc }, { data: movs, error }] = await Promise.all([
        supabase.from("controladoria_datajud_processos").select("tribunal, classe, orgao_julgador, consultado_em, nao_encontrado").eq("numero_cnj", numeroCnj!).maybeSingle(),
        supabase.from("controladoria_datajud_movimentos").select("id, codigo, nome, data_hora, complementos").eq("numero_cnj", numeroCnj!).order("data_hora", { ascending: false }).limit(1000),
      ]);
      if (error) throw error;
      return { proc, movs: movs ?? [] };
    },
  });
  if (!numeroCnj) return <>{children}</>;
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-mono text-base">{titulo || numeroCnj}</DialogTitle></DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {data && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {data.proc
                ? data.proc.nao_encontrado
                  ? "Não encontrado no DataJud (pode ser sigiloso ou ainda não indexado)."
                  : [data.proc.tribunal?.toUpperCase(), data.proc.classe, data.proc.orgao_julgador].filter(Boolean).join(" · ")
                : "Ainda não consultado no DataJud."}
              {data.proc?.consultado_em && ` · Consultado em ${dataBR(data.proc.consultado_em)}`}
            </p>
            <ScrollArea className="h-[60vh] pr-3">
              <ol className="relative border-l border-border ml-2 space-y-3">
                {data.movs.map((m: any) => (
                  <li key={m.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                    <p className="text-xs text-muted-foreground">{dataBR(m.data_hora)}</p>
                    <p className="text-sm">{m.nome}</p>
                    {Array.isArray(m.complementos) && m.complementos.length > 0 && (
                      <p className="text-xs text-muted-foreground">{m.complementos.map((c: any) => c?.nome || c?.descricao).filter(Boolean).join(" · ")}</p>
                    )}
                  </li>
                ))}
                {data.movs.length === 0 && <li className="ml-4 text-sm text-muted-foreground">Sem movimentos.</li>}
              </ol>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
