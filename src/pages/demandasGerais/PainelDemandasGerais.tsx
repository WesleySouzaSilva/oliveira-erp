import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gavel, AlertTriangle, Clock, CheckCircle2, Inbox, Users, Plus } from "lucide-react";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  MATERIA_LABEL, STATUS_MAP, MATERIAS, type CausaAvulsa,
} from "./constants";

const fmtData = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function PainelDemandasGerais() {
  const { members } = useOrgMembers();
  const [rows, setRows] = useState<CausaAvulsa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("causas_avulsas")
        .select("*")
        .is("deleted_at", null);
      setRows((data ?? []) as CausaAvulsa[]);
      setLoading(false);
    })();
  }, []);

  const nomePorUser = useMemo(() => {
    const m = new Map<string, string>();
    (members || []).forEach((x) => m.set(x.user_id, x.nome || x.user_id.slice(0, 8)));
    return m;
  }, [members]);

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const abertas = rows.filter((r) => !["concluido", "arquivado"].includes(r.status));
  const totalAbertas = abertas.length;
  const vencidas = abertas.filter((r) => r.prazo && r.prazo < today);
  const proximas = abertas.filter((r) => r.prazo && r.prazo >= today && r.prazo <= in7);
  const concluidas = rows.filter((r) => r.status === "concluido").length;

  const porStatus = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.status, (m.get(r.status) ?? 0) + 1));
    return m;
  }, [rows]);

  const porMateria = useMemo(() => {
    const m = new Map<string, number>();
    abertas.forEach((r) => m.set(r.materia, (m.get(r.materia) ?? 0) + 1));
    return m;
  }, [abertas]);

  const cargaResp = useMemo(() => {
    const m = new Map<string, number>();
    abertas.forEach((r) => {
      const k = r.responsavel_id ?? "__none__";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([k, n]) => ({
        user_id: k,
        nome: k === "__none__" ? "Sem responsável" : (nomePorUser.get(k) ?? k.slice(0, 8)),
        qtd: n,
      }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [abertas, nomePorUser]);

  return (
    <AppLayout>
      <PageHeader
        icon={Gavel}
        title="Demandas complexas"
        subtitle="Painel de causas avulsas — trabalhos pontuais fora do Agro e da Consultoria Empresarial."
        actions={
          <Button asChild>
            <Link to="/causas"><Plus className="w-4 h-4 mr-1" /> Nova causa</Link>
          </Button>
        }
      />

      <KpiGrid cols={4} className="mb-6">
        <KpiCard loading={loading} label="Causas abertas" value={totalAbertas} icon={Inbox} tone="info" />
        <KpiCard loading={loading} label="Prazos vencidos" value={vencidas.length} icon={AlertTriangle} tone="danger" emphasizeValue />
        <KpiCard loading={loading} label="Prazos ≤ 7 dias" value={proximas.length} icon={Clock} tone="warning" emphasizeValue />
        <KpiCard loading={loading} label="Concluídas" value={concluidas} icon={CheckCircle2} tone="success" />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Por status</h2>
          <div className="space-y-2">
            {Array.from(porStatus.entries()).length === 0 && (
              <p className="text-sm text-muted-foreground">Sem causas ainda.</p>
            )}
            {Array.from(porStatus.entries()).map(([st, n]) => {
              const s = STATUS_MAP[st] ?? { tone: "neutral" as const, label: st };
              return (
                <div key={st} className="flex items-center justify-between text-sm">
                  <StatusBadge tone={s.tone} label={s.label} />
                  <span className="font-semibold">{n}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Por matéria (abertas)</h2>
          <div className="space-y-2">
            {MATERIAS.map((m) => {
              const n = porMateria.get(m.value) ?? 0;
              if (n === 0) return null;
              return (
                <div key={m.value} className="flex items-center justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="font-semibold">{n}</span>
                </div>
              );
            })}
            {Array.from(porMateria.values()).every((v) => v === 0) && (
              <p className="text-sm text-muted-foreground">Sem causas abertas.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Prazos críticos</h2>
          <div className="space-y-2">
            {[...vencidas, ...proximas].slice(0, 8).map((r) => (
              <Link key={r.id} to={`/causas/${r.id}`} className="flex items-center justify-between text-sm hover:bg-muted/40 rounded px-2 py-1.5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.cliente_nome} · {MATERIA_LABEL[r.materia] ?? r.materia}</p>
                </div>
                <span className={r.prazo && r.prazo < today ? "text-destructive font-semibold whitespace-nowrap" : "whitespace-nowrap"}>
                  {fmtData(r.prazo)}
                </span>
              </Link>
            ))}
            {vencidas.length === 0 && proximas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum prazo vencido ou nos próximos 7 dias.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Carga por responsável</h2>
          <div className="space-y-2">
            {cargaResp.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem causas abertas.</p>
            )}
            {cargaResp.map((c) => (
              <div key={c.user_id} className="flex items-center justify-between text-sm">
                <span className={c.user_id === "__none__" ? "text-muted-foreground italic" : ""}>{c.nome}</span>
                <span className="font-semibold">{c.qtd}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}