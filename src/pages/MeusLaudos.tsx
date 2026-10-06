import { useState, useEffect } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { motion } from "framer-motion";
import { usePagination } from "@/hooks/usePagination";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { PlusCircle, Search, Copy, Download, Trash2, Eye, ChevronDown, ChevronRight, User, FileText, ExternalLink, NotebookPen, LayoutGrid, List as ListIcon, MoreVertical } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/StatusBadge";
import { ListSkeleton } from "@/components/ui/loaders";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detectarTipoLaudo, tipoLaudoLabel } from "@/lib/laudoTitulo";
import { LaudosPorMes } from "@/components/laudo/LaudosPorMes";
import { LaudosResumo } from "@/components/laudo/LaudosResumo";

interface LaudoRow {
  id: string;
  numero_laudo: string;
  status: string;
  created_at: string;
  dados_etapa1: any;
  etapa_desde?: string | null;
  finalizado_em?: string | null;
  observacao?: string | null;
}

interface AnexoRow {
  id: string;
  laudo_id: string;
  nome_arquivo: string;
  storage_path: string;
  created_at: string;
}

const statusFilters = [
  { value: "todos", label: "Todos" },
  { value: "andamento", label: "Em andamento" },
  { value: "rascunho", label: "1. Entrevista" },
  { value: "pendente", label: "2. Documentos" },
  { value: "analise", label: "3. Análise técnica" },
  { value: "revisao", label: "4. Revisão" },
  { value: "finalizado", label: "5. Laudo pronto" },
  { value: "retificacao", label: "6. Retificação" },
];

const tipoFilters = [
  { value: "todos", label: "Todos os tipos" },
  { value: "perda", label: "Perda de Safra" },
  { value: "capacidade", label: "Capacidade Pgto." },
  { value: "ambos", label: "Ambos" },
];

function tipoBadge(tipo?: string) {
  if (tipo === "perda") return { label: "Frustração de Safra", cls: "bg-accent/15 text-accent" };
  if (tipo === "capacidade") return { label: "Capacidade de Pagamento", cls: "bg-info/15 text-info" };
  if (tipo === "ambos") return { label: "Frustração + Capacidade", cls: "bg-primary/15 text-primary" };
  return null;
}

function tipoCurto(tipo?: string) {
  if (tipo === "perda") return { label: "Frustração", cls: "bg-accent/15 text-accent" };
  if (tipo === "capacidade") return { label: "Capacidade", cls: "bg-info/15 text-info" };
  if (tipo === "ambos") return { label: "Frustr.+Cap.", cls: "bg-primary/15 text-primary" };
  return { label: "Laudo", cls: "bg-secondary text-muted-foreground" };
}

type LaudoStatus = "rascunho" | "pendente" | "analise" | "revisao" | "finalizado" | "retificacao";
const KANBAN_COLUMNS: {
  key: LaudoStatus;
  etapa: number;
  label: string;
  hint: string;
  accent: string;
  dot: string;
}[] = [
  {
    key: "rascunho",
    etapa: 1,
    label: "Entrevista",
    hint: "Coleta de dados com o produtor",
    accent: "border-t-muted-foreground/40",
    dot: "bg-muted-foreground/50",
  },
  {
    key: "pendente",
    etapa: 2,
    label: "Documentos",
    hint: "Aguardando notas, contratos e mapas",
    accent: "border-t-warning",
    dot: "bg-warning",
  },
  {
    key: "analise",
    etapa: 3,
    label: "Análise técnica",
    hint: "Cálculo de perda e capacidade",
    accent: "border-t-info",
    dot: "bg-info",
  },
  {
    key: "revisao",
    etapa: 4,
    label: "Revisão",
    hint: "Revisão técnica antes da finalização",
    accent: "border-t-primary",
    dot: "bg-primary",
  },
  {
    key: "finalizado",
    etapa: 5,
    label: "Laudo pronto",
    hint: "Arquivo anexado e entregue",
    accent: "border-t-success",
    dot: "bg-success",
  },
  {
    key: "retificacao",
    etapa: 6,
    label: "Retificação",
    hint: "Correção de laudo já entregue",
    accent: "border-t-destructive",
    dot: "bg-destructive",
  },
];

