import { Link } from "react-router-dom";
import { ChevronRight, Scale } from "lucide-react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { FaseBadge, PortalCarregando, PortalPage, PortalVazio, fmtData } from "@/components/portal/portalUi";
import { usePortalCliente } from "@/hooks/usePortalCliente";

export default function PortalClienteProcessos() {
  const { processos, andamentosRecentes } = usePortalCliente();

  const ultimoPorProcesso = new Map<string, { data: string; descricao: string }>();
  (andamentosRecentes.data || []).forEach((a) => {
    if (!ultimoPorProcesso.has(a.processo_id)) ultimoPorProcesso.set(a.processo_id, { data: a.data, descricao: a.descricao });
  });

  return (
    <PortalLayout>
      <PortalPage
        titulo="Meus processos"
        subtitulo="Cada processo mostra a fase atual e as movimentações que a equipe liberou para você acompanhar."
      >
        {processos.isLoading ? (
          <PortalCarregando />
        ) : (processos.data || []).length === 0 ? (
          <div className="rounded-2xl border border-border bg-card">
            <PortalVazio
              icone={Scale}
              titulo="Nenhum processo vinculado ainda"
              texto="Quando a equipe vincular um processo ao seu cadastro, ele aparece aqui."
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {(processos.data || []).map((p) => {
              const ult = ultimoPorProcesso.get(p.id);
              return (
                <li key={p.id}>
                  <Link
                    to={`/portal/processos/${p.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-accent/60 transition-colors"
                  >
                    <span className="hidden sm:inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <Scale className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{p.numero_processo || "Processo sem número"}</p>
                        <FaseBadge fase={p.fase_atual} />
                      </div>
                      {ult ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          <span className="font-medium text-foreground">{fmtData(ult.data)}:</span> {ult.descricao}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Sem movimentação liberada ainda.</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PortalPage>
    </PortalLayout>
  );
}
