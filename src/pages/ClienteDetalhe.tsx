import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Plus, Send, FileText, Building2, CalendarDays, Trash2, HardDrive, ClipboardList, Paperclip, Download, X, Scale, ChevronRight, Pencil, PenLine, FilePlus, User, Star, Check, Ban, AlertTriangle, NotebookPen, MessageSquare, LayoutDashboard, Gavel, ShieldCheck, ShieldX } from "lucide-react";
import { EditClienteDialog } from "@/components/EditClienteDialog";
import { EditClientePerfilDialog } from "@/components/EditClientePerfilDialog";
import { LaudoActionDialog } from "@/components/LaudoActionDialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { labelTipoProcesso } from "@/data/onboardingAgroTemplate";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useTrackRecentItem } from "@/hooks/useRecentItems";
import { PinButton } from "@/components/PinButton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClienteDrive } from "@/components/ClienteDrive";
import { PainelMensageria } from "@/components/mensagens/PainelMensageria";
import { notifyOrg } from "@/lib/orgNotify";
import { formatDateBR } from "@/lib/utils";
import { RichTextarea, RichText } from "@/components/RichTextarea";
import { PerfilCliente360 } from "@/components/cliente/PerfilCliente360";
import { PortalClienteConviteButton } from "@/components/cliente/PortalClienteConviteButton";
import { VisivelClienteToggle } from "@/components/portal/VisivelClienteToggle";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ClienteOperacoesTab } from "@/components/radar/ClienteOperacoesTab";
import { Radar as RadarIcon } from "lucide-react";
import { validarArquivos } from "@/lib/uploadLimits";
import { rotuloUrgencia } from "@/lib/urgencia";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import type { EscopoBanco } from "@/hooks/useOperacoesCredito";


