import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText, Plus, Sparkles, ChevronRight, Loader2, Check, Edit3,
  Trash2, Copy, Download, Scale, Shield, MessageSquare, Clock, Search, X,
  Gavel, Swords, AlertOctagon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { formatDateBR } from "@/lib/utils";

/* ─── Tipos de Petição ─── */
const TIPOS_PETICAO: Array<{
  id: string;
  nome: string;
  descricao: string;
  icon: any;
  secoes: string[];
  cor: string;
  teses?: { id: string; nome: string; descricao: string }[];
}> = [
  {
    id: "pedido_administrativo",
    nome: "Notificação Administrativa",
    descricao: "Pedido extrajudicial de Alongamento de Dívida Rural ao banco (MCR 2.6.4 + Súmula 298 STJ)",
    icon: FileText,
    secoes: [
      "Endereçamento e Qualificação",
      "Dos Contratos de Crédito Rural",
      "Motivos que Afetaram a Capacidade de Pagamento",
      "Do Direito ao Alongamento da Dívida Rural",
      "Nova Capacidade de Pagamento",
      "Do Pedido Subsidiário – MP 1.314/2025",
      "Dos Pedidos",
      "Considerações Finais e Presunção de Negativa",
    ],
    cor: "text-emerald-600 bg-emerald-50",
  },
  {
    id: "cautelar_antecedente",
    nome: "Cautelar Antecedente",
    descricao: "Tutela cautelar em caráter antecedente (art. 305 CPC) p/ forçar resposta do banco antes da ação principal",
    icon: Gavel,
    secoes: [
      "Endereçamento",
      "Qualificação das Partes",
      "Síntese da Lide Principal a ser Proposta",
      "Dos Fatos – Recusa ou Silêncio do Banco",
      "Do Cabimento da Tutela Cautelar Antecedente (art. 305 CPC)",
      "Da Probabilidade do Direito (Fumus Boni Iuris)",
      "Do Perigo de Dano (Periculum in Mora)",
      "Dos Pedidos Cautelares e Aditamento (art. 308 CPC)",
    ],
    cor: "text-purple-600 bg-purple-50",
  },
  {
    id: "mandamental_alongamento",
    nome: "Ação Mandamental de Alongamento",
    descricao: "Ação de obrigação de fazer com pedido mandamental para impor o alongamento ao agente financeiro",
    icon: Swords,
    secoes: [
      "Endereçamento",
      "Qualificação das Partes",
      "Dos Fatos",
      "Do Direito ao Alongamento (MCR 2.6.4 + Súmula 298 STJ)",
      "Da Natureza Mandamental da Tutela",
      "Da Tutela de Urgência",
      "Dos Pedidos Mandamentais",
      "Do Valor da Causa",
    ],
    cor: "text-blue-600 bg-blue-50",
  },
  {
    id: "peticao_inicial",
    nome: "Petição Inicial (Obrigação de Fazer)",
    descricao: "Ação de Obrigação de Fazer c/c Tutela de Urgência para alongamento de dívida rural",
    icon: Scale,
    secoes: ["Endereçamento", "Qualificação das Partes", "Dos Fatos", "Do Direito", "Da Tutela de Urgência", "Dos Pedidos"],
    cor: "text-sky-600 bg-sky-50",
  },
  {
    id: "embargos_execucao",
    nome: "Embargos à Execução",
    descricao: "Defesa em execução de cédula rural — seleção de teses (anatocismo, abusividade, MCR 2.6.4, caso fortuito etc.)",
    icon: AlertOctagon,
    secoes: [
      "Endereçamento e Referência à Execução",
      "Da Tempestividade e Garantia do Juízo",
      "Síntese da Execução Embargada",
      "Das Teses de Defesa Selecionadas",
      "Do Pedido de Efeito Suspensivo (art. 919, §1º CPC)",
      "Da Necessidade de Perícia Contábil e Agronômica",
      "Dos Pedidos",
    ],
    cor: "text-rose-600 bg-rose-50",
    teses: [
      { id: "capitalizacao_juros", nome: "Capitalização ilegal / anatocismo", descricao: "Juros sobre juros em periodicidade inferior à anual sem pactuação expressa" },
      { id: "comissao_permanencia", nome: "Comissão de permanência cumulada", descricao: "Cumulação com correção monetária, juros remuneratórios ou multa (Súmulas 30, 294, 296, 472 STJ)" },
      { id: "tarifas_abusivas", nome: "Tarifas e encargos abusivos", descricao: "Tarifa de cadastro, TAC, TEC, IOF financiado e seguros impostos" },
      { id: "juros_acima_mercado", nome: "Juros remuneratórios acima da média de mercado", descricao: "Taxa superior à média BCB para a modalidade rural no período" },
      { id: "mcr_descumprido", nome: "Descumprimento do MCR 2.6.4", descricao: "Negativa ou silêncio do banco quanto ao alongamento obrigatório (Súmula 298 STJ)" },
      { id: "caso_fortuito", nome: "Caso fortuito / força maior climática", descricao: "Frustração de safra por evento climático reconhecido (CONAB, AGERH, Monitor de Secas)" },
      { id: "excesso_execucao", nome: "Excesso de execução", descricao: "Valor cobrado superior ao efetivamente devido após expurgo de encargos abusivos" },
      { id: "nulidade_cedula", nome: "Nulidade / inexigibilidade da cédula", descricao: "Ausência de planilha de evolução do débito, vícios de pactuação, falta de liquidez/certeza" },
      { id: "cdc_aplicacao", nome: "Aplicação subsidiária do CDC", descricao: "Súmula 297 STJ — produtor como destinatário final dos serviços bancários" },
      { id: "prescricao_parcial", nome: "Prescrição parcial", descricao: "Prescrição de parcelas ou acessórios conforme art. 206 CC e Súmula 503 STJ" },
    ],
  },
  {
    id: "tutela_urgencia",
    nome: "Tutela de Urgência",
    descricao: "Pedido autônomo de tutela antecipada para suspensão de negativação e execução",
    icon: Shield,
    secoes: ["Endereçamento", "Qualificação e Resumo", "Da Situação de Urgência", "Do Direito - Requisitos da Tutela", "Dos Pedidos Liminares"],
    cor: "text-orange-600 bg-orange-50",
  },
  {
    id: "manifestacao",
    nome: "Manifestação",
    descricao: "Manifestação nos autos para impugnar contestação ou apresentar fatos novos",
    icon: MessageSquare,
    secoes: ["Endereçamento e Referência Processual", "Da Tempestividade", "Dos Fatos Supervenientes / Impugnação", "Do Direito Aplicável", "Dos Pedidos / Requerimentos"],
    cor: "text-amber-600 bg-amber-50",
  },
];

