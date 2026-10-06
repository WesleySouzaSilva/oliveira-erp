import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoader } from "@/components/ui/loaders";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Cpu, AlertTriangle, Coins, Zap } from "lucide-react";

// Preço em USD por 1M tokens (input / output). Aproximações públicas.
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-5-20250929": { in: 3, out: 15 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "google/gemini-3-flash-preview": { in: 0.1, out: 0.4 },
  "google/gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "google/gemini-2.5-pro": { in: 1.25, out: 5 },
};

function priceFor(modelo: string) {
  if (PRICE[modelo]) return PRICE[modelo];
  if (modelo?.includes("sonnet")) return { in: 3, out: 15 };
  if (modelo?.includes("haiku")) return { in: 1, out: 5 };
  if (modelo?.includes("gemini")) return { in: 0.1, out: 0.4 };
  return { in: 1, out: 3 };
}

function custoUSD(modelo: string, inTok: number, outTok: number) {
  const p = priceFor(modelo);
  return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}

type Row = {
  id: string;
  created_at: string;
  funcao: string;
  modelo: string;
  provedor: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  status: string;
  erro_codigo: number | null;
  duracao_ms: number | null;
};

function fmtUSD(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 4 });
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNum(v: number) {
  return v.toLocaleString("pt-BR");
}

