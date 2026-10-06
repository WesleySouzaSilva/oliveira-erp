import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, LifeBuoy, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { NovoChamadoDialog } from "@/components/portal/NovoChamadoDialog";
import { FaseBadge, PortalCard, PortalCarregando, PortalPage, PortalVazio, fmtData } from "@/components/portal/portalUi";
import type { PortalAndamento, PortalProcesso } from "@/hooks/usePortalCliente";

export default function PortalClienteProcessoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [novo, setNovo] = useState(false);

  const processo = useQuery({
    queryKey: ["portal", "processo", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("processos")
        .select("id, numero_processo, fase_atual, created_at, updated_at")
        .eq("id", id!)
        .maybeSingle();
      return (data || null) as PortalProcesso | null;
    },
  });

  const andamentos = useQuery({
    queryKey: ["portal", "andamentos", id],
    enabled: !!id,
    queryFn: async () => {
      // RLS: só volta o que está liberado (visivel_cliente) e é deste cliente.
      const { data } = await supabase
        .from("processo_andamentos")
        .select("id, processo_id, data, descricao, tipo, created_at")
        .eq("processo_id", id!)
        .order("data", { ascending: false })
        .limit(500);
      return (data || []) as PortalAndamento[];
    },
  });

  const carregando = processo.isLoading || andamentos.isLoading;
  const p = processo.data;

  // Agrupa por mês para leitura mais fácil em listas longas
  const grupos = new Map<string, PortalAndamento[]>();
  (andamentos.data || []).forEach((a) => {
    const chave = a.data.slice(0, 7);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(a);
  });

  return (
    <PortalLayout>
      <PortalPage
        voltar={{ to: "/portal/processos", label: "Meus processos" }}
        titulo={p?.numero_processo || "Processo"}
        subtitulo={p ? <span className="inline-flex items-center gap-2">Fase atual: <FaseBadge fase={p.fase_atual} /></span> : undefined}
        acoes={
          p ? (
            <Button variant="outline" className="gap-2" onClick={() => setNovo(true)}>
              <LifeBuoy className="h-4 w-4 text-accent" /> Perguntar sobre este processo
            </Button>
          ) : null
        }
      >
        {carregando ? (
          <PortalCarregando />
        ) : !p ? (
          <div className="rounded-2xl border border-border bg-card">
            <PortalVazio icone={Scale} titulo="Processo não encontrado" texto="Ele pode ter sido desvinculado do seu cadastro." />
          </div>
        ) : (
          <PortalCard
            titulo="Movimentações"
            icone={Activity}
            acao={
              (andamentos.data || []).length > 0 ? (
                <span className="text-xs text-muted-foreground">{andamentos.data!.length} liberada(s)</span>
              ) : null
            }
          >
            {(andamentos.data || []).length === 0 ? (
              <PortalVazio
                icone={Activity}
                titulo="Nenhuma movimentação liberada"
                texto="A equipe libera para você as movimentações relevantes. Notas internas do escritório não aparecem aqui."
              />
            ) : (
              <div className="space-y-6 pt-1">
                {Array.from(grupos.entries()).map(([mes, itens]) => (
                  <div key={mes}>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {new Date(mes + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </p>
                    <ol className="relative ml-2 border-l border-border space-y-4">
                      {itens.map((a) => (
                        <li key={a.id} className="ml-4">
                          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-card" />
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <time className="font-medium text-foreground">{fmtData(a.data)}</time>
                            {a.tipo && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground">{a.tipo}</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{a.descricao}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted-foreground">
              Não entendeu um termo ou quer saber o próximo passo? Pergunte à OlivIA ou abra um chamado.
            </p>
          </PortalCard>
        )}
      </PortalPage>
      <NovoChamadoDialog aberto={novo} onFechar={() => setNovo(false)} tipoInicial="duvida" processoInicial={id} />
    </PortalLayout>
  );
}
