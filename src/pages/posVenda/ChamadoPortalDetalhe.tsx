import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Landmark, LifeBuoy, Scale, User } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useChamado, CHAMADO_STATUS_LABEL, type ChamadoStatus } from "@/hooks/usePortalCliente";
import { ChamadoThread } from "@/components/portal/ChamadoThread";
import { ChamadoStatusBadge, ChamadoTipoBadge, fmtData } from "@/components/portal/portalUi";

const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;

export default function ChamadoPortalDetalhe() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { members } = useOrgMembers();
  const { chamado } = useChamado(id);
  const c = chamado.data;

  const cliente = useQuery({
    queryKey: ["chamados-internos", "cliente", c?.cliente_id],
    enabled: !!c?.cliente_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, responsavel_pos_venda")
        .eq("id", c!.cliente_id)
        .maybeSingle();
      return data;
    },
  });

  const processo = useQuery({
    queryKey: ["chamados-internos", "processo", c?.processo_id],
    enabled: !!c?.processo_id,
    queryFn: async () => {
      const { data } = await supabase.from("processos").select("id, numero_processo, fase_atual").eq("id", c!.processo_id!).maybeSingle();
      return data;
    },
  });

  const contrato = useQuery({
    queryKey: ["chamados-internos", "contrato", c?.contrato_id],
    enabled: !!c?.contrato_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("contratos_vencimentos")
        .select("id, banco, numero_contrato, vencimento_proxima_parcela, valor_parcela, parcelas_vencidas, status_prazo")
        .eq("id", c!.contrato_id!)
        .maybeSingle();
      return data;
    },
  });

  const nomes = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m.nome || "Membro"])), [members]);

  async function atualizar(patch: Record<string, unknown>, msg: string) {
    if (!c) return;
    const { error } = await (supabase as any).from("portal_chamados").update(patch).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    await qc.invalidateQueries({ queryKey: ["portal", "chamado", c.id] });
    await qc.invalidateQueries({ queryKey: ["chamados-internos"] });
  }

  return (
    <AppLayout>
      <PageHeader
        icon={LifeBuoy}
        backTo="/pos-venda/chamados"
        breadcrumb={[{ label: "Pós-Venda" }, { label: "Chamados do portal", to: "/pos-venda/chamados" }, { label: c?.titulo || "Chamado" }]}
        title={c?.titulo || "Chamado"}
        subtitle={c ? <span className="inline-flex flex-wrap items-center gap-2"><ChamadoTipoBadge tipo={c.tipo} /> aberto em {fmtData(c.created_at, true)}{c.banco ? ` · ${c.banco}` : ""}</span> : undefined}
        actions={c ? <ChamadoStatusBadge status={c.status} /> : null}
      />

      {chamado.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !c ? (
        <p className="text-sm text-muted-foreground">Chamado não encontrado.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div>
            <ChamadoThread chamadoId={c.id} clienteId={c.cliente_id} modo="equipe" nomesEquipe={nomes} fechado={c.status === "resolvido"} />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Responder muda o status de "Aberto" para "Em andamento". Se precisar de algo do cliente, marque "Aguardando cliente"; ao resolver, marque "Resolvido".
            </p>
          </div>

          <aside className="space-y-3">
            <Card className="p-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                <Select value={c.status} onValueChange={(v) => atualizar({ status: v }, `Status: ${CHAMADO_STATUS_LABEL[v as ChamadoStatus]}`)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CHAMADO_STATUS_LABEL) as ChamadoStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{s === "aguardando_cliente" ? "Aguardando cliente" : CHAMADO_STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Responsável</p>
                <Select value={c.responsavel_id || "__none"} onValueChange={(v) => atualizar({ responsavel_id: v === "__none" ? null : v }, "Responsável atualizado")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem responsável</SelectItem>
                    {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Prioridade</p>
                <Select value={c.prioridade} onValueChange={(v) => atualizar({ prioridade: v }, "Prioridade atualizada")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1"><User className="h-3 w-3" /> Cliente</p>
              {cliente.data ? (
                <>
                  <Link to={`/clientes/${encodeURIComponent(cliente.data.nome)}`} className="text-sm font-medium text-foreground hover:text-accent inline-flex items-center gap-1">
                    {cliente.data.nome} <ExternalLink className="h-3 w-3" />
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">{cliente.data.telefone || ""}{cliente.data.telefone && cliente.data.email ? " · " : ""}{cliente.data.email || ""}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pós-venda: {cliente.data.responsavel_pos_venda ? nomes[cliente.data.responsavel_pos_venda] || "Membro" : "sem responsável"}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Carregando…</p>
              )}
            </Card>

            {contrato.data && (
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1"><Landmark className="h-3 w-3" /> Contrato</p>
                <p className="text-sm text-foreground">{contrato.data.banco} · {contrato.data.numero_contrato || "sem número"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Próx. venc.: {contrato.data.vencimento_proxima_parcela ? fmtData(contrato.data.vencimento_proxima_parcela) : "?"}
                  {contrato.data.parcelas_vencidas ? " · parcela em atraso" : ""}
                </p>
                {contrato.data.status_prazo && <p className="text-xs text-muted-foreground mt-1">Status interno: {contrato.data.status_prazo}</p>}
                <Link to="/vencimentos" className="mt-2 inline-block text-xs text-accent hover:underline">Abrir vencimentos</Link>
              </Card>
            )}

            {processo.data && (
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1"><Scale className="h-3 w-3" /> Processo</p>
                <Link to={`/processos/${processo.data.id}`} className="text-sm text-foreground hover:text-accent">{processo.data.numero_processo || "Processo sem número"}</Link>
                <p className="text-xs text-muted-foreground mt-1">Fase: {processo.data.fase_atual || "?"}</p>
              </Card>
            )}
          </aside>
        </div>
      )}
    </AppLayout>
  );
}
