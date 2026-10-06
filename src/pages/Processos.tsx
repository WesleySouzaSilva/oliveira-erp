import { useState, useEffect, useMemo } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { usePagination } from "@/hooks/usePagination";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import {
  Scale,
  Gavel,
  Clock,
  CheckCircle2,
  Search,
  Plus,
  Save,
  Edit2,
  Trash2,
  MoreVertical,
  Upload,
  ArrowRightLeft,
  FileText,
  X,
  Users,
  Loader2,
  Building2,
  UserCircle2,
  LayoutList,
  KanbanSquare,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { KanbanPipeline } from "@/components/KanbanPipeline";
import { ListSkeleton } from "@/components/ui/loaders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientSearchInput } from "@/components/ClientSearchInput";
import { CurrencyInput } from "@/components/CurrencyInput";
import { PerfilClienteDrawer } from "@/components/processo/PerfilClienteDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getFaseLabel,
  getFaseBadgeColor,
} from "@/data/mockProcessos";
import type { Json } from "@/integrations/supabase/types";

const faseFilters = [
  { value: "todos", label: "Todos" },
  { value: "1", label: "Laudo" },
  { value: "2", label: "Notificação" },
  { value: "3", label: "Resposta Banco" },
  { value: "4", label: "Judicial" },
  { value: "5", label: "Encerrado" },
];

interface RealProcesso {
  id: string;
  fase_atual: string;
  datas_fases: Json;
  status_fases: Json;
  created_at: string;
  // joined from laudos
  produtor: string;
  banco: string;
  contratos: string[];
  saldoDevedor: number | null;
  cultura: string;
  safra: string;
  municipio: string;
  uf: string;
}

function diasNaFaseReal(processo: RealProcesso): number {
  const fases = processo.datas_fases as Record<string, { inicio?: string }>;
  const faseData = fases?.[processo.fase_atual];
  if (!faseData?.inicio) return 0;
  const inicio = new Date(faseData.inicio);
  const hoje = new Date();
  return Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
}

interface NovoProcessoForm {
  produtor: string;
  banco: string;
  contratos: string[]; // multiple contract numbers
  saldoDevedor: number | null;
  cultura: string;
  safra: string;
  municipio: string;
  uf: string;
}

interface ClientContract {
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  valor_total_operacao: number | null;
}

interface BankGroup {
  banco: string;
  contracts: ClientContract[];
  totalValue: number;
}

const emptyForm: NovoProcessoForm = {
  produtor: "",
  banco: "",
  contratos: [],
  saldoDevedor: null,
  cultura: "",
  safra: "",
  municipio: "",
  uf: "",
};

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface ExistingLaudo {
  id: string;
  numero_laudo: string;
  status: string;
  dados_etapa1: any;
  hipoteses_selecionadas: string[] | null;
  dados_etapa3: any;
}