export default function ConsumoIA() {
  const { isAdmin, loading: permLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [inicio, setInicio] = useState(trintaDiasAtras.toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));
  // USD → BRL aproximado; pode ser editado pelo usuário.
  const [cambio, setCambio] = useState(5.4);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("ia_consumo")
        .select("id,created_at,funcao,modelo,provedor,input_tokens,output_tokens,total_tokens,status,erro_codigo,duracao_ms")
        .gte("created_at", `${inicio}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (!cancel) {
        if (error) console.error("ia_consumo", error);
        setRows((data as Row[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [inicio, fim]);

  const kpis = useMemo(() => {
    let inTok = 0, outTok = 0, calls = rows.length, erros = 0, usd = 0;
    for (const r of rows) {
      inTok += r.input_tokens || 0;
      outTok += r.output_tokens || 0;
      if (r.status !== "ok") erros++;
      usd += custoUSD(r.modelo, r.input_tokens || 0, r.output_tokens || 0);
    }
    return { inTok, outTok, calls, erros, usd, brl: usd * cambio };
  }, [rows, cambio]);

  const porDia = useMemo(() => {
    const m = new Map<string, { dia: string; tokens: number; custo: number; chamadas: number }>();
    for (const r of rows) {
      const dia = r.created_at.slice(0, 10);
      const cur = m.get(dia) || { dia, tokens: 0, custo: 0, chamadas: 0 };
      cur.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
      cur.custo += custoUSD(r.modelo, r.input_tokens || 0, r.output_tokens || 0) * cambio;
      cur.chamadas += 1;
      m.set(dia, cur);
    }
    return Array.from(m.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [rows, cambio]);

  const porFuncao = useMemo(() => {
    const m = new Map<string, { funcao: string; tokens: number; custo: number; chamadas: number }>();
    for (const r of rows) {
      const cur = m.get(r.funcao) || { funcao: r.funcao, tokens: 0, custo: 0, chamadas: 0 };
      cur.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
      cur.custo += custoUSD(r.modelo, r.input_tokens || 0, r.output_tokens || 0) * cambio;
      cur.chamadas += 1;
      m.set(r.funcao, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.custo - a.custo);
  }, [rows, cambio]);

  const porProvedor = useMemo(() => {
    const m = new Map<string, { provedor: string; chamadas: number; custo: number }>();
    for (const r of rows) {
      const cur = m.get(r.provedor) || { provedor: r.provedor, chamadas: 0, custo: 0 };
      cur.chamadas += 1;
      cur.custo += custoUSD(r.modelo, r.input_tokens || 0, r.output_tokens || 0) * cambio;
      m.set(r.provedor, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.custo - a.custo);
  }, [rows, cambio]);

  if (permLoading) return <PageLoader />;
  if (!isAdmin) return <Navigate to="/acesso-negado" replace />;

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cpu className="h-6 w-6 text-accent" />
              Consumo de IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Tokens, chamadas e custo estimado por função e provedor.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">USD → BRL</Label>
              <Input
                type="number" step="0.01" value={cambio}
                onChange={(e) => setCambio(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard icon={<Zap className="h-4 w-4" />} title="Chamadas" value={fmtNum(kpis.calls)} />
              <KpiCard
                icon={<Cpu className="h-4 w-4" />}
                title="Tokens (in / out)"
                value={`${fmtNum(kpis.inTok)} / ${fmtNum(kpis.outTok)}`}
              />
              <KpiCard
                icon={<Coins className="h-4 w-4" />}
                title="Custo estimado"
                value={fmtBRL(kpis.brl)}
                subtitle={fmtUSD(kpis.usd)}
              />
              <KpiCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Erros"
                value={fmtNum(kpis.erros)}
                subtitle={kpis.calls ? `${((kpis.erros / kpis.calls) * 100).toFixed(1)}%` : "—"}
                tone={kpis.erros > 0 ? "warn" : "ok"}
              />
            </div>

            <Card>
              <CardHeader><CardTitle>Consumo diário</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porDia}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="dia" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <ReTooltip
                        formatter={(v: number, name: string) =>
                          name === "custo" ? fmtBRL(v) : fmtNum(v)
                        }
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="tokens" name="Tokens" fill="hsl(var(--primary))" />
                      <Bar yAxisId="right" dataKey="custo" name="Custo (R$)" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Por função</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Chamadas</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porFuncao.map((f) => (
                        <TableRow key={f.funcao}>
                          <TableCell className="font-medium">{f.funcao}</TableCell>
                          <TableCell className="text-right">{fmtNum(f.chamadas)}</TableCell>
                          <TableCell className="text-right">{fmtNum(f.tokens)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(f.custo)}</TableCell>
                        </TableRow>
                      ))}
                      {!porFuncao.length && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Sem dados no período.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Por provedor</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provedor</TableHead>
                        <TableHead className="text-right">Chamadas</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porProvedor.map((p) => (
                        <TableRow key={p.provedor}>
                          <TableCell className="font-medium capitalize">{p.provedor}</TableCell>
                          <TableCell className="text-right">{fmtNum(p.chamadas)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.custo)}</TableCell>
                        </TableRow>
                      ))}
                      {!porProvedor.length && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Sem dados no período.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Últimas chamadas</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((r) => {
                      const c = custoUSD(r.modelo, r.input_tokens || 0, r.output_tokens || 0) * cambio;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(r.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-xs">{r.funcao}</TableCell>
                          <TableCell className="text-xs">{r.modelo}</TableCell>
                          <TableCell className="text-xs capitalize">{r.provedor}</TableCell>
                          <TableCell className="text-right text-xs">{fmtNum(r.input_tokens || 0)}</TableCell>
                          <TableCell className="text-right text-xs">{fmtNum(r.output_tokens || 0)}</TableCell>
                          <TableCell className="text-right text-xs">{fmtBRL(c)}</TableCell>
                          <TableCell className="text-right text-xs">
                            {r.duracao_ms ? `${(r.duracao_ms / 1000).toFixed(1)}s` : "—"}
                          </TableCell>
                          <TableCell>
                            {r.status === "ok" ? (
                              <Badge variant="secondary">ok</Badge>
                            ) : (
                              <Badge variant="destructive">{r.status}{r.erro_codigo ? ` ${r.erro_codigo}` : ""}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!rows.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Sem chamadas registradas no período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function KpiCard({
  icon, title, value, subtitle, tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone === "warn" ? "text-destructive" : ""}`}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}