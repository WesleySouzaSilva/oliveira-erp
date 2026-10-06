import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Building2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";

type Empresa = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  status: string;
  nps: number | null;
  responsavel_pos_venda: string | null;
  risco: string | null;
  ultimo_contato: string | null;
};

type AvencaRow = { id: string; empresa_id: string; status: string };
type ValorRow = { avenca_id: string; valor_mensal: number };

type Linha = Empresa & {
  status_avenca: string; // melhor status entre as avenças (ativa > suspensa > encerrada)
  mrr: number; // soma de valor_mensal das avenças ativas
  tem_avenca: boolean;
};

const RISCO_OPCOES = [
  { value: "alto",  label: "Alto",  cor: "bg-red-100 text-red-800 border-red-300" },
  { value: "medio", label: "Médio", cor: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: "baixo", label: "Baixo", cor: "bg-emerald-100 text-emerald-800 border-emerald-300" },
] as const;

const STATUS_AVENCA_TONE: Record<string, StatusTone> = {
  ativa: "success",
  suspensa: "warning",
  encerrada: "neutral",
  sem: "neutral",
};
const RISCO_ORDEM: Record<string, number> = { alto: 1, medio: 2, baixo: 3 };

const STATUS_AVENCA_ORDEM: Record<string, number> = { ativa: 1, suspensa: 2, encerrada: 3, sem: 4 };
const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa", suspensa: "Suspensa", encerrada: "Encerrada", sem: "Sem contrato",
};
const STATUS_COR: Record<string, string> = {
  ativa: "bg-emerald-100 text-emerald-800 border-emerald-300",
  suspensa: "bg-amber-100 text-amber-800 border-amber-300",
  encerrada: "bg-slate-100 text-slate-700 border-slate-300",
  sem: "bg-muted text-muted-foreground border-border",
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtData = (d: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
};
const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

type SortKey = "empresa" | "status" | "mrr" | "nps" | "responsavel" | "risco" | "ultimoContato";

export default function CarteiraAvencas() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const confirm = useConfirm();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [avencas, setAvencas] = useState<AvencaRow[]>([]);
  const [valores, setValores] = useState<ValorRow[]>([]);
  const [canSeeFinance, setCanSeeFinance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({
    busca: "",
    filtroStatus: "todos",
    filtroRisco: "todos",
    filtroResp: "todos",
  });
  const { busca, filtroStatus, filtroRisco, filtroResp } = filters;
  const [sortKey, setSortKey] = useState<SortKey>("mrr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [respBulk, setRespBulk] = useState<string>("_none");
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: emps }, { data: avs }] = await Promise.all([
        (supabase as any)
          .from("empresas_consultoria")
          .select("id, razao_social, nome_fantasia, status, nps, responsavel_pos_venda, risco, ultimo_contato")
          .is("deleted_at", null),
        (supabase as any)
          .from("avencas")
          .select("id, empresa_id, status")
          .is("deleted_at", null),
      ]);
      // valores: a RLS bloqueia para quem não pode; se vier vazio + erro, simplesmente não exibe
      const { data: vals, error: valsErr } = await (supabase as any)
        .from("avenca_valores")
        .select("avenca_id, valor_mensal");
      if (cancel) return;
      setEmpresas((emps ?? []) as Empresa[]);
      setAvencas((avs ?? []) as AvencaRow[]);
      // Considera "pode ver financeiro" apenas se a leitura veio sem erro de permissão.
      // Como a RLS apenas filtra silenciosamente (não retorna erro), usamos a presença
      // de pelo menos uma linha OU verificação por papel via membros.
      const meuMembro = (members || []).find((m) => m.user_id === user.id);
      const ehFinanceiro = meuMembro?.papel === "admin" || meuMembro?.papel === "coordenador";
      setCanSeeFinance(ehFinanceiro && !valsErr);
      setValores(ehFinanceiro ? ((vals ?? []) as ValorRow[]) : []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user, members]);

  const linhas: Linha[] = useMemo(() => {
    const avPorEmp = new Map<string, AvencaRow[]>();
    for (const a of avencas) {
      const arr = avPorEmp.get(a.empresa_id) ?? [];
      arr.push(a); avPorEmp.set(a.empresa_id, arr);
    }
    const valPorAv = new Map<string, number>();
    for (const v of valores) valPorAv.set(v.avenca_id, Number(v.valor_mensal || 0));

    return empresas.map((e) => {
      const lista = avPorEmp.get(e.id) ?? [];
      let melhor = "sem";
      for (const a of lista) {
        if ((STATUS_AVENCA_ORDEM[a.status] ?? 99) < (STATUS_AVENCA_ORDEM[melhor] ?? 99)) melhor = a.status;
      }
      const mrr = lista
        .filter((a) => a.status === "ativa")
        .reduce((s, a) => s + (valPorAv.get(a.id) ?? 0), 0);
      return {
        ...e,
        status_avenca: melhor,
        mrr,
        tem_avenca: lista.length > 0,
      };
    });
  }, [empresas, avencas, valores]);

  const resumo = useMemo(() => {
    const carteira = linhas.filter((l) => l.tem_avenca);
    const porStatus: Record<string, number> = { ativa: 0, suspensa: 0, encerrada: 0 };
    const porRisco: Record<string, number> = { alto: 0, medio: 0, baixo: 0 };
    let mrrTotal = 0;
    for (const l of carteira) {
      if (porStatus[l.status_avenca] != null) porStatus[l.status_avenca]++;
      if (l.risco && porRisco[l.risco] != null) porRisco[l.risco]++;
      mrrTotal += l.mrr;
    }
    return { total: carteira.length, porStatus, porRisco, mrrTotal };
  }, [linhas]);

  const nomeMembro = (uid: string | null) => {
    if (!uid) return "—";
    return members.find((m) => m.user_id === uid)?.nome || "Membro";
  };
  const nomeEmpresa = (e: Empresa) => e.nome_fantasia || e.razao_social;

  const linhasFiltradas = useMemo(() => {
    const q = norm(busca);
    let arr = linhas.filter((l) => l.tem_avenca);
    arr = arr.filter((l) => {
      if (filtroStatus !== "todos" && l.status_avenca !== filtroStatus) return false;
      if (filtroRisco !== "todos") {
        if (filtroRisco === "_sem" && l.risco) return false;
        if (filtroRisco !== "_sem" && l.risco !== filtroRisco) return false;
      }
      if (filtroResp !== "todos") {
        if (filtroResp === "_sem" && l.responsavel_pos_venda) return false;
        if (filtroResp !== "_sem" && l.responsavel_pos_venda !== filtroResp) return false;
      }
      if (q && !norm(`${l.razao_social} ${l.nome_fantasia ?? ""}`).includes(q)) return false;
      return true;
    });
    const dirMul = sortDir === "asc" ? 1 : -1;
    const nullLast = (aN: boolean, bN: boolean): number | null => {
      if (aN && bN) return 0;
      if (aN) return 1;
      if (bN) return -1;
      return null;
    };
    arr.sort((a, b) => {
      if (sortKey === "empresa") return nomeEmpresa(a).localeCompare(nomeEmpresa(b), "pt-BR") * dirMul;
      if (sortKey === "status") return ((STATUS_AVENCA_ORDEM[a.status_avenca] ?? 99) - (STATUS_AVENCA_ORDEM[b.status_avenca] ?? 99)) * dirMul;
      if (sortKey === "mrr") return (a.mrr - b.mrr) * dirMul;
      if (sortKey === "nps") {
        const nl = nullLast(a.nps == null, b.nps == null); if (nl !== null) return nl;
        return ((a.nps as number) - (b.nps as number)) * dirMul;
      }
      if (sortKey === "responsavel") {
        const nl = nullLast(!a.responsavel_pos_venda, !b.responsavel_pos_venda); if (nl !== null) return nl;
        return nomeMembro(a.responsavel_pos_venda).localeCompare(nomeMembro(b.responsavel_pos_venda), "pt-BR") * dirMul;
      }
      if (sortKey === "risco") {
        const nl = nullLast(!a.risco, !b.risco); if (nl !== null) return nl;
        return ((RISCO_ORDEM[a.risco!] ?? 99) - (RISCO_ORDEM[b.risco!] ?? 99)) * dirMul;
      }
      if (sortKey === "ultimoContato") {
        const nl = nullLast(!a.ultimo_contato, !b.ultimo_contato); if (nl !== null) return nl;
        return (a.ultimo_contato! < b.ultimo_contato! ? -1 : a.ultimo_contato! > b.ultimo_contato! ? 1 : 0) * dirMul;
      }
      return 0;
    });
    return arr;
  }, [linhas, busca, filtroStatus, filtroRisco, filtroResp, sortKey, sortDir, members]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      const ascDefault = new Set<SortKey>(["empresa", "status", "responsavel", "risco", "ultimoContato"]);
      setSortDir(ascDefault.has(k) ? "asc" : "desc");
    }
  };
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-50" />
      : sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;

  const idsFiltrados = useMemo(() => new Set(linhasFiltradas.map((l) => l.id)), [linhasFiltradas]);
  const selecVisiveis = useMemo(() => [...selecionados].filter((id) => idsFiltrados.has(id)), [selecionados, idsFiltrados]);
  const todosMarcados = linhasFiltradas.length > 0 && selecVisiveis.length === linhasFiltradas.length;

  const toggleTodos = () => {
    if (todosMarcados) {
      setSelecionados((prev) => { const n = new Set(prev); for (const id of idsFiltrados) n.delete(id); return n; });
    } else {
      setSelecionados((prev) => { const n = new Set(prev); for (const id of idsFiltrados) n.add(id); return n; });
    }
  };
  const toggleUm = (id: string) => {
    setSelecionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const aplicarAtribuicao = async () => {
    const ids = selecVisiveis;
    if (ids.length === 0) return;
    const novoResp = respBulk === "_none" ? null : respBulk;
    const alvo = novoResp ? nomeMembro(novoResp) : "Sem responsável";
    const ok = await confirm({
      title: "Atribuir em bloco",
      description: `Atribuir ${ids.length} empresa${ids.length === 1 ? "" : "s"} a "${alvo}"?`,
      confirmText: "Atribuir",
    });
    if (!ok) return;
    setAplicando(true);
    const prev = empresas;
    setEmpresas((es) => es.map((e) => ids.includes(e.id) ? { ...e, responsavel_pos_venda: novoResp } : e));
    const { error } = await (supabase as any)
      .from("empresas_consultoria")
      .update({ responsavel_pos_venda: novoResp, updated_at: new Date().toISOString() })
      .in("id", ids);
    setAplicando(false);
    if (error) {
      setEmpresas(prev);
      toast({ title: "Não foi possível atribuir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${ids.length} empresa${ids.length === 1 ? "" : "s"} atribuída${ids.length === 1 ? "" : "s"}` });
    setSelecionados(new Set());
  };

  const updateField = async (id: string, patch: Partial<Empresa>) => {
    const prev = empresas;
    setEmpresas((es) => es.map((e) => e.id === id ? { ...e, ...patch } : e));
    const { error } = await (supabase as any)
      .from("empresas_consultoria")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setEmpresas(prev);
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          icon={Building2}
          title="Carteira de Empresas"
          subtitle="Pós-Venda Empresarial — todas as empresas com contrato de consultoria ativo, suspenso ou encerrado."
          breadcrumb={[{ label: "Empresarial" }, { label: "Carteira de Empresas" }]}
        />

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Empresas na carteira</div>
            <div className="font-serif text-2xl text-primary mt-1">{resumo.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Por status</div>
            <div className="text-sm mt-1 space-y-0.5">
              <div><span className="text-emerald-700">Ativas:</span> {resumo.porStatus.ativa}</div>
              <div><span className="text-amber-700">Suspensas:</span> {resumo.porStatus.suspensa}</div>
              <div><span className="text-slate-700">Encerradas:</span> {resumo.porStatus.encerrada}</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Por risco</div>
            <div className="text-sm mt-1 space-y-0.5">
              <div><span className="text-red-700">Alto:</span> {resumo.porRisco.alto}</div>
              <div><span className="text-amber-700">Médio:</span> {resumo.porRisco.medio}</div>
              <div><span className="text-emerald-700">Baixo:</span> {resumo.porRisco.baixo}</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Receita recorrente (MRR) da carteira</div>
            <div className="font-serif text-2xl text-primary mt-1 flex items-center gap-2">
              {canSeeFinance ? fmtMoeda(resumo.mrrTotal) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground text-base">
                  <Lock className="w-4 h-4" /> Restrito
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa…"
                className="pl-9"
                value={busca}
                onChange={(e) => setFilters({ busca: e.target.value })}
              />
            </div>
            <Select value={filtroStatus} onValueChange={(v) => setFilters({ filtroStatus: v })}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="suspensa">Suspensas</SelectItem>
                <SelectItem value="encerrada">Encerradas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroRisco} onValueChange={(v) => setFilters({ filtroRisco: v })}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo risco</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="_sem">Sem risco definido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroResp} onValueChange={(v) => setFilters({ filtroResp: v })}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos responsáveis</SelectItem>
                <SelectItem value="_sem">Sem responsável</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.nome || "Membro"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selecVisiveis.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 p-3 rounded-md bg-accent/5 border border-accent/20">
              <div className="text-sm">
                <span className="font-medium">{selecVisiveis.length}</span> selecionada{selecVisiveis.length === 1 ? "" : "s"}
              </div>
              <Select value={respBulk} onValueChange={setRespBulk}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Atribuir a…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem responsável</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || "Membro"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={aplicarAtribuicao} disabled={aplicando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {aplicando ? "Aplicando…" : "Atribuir em bloco"}
              </Button>
              <Button variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar</Button>
            </div>
          )}
        </Card>

        {/* Tabela */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox checked={todosMarcados} onCheckedChange={toggleTodos} aria-label="Selecionar todos" />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("empresa")}>Empresa <SortIcon k="empresa" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>Status do contrato <SortIcon k="status" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("mrr")}>Receita recorrente (MRR) <SortIcon k="mrr" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("nps")}>NPS <SortIcon k="nps" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("responsavel")}>Responsável <SortIcon k="responsavel" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("risco")}>Risco <SortIcon k="risco" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("ultimoContato")}>Último contato <SortIcon k="ultimoContato" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : linhasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="text-muted-foreground">
                      <Building2 className="w-10 h-10 mx-auto opacity-50 mb-2" />
                      <div className="font-medium">Nenhuma empresa na carteira ainda</div>
                      <div className="text-xs mt-1">
                        Cadastre empresas em <Link to="/consultoria/empresas" className="underline">Empresas</Link> e crie o primeiro contrato de consultoria.
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : linhasFiltradas.map((l) => (
                <TableRow key={l.id} className="group">
                  <TableCell>
                    <Checkbox checked={selecionados.has(l.id)} onCheckedChange={() => toggleUm(l.id)} aria-label="Selecionar" />
                  </TableCell>
                  <TableCell>
                    <Link to={`/consultoria/empresas/${l.id}`} className="font-medium text-primary hover:underline">
                      {nomeEmpresa(l)}
                    </Link>
                    {l.nome_fantasia && l.nome_fantasia !== l.razao_social && (
                      <div className="text-xs text-muted-foreground">{l.razao_social}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={STATUS_AVENCA_TONE[l.status_avenca] ?? "neutral"}
                      label={STATUS_LABEL[l.status_avenca]}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {canSeeFinance ? (
                      l.mrr > 0 ? fmtMoeda(l.mrr) : <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Lock className="w-3 h-3" /> Restrito
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min={0} max={10}
                      className="w-16 h-8"
                      value={l.nps ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.max(0, Math.min(10, Number(e.target.value)));
                        setEmpresas((es) => es.map((x) => x.id === l.id ? { ...x, nps: v } : x));
                      }}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Math.max(0, Math.min(10, Number(e.target.value)));
                        updateField(l.id, { nps: v });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={l.responsavel_pos_venda ?? "_none"}
                      onValueChange={(v) => updateField(l.id, { responsavel_pos_venda: v === "_none" ? null : v })}
                    >
                      <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sem responsável</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.nome || "Membro"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={l.risco ?? "_none"}
                      onValueChange={(v) => updateField(l.id, { risco: v === "_none" ? null : v })}
                    >
                      <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {RISCO_OPCOES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtData(l.ultimo_contato)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