export default function Processos() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NovoProcessoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [clientContracts, setClientContracts] = useState<ClientContract[]>([]);
  const [selectedContractKeys, setSelectedContractKeys] = useState<Set<string>>(new Set());
  const [processos, setProcessos] = useState<RealProcesso[]>([]);
  const [loadingProcessos, setLoadingProcessos] = useState(true);
  const [editingProcessoId, setEditingProcessoId] = useState<string | null>(null);
  const [existingLaudos, setExistingLaudos] = useState<ExistingLaudo[]>([]);
  const [selectedLaudoId, setSelectedLaudoId] = useState<string | null>(null);
  const [laudoSource, setLaudoSource] = useState<"none" | "existing" | "external">("none");
  const [externalPdfFiles, setExternalPdfFiles] = useState<File[]>([]);
  const [changeFaseDialogOpen, setChangeFaseDialogOpen] = useState(false);
  const [changeFaseProcessoId, setChangeFaseProcessoId] = useState<string | null>(null);
  const [changeFaseValue, setChangeFaseValue] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [perfilProdutor, setPerfilProdutor] = useState<string | null>(null);
  const viewMode: "lista" | "kanban" = searchParams.get("view") === "kanban" ? "kanban" : "lista";
  const setViewMode = (mode: "lista" | "kanban") => {
    const next = new URLSearchParams(searchParams);
    if (mode === "kanban") next.set("view", "kanban"); else next.delete("view");
    setSearchParams(next, { replace: true });
  };

  // Load real processes from database
  const loadProcessos = async () => {
    if (!user) return;
    setLoadingProcessos(true);
    const { data, error } = await lerTudo(() => supabase
      .from("processos")
      .select("id, fase_atual, datas_fases, status_fases, created_at, laudo_id, laudos(dados_etapa1)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }));

    if (error) {
      toast.error("Erro ao carregar processos");
      setLoadingProcessos(false);
      return;
    }

    const mapped: RealProcesso[] = (data || []).map((p: any) => {
      const etapa1 = (p.laudos?.dados_etapa1 || {}) as Record<string, any>;
      return {
        id: p.id,
        fase_atual: p.fase_atual,
        datas_fases: p.datas_fases,
        status_fases: p.status_fases,
        created_at: p.created_at,
        produtor:
          etapa1.produtor ||
          etapa1.nomeProdutor ||
          etapa1.nome ||
          etapa1.nome_cliente ||
          "Sem nome",
        banco: etapa1.banco || "",
        contratos: etapa1.contratos || [],
        saldoDevedor: etapa1.saldoDevedor || null,
        cultura: etapa1.cultura || "",
        safra: etapa1.safra || "",
        municipio: etapa1.municipio || "",
        uf: etapa1.uf || "",
      };
    });
    setProcessos(mapped);
    setLoadingProcessos(false);
  };

  useEffect(() => { loadProcessos(); }, [user]);

  // Handle ?cliente=NOME&open=1 — open dialog pre-filled with client name
  useEffect(() => {
    const clienteParam = searchParams.get("cliente");
    const openParam = searchParams.get("open");
    if (clienteParam && openParam === "1" && !dialogOpen) {
      setForm({ ...emptyForm, produtor: clienteParam });
      setDialogOpen(true);
      // Clean URL so it doesn't reopen on subsequent renders
      const next = new URLSearchParams(searchParams);
      next.delete("cliente");
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, dialogOpen, setSearchParams]);

  // Load existing laudos (not linked to any process)
  useEffect(() => {
    if (!user) return;
    const loadLaudos = async () => {
      const { data: procs } = await lerTudo(() => supabase
        .from("processos")
        .select("laudo_id"));
      const usedLaudoIds = new Set((procs || []).map((p: any) => p.laudo_id));

      const { data: laudos } = await supabase
        .from("laudos")
        .select("id, numero_laudo, status, dados_etapa1, hipoteses_selecionadas, dados_etapa3")
        .in("status", ["finalizado", "analise", "rascunho"]);

      if (laudos) {
        setExistingLaudos(laudos.filter(l => !usedLaudoIds.has(l.id)) as ExistingLaudo[]);
      }
    };
    loadLaudos();
  }, [user, processos]);

  // Load all contracts for selected client
  useEffect(() => {
    if (!form.produtor.trim() || form.produtor.length < 2 || !user) {
      setClientContracts([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("contratos_vencimentos")
        .select("nome_cliente, banco, numero_contrato, valor_total_operacao")
        .ilike("nome_cliente", form.produtor.trim());
      if (data) {
        setClientContracts(data);
        setSelectedContractKeys(new Set());
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [form.produtor, user]);

  // Group contracts by bank
  const bankGroups = useMemo<BankGroup[]>(() => {
    const map = new Map<string, ClientContract[]>();
    for (const cc of clientContracts) {
      const bank = cc.banco || "Sem banco";
      const list = map.get(bank) || [];
      list.push(cc);
      map.set(bank, list);
    }
    return Array.from(map.entries()).map(([banco, contracts]) => ({
      banco,
      contracts,
      totalValue: contracts.reduce((sum, c) => sum + (c.valor_total_operacao || 0), 0),
    }));
  }, [clientContracts]);

  const contractKey = (cc: ClientContract, i: number) =>
    `${cc.banco || ""}-${cc.numero_contrato || ""}-${i}`;

  const toggleContract = (key: string, _cc: ClientContract) => {
    const next = new Set(selectedContractKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedContractKeys(next);

    // Update form with selected contracts info
    const selectedContracts = clientContracts.filter((c, i) => next.has(contractKey(c, i)));
    if (selectedContracts.length > 0) {
      const bancos = [...new Set(selectedContracts.map(c => c.banco).filter(Boolean))];
      const contratos = selectedContracts.map(c => c.numero_contrato).filter(Boolean) as string[];
      const totalSaldo = selectedContracts.reduce((s, c) => s + (c.valor_total_operacao || 0), 0);
      setForm(prev => ({
        ...prev,
        banco: bancos.join(", ") || prev.banco,
        contratos: contratos,
        saldoDevedor: totalSaldo || null,
      }));
    } else {
      setForm(prev => ({ ...prev, contratos: [], saldoDevedor: null }));
    }
  };

  const selectAllFromBank = (group: BankGroup) => {
    const next = new Set(selectedContractKeys);
    // Find indices of these contracts in the full list
    const groupKeys: string[] = [];
    clientContracts.forEach((cc, i) => {
      if ((cc.banco || "Sem banco") === group.banco) {
        groupKeys.push(contractKey(cc, i));
      }
    });

    const allSelected = groupKeys.every(k => next.has(k));
    if (allSelected) {
      groupKeys.forEach(k => next.delete(k));
    } else {
      groupKeys.forEach(k => next.add(k));
    }
    setSelectedContractKeys(next);

    // Recalculate form
    const selectedContracts = clientContracts.filter((c, i) => next.has(contractKey(c, i)));
    const bancos = [...new Set(selectedContracts.map(c => c.banco).filter(Boolean))];
    const contratos = selectedContracts.map(c => c.numero_contrato).filter(Boolean) as string[];
    const totalSaldo = selectedContracts.reduce((s, c) => s + (c.valor_total_operacao || 0), 0);
    setForm(prev => ({
      ...prev,
      banco: bancos.join(", ") || prev.banco,
      contratos,
      saldoDevedor: totalSaldo || null,
    }));
  };

  const processosValidos = useMemo(() => {
    return processos.filter((p) => !(p.banco && p.banco.includes(",")));
  }, [processos]);

  const filtered = useMemo(() => {
    return processosValidos
      .filter((p) => {
        if (filter !== "todos" && p.fase_atual !== filter) return false;
        if (search && !p.produtor.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        const nomeCmp = a.produtor.localeCompare(b.produtor, "pt-BR", { sensitivity: "base" });
        if (nomeCmp !== 0) return nomeCmp;
        return (a.banco || "").localeCompare(b.banco || "", "pt-BR", { sensitivity: "base" });
      });
  }, [processosValidos, filter, search]);

  const { paginatedItems: paginatedProcessos, hasMore, totalCount, shownCount, loadMore } = usePagination(filtered, { pageSize: 50 });

  const metrics = useMemo(() => [
    {
      label: "Processos ativos",
      value: processosValidos.filter((p) => Number(p.fase_atual) < 5).length.toString(),
      icon: Scale,
      color: "text-primary",
    },
    {
      label: "Na fase judicial",
      value: processosValidos.filter((p) => p.fase_atual === "4").length.toString(),
      icon: Gavel,
      color: "text-destructive",
    },
    {
      label: "Aguardando banco",
      value: processosValidos.filter((p) => p.fase_atual === "3").length.toString(),
      icon: Clock,
      color: "text-info",
    },
    {
      label: "Encerrados",
      value: processosValidos.filter((p) => p.fase_atual === "5").length.toString(),
      icon: CheckCircle2,
      color: "text-success",
    },
  ], [processosValidos]);

  const handleCreateProcesso = async () => {
    if (!user || !form.produtor.trim() || !form.banco.trim()) {
      toast.error("Preencha ao menos o nome do cliente e o banco.");
      return;
    }

    setSaving(true);
    try {
      let laudoId = selectedLaudoId;

      if (laudoSource === "external" && externalPdfFiles.length > 0) {
        // Upload all external PDFs
        const uploadedUrls: string[] = [];
        for (const file of externalPdfFiles) {
          const filePath = `${user.id}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from("laudos")
            .upload(filePath, file, { contentType: "application/pdf" });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from("laudos").getPublicUrl(filePath);
          uploadedUrls.push(urlData.publicUrl);
        }

        const numeroLaudo = `LA-EXT-${Date.now().toString(36).toUpperCase()}`;
        const { data: laudo, error: laudoErr } = await supabase
          .from("laudos")
          .insert({
            user_id: user.id,
            numero_laudo: numeroLaudo,
            status: "finalizado",
            pdf_url: uploadedUrls[0],
            dados_etapa1: {
              produtor: form.produtor,
              nome: form.produtor,
              banco: form.banco,
              contratos: form.contratos,
              saldoDevedor: form.saldoDevedor,
              cultura: form.cultura,
              safra: form.safra,
              municipio: form.municipio,
              uf: form.uf,
              laudos_externos: uploadedUrls,
            },
          })
          .select("id")
          .single();
        if (laudoErr) throw laudoErr;
        laudoId = laudo.id;
      } else if (!laudoId) {
        // Create a shell laudo with the form data
        const numeroLaudo = `LA-${Date.now().toString(36).toUpperCase()}`;
        const { data: laudo, error: laudoErr } = await supabase
          .from("laudos")
          .insert({
            user_id: user.id,
            numero_laudo: numeroLaudo,
            status: "rascunho",
            dados_etapa1: {
              produtor: form.produtor,
              nome: form.produtor,
              banco: form.banco,
              contratos: form.contratos,
              saldoDevedor: form.saldoDevedor,
              cultura: form.cultura,
              safra: form.safra,
              municipio: form.municipio,
              uf: form.uf,
            },
          })
          .select("id")
          .single();

        if (laudoErr) throw laudoErr;
        laudoId = laudo.id;
      } else {
        // Update existing laudo with process-specific data (banco/contratos)
        await supabase
          .from("laudos")
          .update({
            dados_etapa1: {
              ...(existingLaudos.find(l => l.id === laudoId)?.dados_etapa1 || {}),
              banco: form.banco,
              contratos: form.contratos,
              saldoDevedor: form.saldoDevedor,
            },
          })
          .eq("id", laudoId);
      }

      const isLaudoReady = laudoSource === "existing" || laudoSource === "external";

      const { error: procErr } = await supabase.from("processos").insert({
        user_id: user.id,
        laudo_id: laudoId,
        fase_atual: isLaudoReady ? "2" : "1",
        datas_fases: { "1": { inicio: new Date().toISOString().split("T")[0] } },
        status_fases: {
          "1": isLaudoReady ? "concluida" : "em_andamento",
          "2": isLaudoReady ? "em_andamento" : "pendente",
          "3": "pendente",
          "4": "bloqueada",
          "5": "pendente",
        },
      });

      if (procErr) throw procErr;

      toast.success(`Processo criado para ${form.produtor} × ${form.banco}`);
      setDialogOpen(false);
      setForm(emptyForm);
      setSelectedContractKeys(new Set());
      setSelectedLaudoId(null);
      setLaudoSource("none");
      setExternalPdfFiles([]);
      await loadProcessos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar processo");
    }
    setSaving(false);
  };
  const handleEditProcesso = (processo: RealProcesso) => {
    setEditingProcessoId(processo.id);
    // Find the laudo_id from the raw data
    const rawProc = processos.find(p => p.id === processo.id);
    setForm({
      produtor: processo.produtor,
      banco: processo.banco,
      contratos: processo.contratos,
      saldoDevedor: processo.saldoDevedor,
      cultura: processo.cultura,
      safra: processo.safra,
      municipio: processo.municipio,
      uf: processo.uf,
    });
    setDialogOpen(true);
  };

  const handleUpdateProcesso = async () => {
    if (!user || !editingProcessoId || !form.produtor.trim()) return;

    setSaving(true);
    try {
      // Find the laudo_id for this processo
      const { data: proc } = await supabase
        .from("processos")
        .select("laudo_id")
        .eq("id", editingProcessoId)
        .single();

      if (proc) {
        await supabase
          .from("laudos")
          .update({
            dados_etapa1: {
              produtor: form.produtor,
              banco: form.banco,
              contratos: form.contratos,
              saldoDevedor: form.saldoDevedor,
              cultura: form.cultura,
              safra: form.safra,
              municipio: form.municipio,
              uf: form.uf,
            },
          })
          .eq("id", proc.laudo_id);
      }

      toast.success("Processo atualizado");
      setDialogOpen(false);
      setEditingProcessoId(null);
      setForm(emptyForm);
      await loadProcessos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
    setSaving(false);
  };

  const askConfirm = useConfirm();
  const handleDeleteProcesso = async (processoId: string, produtorName: string) => {
    if (!(await askConfirm({ title: "Excluir processo", description: `Excluir o processo de ${produtorName}? O laudo vinculado também será excluído.`, destructive: true, confirmText: "Excluir" }))) return;

    try {
      // Get laudo_id first
      const { data: proc } = await supabase
        .from("processos")
        .select("laudo_id")
        .eq("id", processoId)
        .single();

      const { error: delErr } = await supabase
        .from("processos")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", processoId);

      if (delErr) throw delErr;

      // Soft-delete the shell laudo
      if (proc?.laudo_id) {
        await supabase.from("laudos").update({ deleted_at: new Date().toISOString() } as any).eq("id", proc.laudo_id);
      }

      toast.success("Processo excluído");
      await loadProcessos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  const handleSaveProcesso = () => {
    if (editingProcessoId) {
      handleUpdateProcesso();
    } else {
      handleCreateProcesso();
    }
  };

  const handleChangeFase = async () => {
    if (!changeFaseProcessoId || !changeFaseValue) return;
    const newFase = changeFaseValue;
    const newStatus: Record<string, string> = {};
    const newDates: Record<string, any> = {};
    for (let f = 1; f <= 5; f++) {
      const key = String(f);
      if (f < Number(newFase)) {
        newStatus[key] = "concluida";
        newDates[key] = newDates[key] || {};
      } else if (f === Number(newFase)) {
        newStatus[key] = "em_andamento";
        newDates[key] = { inicio: new Date().toISOString().split("T")[0] };
      } else {
        newStatus[key] = "pendente";
        newDates[key] = {};
      }
    }
    const { error } = await supabase
      .from("processos")
      .update({
        fase_atual: newFase as "1" | "2" | "3" | "4" | "5",
        status_fases: newStatus,
        datas_fases: newDates,
      })
      .eq("id", changeFaseProcessoId);
    if (error) {
      toast.error("Erro ao alterar fase");
    } else {
      toast.success(`Fase alterada para ${getFaseLabel(Number(newFase) as 1|2|3|4|5)}`);
      setChangeFaseDialogOpen(false);
      await loadProcessos();
    }
  };

  // Bulk import: create one process per client that doesn't have one yet.
  // Uses data from clientes (qualification), contratos_vencimentos (banco/contratos)
  // and existing laudos when available.
  const handleImportFromClients = async () => {
    if (!user || importing) return;
    if (!(await askConfirm({ title: "Gerar processos automaticamente", description: "Será criado um processo separado para cada banco de cada cliente sem processo. Você poderá editá-los depois.", confirmText: "Gerar" }))) return;

    setImporting(true);
    try {
      // 1. Load all data sources in parallel (RLS handles org visibility)
      const [clientesRes, contratosRes, laudosRes, processosRes] = await Promise.all([
        supabase.from("clientes").select("nome, cultura_principal, municipio, uf"),
        lerTudo(() => supabase.from("contratos_vencimentos").select("nome_cliente, banco, numero_contrato, valor_total_operacao")),
        supabase.from("laudos").select("id, dados_etapa1, status").is("deleted_at", null),
        lerTudo(() => supabase.from("processos").select("laudo_id, laudos(dados_etapa1)").is("deleted_at", null)),
      ]);

      const clientes = clientesRes.data || [];
      const contratos = contratosRes.data || [];
      const laudos = (laudosRes.data || []) as any[];
      const processosExist = (processosRes.data || []) as any[];

      // Build set of (cliente|banco) combos that already have a process
      const combosComProcesso = new Set<string>();
      const usedLaudoIds = new Set<string>();
      for (const p of processosExist) {
        const d1 = p.laudos?.dados_etapa1 || {};
        const nome = (d1.produtor || d1.nome || "").toString().trim().toLowerCase();
        const banco = (d1.banco || "").toString().trim().toLowerCase();
        if (nome) combosComProcesso.add(`${nome}|${banco}`);
        if (p.laudo_id) usedLaudoIds.add(p.laudo_id);
      }

      // Index laudos by (client|bank) — only laudos not yet attached to a process
      const laudosByComboLookup = new Map<string, any>();
      for (const l of laudos) {
        if (usedLaudoIds.has(l.id)) continue;
        const nome = (l.dados_etapa1?.produtor || l.dados_etapa1?.nome || "").toString().trim().toLowerCase();
        const banco = (l.dados_etapa1?.banco || "").toString().trim().toLowerCase();
        if (!nome) continue;
        const key = `${nome}|${banco}`;
        if (!laudosByComboLookup.has(key)) laudosByComboLookup.set(key, l);
      }

      // Index contracts by (client|bank) so each bank becomes its own process
      const contratosByCombo = new Map<string, { displayName: string; banco: string; contratos: typeof contratos }>();
      for (const c of contratos) {
        const displayName = c.nome_cliente.trim();
        const nome = displayName.toLowerCase();
        const bancoDisplay = (c.banco || "Sem banco").trim();
        const banco = bancoDisplay.toLowerCase();
        const key = `${nome}|${banco}`;
        const entry = contratosByCombo.get(key) || { displayName, banco: bancoDisplay, contratos: [] as typeof contratos };
        entry.contratos.push(c);
        contratosByCombo.set(key, entry);
      }

      // Build candidate set: one entry per (client|bank).
      // - From contratos: each (cliente, banco) combo
      // - From clientes without contracts: a single "Sem banco" combo as fallback
      const candidatos = new Map<string, { displayName: string; banco: string }>();
      for (const [key, info] of contratosByCombo.entries()) {
        candidatos.set(key, { displayName: info.displayName, banco: info.banco });
      }
      for (const c of clientes as any[]) {
        if (!c.nome) continue;
        const nome = c.nome.trim().toLowerCase();
        // Only add a "no bank" entry if this client has no contracts at all
        const hasContracts = Array.from(contratosByCombo.keys()).some((k) => k.startsWith(`${nome}|`));
        if (!hasContracts) {
          candidatos.set(`${nome}|`, { displayName: c.nome.trim(), banco: "" });
        }
      }

      // Filter out combos that already have a process
      const aGerar = Array.from(candidatos.entries())
        .filter(([key]) => !combosComProcesso.has(key))
        .sort((a, b) =>
          a[1].displayName.localeCompare(b[1].displayName, "pt-BR", { sensitivity: "base" })
        );

      if (aGerar.length === 0) {
        toast.info("Todos os clientes/bancos já possuem processo cadastrado.");
        setImporting(false);
        return;
      }

      // Build a quick lookup for cliente qualification
      const clienteByNome = new Map<string, any>();
      for (const c of clientes as any[]) {
        if (c.nome) clienteByNome.set(c.nome.trim().toLowerCase(), c);
      }

      let criados = 0;
      let erros = 0;

      for (const [key, info] of aGerar) {
        const { displayName, banco: bancoDisplay } = info;
        try {
          const nomeKey = key.split("|")[0];
          const cli = clienteByNome.get(nomeKey);
          const comboInfo = contratosByCombo.get(key);
          const ctrs = comboInfo?.contratos || [];
          const laudoExistente = laudosByComboLookup.get(key);

          const numerosContrato = ctrs.map(c => c.numero_contrato).filter(Boolean) as string[];
          const totalSaldo = ctrs.reduce((s, c) => s + (c.valor_total_operacao || 0), 0);

          let laudoId: string;

          if (laudoExistente) {
            laudoId = laudoExistente.id;
          } else {
            // Create shell laudo with all aggregated data
            const numeroLaudo = `LA-${Date.now().toString(36).toUpperCase()}-${criados}`;
            const { data: laudo, error: laudoErr } = await supabase
              .from("laudos")
              .insert({
                user_id: user.id,
                numero_laudo: numeroLaudo,
                status: "rascunho",
                dados_etapa1: {
                  produtor: displayName,
                  nome: displayName,
                  banco: bancoDisplay,
                  contratos: numerosContrato,
                  saldoDevedor: totalSaldo || null,
                  cultura: cli?.cultura_principal || "",
                  municipio: cli?.municipio || "",
                  uf: cli?.uf || "",
                },
              })
              .select("id")
              .single();
            if (laudoErr) throw laudoErr;
            laudoId = laudo.id;
          }

          const isLaudoFinalizado = laudoExistente?.status === "finalizado";

          const { error: procErr } = await supabase.from("processos").insert({
            user_id: user.id,
            laudo_id: laudoId,
            fase_atual: isLaudoFinalizado ? "2" : "1",
            datas_fases: { "1": { inicio: new Date().toISOString().split("T")[0] } },
            status_fases: {
              "1": isLaudoFinalizado ? "concluida" : "em_andamento",
              "2": isLaudoFinalizado ? "em_andamento" : "pendente",
              "3": "pendente",
              "4": "bloqueada",
              "5": "pendente",
            },
          });
          if (procErr) throw procErr;
          criados++;
        } catch (err) {
          console.error(`Erro ao criar processo para ${displayName} × ${bancoDisplay}:`, err);
          erros++;
        }
      }

      if (criados > 0) {
        toast.success(`${criados} processo(s) criado(s) com sucesso${erros > 0 ? ` (${erros} falhas)` : ""}.`);
        await loadProcessos();
      } else {
        toast.error("Nenhum processo foi criado. Verifique os dados dos clientes.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar clientes");
    }
    setImporting(false);
  };

  return (
    <AppLayout>
      <PageHeader
        icon={Gavel}
        title="Processos de Alongamento"
        subtitle="Acompanhe cada pedido de prorrogação do laudo à decisão final."
        breadcrumb={[{ label: "Agro" }, { label: "Processos" }]}
        actions={
          <>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="tablist" aria-label="Visualização">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "lista"}
              onClick={() => setViewMode("lista")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                viewMode === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Lista
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                viewMode === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KanbanSquare className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>
          <Button variant="outline" onClick={handleImportFromClients} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Importar de Clientes
          </Button>
          <Button variant="outline" asChild>
            <Link to="/processos/sem-cliente">
              <Users className="w-4 h-4" /> Sem cliente vinculado
            </Link>
          </Button>
          <Button onClick={() => { setForm(emptyForm); setSelectedContractKeys(new Set()); setSelectedLaudoId(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4" /> Novo Processo
          </Button>
          </>
        }
      />

      {viewMode === "kanban" ? (
        <KanbanPipeline />
      ) : (
        <>
      {/* Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        {metrics.map((m) => (
          <div key={m.label} className="bg-card rounded-lg p-4 shadow-card border border-border">
            <div className="flex items-center gap-2">
              <m.icon className={`w-4 h-4 ${m.color}`} />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {m.label}
              </span>
            </div>
            <p className="text-3xl font-display font-bold mt-2 text-foreground">{m.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por produtor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {faseFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Process cards */}
      <div className="space-y-3">
        {loadingProcessos ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-6 bg-card/40 border border-dashed border-border rounded-xl">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mb-5">
              <Scale className="w-9 h-9 text-primary/60" />
            </div>
            <h3 className="text-lg font-display font-semibold text-foreground mb-1">Nenhum processo por aqui</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Quando você criar um processo de reestruturação, ele aparecerá nesta lista com a fase atual e o tempo decorrido.
            </p>
          </div>
        ) : (
          paginatedProcessos.map((processo, i) => {
            const dias = diasNaFaseReal(processo);
            const faseNum = Number(processo.fase_atual) as 1 | 2 | 3 | 4 | 5;

            return (
              <motion.div
                key={processo.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="bg-card rounded-lg border border-border shadow-card hover:shadow-card-hover transition-all duration-200 p-5 group">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <Link to={`/processos/${processo.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                          {processo.produtor.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div>
                          <p data-private className="text-sm font-semibold text-foreground">{processo.produtor}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase tracking-wide border border-primary/20">
                              <Building2 className="w-3.5 h-3.5" />
                              {processo.banco || "Sem banco"}
                            </span>
                            {processo.contratos.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {processo.contratos.length} contrato(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {processo.cultura && <span>{processo.cultura}</span>}
                        {processo.safra && <span>· Safra {processo.safra}</span>}
                        {processo.municipio && <span>· {processo.municipio}/{processo.uf}</span>}
                        {processo.saldoDevedor != null && processo.saldoDevedor > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-foreground">{formatBRL(processo.saldoDevedor)}</span>
                          </>
                        )}
                      </div>
                    </Link>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`status-badge ${getFaseBadgeColor(faseNum)}`}>
                          {getFaseLabel(faseNum)}
                        </span>
                        {dias > 0 && faseNum < 5 && (
                          <p className="text-xs text-muted-foreground mt-1">{dias} dias na fase</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPerfilProdutor(processo.produtor)}>
                            <UserCircle2 className="w-3.5 h-3.5 mr-2" /> Perfil do cliente
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditProcesso(processo)}>
                            <Edit2 className="w-3.5 h-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setChangeFaseProcessoId(processo.id);
                            setChangeFaseValue(processo.fase_atual);
                            setChangeFaseDialogOpen(true);
                          }}>
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Alterar Fase
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteProcesso(processo.id, processo.produtor)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <LoadMoreButton
        shownCount={shownCount}
        totalCount={totalCount}
        hasMore={hasMore}
        onLoadMore={loadMore}
        label="processos"
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setSelectedContractKeys(new Set());
          setClientContracts([]);
          setEditingProcessoId(null);
          setSelectedLaudoId(null);
          setLaudoSource("none");
          setExternalPdfFiles([]);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProcessoId ? "Editar Processo" : "Novo Processo de Alongamento"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Crie um processo por banco. Selecione os contratos do mesmo banco para notificar na mesma oportunidade.
          </p>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome do Cliente / Produtor *</Label>
              <ClientSearchInput
                value={form.produtor}
                onChange={(v) => setForm({ ...form, produtor: v })}
                onSelectClient={(c) =>
                  setForm({
                    ...form,
                    produtor: c.nome_cliente,
                  })
                }
                placeholder="Digite para buscar clientes existentes..."
              />
            </div>

            {/* Laudo source selector */}
            {!editingProcessoId && (
              <div className="grid gap-2">
                <Label>Origem do Laudo</Label>
                <Select
                  value={laudoSource}
                  onValueChange={(v: "none" | "existing" | "external") => {
                    setLaudoSource(v);
                    setSelectedLaudoId(null);
                    setExternalPdfFiles([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Criar laudo no app</SelectItem>
                    {existingLaudos.length > 0 && (
                      <SelectItem value="existing">Vincular laudo existente</SelectItem>
                    )}
                    <SelectItem value="external">Anexar laudo externo (PDF)</SelectItem>
                  </SelectContent>
                </Select>

                {laudoSource === "existing" && (
                  <>
                    <Select
                      value={selectedLaudoId || ""}
                      onValueChange={(v) => {
                        setSelectedLaudoId(v);
                        const laudo = existingLaudos.find(l => l.id === v);
                        if (laudo) {
                          const d = (laudo.dados_etapa1 || {}) as Record<string, any>;
                          setForm(prev => ({
                            ...prev,
                            produtor: d.nome || d.produtor || prev.produtor,
                            cultura: d.cultura || prev.cultura,
                            safra: d.safra || prev.safra,
                            municipio: d.municipio || prev.municipio,
                            uf: d.uf || prev.uf,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o laudo" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingLaudos.map(l => {
                          const d = (l.dados_etapa1 || {}) as Record<string, any>;
                          const nome = d.nome || d.produtor || "Sem nome";
                          return (
                            <SelectItem key={l.id} value={l.id}>
                              {l.numero_laudo} — {nome} ({l.status})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedLaudoId && (
                      <p className="text-xs text-success">✓ O processo começará na Fase 2 (Notificação) com o laudo já vinculado.</p>
                    )}
                  </>
                )}

                {laudoSource === "external" && (
                  <div className="space-y-2">
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors cursor-pointer"
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-accent", "bg-accent/5"); }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-accent", "bg-accent/5"); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("border-accent", "bg-accent/5");
                        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
                        if (droppedFiles.length > 0) {
                          setExternalPdfFiles(prev => [...prev, ...droppedFiles]);
                        }
                      }}
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".pdf";
                        input.multiple = true;
                        input.onchange = () => {
                          if (input.files) {
                            setExternalPdfFiles(prev => [...prev, ...Array.from(input.files!)]);
                          }
                        };
                        input.click();
                      }}
                    >
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">Arraste vários PDFs aqui ou clique para selecionar</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Você pode anexar quantos arquivos quiser (Laudo de Perda de Safra, Capacidade de Pagamento, anexos, etc.)
                      </p>
                    </div>
                    {externalPdfFiles.length > 0 && (
                      <div className="space-y-1.5">
                        {externalPdfFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{file.name}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExternalPdfFiles(prev => prev.filter((_, i) => i !== idx)); }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <p className="text-xs text-success">✓ O processo começará na Fase 2 com {externalPdfFiles.length} laudo(s) externo(s) anexado(s).</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Contracts grouped by bank */}
            {bankGroups.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contratos de {form.produtor} — selecione os que deseja incluir
                </p>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {bankGroups.map((group) => {
                    const groupKeys: string[] = [];
                    clientContracts.forEach((cc, i) => {
                      if ((cc.banco || "Sem banco") === group.banco) {
                        groupKeys.push(contractKey(cc, i));
                      }
                    });
                    const allSelected = groupKeys.length > 0 && groupKeys.every(k => selectedContractKeys.has(k));
                    const someSelected = groupKeys.some(k => selectedContractKeys.has(k));

                    return (
                      <div key={group.banco} className="rounded-md border border-border bg-card overflow-hidden">
                        {/* Bank header */}
                        <button
                          type="button"
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                            someSelected ? "bg-accent/10 border-b border-accent/20" : "hover:bg-muted/50"
                          }`}
                          onClick={() => selectAllFromBank(group)}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center text-xs transition-colors ${
                              allSelected
                                ? "bg-accent border-accent text-accent-foreground"
                                : someSelected
                                  ? "bg-accent/30 border-accent"
                                  : "border-muted-foreground/30"
                            }`}>
                              {allSelected && "✓"}
                              {someSelected && !allSelected && "—"}
                            </div>
                            <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-semibold text-sm text-foreground">{group.banco}</span>
                            <span className="text-xs text-muted-foreground">({group.contracts.length} contrato{group.contracts.length > 1 ? "s" : ""})</span>
                          </div>
                          {group.totalValue > 0 && (
                            <span className="text-xs font-medium text-muted-foreground">
                              Total: {formatBRL(group.totalValue)}
                            </span>
                          )}
                        </button>
                        {/* Individual contracts */}
                        <div className="divide-y divide-border">
                          {group.contracts.map((cc) => {
                            const idx = clientContracts.indexOf(cc);
                            const key = contractKey(cc, idx);
                            const isSelected = selectedContractKeys.has(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-sm transition-colors ${
                                  isSelected ? "bg-accent/5" : "hover:bg-muted/30"
                                }`}
                                onClick={() => toggleContract(key, cc)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] transition-colors ${
                                    isSelected
                                      ? "bg-accent border-accent text-accent-foreground"
                                      : "border-muted-foreground/30"
                                  }`}>
                                    {isSelected && "✓"}
                                  </div>
                                  <span className="text-muted-foreground font-mono text-xs">
                                    {cc.numero_contrato || "Sem número"}
                                  </span>
                                </div>
                                {cc.valor_total_operacao != null && cc.valor_total_operacao > 0 && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatBRL(cc.valor_total_operacao)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedContractKeys.size > 0 && (
                  <div className="flex items-center justify-between px-1 pt-1 border-t border-border">
                    <span className="text-xs text-accent font-medium">
                      {selectedContractKeys.size} contrato{selectedContractKeys.size > 1 ? "s" : ""} selecionado{selectedContractKeys.size > 1 ? "s" : ""}
                    </span>
                    {form.saldoDevedor != null && form.saldoDevedor > 0 && (
                      <span className="text-xs font-semibold text-foreground">
                        Saldo total: {formatBRL(form.saldoDevedor)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Banco *</Label>
                <Input
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  placeholder="Ex: Banco do Brasil"
                />
              </div>
              <div className="grid gap-2">
                <Label>Nº Contratos</Label>
                <Input
                  value={form.contratos.join(", ")}
                  onChange={(e) => setForm({ ...form, contratos: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="Preenchido automaticamente"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Saldo Devedor</Label>
                <CurrencyInput
                  value={form.saldoDevedor}
                  onChange={(v) => setForm({ ...form, saldoDevedor: v })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Cultura</Label>
                <Input
                  value={form.cultura}
                  onChange={(e) => setForm({ ...form, cultura: e.target.value })}
                  placeholder="Ex: Soja"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Safra</Label>
                <Input
                  value={form.safra}
                  onChange={(e) => setForm({ ...form, safra: e.target.value })}
                  placeholder="2024/2025"
                />
              </div>
              <div className="grid gap-2">
                <Label>Município</Label>
                <Input
                  value={form.municipio}
                  onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>UF</Label>
                <Select value={form.uf} onValueChange={(v) => setForm({ ...form, uf: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProcesso} disabled={saving || !form.produtor.trim() || !form.banco.trim()}>
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : editingProcessoId ? "Salvar" : "Criar Processo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Phase Dialog */}
      <Dialog open={changeFaseDialogOpen} onOpenChange={setChangeFaseDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Fase do Processo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label>Nova fase</Label>
            <Select value={changeFaseValue} onValueChange={setChangeFaseValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([1, 2, 3, 4, 5] as const).map(f => (
                  <SelectItem key={f} value={String(f)}>
                    Fase {f} — {getFaseLabel(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Fases anteriores serão marcadas como concluídas automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeFaseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangeFase}>
              <ArrowRightLeft className="w-4 h-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PerfilClienteDrawer
        open={!!perfilProdutor}
        onOpenChange={(v) => { if (!v) setPerfilProdutor(null); }}
        produtor={perfilProdutor || ""}
      />
        </>
      )}
    </AppLayout>
  );
}