export default function MeusLaudos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const askConfirm = useConfirm();
  const [filter, setFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [laudos, setLaudos] = useState<LaudoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"lista" | "kanban">("kanban");
  const [listaAberta, setListaAberta] = useState(true);
  const [kpiExpandido, setKpiExpandido] = useState(false);
  const [somenteParados, setSomenteParados] = useState(false);
  const [dragOver, setDragOver] = useState<LaudoStatus | null>(null);
  const [anexos, setAnexos] = useState<Record<string, AnexoRow[]>>({});

  const loadLaudos = async () => {
    if (!user) return;
    const [laudosRes, processosRes, docsRes] = await Promise.all([
      supabase
        .from("laudos")
        .select("id, numero_laudo, status, created_at, dados_etapa1, etapa_desde, finalizado_em, observacao")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      lerTudo(() => supabase.from("processos").select("laudo_id")),
      supabase
        .from("documentos")
        .select("id, laudo_id, nome_arquivo, storage_path, created_at")
        .order("created_at", { ascending: false }),
    ]);
    const byLaudo: Record<string, AnexoRow[]> = {};
    for (const d of (docsRes.data || []) as AnexoRow[]) {
      if (!d.laudo_id) continue;
      (byLaudo[d.laudo_id] ||= []).push(d);
    }
    setAnexos(byLaudo);
    // Hide only EMPTY shell laudos created for processes (no producer + still rascunho)
    const processoLaudoIds = new Set((processosRes.data || []).map((p: any) => p.laudo_id));
    if (laudosRes.data) {
      setLaudos(
        (laudosRes.data as LaudoRow[]).filter((l) => {
          const d = (l.dados_etapa1 || {}) as Record<string, any>;
          const nome = (d.nome || d.nomeProdutor || d.produtor || "").trim();
          const isShellEmpty = processoLaudoIds.has(l.id) && !nome && l.status === "rascunho";
          return !isShellEmpty;
        }),
      );
    }
    setLoading(false);
  };

  useEffect(() => { loadLaudos(); }, [user]);

  // Um laudo com arquivo anexado no site é, de fato, um laudo finalizado —
  // exceto quando o usuário o colocou explicitamente em revisão ou retificação.
  const anexosDe = (id: string) => anexos[id] || [];
  const effectiveStatus = (l: LaudoRow) => {
    if (l.status === "revisao" || l.status === "retificacao" || l.status === "exportado") return l.status;
    return anexosDe(l.id).length > 0 ? "finalizado" : l.status;
  };

  const dias = (from?: string | null, to?: string | null) => {
    if (!from) return null;
    const end = to ? new Date(to).getTime() : Date.now();
    return Math.max(0, Math.floor((end - new Date(from).getTime()) / 86400000));
  };
  const diasNaEtapa = (l: LaudoRow) => dias(l.etapa_desde || l.created_at, l.finalizado_em);
  const leadTime = (l: LaudoRow) => dias(l.created_at, l.finalizado_em);
  const fmtData = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
  const etapaCls = (d: number | null) =>
    d === null ? "" : d >= 30 ? "bg-destructive/15 text-destructive" : d >= 14 ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground";

  const baixarAnexo = async (l: LaudoRow) => {
    const doc = anexosDe(l.id)[0];
    if (!doc) { toast.error("Este laudo não possui arquivo anexado"); return; }
    const { data, error } = await supabase.storage.from("laudos").createSignedUrl(doc.storage_path, 300);
    if (error || !data?.signedUrl) { toast.error("Erro ao gerar link de download"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = doc.nome_arquivo;
    a.target = "_blank";
    a.click();
  };

  const getInfo = (l: LaudoRow) => {
    const d = l.dados_etapa1 as Record<string, any> | null;
    const tipo = detectarTipoLaudo(
      d?.tipo_laudo as string | undefined,
      (anexos[l.id] || []).map((a) => a.nome_arquivo),
    );
    return {
      produtor: d?.nome || d?.nomeProdutor || d?.produtor || "Sem nome",
      cultura: d?.cultura || "—",
      safra: d?.safra || "—",
      municipio: d?.municipio || "—",
      uf: d?.uf || "—",
      tipo_laudo: tipo,
    };
  };

  const filtered = laudos.filter((l) => {
    const st = effectiveStatus(l);
    if (filter === "andamento") {
      if (st === "finalizado" || st === "exportado") return false;
    } else if (filter !== "todos" && st !== filter) return false;
    if (somenteParados) {
      const d = diasNaEtapa(l);
      if (l.finalizado_em || d === null || d < 14) return false;
    }
    const info = getInfo(l);
    if (tipoFilter !== "todos" && info.tipo_laudo !== tipoFilter) return false;
    if (search && !info.produtor.toLowerCase().includes(search.toLowerCase()) && !l.numero_laudo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by client (produtor)
  const grouped = filtered.reduce((acc, l) => {
    const key = getInfo(l).produtor;
    (acc[key] ||= []).push(l);
    return acc;
  }, {} as Record<string, LaudoRow[]>);
  const groupEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  const { paginatedItems: paginatedGroups, hasMore, totalCount, shownCount, loadMore } = usePagination(groupEntries, { pageSize: 15 });

  const duplicateLaudo = async (l: LaudoRow) => {
    const { data: original } = await supabase.from("laudos").select("*").eq("id", l.id).single();
    if (!original) return;
    const numero = `LAU-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("laudos").insert({
      user_id: user!.id,
      numero_laudo: numero,
      status: "rascunho" as any,
      dados_etapa1: original.dados_etapa1,
      dados_etapa3: original.dados_etapa3,
      dados_etapa4: original.dados_etapa4,
      dados_etapa5: original.dados_etapa5,
    });
    if (error) toast.error("Erro ao duplicar");
    else { toast.success("Laudo duplicado"); loadLaudos(); }
  };

  const deleteLaudo = async (id: string) => {
    const ok = await askConfirm({
      title: "Excluir laudo",
      description: "O laudo será arquivado e some das listas.",
      destructive: true,
      confirmText: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("laudos").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Laudo excluído"); setLaudos((prev) => prev.filter((l) => l.id !== id)); }
  };

  // Drag & drop: update laudo status with optimistic UI + rollback
  const moveLaudo = async (id: string, newStatus: LaudoStatus) => {
    const prev = laudos;
    const target = prev.find((l) => l.id === id);
    if (!target || target.status === newStatus) return;
    setLaudos((cur) => cur.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    const { error } = await supabase.from("laudos").update({ status: newStatus as any }).eq("id", id);
    if (error) {
      setLaudos(prev);
      toast.error("Não foi possível mover o laudo");
    } else {
      toast.success("Laudo movido");
    }
  };

  const colors = [
    "bg-primary/15 text-primary",
    "bg-accent/15 text-accent",
    "bg-success/15 text-success",
    "bg-info/15 text-info",
  ];

  return (
    <AppLayout>
      <PageHeader
        icon={FileText}
        title="Meus Laudos"
        subtitle={`${laudos.length} laudo${laudos.length === 1 ? "" : "s"} no acervo`}
        breadcrumb={[{ label: "Agro" }, { label: "Meus Laudos" }]}
        actions={
          <Link to="/novo-laudo" className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-2.5 rounded-lg font-semibold shadow-card hover:shadow-card-hover transition-all duration-200 text-sm">
            <PlusCircle className="w-4 h-4" /> Novo Laudo
          </Link>
        }
      />

      <div className="font-manrope space-y-6">
      {/* KPIs no topo — compacto, expansível */}
      {!loading && laudos.length > 0 && (
        <div>
          <LaudosResumo
            total={laudos.length}
            emAndamento={laudos.filter((l) => effectiveStatus(l) !== "finalizado").length}
            finalizados={laudos.filter((l) => effectiveStatus(l) === "finalizado").length}
            parados={laudos.filter((l) => !l.finalizado_em && (diasNaEtapa(l) ?? 0) >= 14).length}
            etapas={KANBAN_COLUMNS.map((c) => ({
              key: c.key,
              etapa: c.etapa,
              label: c.label,
              dot: c.dot,
              count: laudos.filter((l) => effectiveStatus(l) === c.key).length,
            }))}
            filtroAtivo={filter}
            somenteParados={somenteParados}
            onFiltrar={(s) => { setSomenteParados(false); setFilter((f) => (f === s ? "todos" : s)); }}
            onToggleParados={() => setSomenteParados((v) => !v)}
            showDetails={kpiExpandido}
          />
          <button
            onClick={() => setKpiExpandido((v) => !v)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {kpiExpandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {kpiExpandido ? "Recolher métricas" : "Expandir métricas"}
          </button>
          {kpiExpandido && (
            <div className="mt-3">
              <LaudosPorMes laudos={laudos} />
            </div>
          )}
        </div>
      )}
      {/* Coluna principal: filtros + Kanban + Lista */}
      <div className="min-w-0">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar por nome ou número..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all" />
          </div>

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px] h-10 text-sm shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((sf) => (
                <SelectItem key={sf.value} value={sf.value}>{sf.value === "todos" ? "Todos os status" : sf.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[170px] h-10 text-sm shrink-0">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {tipoFilters.map((tf) => (
                <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

      </div>

      {/* Quadro por etapa */}
      {loading ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <LayoutGrid className="w-4 h-4 text-primary" />
            <h2 className="font-sora text-sm font-bold tracking-tight text-foreground">Quadro por etapa</h2>
            <span className="text-[11px] text-muted-foreground">arraste para mover</span>
          </div>
        <div className="flex gap-4 items-start overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
          {KANBAN_COLUMNS.map((col) => {
            const items = filtered.filter((l) => effectiveStatus(l) === col.key);
            const isOver = dragOver === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData("text/laudo-id");
                  if (id) moveLaudo(id, col.key);
                }}
                className={`group/col relative w-[272px] shrink-0 rounded-2xl bg-muted/40 flex flex-col min-h-[200px] overflow-hidden ring-1 transition-all duration-200 ${
                  isOver ? "ring-2 ring-accent bg-accent/5 shadow-card-hover" : "ring-border/60"
                }`}
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${col.dot}`} aria-hidden />
                <div className="px-4 pt-4 pb-3 sticky top-0 z-10 bg-muted/40 backdrop-blur-sm" title={col.hint}>
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold text-background shrink-0 ${col.dot}`}>
                      {col.etapa}
                    </span>
                    <span className="font-sora text-xs font-bold uppercase tracking-wide text-foreground/80 truncate">{col.label}</span>
                    <span className="ml-auto inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-background text-[11px] font-bold text-muted-foreground tabular-nums shrink-0 ring-1 ring-border/60">{items.length}</span>
                  </div>
                </div>
                <div className="flex-1 px-3 pb-4 space-y-3 overflow-y-auto overflow-x-hidden max-h-[480px]">
                  {items.length === 0 && (
                    <div className="mx-1 my-2 rounded-xl border border-dashed border-border/70 py-7 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Sem laudos</p>
                    </div>
                  )}
                  {[...items]
                    .sort((a, b) => getInfo(a).produtor.localeCompare(getInfo(b).produtor, "pt-BR"))
                    .map((laudo) => {
                    const info = getInfo(laudo);
                    const t = tipoCurto(info.tipo_laudo);
                    const d = diasNaEtapa(laudo);
                    return (
                      <div
                        key={laudo.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/laudo-id", laudo.id); e.dataTransfer.effectAllowed = "move"; }}
                        onClick={() => navigate(`/laudos/${laudo.id}`)}
                        title={`${info.produtor}${info.cultura !== "—" ? ` · ${info.cultura}` : ""}${laudo.observacao ? ` · ${laudo.observacao}` : ""}`}
                        className="group relative bg-card rounded-xl border border-border/70 px-3.5 py-3.5 shadow-sm hover:shadow-card-hover hover:border-accent/50 hover:-translate-y-px cursor-grab active:cursor-grabbing transition-all duration-150"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-primary/10 text-primary text-[11px] font-bold uppercase">
                            {info.produtor.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
                          </span>
                          <p
                            className="font-sora font-semibold text-foreground flex-1 min-w-0 text-[13px] leading-snug break-words line-clamp-2"
                            data-private
                          >
                            {info.produtor}
                          </p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:bg-secondary transition-all shrink-0"
                                aria-label="Mais ações"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => navigate(`/laudos/${laudo.id}`)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/novo-laudo?id=${laudo.id}`)}>
                                <FileText className="w-3.5 h-3.5 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateLaudo(laudo)}>
                                <Copy className="w-3.5 h-3.5 mr-2" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={anexosDe(laudo.id).length === 0}
                                onClick={() => baixarAnexo(laudo)}
                              >
                                <Download className="w-3.5 h-3.5 mr-2" /> Baixar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/clientes/${encodeURIComponent(info.produtor)}`)}>
                                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Ficha do cliente
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteLaudo(laudo.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2.5 pl-[42px] min-w-0">
                          <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.cls}`}>{t.label}</span>
                          {anexosDe(laudo.id).length > 0 && (
                            <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/15 text-success">
                              <FileText className="w-3 h-3" />{anexosDe(laudo.id).length}
                            </span>
                          )}
                          <span className="flex-1" />
                          {laudo.finalizado_em ? (
                            <span className="shrink-0 text-[10px] font-semibold text-success tabular-nums">
                              {leadTime(laudo) !== null ? `${leadTime(laudo)}d` : "OK"}
                            </span>
                          ) : d !== null ? (
                            <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${etapaCls(d)}`}>{d}d</span>
                          ) : null}
                        </div>
                      </div>
                    );
                    })}
                </div>
              </div>
            );
          })}
        </div>
        </section>

        <section>
          <button
            onClick={() => setListaAberta((v) => !v)}
            className="flex items-center gap-2 mb-3 group"
          >
            {listaAberta ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <ListIcon className="w-4 h-4 text-primary" />
            <h2 className="font-sora text-sm font-bold tracking-tight text-foreground">Lista por cliente</h2>
            <span className="text-[11px] text-muted-foreground">{groupEntries.length} cliente{groupEntries.length === 1 ? "" : "s"}</span>
          </button>
          {listaAberta && (
        <div className="space-y-6">
          {paginatedGroups.map(([cliente, laudosCliente]) => {
            const isCollapsed = collapsed[cliente];
            return (
              <div key={cliente} className="bg-card/50 rounded-lg border border-border">
                <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors rounded-t-lg">
                  <button onClick={() => toggle(cliente)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground truncate" data-private>{cliente}</span>
                    <span className="text-xs text-muted-foreground">({laudosCliente.length} {laudosCliente.length === 1 ? "laudo" : "laudos"})</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/clientes/${encodeURIComponent(cliente)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Abrir ficha do cliente"
                    >
                      <ExternalLink className="w-3 h-3" /> Ficha
                    </Link>
                    <Link
                      to={`/comercial/atendimentos?cliente=${encodeURIComponent(cliente)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Ver atendimentos deste cliente"
                    >
                      <NotebookPen className="w-3 h-3" /> Atendimentos
                    </Link>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="divide-y divide-border border-t border-border">
                    {laudosCliente.map((laudo) => {
                      const info = getInfo(laudo);
                      const t = tipoCurto(info.tipo_laudo);
                      const d = diasNaEtapa(laudo);
                      return (
                        <div
                          key={laudo.id}
                          onClick={() => navigate(`/laudos/${laudo.id}`)}
                          className="group flex items-center gap-3 px-4 py-2 hover:bg-secondary/40 cursor-pointer transition-colors"
                        >
                          <span className={`inline-flex shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.cls}`}>{t.label}</span>
                          <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                            {info.cultura !== "—" ? info.cultura : "Sem cultura"}
                            {info.safra !== "—" ? ` · ${info.safra}` : ""}
                            {info.municipio !== "—" ? ` · ${info.municipio}/${info.uf}` : ""}
                            {laudo.observacao ? ` · ${laudo.observacao}` : ""}
                          </span>
                          {anexosDe(laudo.id).length > 0 && (
                            <span className="hidden sm:inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success/15 text-success">
                              <FileText className="w-2.5 h-2.5" />{anexosDe(laudo.id).length}
                            </span>
                          )}
                          {laudo.finalizado_em ? (
                            <span className="hidden md:inline text-[10px] text-muted-foreground shrink-0 tabular-nums">
                              {fmtData(laudo.finalizado_em)}{leadTime(laudo) !== null ? ` · ${leadTime(laudo)}d` : ""}
                            </span>
                          ) : d !== null ? (
                            <span className={`hidden md:inline-flex shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${etapaCls(d)}`}>{d}d</span>
                          ) : null}
                          <StatusBadge status={effectiveStatus(laudo) as any} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:bg-secondary transition-all shrink-0"
                                aria-label="Mais ações"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => navigate(`/laudos/${laudo.id}`)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/novo-laudo?id=${laudo.id}`)}>
                                <FileText className="w-3.5 h-3.5 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateLaudo(laudo)}>
                                <Copy className="w-3.5 h-3.5 mr-2" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={anexosDe(laudo.id).length === 0} onClick={() => baixarAnexo(laudo)}>
                                <Download className="w-3.5 h-3.5 mr-2" /> Baixar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteLaudo(laudo.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          )}
          {listaAberta && (
            <LoadMoreButton
              shownCount={shownCount}
              totalCount={totalCount}
              hasMore={hasMore}
              onLoadMore={loadMore}
              label="clientes"
            />
          )}
        </section>
        </>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 px-6 bg-card/40 border border-dashed border-border rounded-xl">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mb-5">
            <FileText className="w-9 h-9 text-primary/60" />
          </div>
          <h3 className="text-lg font-sora font-semibold text-foreground mb-1">
            {search || filter !== "todos" || tipoFilter !== "todos" ? "Nenhum laudo corresponde aos filtros" : "Seu acervo está vazio"}
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            {search || filter !== "todos" || tipoFilter !== "todos"
              ? "Ajuste os filtros ou tente uma nova busca."
              : "Comece criando seu primeiro laudo técnico. Leva apenas alguns minutos."}
          </p>
          <Link
            to="/novo-laudo"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-5 py-2.5 rounded-lg font-semibold shadow-card hover:shadow-card-hover transition-all text-sm"
          >
            <PlusCircle className="w-4 h-4" /> Criar primeiro laudo
          </Link>
        </div>
      )}
      </div>
      </div>
    </AppLayout>
  );
}