const statusCliente = [
  { value: "prospeccao", label: "Prospecção", color: "bg-muted text-muted-foreground" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-primary/15 text-primary" },
  { value: "laudo_concluido", label: "Laudo Concluído", color: "bg-accent/15 text-accent" },
  { value: "notificado", label: "Notificado", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  { value: "aguardando", label: "Aguardando Resposta", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  { value: "judicial", label: "Via Judicial", color: "bg-destructive/15 text-destructive" },
  { value: "encerrado", label: "Encerrado", color: "bg-green-500/15 text-green-700 dark:text-green-400" },
];

const tiposAtividade = [
  { value: "atendimento", label: "Atendimento" },
  { value: "reuniao", label: "Reunião" },
  { value: "visita", label: "Visita Técnica" },
  { value: "protocolo", label: "Protocolo" },
  { value: "documento", label: "Documento Enviado" },
  { value: "ligacao", label: "Ligação" },
  { value: "outro", label: "Outro" },
];

interface Atividade {
  id: string;
  descricao: string;
  tipo: string;
  created_at: string;
  data_atividade: string | null;
  anexo_url: string | null;
  anexo_nome: string | null;
  anexos_urls?: string[] | null;
  anexos_nomes?: string[] | null;
  banco?: string | null;
  user_id?: string | null;
}

interface Contrato {
  id: string;
  banco: string | null;
  numero_contrato: string | null;
  valor_total_operacao: number | null;
  valor_parcela: number | null;
  primeiro_vencimento: string | null;
  vencimento_proxima_parcela: string | null;
  vencimento_ultima_parcela: string | null;
}

interface EscopoBancoRegistro {
  id: string;
  banco: string;
  escopo: EscopoBanco;
}

const normBanco = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function ClienteDetalhe() {
  const { nome } = useParams<{ nome: string }>();
  const nomeCliente = decodeURIComponent(nome || "");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId, members } = useOrgMembers();
  const { isAdmin } = usePapelRadar();
  useTrackRecentItem(
    nomeCliente
      ? { type: "cliente", id: nomeCliente, title: nomeCliente, subtitle: "Cliente", path: `/clientes/${encodeURIComponent(nomeCliente)}` }
      : null
  );
  const nomePorUserId = new Map((members || []).map((m) => [m.user_id, m.nome || "Membro"] as const));
  const labelAutor = (uid?: string | null) => (uid ? nomePorUserId.get(uid) || "Membro" : "Membro");

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [processosCliente, setProcessosCliente] = useState<any[]>([]);
  const [movimentacoesCliente, setMovimentacoesCliente] = useState<any[]>([]);
  const [tarefasCliente, setTarefasCliente] = useState<any[]>([]);
  const [atendimentosCliente, setAtendimentosCliente] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"perfil360" | "atividades" | "drive" | "processos" | "atendimentos" | "conversas" | "operacoes">("perfil360");
  const [editOpen, setEditOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  // Link do Radar crítico: abre direto o cadastro na seção "Bancos contratados".
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("editar") === "bancos") {
      setPerfilOpen(true);
      const p = new URLSearchParams(searchParams);
      p.delete("editar");
      setSearchParams(p, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [laudoDialogOpen, setLaudoDialogOpen] = useState(false);
  const [clientePerfil, setClientePerfil] = useState<any>(null);
  const [escoposBanco, setEscoposBanco] = useState<EscopoBancoRegistro[]>([]);

  // Processos e cobranças em andamento contra o cliente (módulo de execução).
  const [execTipos, setExecTipos] = useState<string[]>([]);
  // Entrada urgente: operações que chegaram com o vencimento em cima.
  const [opsUrgentes, setOpsUrgentes] = useState<any[]>([]);

  // New activity form
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoTipo, setNovoTipo] = useState("atendimento");
  const [dataAtividade, setDataAtividade] = useState<Date>(new Date());
  const [novoBanco, setNovoBanco] = useState<string>("");
  const [anexosFiles, setAnexosFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [statusAtual, setStatusAtual] = useState("prospeccao");

  // Edit activity state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editTipo, setEditTipo] = useState("atendimento");
  const [editBanco, setEditBanco] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [editAnexosFiles, setEditAnexosFiles] = useState<File[]>([]);
  const [editAnexosUrls, setEditAnexosUrls] = useState<string[]>([]);
  const [editAnexosNomes, setEditAnexosNomes] = useState<string[]>([]);

  // Filter by bank (Geral + bancos dos contratos)
  const [bancoFiltro, setBancoFiltro] = useState<string>("Geral");

  const loadData = async () => {
    if (!user || !nomeCliente) return;
    setLoading(true);

    const [atRes, ctRes, laudosRes, tarefasRes, perfilRes, atendRes] = await Promise.all([
      supabase
        .from("atividades_clientes")
        .select("*").is("deleted_at", null)
        .ilike("nome_cliente", nomeCliente)
        .order("data_atividade", { ascending: false, nullsFirst: false }),
      supabase
        .from("contratos_vencimentos")
        .select("id, banco, numero_contrato, valor_total_operacao, valor_parcela, primeiro_vencimento, vencimento_proxima_parcela, vencimento_ultima_parcela")
        .ilike("nome_cliente", nomeCliente),
      supabase
        .from("laudos")
        .select("id, numero_laudo, dados_etapa1")
        .order("created_at", { ascending: false }),
      supabase
        .from("tarefas" as any)
        .select("*")
        .ilike("nome_cliente" as any, nomeCliente)
        .order("data_vencimento", { ascending: true }),
      supabase
        .from("clientes" as any)
        .select("*")
        .eq("nome", nomeCliente)
        .maybeSingle(),
      supabase
        .from("atendimentos_notas")
        .select("id, cliente_nome, titulo, origem, status, notas_brutas, relatorio_cliente, created_at, cliente_id, visivel_cliente")
        .ilike("cliente_nome", nomeCliente)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (atRes.data) {
      // Sort by data_atividade descending, fallback to created_at
      const sorted = [...(atRes.data as Atividade[])].sort((a, b) => {
        const dateA = a.data_atividade || a.created_at;
        const dateB = b.data_atividade || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      setAtividades(sorted);
      const withStatus = atRes.data.find((a: any) => a.status_cliente);
      if (withStatus) setStatusAtual((withStatus as any).status_cliente);
    }
    if (tarefasRes.data) setTarefasCliente(tarefasRes.data as any[]);
    if (perfilRes.data) {
      setClientePerfil(perfilRes.data);
      const { data: execs } = await supabase
        .from("cliente_execucoes")
        .select("tipo")
        .eq("cliente_id", (perfilRes.data as any).id)
        .eq("status", "ativo");
      setExecTipos(Array.from(new Set(((execs as any[]) || []).map((e) => e.tipo))));
    }
    if (atendRes.data) setAtendimentosCliente(atendRes.data as any[]);

    // Contratos = contratos_vencimentos + operações de crédito (Radar / fechamento)
    const listaCt: any[] = [...(ctRes.data || [])];
    const perfilId = (perfilRes.data as any)?.id;
    if (perfilId) {
      const [{ data: ops }, { data: escopos }] = await Promise.all([
        supabase
          .from("operacoes_credito" as any)
          .select("id, banco, numero, vence_em, saldo_devedor, entrada_urgente, notificado_em, pendencia_completar, pendencia_prazo")
          .eq("cliente_id", perfilId)
          .is("deleted_at", null),
        supabase
          .from("cliente_banco_escopo")
          .select("id, banco, escopo")
          .eq("cliente_id", perfilId),
      ]);
      setEscoposBanco((((escopos as any[]) || []) as EscopoBancoRegistro[]));
      setOpsUrgentes(((ops || []) as any[]).filter((o) => o.entrada_urgente));
      for (const o of (ops || []) as any[]) {
        if (listaCt.some((c) => (c.numero_contrato || "").trim() === (o.numero || "").trim())) continue;
        listaCt.push({
          id: `op-${o.id}`,
          banco: o.banco,
          numero_contrato: o.numero,
          valor_total_operacao: o.saldo_devedor,
          valor_parcela: null,
          primeiro_vencimento: null,
          vencimento_proxima_parcela: o.vence_em,
          vencimento_ultima_parcela: null,
        });
      }
    } else {
      setEscoposBanco([]);
    }
    setContratos(
      listaCt.sort((a, b) => (a.banco || "").localeCompare(b.banco || "", "pt-BR", { sensitivity: "base" })),
    );

    // Find processes linked to this client via laudos
    const clienteLaudos = (laudosRes.data || []).filter((l: any) => {
      const d = l.dados_etapa1 as any;
      return d?.nome?.toLowerCase().includes(nomeCliente.toLowerCase()) ||
        d?.nomeProdutor?.toLowerCase().includes(nomeCliente.toLowerCase());
    });

    if (clienteLaudos.length > 0) {
      const laudoIds = clienteLaudos.map((l: any) => l.id);
      const { data: procs } = await supabase
        .from("processos")
        .select("*")
        .in("laudo_id", laudoIds)
        .order("created_at", { ascending: false });

      if (procs && procs.length > 0) {
        const laudoMap = new Map(clienteLaudos.map((l: any) => [l.id, l]));
        const contratoBancos = (ctRes.data || []).map((c: any) => c.banco).filter(Boolean);
        const enriched = procs.map((p: any) => {
          const laudo = laudoMap.get(p.laudo_id) as any;
          const banco =
            (p.dados_fase2 as any)?.banco ||
            laudo?.dados_etapa1?.banco ||
            contratoBancos[0] ||
            "—";
          const f4 = (p.dados_fase4 as any) || {};
          const numero_processo =
            f4.numeroProcessoCnj || f4.numero_processo || f4.numero || null;
          return { ...p, banco, numero_processo };
        });
        setProcessosCliente(enriched);
        const procIds = procs.map((p: any) => p.id);
        const { data: movs } = await supabase
          .from("movimentacoes")
          .select("*")
          .in("processo_id", procIds)
          .order("created_at", { ascending: false });
        setMovimentacoesCliente(movs || []);
      } else {
        setProcessosCliente([]);
        setMovimentacoesCliente([]);
      }
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, nomeCliente]);

  const primeiroContratoPorBanco = useMemo(() => {
    const mapa = new Map<string, string>();
    contratos.forEach((c) => {
      const chave = normBanco(c.banco || "");
      if (chave && !mapa.has(chave)) mapa.set(chave, c.id);
    });
    return mapa;
  }, [contratos]);

  const registroDoBanco = (banco: string) => escoposBanco.find((e) => normBanco(e.banco) === normBanco(banco)) ?? null;
  const bancoContratado = (banco: string) => registroDoBanco(banco)?.escopo === "contratado";


  const askConfirm = useConfirm();
  const handleRemoveProcesso = async (procId: string) => {
    if (!(await askConfirm({ title: "Remover processo", description: "Movimentações e tarefas vinculadas permanecerão no histórico, mas o processo será arquivado.", destructive: true, confirmText: "Remover" }))) return;
    try {
      const { error } = await supabase
        .from("processos")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", procId);
      if (error) throw error;
      toast.success("Processo removido");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover processo");
    }
  };

  const handleAddAtividade = async () => {
    if (!novaDescricao.trim()) { toast.error("Descreva a atividade realizada"); return; }
    setSalvando(true);
    try {
      const anexosUrls: string[] = [];
      const anexosNomes: string[] = [];

      const erroArquivo = validarArquivos(anexosFiles);
      if (erroArquivo) throw new Error(erroArquivo);
      for (const file of anexosFiles) {
        const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const safeCliente = nomeCliente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user!.id}/${safeCliente}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("cliente-drive").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw new Error(`Erro ao enviar anexo: ${file.name} — ${upErr.message}`);
        anexosUrls.push(path);
        anexosNomes.push(file.name);
      }

      const { error } = await supabase.from("atividades_clientes").insert({
        user_id: user!.id,
        organizacao_id: orgId,
        nome_cliente: nomeCliente,
        descricao: novaDescricao.trim(),
        tipo: novoTipo,
        data_atividade: format(dataAtividade, "yyyy-MM-dd"),
        banco: novoBanco || null,
        anexo_url: anexosUrls[0] ?? null,
        anexo_nome: anexosNomes[0] ?? null,
        anexos_urls: anexosUrls,
        anexos_nomes: anexosNomes,
      } as any);
      if (error) throw error;
      toast.success("Atividade registrada");
      await notifyOrg({
        organizacaoId: orgId,
        authorUserId: user!.id,
        mensagem: `${labelAutor(user!.id)} registrou uma atividade em ${nomeCliente}${novoBanco ? ` · ${novoBanco}` : ""}`,
        tipo: "info",
      });
      setNovaDescricao("");
      setNovoTipo("atendimento");
      setDataAtividade(new Date());
      setNovoBanco("");
      setAnexosFiles([]);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("atividades_clientes").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else setAtividades((prev) => prev.filter((a) => a.id !== id));
  };

  const handleEditSave = async (id: string) => {
    if (!editDescricao.trim()) { toast.error("A descrição não pode ficar vazia"); return; }
    setEditSaving(true);
    try {
      const novasUrls: string[] = [];
      const novosNomes: string[] = [];
      const erroArquivo = validarArquivos(editAnexosFiles);
      if (erroArquivo) throw new Error(erroArquivo);
      for (const file of editAnexosFiles) {
        const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const safeCliente = nomeCliente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user!.id}/${safeCliente}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("cliente-drive").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw new Error(`Erro ao enviar anexo: ${file.name} — ${upErr.message}`);
        novasUrls.push(path);
        novosNomes.push(file.name);
      }
      const finalUrls = [...editAnexosUrls, ...novasUrls];
      const finalNomes = [...editAnexosNomes, ...novosNomes];
      const { error } = await supabase
        .from("atividades_clientes")
        .update({
          descricao: editDescricao.trim(),
          tipo: editTipo,
          banco: editBanco || null,
          anexos_urls: finalUrls,
          anexos_nomes: finalNomes,
          anexo_url: finalUrls[0] ?? null,
          anexo_nome: finalNomes[0] ?? null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Atividade atualizada");
      setEditingId(null);
      setEditAnexosFiles([]);
      setEditAnexosUrls([]);
      setEditAnexosNomes([]);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDownloadAnexo = async (path: string, nome: string) => {
    const { data } = await supabase.storage.from("cliente-drive").createSignedUrl(path, 300);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = nome;
      a.target = "_blank";
      a.click();
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const fmtCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  // Bancos disponíveis a partir dos contratos + bancos já registrados em atividades
  const bancosCliente = Array.from(
    new Set(
      [
        ...contratos.map((c) => c.banco || "").filter(Boolean),
        ...atividades.map((a) => a.banco || "").filter(Boolean),
      ] as string[]
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

  // Atividades filtradas pela aba de banco selecionada
  const atividadesFiltradas =
    bancoFiltro === "Geral"
      ? atividades
      : atividades.filter((a) => (a.banco || "").toLowerCase() === bancoFiltro.toLowerCase());

  // Group activities by month, sorted chronologically (descending)
  const atividadesPorMes = atividadesFiltradas.reduce<Record<string, Atividade[]>>((acc, a) => {
    const dateRef = a.data_atividade || a.created_at;
    const d = new Date(dateRef);
    const key = format(d, "yyyy-MM");
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  // Sort month keys descending
  const sortedMonthKeys = Object.keys(atividadesPorMes).sort((a, b) => b.localeCompare(a));

  const adimplenciaInfo: Record<string, { label: string; icon: any; color: string }> = {
    adimplente: { label: "Adimplente", icon: Check, color: "text-green-600 bg-green-500/10" },
    inadimplente: { label: "Inadimplente", icon: Ban, color: "text-destructive bg-destructive/10" },
    parcial: { label: "Parcialmente Adimplente", icon: AlertTriangle, color: "text-yellow-600 bg-yellow-500/10" },
  };

  const clienteAdimplencia = clientePerfil?.status_adimplencia || "adimplente";
  const adInfo = adimplenciaInfo[clienteAdimplencia] || adimplenciaInfo.adimplente;
  const AdimplenciaIcon = adInfo.icon;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <span>Agro</span>
          <ChevronRight className="w-3 h-3 opacity-50" />
          <Link to="/clientes" className="hover:text-foreground transition-colors">Clientes</Link>
          <ChevronRight className="w-3 h-3 opacity-50" />
          <span className="text-foreground font-medium truncate max-w-[260px]" data-private>{nomeCliente}</span>
        </nav>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/clientes")} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary" data-private>{nomeCliente.charAt(0).toUpperCase()}</span>
              </div>
              {clientePerfil?.vip && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 absolute -top-1 -right-1" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground" data-private>{nomeCliente}</h1>
                {clientePerfil?.vip && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">VIP</span>
                )}
                {execTipos.map((t) => (
                  <span key={t} className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
                    {labelTipoProcesso(t)}
                  </span>
                ))}
                {opsUrgentes.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
                    {rotuloUrgencia(
                      opsUrgentes
                        .map((o) => o.vence_em)
                        .filter(Boolean)
                        .sort()[0] || null,
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {clientePerfil?.profissao || "Produtor Rural"}
                  {clientePerfil?.municipio && ` · ${clientePerfil.municipio}`}
                  {clientePerfil?.uf && `/${clientePerfil.uf}`}
                  {!clientePerfil?.municipio && (<> · {contratos.length} contrato{contratos.length !== 1 ? "s" : ""}</>)}
                </p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${adInfo.color}`}>
                  <AdimplenciaIcon className="w-3 h-3" />
                  {adInfo.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/assinaturas?aba=novo&cliente=${encodeURIComponent(nomeCliente)}`)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-secondary transition-all"
            >
              <PenLine className="w-3.5 h-3.5" /> Enviar para assinatura
            </button>
            <button
              onClick={() => setLaudoDialogOpen(true)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:shadow-card-hover transition-all"
            >
              <FilePlus className="w-3.5 h-3.5" /> Gerar / Retificar Laudo
            </button>
            <PinButton
              type="cliente"
              id={nomeCliente}
              title={nomeCliente}
              path={`/clientes/${encodeURIComponent(nomeCliente)}`}
            />
            <select
              value={statusAtual}
              onChange={async (e) => {
                const newStatus = e.target.value;
                setStatusAtual(newStatus);
                const statusLabel = statusCliente.find((s) => s.value === newStatus)?.label || newStatus;
                await supabase.from("atividades_clientes").insert({
                  user_id: user!.id,
                  organizacao_id: orgId,
                  nome_cliente: nomeCliente,
                  descricao: `Status alterado para: ${statusLabel}`,
                  tipo: "outro",
                  status_cliente: newStatus,
                });
                toast.success(`Status alterado para "${statusLabel}"`);
                loadData();
              }}
              className={`h-9 rounded-lg border-0 px-3 py-1 text-xs font-bold cursor-pointer transition-all ${statusCliente.find((s) => s.value === statusAtual)?.color || "bg-muted text-muted-foreground"}`}
            >
              {statusCliente.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Passo a passo da entrada urgente */}
        {opsUrgentes.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 mb-6">
            <h2 className="text-sm font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Entrada urgente — o que fazer agora
            </h2>
            <ol className="mt-2 space-y-1 text-sm text-foreground list-decimal pl-5">
              <li>Peça só o mínimo no onboarding: procuração, RG/CPF ou CNH, autorização do gov.br e o <strong>Registrato</strong> (é ele que identifica as operações), mais banco e número, se o cliente souber.</li>
              <li>Protocole o pedido marcando "protocolo em regime de urgência", registrando o que faltava e se foi por CPF.</li>
              <li>Cumpra a pendência "Completar documentação do pedido" no prazo de 15 dias.</li>
              <li>Se não der tempo de laudo, peça a nota técnica preliminar e depois o laudo completo.</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              {opsUrgentes.filter((o) => o.pendencia_completar).length > 0
                ? `${opsUrgentes.filter((o) => o.pendencia_completar).length} operação(ões) com documentação a completar.`
                : opsUrgentes.every((o) => o.notificado_em)
                  ? "Todas as operações urgentes já foram protocoladas."
                  : "Ainda há operação urgente sem protocolo."}
            </p>
          </div>
        )}

        {/* Client Profile Card */}
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" /> Qualificação do Cliente
            </h2>
            <div className="flex items-center gap-2">
              <PortalClienteConviteButton
                clienteId={clientePerfil?.id}
                email={clientePerfil?.email}
                nome={clientePerfil?.nome || nomeCliente}
              />
              <button
                onClick={() => setPerfilOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> {clientePerfil ? "Editar" : "Preencher"}
              </button>
            </div>
          </div>
          {clientePerfil ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {clientePerfil.cpf_cnpj && (
                <div><span className="text-xs text-muted-foreground block">CPF/CNPJ</span><span className="font-medium text-foreground" data-private>{clientePerfil.cpf_cnpj}</span></div>
              )}
              {clientePerfil.estado_civil && (
                <div><span className="text-xs text-muted-foreground block">Estado Civil</span><span className="font-medium text-foreground">{clientePerfil.estado_civil}</span></div>
              )}
              {clientePerfil.telefone && (
                <div><span className="text-xs text-muted-foreground block">Telefone</span><span className="font-medium text-foreground" data-private>{clientePerfil.telefone}</span></div>
              )}
              {clientePerfil.email && (
                <div><span className="text-xs text-muted-foreground block">E-mail</span><span className="font-medium text-foreground" data-private>{clientePerfil.email}</span></div>
              )}
              {clientePerfil.nome_propriedade && (
                <div><span className="text-xs text-muted-foreground block">Propriedade</span><span className="font-medium text-foreground" data-private>{clientePerfil.nome_propriedade}</span></div>
              )}
              {clientePerfil.area_hectares && (
                <div><span className="text-xs text-muted-foreground block">Área</span><span className="font-medium text-foreground">{clientePerfil.area_hectares} ha</span></div>
              )}
              {clientePerfil.cultura_principal && (
                <div><span className="text-xs text-muted-foreground block">Cultura</span><span className="font-medium text-foreground">{clientePerfil.cultura_principal}</span></div>
              )}
              {clientePerfil.municipio && (
                <div><span className="text-xs text-muted-foreground block">Município</span><span className="font-medium text-foreground">{clientePerfil.municipio}{clientePerfil.uf ? `/${clientePerfil.uf}` : ""}</span></div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma qualificação cadastrada. Clique em "Preencher" para adicionar.</p>
          )}
        </div>

        {/* Contracts summary */}
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" /> Contratos
            </h2>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar / Adicionar
            </button>
          </div>
          {contratos.length > 0 ? (
            <div className="space-y-2">
              {contratos.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{c.banco || "Sem banco"}</span>
                    {c.banco && primeiroContratoPorBanco.get(normBanco(c.banco)) === c.id && bancoContratado(c.banco) && (
                      <span className="rounded-md border border-primary bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        Contratado
                      </span>
                    )}

                    {c.numero_contrato && <span className="text-xs text-muted-foreground">Nº {c.numero_contrato}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>Total: {fmtCurrency(c.valor_total_operacao)}</span>
                    <span>Parcela: {fmtCurrency(c.valor_parcela)}</span>
                    {c.primeiro_vencimento && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        1º: {formatDateBR(c.primeiro_vencimento)}
                      </span>
                    )}
                    {c.vencimento_proxima_parcela && (
                      <span>Próx: {formatDateBR(c.vencimento_proxima_parcela)}</span>
                    )}
                    {c.vencimento_ultima_parcela && (
                      <span>Último: {formatDateBR(c.vencimento_ultima_parcela)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum contrato cadastrado</p>
          )}
        </div>

        <EditClienteDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          nomeCliente={nomeCliente}
          contratosExistentes={contratos}
          onSaved={loadData}
        />
        <EditClientePerfilDialog
          open={perfilOpen}
          onOpenChange={setPerfilOpen}
          nomeCliente={nomeCliente}
          onSaved={loadData}
        />
        <LaudoActionDialog
          open={laudoDialogOpen}
          onOpenChange={setLaudoDialogOpen}
          nomeCliente={nomeCliente}
        />
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setTab("perfil360")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === "perfil360"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Perfil 360
          </button>
          <button
            onClick={() => setTab("atividades")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === "atividades"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Atividades
          </button>
          <button
            onClick={() => setTab("processos")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === "processos"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Scale className="w-4 h-4" /> Processos
            {processosCliente.length > 0 && (
              <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-semibold">{processosCliente.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("drive")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === "drive"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <HardDrive className="w-4 h-4" /> Drive
          </button>
          <button
            onClick={() => setTab("atendimentos")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === "atendimentos"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <NotebookPen className="w-4 h-4" /> Atendimentos
            {atendimentosCliente.length > 0 && (
              <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-semibold">{atendimentosCliente.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("conversas")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === "conversas"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Conversas
          </button>
          <button
            onClick={() => setTab("operacoes")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === "operacoes"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <RadarIcon className="w-4 h-4" /> Operações de crédito
          </button>
        </div>

        {/* Tab content */}
        {tab === "operacoes" ? (
          <ClienteOperacoesTab clienteId={clientePerfil?.id || null} />
        ) : tab === "perfil360" ? (
          <PerfilCliente360 produtor={nomeCliente} hideHeader />
        ) : tab === "conversas" ? (
          <PainelMensageria
            clienteId={clientePerfil?.id || null}
            nomeCliente={nomeCliente}
            height="68vh"
          />
        ) : tab === "drive" ? (
          <ClienteDrive nomeCliente={nomeCliente} />
        ) : tab === "atendimentos" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Atendimentos comerciais registrados para este cliente
              </p>
              <Link
                to="/comercial/atendimentos"
                className="text-xs text-accent hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Novo atendimento
              </Link>
            </div>
            {atendimentosCliente.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-dashed border-border">
                <NotebookPen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum atendimento registrado para este cliente.</p>
                <Link
                  to="/comercial/atendimentos"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Plus className="w-3 h-3" /> Registrar primeiro atendimento
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {atendimentosCliente.map((a: any) => (
                  <Link
                    key={a.id}
                    to={`/comercial/atendimentos?open=${a.id}`}
                    className="block p-4 rounded-xl border border-border bg-card hover:border-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-sm">{a.titulo || "Sem assunto"}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <VisivelClienteToggle
                          table="atendimentos_notas"
                          id={a.id}
                          value={!!a.visivel_cliente}
                          hint={a.cliente_id ? undefined : "Sem cliente vinculado neste atendimento — não aparecerá no portal até vincular."}
                          size="xs"
                        />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.status}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{a.notas_brutas}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 mt-2 border-t">
                      <span>{format(new Date(a.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      <span className="px-1.5 py-0.5 rounded bg-muted">{a.origem}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : tab === "processos" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Processos vinculados a {nomeCliente}
              </p>
              <button
                onClick={() =>
                  navigate(`/processos?cliente=${encodeURIComponent(nomeCliente)}&open=1`)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar processo
              </button>
            </div>
            {processosCliente.length === 0 ? (
              <div className="text-center py-12">
                <Scale className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum processo vinculado a este cliente</p>
                <button
                  onClick={() =>
                    navigate(`/processos?cliente=${encodeURIComponent(nomeCliente)}&open=1`)
                  }
                  className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Plus className="w-3 h-3" /> Adicionar primeiro processo
                </button>
              </div>
            ) : (
              processosCliente.map((proc: any) => {
                const faseLabel: Record<string, string> = { "1": "Laudo Técnico", "2": "Notificação", "3": "Resposta do Banco", "4": "Via Judicial", "5": "Encerrado" };
                const statusFases = (proc.status_fases || {}) as Record<string, string>;
                const procMovs = movimentacoesCliente.filter((m: any) => m.processo_id === proc.id);
                const procTarefas = tarefasCliente.filter((t: any) => t.processo_id === proc.id);
                const ultimoMov = procMovs[0];
                const LIMINAR_DEFERIDA = new Set(["liminar_concedida", "sentenca_procedente", "acordo_homologado"]);
                const LIMINAR_NEGADA = new Set(["liminar_negada", "sentenca_improcedente"]);
                const liminarMov = procMovs.find((m: any) => LIMINAR_DEFERIDA.has(m.tipo) || LIMINAR_NEGADA.has(m.tipo));
                const liminarStatus: "deferida" | "negada" | null = liminarMov
                  ? LIMINAR_DEFERIDA.has(liminarMov.tipo)
                    ? "deferida"
                    : "negada"
                  : null;

                return (
                  <div key={proc.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Fase atual: {faseLabel[proc.fase_atual] || proc.fase_atual}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wide border border-primary/20">
                            <Building2 className="w-3 h-3" />
                            {proc.banco || "Sem banco"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Criado em {format(new Date(proc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {proc.numero_processo ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[11px] font-mono border border-border">
                              <Scale className="w-3 h-3" /> {proc.numero_processo}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">Sem nº de processo cadastrado</span>
                          )}
                          {liminarStatus === "deferida" && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-success/10 text-success text-[11px] font-semibold border border-success/30">
                              <ShieldCheck className="w-3 h-3" /> Liminar deferida
                            </span>
                          )}
                          {liminarStatus === "negada" && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-[11px] font-semibold border border-destructive/30">
                              <ShieldX className="w-3 h-3" /> Liminar indeferida
                            </span>
                          )}
                          {!liminarStatus && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] border border-border">
                              <Gavel className="w-3 h-3" /> Sem liminar
                            </span>
                          )}
                        </div>
                        {ultimoMov && (
                          <p className="text-[11px] text-muted-foreground mt-2">
                            Último movimento: <span className="font-medium text-foreground">{ultimoMov.tipo.replace(/_/g, " ")}</span>
                            {" · "}
                            {format(new Date(ultimoMov.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/processos/${proc.id}`}
                          className="flex items-center gap-1 text-xs text-accent font-medium hover:underline"
                        >
                          Ver detalhes <ChevronRight className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => handleRemoveProcesso(proc.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remover processo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Phase progress */}
                    <div className="flex items-center gap-1 mb-4">
                      {["1", "2", "3", "4", "5"].map((f) => {
                        const status = statusFases[f] || "pendente";
                        const bgColor = status === "concluida" ? "bg-success" : status === "em_andamento" ? "bg-accent" : "bg-muted";
                        return (
                          <div key={f} className="flex-1 flex flex-col items-center gap-1">
                            <div className={`h-1.5 w-full rounded-full ${bgColor}`} />
                            <span className="text-[9px] text-muted-foreground">{faseLabel[f]?.split(" ")[0]}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Movimentações */}
                    {procMovs.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Movimentações</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {procMovs.map((mov: any) => (
                            <div key={mov.id} className="flex items-start gap-2 p-2 rounded-lg bg-background border border-border">
                              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[9px] uppercase font-bold tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">{mov.tipo}</span>
                                  <span className="text-[10px] text-muted-foreground">{format(new Date(mov.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                                </div>
                                <p className="text-xs text-foreground">{mov.descricao}</p>
                                {mov.user_id && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1">
                                    <User className="w-2.5 h-2.5" />
                                    {labelAutor(mov.user_id)}
                                  </span>
                                )}
                                {mov.documento_url && (
                                  <button
                                    onClick={async () => {
                                      const { data } = await supabase.storage.from("cliente-drive").createSignedUrl(mov.documento_url, 300);
                                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                    }}
                                    className="mt-1 flex items-center gap-1 text-[10px] text-primary hover:underline"
                                  >
                                    <Download className="w-3 h-3" /> Anexo
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tarefas do processo */}
                    {procTarefas.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tarefas</h4>
                        <div className="space-y-1">
                          {procTarefas.map((t: any) => (
                            <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border text-xs">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${t.concluida ? "bg-success" : t.prioridade === "urgente" ? "bg-destructive" : "bg-muted-foreground"}`} />
                              <span className={`flex-1 ${t.concluida ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.titulo}</span>
                              <span className="text-muted-foreground">{new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Atendimentos vinculados ao banco deste processo */}
                    {(() => {
                      const atvsBanco = atividades.filter(
                        (a) => (a.banco || "").toLowerCase() === (proc.banco || "").toLowerCase() && a.banco
                      );
                      if (atvsBanco.length === 0) return null;
                      return (
                        <div className="mt-3">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                            <ClipboardList className="w-3 h-3" />
                            Atendimentos · {proc.banco}
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{atvsBanco.length}</span>
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {atvsBanco.slice(0, 6).map((a) => (
                              <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-background border border-border">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="text-[9px] uppercase font-bold tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                      {tiposAtividade.find((t) => t.value === a.tipo)?.label || a.tipo}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {format(new Date((a.data_atividade || a.created_at) + (a.data_atividade ? "T12:00:00" : "")), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground line-clamp-2">{a.descricao}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <>
            {/* Add activity */}
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" /> Registrar Atividade
              </h2>

              {/* Row 1: Tipo + Data */}
              <div className="flex flex-col sm:flex-row gap-3 mb-3 flex-wrap">
                <select
                  value={novoTipo}
                  onChange={(e) => setNovoTipo(e.target.value)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48 shrink-0"
                >
                  {tiposAtividade.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                {/* Date picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "sm:w-48 justify-start text-left font-normal",
                        !dataAtividade && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {dataAtividade ? format(dataAtividade, "dd/MM/yyyy", { locale: ptBR }) : "Data da atividade"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataAtividade}
                      onSelect={(d) => d && setDataAtividade(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {/* Banco (opcional) */}
                <select
                  value={novoBanco}
                  onChange={(e) => setNovoBanco(e.target.value)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56 shrink-0"
                  title="Vincular a um banco (opcional)"
                >
                  <option value="">Geral (sem banco)</option>
                  {bancosCliente.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Row 2: Descrição */}
              <RichTextarea
                value={novaDescricao}
                onValueChange={setNovaDescricao}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const pasted: File[] = [];
                  for (const item of Array.from(items)) {
                    if (item.kind === "file") {
                      const f = item.getAsFile();
                      if (f) {
                        const ext = f.type.split("/")[1] || "png";
                        const named = f.name && f.name !== "image.png"
                          ? f
                          : new File([f], `colado-${Date.now()}.${ext}`, { type: f.type });
                        pasted.push(named);
                      }
                    }
                  }
                  if (pasted.length) {
                    e.preventDefault();
                    setAnexosFiles((prev) => [...prev, ...pasted]);
                    toast.success(`${pasted.length} arquivo(s) colado(s) como anexo`);
                  }
                }}
                placeholder="Descreva detalhadamente a atividade realizada, observações, acordos, próximos passos..."
                className="min-h-[100px] mb-3 resize-y"
                maxLength={10000}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>{novaDescricao.length}/10000 caracteres</span>
              </div>

              {/* Row 3: Drop zone (anexos múltiplos) */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length) setAnexosFiles((prev) => [...prev, ...files]);
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";
                  input.onchange = (e) => {
                    const fs = Array.from((e.target as HTMLInputElement).files || []);
                    if (fs.length) setAnexosFiles((prev) => [...prev, ...fs]);
                  };
                  input.click();
                }}
                className={cn(
                  "cursor-pointer flex flex-col items-center justify-center gap-1 px-4 py-6 rounded-lg border border-dashed text-sm transition-colors mb-3",
                  dragOver
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Paperclip className="w-5 h-5" />
                <span>
                  {dragOver ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para anexar (múltiplos)"}
                </span>
              </div>

              {anexosFiles.length > 0 && (
                <div className="space-y-2 mb-3">
                  {anexosFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                      <Paperclip className="w-4 h-4 text-accent shrink-0" />
                      <span className="truncate text-foreground flex-1 min-w-0">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        onClick={() => setAnexosFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  onClick={handleAddAtividade}
                  disabled={salvando}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-40 transition-all shrink-0"
                >
                  <Send className="w-4 h-4" /> {salvando ? "Salvando..." : "Registrar"}
                </button>
              </div>
            </div>

            {/* Activity timeline */}
            {/* Filtro por banco */}
            {bancosCliente.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
                  Filtrar por:
                </span>
                {["Geral", ...bancosCliente].map((b) => {
                  const active = bancoFiltro === b;
                  const count =
                    b === "Geral"
                      ? atividades.length
                      : atividades.filter((a) => (a.banco || "").toLowerCase() === b.toLowerCase()).length;
                  return (
                    <button
                      key={b}
                      onClick={() => setBancoFiltro(b)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        active
                          ? "bg-accent text-accent-foreground border-accent shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-accent/50"
                      )}
                    >
                      {b !== "Geral" && <Building2 className="w-3 h-3" />}
                      {b}
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        active ? "bg-accent-foreground/20" : "bg-muted"
                      )}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : atividadesFiltradas.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {bancoFiltro === "Geral"
                    ? "Nenhuma atividade registrada para este cliente"
                    : `Nenhuma atividade registrada para ${bancoFiltro}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Registre atendimentos, reuniões e protocolos acima</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedMonthKeys.map((monthKey) => {
                  const items = atividadesPorMes[monthKey];
                  const mesLabel = format(new Date(monthKey + "-15"), "MMMM yyyy", { locale: ptBR });
                  return (
                    <div key={monthKey}>
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarDays className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-semibold text-foreground capitalize">{mesLabel}</h3>
                        <span className="text-xs text-muted-foreground">({items.length} atividade{items.length !== 1 ? "s" : ""})</span>
                      </div>
                      <div className="space-y-2 pl-2 border-l-2 border-accent/20 ml-2">
                        {items.map((a) => (
                          <div key={a.id} className="flex items-start justify-between p-3 rounded-lg bg-card border border-border ml-3 group">
                            <div className="min-w-0 flex-1">
                              {editingId === a.id ? (
                                <div className="space-y-3 w-full">
                                  <div className="flex flex-wrap gap-2">
                                  <select
                                    value={editTipo}
                                    onChange={(e) => setEditTipo(e.target.value)}
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-56"
                                  >
                                    {tiposAtividade.map((t) => (
                                      <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={editBanco}
                                    onChange={(e) => setEditBanco(e.target.value)}
                                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-72"
                                  >
                                    <option value="">Geral (sem banco)</option>
                                    {bancosCliente.map((b) => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                  </select>
                                  </div>
                                  <RichTextarea
                                    value={editDescricao}
                                    onValueChange={setEditDescricao}
                                    onPaste={(e) => {
                                      const items = e.clipboardData?.items;
                                      if (!items) return;
                                      const files: File[] = [];
                                      for (let i = 0; i < items.length; i++) {
                                        const it = items[i];
                                        if (it.kind === "file") {
                                          const f = it.getAsFile();
                                          if (f) {
                                            const ext = f.type.split("/")[1] || "png";
                                            const named = f.name && f.name !== "image.png"
                                              ? f
                                              : new File([f], `print_${Date.now()}.${ext}`, { type: f.type });
                                            files.push(named);
                                          }
                                        }
                                      }
                                      if (files.length) {
                                        e.preventDefault();
                                        setEditAnexosFiles((p) => [...p, ...files]);
                                        toast.success(`${files.length} arquivo(s) colado(s)`);
                                      }
                                    }}
                                    className="min-h-[260px] text-sm resize-y"
                                    maxLength={10000}
                                  />
                                  {(editAnexosUrls.length > 0 || editAnexosFiles.length > 0) && (
                                    <div className="flex flex-wrap gap-2">
                                      {editAnexosUrls.map((url, i) => (
                                        <span key={`old-${i}`} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                                          <Paperclip className="w-3 h-3" />
                                          {editAnexosNomes[i] || "arquivo"}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditAnexosUrls((p) => p.filter((_, idx) => idx !== i));
                                              setEditAnexosNomes((p) => p.filter((_, idx) => idx !== i));
                                            }}
                                            className="ml-1 text-destructive hover:text-destructive/80"
                                            title="Remover anexo"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </span>
                                      ))}
                                      {editAnexosFiles.map((f, i) => (
                                        <span key={`new-${i}`} className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-1 rounded">
                                          <Paperclip className="w-3 h-3" />
                                          {f.name}
                                          <button
                                            type="button"
                                            onClick={() => setEditAnexosFiles((p) => p.filter((_, idx) => idx !== i))}
                                            className="ml-1 hover:opacity-70"
                                            title="Remover"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <label className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer w-fit">
                                    <Paperclip className="w-3.5 h-3.5" />
                                    Anexar arquivo
                                    <input
                                      type="file"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length) setEditAnexosFiles((p) => [...p, ...files]);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={() => handleEditSave(a.id)} disabled={editSaving} className="h-7 text-xs gap-1">
                                      <Check className="w-3 h-3" /> {editSaving ? "Salvando..." : "Salvar"}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditAnexosFiles([]); setEditAnexosUrls([]); setEditAnexosNomes([]); }} className="h-7 text-xs">
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                      {tiposAtividade.find((t) => t.value === a.tipo)?.label || a.tipo}
                                    </span>
                                    {a.banco && (
                                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                                        <Building2 className="w-2.5 h-2.5" />
                                        {a.banco}
                                      </span>
                                    )}
                                    {a.data_atividade && (
                                      <span className="text-xs font-medium text-foreground">
                                        {format(new Date(a.data_atividade + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                      registrado em {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                    {a.user_id && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        <User className="w-2.5 h-2.5" />
                                        {labelAutor(a.user_id)}
                                      </span>
                                    )}
                                  </div>
                                  <RichText text={a.descricao} className="text-sm text-foreground" />
                                  {(() => {
                                    const urls = (a.anexos_urls && a.anexos_urls.length > 0)
                                      ? a.anexos_urls
                                      : (a.anexo_url ? [a.anexo_url] : []);
                                    const nomes = (a.anexos_nomes && a.anexos_nomes.length > 0)
                                      ? a.anexos_nomes
                                      : (a.anexo_nome ? [a.anexo_nome] : []);
                                    if (urls.length === 0) return null;
                                    return (
                                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                        {urls.map((url, i) => (
                                          <button
                                            key={i}
                                            onClick={() => handleDownloadAnexo(url, nomes[i] || "arquivo")}
                                            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                            {nomes[i] || "arquivo"}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                            {editingId !== a.id && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingId(a.id);
                                    setEditDescricao(a.descricao);
                                    setEditTipo(a.tipo);
                                    setEditBanco(a.banco || "");
                                    const urls = (a.anexos_urls && a.anexos_urls.length > 0)
                                      ? a.anexos_urls
                                      : (a.anexo_url ? [a.anexo_url] : []);
                                    const nomes = (a.anexos_nomes && a.anexos_nomes.length > 0)
                                      ? a.anexos_nomes
                                      : (a.anexo_nome ? [a.anexo_nome] : []);
                                    setEditAnexosUrls(urls);
                                    setEditAnexosNomes(nomes);
                                    setEditAnexosFiles([]);
                                  }}
                                  className="p-1 text-muted-foreground hover:text-accent transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(a.id)}
                                  className="p-1 text-destructive hover:text-destructive/80 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
