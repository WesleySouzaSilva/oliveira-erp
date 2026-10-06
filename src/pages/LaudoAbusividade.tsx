import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Scale, Search, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Loader2, Download, FileText, Calculator, BadgeDollarSign, Info,
  Users, ChevronDown, ShieldAlert, Percent, FileWarning, Plus, Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ContratoInput {
  banco: string;
  numeroContrato: string;
  valorOriginal: number;
  taxaContratada: number;
  tipoTaxa: "pre" | "pos_cdi" | "pos_selic" | "pos_ipca";
  spreadContratado: number;
  dataContratacao: string;
  dataVencimento: string;
  finalidade: string;
  enquadramento: "custeio" | "investimento" | "comercializacao";
  // New fields
  jurosMoratorios: number; // % ao mês
  jurosRemuneratoriosMensal: number; // % ao mês
  temSeguroPrestamista: boolean;
  seguroPrestamistaPagina: boolean; // has specific page in contract
  valorSeguro: number;
}

interface AnaliseResult {
  contrato: ContratoInput;
  taxaMediaMercado: number;
  taxaRegulada: number;
  selic: number;
  cdi: number;
  ipca: number;
  diferencaVsMercado: number;
  diferencaVsRegulada: number;
  abusividade: "nenhuma" | "moderada" | "grave";
  fundamentacao: string[];
  valorExcedente: number;
  // New
  alertasMoratorios: string[];
  alertasRemuneratorios: string[];
  alertasSeguro: string[];
}

interface ContratoVencimento {
  id: string;
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  valor_total_operacao: number | null;
}

const enquadramentos = [
  { value: "custeio", label: "Custeio" },
  { value: "investimento", label: "Investimento" },
  { value: "comercializacao", label: "Comercialização" },
];

const tiposTaxa = [
  { value: "pre", label: "Pré-fixada" },
  { value: "pos_cdi", label: "Pós (CDI + spread)" },
  { value: "pos_selic", label: "Pós (Selic + spread)" },
  { value: "pos_ipca", label: "Pós (IPCA + spread)" },
];

const EMPRESA = "Oliveira Agro — Perícias e Pareceres";

const emptyContrato: ContratoInput = {
  banco: "", numeroContrato: "", valorOriginal: 0, taxaContratada: 0,
  tipoTaxa: "pre", spreadContratado: 0, dataContratacao: "", dataVencimento: "",
  finalidade: "", enquadramento: "custeio",
  jurosMoratorios: 0, jurosRemuneratoriosMensal: 0,
  temSeguroPrestamista: false, seguroPrestamistaPagina: false, valorSeguro: 0,
};

