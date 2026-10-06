import { useEffect, useMemo, useState } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Star, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, MessageSquarePlus, Users, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DivisaoCarteiraPanel from "@/components/posVenda/DivisaoCarteiraPanel";
import ClientesADistribuirPanel from "@/components/posVenda/ClientesADistribuirPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { toast } from "@/hooks/use-toast";
import { RegistrarContatoDialog, type ContatoSalvo } from "@/components/posVenda/RegistrarContatoDialog";

type Cliente = {
  id: string;
  nome: string;
  status_adimplencia: string;
  vip: boolean;
  nps: number | null;
  responsavel_pos_venda: string | null;
  risco: string | null;
  situacao?: string | null;
  situacao_alterada_em?: string | null;
};

type Contrato = {
  nome_cliente: string;
  banco: string | null;
  valor_total_operacao: number | null;
  vencimento_proxima_parcela: string | null;
};

type ProcessoRow = {
  id: string;
  updated_at: string | null;
  kanban_coluna_id: string | null;
  fase_atual: string | null;
  laudo: { dados_etapa1: Record<string, unknown> | null } | null;
  coluna: { titulo: string | null; ordem: number | null } | null;
};

type AtendimentoRow = { cliente_nome: string | null; created_at: string };

type Nivel = "N1" | "N2" | "N3" | "N4" | "N5";

type Linha = Cliente & {
  divida_total: number;
  proximo_prazo: string | null;
  nivel: Nivel;
  banco_principal: string | null;
  fase_caso: string | null;
  fase_ordem: number | null;
  ultimo_contato: string | null;
};

const NIVEIS: { key: Nivel; label: string; min: number; max: number; cor: string }[] = [
  { key: "N1", label: "N1 · até R$ 1M",      min: 0,         max: 1_000_000,  cor: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "N2", label: "N2 · 1M–5M",          min: 1_000_000, max: 5_000_000,  cor: "bg-lime-100 text-lime-800 border-lime-300" },
  { key: "N3", label: "N3 · 5M–20M",         min: 5_000_000, max: 20_000_000, cor: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "N4", label: "N4 · 20M–50M",        min: 20_000_000,max: 50_000_000, cor: "bg-orange-100 text-orange-800 border-orange-300" },
  { key: "N5", label: "N5 · acima de 50M",   min: 50_000_000,max: Infinity,   cor: "bg-red-100 text-red-800 border-red-300" },
];

function calcularNivel(divida: number): Nivel {
  for (const n of NIVEIS) {
    if (divida >= n.min && divida < n.max) return n.key;
  }
  return "N5";
}

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtData = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

type SortKey =
  | "nome" | "divida" | "nivel" | "responsavel" | "nps" | "situacao" | "prazo" | "vip"
  | "risco" | "banco" | "fase" | "ultimoContato";

const RISCO_OPCOES: { value: string; label: string; cor: string }[] = [
  { value: "alto",  label: "Alto",  cor: "bg-red-100 text-red-800 border-red-300" },
  { value: "medio", label: "Médio", cor: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: "baixo", label: "Baixo", cor: "bg-emerald-100 text-emerald-800 border-emerald-300" },
];

const NIVEL_TONE: Record<string, StatusTone> = {
  N1: "success", N2: "success", N3: "warning", N4: "warning", N5: "danger",
};
const nivelTone = (n: string): StatusTone => NIVEL_TONE[n] ?? "neutral";

const RISCO_TONE: Record<string, StatusTone> = {
  alto: "danger", medio: "warning", baixo: "success",
};
const riscoTone = (r: string): StatusTone => RISCO_TONE[r] ?? "neutral";
const RISCO_ORDEM: Record<string, number> = { alto: 1, medio: 2, baixo: 3 };

