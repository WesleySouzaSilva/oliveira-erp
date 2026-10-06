import { motion } from "framer-motion";
import {
  Trash2,
  Edit2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPrazoEditor } from "@/components/vencimentos/StatusPrazoEditor";
import { NotificadoEditor } from "@/components/vencimentos/NotificadoEditor";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { formatCurrency, formatDateBR, getStatusIcon, isOverdue } from "@/components/vencimentos/lib/helpers";
import { RESOLVE_REASONS, type SortKey, type SortDir } from "@/components/vencimentos/lib/types";
import type { Contrato } from "@/hooks/useVencimentosData";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

interface VencimentosTableProps {
  loading: boolean;
  filtered: Contrato[];
  paginatedContratos: Contrato[];
  hasMore: boolean;
  totalCount: number;
  shownCount: number;
  loadMore: () => void;
  sortKey: SortKey;
  sortDir: SortDir;
  toggleSort: (key: SortKey) => void;
  onEdit: (c: Contrato) => void;
  onDelete: (id: string) => void;
  onResolve: (id: string, motivo: string) => void;
  onUnresolve: (id: string) => void;
  onUpdateStatus: (id: string, novoStatus: string) => void;
  onUpdateNotificado: (id: string, valor: boolean | null) => void;
}

export function VencimentosTable({
  loading,
  filtered,
  paginatedContratos,
  hasMore,
  totalCount,
  shownCount,
  loadMore,
  sortKey,
  sortDir,
  toggleSort,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  onUpdateStatus,
  onUpdateNotificado,
}: VencimentosTableProps) {
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 text-muted-foreground/40" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-accent" />
      : <ChevronDown className="w-3 h-3 ml-1 text-accent" />;
  };

  return (
    <motion.div
      {...fadeUp}
      transition={{ delay: 0.1 }}
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="overflow-x-auto">
        <Table className="table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="px-2 py-2 cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("nome_cliente")}>
                <span className="flex items-center">Cliente <SortIcon column="nome_cliente" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("banco")}>
                <span className="flex items-center">Banco <SortIcon column="banco" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("numero_contrato")}>
                <span className="flex items-center">Contrato <SortIcon column="numero_contrato" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("vencimento_proxima_parcela")}>
                <span className="flex items-center">Vencimento <SortIcon column="vencimento_proxima_parcela" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 text-right cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("valor_parcela")}>
                <span className="flex items-center justify-end">Parcela <SortIcon column="valor_parcela" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 text-right cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("valor_total_operacao")}>
                <span className="flex items-center justify-end">Total <SortIcon column="valor_total_operacao" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("parcelas_vencidas")}>
                <span className="flex items-center">Venc. <SortIcon column="parcelas_vencidas" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap text-xs">Notif. antes do venc.</TableHead>
              <TableHead className="px-2 py-2 cursor-pointer select-none whitespace-nowrap text-xs" onClick={() => toggleSort("status_prazo")}>
                <span className="flex items-center">Status <SortIcon column="status_prazo" /></span>
              </TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap text-xs w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <TableCell key={j} className="px-2 py-2">
                      <div className="h-4 rounded bg-muted animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nenhum contrato encontrado. Importe sua planilha ou adicione manualmente.
                </TableCell>
              </TableRow>
            ) : (
              paginatedContratos.map((c) => (
                <TableRow key={c.id} className={`${c.resolvido ? "opacity-50" : ""} ${!c.resolvido && isOverdue(c.vencimento_proxima_parcela) ? "bg-destructive/5" : ""}`}>
                  <TableCell className="px-2 py-2 text-xs text-foreground min-w-0">
                    <a
                      data-private
                      href={`/clientes/${encodeURIComponent(c.nome_cliente)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold hover:text-primary hover:underline cursor-pointer"
                      title="Abrir cadastro do cliente em nova aba"
                    >
                      {c.nome_cliente}
                    </a>
                    {c.resolvido && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                        {c.motivo_resolucao || "Resolvido"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-xs text-muted-foreground">{c.banco || "—"}</TableCell>
                  <TableCell className="px-2 py-2 text-xs text-muted-foreground font-mono">
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="cursor-pointer hover:underline hover:text-primary text-left"
                      title="Editar contrato"
                    >
                      {c.numero_contrato || "—"}
                    </button>
                  </TableCell>
                  <TableCell className="px-2 py-2 text-xs">
                    {c.vencimento_proxima_parcela ? (
                      <span className={isOverdue(c.vencimento_proxima_parcela) && !c.resolvido ? "text-destructive font-semibold" : "text-foreground"}>
                        {formatDateBR(c.vencimento_proxima_parcela)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-xs text-right">{formatCurrency(c.valor_parcela)}</TableCell>
                  <TableCell className="px-2 py-2 text-xs text-right font-medium">{formatCurrency(c.valor_total_operacao)}</TableCell>
                  <TableCell className="px-2 py-2">
                    {c.parcelas_vencidas ? (
                      <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">Sim</span>
                    ) : (
                      <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">Não</span>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <NotificadoEditor
                      valor={c.notificado_antes_vencimento ?? null}
                      onSalvar={(v) => onUpdateNotificado(c.id, v)}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <StatusPrazoEditor
                      valor={c.status_prazo}
                      icone={getStatusIcon(c.status_prazo)}
                      onSalvar={(v) => onUpdateStatus(c.id, v)}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <div className="flex items-center gap-0.5">
                      {!c.resolvido ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="p-1 hover:bg-success/10 rounded" title="Dar baixa / Resolver">
                              <ShieldCheck className="w-3.5 h-3.5 text-success" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2" align="end">
                            <p className="text-xs font-semibold text-foreground mb-2">Motivo da baixa:</p>
                            <div className="space-y-1">
                              {RESOLVE_REASONS.map((reason) => (
                                <button
                                  key={reason}
                                  onClick={() => onResolve(c.id, reason)}
                                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-secondary transition-colors text-foreground"
                                >
                                  {reason}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <button onClick={() => onUnresolve(c.id)} className="p-1 hover:bg-accent/10 rounded" title="Reabrir">
                          <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                        </button>
                      )}
                      <button onClick={() => onEdit(c)} className="p-1 hover:bg-secondary rounded">
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => onDelete(c.id)} className="p-1 hover:bg-destructive/10 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMoreButton
        shownCount={shownCount}
        totalCount={totalCount}
        hasMore={hasMore}
        onLoadMore={loadMore}
        label="contratos"
      />
    </motion.div>
  );
}