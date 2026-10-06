import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, LifeBuoy, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { NovoChamadoDialog } from "@/components/portal/NovoChamadoDialog";
import {
  ChamadoStatusBadge,
  ChamadoTipoBadge,
  PortalCarregando,
  PortalPage,
  PortalVazio,
  tempoRelativo,
} from "@/components/portal/portalUi";
import { usePortalCliente, type ChamadoStatus } from "@/hooks/usePortalCliente";
import { cn } from "@/lib/utils";

type Filtro = "abertos" | "resolvidos" | "todos";

export default function PortalClienteChamados() {
  const { chamados } = usePortalCliente();
  const [novo, setNovo] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("abertos");

  const lista = useMemo(() => {
    const all = chamados.data || [];
    if (filtro === "abertos") return all.filter((c) => c.status !== "resolvido");
    if (filtro === "resolvidos") return all.filter((c) => c.status === "resolvido");
    return all;
  }, [chamados.data, filtro]);

  const ordem: Record<ChamadoStatus, number> = { aguardando_cliente: 0, aberto: 1, em_andamento: 2, resolvido: 3 };
  const ordenada = [...lista].sort((a, b) => ordem[a.status] - ordem[b.status] || b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em));

  return (
    <PortalLayout>
      <PortalPage
        titulo="Chamados"
        subtitulo="Seu canal direto com a equipe: contato do banco, dúvidas, documentos e pedidos de pós-venda."
        acoes={
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setNovo(true)}>
            <LifeBuoy className="h-4 w-4" /> Abrir chamado
          </Button>
        }
      >
        <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
          {([["abertos", "Em aberto"], ["resolvidos", "Resolvidos"], ["todos", "Todos"]] as [Filtro, string][]).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltro(k)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filtro === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {chamados.isLoading ? (
          <PortalCarregando />
        ) : ordenada.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card">
            <PortalVazio
              icone={LifeBuoy}
              titulo={filtro === "abertos" ? "Nenhum chamado em aberto" : "Nenhum chamado aqui"}
              texto="Recebeu carta ou ligação do banco? Tem uma dúvida? Precisa mandar um documento? É só abrir um chamado."
              acao={<Button size="sm" variant="outline" onClick={() => setNovo(true)}>Abrir chamado</Button>}
            />
          </div>
        ) : (
          <ul className="space-y-2.5">
            {ordenada.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/portal/chamados/${c.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-accent/60",
                    c.status === "aguardando_cliente" ? "border-warning/50" : "border-border",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{c.titulo}</p>
                      <ChamadoTipoBadge tipo={c.tipo} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {c.banco ? `${c.banco} · ` : ""}{c.descricao || "Sem descrição"}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Última mensagem {tempoRelativo(c.ultima_mensagem_em)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <ChamadoStatusBadge status={c.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> Você pode anexar fotos e PDFs em qualquer chamado.
        </p>
      </PortalPage>
      <NovoChamadoDialog aberto={novo} onFechar={() => setNovo(false)} />
    </PortalLayout>
  );
}
