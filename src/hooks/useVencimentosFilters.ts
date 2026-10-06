import { useMemo, useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import type { Contrato } from "@/hooks/useVencimentosData";
import type { SortKey, SortDir } from "@/components/vencimentos/lib/types";

export function useVencimentosFilters(contratos: Contrato[]) {
  const [urlFilters, setUrlFilters] = useUrlFilters({
    search: "",
    filterStatus: "all",
    filterBanco: "all",
  });
  const { search, filterStatus, filterBanco } = urlFilters;
  const setSearch = (v: string) => setUrlFilters({ search: v });
  const setFilterStatus = (v: string) => setUrlFilters({ filterStatus: v });
  const setFilterBanco = (v: string) => setUrlFilters({ filterBanco: v });
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showResolvidos, setShowResolvidos] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const result = contratos.filter((c) => {
      const matchSearch =
        !search ||
        c.nome_cliente.toLowerCase().includes(search.toLowerCase()) ||
        (c.numero_contrato || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.banco || "").toLowerCase().includes(search.toLowerCase());

      const matchStatus = filterStatus === "all" || c.status_prazo === filterStatus;
      const matchBanco = filterBanco === "all" || c.banco === filterBanco;
      const matchResolvido = showResolvidos || !c.resolvido;
      return matchSearch && matchStatus && matchBanco && matchResolvido;
    });

    if (!sortKey) return result;

    return [...result].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortKey) {
        case "nome_cliente":
        case "banco":
        case "numero_contrato":
        case "status_prazo":
          valA = (a[sortKey] || "").toLowerCase();
          valB = (b[sortKey] || "").toLowerCase();
          break;
        case "vencimento_proxima_parcela":
          valA = a[sortKey] ? new Date(a[sortKey]!).getTime() : 0;
          valB = b[sortKey] ? new Date(b[sortKey]!).getTime() : 0;
          break;
        case "valor_parcela":
        case "valor_total_operacao":
          valA = a[sortKey] ?? 0;
          valB = b[sortKey] ?? 0;
          break;
        case "parcelas_vencidas":
          valA = a[sortKey] ? 1 : 0;
          valB = b[sortKey] ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [contratos, search, filterStatus, filterBanco, sortKey, sortDir, showResolvidos]);

  const { paginatedItems: paginatedContratos, hasMore, totalCount, shownCount, loadMore } =
    usePagination(filtered, { pageSize: 100 });

  return {
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterBanco,
    setFilterBanco,
    sortKey,
    sortDir,
    showResolvidos,
    setShowResolvidos,
    toggleSort,
    filtered,
    paginatedContratos,
    hasMore,
    totalCount,
    shownCount,
    loadMore,
  };
}