export default function CarteiraClientes() {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const { podeGerirCliente } = usePapelRadar();
  const confirm = useConfirm();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendimentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({
    busca: "",
    filtroNivel: "todos",
    filtroResp: "todos",
  });
  const { busca, filtroResp } = filters;
  const filtroNivel = filters.filtroNivel as Nivel | "todos";
  const setFiltroNivel = (v: Nivel | "todos") => setFilters({ filtroNivel: v });
  const [sortKey, setSortKey] = useState<SortKey>("divida");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [respBulk, setRespBulk] = useState<string>("_none");
  const [divisaoAberta, setDivisaoAberta] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [contatoOpen, setContatoOpen] = useState(false);
  const [contatoCliente, setContatoCliente] = useState<{ id?: string | null; nome?: string | null } | null>(null);
  const [agrupar, setAgrupar] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: cls }, { data: cts }, { data: prs }, { data: ats }] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, status_adimplencia, vip, nps, responsavel_pos_venda, risco, situacao, situacao_alterada_em")
          .is("deleted_at", null),
        lerTudo(() => supabase
          .from("contratos_vencimentos")
          .select("nome_cliente, banco, valor_total_operacao, vencimento_proxima_parcela")
          .is("deleted_at", null)),
        lerTudo(() => supabase
          .from("processos")
          .select("id, updated_at, kanban_coluna_id, fase_atual, laudo:laudos(dados_etapa1), coluna:kanban_colunas(titulo, ordem)")
          .is("deleted_at", null)),
        supabase
          .from("atendimentos_notas")
          .select("cliente_nome, created_at"),
      ]);
      if (cancel) return;
      setClientes((cls ?? []) as Cliente[]);
      setContratos((cts ?? []) as Contrato[]);
      setProcessos((prs ?? []) as unknown as ProcessoRow[]);
      setAtendimentos((ats ?? []) as AtendimentoRow[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  const agregadoPorNome = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const map = new Map<string, { total: number; proximo: string | null; bancos: Map<string, number> }>();
    for (const c of contratos) {
      const key = norm(c.nome_cliente || "");
      if (!key) continue;
      const cur = map.get(key) ?? { total: 0, proximo: null as string | null, bancos: new Map<string, number>() };
      const valor = Number(c.valor_total_operacao || 0);
      cur.total += valor;
      const banco = (c.banco || "").trim();
      if (banco) cur.bancos.set(banco, (cur.bancos.get(banco) ?? 0) + valor);
      const v = c.vencimento_proxima_parcela;
      if (v && v >= hoje && (!cur.proximo || v < cur.proximo)) {
        cur.proximo = v;
      }
      map.set(key, cur);
    }
    return map;
  }, [contratos]);

  const processoPorNome = useMemo(() => {
    const map = new Map<string, { titulo: string; ordem: number; updated_at: string | null }>();
    for (const p of processos) {
      const d = (p.laudo?.dados_etapa1 ?? {}) as Record<string, unknown>;
      const rawNome = (d.nomeProdutor as string) || (d.produtor as string) || (d.nome as string) || "";
      const key = norm(rawNome);
      if (!key) continue;
      const titulo = p.coluna?.titulo || (p.fase_atual ? `Fase ${p.fase_atual}` : "—");
      const ordem = p.coluna?.ordem ?? (p.fase_atual ? Number(p.fase_atual) : 0) ?? 0;
      const cur = map.get(key);
      if (!cur || ordem > cur.ordem || (ordem === cur.ordem && (p.updated_at ?? "") > (cur.updated_at ?? ""))) {
        map.set(key, { titulo, ordem, updated_at: p.updated_at });
      }
    }
    return map;
  }, [processos]);

  const ultimoContatoPorNome = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of atendimentos) {
      const key = norm(a.cliente_nome || "");
      if (!key) continue;
      const cur = map.get(key);
      if (!cur || a.created_at > cur) map.set(key, a.created_at);
    }
    return map;
  }, [atendimentos]);

  const linhas: Linha[] = useMemo(() => {
    return clientes.map((c) => {
      const key = norm(c.nome);
      const agg = agregadoPorNome.get(key) ?? { total: 0, proximo: null as string | null, bancos: new Map<string, number>() };
      let banco_principal: string | null = null;
      let max = -1;
      for (const [b, v] of agg.bancos) {
        if (v > max) { max = v; banco_principal = b; }
      }
      const proc = processoPorNome.get(key);
      const ult = ultimoContatoPorNome.get(key) ?? null;
      return {
        ...c,
        divida_total: agg.total,
        proximo_prazo: agg.proximo,
        nivel: calcularNivel(agg.total),
        banco_principal,
        fase_caso: proc?.titulo ?? null,
        fase_ordem: proc?.ordem ?? null,
        ultimo_contato: ult,
      };
    });
  }, [clientes, agregadoPorNome, processoPorNome, ultimoContatoPorNome]);

  const resumoNiveis = useMemo(() => {
    return NIVEIS.map((n) => {
      const itens = linhas.filter((l) => l.nivel === n.key);
      return {
        ...n,
        quantidade: itens.length,
        soma: itens.reduce((s, l) => s + l.divida_total, 0),
      };
    });
  }, [linhas]);

  /**
   * Distribui automaticamente os clientes ATIVOS sem responsável entre os membros da equipe,
   * equilibrando pela carteira que cada um já tem. Clientes encerrados/rescindidos/fora do
   * escopo nunca entram na distribuição.
   */
  const distribuirAutomaticamente = async () => {
    if (members.length === 0) {
      toast({ title: "Nenhum membro da equipe disponível", variant: "destructive" });
      return;
    }
    const hoje = new Date();
    const inicio = hoje.toISOString().slice(0, 10);
    const limite = new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10);

    const { data: opsProx } = await supabase
      .from("operacoes_credito")
      .select("cliente_id").is("deleted_at", null)
      .gte("vence_em", inicio)
      .lte("vence_em", limite);
    const idsComVenc = new Set(((opsProx ?? []) as { cliente_id: string | null }[]).map((o) => o.cliente_id));
    const nomesComVenc = new Set(
      contratos
        .filter((c) => c.vencimento_proxima_parcela && c.vencimento_proxima_parcela >= inicio && c.vencimento_proxima_parcela <= limite)
        .map((c) => norm(c.nome_cliente || "")),
    );

    const naoTriados = clientes.filter(
      (c) => !c.situacao_alterada_em && (idsComVenc.has(c.id) || nomesComVenc.has(norm(c.nome))),
    ).length;

    if (naoTriados > 0) {
      const seguir = await confirm({
        title: "Triagem pendente",
        description: `${naoTriados} clientes ainda não foram triados — triar antes de distribuir`,
        confirmText: "Distribuir mesmo assim",
      });
      if (!seguir) return;
    }

    const alvos = clientes.filter((c) => (c.situacao ?? "ativo") === "ativo" && !c.responsavel_pos_venda);
    if (alvos.length === 0) {
      toast({ title: "Nenhum cliente ativo sem responsável para distribuir" });
      return;
    }

    const ok = await confirm({
      title: "Distribuir automaticamente",
      description: `Distribuir ${alvos.length} cliente(s) ativo(s) entre ${members.length} membro(s) da equipe?`,
      confirmText: "Distribuir",
    });
    if (!ok) return;

    const carga = new Map<string, number>();
    for (const m of members) carga.set(m.user_id, 0);
    for (const c of clientes) {
      if (c.responsavel_pos_venda && carga.has(c.responsavel_pos_venda)) {
        carga.set(c.responsavel_pos_venda, (carga.get(c.responsavel_pos_venda) ?? 0) + 1);
      }
    }

    setAplicando(true);
    const prev = clientes;
    const atribuicoes = new Map<string, string>();
    for (const alvo of alvos) {
      let escolhido = members[0].user_id;
      for (const m of members) {
        if ((carga.get(m.user_id) ?? 0) < (carga.get(escolhido) ?? 0)) escolhido = m.user_id;
      }
      carga.set(escolhido, (carga.get(escolhido) ?? 0) + 1);
      atribuicoes.set(alvo.id, escolhido);
    }

    setClientes((cs) =>
      cs.map((c) => (atribuicoes.has(c.id) ? { ...c, responsavel_pos_venda: atribuicoes.get(c.id)! } : c)),
    );

    const porResp = new Map<string, string[]>();
    for (const [clienteId, resp] of atribuicoes) {
      porResp.set(resp, [...(porResp.get(resp) ?? []), clienteId]);
    }
    const erros = await Promise.all(
      [...porResp.entries()].map(([resp, ids]) =>
        supabase
          .from("clientes")
          .update({ responsavel_pos_venda: resp, updated_at: new Date().toISOString() })
          .in("id", ids),
      ),
    );
    setAplicando(false);
    if (erros.some((r) => r.error)) {
      setClientes(prev);
      toast({ title: "Não foi possível concluir a distribuição", variant: "destructive" });
      return;
    }
    toast({ title: `${alvos.length} cliente(s) distribuído(s)` });
  };

  const nomeMembro = (uid: string | null) => {
    if (!uid) return "—";
    const m = members.find((x) => x.user_id === uid);
    return m?.nome || "Membro";
  };

  const linhasFiltradas = useMemo(() => {
    const q = norm(busca);
    const filtradas = linhas.filter((l) => {
      if (filtroNivel !== "todos" && l.nivel !== filtroNivel) return false;
      if (filtroResp !== "todos") {
        if (filtroResp === "_sem") {
          if (l.responsavel_pos_venda) return false;
        } else if (l.responsavel_pos_venda !== filtroResp) {
          return false;
        }
      }
      if (q && !norm(l.nome).includes(q)) return false;
      return true;
    });
    const ordemNivel: Record<Nivel, number> = { N1: 1, N2: 2, N3: 3, N4: 4, N5: 5 };
    const dirMul = sortDir === "asc" ? 1 : -1;
    // For keys where nulls always go last regardless of direction
    const nullLast = (aNull: boolean, bNull: boolean): number | null => {
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return null;
    };
    filtradas.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "nome") {
        cmp = a.nome.localeCompare(b.nome, "pt-BR");
        return cmp * dirMul;
      }
      if (sortKey === "divida") {
        return (a.divida_total - b.divida_total) * dirMul;
      }
      if (sortKey === "nivel") {
        return (ordemNivel[a.nivel] - ordemNivel[b.nivel]) * dirMul;
      }
      if (sortKey === "responsavel") {
        const nl = nullLast(!a.responsavel_pos_venda, !b.responsavel_pos_venda);
        if (nl !== null) return nl;
        return nomeMembro(a.responsavel_pos_venda).localeCompare(
          nomeMembro(b.responsavel_pos_venda), "pt-BR",
        ) * dirMul;
      }
      if (sortKey === "nps") {
        const nl = nullLast(a.nps == null, b.nps == null);
        if (nl !== null) return nl;
        return ((a.nps as number) - (b.nps as number)) * dirMul;
      }
      if (sortKey === "situacao") {
        return (a.status_adimplencia || "").localeCompare(b.status_adimplencia || "", "pt-BR") * dirMul;
      }
      if (sortKey === "prazo") {
        const nl = nullLast(!a.proximo_prazo, !b.proximo_prazo);
        if (nl !== null) return nl;
        return (a.proximo_prazo! < b.proximo_prazo! ? -1 : a.proximo_prazo! > b.proximo_prazo! ? 1 : 0) * dirMul;
      }
      if (sortKey === "vip") {
        return ((a.vip ? 1 : 0) - (b.vip ? 1 : 0)) * dirMul;
      }
      if (sortKey === "risco") {
        const nl = nullLast(!a.risco, !b.risco);
        if (nl !== null) return nl;
        return ((RISCO_ORDEM[a.risco!] ?? 99) - (RISCO_ORDEM[b.risco!] ?? 99)) * dirMul;
      }
      if (sortKey === "banco") {
        const nl = nullLast(!a.banco_principal, !b.banco_principal);
        if (nl !== null) return nl;
        return a.banco_principal!.localeCompare(b.banco_principal!, "pt-BR") * dirMul;
      }
      if (sortKey === "fase") {
        const nl = nullLast(a.fase_ordem == null, b.fase_ordem == null);
        if (nl !== null) return nl;
        return ((a.fase_ordem as number) - (b.fase_ordem as number)) * dirMul;
      }
      if (sortKey === "ultimoContato") {
        const nl = nullLast(!a.ultimo_contato, !b.ultimo_contato);
        if (nl !== null) return nl;
        return (a.ultimo_contato! < b.ultimo_contato! ? -1 : a.ultimo_contato! > b.ultimo_contato! ? 1 : 0) * dirMul;
      }
      return 0;
    });
    return filtradas;
  }, [linhas, filtroNivel, filtroResp, busca, sortKey, sortDir, members]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      const ascDefault = new Set<SortKey>(["nome", "responsavel", "situacao", "prazo", "banco", "fase", "risco", "ultimoContato"]);
      setSortDir(ascDefault.has(k) ? "asc" : "desc");
    }
  };

  // Mantém a seleção restrita ao conjunto filtrado atual.
  const idsFiltrados = useMemo(() => new Set(linhasFiltradas.map((l) => l.id)), [linhasFiltradas]);
  const selecionadosVisiveis = useMemo(
    () => [...selecionados].filter((id) => idsFiltrados.has(id)),
    [selecionados, idsFiltrados],
  );
  const totalFiltrados = linhasFiltradas.length;
  const todosMarcados = totalFiltrados > 0 && selecionadosVisiveis.length === totalFiltrados;
  const algunsMarcados = selecionadosVisiveis.length > 0 && !todosMarcados;

  const toggleSelecionarTodos = () => {
    if (todosMarcados) {
      setSelecionados((prev) => {
        const next = new Set(prev);
        for (const id of idsFiltrados) next.delete(id);
        return next;
      });
    } else {
      setSelecionados((prev) => {
        const next = new Set(prev);
        for (const id of idsFiltrados) next.add(id);
        return next;
      });
    }
  };

  const toggleSelecionarUm = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const aplicarAtribuicaoEmMassa = async () => {
    const ids = selecionadosVisiveis;
    if (ids.length === 0) return;
    const novoResp = respBulk === "_none" ? null : respBulk;
    const nomeAlvo = novoResp ? nomeMembro(novoResp) : "Sem responsável";
    const ok = await confirm({
      title: "Atribuir em bloco",
      description: `Atribuir ${ids.length} cliente${ids.length === 1 ? "" : "s"} a "${nomeAlvo}"?`,
      confirmText: "Atribuir",
    });
    if (!ok) return;
    setAplicando(true);
    const prev = clientes;
    setClientes((cs) =>
      cs.map((c) => (ids.includes(c.id) ? { ...c, responsavel_pos_venda: novoResp } : c)),
    );
    const { error } = await supabase
      .from("clientes")
      .update({ responsavel_pos_venda: novoResp, updated_at: new Date().toISOString() })
      .in("id", ids);
    setAplicando(false);
    if (error) {
      setClientes(prev);
      toast({ title: "Não foi possível atribuir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${ids.length} cliente${ids.length === 1 ? "" : "s"} atribuído${ids.length === 1 ? "" : "s"}` });
    setSelecionados(new Set());
  };

  const updateNps = async (id: string, valor: number | null) => {
    const prev = clientes;
    setClientes((cs) => cs.map((c) => (c.id === id ? { ...c, nps: valor } : c)));
    const { error } = await supabase
      .from("clientes")
      .update({ nps: valor, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setClientes(prev);
      toast({ title: "Não foi possível salvar o NPS", variant: "destructive" });
    }
  };

  const updateResp = async (id: string, userId: string | null) => {
    const prev = clientes;
    setClientes((cs) => cs.map((c) => (c.id === id ? { ...c, responsavel_pos_venda: userId } : c)));
    const { error } = await supabase
      .from("clientes")
      .update({ responsavel_pos_venda: userId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setClientes(prev);
      toast({ title: "Não foi possível salvar o responsável", variant: "destructive" });
    }
  };

  const updateRisco = async (id: string, valor: string | null) => {
    const prev = clientes;
    setClientes((cs) => cs.map((c) => (c.id === id ? { ...c, risco: valor } : c)));
    const { error } = await supabase
      .from("clientes")
      .update({ risco: valor, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setClientes(prev);
      toast({ title: "Não foi possível salvar o risco", variant: "destructive" });
    }
  };

  const abrirRegistrarContato = (cliente?: { id?: string | null; nome?: string | null } | null) => {
    setContatoCliente(cliente ?? null);
    setContatoOpen(true);
  };

  const onContatoSalvo = (n: ContatoSalvo) => {
    setAtendimentos((prev) => [{ cliente_nome: n.cliente_nome, created_at: n.created_at }, ...prev]);
  };

  // Agrupamento por faixa de dívida (do maior para o menor)
  const gruposPorNivel = useMemo(() => {
    return [...NIVEIS]
      .reverse()
      .map((n) => ({
        nivel: n,
        itens: linhasFiltradas.filter((l) => l.nivel === n.key),
      }))
      .filter((g) => g.itens.length > 0);
  }, [linhasFiltradas]);

  type FlatItem =
    | { type: "header"; key: string; label: string; cor: string; qtd: number; soma: number }
    | { type: "row"; key: string; l: Linha };

  const flatRows: FlatItem[] = useMemo(() => {
    if (!agrupar) return linhasFiltradas.map((l) => ({ type: "row" as const, key: l.id, l }));
    const out: FlatItem[] = [];
    for (const g of gruposPorNivel) {
      out.push({
        type: "header",
        key: `h-${g.nivel.key}`,
        label: g.nivel.label,
        cor: g.nivel.cor,
        qtd: g.itens.length,
        soma: g.itens.reduce((s, l) => s + l.divida_total, 0),
      });
      for (const l of g.itens) out.push({ type: "row", key: l.id, l });
    }
    return out;
  }, [agrupar, gruposPorNivel, linhasFiltradas]);

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          icon={Briefcase}
          title="Carteira de Clientes"
          subtitle="Classificação por nível de dívida, NPS e responsável de Pós-Venda."
          breadcrumb={[{ label: "Agro" }, { label: "Pós-Venda" }, { label: "Carteira de Clientes" }]}
          actions={
            <div className="flex flex-wrap gap-2">
              <Dialog open={divisaoAberta} onOpenChange={setDivisaoAberta}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <ListChecks className="w-4 h-4" /> Aplicar divisão da lista
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-serif">Divisão de carteira</DialogTitle>
                  </DialogHeader>
                  <DivisaoCarteiraPanel />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                onClick={distribuirAutomaticamente}
                disabled={aplicando || !podeGerirCliente}
                className="gap-2"
                title={
                  podeGerirCliente
                    ? "Novos clientes já recebem responsável sozinhos. Use aqui para distribuir os que ficaram sem."
                    : "Somente o administrador distribui a carteira"
                }
              >
                <Users className="w-4 h-4" /> Distribuir automaticamente
              </Button>
              <Button onClick={() => abrirRegistrarContato(null)} className="gap-2">
                <MessageSquarePlus className="w-4 h-4" /> Registrar contato
              </Button>
            </div>
          }
        />

        <ClientesADistribuirPanel />

        {/* Barra de níveis (segmentação) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {resumoNiveis.map((n) => {
            const ativo = filtroNivel === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setFiltroNivel(ativo ? "todos" : n.key)}
                className={`text-left rounded-lg border px-3 py-2 transition-all ${n.cor} ${
                  ativo ? "ring-2 ring-primary scale-[1.02]" : "opacity-90 hover:opacity-100"
                }`}
                title={`Filtrar por ${n.key}`}
              >
                <div className="text-xs font-bold uppercase tracking-wide">{n.label}</div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-xl font-bold">{n.quantidade}</span>
                  <span className="text-xs">{fmtMoeda(n.soma)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar por nome</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setFilters({ busca: e.target.value })}
                placeholder="Nome do cliente"
                className="pl-8"
              />
            </div>
          </div>
          <div className="min-w-[220px]">
            <label className="text-xs text-muted-foreground">Responsável</label>
            <Select value={filtroResp} onValueChange={(v) => setFilters({ filtroResp: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="_sem">Sem responsável</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.nome || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtroNivel !== "todos" && (
            <button
              onClick={() => setFiltroNivel("todos")}
              className="text-xs text-muted-foreground hover:text-primary underline"
            >
              Limpar nível ({filtroNivel})
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={agrupar}
              onCheckedChange={(v) => setAgrupar(v === true)}
              aria-label="Agrupar por faixa de dívida"
            />
            Agrupar por faixa de dívida
          </label>
          <div className="text-xs text-muted-foreground ml-auto">
            {linhasFiltradas.length} de {linhas.length} clientes
          </div>
        </Card>

        {/* Tabela */}
        <Card className="overflow-hidden">
          {selecionadosVisiveis.length > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-primary/5 px-4 py-2">
              <span className="text-sm font-medium">
                {selecionadosVisiveis.length} selecionado{selecionadosVisiveis.length === 1 ? "" : "s"}
              </span>
              <Select value={respBulk} onValueChange={setRespBulk}>
                <SelectTrigger className="h-8 text-xs min-w-[200px]">
                  <SelectValue placeholder="Escolher responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Sem responsável (limpar)</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.nome || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={aplicarAtribuicaoEmMassa} disabled={aplicando}>
                {aplicando ? "Atribuindo…" : "Atribuir"}
              </Button>
              <button
                onClick={() => setSelecionados(new Set())}
                className="text-xs text-muted-foreground hover:text-primary underline"
              >
                Limpar seleção
              </button>
              <span className="ml-auto text-xs text-muted-foreground">
                Dica: filtre por nível e use "selecionar todos" para atribuir a carteira inteira.
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todosMarcados ? true : algunsMarcados ? "indeterminate" : false}
                      onCheckedChange={toggleSelecionarTodos}
                      aria-label="Selecionar todos os clientes filtrados"
                    />
                  </TableHead>
                  {([
                    { k: "nome", label: "Nome", align: "left" },
                    { k: "divida", label: "Dívida total", align: "right" },
                    { k: "nivel", label: "Nível", align: "left" },
                    { k: "risco", label: "Risco", align: "left" },
                    { k: "banco", label: "Banco principal", align: "left" },
                    { k: "fase", label: "Fase do caso", align: "left" },
                    { k: "responsavel", label: "Responsável", align: "left" },
                    { k: "nps", label: "NPS", align: "left" },
                    { k: "situacao", label: "Situação", align: "left" },
                    { k: "prazo", label: "Próximo prazo", align: "left" },
                    { k: "ultimoContato", label: "Último contato", align: "left" },
                    { k: "vip", label: "VIP", align: "left" },
                  ] as { k: SortKey; label: string; align: "left" | "right" }[]).map((col) => {
                    const active = sortKey === col.k;
                    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <TableHead key={col.k} className={col.align === "right" ? "text-right" : undefined}>
                        <button
                          onClick={() => toggleSort(col.k)}
                          className={`inline-flex items-center gap-1 hover:text-primary ${active ? "text-primary font-semibold" : ""}`}
                          aria-label={`Ordenar por ${col.label}`}
                        >
                          {col.label} <Icon className={`w-3 h-3 ${active ? "" : "opacity-50"}`} />
                        </button>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : linhasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                      Nenhum cliente encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  flatRows.map((item) => {
                    if (item.type === "header") {
                      return (
                        <TableRow key={item.key} className="hover:bg-transparent">
                          <TableCell colSpan={14} className="bg-muted/60 py-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={`text-xs font-bold uppercase tracking-wide rounded border px-2 py-0.5 ${item.cor}`}>
                                {item.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.qtd} cliente{item.qtd === 1 ? "" : "s"} · {fmtMoeda(item.soma)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const l = item.l;
                    const riscoOpt = RISCO_OPCOES.find((r) => r.value === l.risco);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selecionados.has(l.id)}
                            onCheckedChange={() => toggleSelecionarUm(l.id)}
                            aria-label={`Selecionar ${l.nome}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            to={`/clientes/${encodeURIComponent(l.nome)}`}
                            className="hover:underline hover:text-primary"
                          >
                            {l.nome}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.divida_total > 0 ? fmtMoeda(l.divida_total) : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={nivelTone(l.nivel)} label={l.nivel} />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={l.risco ?? "_none"}
                            onValueChange={(v) => updateRisco(l.id, v === "_none" ? null : v)}
                          >
                            <SelectTrigger className="h-8 text-xs min-w-[110px] border-0 bg-transparent p-1">
                              <SelectValue>
                                {riscoOpt ? (
                                  <StatusBadge tone={riscoTone(riscoOpt.value)} label={riscoOpt.label} />
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— Sem classificação</SelectItem>
                              {RISCO_OPCOES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.banco_principal ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.fase_caso ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={l.responsavel_pos_venda ?? "_none"}
                            disabled={!podeGerirCliente}
                            onValueChange={(v) => updateResp(l.id, v === "_none" ? null : v)}
                          >
                            <SelectTrigger className="h-8 text-xs min-w-[160px]">
                              <SelectValue>{nomeMembro(l.responsavel_pos_venda)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— Sem responsável</SelectItem>
                              {members.map((m) => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                  {m.nome || "Sem nome"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            value={l.nps ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") { updateNps(l.id, null); return; }
                              const n = Number(raw);
                              if (Number.isFinite(n) && n >= 0 && n <= 10) {
                                updateNps(l.id, n);
                              }
                            }}
                            className="h-8 w-16 text-center"
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{l.status_adimplencia || "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs">{fmtData(l.proximo_prazo)}</TableCell>
                        <TableCell className="text-xs">{fmtData(l.ultimo_contato)}</TableCell>
                        <TableCell>
                          {l.vip ? (
                            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="w-10">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Registrar contato com este cliente"
                            onClick={() => abrirRegistrarContato({ id: l.id, nome: l.nome })}
                          >
                            <MessageSquarePlus className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
      <RegistrarContatoDialog
        open={contatoOpen}
        onOpenChange={setContatoOpen}
        clienteInicial={contatoCliente}
        onSaved={onContatoSalvo}
      />
    </AppLayout>
  );
}