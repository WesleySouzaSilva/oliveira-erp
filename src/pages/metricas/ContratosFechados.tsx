import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Upload, Download, Search, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { NICHOS, fmt } from "@/hooks/useMetricasCalc";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useContratosFechados, type ContratoFechado } from "@/hooks/useContratosFechados";
import { DashboardContratosFechados } from "@/components/metricas/DashboardContratosFechados";
import { useMetas } from "@/hooks/useMetricas";
import { Progress } from "@/components/ui/progress";
import { useConfirm } from "@/components/ui/confirm-dialog";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const FORMAS = ["PIX", "Boleto", "Cartão de Crédito", "Cartão de Débito", "Transferência", "Dinheiro", "Outro"];
const TIPOS = ["À vista", "Parcelado", "Entrada + Parcelas"];
const PLATAFORMAS = ["Meta Ads (Instagram)", "Meta Ads (Facebook)", "Google Ads", "Orgânico", "Credenciado", "Indicação", "Outro"];

function emptyContrato(): ContratoFechado {
  return {
    nicho: "agro",
    produto: null,
    closer_id: null,
    sdr_id: null,
    data_venda: new Date().toISOString().slice(0, 10),
    data_pagamento: null,
    plataforma: null,
    cliente_nome: "",
    cliente_contato: null,
    cliente_estado: null,
    valor_total: 0,
    valor_entrada: 0,
    num_parcelas: 1,
    valor_parcela: 0,
    valor_recebido: 0,
    forma_pagamento: null,
    tipo_pagamento: null,
    via_credenciado: false,
    credenciado_nome: null,
    observacoes: null,
  };
}