export default function LaudoAbusividade() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<ContratoInput[]>([{ ...emptyContrato }]);
  const [contratoAtivo, setContratoAtivo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnaliseResult[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Client search
  const [searchTerm, setSearchTerm] = useState("");
  const [clientes, setClientes] = useState<ContratoVencimento[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const contrato = contratos[contratoAtivo];

  const update = (field: keyof ContratoInput, value: any) => {
    setContratos(prev => {
      const next = [...prev];
      next[contratoAtivo] = { ...next[contratoAtivo], [field]: value };
      return next;
    });
  };

  // Search clients from contratos_vencimentos
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2 || !user) {
      setClientes([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("contratos_vencimentos")
        .select("id, nome_cliente, banco, numero_contrato, valor_total_operacao")
        .eq("user_id", user.id)
        .ilike("nome_cliente", `%${searchTerm}%`)
        .limit(20);
      setClientes(data || []);
      setSearchLoading(false);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, user]);

  const importarContratos = (nomeCliente: string) => {
    const clienteContratos = clientes.filter(c => c.nome_cliente === nomeCliente);
    if (clienteContratos.length === 0) return;

    const novos: ContratoInput[] = clienteContratos.map(c => ({
      ...emptyContrato,
      banco: c.banco || "",
      numeroContrato: c.numero_contrato || "",
      valorOriginal: c.valor_total_operacao || 0,
    }));

    setContratos(novos);
    setContratoAtivo(0);
    setShowDropdown(false);
    setSearchTerm(nomeCliente);
    toast.success(`${novos.length} contrato(s) importado(s) de ${nomeCliente}`);
  };

  const addContrato = () => {
    setContratos(prev => [...prev, { ...emptyContrato }]);
    setContratoAtivo(contratos.length);
  };

  const removeContrato = (index: number) => {
    if (contratos.length <= 1) return;
    setContratos(prev => prev.filter((_, i) => i !== index));
    if (contratoAtivo >= contratos.length - 1) setContratoAtivo(Math.max(0, contratoAtivo - 1));
  };

  const analisar = async () => {
    const c = contratos[contratoAtivo];
    if (!c.banco || !c.taxaContratada || !c.dataContratacao) {
      toast.error("Preencha ao menos Banco, Taxa e Data de Contratação.");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const allResults: AnaliseResult[] = [];

      for (const cont of contratos) {
        if (!cont.banco || !cont.taxaContratada || !cont.dataContratacao) continue;

        const dtContrato = new Date(cont.dataContratacao);
        const dataInicio = `01/${String(dtContrato.getMonth() + 1).padStart(2, "0")}/${dtContrato.getFullYear()}`;
        const dtFim = cont.dataVencimento ? new Date(cont.dataVencimento) : new Date();
        const dataFim = `01/${String(dtFim.getMonth() + 1).padStart(2, "0")}/${dtFim.getFullYear()}`;

        const { data, error } = await supabase.functions.invoke("consultar-sgs", {
          body: {
            series: ["juros_rural_mercado", "juros_rural_regulado", "selic", "cdi", "ipca_12m"],
            dataInicio,
            dataFim,
          },
        });

        if (error) throw error;

        const avg = (arr: any[]) => {
          if (!arr || arr.length === 0) return 0;
          const vals = arr.map((d: any) => parseFloat(d.valor)).filter((v: number) => !isNaN(v));
          return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
        };

        const taxaMercado = avg(data?.series?.juros_rural_mercado || []);
        const taxaRegulada = avg(data?.series?.juros_rural_regulado || []);
        const selic = avg(data?.series?.selic || []);
        const cdi = avg(data?.series?.cdi || []);
        const ipca = avg(data?.series?.ipca_12m || []);

        let taxaEfetiva = cont.taxaContratada;
        if (cont.tipoTaxa === "pos_cdi") taxaEfetiva = cdi + cont.spreadContratado;
        if (cont.tipoTaxa === "pos_selic") taxaEfetiva = selic + cont.spreadContratado;
        if (cont.tipoTaxa === "pos_ipca") taxaEfetiva = ipca + cont.spreadContratado;

        const difMercado = taxaEfetiva - taxaMercado;
        const difRegulada = taxaEfetiva - taxaRegulada;

        let abusividade: "nenhuma" | "moderada" | "grave" = "nenhuma";
        if (difMercado > 2 || difRegulada > 3) abusividade = "moderada";
        if (difMercado > 5 || difRegulada > 6) abusividade = "grave";

        const meses = cont.dataVencimento
          ? Math.max(1, Math.round((dtFim.getTime() - dtContrato.getTime()) / (30 * 24 * 60 * 60 * 1000)))
          : 12;
        const jurosCobrado = cont.valorOriginal * (taxaEfetiva / 100) * (meses / 12);
        const jurosDevido = cont.valorOriginal * (Math.max(taxaMercado, taxaRegulada) / 100) * (meses / 12);
        const excedente = Math.max(0, jurosCobrado - jurosDevido);

        // Fundamentação original
        const fund: string[] = [];
        if (difRegulada > 0) {
          fund.push(`A taxa contratada (${taxaEfetiva.toFixed(2)}% a.a.) excede em ${difRegulada.toFixed(2)} p.p. a taxa média regulada pelo CMN para crédito rural no período (${taxaRegulada.toFixed(2)}% a.a.), conforme dados do SGS/Bacen (série 25433).`);
        }
        if (difMercado > 0) {
          fund.push(`A taxa contratada supera em ${difMercado.toFixed(2)} p.p. a taxa média de mercado para operações de crédito rural com recursos direcionados (${taxaMercado.toFixed(2)}% a.a.), série SGS 20769.`);
        }
        if (cont.enquadramento === "custeio") {
          fund.push(`Operações de custeio rural com recursos controlados possuem teto de juros definido pelo Plano Safra. A extrapolação desse limite configura cobrança abusiva nos termos do art. 4º, § 1º da Lei nº 4.829/65 e Resolução CMN nº 4.883/2020.`);
        }
        if (abusividade !== "nenhuma") {
          fund.push(`Nos termos do art. 51, IV do CDC e art. 39, V do mesmo diploma legal, a cobrança de juros manifestamente superiores à média de mercado é considerada prática abusiva, ensejando a revisão contratual.`);
          fund.push(`O STJ tem jurisprudência consolidada (Súmula 382) de que a estipulação de juros remuneratórios superiores a 12% a.a., por si só, não indica abusividade, devendo-se observar a taxa média de mercado divulgada pelo Banco Central para operações semelhantes.`);
        }
        if (excedente > 0) {
          fund.push(`O valor excedente cobrado a título de juros remuneratórios acima da média de mercado/regulada é estimado em R$ ${excedente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, passível de restituição simples ou em dobro (art. 42, parágrafo único, CDC).`);
        }
        if (fund.length === 0) {
          fund.push(`A taxa contratada encontra-se dentro dos parâmetros de mercado e das taxas reguladas pelo CMN para o período analisado. Não foram identificadas abusividades.`);
        }

        // NEW: Juros moratórios analysis
        const alertasMoratorios: string[] = [];
        if (cont.jurosMoratorios > 1) {
          abusividade = abusividade === "nenhuma" ? "moderada" : abusividade;
          alertasMoratorios.push(
            `JUROS MORATÓRIOS ABUSIVOS: A taxa de juros moratórios contratada (${cont.jurosMoratorios.toFixed(2)}% a.m.) excede o limite legal de 1% ao mês (12% a.a.), conforme art. 406 do Código Civil c/c art. 161, § 1º do CTN. O excesso de ${(cont.jurosMoratorios - 1).toFixed(2)}% a.m. configura cobrança abusiva.`
          );
          alertasMoratorios.push(
            `Conforme jurisprudência consolidada do STJ (REsp 1.061.530/RS), os juros moratórios em operações de crédito rural estão limitados a 1% ao mês, sendo nula a cláusula que estipule taxa superior.`
          );
          const excessoMoratorio = cont.valorOriginal * ((cont.jurosMoratorios - 1) / 100) * meses;
          if (excessoMoratorio > 0) {
            alertasMoratorios.push(
              `Valor estimado cobrado em excesso a título de juros moratórios: R$ ${excessoMoratorio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
            );
          }
        } else if (cont.jurosMoratorios > 0) {
          alertasMoratorios.push(`Juros moratórios de ${cont.jurosMoratorios.toFixed(2)}% a.m. — dentro do limite legal de 1% ao mês.`);
        }

        // NEW: Juros remuneratórios mensais analysis
        const alertasRemuneratorios: string[] = [];
        if (cont.jurosRemuneratoriosMensal > 1) {
          // > 12% a.a. equivalent
          if (abusividade === "nenhuma") abusividade = "moderada";
          if (cont.jurosRemuneratoriosMensal > 1.5) abusividade = "grave";
          alertasRemuneratorios.push(
            `JUROS REMUNERATÓRIOS ELEVADOS: A taxa de juros remuneratórios de ${cont.jurosRemuneratoriosMensal.toFixed(2)}% a.m. equivale a ${(((1 + cont.jurosRemuneratoriosMensal / 100) ** 12 - 1) * 100).toFixed(2)}% a.a. (capitalização composta), superando significativamente o patamar de 12% a.a.`
          );
          alertasRemuneratorios.push(
            `Em operações de crédito rural com recursos controlados, o CMN estabelece teto anual de juros remuneratórios conforme Plano Safra vigente. A taxa contratada excede esse parâmetro, configurando potencial abusividade nos termos do art. 4º da Lei 4.829/65 e art. 51, IV do CDC.`
          );
          alertasRemuneratorios.push(
            `Embora a Súmula 382 do STJ afaste a limitação automática em 12% a.a., no crédito rural a situação é diversa: os juros são regulados pelo CMN e possuem limite definido pelo Plano Safra, de modo que a extrapolação configura descumprimento normativo.`
          );
        } else if (cont.jurosRemuneratoriosMensal > 0) {
          alertasRemuneratorios.push(`Juros remuneratórios de ${cont.jurosRemuneratoriosMensal.toFixed(2)}% a.m. (${(((1 + cont.jurosRemuneratoriosMensal / 100) ** 12 - 1) * 100).toFixed(2)}% a.a.) — dentro do limite de 12% a.a.`);
        }

        // NEW: Seguro prestamista analysis
        const alertasSeguro: string[] = [];
        if (cont.temSeguroPrestamista) {
          if (!cont.seguroPrestamistaPagina) {
            if (abusividade === "nenhuma") abusividade = "moderada";
            alertasSeguro.push(
              `SEGURO PRESTAMISTA SEM PÁGINA ESPECÍFICA: O contrato contém seguro prestamista, porém NÃO apresenta página específica de contratação com detalhamento das condições, coberturas, prêmio e seguradora. A ausência de informação clara e destacada sobre a contratação do seguro configura venda casada (art. 39, I do CDC) e/ou falta de informação adequada (art. 6º, III do CDC).`
            );
            alertasSeguro.push(
              `O STJ (REsp 1.639.259/SP) consolidou entendimento de que a contratação de seguro prestamista deve ser feita de forma livre e informada, com possibilidade de escolha da seguradora pelo mutuário. A ausência de página específica indicia imposição unilateral.`
            );
            alertasSeguro.push(
              `O Bacen, por meio da Resolução nº 4.893/2021, determina que a contratação de seguros vinculados a operações de crédito deve ser transparente, com informações claras sobre prêmio, cobertura e direito de escolha.`
            );
          } else {
            alertasSeguro.push(`Seguro prestamista contratado com página específica de detalhamento. Verificar se houve livre escolha da seguradora pelo mutuário.`);
          }
          if (cont.valorSeguro > 0) {
            const percentualSeguro = (cont.valorSeguro / cont.valorOriginal) * 100;
            if (percentualSeguro > 5) {
              alertasSeguro.push(
                `O valor do seguro prestamista (R$ ${cont.valorSeguro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — ${percentualSeguro.toFixed(2)}% do valor da operação) é proporcionalmente elevado, devendo ser objeto de questionamento quanto à razoabilidade do prêmio.`
              );
            }
          }
        }

        allResults.push({
          contrato: cont,
          taxaMediaMercado: taxaMercado,
          taxaRegulada,
          selic, cdi, ipca,
          diferencaVsMercado: difMercado,
          diferencaVsRegulada: difRegulada,
          abusividade,
          fundamentacao: fund,
          valorExcedente: excedente,
          alertasMoratorios,
          alertasRemuneratorios,
          alertasSeguro,
        });
      }

      setResults(allResults);
      toast.success(`Análise concluída para ${allResults.length} contrato(s)!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar dados do Bacen");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const result = results[contratoAtivo] || null;

  const generateHTML = () => {
    if (!results.length) return "";
    const today = new Date().toLocaleDateString("pt-BR");

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Georgia','Times New Roman',serif; font-size:12pt; color:#1a1a1a; line-height:1.7; }
  .page { max-width:210mm; margin:0 auto; padding:40px 55px; }
  .header-bar { border-bottom:3px solid #8B1A1A; padding-bottom:18px; margin-bottom:30px; display:flex; justify-content:space-between; align-items:flex-end; }
  .header-bar h1 { font-size:18pt; color:#8B1A1A; font-weight:700; }
  .header-bar .sub { font-size:10pt; color:#666; margin-top:2px; }
  .header-bar .right { text-align:right; font-size:9pt; color:#888; }
  .badge { display:inline-block; background:#8B1A1A; color:#fff; font-size:8pt; font-weight:700; padding:3px 10px; border-radius:3px; text-transform:uppercase; }
  .section { margin-bottom:22px; }
  .section h2 { font-size:13pt; color:#8B1A1A; border-bottom:1px solid #ddd; padding-bottom:5px; margin-bottom:10px; font-weight:700; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 24px; }
  .info-grid .item { display:flex; gap:6px; font-size:11pt; }
  .info-grid .item .label { color:#666; min-width:160px; }
  .info-grid .item .value { font-weight:600; }
  table { width:100%; border-collapse:collapse; margin:10px 0; }
  th { background:#8B1A1A; color:#fff; font-size:9pt; padding:8px 10px; text-align:left; text-transform:uppercase; }
  td { padding:7px 10px; border-bottom:1px solid #eee; font-size:10pt; }
  tr:nth-child(even) { background:#faf5f5; }
  .alert-box { border:2px solid #dc2626; border-radius:8px; padding:16px 20px; margin:16px 0; background:#fef2f2; }
  .alert-box.warn { border-color:#d97706; background:#fffbeb; }
  .alert-box.ok { border-color:#16a34a; background:#f0fdf4; }
  .conclusion-box { border:2px solid #8B1A1A; border-radius:8px; padding:18px 22px; margin:20px 0; background:#fdf5f5; }
  .conclusion-box h3 { color:#8B1A1A; font-size:12pt; margin-bottom:8px; }
  .signature-block { text-align:center; margin-top:50px; }
  .signature-line { width:280px; border-top:1px solid #333; margin:0 auto 6px; }
  .footer { text-align:center; margin-top:30px; padding-top:12px; border-top:1px solid #eee; font-size:8pt; color:#999; }
  .highlight { background:#fef2f2; padding:2px 6px; border-radius:3px; font-weight:700; color:#dc2626; }
  .page-break { page-break-before:always; }
</style>
</head><body>
<div class="page">
  <div class="header-bar">
    <div>
      <h1>Laudo Contábil de Abusividade</h1>
      <div class="sub">Análise de Encargos Financeiros — Crédito Rural</div>
      <div class="sub">${searchTerm ? `Cliente: ${searchTerm}` : ""} • ${results.length} contrato(s) analisado(s)</div>
    </div>
    <div class="right">
      <span class="badge">PARECER TÉCNICO</span><br>
      <span style="margin-top:4px;display:block">Emitido em ${today}</span>
    </div>
  </div>`;

    results.forEach((r, idx) => {
      const taxaEfetiva = r.contrato.tipoTaxa === "pre" ? r.contrato.taxaContratada :
        r.contrato.tipoTaxa === "pos_cdi" ? r.cdi + r.contrato.spreadContratado :
        r.contrato.tipoTaxa === "pos_selic" ? r.selic + r.contrato.spreadContratado :
        r.ipca + r.contrato.spreadContratado;

      if (idx > 0) html += `<div class="page-break"></div>`;

      html += `
  <div class="section">
    <h2>Contrato ${idx + 1}: ${r.contrato.banco} — nº ${r.contrato.numeroContrato || "N/I"}</h2>
    <div class="info-grid">
      <div class="item"><span class="label">Valor original:</span><span class="value">${formatCurrency(r.contrato.valorOriginal)}</span></div>
      <div class="item"><span class="label">Enquadramento:</span><span class="value">${r.contrato.enquadramento}</span></div>
      <div class="item"><span class="label">Taxa contratada:</span><span class="value">${r.contrato.taxaContratada.toFixed(2)}% a.a.</span></div>
      <div class="item"><span class="label">Juros moratórios:</span><span class="value">${r.contrato.jurosMoratorios.toFixed(2)}% a.m.</span></div>
      <div class="item"><span class="label">Juros remuneratórios:</span><span class="value">${r.contrato.jurosRemuneratoriosMensal.toFixed(2)}% a.m.</span></div>
      <div class="item"><span class="label">Seguro prestamista:</span><span class="value">${r.contrato.temSeguroPrestamista ? (r.contrato.seguroPrestamistaPagina ? "Sim, com página" : "Sim, SEM página") : "Não"}</span></div>
    </div>
  </div>`;

      // Alertas
      const allAlertas = [...r.alertasMoratorios, ...r.alertasRemuneratorios, ...r.alertasSeguro];
      if (allAlertas.length > 0) {
        html += `<div class="section"><h2>Alertas Específicos</h2>`;
        allAlertas.forEach(a => {
          const isAbusivo = a.includes("ABUSIV") || a.includes("SEM PÁGINA") || a.includes("ELEVAD");
          html += `<div class="alert-box${isAbusivo ? "" : " warn"}"><p style="font-size:11pt">${a}</p></div>`;
        });
        html += `</div>`;
      }

      // Taxas
      html += `
  <div class="section">
    <h2>Taxas de Referência — SGS/Bacen</h2>
    <table>
      <thead><tr><th>Indicador</th><th>Série</th><th>Média (% a.a.)</th></tr></thead>
      <tbody>
        <tr><td>Taxa média mercado (rural)</td><td>20769</td><td>${r.taxaMediaMercado.toFixed(2)}%</td></tr>
        <tr><td>Taxa regulada (CMN)</td><td>25433</td><td>${r.taxaRegulada.toFixed(2)}%</td></tr>
        <tr><td>Selic</td><td>432</td><td>${r.selic.toFixed(2)}%</td></tr>
        <tr><td>CDI</td><td>4392</td><td>${r.cdi.toFixed(2)}%</td></tr>
        <tr><td>IPCA 12m</td><td>13522</td><td>${r.ipca.toFixed(2)}%</td></tr>
      </tbody>
    </table>
  </div>`;

      // Conclusão
      html += `<div class="conclusion-box"><h3>PARECER — Contrato ${idx + 1}</h3>`;
      if (r.abusividade === "nenhuma") {
        html += `<p>Não foram identificados indícios de abusividade neste contrato.</p>`;
      } else {
        html += `<p>Identificados indícios de cobrança <strong>${r.abusividade === "grave" ? "gravemente abusiva" : "acima dos parâmetros"}</strong>. Valor excedente estimado: <strong>${formatCurrency(r.valorExcedente)}</strong>.</p>`;
      }
      r.fundamentacao.forEach(f => { html += `<p style="margin-top:8px;font-size:10pt">${f}</p>`; });
      html += `</div>`;
    });

    html += `
  <div class="signature-block">
    <div class="signature-line"></div>
    <div style="font-weight:700">PERITO CONTÁBIL / AGRÔNOMO</div>
    <div style="font-size:9pt;color:#666">${EMPRESA}</div>
    <div style="font-size:9pt;color:#888;margin-top:4px">${today}</div>
  </div>
  <div class="footer">${EMPRESA} • Dados do SGS — Banco Central do Brasil • Emitido em ${today}</div>
</div></body></html>`;

    return html;
  };

  const handleDownload = () => {
    const html = generateHTML();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laudo_Abusividade_${searchTerm || "contrato"}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Laudo exportado!");
  };

  return (
    <AppLayout>
      <PageHeader
        icon={Scale}
        title="Laudo de Abusividade Contratual"
        subtitle="Análise de encargos financeiros com dados oficiais do SGS/Bacen — juros, mora e seguros."
        breadcrumb={[{ label: "Agro" }, { label: "Abusividade" }]}
      />

      {/* Client search */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
        className="bg-card rounded-lg border border-border shadow-card p-4 mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Buscar Cliente</h2>
          <Badge variant="secondary" className="text-[10px]">Importa contratos cadastrados</Badge>
        </div>
        <div className="relative">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite o nome do cliente para importar contratos..."
            className="pr-8"
          />
          {searchLoading && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}

          {showDropdown && clientes.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {/* Group by client name */}
              {[...new Set(clientes.map(c => c.nome_cliente))].map(nome => {
                const count = clientes.filter(c => c.nome_cliente === nome).length;
                return (
                  <button
                    key={nome}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors flex items-center justify-between text-sm"
                    onClick={() => importarContratos(nome)}
                  >
                    <span className="font-medium text-foreground">{nome}</span>
                    <Badge variant="secondary" className="text-[10px]">{count} contrato(s)</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-lg border border-border shadow-card p-5 space-y-4"
        >
          {/* Contract tabs */}
          {contratos.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap mb-2">
              {contratos.map((_, i) => (
                <div key={i} className="flex items-center">
                  <button
                    onClick={() => setContratoAtivo(i)}
                    className={`px-3 py-1 rounded-l-lg text-xs font-medium transition-colors ${
                      contratoAtivo === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Contrato {i + 1}
                  </button>
                  {contratos.length > 1 && (
                    <button
                      onClick={() => removeContrato(i)}
                      className="px-1.5 py-1 rounded-r-lg bg-muted text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addContrato} className="px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 text-xs">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Dados do Contrato</h2>
            {contratos.length === 1 && (
              <button onClick={addContrato} className="ml-auto text-xs text-accent hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Adicionar contrato
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="floating-label-group">
              <input type="text" placeholder=" " value={contrato.banco} onChange={(e) => update("banco", e.target.value)} />
              <label>Banco / Instituição</label>
            </div>
            <div className="floating-label-group">
              <input type="text" placeholder=" " value={contrato.numeroContrato} onChange={(e) => update("numeroContrato", e.target.value)} />
              <label>Nº Contrato</label>
            </div>
            <div className="floating-label-group">
              <input type="number" placeholder=" " value={contrato.valorOriginal || ""} onChange={(e) => update("valorOriginal", parseFloat(e.target.value) || 0)} />
              <label>Valor original (R$)</label>
            </div>
            <div className="floating-label-group">
              <select value={contrato.enquadramento} onChange={(e) => update("enquadramento", e.target.value)}>
                {enquadramentos.map((e) => (<option key={e.value} value={e.value}>{e.label}</option>))}
              </select>
              <label>Enquadramento</label>
            </div>
            <div className="floating-label-group">
              <input type="text" placeholder=" " value={contrato.finalidade} onChange={(e) => update("finalidade", e.target.value)} />
              <label>Finalidade</label>
            </div>
            <div className="floating-label-group">
              <select value={contrato.tipoTaxa} onChange={(e) => update("tipoTaxa", e.target.value)}>
                {tiposTaxa.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
              <label>Tipo de taxa</label>
            </div>
            <div className="floating-label-group">
              <input type="number" step="0.01" placeholder=" " value={contrato.taxaContratada || ""} onChange={(e) => update("taxaContratada", parseFloat(e.target.value) || 0)} />
              <label>Taxa contratada (% a.a.)</label>
            </div>
            {contrato.tipoTaxa !== "pre" && (
              <div className="floating-label-group">
                <input type="number" step="0.01" placeholder=" " value={contrato.spreadContratado || ""} onChange={(e) => update("spreadContratado", parseFloat(e.target.value) || 0)} />
                <label>Spread (% a.a.)</label>
              </div>
            )}
            <div className="floating-label-group">
              <input type="date" placeholder=" " value={contrato.dataContratacao} onChange={(e) => update("dataContratacao", e.target.value)} />
              <label>Data contratação</label>
            </div>
            <div className="floating-label-group">
              <input type="date" placeholder=" " value={contrato.dataVencimento} onChange={(e) => update("dataVencimento", e.target.value)} />
              <label>Data vencimento</label>
            </div>
          </div>

          {/* NEW: Additional analysis fields */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">Análise Adicional</h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="floating-label-group">
                <input type="number" step="0.01" placeholder=" " value={contrato.jurosMoratorios || ""}
                  onChange={(e) => update("jurosMoratorios", parseFloat(e.target.value) || 0)} />
                <label>Juros moratórios (% a.m.)</label>
              </div>
              <div className="floating-label-group">
                <input type="number" step="0.01" placeholder=" " value={contrato.jurosRemuneratoriosMensal || ""}
                  onChange={(e) => update("jurosRemuneratoriosMensal", parseFloat(e.target.value) || 0)} />
                <label>Juros remuneratórios (% a.m.)</label>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <FileWarning className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">Tem seguro prestamista?</Label>
                </div>
                <Switch
                  checked={contrato.temSeguroPrestamista}
                  onCheckedChange={(v) => update("temSeguroPrestamista", v)}
                />
              </div>

              {contrato.temSeguroPrestamista && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                    <div>
                      <Label className="text-sm">Página específica de contratação do seguro?</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">O contrato tem uma página dedicada ao seguro?</p>
                    </div>
                    <Switch
                      checked={contrato.seguroPrestamistaPagina}
                      onCheckedChange={(v) => update("seguroPrestamistaPagina", v)}
                    />
                  </div>
                  <div className="floating-label-group">
                    <input type="number" step="0.01" placeholder=" " value={contrato.valorSeguro || ""}
                      onChange={(e) => update("valorSeguro", parseFloat(e.target.value) || 0)} />
                    <label>Valor do seguro (R$)</label>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0" />
            <span>Taxas do <strong>SGS/Bacen</strong> + verificação de juros moratórios (&gt;1% a.m.), remuneratórios (&gt;12% a.a.) e seguro prestamista.</span>
          </div>

          <button
            onClick={analisar}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Consultando SGS/Bacen..." : `Analisar ${contratos.length > 1 ? `${contratos.length} Contratos` : "Abusividade"}`}
          </button>
        </motion.div>

        {/* Results */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4">
          {result ? (
            <>
              {/* Classification */}
              <div className={`rounded-lg border-2 p-5 ${
                result.abusividade === "grave" ? "border-destructive bg-destructive/5" :
                result.abusividade === "moderada" ? "border-warning bg-warning/5" :
                "border-success bg-success/5"
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {result.abusividade === "nenhuma" ? (
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  ) : (
                    <AlertTriangle className={`w-8 h-8 ${result.abusividade === "grave" ? "text-destructive" : "text-warning"}`} />
                  )}
                  <div>
                    <h3 className="font-display font-bold text-foreground text-lg">
                      {result.abusividade === "nenhuma" ? "Sem indícios de abusividade" :
                       result.abusividade === "moderada" ? "Indícios de cobrança acima do regulado" :
                       "Abusividade grave identificada"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {contrato.banco} — Contrato {contrato.numeroContrato || "N/I"}
                    </p>
                  </div>
                </div>

                {result.valorExcedente > 0 && (
                  <div className="bg-card rounded-lg p-4 border border-border mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Valor excedente estimado</p>
                    <p className="text-2xl font-display font-bold text-destructive">{formatCurrency(result.valorExcedente)}</p>
                  </div>
                )}
              </div>

              {/* New alerts section */}
              {(result.alertasMoratorios.length > 0 || result.alertasRemuneratorios.length > 0 || result.alertasSeguro.length > 0) && (
                <div className="bg-card rounded-lg border border-border shadow-card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-destructive" />
                    Alertas de Abusividade
                  </h3>

                  {result.alertasMoratorios.map((a, i) => (
                    <div key={`m-${i}`} className={`p-3 rounded-lg text-xs leading-relaxed ${
                      a.includes("ABUSIV") ? "bg-destructive/10 border border-destructive/30 text-destructive" :
                      "bg-success/10 border border-success/30 text-foreground"
                    }`}>
                      <div className="flex items-start gap-2">
                        <Percent className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </div>
                    </div>
                  ))}

                  {result.alertasRemuneratorios.map((a, i) => (
                    <div key={`r-${i}`} className={`p-3 rounded-lg text-xs leading-relaxed ${
                      a.includes("ELEVAD") ? "bg-destructive/10 border border-destructive/30 text-destructive" :
                      a.includes("potencial") ? "bg-warning/10 border border-warning/30 text-foreground" :
                      "bg-success/10 border border-success/30 text-foreground"
                    }`}>
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </div>
                    </div>
                  ))}

                  {result.alertasSeguro.map((a, i) => (
                    <div key={`s-${i}`} className={`p-3 rounded-lg text-xs leading-relaxed ${
                      a.includes("SEM PÁGINA") || a.includes("imposição") ? "bg-destructive/10 border border-destructive/30 text-destructive" :
                      a.includes("elevado") ? "bg-warning/10 border border-warning/30 text-foreground" :
                      "bg-muted border border-border text-foreground"
                    }`}>
                      <div className="flex items-start gap-2">
                        <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rates comparison */}
              <div className="bg-card rounded-lg border border-border shadow-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BadgeDollarSign className="w-4 h-4 text-primary" />
                  Comparativo de Taxas
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Taxa contratada", value: result.contrato.taxaContratada },
                    { label: "Média mercado (rural)", value: result.taxaMediaMercado, diff: result.diferencaVsMercado },
                    { label: "Taxa regulada (CMN)", value: result.taxaRegulada, diff: result.diferencaVsRegulada },
                    { label: "Selic", value: result.selic },
                    { label: "CDI", value: result.cdi },
                    { label: "IPCA 12m", value: result.ipca },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{item.value.toFixed(2)}%</span>
                        {"diff" in item && item.diff !== undefined && (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            item.diff > 2 ? "bg-destructive/10 text-destructive" :
                            item.diff > 0 ? "bg-warning/10 text-warning" :
                            "bg-success/10 text-success"
                          }`}>
                            {item.diff > 0 ? (
                              <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{item.diff.toFixed(2)}</span>
                            ) : (
                              <span className="flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{item.diff.toFixed(2)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-contract selector */}
              {results.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => setContratoAtivo(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        contratoAtivo === i ? "bg-primary text-primary-foreground" :
                        r.abusividade === "grave" ? "bg-destructive/10 text-destructive border border-destructive/30" :
                        r.abusividade === "moderada" ? "bg-warning/10 text-warning border border-warning/30" :
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.contrato.banco} {r.abusividade !== "nenhuma" ? "⚠️" : "✅"}
                    </button>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  <FileText className="w-4 h-4" /> Prévia do Laudo
                </button>
                <button onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all"
                >
                  <Download className="w-4 h-4" /> Exportar Laudo
                </button>
              </div>
            </>
          ) : (
            <div className="bg-card rounded-lg border border-border shadow-card p-8 text-center">
              <Scale className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Busque um cliente para importar contratos ou preencha manualmente. A análise verifica:
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 text-left max-w-sm mx-auto">
                {[
                  "Juros remuneratórios vs. média SGS/Bacen",
                  "Juros moratórios acima de 1% ao mês",
                  "Juros remuneratórios acima de 12% a.a.",
                  "Seguro prestamista com/sem página específica",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Preview Modal */}
      {showPreview && results.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setShowPreview(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-lg shadow-card-hover max-w-4xl w-full max-h-[90vh] overflow-y-auto z-10"
          >
            <button onClick={() => setShowPreview(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10 bg-white rounded-full p-1"
            >✕</button>
            <div dangerouslySetInnerHTML={{ __html: generateHTML() }} />
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
