import { forwardRef, useEffect, useState } from "react";
import { Search, X, Users, Tag, Clock, Eye, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Etiqueta, KanbanColumnDef } from "./lib/types";
import type { DeadlineFilter, KanbanFiltersState } from "./hooks/useKanbanFilters";

interface Member {
  user_id: string;
  nome: string | null;
}

interface Props {
  state: KanbanFiltersState;
  activeCount: number;
  members: Member[];
  etiquetas: Etiqueta[];
  columns: KanbanColumnDef[];
  orgId: string | null;
  onSearch: (v: string) => void;
  onToggleMember: (id: string) => void;
  onToggleEtiqueta: (id: string) => void;
  onSetDeadline: (d: DeadlineFilter) => void;
  onToggleColumn: (id: string) => void;
  onReset: () => void;
  totalMatched: number;
  totalCards: number;
}

const deadlineOptions: { value: DeadlineFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vencendo", label: "Vencendo em 3d" },
  { value: "vencido", label: "Vencidos" },
  { value: "sem_prazo", label: "Sem prazo" },
];

const COLLAPSE_LS_PREFIX = "oa.kanban.filters.collapsed.v1.";

export const BoardFiltersBar = forwardRef<HTMLInputElement, Props>(function BoardFiltersBar(
  {
    state, activeCount, members, etiquetas, columns, orgId,
    onSearch, onToggleMember, onToggleEtiqueta, onSetDeadline, onToggleColumn, onReset,
    totalMatched, totalCards,
  },
  searchRef,
) {
  const chip = "text-xs font-medium px-2.5 py-1 rounded-md border transition-colors inline-flex items-center gap-1.5";
  const inactive = "border-border text-muted-foreground hover:text-foreground hover:bg-muted";
  const active = "border-primary/40 bg-primary/10 text-primary";

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!orgId || typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSE_LS_PREFIX + orgId) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!orgId || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLLAPSE_LS_PREFIX + orgId, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, orgId]);

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3 shrink-0">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-controls="kanban-filter-chips"
        aria-label={collapsed ? "Expandir filtros" : "Recolher filtros"}
        className={`${chip} ${activeCount > 0 ? active : inactive}`}
      >
        <SlidersHorizontal className="w-3 h-3" /> Filtros
        {activeCount > 0 && (
          <span className="bg-primary/20 text-primary rounded-full px-1.5 text-[10px]">{activeCount}</span>
        )}
        {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <input
          ref={searchRef}
          type="text"
          value={state.search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar produtor ou banco… (/ foca)"
          className="w-full text-xs pl-7 pr-7 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Buscar cards por produtor ou banco"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (state.search) onSearch("");
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {state.search && (
          <button
            onClick={() => onSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            aria-label="Limpar busca"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div id="kanban-filter-chips" className="flex items-center gap-2 flex-wrap">
      {/* Membros */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={`${chip} ${state.memberIds.size ? active : inactive}`} aria-label="Filtrar por membros">
            <Users className="w-3 h-3" /> Membros
            {state.memberIds.size > 0 && (
              <span className="bg-primary/20 text-primary rounded-full px-1.5 text-[10px]">{state.memberIds.size}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-2 max-h-80 overflow-y-auto">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold px-2 mb-1">Filtrar por membro</p>
          {members.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Nenhum membro</p>
          )}
          {members.map((m) => {
            const on = state.memberIds.has(m.user_id);
            return (
              <button
                key={m.user_id}
                onClick={() => onToggleMember(m.user_id)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between ${on ? "text-primary font-medium" : ""}`}
              >
                <span className="truncate">{m.nome ?? "—"}</span>
                {on && <span className="text-primary">✓</span>}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Etiquetas */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={`${chip} ${state.etiquetaIds.size ? active : inactive}`} aria-label="Filtrar por etiquetas">
            <Tag className="w-3 h-3" /> Etiquetas
            {state.etiquetaIds.size > 0 && (
              <span className="bg-primary/20 text-primary rounded-full px-1.5 text-[10px]">{state.etiquetaIds.size}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-2 max-h-80 overflow-y-auto">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold px-2 mb-1">Filtrar por etiqueta</p>
          {etiquetas.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma etiqueta criada</p>
          )}
          {etiquetas.map((e) => {
            const on = state.etiquetaIds.has(e.id);
            return (
              <button
                key={e.id}
                onClick={() => onToggleEtiqueta(e.id)}
                className="w-full text-left px-2 py-1 rounded hover:bg-muted flex items-center gap-2"
              >
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${e.cor}`}>{e.nome}</span>
                {on && <span className="ml-auto text-primary text-xs">✓</span>}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Prazo */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={`${chip} ${state.deadline !== "todos" ? active : inactive}`} aria-label="Filtrar por prazo">
            <Clock className="w-3 h-3" /> Prazo
            {state.deadline !== "todos" && (
              <span className="text-[10px]">: {deadlineOptions.find((o) => o.value === state.deadline)?.label}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1">
          {deadlineOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSetDeadline(opt.value)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${state.deadline === opt.value ? "text-primary font-medium" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Colunas visíveis */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={`${chip} ${state.hiddenColumns.size ? active : inactive}`} aria-label="Mostrar/ocultar colunas">
            <Eye className="w-3 h-3" /> Colunas
            {state.hiddenColumns.size > 0 && (
              <span className="bg-primary/20 text-primary rounded-full px-1.5 text-[10px]">−{state.hiddenColumns.size}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2 max-h-80 overflow-y-auto">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold px-2 mb-1">Mostrar colunas</p>
          {columns.map((c) => {
            const hidden = state.hiddenColumns.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => onToggleColumn(c.id)}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between"
              >
                <span className="truncate">{c.titulo}</span>
                <span className={hidden ? "text-muted-foreground/40" : "text-primary"}>
                  {hidden ? "oculta" : "✓"}
                </span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <button
          onClick={onReset}
          className="text-xs font-medium text-muted-foreground hover:text-destructive px-2 py-1 inline-flex items-center gap-1"
          aria-label="Limpar todos os filtros"
        >
          <X className="w-3 h-3" /> Limpar ({activeCount})
        </button>
      )}
        </div>
      )}

      {activeCount > 0 && (
        <span className="text-[10px] text-muted-foreground ml-auto">
          {totalMatched} de {totalCards} casos
        </span>
      )}
    </div>
  );
});