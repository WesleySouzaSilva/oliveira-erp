import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, X } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* ───────────────────── tipos ───────────────────── */

export type SortDir = "asc" | "desc";

export type DataTableColumn<T> = {
  /** Identificador único da coluna (também usado como chave de sort). */
  key: string;
  /** Rótulo do cabeçalho. */
  header: React.ReactNode;
  /** Render customizado da célula. Default: `String(row[key] ?? "")`. */
  render?: (row: T) => React.ReactNode;
  /** Habilita ordenação clicando no cabeçalho. Default: true. */
  sortable?: boolean;
  /** Valor usado pra ordenar (default: render textual). Nulos vão para o fim. */
  sortAccessor?: (row: T) => string | number | Date | null | undefined;
  align?: "left" | "right" | "center";
  /** Classes extras na célula/cabeçalho. */
  className?: string;
  headerClassName?: string;
  /** Largura sugerida (ex.: "w-32", "min-w-[160px]"). */
  width?: string;
  /** Sempre visível no menu de colunas (não pode ser desligada). */
  alwaysVisible?: boolean;
  /** Começa oculta (usuário liga no menu de colunas). */
  initiallyHidden?: boolean;
};

export type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  emptyState?: Omit<EmptyStateProps, "compact">;
  onRowClick?: (row: T) => void;
  getRowId: (row: T) => string;
  /** Coluna ordenada inicialmente. */
  defaultSort?: { key: string; dir?: SortDir };
  /** Cabeçalho sticky (default true). */
  stickyHeader?: boolean;
  /** Densidade (default "comfortable"). */
  density?: "comfortable" | "compact";
  className?: string;
  /** Classe extra aplicada ao <tr> do corpo. */
  rowClassName?: (row: T) => string | undefined;
  /** Habilita coluna de checkbox de seleção. */
  selectable?: boolean;
  /** Callback quando a seleção muda (ids). */
  onSelectionChange?: (ids: string[]) => void;
  /** Barra de ações em massa (só aparece quando há seleção). */
  bulkActions?: (selectedRows: T[], clear: () => void) => React.ReactNode;
  /** Habilita menu "Colunas" para mostrar/ocultar. */
  columnsToggle?: boolean;
  /** ID único desta tabela — persiste visibilidade em localStorage. */
  tableId?: string;
  /** Toolbar à esquerda do menu "Colunas". */
  toolbar?: React.ReactNode;
};

/* ───────────────────── helpers ───────────────────── */

/** Comparador "nulos por último" + locale pt-BR / numérico / data. */
export function nullLast(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
  dir: SortDir,
) {
  const aNil = a === null || a === undefined || a === "";
  const bNil = b === null || b === undefined || b === "";
  if (aNil && bNil) return 0;
  if (aNil) return 1; // nulos sempre por último, independente da direção
  if (bNil) return -1;

  let cmp = 0;
  if (a instanceof Date || b instanceof Date) {
    cmp = (a as Date).valueOf() - (b as Date).valueOf();
  } else if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base", numeric: true });
  }
  return dir === "asc" ? cmp : -cmp;
}

function defaultAccessor<T>(col: DataTableColumn<T>, row: T): string | number | Date | null {
  if (col.sortAccessor) return col.sortAccessor(row) ?? null;
  const raw = (row as any)[col.key];
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") return raw;
  return String(raw);
}

/* ───────────────────── componente ───────────────────── */