interface Secao {
  titulo: string;
  conteudo: string;
  gerada: boolean;
  gerando: boolean;
}

interface Peticao {
  id: string;
  tipo: string;
  titulo: string;
  status: string;
  secoes: Secao[];
  created_at: string;
}

interface LaudoOption {
  id: string;
  numero_laudo: string;
  dados_etapa1: Record<string, any> | null;
  dados_etapa2: Record<string, any> | null;
  dados_etapa3: Record<string, any> | null;
  dados_etapa4: Record<string, any> | null;
  dados_etapa5: Record<string, any> | null;
  status: string;
}

interface ContratoOption {
  id: string;
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  valor_total_operacao: number | null;
  valor_parcela: number | null;
  vencimento_proxima_parcela: string | null;
}

/* ─── Wizard Steps ─── */
type WizardStep = "tipo" | "cliente" | "selecao" | "titulo";

export default function Peticoes() {
  const { user } = useAuth();
  const [peticoes, setPeticoes] = useState<Peticao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [peticaoAtiva, setPeticaoAtiva] = useState<Peticao | null>(null);
  const [secaoAtiva, setSecaoAtiva] = useState(0);
  const [dadosCaso, setDadosCaso] = useState<Record<string, any>>({});

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>("tipo");
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSuggestions, setClienteSuggestions] = useState<string[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [laudos, setLaudos] = useState<LaudoOption[]>([]);
  const [contratos, setContratos] = useState<ContratoOption[]>([]);
  const [laudoSelecionado, setLaudoSelecionado] = useState<string | null>(null);
  const [contratosSelecionados, setContratosSelecionados] = useState<string[]>([]);
  const [tesesSelecionadas, setTesesSelecionadas] = useState<string[]>([]);
  const [tituloPeticao, setTituloPeticao] = useState("");
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchPeticoes();
  }, [user]);

  // Deep-link from Olívia: /peticoes?cliente=NOME&tipo=TIPO
  const [searchParams, setSearchParams] = useSearchParams();
  const [deeplinkApplied, setDeeplinkApplied] = useState(false);
  useEffect(() => {
    if (!user || deeplinkApplied) return;
    const cliente = searchParams.get("cliente");
    const tipo = searchParams.get("tipo");
    if (!cliente && !tipo) return;
    setDeeplinkApplied(true);
    setShowNovaModal(true);
    if (tipo && TIPOS_PETICAO.some(t => t.id === tipo)) {
      setTipoSelecionado(tipo);
      setWizardStep("cliente");
    }
    if (cliente) {
      // selecionarCliente já avança para "selecao"
      setTimeout(() => selecionarCliente(cliente), 50);
    }
    // Limpa os params pra não reabrir ao navegar
    const next = new URLSearchParams(searchParams);
    next.delete("cliente"); next.delete("tipo");
    setSearchParams(next, { replace: true });
  }, [user, searchParams, deeplinkApplied]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowClienteDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced client search
  useEffect(() => {
    const q = clienteSearch.trim();
    if (!q || q.length < 2 || !user) { setClienteSuggestions([]); return; }

    const timeout = setTimeout(async () => {
      // Search in laudos (dados_etapa1.nome) and contratos_vencimentos
      const [laudoRes, contratoRes] = await Promise.all([
        supabase.from("laudos").select("dados_etapa1"),
        supabase.from("contratos_vencimentos").select("nome_cliente").ilike("nome_cliente", `%${q}%`).limit(20),
      ]);

      const names = new Set<string>();

      // From laudos
      if (laudoRes.data) {
        for (const l of laudoRes.data) {
          const d = l.dados_etapa1 as Record<string, any> | null;
          const nome = d?.nome || d?.nomeProdutor;
          if (nome && nome.toLowerCase().includes(q.toLowerCase())) {
            names.add(nome);
          }
        }
      }

      // From contratos
      if (contratoRes.data) {
        for (const c of contratoRes.data) {
          names.add(c.nome_cliente);
        }
      }

      setClienteSuggestions(Array.from(names));
      setShowClienteDropdown(names.size > 0);
    }, 300);

    return () => clearTimeout(timeout);
  }, [clienteSearch, user]);

  const fetchPeticoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("peticoes")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPeticoes(data.map((p: any) => ({
        id: p.id,
        tipo: p.tipo,
        titulo: p.titulo,
        status: p.status,
        secoes: (p.secoes as any[]) || [],
        created_at: p.created_at,
      })));
    }
    setLoading(false);
  };

  const selecionarCliente = async (nome: string) => {
    setClienteSelecionado(nome);
    setClienteSearch(nome);
    setShowClienteDropdown(false);
    setLoadingCliente(true);

    // Load laudos for this client
    const { data: allLaudos } = await supabase
      .from("laudos")
      .select("id, numero_laudo, dados_etapa1, dados_etapa2, dados_etapa3, dados_etapa4, dados_etapa5, status");

    const filteredLaudos = (allLaudos || []).filter((l: any) => {
      const d = l.dados_etapa1 as Record<string, any> | null;
      const n = d?.nome || d?.nomeProdutor || "";
      return n.toLowerCase() === nome.toLowerCase();
    }) as LaudoOption[];

    setLaudos(filteredLaudos);
    if (filteredLaudos.length === 1) {
      setLaudoSelecionado(filteredLaudos[0].id);
    }

    // Load contracts for this client
    const { data: allContratos } = await supabase
      .from("contratos_vencimentos")
      .select("id, nome_cliente, banco, numero_contrato, valor_total_operacao, valor_parcela, vencimento_proxima_parcela")
      .ilike("nome_cliente", nome);

    setContratos((allContratos || []) as ContratoOption[]);
    setLoadingCliente(false);
    setWizardStep("selecao");
  };

  const toggleContrato = (id: string) => {
    setContratosSelecionados(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selecionarTodosContratos = () => {
    if (contratosSelecionados.length === contratos.length) {
      setContratosSelecionados([]);
    } else {
      setContratosSelecionados(contratos.map(c => c.id));
    }
  };

  const buildDadosCaso = useCallback(() => {
    const laudo = laudos.find(l => l.id === laudoSelecionado);
    const contSelecionados = contratos.filter(c => contratosSelecionados.includes(c.id));
    const d1 = laudo?.dados_etapa1 || {};
    const d2 = laudo?.dados_etapa2 || {};
    const d3 = laudo?.dados_etapa3 || {};
    const d4 = laudo?.dados_etapa4 || {};
    const d5 = laudo?.dados_etapa5 || {};

    // Extract unique banks from selected contracts
    const bancosUnicos = [...new Set(contSelecionados.map(c => c.banco).filter(Boolean))];

    // Build contracts description
    const contratosDesc = contSelecionados.map(c =>
      `Op. ${c.numero_contrato || "—"} – R$ ${c.valor_total_operacao?.toLocaleString("pt-BR") || "—"} – ${c.banco || "—"} – venc. ${c.vencimento_proxima_parcela || "—"}`
    ).join("\n");

    // Extract culturas
    const culturas = Array.isArray(d1.culturas) ? d1.culturas.join(", ") : (d1.cultura || "");

    // Extract contract details from laudo if available
    const laudoContratos = Array.isArray(d1.contratos)
      ? d1.contratos.map((c: any) =>
          `Op. ${c.contrato || "—"} – R$ ${c.valorOriginal || "—"} – ${(c.banco || []).join(", ")} – ${c.modalidade || ""} – venc. ${c.dataVencimento || "—"}`
        ).join("\n")
      : "";

    // Saldo devedor total
    const saldoDevedor = contSelecionados.reduce((sum, c) => sum + (c.valor_total_operacao || 0), 0);

    // Dados de produção from etapa 3 (safra)
    const safraData = d3 || {};

    return {
      produtor: d1.nome || d1.nomeProdutor || clienteSelecionado || "",
      cpf: d1.cpfCnpj || d1.cpf || "",
      propriedade: d1.propriedade || d1.nomePropriedade || "",
      municipio: d1.municipio || "",
      uf: d1.uf || "",
      banco: bancosUnicos.join(", "),
      contratos: contratosDesc || laudoContratos || "",
      culturas,
      safra: d1.safra || safraData.safra || "",
      area_total: d1.areaTotal || d1.area_total || "",
      area_cultivada: d1.areaCultivada || d1.area_cultivada || "",
      evento_climatico: d1.eventoClimatico || safraData.evento_climatico || "seca / déficit hídrico",
      perda_percentual: safraData.perda_percentual || d4?.perda_percentual || "",
      prod_esperada: safraData.prod_esperada || d4?.producao_esperada || "",
      prod_realizada: safraData.prod_realizada || d4?.producao_obtida || "",
      receita_bruta: safraData.receita_bruta || d4?.receita_bruta || "",
      custo_total: safraData.custo_total || d4?.custo_total || "",
      saldo_devedor: saldoDevedor > 0 ? saldoDevedor.toLocaleString("pt-BR") : "",
      numero_laudo: laudo?.numero_laudo || "",
      agronomo: d5?.agronomo || "",
      crea: d5?.crea || "",
      advogado: "",
      oab: "",
      hipoteses: Array.isArray(d1.hipoteses_selecionadas) ? d1.hipoteses_selecionadas.join(", ") : "",
      numero_processo: "",
      // Extra fields for richer generation
      bancos_selecionados: bancosUnicos,
      contratos_detalhados: contSelecionados,
      laudo_id: laudo?.id || null,
      teses_selecionadas: tesesSelecionadas,
      teses_detalhadas: (() => {
        const cfg = TIPOS_PETICAO.find(t => t.id === tipoSelecionado);
        if (!cfg?.teses) return [];
        return cfg.teses.filter(t => tesesSelecionadas.includes(t.id));
      })(),
    };
  }, [laudos, laudoSelecionado, contratos, contratosSelecionados, clienteSelecionado, tesesSelecionadas, tipoSelecionado]);

  const avancarParaTitulo = () => {
    if (!laudoSelecionado && laudos.length > 0) {
      toast.error("Selecione um laudo");
      return;
    }
    if (contratosSelecionados.length === 0 && contratos.length > 0) {
      toast.error("Selecione ao menos um contrato");
      return;
    }
    const cfgTipo = TIPOS_PETICAO.find(t => t.id === tipoSelecionado);
    if (cfgTipo?.teses && tesesSelecionadas.length === 0) {
      toast.error("Selecione ao menos uma tese de defesa");
      return;
    }

    const dados = buildDadosCaso();
    setDadosCaso(dados);

    // Auto-generate title
    const tipoConfig = TIPOS_PETICAO.find(t => t.id === tipoSelecionado);
    const bancosStr = dados.bancos_selecionados?.length > 0
      ? ` vs. ${dados.bancos_selecionados.join(", ")}`
      : "";
    setTituloPeticao(`${tipoConfig?.nome || "Petição"} – ${dados.produtor}${bancosStr}`);
    setWizardStep("titulo");
  };

  const criarPeticao = async () => {
    if (!tipoSelecionado || !tituloPeticao.trim()) {
      toast.error("Preencha o título da petição");
      return;
    }

    const tipoConfig = TIPOS_PETICAO.find(t => t.id === tipoSelecionado);
    if (!tipoConfig) return;

    const secoes: Secao[] = tipoConfig.secoes.map(s => ({
      titulo: s, conteudo: "", gerada: false, gerando: false,
    }));

    const laudoId = dadosCaso.laudo_id || null;

    const { data, error } = await supabase
      .from("peticoes")
      .insert({
        user_id: user!.id,
        tipo: tipoSelecionado,
        titulo: tituloPeticao.trim(),
        status: "rascunho",
        secoes: secoes as any,
        metadata: dadosCaso as any,
        laudo_id: laudoId,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar petição");
      return;
    }

    const nova: Peticao = {
      id: data.id,
      tipo: tipoSelecionado,
      titulo: tituloPeticao.trim(),
      status: "rascunho",
      secoes,
      created_at: data.created_at,
    };

    setPeticoes(prev => [nova, ...prev]);
    setPeticaoAtiva(nova);
    setSecaoAtiva(0);
    resetWizard();
    toast.success("Petição criada com dados do cliente!");
  };

  const resetWizard = () => {
    setShowNovaModal(false);
    setWizardStep("tipo");
    setTipoSelecionado(null);
    setClienteSearch("");
    setClienteSelecionado(null);
    setLaudos([]);
    setContratos([]);
    setLaudoSelecionado(null);
    setContratosSelecionados([]);
    setTesesSelecionadas([]);
    setTituloPeticao("");
  };

  /* ─── Section generation & editing (same as before) ─── */
  const gerarSecao = async (index: number) => {
    if (!peticaoAtiva) return;
    const secoes = [...peticaoAtiva.secoes];
    secoes[index] = { ...secoes[index], gerando: true };
    setPeticaoAtiva({ ...peticaoAtiva, secoes });

    const secoesAnteriores = secoes.slice(0, index).filter(s => s.gerada).map(s => ({
      titulo: s.titulo, conteudo: s.conteudo,
    }));

    try {
      const { data, error } = await supabase.functions.invoke("gerar-secao-peticao", {
        body: {
          tipo_peticao: peticaoAtiva.tipo,
          secao_index: index,
          dados_caso: dadosCaso,
          contexto_secoes_anteriores: secoesAnteriores,
        },
      });
      if (error) throw error;

      const novasSecoes = [...peticaoAtiva.secoes];
      novasSecoes[index] = {
        titulo: novasSecoes[index].titulo,
        conteudo: data.secao.conteudo,
        gerada: true, gerando: false,
      };

      const peticaoAtualizada = { ...peticaoAtiva, secoes: novasSecoes };
      setPeticaoAtiva(peticaoAtualizada);

      await supabase.from("peticoes").update({ secoes: novasSecoes as any }).eq("id", peticaoAtiva.id);
      toast.success(`Seção "${novasSecoes[index].titulo}" gerada!`);
    } catch (err: any) {
      const secoesFallback = [...peticaoAtiva.secoes];
      secoesFallback[index] = { ...secoesFallback[index], gerando: false };
      setPeticaoAtiva({ ...peticaoAtiva, secoes: secoesFallback });
      toast.error(err?.message || "Erro ao gerar seção");
    }
  };

  const gerarTodasSecoes = async () => {
    if (!peticaoAtiva) return;
    for (let i = 0; i < peticaoAtiva.secoes.length; i++) {
      if (!peticaoAtiva.secoes[i].gerada) {
        await gerarSecao(i);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  const atualizarConteudoSecao = (index: number, conteudo: string) => {
    if (!peticaoAtiva) return;
    const secoes = [...peticaoAtiva.secoes];
    secoes[index] = { ...secoes[index], conteudo };
    setPeticaoAtiva({ ...peticaoAtiva, secoes });
  };

  const salvarPeticao = async () => {
    if (!peticaoAtiva) return;
    const { error } = await supabase
      .from("peticoes")
      .update({ secoes: peticaoAtiva.secoes as any, metadata: dadosCaso as any })
      .eq("id", peticaoAtiva.id);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Petição salva!");
  };

  const copiarTextoCompleto = () => {
    if (!peticaoAtiva) return;
    const texto = peticaoAtiva.secoes.filter(s => s.conteudo).map(s => s.conteudo).join("\n\n");
    navigator.clipboard.writeText(texto);
    toast.success("Texto copiado!");
  };

  const excluirPeticao = async (id: string) => {
    const { error } = await supabase.from("peticoes").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (!error) {
      setPeticoes(prev => prev.filter(p => p.id !== id));
      if (peticaoAtiva?.id === id) setPeticaoAtiva(null);
      toast.success("Petição excluída");
    }
  };

  const tipoInfo = (tipo: string) => TIPOS_PETICAO.find(t => t.id === tipo);

  /* ═══════════════ EDITOR VIEW ═══════════════ */
  if (peticaoAtiva) {
    const tipo = tipoInfo(peticaoAtiva.tipo);
    const IconeTipo = tipo?.icon || FileText;
    const secoesGeradas = peticaoAtiva.secoes.filter(s => s.gerada).length;
    const totalSecoes = peticaoAtiva.secoes.length;

    return (
      <AppLayout>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setPeticaoAtiva(null)}>← Voltar</Button>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tipo?.cor}`}>
                <IconeTipo className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">{peticaoAtiva.titulo}</h1>
                <p className="text-xs text-muted-foreground">{tipo?.nome} • {secoesGeradas}/{totalSecoes} seções</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copiarTextoCompleto}>
                <Copy className="w-4 h-4 mr-1" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={salvarPeticao}>
                <Check className="w-4 h-4 mr-1" /> Salvar
              </Button>
              <Button size="sm" onClick={gerarTodasSecoes} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Sparkles className="w-4 h-4 mr-1" /> Gerar Tudo com IA
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="w-72 border-r border-border bg-card/50 flex flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Seções</h3>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(secoesGeradas / totalSecoes) * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{secoesGeradas} de {totalSecoes} geradas</p>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {peticaoAtiva.secoes.map((secao, i) => (
                    <button key={i} onClick={() => setSecaoAtiva(i)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        secaoAtiva === i ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                        secao.gerada ? "bg-green-100 text-green-700" : secao.gerando ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {secao.gerando ? <Loader2 className="w-3 h-3 animate-spin" /> : secao.gerada ? <Check className="w-3 h-3" /> : i + 1}
                      </span>
                      <span className="truncate">{secao.titulo}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/30">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{peticaoAtiva.secoes[secaoAtiva]?.titulo}</h2>
                  <p className="text-xs text-muted-foreground">Seção {secaoAtiva + 1} de {totalSecoes}</p>
                </div>
                <div className="flex gap-2">
                  {!peticaoAtiva.secoes[secaoAtiva]?.gerando && (
                    <Button size="sm" variant="outline" onClick={() => gerarSecao(secaoAtiva)} className="text-accent border-accent/30 hover:bg-accent/10">
                      <Sparkles className="w-4 h-4 mr-1" />
                      {peticaoAtiva.secoes[secaoAtiva]?.gerada ? "Regenerar" : "Gerar com IA"}
                    </Button>
                  )}
                  {secaoAtiva > 0 && <Button size="sm" variant="ghost" onClick={() => setSecaoAtiva(secaoAtiva - 1)}>Anterior</Button>}
                  {secaoAtiva < totalSecoes - 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setSecaoAtiva(secaoAtiva + 1)}>
                      Próxima <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {peticaoAtiva.secoes[secaoAtiva]?.gerando ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                    <Loader2 className="w-10 h-10 animate-spin text-accent" />
                    <p className="text-sm">Gerando seção com IA...</p>
                  </div>
                ) : (
                  <Textarea
                    value={peticaoAtiva.secoes[secaoAtiva]?.conteudo || ""}
                    onChange={(e) => atualizarConteudoSecao(secaoAtiva, e.target.value)}
                    placeholder='Clique em "Gerar com IA" para criar esta seção automaticamente, ou escreva manualmente...'
                    className="min-h-[500px] text-sm leading-relaxed resize-none font-serif border-none shadow-none focus-visible:ring-0 bg-transparent"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ═══════════════ LIST VIEW ═══════════════ */
  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Dialog open={showNovaModal} onOpenChange={(open) => { if (!open) resetWizard(); else setShowNovaModal(true); }}>
          <PageHeader
            icon={Gavel}
            title="Banco de Petições"
            subtitle="Crie peças jurídicas com geração de seções via IA"
            breadcrumb={[{ label: "Agro" }, { label: "Petições" }]}
            actions={
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" /> Nova Petição
              </Button>
            </DialogTrigger>
            }
          />
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {wizardStep === "tipo" && "Escolha o tipo de documento"}
                  {wizardStep === "cliente" && "Buscar cliente"}
                  {wizardStep === "selecao" && `Dados de ${clienteSelecionado}`}
                  {wizardStep === "titulo" && "Confirmar e criar"}
                </DialogTitle>
              </DialogHeader>

              {/* Step 1: Select type */}
              {wizardStep === "tipo" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {TIPOS_PETICAO.map((tipo) => {
                    const Icon = tipo.icon;
                    return (
                      <button key={tipo.id}
                        onClick={() => { setTipoSelecionado(tipo.id); setWizardStep("cliente"); }}
                        className="text-left p-4 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tipo.cor} mb-3`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">{tipo.nome}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{tipo.descricao}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2: Search client */}
              {wizardStep === "cliente" && (
                <div className="space-y-4 mt-4">
                  <Button variant="ghost" size="sm" onClick={() => setWizardStep("tipo")}>← Voltar</Button>

                  <p className="text-sm text-muted-foreground">
                    Busque o nome do produtor para carregar automaticamente os dados do laudo e contratos.
                  </p>

                  <div ref={searchRef} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={clienteSearch}
                      onChange={(e) => setClienteSearch(e.target.value)}
                      onFocus={() => clienteSuggestions.length > 0 && setShowClienteDropdown(true)}
                      placeholder="Digite o nome do produtor..."
                      className="pl-9"
                      autoFocus
                    />
                    {showClienteDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clienteSuggestions.map((nome, i) => (
                          <button key={i} type="button"
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/10 transition-colors font-medium text-foreground"
                            onClick={() => selecionarCliente(nome)}
                          >
                            {nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Select laudo + contracts */}
              {wizardStep === "selecao" && (
                <div className="space-y-5 mt-4">
                  <Button variant="ghost" size="sm" onClick={() => { setWizardStep("cliente"); setClienteSelecionado(null); }}>← Voltar</Button>

                  {loadingCliente ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Laudo selection */}
                      {laudos.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-foreground mb-2 block">Laudo técnico</label>
                          <div className="space-y-2">
                            {laudos.map(l => {
                              const d1 = l.dados_etapa1 || {};
                              return (
                                <button key={l.id}
                                  onClick={() => setLaudoSelecionado(l.id)}
                                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                                    laudoSelecionado === l.id
                                      ? "border-accent bg-accent/5 ring-1 ring-accent"
                                      : "border-border hover:border-accent/30"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm text-foreground">Laudo {l.numero_laudo}</span>
                                    <Badge variant="secondary" className="text-[10px]">{l.status}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {d1.municipio && `${d1.municipio}/${d1.uf}`}
                                    {Array.isArray(d1.culturas) && ` • ${d1.culturas.join(", ")}`}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {laudos.length === 0 && (
                        <div className="text-center py-4 bg-muted/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Nenhum laudo encontrado para este cliente.</p>
                          <p className="text-xs text-muted-foreground mt-1">Os dados podem ser preenchidos manualmente depois.</p>
                        </div>
                      )}

                      {/* Contract selection */}
                      {contratos.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-foreground">
                              Contratos ({contratosSelecionados.length}/{contratos.length} selecionados)
                            </label>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selecionarTodosContratos}>
                              {contratosSelecionados.length === contratos.length ? "Desmarcar todos" : "Selecionar todos"}
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {contratos.map(c => (
                              <label key={c.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                  contratosSelecionados.includes(c.id)
                                    ? "border-accent bg-accent/5"
                                    : "border-border hover:border-accent/30"
                                }`}
                              >
                                <Checkbox
                                  checked={contratosSelecionados.includes(c.id)}
                                  onCheckedChange={() => toggleContrato(c.id)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground">{c.banco || "Sem banco"}</span>
                                    {c.valor_total_operacao && (
                                      <span className="text-sm font-semibold text-foreground">
                                        R$ {c.valor_total_operacao.toLocaleString("pt-BR")}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {c.numero_contrato || "Sem nº"}
                                    {c.vencimento_proxima_parcela && ` • venc. ${formatDateBR(c.vencimento_proxima_parcela)}`}
                                  </p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {contratos.length === 0 && (
                        <div className="text-center py-4 bg-muted/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Nenhum contrato encontrado na aba Vencimentos.</p>
                        </div>
                      )}

                      {/* Teses (apenas para tipos com teses configuradas, ex.: embargos) */}
                      {(() => {
                        const cfg = TIPOS_PETICAO.find(t => t.id === tipoSelecionado);
                        if (!cfg?.teses) return null;
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-foreground">
                                Teses de defesa ({tesesSelecionadas.length}/{cfg.teses.length})
                              </label>
                              <Button variant="ghost" size="sm" className="text-xs h-7"
                                onClick={() => setTesesSelecionadas(
                                  tesesSelecionadas.length === cfg.teses!.length ? [] : cfg.teses!.map(t => t.id)
                                )}
                              >
                                {tesesSelecionadas.length === cfg.teses.length ? "Desmarcar todas" : "Selecionar todas"}
                              </Button>
                            </div>
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                              {cfg.teses.map(tese => (
                                <label key={tese.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    tesesSelecionadas.includes(tese.id)
                                      ? "border-accent bg-accent/5"
                                      : "border-border hover:border-accent/30"
                                  }`}
                                >
                                  <Checkbox
                                    checked={tesesSelecionadas.includes(tese.id)}
                                    onCheckedChange={() => setTesesSelecionadas(prev =>
                                      prev.includes(tese.id) ? prev.filter(x => x !== tese.id) : [...prev, tese.id]
                                    )}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{tese.nome}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{tese.descricao}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <Button onClick={avancarParaTitulo} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                        Continuar <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Step 4: Title & confirm */}
              {wizardStep === "titulo" && (
                <div className="space-y-4 mt-4">
                  <Button variant="ghost" size="sm" onClick={() => setWizardStep("selecao")}>← Voltar</Button>

                  {/* Summary */}
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Resumo dos dados importados</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Produtor:</span>
                      <span className="text-foreground font-medium">{dadosCaso.produtor || "—"}</span>
                      <span className="text-muted-foreground">CPF:</span>
                      <span className="text-foreground">{dadosCaso.cpf || "—"}</span>
                      <span className="text-muted-foreground">Município:</span>
                      <span className="text-foreground">{dadosCaso.municipio}/{dadosCaso.uf || "—"}</span>
                      <span className="text-muted-foreground">Banco(s):</span>
                      <span className="text-foreground">{dadosCaso.banco || "—"}</span>
                      <span className="text-muted-foreground">Culturas:</span>
                      <span className="text-foreground">{dadosCaso.culturas || "—"}</span>
                      <span className="text-muted-foreground">Laudo:</span>
                      <span className="text-foreground">{dadosCaso.numero_laudo || "—"}</span>
                      <span className="text-muted-foreground">Contratos:</span>
                      <span className="text-foreground">{contratosSelecionados.length} selecionado(s)</span>
                      {dadosCaso.saldo_devedor && (
                        <>
                          <span className="text-muted-foreground">Saldo devedor total:</span>
                          <span className="text-foreground font-medium">R$ {dadosCaso.saldo_devedor}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Título da Petição</label>
                    <Input
                      value={tituloPeticao}
                      onChange={(e) => setTituloPeticao(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <Button onClick={criarPeticao} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    <Plus className="w-4 h-4 mr-2" /> Criar Petição
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

        {/* Template cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIPOS_PETICAO.map(tipo => {
            const Icon = tipo.icon;
            const count = peticoes.filter(p => p.tipo === tipo.id).length;
            return (
              <Card key={tipo.id} className="border-border hover:border-accent/30 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tipo.cor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-foreground">{tipo.nome}</h3>
                    <p className="text-xs text-muted-foreground">{count} documento{count !== 1 ? "s" : ""}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Petition list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : peticoes.length === 0 ? (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold text-foreground mb-1">Nenhuma petição ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie sua primeira petição com dados do cliente importados automaticamente</p>
              <Button onClick={() => setShowNovaModal(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" /> Nova Petição
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {peticoes.map(peticao => {
              const tipo = tipoInfo(peticao.tipo);
              const Icon = tipo?.icon || FileText;
              const secoesGeradas = peticao.secoes.filter(s => s.gerada).length;
              return (
                <motion.div key={peticao.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-border hover:border-accent/30 transition-colors cursor-pointer group"
                    onClick={() => {
                      setPeticaoAtiva(peticao);
                      setSecaoAtiva(0);
                      supabase.from("peticoes").select("metadata").eq("id", peticao.id).single().then(({ data }) => {
                        if (data?.metadata) setDadosCaso(data.metadata as any);
                      });
                    }}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tipo?.cor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate">{peticao.titulo}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px]">{tipo?.nome}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(peticao.created_at).toLocaleDateString("pt-BR")}
                          </span>
                          <span className="text-xs text-muted-foreground">{secoesGeradas}/{peticao.secoes.length} seções</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-destructive"
                        aria-label="Excluir petição"
                        onClick={(e) => { e.stopPropagation(); excluirPeticao(peticao.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
