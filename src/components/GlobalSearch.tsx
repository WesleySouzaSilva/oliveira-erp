import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Input } from "@/components/ui/input";
import {
  Search, FileText, Users, Scale, X, Loader2, MessageSquare,
  PlusCircle, FilePlus2, UserPlus, ListChecks, Inbox as InboxIcon,
  Clock, Bell, LayoutDashboard, Zap, Pin,
} from "lucide-react";
import { getRecentItems, type RecentItem } from "@/hooks/useRecentItems";
import { getPinnedItems, type PinnedItem } from "@/hooks/usePinnedItems";

interface SearchResult {
  id: string;
  type: "cliente" | "processo" | "laudo" | "mensagem" | "acao" | "recente";
  title: string;
  subtitle?: string;
  path: string;
  icon?: any;
}

const QUICK_ACTIONS: SearchResult[] = [
  { id: "novo-laudo", type: "acao", title: "Criar novo laudo", subtitle: "Abrir assistente de laudo", path: "/novo-laudo", icon: FilePlus2 },
  { id: "novo-cliente", type: "acao", title: "Cadastrar novo cliente", subtitle: "Adicionar produtor", path: "/novo-cliente", icon: UserPlus },
  { id: "nova-tarefa", type: "acao", title: "Criar nova tarefa", subtitle: "Abrir página de tarefas", path: "/tarefas?new=1", icon: ListChecks },
  { id: "inbox", type: "acao", title: "Abrir Inbox", subtitle: "Tarefas, prazos e notificações", path: "/inbox", icon: InboxIcon },
  { id: "dashboard", type: "acao", title: "Ir para Dashboard", subtitle: "Visão geral", path: "/", icon: LayoutDashboard },
  { id: "notificacoes", type: "acao", title: "Ver notificações", subtitle: "Avisos do sistema", path: "/notificacoes", icon: Bell },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const { orgId } = useOrgMembers();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Recarrega lista de "Recentes" quando palette abre
  useEffect(() => {
    if (!open) return;
    setRecents(getRecentItems());
    setPinned(getPinnedItems());
    const onRecent = () => setRecents(getRecentItems());
    const onPin = () => setPinned(getPinnedItems());
    window.addEventListener("recent-items-changed", onRecent);
    window.addEventListener("pinned-items-changed", onPin);
    return () => {
      window.removeEventListener("recent-items-changed", onRecent);
      window.removeEventListener("pinned-items-changed", onPin);
    };
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2 || !orgId) {
      setResults([]);
      return;
    }
    setLoading(true);

    const [clientesRes, processosRes, laudosRes, mensagensRes] = await Promise.all([
      supabase.rpc("search_clientes_norm" as any, { q }).then((r: any) => ({
        data: (r.data || []).slice(0, 5),
      })),
      supabase
        .from("processos")
        .select("id, fase_atual, laudo_id")
        .is("deleted_at", null)
        .limit(5),
      supabase.rpc("search_laudos_by_produtor_norm" as any, { q }).then((r: any) => ({
        data: (r.data || []).slice(0, 5),
      })),
      supabase
        .from("mensagens")
        .select("id, conversa_id, conteudo, created_at")
        .is("excluida_em", null)
        .ilike("conteudo", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const items: SearchResult[] = [];

    (clientesRes.data || []).forEach(c => {
      items.push({
        id: c.id,
        type: "cliente",
        title: c.nome,
        subtitle: [c.municipio, c.uf].filter(Boolean).join(", ") || undefined,
        path: `/clientes/${encodeURIComponent(c.nome)}`,
      });
    });

    (laudosRes.data || []).forEach(l => {
      const etapa1 = l.dados_etapa1 as any;
      items.push({
        id: l.id,
        type: "laudo",
        title: `Laudo ${l.numero_laudo}`,
        subtitle: etapa1?.produtor || undefined,
        path: "/laudos",
      });
    });

    (mensagensRes.data || []).forEach((m: any) => {
      items.push({
        id: m.id,
        type: "mensagem",
        title: m.conteudo.slice(0, 80),
        subtitle: "Mensagem interna",
        path: `/mensagens?c=${m.conversa_id}`,
      });
    });

    setResults(items);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const selectResult = (r: SearchResult) => {
    navigate(r.path);
    setOpen(false);
    setQuery("");
  };

  const iconMap: Record<string, any> = {
    cliente: Users,
    processo: Scale,
    laudo: FileText,
    mensagem: MessageSquare,
    acao: Zap,
    recente: Clock,
  };

  const labelMap: Record<string, string> = {
    cliente: "Cliente",
    processo: "Processo",
    laudo: "Laudo",
    mensagem: "Mensagem",
    acao: "Ação",
    recente: "Recente",
  };

  // Filtra ações pela query
  const queryLower = query.toLowerCase();
  const filteredActions = query.length === 0
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter(a => a.title.toLowerCase().includes(queryLower) || a.subtitle?.toLowerCase().includes(queryLower));

  const recentResults: SearchResult[] = recents.slice(0, 6).map(r => ({
    id: r.id,
    type: "recente",
    title: r.title,
    subtitle: r.subtitle || labelMap[r.type] || "Recente",
    path: r.path,
    icon: r.type === "cliente" ? Users : r.type === "processo" ? Scale : FileText,
  }));

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border rounded-lg hover:bg-muted transition-colors w-full max-w-xs"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline text-[10px] bg-background border px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => { setOpen(false); setQuery(""); }}>
      <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-background border rounded-xl shadow-2xl overflow-hidden z-10"
      >
        <div className="flex items-center gap-2 px-4 border-b">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clientes, laudos, mensagens..."
            className="border-0 shadow-none focus-visible:ring-0 text-sm py-3"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <button onClick={() => { setOpen(false); setQuery(""); }}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-72 overflow-y-auto p-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-1 pb-1.5">Resultados</p>
            {results.map(r => {
              const Icon = iconMap[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => selectResult(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.title}</p>
                    {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{labelMap[r.type]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sempre mostrar ações rápidas; e Recentes quando query vazia */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length === 0 && pinned.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-1 pb-1.5 flex items-center gap-1">
                <Pin className="w-3 h-3" /> Fixados
              </p>
              {pinned.map((p) => (
                <button
                  key={`pin-${p.type}-${p.id}`}
                  onClick={() => selectResult({ id: p.id, type: p.type, title: p.title, path: p.path })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors text-left"
                >
                  <Pin className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground truncate capitalize">{p.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredActions.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-1 pb-1.5">Ações rápidas</p>
              {filteredActions.map(a => {
                const Icon = a.icon || Zap;
                return (
                  <button
                    key={`acao-${a.id}`}
                    onClick={() => selectResult(a)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.title}</p>
                      {a.subtitle && <p className="text-xs text-muted-foreground truncate">{a.subtitle}</p>}
                    </div>
                    <span className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">Ação</span>
                  </button>
                );
              })}
            </div>
          )}

          {query.length === 0 && recentResults.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground px-3 pt-1 pb-1.5">Recentes</p>
              {recentResults.map(r => {
                const Icon = r.icon || Clock;
                return (
                  <button
                    key={`rec-${r.id}`}
                    onClick={() => selectResult(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.subtitle}</span>
                  </button>
                );
              })}
            </div>
          )}

          {query.length >= 2 && !loading && results.length === 0 && filteredActions.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground border-t">
              Nenhum resultado para "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