export function DataTable<T>({
  data,
  columns,
  loading,
  emptyState,
  onRowClick,
  getRowId,
  defaultSort,
  stickyHeader = true,
  density = "comfortable",
  className,
  rowClassName,
  selectable,
  onSelectionChange,
  bulkActions,
  columnsToggle,
  tableId,
  toolbar,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = React.useState<SortDir>(defaultSort?.dir ?? "asc");

  /* ── visibilidade de colunas (persistida por tableId) ── */
  const lsKey = tableId ? `datatable:cols:${tableId}` : null;
  const [hidden, setHidden] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    columns.forEach((c) => { if (c.initiallyHidden && !c.alwaysVisible) init[c.key] = true; });
    if (lsKey && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(lsKey);
        if (raw) return { ...init, ...JSON.parse(raw) };
      } catch { /* ignore */ }
    }
    return init;
  });
  React.useEffect(() => {
    if (!lsKey) return;
    try { window.localStorage.setItem(lsKey, JSON.stringify(hidden)); } catch { /* ignore */ }
  }, [lsKey, hidden]);
  const visibleColumns = React.useMemo(
    () => columns.filter((c) => c.alwaysVisible || !hidden[c.key]),
    [columns, hidden],
  );

  /* ── seleção ── */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const clearSelection = React.useCallback(() => setSelected(new Set()), []);
  React.useEffect(() => {
    onSelectionChange?.(Array.from(selected));
  }, [selected, onSelectionChange]);

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const arr = [...data];
    arr.sort((a, b) => nullLast(defaultAccessor(col, a), defaultAccessor(col, b), sortDir));
    return arr;
  }, [data, columns, sortKey, sortDir]);

  const visibleIds = React.useMemo(() => sortedData.map(getRowId), [sortedData, getRowId]);
  const allSelected = selectable && visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selectable && !allSelected && visibleIds.some((id) => selected.has(id));
  const selectedRows = React.useMemo(
    () => sortedData.filter((r) => selected.has(getRowId(r))),
    [sortedData, selected, getRowId],
  );
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSort = (col: DataTableColumn<T>) => {
    if (col.sortable === false) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  const cellPad = density === "compact" ? "py-2 px-3" : "py-3 px-4";
  const headPad = density === "compact" ? "h-9 px-3" : "h-11 px-4";

  const showChrome = !!toolbar || !!columnsToggle;

  if (loading) {
    return <TableSkeleton rows={6} cols={visibleColumns.length + (selectable ? 1 : 0)} className={className} />;
  }

  if (!sortedData.length && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  const bulkBar = selectable && bulkActions && selectedRows.length > 0 ? (
    <div className="flex items-center gap-3 px-4 py-2 bg-accent/10 border-b border-border">
      <span className="text-xs font-semibold text-foreground">
        {selectedRows.length} selecionado{selectedRows.length > 1 ? "s" : ""}
      </span>
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        {bulkActions(selectedRows, clearSelection)}
      </div>
      <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 px-2">
        <X className="w-3.5 h-3.5 mr-1" /> Limpar
      </Button>
    </div>
  ) : null;

  const chrome = showChrome ? (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
      <div className="flex-1 min-w-0">{toolbar}</div>
      {columnsToggle && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 self-start sm:self-auto">
              <Columns3 className="w-3.5 h-3.5 mr-1.5" /> Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((c) => {
              const isVisible = c.alwaysVisible || !hidden[c.key];
              return (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={isVisible}
                  disabled={c.alwaysVisible}
                  onCheckedChange={(v) => {
                    setHidden((prev) => {
                      const next = { ...prev };
                      if (v) delete next[c.key]; else next[c.key] = true;
                      return next;
                    });
                  }}
                  onSelect={(e) => e.preventDefault()}
                >
                  {typeof c.header === "string" ? c.header : c.key}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "relative w-full overflow-auto rounded-lg border border-border bg-card",
        className,
      )}
    >
      {chrome}
      {bulkBar}
      {/* Mobile: card mode (< md) */}
      <div className="md:hidden divide-y divide-border">
        {sortedData.map((row) => {
          const id = getRowId(row);
          const clickable = !!onRowClick;
          const isRowSelected = selected.has(id);
          return (
            <div
              key={id}
              data-row-id={id}
              onClick={clickable ? (e) => {
                const tgt = e.target as HTMLElement;
                if (tgt.closest("button, a, input, select, textarea, [role=menuitem], [role=checkbox]")) return;
                onRowClick!(row);
              } : undefined}
              className={cn(
                "p-3 space-y-1.5",
                clickable && "cursor-pointer active:bg-accent/10",
                isRowSelected && "bg-accent/5",
                rowClassName?.(row),
              )}
            >
              {selectable && (
                <div className="flex items-center gap-2 pb-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isRowSelected}
                    onCheckedChange={() => toggleRow(id)}
                    aria-label="Selecionar linha"
                  />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Selecionar</span>
                </div>
              )}
              {visibleColumns.map((col) => {
                const content = col.render ? col.render(row) : ((row as any)[col.key] ?? "—");
                return (
                  <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-[11px] uppercase tracking-wide font-serif text-muted-foreground shrink-0 pt-0.5">
                      {typeof col.header === "string" ? col.header : col.key}
                    </span>
                    <div className={cn("min-w-0 text-right", col.className)}>{content}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Desktop: tabela padrão (>= md) */}
      <Table className="hidden md:table">
        <TableHeader
          className={cn(stickyHeader && "sticky top-0 z-10 bg-card/95 backdrop-blur")}
        >
          <TableRow>
            {selectable && (
              <TableHead className={cn(headPad, "w-10")}>
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
            )}
            {visibleColumns.map((col) => {
              const isActive = sortKey === col.key;
              const aria = !isActive ? "none" : sortDir === "asc" ? "ascending" : "descending";
              const canSort = col.sortable !== false;
              const Icon = !isActive ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
              return (
                <TableHead
                  key={col.key}
                  aria-sort={aria as React.AriaAttributes["aria-sort"]}
                  className={cn(
                    headPad,
                    "font-serif text-xs uppercase tracking-wide text-muted-foreground",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.width,
                    col.headerClassName,
                  )}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className={cn(
                        "inline-flex items-center gap-1.5 select-none",
                        "hover:text-foreground transition-colors",
                        col.align === "right" && "flex-row-reverse",
                        col.align === "center" && "mx-auto",
                        isActive && "text-foreground",
                      )}
                    >
                      <span>{col.header}</span>
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5",
                          isActive ? "opacity-80" : "opacity-40",
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <span>{col.header}</span>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row) => {
            const id = getRowId(row);
            const clickable = !!onRowClick;
            const isRowSelected = selected.has(id);
            return (
              <TableRow
                key={id}
                data-row-id={id}
                data-state={isRowSelected ? "selected" : undefined}
                onClick={clickable ? (e) => {
                  // Não dispara onRowClick quando o usuário interagir com um controle
                  const tgt = e.target as HTMLElement;
                  if (tgt.closest("button, a, input, select, textarea, [role=menuitem], [role=checkbox]")) return;
                  onRowClick!(row);
                } : undefined}
                className={cn(
                  clickable && "cursor-pointer",
                  isRowSelected && "bg-accent/5",
                  rowClassName?.(row),
                )}
              >
                {selectable && (
                  <TableCell className={cn(cellPad, "w-10")} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isRowSelected}
                      onCheckedChange={() => toggleRow(id)}
                      aria-label="Selecionar linha"
                    />
                  </TableCell>
                )}
                {visibleColumns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      cellPad,
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row) : ((row as any)[col.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default DataTable;