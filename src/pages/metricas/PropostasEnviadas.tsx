import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Trash2, RefreshCw, Plus, Calculator, Briefcase } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type StatusVerificacao = "pendente" | "verdadeira" | "erro";

interface PropostaUnificada {
  id: string;
  tipo: "honorarios" | "consultoria";
  origem_label: string;
  created_at: string;
  cliente_nome: string;
  resumo: string;
  valor: number;
  operador_id: string;
  status_verificacao: StatusVerificacao;
  numero?: string | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function PropostasEnviadas() {
  const { members, isAdmin, loading: loadingMembers } = useOrgMembers();
  const navigate = useNavigate();
  const [propostas, setPropostas] = useState<PropostaUnificada[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "honorarios" | "consultoria">("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | StatusVerificacao>("todos");
  const [busca, setBusca] = useState("");

  const nomeOperador = (id: string) =>
    members.find((m) => m.user_id === id)?.nome || "Operador desconhecido";

  const carregar = async () => {
    setLoading(true);
    const [hon, cons] = await Promise.all([
      supabase
        .from("honorarios_calculos")
        .select("id, created_at, cliente_nome, valor_divida, honorario_total, operador_id, status_verificacao, numero_proposta")
        .order("created_at", { ascending: false }),
      supabase
        .from("consultoria_simulacoes")
        .select("id, created_at, cliente_nome, plano, valor_mensalidade_final, operador_id, status_verificacao")
        .order("created_at", { ascending: false }),
    ]);

    const lista: PropostaUnificada[] = [
      ...(hon.data || []).map((r: any) => ({
        id: r.id,
        tipo: "honorarios" as const,
        origem_label: "Honorários",
        created_at: r.created_at,
        cliente_nome: r.cliente_nome,
        resumo: `Dívida ${fmtBRL(Number(r.valor_divida) || 0)}`,
        valor: Number(r.honorario_total) || 0,
        operador_id: r.operador_id,
        status_verificacao: (r.status_verificacao || "pendente") as StatusVerificacao,
        numero: r.numero_proposta,
      })),
      ...(cons.data || []).map((r: any) => ({
        id: r.id,
        tipo: "consultoria" as const,
        origem_label: "Consultoria",
        created_at: r.created_at,
        cliente_nome: r.cliente_nome,
        resumo: `Plano ${r.plano}`,
        valor: Number(r.valor_mensalidade_final) || 0,
        operador_id: r.operador_id,
        status_verificacao: (r.status_verificacao || "pendente") as StatusVerificacao,
      })),
    ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    setPropostas(lista);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return propostas.filter((p) => {
      if (filtroTipo !== "todas" && p.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos" && p.status_verificacao !== filtroStatus) return false;
      if (q && !p.cliente_nome.toLowerCase().includes(q) && !nomeOperador(p.operador_id).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [propostas, filtroTipo, filtroStatus, busca, members]);

  const contagem = useMemo(() => ({
    total: propostas.length,
    pendente: propostas.filter((p) => p.status_verificacao === "pendente").length,
    verdadeira: propostas.filter((p) => p.status_verificacao === "verdadeira").length,
    erro: propostas.filter((p) => p.status_verificacao === "erro").length,
  }), [propostas]);

  const atualizarStatus = async (p: PropostaUnificada, novo: StatusVerificacao) => {
    const tabela = p.tipo === "honorarios" ? "honorarios_calculos" : "consultoria_simulacoes";
    const { error } = await supabase.from(tabela).update({ status_verificacao: novo }).eq("id", p.id);
    if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
    setPropostas((prev) => prev.map((x) => x.id === p.id && x.tipo === p.tipo ? { ...x, status_verificacao: novo } : x));
    toast({ title: "Status atualizado" });
  };

  const apagar = async (p: PropostaUnificada) => {
    if (!isAdmin) return;
    const tabela = p.tipo === "honorarios" ? "honorarios_calculos" : "consultoria_simulacoes";
    const { error } = await supabase.from(tabela).delete().eq("id", p.id);
    if (error) { toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" }); return; }
    setPropostas((prev) => prev.filter((x) => !(x.id === p.id && x.tipo === p.tipo)));
    toast({ title: "Proposta apagada" });
  };

  const statusBadge = (s: StatusVerificacao) => {
    if (s === "verdadeira") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Verdadeira</Badge>;
    if (s === "erro") return <Badge variant="destructive">Erro</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Propostas Enviadas</h1>
            <p className="text-muted-foreground mt-1">Honorários e Consultoria salvos pelos operadores</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4" /> Nova proposta
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/calculadora-honorarios")}>
                  <Calculator className="w-4 h-4 mr-2" /> Honorários de Reestruturação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/consultoria-empresarial")}>
                  <Briefcase className="w-4 h-4 mr-2" /> Consultoria Empresarial
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Atualizar
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{contagem.total}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-semibold">{contagem.pendente}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Verdadeiras</div><div className="text-2xl font-semibold text-emerald-600">{contagem.verdadeira}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Erros</div><div className="text-2xl font-semibold text-destructive">{contagem.erro}</div></Card>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
              <TabsList>
                <TabsTrigger value="todas">Todas</TabsTrigger>
                <TabsTrigger value="honorarios">Honorários</TabsTrigger>
                <TabsTrigger value="consultoria">Consultoria</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
              <TabsList>
                <TabsTrigger value="todos">Todos status</TabsTrigger>
                <TabsTrigger value="pendente">Pendente</TabsTrigger>
                <TabsTrigger value="verdadeira">Verdadeira</TabsTrigger>
                <TabsTrigger value="erro">Erro</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              placeholder="Buscar cliente ou operador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="max-w-xs ml-auto"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {loading || loadingMembers ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma proposta encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Detalhe</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-left">Operador</th>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p) => (
                    <tr key={`${p.tipo}-${p.id}`} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2"><Badge variant="outline">{p.origem_label}</Badge></td>
                      <td className="px-3 py-2 font-medium">
                        {p.cliente_nome}
                        {p.numero && <div className="text-[10px] text-muted-foreground">{p.numero}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.resumo}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtBRL(p.valor)}</td>
                      <td className="px-3 py-2">{nomeOperador(p.operador_id)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                      <td className="px-3 py-2">{statusBadge(p.status_verificacao)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon" variant="ghost" title="Marcar verdadeira"
                            onClick={() => atualizarStatus(p, "verdadeira")}
                            disabled={p.status_verificacao === "verdadeira"}
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" title="Marcar erro"
                            onClick={() => atualizarStatus(p, "erro")}
                            disabled={p.status_verificacao === "erro"}
                          >
                            <XCircle className="w-4 h-4 text-destructive" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" title="Marcar pendente"
                            onClick={() => atualizarStatus(p, "pendente")}
                            disabled={p.status_verificacao === "pendente"}
                          >
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" title="Apagar (admin)">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Apagar proposta?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação é irreversível. A proposta de {p.cliente_nome} ({p.origem_label}) será removida permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => apagar(p)} className="bg-destructive text-destructive-foreground">
                                    Apagar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {!isAdmin && (
          <p className="text-xs text-muted-foreground text-center">
            Apenas administradores podem apagar propostas.
          </p>
        )}
      </div>
    </AppLayout>
  );
}