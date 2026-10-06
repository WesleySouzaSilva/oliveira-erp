import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/hooks/useMetricasCalc";
import { Trophy, Target, Wallet, TrendingUp, Calendar, Crown, Medal } from "lucide-react";

interface Props {
  ano: number;
  mes: number;
  nicho: string; // "all" ou nicho específico
  members: { user_id: string; nome: string }[];
}

interface ContratoMin {
  closer_id: string | null;
  data_venda: string;
  valor_total: number;
  valor_entrada: number;
  valor_recebido: number;
  nicho: string;
}

interface MetaMensalRow {
  mes: number;
  ano: number;
  nicho: string;
  meta_receita: number;
  meta_contratos: number;
}

interface MetaIndividualRow {
  membro_user_id: string;
  mes: number;
  ano: number;
  meta_receita: number;
}

const pct = (parte: number, todo: number) =>
  todo > 0 ? Math.min(999, Math.round((parte / todo) * 100)) : 0;

export function DashboardContratosFechados({ ano, mes, nicho, members }: Props) {
  const [contratos, setContratos] = useState<ContratoMin[]>([]);
  const [metas, setMetas] = useState<MetaMensalRow[]>([]);
  const [metasInd, setMetasInd] = useState<MetaIndividualRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const inicio = `${ano}-01-01`;
      const fim = `${ano}-12-31`;

      let qC = supabase
        .from("mkt_contratos_fechados" as any)
        .select("closer_id,data_venda,valor_total,valor_entrada,valor_recebido,nicho")
        .gte("data_venda", inicio)
        .lte("data_venda", fim);
      if (nicho !== "all") qC = qC.eq("nicho", nicho);

      let qM = supabase
        .from("mkt_metas_mensais" as any)
        .select("mes,ano,nicho,meta_receita,meta_contratos")
        .eq("ano", ano);
      if (nicho !== "all") qM = qM.eq("nicho", nicho);

      const qMi = supabase
        .from("mkt_metas_individuais" as any)
        .select("membro_user_id,mes,ano,meta_receita")
        .eq("ano", ano)
        .eq("mes", mes);

      const [c, m, mi] = await Promise.all([qC, qM, qMi]);
      if (cancelled) return;
      setContratos((c.data as any[]) || []);
      setMetas((m.data as any[]) || []);
      setMetasInd((mi.data as any[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ano, mes, nicho]);

  const data = useMemo(() => {
    const yearRows = contratos;
    const monthRows = contratos.filter((r) => {
      const d = new Date(r.data_venda);
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    });

    // Metas
    const metaAnualValor = metas.reduce((s, m) => s + Number(m.meta_receita || 0), 0);
    const metaAnualContratos = metas.reduce((s, m) => s + Number(m.meta_contratos || 0), 0);
    const metaMensalValor = metas
      .filter((m) => m.mes === mes)
      .reduce((s, m) => s + Number(m.meta_receita || 0), 0);
    const metaMensalContratos = metas
      .filter((m) => m.mes === mes)
      .reduce((s, m) => s + Number(m.meta_contratos || 0), 0);

    // Totais ano
    const vendidoAno = yearRows.reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const caixaAno =
      yearRows.reduce((s, r) => s + Number(r.valor_entrada || 0), 0) +
      yearRows.reduce((s, r) => s + Number(r.valor_recebido || 0), 0);
    const contratosAno = yearRows.length;

    // Totais mês
    const vendidoMes = monthRows.reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const caixaMes =
      monthRows.reduce((s, r) => s + Number(r.valor_entrada || 0), 0) +
      monthRows.reduce((s, r) => s + Number(r.valor_recebido || 0), 0);
    const contratosMes = monthRows.length;
    const entradasMes = monthRows.reduce((s, r) => s + Number(r.valor_entrada || 0), 0);

    // Closers — mês
    const closersMap = new Map<
      string,
      { id: string; nome: string; valorMes: number; valorAno: number; contratosMes: number; contratosAno: number; meta: number }
    >();
    const ensure = (id: string | null) => {
      const key = id || "_sem_closer_";
      if (!closersMap.has(key)) {
        const nome =
          id == null
            ? "Sem closer"
            : members.find((m) => m.user_id === id)?.nome || id.slice(0, 8);
        const meta =
          id == null
            ? 0
            : Number(metasInd.find((mi) => mi.membro_user_id === id)?.meta_receita || 0);
        closersMap.set(key, {
          id: key,
          nome,
          valorMes: 0,
          valorAno: 0,
          contratosMes: 0,
          contratosAno: 0,
          meta,
        });
      }
      return closersMap.get(key)!;
    };
    yearRows.forEach((r) => {
      const c = ensure(r.closer_id);
      c.valorAno += Number(r.valor_total || 0);
      c.contratosAno += 1;
    });
    monthRows.forEach((r) => {
      const c = ensure(r.closer_id);
      c.valorMes += Number(r.valor_total || 0);
      c.contratosMes += 1;
    });
    // Closers com meta mas sem vendas ainda também aparecem
    metasInd.forEach((mi) => ensure(mi.membro_user_id));

    const closers = Array.from(closersMap.values()).sort(
      (a, b) => b.valorMes - a.valorMes,
    );

    return {
      metaAnualValor,
      metaAnualContratos,
      metaMensalValor,
      metaMensalContratos,
      vendidoAno,
      vendidoMes,
      caixaAno,
      caixaMes,
      entradasMes,
      contratosAno,
      contratosMes,
      closers,
    };
  }, [contratos, metas, metasInd, ano, mes, members]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const pctAnual = pct(data.vendidoAno, data.metaAnualValor);
  const pctMensal = pct(data.vendidoMes, data.metaMensalValor);

  const rankIcons = [Crown, Trophy, Medal];

  return (
    <div className="space-y-4">
      {/* Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Meta anual {ano}
                {data.metaAnualValor === 0 && (
                  <Badge variant="outline" className="text-[10px]">sem meta definida</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">{pctAnual}%</div>
                <div className="text-xs text-muted-foreground">
                  Meta {fmt.brl(data.metaAnualValor)}
                </div>
              </div>
              <Progress value={Math.min(100, pctAnual)} className="h-2" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Vendido: <span className="font-semibold text-foreground">{fmt.brl(data.vendidoAno)}</span>
                </span>
                <span className="text-muted-foreground">
                  {data.contratosAno} contratos
                  {data.metaAnualContratos > 0 && ` / ${data.metaAnualContratos}`}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-l-4 border-l-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" /> Meta mensal
                {data.metaMensalValor === 0 && (
                  <Badge variant="outline" className="text-[10px]">sem meta definida</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">{pctMensal}%</div>
                <div className="text-xs text-muted-foreground">
                  Meta {fmt.brl(data.metaMensalValor)}
                </div>
              </div>
              <Progress value={Math.min(100, pctMensal)} className="h-2" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Vendido: <span className="font-semibold text-foreground">{fmt.brl(data.vendidoMes)}</span>
                </span>
                <span className="text-muted-foreground">
                  {data.contratosMes} contratos
                  {data.metaMensalContratos > 0 && ` / ${data.metaMensalContratos}`}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Caixa e dívidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="w-3.5 h-3.5" /> Caixa gerado (mês)
            </div>
            <div className="text-xl font-bold">{fmt.brl(data.caixaMes)}</div>
            <div className="text-[11px] text-muted-foreground">
              Entradas no mês: {fmt.brl(data.entradasMes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="w-3.5 h-3.5" /> Caixa gerado (ano)
            </div>
            <div className="text-xl font-bold">{fmt.brl(data.caixaAno)}</div>
            <div className="text-[11px] text-muted-foreground">
              Entradas + recebidos acumulados
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3.5 h-3.5" /> Tamanho das dívidas (ano)
            </div>
            <div className="text-xl font-bold">{fmt.brl(data.vendidoAno)}</div>
            <div className="text-[11px] text-muted-foreground">
              Soma do valor total dos contratos fechados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de closers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Ranking de closers — mês
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.closers.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum closer com vendas neste período.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.closers.map((c, i) => {
                const Icon = rankIcons[i];
                const pctMeta = pct(c.valorMes, c.meta);
                return (
                  <div key={c.id} className="p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0
                          ? "bg-amber-500/20 text-amber-600"
                          : i === 1
                          ? "bg-zinc-400/20 text-zinc-600"
                          : i === 2
                          ? "bg-orange-700/20 text-orange-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {Icon ? <Icon className="w-4 h-4" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">{c.nome}</div>
                        <div className="text-sm font-bold">{fmt.brl(c.valorMes)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="text-[11px] text-muted-foreground">
                          {c.contratosMes} no mês · ano: {fmt.brl(c.valorAno)} ({c.contratosAno} contratos)
                        </div>
                        {c.meta > 0 && (
                          <Badge
                            variant={pctMeta >= 100 ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {pctMeta}% da meta
                          </Badge>
                        )}
                      </div>
                      {c.meta > 0 && (
                        <Progress value={Math.min(100, pctMeta)} className="h-1.5 mt-2" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}