/** Tenta parsear data nos formatos: 2024-01-31, 31/01/2024, 31-01-2024, número serial Excel */
function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    const d = br[1].padStart(2, "0");
    const m = br[2].padStart(2, "0");
    let y = br[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseMoney(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseInt0(v: any): number {
  if (v == null || v === "") return 0;
  const n = parseInt(String(v).replace(/\D/g, ""));
  return isNaN(n) ? 0 : n;
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Mapeia uma linha da planilha para ContratoFechado por nome de coluna (flexível) */
function rowToContrato(raw: Record<string, any>, membros: { user_id: string; nome: string }[]): ContratoFechado | null {
  const get = (...keys: string[]): any => {
    const normKeys = keys.map(normalize);
    for (const k of Object.keys(raw)) {
      if (normKeys.includes(normalize(k))) return raw[k];
    }
    return undefined;
  };
  const findMember = (name: any): string | null => {
    if (!name) return null;
    const n = normalize(String(name));
    const m = membros.find((x) => normalize(x.nome || "") === n || normalize(x.nome || "").includes(n));
    return m?.user_id || null;
  };

  const cliente = get("cliente", "nomecliente", "nome");
  if (!cliente) return null;

  const dataVenda = parseDate(get("datavenda", "datadavenda", "data"));
  if (!dataVenda) return null;

  const nichoRaw = String(get("nicho", "produto", "segmento") || "agro").toLowerCase();
  const nicho = nichoRaw.includes("emp")
    ? "empresarial"
    : nichoRaw.includes("bpc")
      ? "bpc"
      : nichoRaw.includes("outro") || nichoRaw.includes("divers")
        ? "outros"
        : "agro";

  return {
    nicho,
    produto: get("produto") || null,
    closer_id: findMember(get("closer")),
    sdr_id: findMember(get("sdr")),
    data_venda: dataVenda,
    data_pagamento: parseDate(get("datapagamento", "datadepagamento", "pagamento")),
    plataforma: get("plataforma") || null,
    cliente_nome: String(cliente),
    cliente_contato: get("contatocliente", "contato", "telefone") || null,
    cliente_estado: get("estado", "uf") || null,
    valor_total: parseMoney(get("valortotal", "valor")),
    valor_entrada: parseMoney(get("ventrada", "valorentrada", "entrada")),
    num_parcelas: parseInt0(get("numparcelas", "nparcelas", "parcelas")) || 1,
    valor_parcela: parseMoney(get("vparcela", "valorparcela")),
    valor_recebido: parseMoney(get("vrecebido", "valorrecebido", "recebido")),
    forma_pagamento: get("formapagamento", "formadepagamento") || null,
    tipo_pagamento: get("tipopagamento", "tipodepagamento") || null,
    via_credenciado: ["sim", "true", "1"].includes(normalize(String(get("credenciado", "viacredenciado") || ""))),
    credenciado_nome: get("credenciadonome", "nomecredenciado") || null,
    observacoes: get("obs", "observacoes", "observacao") || null,
  };
}

export default function ContratosFechados() {
  const now = new Date();
  const [searchParams, setSearchParams] = useSearchParams();

  const getParam = (k: string) => searchParams.get(k);
  const initialAno = (() => {
    const v = getParam("ano");
    if (v === "all") return "all" as const;
    const n = v ? parseInt(v) : NaN;
    return isNaN(n) ? now.getFullYear() : n;
  })();
  const initialMes = (() => {
    const n = parseInt(getParam("mes") || "");
    return isNaN(n) ? now.getMonth() + 1 : n;
  })();
  const initialSortDir = (getParam("dir") === "asc" ? "asc" : "desc") as "asc" | "desc";

  const [filtroNicho, setFiltroNicho] = useState<string>(getParam("nicho") || "all");
  const [filtroMes, setFiltroMes] = useState<number>(initialMes);
  const [filtroAno, setFiltroAno] = useState<number | "all">(initialAno);
  const [busca, setBusca] = useState(getParam("q") || "");
  const [filtroCloser, setFiltroCloser] = useState<string>(getParam("closer") || "all");
  const [sortKey, setSortKey] = useState<string>(getParam("sort") || "data_venda");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [page, setPage] = useState(() => {
    const n = parseInt(getParam("page") || "");
    return isNaN(n) || n < 1 ? 1 : n;
  });
  const [pageSize, setPageSize] = useState(() => {
    const n = parseInt(getParam("ps") || "");
    return [25, 50, 100, 200].includes(n) ? n : 25;
  });

  // Sincroniza estado -> URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filtroNicho !== "all") params.set("nicho", filtroNicho);
    if (filtroMes !== now.getMonth() + 1) params.set("mes", String(filtroMes));
    if (filtroAno !== now.getFullYear()) params.set("ano", String(filtroAno));
    if (busca) params.set("q", busca);
    if (filtroCloser !== "all") params.set("closer", filtroCloser);
    if (sortKey !== "data_venda") params.set("sort", sortKey);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (page !== 1) params.set("page", String(page));
    if (pageSize !== 25) params.set("ps", String(pageSize));
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroNicho, filtroMes, filtroAno, busca, filtroCloser, sortKey, sortDir, page, pageSize]);

  const { rows, loading, save, saveMany, remove } = useContratosFechados({
    nicho: filtroNicho === "all" ? undefined : filtroNicho,
    mes: filtroMes,
    ano: filtroAno === "all" ? undefined : filtroAno,
    busca,
    closerId: filtroCloser === "all" ? undefined : filtroCloser,
  });
  const { members } = useOrgMembers();

  const memberName = (uid: string | null) =>
    uid ? members.find((m) => m.user_id === uid)?.nome || uid.slice(0, 8) : "—";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoFechado>(emptyContrato());
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const valorTotal = rows.reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const valorRecebido = rows.reduce((s, r) => s + Number(r.valor_recebido || 0), 0);
    const entrada = rows.reduce((s, r) => s + Number(r.valor_entrada || 0), 0);
    const tempos = rows.map((r) => r.tempo_fechamento_dias).filter((t): t is number => t != null);
    const tempoMedio = tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : 0;
    return { count: rows.length, valorTotal, valorRecebido, entrada, tempoMedio };
  }, [rows]);

  // Metas mensais (interligadas ao módulo de Metas)
  const anoMeta = filtroAno === "all" ? now.getFullYear() : filtroAno;
  const { metas: metasMes } = useMetas(filtroMes, anoMeta);
  const metaResumo = useMemo(() => {
    const filtradas = filtroNicho === "all" ? metasMes : metasMes.filter((m) => m.nicho === filtroNicho);
    const metaReceita = filtradas.reduce((s, m) => s + Number(m.meta_receita || 0), 0);
    const metaContratos = filtradas.reduce((s, m) => s + Number(m.meta_contratos || 0), 0);
    const pctReceita = metaReceita > 0 ? Math.min(999, Math.round((totals.valorTotal / metaReceita) * 100)) : 0;
    const pctContratos = metaContratos > 0 ? Math.min(999, Math.round((totals.count / metaContratos) * 100)) : 0;
    return { metaReceita, metaContratos, pctReceita, pctContratos };
  }, [metasMes, filtroNicho, totals.valorTotal, totals.count]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    anos.add(now.getFullYear());
    anos.add(now.getFullYear() - 1);
    rows.forEach((r) => {
      if (r.data_venda) {
        const a = new Date(r.data_venda).getFullYear();
        if (!isNaN(a)) anos.add(a);
      }
    });
    return Array.from(anos).sort((a, b) => b - a);
  }, [rows]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let av: any;
      let bv: any;
      if (sortKey === "closer") {
        av = memberName(a.closer_id);
        bv = memberName(b.closer_id);
      } else if (sortKey === "sdr") {
        av = memberName(a.sdr_id);
        bv = memberName(b.sdr_id);
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * dir;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir, members]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const SortHead = ({
    label,
    sortKey: k,
    align = "left",
  }: {
    label: string;
    sortKey: string;
    align?: "left" | "right";
  }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";

    const handleActivate = () => toggleSort(k);
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleActivate();
      }
    };

    return (
      <TableHead
        scope="col"
        aria-sort={ariaSort}
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        className={`cursor-pointer select-none hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] rounded-sm ${
          align === "right" ? "text-right" : ""
        } ${active ? "text-primary font-semibold" : ""}`}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
          {label}
          <Icon className={`w-3 h-3 ${active ? "opacity-100" : "opacity-40"}`} aria-hidden="true" />
        </span>
      </TableHead>
    );
  };

  /* ---------- paginação ---------- */
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize]);

  // reset página quando dados mudam
  useMemo(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, filtroNicho, filtroMes, filtroAno, filtroCloser, busca, sortKey, sortDir]);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  const visiblePageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("ellipsis", totalPages);
      } else if (safePage >= totalPages - 3) {
        pages.push(1, "ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1, "ellipsis");
        for (let i = safePage - 1; i <= safePage + 1; i++) pages.push(i);
        pages.push("ellipsis", totalPages);
      }
    }
    return pages;
  }, [safePage, totalPages]);

  const openCreate = () => {
    setEditing(emptyContrato());
    setOpen(true);
  };
  const openEdit = (c: ContratoFechado) => {
    setEditing({ ...c });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!editing.cliente_nome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSaving(true);
    try {
      await save(editing);
      toast.success("Contrato salvo");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const askConfirm = useConfirm();
  const handleDelete = async (id: string) => {
    if (!(await askConfirm({ title: "Excluir contrato", description: "Excluir este contrato fechado?", destructive: true, confirmText: "Excluir" }))) return;
    try {
      await remove(id);
      toast.success("Contrato excluído");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
      const contratos = json.map((r) => rowToContrato(r, members)).filter((c): c is ContratoFechado => !!c);
      if (contratos.length === 0) {
        toast.error("Nenhuma linha válida. Verifique se há colunas 'Cliente' e 'Data da Venda'.");
        return;
      }
      if (!(await askConfirm({ title: "Importar contratos", description: `Importar ${contratos.length} contratos da planilha?`, confirmText: "Importar" }))) return;
      await saveMany(contratos);
      toast.success(`${contratos.length} contratos importados`);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || ""));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportXLSX = () => {
    const data = sortedRows.map((r) => ({
      MÊS: r.mes_referencia ? MESES[new Date(r.mes_referencia).getMonth()] + "/" + new Date(r.mes_referencia).getFullYear() : "",
      PRODUTO: r.produto || "",
      NICHO: r.nicho,
      CLOSER: memberName(r.closer_id),
      SDR: memberName(r.sdr_id),
      "DATA DA VENDA": r.data_venda,
      "DATA DE PAGAMENTO": r.data_pagamento || "",
      "TEMPO DE FECHAMENTO": r.tempo_fechamento_dias ?? "",
      PLATAFORMA: r.plataforma || "",
      CLIENTE: r.cliente_nome,
      "CONTATO CLIENTE": r.cliente_contato || "",
      ESTADO: r.cliente_estado || "",
      "VALOR TOTAL": r.valor_total,
      "V. ENTRADA": r.valor_entrada,
      "Nº PARCELAS": r.num_parcelas,
      "V. PARCELA": r.valor_parcela,
      "V. RECEBIDO": r.valor_recebido,
      "PORCENTAGEM FINAL": r.porcentagem_final,
      "FORMA DE PAGAMENTO": r.forma_pagamento || "",
      "TIPO DE PAGAMENTO": r.tipo_pagamento || "",
      CREDENCIADO: r.via_credenciado ? "Sim" : "Não",
      "NOME CREDENCIADO": r.credenciado_nome || "",
      OBS: r.observacoes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contratos Fechados");
    XLSX.writeFile(wb, `contratos-fechados-${filtroAno === "all" ? "todos" : filtroAno}-${String(filtroMes).padStart(2, "0")}.xlsx`);
  };

  const downloadTemplate = () => {
    const sample = [{
      Nicho: "agro",
      Produto: "Laudo MCR",
      Closer: "Nome do Closer",
      SDR: "Nome do SDR",
      "Data da Venda": "2025-01-15",
      "Data de Pagamento": "2025-01-20",
      Plataforma: "Meta Ads (Instagram)",
      Cliente: "Fulano de Tal",
      "Contato Cliente": "(11) 99999-0000",
      Estado: "SP",
      "Valor Total": 5000,
      "V. Entrada": 1500,
      "Nº Parcelas": 7,
      "V. Parcela": 500,
      "V. Recebido": 1500,
      "Forma de Pagamento": "PIX",
      "Tipo de Pagamento": "Entrada + Parcelas",
      Credenciado: "Não",
      "Nome Credenciado": "",
      OBS: "Cliente indicado",
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo-contratos-fechados.xlsx");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Contratos Fechados</h1>
            <p className="text-sm text-muted-foreground">
              Registro detalhado de cada venda por nicho, closer e SDR.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Modelo
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar planilha
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" size="sm" onClick={exportXLSX} disabled={rows.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Novo contrato
            </Button>
          </div>
        </div>

        {/* Totais */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Contratos</div>
              <div className="text-2xl font-bold">{totals.count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Valor Total</div>
              <div className="text-xl font-bold">{fmt.brl(totals.valorTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Entrada</div>
              <div className="text-xl font-bold">{fmt.brl(totals.entrada)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Recebido</div>
              <div className="text-xl font-bold">{fmt.brl(totals.valorRecebido)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Tempo médio (dias)</div>
              <div className="text-2xl font-bold">{totals.tempoMedio || "—"}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Meta Mensal{filtroNicho !== "all" ? ` · ${filtroNicho}` : ""}
              </div>
              <div className="text-xl font-bold">{fmt.brl(metaResumo.metaReceita)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {metaResumo.metaContratos > 0 ? `${metaResumo.metaContratos} contratos` : "defina em Metas"}
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">% da Meta (receita)</div>
              <div className="text-2xl font-bold">
                {metaResumo.metaReceita > 0 ? `${metaResumo.pctReceita}%` : "—"}
              </div>
              <Progress
                value={Math.min(100, metaResumo.pctReceita)}
                className="h-1.5 mt-2"
                aria-label="Percentual da meta de receita atingido"
              />
              {metaResumo.metaContratos > 0 && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Contratos: {metaResumo.pctContratos}%
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Indicadores de meta / ranking */}
        <DashboardContratosFechados
          ano={filtroAno === "all" ? now.getFullYear() : filtroAno}
          mes={filtroMes}
          nicho={filtroNicho}
          members={members}
        />

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nicho</Label>
              <Select value={filtroNicho} onValueChange={setFiltroNicho}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os nichos</SelectItem>
                  {NICHOS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(parseInt(e.target.value))}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Select value={String(filtroAno)} onValueChange={(v) => setFiltroAno(v === "all" ? "all" : parseInt(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Closer</Label>
              <Select value={filtroCloser} onValueChange={setFiltroCloser}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os closers</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar cliente / produto / contato</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-3 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" placeholder="Buscar..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum contrato fechado neste período. Clique em "Novo contrato" ou importe sua planilha.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    <TableRow className="text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                      <SortHead label="Mês" sortKey="mes_referencia" />
                      <SortHead label="Produto" sortKey="produto" />
                      <SortHead label="Nicho" sortKey="nicho" />
                      <SortHead label="Closer" sortKey="closer" />
                      <SortHead label="SDR" sortKey="sdr" />
                      <SortHead label="Venda" sortKey="data_venda" />
                      <SortHead label="Pagamento" sortKey="data_pagamento" />
                      <SortHead label="Tempo" sortKey="tempo_fechamento_dias" />
                      <SortHead label="Plataforma" sortKey="plataforma" />
                      <SortHead label="Cliente" sortKey="cliente_nome" />
                      <TableHead scope="col">Contato</TableHead>
                      <SortHead label="UF" sortKey="cliente_estado" />
                      <SortHead label="V. Total" sortKey="valor_total" align="right" />
                      <SortHead label="Entrada" sortKey="valor_entrada" align="right" />
                      <SortHead label="Parc." sortKey="num_parcelas" align="right" />
                      <SortHead label="V. Parc." sortKey="valor_parcela" align="right" />
                      <SortHead label="Recebido" sortKey="valor_recebido" align="right" />
                      <SortHead label="%" sortKey="porcentagem_final" align="right" />
                      <TableHead scope="col">Forma</TableHead>
                      <TableHead scope="col">Tipo</TableHead>
                      <TableHead scope="col">Cred.</TableHead>
                      <TableHead scope="col" className="sticky right-0 bg-muted/40"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r, idx) => (
                      <TableRow
                        key={r.id}
                        className={`text-xs transition-colors hover:bg-primary/5 ${
                          idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                        }`}
                      >
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {r.mes_referencia
                            ? MESES[new Date(r.mes_referencia).getMonth()].slice(0, 3) +
                              "/" +
                              new Date(r.mes_referencia).getFullYear()
                            : ""}
                        </TableCell>
                        <TableCell>{r.produto || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">{r.nicho}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.closer_id ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
                                {memberName(r.closer_id).charAt(0).toUpperCase()}
                              </span>
                              <span className="font-medium">{memberName(r.closer_id)}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{memberName(r.sdr_id)}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{r.data_venda}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {r.data_pagamento || "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.tempo_fechamento_dias != null ? `${r.tempo_fechamento_dias}d` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.plataforma || "—"}</TableCell>
                        <TableCell className="font-medium">{r.cliente_nome}</TableCell>
                        <TableCell className="text-muted-foreground">{r.cliente_contato || "—"}</TableCell>
                        <TableCell>{r.cliente_estado || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmt.brl(r.valor_total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt.brl(r.valor_entrada)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.num_parcelas}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt.brl(r.valor_parcela)}</TableCell>
                        <TableCell className="text-right tabular-nums text-success">{fmt.brl(r.valor_recebido)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(r.porcentagem_final) >= 100 ? "default" : "secondary"}>
                            {Number(r.porcentagem_final || 0).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.forma_pagamento || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.tipo_pagamento || "—"}</TableCell>
                        <TableCell>{r.via_credenciado ? <Badge>Sim</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="flex gap-1 whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)} aria-label="Editar contrato">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id!)} aria-label="Excluir contrato">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Paginação */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/20">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Página <strong className="text-foreground">{safePage}</strong> de {totalPages}
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span>
                      Exibindo <strong className="text-foreground">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedRows.length)}</strong> de {sortedRows.length}
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                      <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / página</SelectItem>
                        <SelectItem value="25">25 / página</SelectItem>
                        <SelectItem value="50">50 / página</SelectItem>
                        <SelectItem value="100">100 / página</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => goToPage(safePage - 1)} className={safePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                      </PaginationItem>
                      {visiblePageNumbers.map((p, i) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink isActive={p === safePage} onClick={() => goToPage(p)} className="cursor-pointer">
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext onClick={() => goToPage(safePage + 1)} className={safePage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Criar/Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar contrato" : "Novo contrato fechado"}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nicho *</Label>
              <Select value={editing.nicho} onValueChange={(v) => setEditing({ ...editing, nicho: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NICHOS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Input value={editing.produto || ""} onChange={(e) => setEditing({ ...editing, produto: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Plataforma</Label>
              <Select value={editing.plataforma || ""} onValueChange={(v) => setEditing({ ...editing, plataforma: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{PLATAFORMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Closer</Label>
              <Select value={editing.closer_id || "none"} onValueChange={(v) => setEditing({ ...editing, closer_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SDR</Label>
              <Select value={editing.sdr_id || "none"} onValueChange={(v) => setEditing({ ...editing, sdr_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data da Venda *</Label>
              <Input type="date" value={editing.data_venda} onChange={(e) => setEditing({ ...editing, data_venda: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Data de Pagamento</Label>
              <Input type="date" value={editing.data_pagamento || ""} onChange={(e) => setEditing({ ...editing, data_pagamento: e.target.value || null })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Cliente *</Label>
              <Input value={editing.cliente_nome} onChange={(e) => setEditing({ ...editing, cliente_nome: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Contato Cliente</Label>
              <Input value={editing.cliente_contato || ""} onChange={(e) => setEditing({ ...editing, cliente_contato: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado (UF)</Label>
              <Input maxLength={2} value={editing.cliente_estado || ""} onChange={(e) => setEditing({ ...editing, cliente_estado: e.target.value.toUpperCase() })} />
            </div>
            <div />

            <div className="space-y-1">
              <Label className="text-xs">Valor Total</Label>
              <CurrencyInput value={editing.valor_total} onChange={(v) => setEditing({ ...editing, valor_total: v || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">V. Entrada</Label>
              <CurrencyInput value={editing.valor_entrada} onChange={(v) => setEditing({ ...editing, valor_entrada: v || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">V. Recebido</Label>
              <CurrencyInput value={editing.valor_recebido} onChange={(v) => setEditing({ ...editing, valor_recebido: v || 0 })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nº Parcelas</Label>
              <Input type="number" min={1} value={editing.num_parcelas} onChange={(e) => setEditing({ ...editing, num_parcelas: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">V. Parcela</Label>
              <CurrencyInput value={editing.valor_parcela} onChange={(v) => setEditing({ ...editing, valor_parcela: v || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={editing.forma_pagamento || ""} onValueChange={(v) => setEditing({ ...editing, forma_pagamento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de Pagamento</Label>
              <Select value={editing.tipo_pagamento || ""} onValueChange={(v) => setEditing({ ...editing, tipo_pagamento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex items-end gap-2">
              <div className="flex items-center gap-2 h-10">
                <Switch checked={editing.via_credenciado} onCheckedChange={(v) => setEditing({ ...editing, via_credenciado: v })} />
                <Label className="text-xs">Via Credenciado</Label>
              </div>
            </div>
            <div className="space-y-1">
              {editing.via_credenciado && (
                <>
                  <Label className="text-xs">Nome do Credenciado</Label>
                  <Input value={editing.credenciado_nome || ""} onChange={(e) => setEditing({ ...editing, credenciado_nome: e.target.value })} />
                </>
              )}
            </div>

            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{editing.id ? "Salvar alterações" : "Criar contrato"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}