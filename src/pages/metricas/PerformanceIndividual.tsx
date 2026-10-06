import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Loader2, Download, TrendingUp, Users } from "lucide-react";

function todayYMD() { return new Date().toISOString().slice(0, 10); }
function daysAgoYMD(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function brl(v: number) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

type Row = {
  data: string;
  nicho: string;
  closer_id: string | null;
  sdr_id: string | null;
  reunioes_agendadas: number | null;
  reunioes_realizadas: number | null;
  propostas_enviadas: number | null;
  contratos_fechados: number | null;
  contratos_perdidos: number | null;
  receita_fechada: number | null;
  sdr_ligacoes_realizadas: number | null;
  sdr_ligacoes_atendidas: number | null;
  leads_qualificados_sdr: number | null;
  leads_desqualificados_sdr: number | null;
};

export default function PerformanceIndividual() {
  const { members } = useOrgMembers();
  const [inicio, setInicio] = useState(daysAgoYMD(30));
  const [fim, setFim] = useState(todayYMD());
  const [nichoFiltro, setNichoFiltro] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const memberNome = (id: string | null | undefined) =>
    id ? (members.find((m) => m.user_id === id)?.nome || id.slice(0, 8)) : "—";

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("mkt_lancamentos_diarios")
      .select(
        "data,nicho,closer_id,sdr_id,reunioes_agendadas,reunioes_realizadas,propostas_enviadas,contratos_fechados,contratos_perdidos,receita_fechada,sdr_ligacoes_realizadas,sdr_ligacoes_atendidas,leads_qualificados_sdr,leads_desqualificados_sdr",
      )
      .gte("data", inicio)
      .lte("data", fim);
    if (nichoFiltro !== "all") q = q.eq("nicho", nichoFiltro);
    const { data, error } = await q;
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [inicio, fim, nichoFiltro]);

  const nichos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.nicho && s.add(r.nicho));
    return Array.from(s).sort();
  }, [rows]);

  const closers = useMemo(() => {
    const map = new Map<string, {
      reunioesAg: number; reunioesReal: number; propostas: number;
      fechados: number; perdidos: number; receita: number;
    }>();
    rows.forEach((r) => {
      if (!r.closer_id) return;
      const cur = map.get(r.closer_id) || { reunioesAg: 0, reunioesReal: 0, propostas: 0, fechados: 0, perdidos: 0, receita: 0 };
      cur.reunioesAg += r.reunioes_agendadas || 0;
      cur.reunioesReal += r.reunioes_realizadas || 0;
      cur.propostas += r.propostas_enviadas || 0;
      cur.fechados += r.contratos_fechados || 0;
      cur.perdidos += r.contratos_perdidos || 0;
      cur.receita += Number(r.receita_fechada || 0);
      map.set(r.closer_id, cur);
    });
    return Array.from(map.entries())
      .map(([uid, v]) => ({
        uid,
        nome: memberNome(uid),
        ...v,
        comparecimento: pct(v.reunioesReal, v.reunioesAg),
        propostaPorReuniao: pct(v.propostas, v.reunioesReal),
        conversao: pct(v.fechados, v.reunioesReal),
        conversaoProposta: pct(v.fechados, v.propostas),
        ticketMedio: v.fechados > 0 ? v.receita / v.fechados : 0,
      }))
      .sort((a, b) => b.conversao - a.conversao);
  }, [rows, members]);

  const sdrs = useMemo(() => {
    const map = new Map<string, {
      ligRealizadas: number; ligAtendidas: number;
      qualificados: number; desqualificados: number;
      reunioesAg: number; reunioesReal: number;
    }>();
    rows.forEach((r) => {
      if (!r.sdr_id) return;
      const cur = map.get(r.sdr_id) || { ligRealizadas: 0, ligAtendidas: 0, qualificados: 0, desqualificados: 0, reunioesAg: 0, reunioesReal: 0 };
      cur.ligRealizadas += r.sdr_ligacoes_realizadas || 0;
      cur.ligAtendidas += r.sdr_ligacoes_atendidas || 0;
      cur.qualificados += r.leads_qualificados_sdr || 0;
      cur.desqualificados += r.leads_desqualificados_sdr || 0;
      cur.reunioesAg += r.reunioes_agendadas || 0;
      cur.reunioesReal += r.reunioes_realizadas || 0;
      map.set(r.sdr_id, cur);
    });
    return Array.from(map.entries())
      .map(([uid, v]) => {
        const totalLeads = v.qualificados + v.desqualificados;
        return {
          uid,
          nome: memberNome(uid),
          ...v,
          taxaAtendimento: pct(v.ligAtendidas, v.ligRealizadas),
          taxaQualificacao: pct(v.qualificados, totalLeads),
          taxaAgendamento: pct(v.reunioesAg, v.qualificados),
          taxaComparecimento: pct(v.reunioesReal, v.reunioesAg),
        };
      })
      .sort((a, b) => b.taxaQualificacao - a.taxaQualificacao);
  }, [rows, members]);

  const exportCSV = () => {
    const lines: string[] = [];
    lines.push("=== CLOSERS ===");
    lines.push("Closer;Reuniões Agendadas;Reuniões Realizadas;% Comparecimento;Propostas;% Proposta/Reunião;Fechados;% Conversão (Reunião);% Conversão (Proposta);Receita;Ticket Médio");
    closers.forEach((c) => {
      lines.push([c.nome, c.reunioesAg, c.reunioesReal, c.comparecimento + "%", c.propostas, c.propostaPorReuniao + "%", c.fechados, c.conversao + "%", c.conversaoProposta + "%", brl(c.receita), brl(c.ticketMedio)].join(";"));
    });
    lines.push("");
    lines.push("=== SDRs ===");
    lines.push("SDR;Ligações Realizadas;Atendidas;% Atendimento;Qualificados;Desqualificados;% Qualificação;Reuniões Agendadas;% Agendamento;Reuniões Realizadas;% Comparecimento");
    sdrs.forEach((s) => {
      lines.push([s.nome, s.ligRealizadas, s.ligAtendidas, s.taxaAtendimento + "%", s.qualificados, s.desqualificados, s.taxaQualificacao + "%", s.reunioesAg, s.taxaAgendamento + "%", s.reunioesReal, s.taxaComparecimento + "%"].join(";"));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance_${inicio}_${fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Performance Individual</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conversão por closer e qualificação por SDR, calculadas a partir dos lançamentos diários.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || (!closers.length && !sdrs.length)}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nicho</Label>
                <Select value={nichoFiltro} onValueChange={setNichoFiltro}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {nichos.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setInicio(daysAgoYMD(30)); setFim(todayYMD()); }}>30d</Button>
                <Button variant="outline" size="sm" onClick={() => { setInicio(daysAgoYMD(90)); setFim(todayYMD()); }}>90d</Button>
                <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setInicio(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)); setFim(todayYMD()); }}>Ano</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" /> Closers — Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : closers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem dados de closer no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Closer</TableHead>
                      <TableHead className="text-right">Reun. Ag.</TableHead>
                      <TableHead className="text-right">Reun. Real.</TableHead>
                      <TableHead className="text-right">% Compar.</TableHead>
                      <TableHead className="text-right">Propostas</TableHead>
                      <TableHead className="text-right">% Prop./Reun.</TableHead>
                      <TableHead className="text-right">Fechados</TableHead>
                      <TableHead className="text-right">% Conv. (Reun.)</TableHead>
                      <TableHead className="text-right">% Conv. (Prop.)</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closers.map((c, i) => (
                      <TableRow key={c.uid}>
                        <TableCell className="font-medium">
                          {i === 0 && <Badge className="mr-2" variant="default">1º</Badge>}
                          {c.nome}
                        </TableCell>
                        <TableCell className="text-right">{c.reunioesAg}</TableCell>
                        <TableCell className="text-right">{c.reunioesReal}</TableCell>
                        <TableCell className="text-right">{c.comparecimento}%</TableCell>
                        <TableCell className="text-right">{c.propostas}</TableCell>
                        <TableCell className="text-right">{c.propostaPorReuniao}%</TableCell>
                        <TableCell className="text-right font-semibold">{c.fechados}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{c.conversao}%</TableCell>
                        <TableCell className="text-right">{c.conversaoProposta}%</TableCell>
                        <TableCell className="text-right">{brl(c.receita)}</TableCell>
                        <TableCell className="text-right">{brl(c.ticketMedio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" /> SDRs — Qualificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : sdrs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem dados de SDR no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SDR</TableHead>
                      <TableHead className="text-right">Lig. Realiz.</TableHead>
                      <TableHead className="text-right">Atendidas</TableHead>
                      <TableHead className="text-right">% Atend.</TableHead>
                      <TableHead className="text-right">Qualif.</TableHead>
                      <TableHead className="text-right">Desqualif.</TableHead>
                      <TableHead className="text-right">% Qualif.</TableHead>
                      <TableHead className="text-right">Reun. Ag.</TableHead>
                      <TableHead className="text-right">% Agendam.</TableHead>
                      <TableHead className="text-right">Reun. Real.</TableHead>
                      <TableHead className="text-right">% Compar.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdrs.map((s, i) => (
                      <TableRow key={s.uid}>
                        <TableCell className="font-medium">
                          {i === 0 && <Badge className="mr-2" variant="default">1º</Badge>}
                          {s.nome}
                        </TableCell>
                        <TableCell className="text-right">{s.ligRealizadas}</TableCell>
                        <TableCell className="text-right">{s.ligAtendidas}</TableCell>
                        <TableCell className="text-right">{s.taxaAtendimento}%</TableCell>
                        <TableCell className="text-right font-semibold">{s.qualificados}</TableCell>
                        <TableCell className="text-right">{s.desqualificados}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{s.taxaQualificacao}%</TableCell>
                        <TableCell className="text-right">{s.reunioesAg}</TableCell>
                        <TableCell className="text-right">{s.taxaAgendamento}%</TableCell>
                        <TableCell className="text-right">{s.reunioesReal}</TableCell>
                        <TableCell className="text-right">{s.taxaComparecimento}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Fonte: lançamentos diários comerciais. % Comparecimento = realizadas / agendadas. % Qualificação = qualificados / (qualificados + desqualificados).
        </p>
      </div>
    </AppLayout>
  );
}