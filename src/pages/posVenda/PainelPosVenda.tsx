import { useEffect, useMemo, useState } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Users, FileText, Handshake, ClipboardCheck, Star, Briefcase, Wallet, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";

type Cliente = {
  id: string;
  nome: string;
  nps: number | null;
  responsavel_pos_venda: string | null;
};
type Contrato = { nome_cliente: string; valor_total_operacao: number | null };

type Periodo = "tudo" | "30d";
type OrdenarPor = "relatorios" | "carteira" | "nps" | "onboardings" | "acordos";

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const iniciais = (nome: string | null) =>
  (nome || "?").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";

export default function PainelPosVenda() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [relatorios, setRelatorios] = useState<{ gerado_por: string | null; created_at: string }[]>([]);
  const [onboardings, setOnboardings] = useState<{ responsavel_id: string | null; status: string | null; concluido_em: string | null; created_at: string }[]>([]);
  const [acordos, setAcordos] = useState<{ responsavel_id: string | null; concluida: boolean | null; status: string | null; created_at: string; updated_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("tudo");
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>("relatorios");

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [cls, cts, rels, ons, acs] = await Promise.all([
        supabase.from("clientes")
          .select("id, nome, nps, responsavel_pos_venda")
          .is("deleted_at", null),
        lerTudo(() => supabase.from("contratos_vencimentos")
          .select("nome_cliente, valor_total_operacao")
          .is("deleted_at", null)),
        supabase.from("relatorios_cliente")
          .select("gerado_por, created_at"),
        supabase.from("pos_venda_onboardings")
          .select("responsavel_id, status, concluido_em, created_at"),
        supabase.from("acordos_tarefas")
          .select("responsavel_id, concluida, status, created_at, updated_at"),
      ]);
      if (cancel) return;
      setClientes((cls.data ?? []) as Cliente[]);
      setContratos((cts.data ?? []) as Contrato[]);
      setRelatorios((rels.data ?? []) as any);
      setOnboardings((ons.data ?? []) as any);
      setAcordos((acs.data ?? []) as any);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  const dividaPorNome = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contratos) {
      const k = norm(c.nome_cliente || "");
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + Number(c.valor_total_operacao || 0));
    }
    return map;
  }, [contratos]);

  // Limite de período (apenas para contagens; carteira/NPS são "estado atual")
  const desde = useMemo(() => {
    if (periodo === "tudo") return null;
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, [periodo]);
  const inPeriodo = (iso: string | null | undefined) => !desde || (!!iso && iso >= desde);

  type Stats = {
    user_id: string;
    nome: string;
    papel: string;
    relatorios: number;
    carteira_qtde: number;
    carteira_divida: number;
    nps_medio: number | null;
    onboardings_concluidos: number;
    acordos_concluidos: number;
  };

  const stats: Stats[] = useMemo(() => {
    // Inclui também user_ids que aparecem com atividade mesmo sem estar em members.
    const knownIds = new Set<string>(members.map((m) => m.user_id));
    const extra = new Set<string>();
    for (const r of relatorios) if (r.gerado_por && !knownIds.has(r.gerado_por)) extra.add(r.gerado_por);
    for (const c of clientes) if (c.responsavel_pos_venda && !knownIds.has(c.responsavel_pos_venda)) extra.add(c.responsavel_pos_venda);
    for (const o of onboardings) if (o.responsavel_id && !knownIds.has(o.responsavel_id)) extra.add(o.responsavel_id);
    for (const a of acordos) if (a.responsavel_id && !knownIds.has(a.responsavel_id)) extra.add(a.responsavel_id);

    const lista: { user_id: string; nome: string; papel: string }[] = [
      ...members.map((m) => ({ user_id: m.user_id, nome: m.nome || "Sem nome", papel: m.papel || "" })),
      ...[...extra].map((uid) => ({ user_id: uid, nome: "Usuário", papel: "" })),
    ];

    return lista.map((m) => {
      const rels = relatorios.filter((r) => r.gerado_por === m.user_id && inPeriodo(r.created_at));
      const meusClientes = clientes.filter((c) => c.responsavel_pos_venda === m.user_id);
      const divida = meusClientes.reduce((s, c) => s + (dividaPorNome.get(norm(c.nome)) ?? 0), 0);
      const npsArr = meusClientes.map((c) => c.nps).filter((v): v is number => v != null);
      const npsMedio = npsArr.length ? npsArr.reduce((s, v) => s + v, 0) / npsArr.length : null;
      const onConcl = onboardings.filter(
        (o) => o.responsavel_id === m.user_id
          && (o.status === "concluido" || !!o.concluido_em)
          && inPeriodo(o.concluido_em || o.created_at),
      ).length;
      const acConcl = acordos.filter(
        (a) => a.responsavel_id === m.user_id
          && (a.concluida === true || (a.status || "").toLowerCase().includes("conclu"))
          && inPeriodo(a.updated_at || a.created_at),
      ).length;
      return {
        user_id: m.user_id,
        nome: m.nome,
        papel: m.papel,
        relatorios: rels.length,
        carteira_qtde: meusClientes.length,
        carteira_divida: divida,
        nps_medio: npsMedio,
        onboardings_concluidos: onConcl,
        acordos_concluidos: acConcl,
      };
    });
  }, [members, relatorios, clientes, dividaPorNome, onboardings, acordos, desde]);

  const lideres = useMemo(() => {
    const max = (sel: (s: Stats) => number) =>
      stats.reduce((m, s) => Math.max(m, sel(s)), 0);
    return {
      relatorios: max((s) => s.relatorios),
      carteira: max((s) => s.carteira_divida),
      nps: max((s) => s.nps_medio ?? -1),
      onboardings: max((s) => s.onboardings_concluidos),
      acordos: max((s) => s.acordos_concluidos),
    };
  }, [stats]);

  const statsOrdenados = useMemo(() => {
    const sel: Record<OrdenarPor, (s: Stats) => number> = {
      relatorios: (s) => s.relatorios,
      carteira: (s) => s.carteira_divida,
      nps: (s) => s.nps_medio ?? -1,
      onboardings: (s) => s.onboardings_concluidos,
      acordos: (s) => s.acordos_concluidos,
    };
    return [...stats].sort((a, b) => sel[ordenarPor](b) - sel[ordenarPor](a));
  }, [stats, ordenarPor]);

  const resumo = useMemo(() => {
    const totalClientes = clientes.length;
    const semResp = clientes.filter((c) => !c.responsavel_pos_venda).length;
    const dividaTotal = clientes.reduce((s, c) => s + (dividaPorNome.get(norm(c.nome)) ?? 0), 0);
    const dividaSemResp = clientes
      .filter((c) => !c.responsavel_pos_venda)
      .reduce((s, c) => s + (dividaPorNome.get(norm(c.nome)) ?? 0), 0);
    return { totalClientes, semResp, dividaTotal, dividaSemResp };
  }, [clientes, dividaPorNome]);

  const SeloLider = () => (
    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
      <Trophy className="w-3 h-3 mr-1" /> líder
    </Badge>
  );

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          icon={Trophy}
          title="Painel da Equipe — Pós-Venda"
          subtitle="Disputa amigável: KPIs por consultor/advogado para acompanhar produção e equilíbrio das carteiras."
          breadcrumb={[{ label: "Agro" }, { label: "Pós-Venda" }, { label: "Painel da Equipe" }]}
        />

        {/* Resumo de balanceamento */}
        <KpiGrid cols={4}>
          <KpiCard label="Clientes" value={resumo.totalClientes} icon={Users} />
          <KpiCard label="Dívida sob gestão" value={fmtMoeda(resumo.dividaTotal)} icon={Wallet} />
          <KpiCard
            label="Sem responsável"
            value={resumo.semResp}
            icon={UserX}
            tone={resumo.semResp > 0 ? "warning" : "success"}
            emphasizeValue={resumo.semResp > 0}
            hint={`${fmtMoeda(resumo.dividaSemResp)} a distribuir`}
          />
          <Card className="p-4 flex items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Período (contagens)</div>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                <SelectTrigger className="h-8 text-xs min-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tudo">Tudo</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Ordenar por</div>
              <Select value={ordenarPor} onValueChange={(v) => setOrdenarPor(v as OrdenarPor)}>
                <SelectTrigger className="h-8 text-xs min-w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relatorios">Relatórios gerados</SelectItem>
                  <SelectItem value="carteira">Dívida sob gestão</SelectItem>
                  <SelectItem value="nps">NPS médio</SelectItem>
                  <SelectItem value="onboardings">Onboardings concluídos</SelectItem>
                  <SelectItem value="acordos">Acordos concluídos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        </KpiGrid>

        {/* Cards por pessoa */}
        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">Carregando…</Card>
        ) : statsOrdenados.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Nenhum membro encontrado.</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statsOrdenados.map((s, idx) => (
              <Card key={s.user_id} className="p-4 space-y-3 relative">
                {idx === 0 && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-amber-500 text-white border-amber-600 shadow">
                      <Trophy className="w-3 h-3 mr-1" /> #{1}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {iniciais(s.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.nome}</div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.papel || "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Kpi
                    icon={<FileText className="w-3.5 h-3.5" />}
                    label="Relatórios"
                    value={s.relatorios}
                    leader={s.relatorios > 0 && s.relatorios === lideres.relatorios}
                  />
                  <Kpi
                    icon={<Briefcase className="w-3.5 h-3.5" />}
                    label="Carteira"
                    value={`${s.carteira_qtde}`}
                    sub={fmtMoeda(s.carteira_divida)}
                    leader={s.carteira_divida > 0 && s.carteira_divida === lideres.carteira}
                  />
                  <Kpi
                    icon={<Star className="w-3.5 h-3.5" />}
                    label="NPS médio"
                    value={s.nps_medio == null ? "—" : s.nps_medio.toFixed(1)}
                    leader={s.nps_medio != null && s.nps_medio === lideres.nps}
                  />
                  <Kpi
                    icon={<ClipboardCheck className="w-3.5 h-3.5" />}
                    label="Onboardings"
                    value={s.onboardings_concluidos}
                    leader={s.onboardings_concluidos > 0 && s.onboardings_concluidos === lideres.onboardings}
                  />
                  <Kpi
                    icon={<Handshake className="w-3.5 h-3.5" />}
                    label="Acordos"
                    value={s.acordos_concluidos}
                    leader={s.acordos_concluidos > 0 && s.acordos_concluidos === lideres.acordos}
                  />
                  <Kpi
                    icon={<Users className="w-3.5 h-3.5" />}
                    label="Clientes"
                    value={s.carteira_qtde}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Kpi({
  icon, label, value, sub, leader,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  leader?: boolean;
}) {
  return (
    <div className={`rounded-md border p-2 ${leader ? "border-amber-300 bg-amber-50/60" : "border-border"}`}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">{icon} {label}</span>
        {leader && (
          <span className="inline-flex items-center gap-0.5 text-amber-700 font-semibold">
            <Trophy className="w-3 h-3" /> líder
          </span>
        )}
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}