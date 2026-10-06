import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Loader2, Pencil, History, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

function todayYMD() { return new Date().toISOString().slice(0, 10); }
function daysAgoYMD(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function brl(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

type Row = {
  id: string;
  data: string;
  nicho: string;
  closer_id: string | null;
  sdr_id: string | null;
  reunioes_realizadas: number | null;
  reunioes_agendadas: number | null;
  ligacoes: number | null;
  sdr_ligacoes_realizadas: number | null;
  leads_qualificados_sdr: number | null;
  follow_ups: number | null;
  propostas_enviadas: number | null;
  contratos_fechados: number | null;
  receita_fechada: number | null;
  observacoes: string | null;
  user_id: string | null;
  updated_at: string;
};

export default function HistoricoLancamentosComercial() {
  const { members } = useOrgMembers();
  const [inicio, setInicio] = useState(daysAgoYMD(30));
  const [fim, setFim] = useState(todayYMD());
  const [membroFiltro, setMembroFiltro] = useState<string>("all");
  const [nichoFiltro, setNichoFiltro] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const memberNome = (id: string | null | undefined) =>
    id ? (members.find((m) => m.user_id === id)?.nome || id.slice(0, 8)) : "—";

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("mkt_lancamentos_diarios")
      .select("id,data,nicho,closer_id,sdr_id,reunioes_realizadas,reunioes_agendadas,ligacoes,sdr_ligacoes_realizadas,leads_qualificados_sdr,follow_ups,propostas_enviadas,contratos_fechados,receita_fechada,observacoes,user_id,updated_at")
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: false })
      .order("updated_at", { ascending: false });

    // só lançamentos comerciais (com closer_id ou sdr_id)
    q = q.or("closer_id.not.is.null,sdr_id.not.is.null");

    if (nichoFiltro !== "all") q = q.eq("nicho", nichoFiltro);
    if (membroFiltro !== "all") {
      q = q.or(`closer_id.eq.${membroFiltro},sdr_id.eq.${membroFiltro}`);
    }

    const { data, error } = await q.limit(500);
    if (error) {
      toast.error("Erro ao carregar lançamentos");
      setRows([]);
    } else {
      setRows((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [inicio, fim, membroFiltro, nichoFiltro]);

  const totais = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.reunioes += r.reunioes_realizadas || 0;
        acc.propostas += r.propostas_enviadas || 0;
        acc.contratos += r.contratos_fechados || 0;
        acc.receita += r.receita_fechada || 0;
        return acc;
      },
      { reunioes: 0, propostas: 0, contratos: 0, receita: 0 },
    );
  }, [rows]);

  const editUrl = (r: Row) => {
    const params = new URLSearchParams({ data: r.data, nicho: r.nicho });
    if (r.closer_id) params.set("closer", r.closer_id);
    if (r.sdr_id) params.set("sdr", r.sdr_id);
    return `/metricas/comercial?${params.toString()}`;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to="/metricas/overview-comercial" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3" /> Voltar ao Overview Comercial
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 mt-1">
              <History className="w-6 h-6 text-primary" /> Histórico — Lançamentos Comerciais
            </h1>
            <p className="text-sm text-muted-foreground">
              Todos os lançamentos diários de SDRs e Closers. Clique em "Editar" para abrir o dia da pessoa.
            </p>
          </div>
          <Button asChild>
            <Link to="/metricas/comercial">Novo lançamento</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={fim} max={todayYMD()} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Membro</Label>
              <Select value={membroFiltro} onValueChange={setMembroFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nicho</Label>
              <Select value={nichoFiltro} onValueChange={setNichoFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="agro">Agro</SelectItem>
                  <SelectItem value="empresarial">Empresarial</SelectItem>
                  <SelectItem value="bpc">BPC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground uppercase">Reuniões</p><p className="text-xl font-bold">{totais.reunioes}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground uppercase">Propostas</p><p className="text-xl font-bold">{totais.propostas}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground uppercase">Contratos</p><p className="text-xl font-bold">{totais.contratos}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground uppercase">Receita</p><p className="text-xl font-bold">{brl(totais.receita)}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{loading ? "Carregando..." : `${rows.length} lançamento(s)`}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nenhum lançamento neste período/filtro.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Função</th>
                      <th className="px-3 py-2">Pessoa</th>
                      <th className="px-3 py-2">Nicho</th>
                      <th className="px-3 py-2 text-right">Reuniões</th>
                      <th className="px-3 py-2 text-right">Propostas</th>
                      <th className="px-3 py-2 text-right">Contratos</th>
                      <th className="px-3 py-2 text-right">Receita</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isCloser = !!r.closer_id;
                      const pessoa = isCloser ? memberNome(r.closer_id) : memberNome(r.sdr_id);
                      const reun = isCloser ? r.reunioes_realizadas : r.reunioes_agendadas;
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{fmtDate(r.data)}</td>
                          <td className="px-3 py-2">
                            <Badge variant={isCloser ? "default" : "secondary"} className="text-[10px]">
                              {isCloser ? "Closer" : "SDR"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">{pessoa}</td>
                          <td className="px-3 py-2 capitalize">{r.nicho}</td>
                          <td className="px-3 py-2 text-right">{reun || 0}</td>
                          <td className="px-3 py-2 text-right">{r.propostas_enviadas || 0}</td>
                          <td className="px-3 py-2 text-right font-medium">{r.contratos_fechados || 0}</td>
                          <td className="px-3 py-2 text-right">{brl(r.receita_fechada || 0)}</td>
                          <td className="px-3 py-2 text-right">
                            <Button asChild size="sm" variant="outline" className="h-7">
                              <Link to={editUrl(r)}>
                                <Pencil className="w-3 h-3 mr-1" /> Editar
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}