import { lerTudo } from "@/lib/lerTudo";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRecorteEquipe, SEM_LIDERADOS_MSG } from "@/hooks/useSubordinados";
import { motion } from "framer-motion";
import { FileText, Download, Search, Filter, FileSpreadsheet, FileBarChart } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";


interface ClienteResumo {
  nome: string;
  contratos: any[];
  laudos: any[];
  processos: any[];
  movimentacoes: any[];
  tarefas: any[];
  tarefasHistorico: any[];
  totalOperacoes: number;
  contratosVencidos: number;
  contratosEmDia: number;
  temLaudo: boolean;
  perfil: any | null;
  atividades: any[];
}

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function Relatorios() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<any[]>([]);
  const [laudos, setLaudos] = useState<any[]>([]);
  const [processos, setProcessos] = useState<any[]>([]);
  const [allMovimentacoes, setAllMovimentacoes] = useState<any[]>([]);
  const [allTarefas, setAllTarefas] = useState<any[]>([]);
  const [allTarefasHistorico, setAllTarefasHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({ search: "" });
  const { search } = filters;
  const [selectedCliente, setSelectedCliente] = useState<ClienteResumo | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<"extrato" | "periodico">("extrato");
  const [profileData, setProfileData] = useState<any>(null);
  const [clientesPerfil, setClientesPerfil] = useState<any[]>([]);
  const [atividadesClientes, setAtividadesClientes] = useState<any[]>([]);
  

  const recorte = useRecorteEquipe();
  const recorteRef = useRef(recorte);
  recorteRef.current = recorte;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [contratosRes, laudosRes, processosRes, profileRes, movsRes, tarefasRes, histRes, clientesRes, atividadesRes] = await Promise.all([
        lerTudo(() => supabase.from("contratos_vencimentos").select("*")),
        supabase.from("laudos").select("id, numero_laudo, status, created_at, dados_etapa1, dados_etapa2, dados_etapa3"),
        lerTudo(() => supabase.from("processos").select("*, laudos(numero_laudo, dados_etapa1)")),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("movimentacoes").select("*").order("created_at", { ascending: false }),
        lerTudo(() => supabase.from("tarefas" as any).select("*").order("data_vencimento", { ascending: true })),
        supabase.from("tarefas_historico" as any).select("*").order("data_acao", { ascending: false }),
        lerTudo(() => supabase.from("clientes").select("*")),
        supabase.from("atividades_clientes").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      ]);
      // Coordenador: recorte de tela para os liderados diretos (RLS inalterado).
      const filtra = (rows: any[] | null) =>
        (rows || []).filter((r: any) => (r?.user_id === undefined ? true : recorteRef.current.permite(r.user_id)));
      if (contratosRes.data) setContratos(filtra(contratosRes.data) as any);
      if (laudosRes.data) setLaudos(filtra(laudosRes.data) as any);
      if (processosRes.data) setProcessos(filtra(processosRes.data) as any);
      if (profileRes.data) setProfileData(profileRes.data);
      if (movsRes.data) setAllMovimentacoes(filtra(movsRes.data) as any);
      if (tarefasRes.data) setAllTarefas(tarefasRes.data as any[]);
      if (histRes.data) setAllTarefasHistorico(histRes.data as any[]);
      if (clientesRes.data) setClientesPerfil(filtra(clientesRes.data) as any);
      if (atividadesRes.data) setAtividadesClientes(filtra(atividadesRes.data) as any);
      setLoading(false);
    };
    load();
  }, [user, recorte.enabled, recorte.loading, recorte.subordinadoIds.length]);

  const clientes = useMemo(() => {
    const map = new Map<string, ClienteResumo>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to normalize names for matching
    const normalize = (n: string) => n?.trim().toLowerCase().replace(/\s+/g, " ") || "";

    // Build perfil lookup by normalized name
    const perfilMap = new Map<string, any>();
    for (const p of clientesPerfil) {
      if (p?.nome) perfilMap.set(normalize(p.nome), p);
    }

    const ensureCliente = (nome: string) => {
      if (!map.has(nome)) {
        map.set(nome, {
          nome,
          contratos: [],
          laudos: [],
          processos: [],
          movimentacoes: [],
          tarefas: [],
          tarefasHistorico: [],
          totalOperacoes: 0,
          contratosVencidos: 0,
          contratosEmDia: 0,
          temLaudo: false,
          perfil: perfilMap.get(normalize(nome)) || null,
          atividades: [],
        });
      }
      return map.get(nome)!;
    };

    contratos.forEach((c) => {
      const nome = c.nome_cliente;
      const cliente = ensureCliente(nome);
      cliente.contratos.push(c);
      cliente.totalOperacoes += c.valor_total_operacao || 0;
      if (c.possui_laudo) cliente.temLaudo = true;

      if (c.vencimento_proxima_parcela && (() => {
        const [y, m, d] = c.vencimento_proxima_parcela.split("T")[0].split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1) < today;
      })()) {
        cliente.contratosVencidos++;
      } else {
        cliente.contratosEmDia++;
      }

      // Also match processos via laudo_id from contrato
      if (c.laudo_id) {
        const linkedProcessos = processos.filter((p: any) => p.laudo_id === c.laudo_id);
        linkedProcessos.forEach((p: any) => {
          if (!cliente.processos.some((ep: any) => ep.id === p.id)) {
            cliente.processos.push(p);
            const procMovs = allMovimentacoes.filter((m: any) => m.processo_id === p.id);
            cliente.movimentacoes.push(...procMovs);
          }
        });
      }
    });

    // Ensure clients from "clientes" table also appear, even without contracts
    clientesPerfil.forEach((p: any) => {
      if (p?.nome) ensureCliente(p.nome);
    });

    // Match laudos by produtor name (fuzzy)
    laudos.forEach((l) => {
      const d = l.dados_etapa1 as Record<string, any> | null;
      const produtorName = d?.nome;
      if (!produtorName) return;

      // Exact match first
      if (map.has(produtorName)) {
        map.get(produtorName)!.laudos.push(l);
        return;
      }
      // Fuzzy match
      const normalizedProdutor = normalize(produtorName);
      for (const [key, cliente] of map.entries()) {
        if (normalize(key) === normalizedProdutor) {
          cliente.laudos.push(l);
          break;
        }
      }
    });

    // Match processos by laudo linkage (for those not yet linked via contrato)
    processos.forEach((p: any) => {
      const laudoData = p.laudos;
      const produtorName = laudoData?.dados_etapa1?.nome;
      if (!produtorName) return;

      const normalizedProdutor = normalize(produtorName);
      for (const [key, cliente] of map.entries()) {
        if (normalize(key) === normalizedProdutor || key === produtorName) {
          if (!cliente.processos.some((ep: any) => ep.id === p.id)) {
            cliente.processos.push(p);
            const procMovs = allMovimentacoes.filter((m: any) => m.processo_id === p.id);
            cliente.movimentacoes.push(...procMovs);
          }
          break;
        }
      }
    });

    // Match tarefas by nome_cliente (fuzzy)
    allTarefas.forEach((t: any) => {
      if (!t.nome_cliente) return;
      if (map.has(t.nome_cliente)) {
        map.get(t.nome_cliente)!.tarefas.push(t);
        return;
      }
      const normalizedTask = normalize(t.nome_cliente);
      for (const [key, cliente] of map.entries()) {
        if (normalize(key) === normalizedTask) {
          cliente.tarefas.push(t);
          break;
        }
      }
    });

    // Match historical tasks by nome_cliente
    allTarefasHistorico.forEach((t: any) => {
      if (!t.nome_cliente) return;
      const normalizedTask = normalize(t.nome_cliente);
      for (const [key, cliente] of map.entries()) {
        if (key === t.nome_cliente || normalize(key) === normalizedTask) {
          cliente.tarefasHistorico.push(t);
          break;
        }
      }
    });

    // Match atividades_clientes by nome_cliente
    atividadesClientes.forEach((a: any) => {
      if (!a.nome_cliente) return;
      const normalizedAt = normalize(a.nome_cliente);
      for (const [key, cliente] of map.entries()) {
        if (key === a.nome_cliente || normalize(key) === normalizedAt) {
          cliente.atividades.push(a);
          break;
        }
      }
    });

    return Array.from(map.values())
      .filter((c) => !search || c.nome.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [contratos, laudos, processos, allMovimentacoes, allTarefas, allTarefasHistorico, clientesPerfil, atividadesClientes, search]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string | null) => formatDateBR(d);

  const getWorkflowStatus = (cliente: ClienteResumo) => {
    const steps = [
      { label: "Laudo Técnico", key: "1" },
      { label: "Notificação Extrajudicial", key: "2" },
      { label: "Aguardo de Resposta", key: "3" },
      { label: "Via Judicial", key: "4" },
      { label: "Encerrado", key: "5" },
    ];

    const hasProcesso = cliente.processos.length > 0;

    if (hasProcesso) {
      const processo = cliente.processos[0];
      const statusFases = (processo.status_fases || {}) as Record<string, string>;
      const faseAtual = parseInt(processo.fase_atual || "1");
      const datasFases = (processo.datas_fases || {}) as Record<string, string>;

      const stepStatuses = steps.map((s, i) => {
        const faseKey = String(i + 1);
        const status = statusFases[faseKey] || "pendente";
        const dataInicio = datasFases[faseKey] || null;
        // Get tasks for this phase (active + historical)
        const faseTarefas = cliente.tarefas.filter((t: any) => t.fase === faseKey && t.processo_id === processo.id);
        const faseHistorico = cliente.tarefasHistorico.filter((t: any) => t.fase === faseKey && t.processo_id === processo.id);
        // Get movimentações for this phase
        const faseMovs = cliente.movimentacoes.filter((m: any) => m.fase === faseKey);
        return { ...s, status, dataInicio, tarefas: faseTarefas, historico: faseHistorico, movimentacoes: faseMovs };
      });

      return { steps: stepStatuses, currentStep: faseAtual - 1, hasProcess: true };
    }

    // No process — check if laudo exists
    const hasLaudo = cliente.laudos.some((l) => l.status === "finalizado" || l.status === "exportado");
    const stepStatuses = steps.map((s, i) => ({
      ...s,
      status: i === 0 && hasLaudo ? "concluida" : i === 0 ? "em_andamento" : "pendente",
      dataInicio: null as string | null,
      tarefas: [] as any[],
      historico: [] as any[],
      movimentacoes: [] as any[],
    }));

    return { steps: stepStatuses, currentStep: hasLaudo ? 1 : 0, hasProcess: false };
  };

  const generatePDFContent = (cliente: ClienteResumo, type: "extrato" | "periodico") => {
    const today = new Date().toLocaleDateString("pt-BR");
    const profNome = profileData?.nome || "Profissional";
    const crea = profileData?.crea_numero ? `CREA ${profileData.crea_uf}-${profileData.crea_numero}` : "";

    // HTML-escape para impedir XSS via valores do banco
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Qualificação consolidada
    const p = cliente.perfil || {};
    const qualificacaoFields: Array<[string, any]> = [
      ["CPF/CNPJ", p.cpf_cnpj],
      ["RG", p.rg],
      ["Nacionalidade", p.nacionalidade],
      ["Estado Civil", p.estado_civil],
      ["Profissão", p.profissao],
      ["Telefone", p.telefone],
      ["E-mail", p.email],
      ["Endereço", p.endereco],
      ["Município/UF", [p.municipio, p.uf].filter(Boolean).join(" / ")],
      ["CEP", p.cep],
      ["Propriedade", p.nome_propriedade],
      ["Área (ha)", p.area_hectares],
      ["Cultura Principal", p.cultura_principal],
    ].filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "") as Array<[string, any]>;

    const qualificacaoHTML = qualificacaoFields.length > 0 ? `
      <div class="section">
        <h2>📇 Qualificação do Cliente</h2>
        <table>
          <tbody>
            ${qualificacaoFields.map(([label, value]) => `
              <tr>
                <td style="width:32%;background:#f8f9fa;font-weight:600;color:#374151;font-size:11px">${label}</td>
                <td>${esc(value)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${p.observacoes ? `<p style="margin-top:8px;font-size:11px;color:#555;font-style:italic"><strong>Observações:</strong> ${esc(p.observacoes)}</p>` : ""}
      </div>
    ` : "";

    // Resumo executivo automático (sem IA, baseado nos dados consolidados)
    const resumoLinhas: string[] = [];
    const nomeCurto = cliente.nome.split(" ")[0];
    if (qualificacaoFields.length > 0) {
      const partes: string[] = [];
      if (p.profissao) partes.push(esc(String(p.profissao).toLowerCase()));
      if (p.municipio || p.uf) partes.push(`com sede em ${esc([p.municipio, p.uf].filter(Boolean).join("/"))}`);
      if (p.nome_propriedade) partes.push(`proprietário(a) de "${esc(p.nome_propriedade)}"`);
      if (p.area_hectares) partes.push(`com área de ${esc(p.area_hectares)} ha`);
      if (p.cultura_principal) partes.push(`cultivo principal de ${esc(p.cultura_principal)}`);
      if (partes.length > 0) {
        resumoLinhas.push(`${esc(cliente.nome)} é ${partes.join(", ")}.`);
      }
    }
    if (cliente.contratos.length > 0) {
      const bancos = Array.from(new Set(cliente.contratos.map((c: any) => c.banco).filter(Boolean)));
      resumoLinhas.push(
        `Possui ${cliente.contratos.length} contrato(s) ${bancos.length > 0 ? `junto a ${esc(bancos.join(", "))}` : ""}, ` +
        `totalizando ${formatCurrency(cliente.totalOperacoes)}` +
        `${cliente.contratosVencidos > 0 ? `, sendo ${cliente.contratosVencidos} com parcela vencida` : ""}.`
      );
    }
    if (cliente.laudos.length > 0) {
      const finalizados = cliente.laudos.filter((l: any) => l.status === "finalizado" || l.status === "exportado").length;
      resumoLinhas.push(`Foram elaborados ${cliente.laudos.length} laudo(s) técnico(s)${finalizados > 0 ? ` (${finalizados} finalizado(s))` : ""}.`);
    }
    if (cliente.processos.length > 0) {
      const proc = cliente.processos[0];
      const fase = parseInt(proc.fase_atual || "1");
      const faseLabels: Record<number, string> = { 1: "Laudo Técnico", 2: "Notificação Extrajudicial", 3: "Aguardo de Resposta", 4: "Via Judicial", 5: "Encerrado" };
      resumoLinhas.push(`O caso encontra-se na fase ${fase} — ${faseLabels[fase] || "em andamento"}.`);
    }
    if (cliente.atividades.length > 0) {
      resumoLinhas.push(`Foram registradas ${cliente.atividades.length} atividade(s) de atendimento até o momento.`);
    }

    const resumoHTML = resumoLinhas.length > 0 ? `
      <div class="section">
        <h2>📝 Resumo Executivo</h2>
        <p style="font-size:12px;color:#1f2937;line-height:1.7;text-align:justify">
          ${resumoLinhas.join(" ")}
        </p>
      </div>
    ` : "";

    const atividadesHTML = cliente.atividades.length > 0 ? `
      <div class="section">
        <h2>📞 Histórico de Atendimentos</h2>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th></tr></thead>
          <tbody>
            ${cliente.atividades.slice(0, 15).map((a: any) => `
              <tr>
                <td>${a.data_atividade ? new Date(a.data_atividade + "T12:00:00").toLocaleDateString("pt-BR") : formatDate(a.created_at)}</td>
                <td style="text-transform:capitalize">${esc(a.tipo || "—")}</td>
                <td>${esc(a.descricao || "—")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${cliente.atividades.length > 15 ? `<p style="font-size:10px;color:#9ca3af;text-align:center;margin-top:4px">+ ${cliente.atividades.length - 15} atendimento(s) anteriores</p>` : ""}
      </div>
    ` : "";

    const contratosHTML = cliente.contratos.map((c) => `
      <tr>
        <td>${esc(c.banco || "—")}</td>
        <td style="font-family:monospace;font-size:11px">${esc(c.numero_contrato || "—")}</td>
        <td style="text-align:right">${c.valor_total_operacao ? formatCurrency(c.valor_total_operacao) : "—"}</td>
        <td>${c.vencimento_proxima_parcela ? formatDate(c.vencimento_proxima_parcela) : "—"}</td>
        <td>
          <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${
            c.status_prazo === "Em atraso" ? "#fee2e2;color:#dc2626" :
            c.status_prazo === "Em dia" ? "#dcfce7;color:#16a34a" :
            "#f3f4f6;color:#6b7280"
          }">${esc(c.status_prazo || "Pendente")}</span>
        </td>
        <td>${c.possui_laudo ? "✅" : "❌"}</td>
        <td>${c.protocolo_realizado ? "✅" : "❌"}</td>
      </tr>
    `).join("");

    const laudosHTML = cliente.laudos.length > 0 ? cliente.laudos.map((l) => {
      const d = l.dados_etapa1 as Record<string, any> | null;
      return `
        <tr>
          <td>${esc(l.numero_laudo)}</td>
          <td>${esc(d?.cultura || d?.culturas?.[0] || "—")}</td>
          <td>${esc(d?.safra || "—")}</td>
          <td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${
            l.status === "finalizado" || l.status === "exportado" ? "#dcfce7;color:#16a34a" : "#fef3c7;color:#d97706"
          }">${esc(l.status)}</span></td>
          <td>${formatDate(l.created_at)}</td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Nenhum laudo vinculado</td></tr>`;

    // Workflow status
    const { steps, currentStep, hasProcess } = getWorkflowStatus(cliente);
    const workflowHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:0;margin:20px 0;">
        ${steps.map((step: any, i: number) => {
          const status = step.status || "pendente";
          const isCompleted = status === "concluida";
          const isCurrent = status === "em_andamento";
          const isBlocked = status === "bloqueada";
          const bgColor = isCompleted ? "#1a5632" : isCurrent ? "#f59e0b" : isBlocked ? "#dc2626" : "#e5e7eb";
          const textColor = isCompleted || isCurrent || isBlocked ? "#fff" : "#9ca3af";
          const borderColor = isCompleted ? "#1a5632" : isCurrent ? "#f59e0b" : isBlocked ? "#dc2626" : "#d1d5db";
          const labelColor = isCompleted ? "#1a5632" : isCurrent ? "#f59e0b" : isBlocked ? "#dc2626" : "#9ca3af";
          return `
            <div style="display:flex;align-items:center;">
              <div style="text-align:center;">
                <div style="width:32px;height:32px;border-radius:50%;background:${bgColor};border:2px solid ${borderColor};display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:12px;font-weight:700;color:${textColor}">
                  ${isCompleted ? "✓" : i + 1}
                </div>
                <div style="font-size:9px;color:${labelColor};font-weight:${isCurrent ? "700" : "500"};margin-top:4px;max-width:90px;line-height:1.2">
                  ${step.label}
                </div>
              </div>
              ${i < steps.length - 1 ? `<div style="width:40px;height:2px;background:${isCompleted ? "#1a5632" : "#e5e7eb"};margin:0 4px;margin-bottom:18px;"></div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
      <div style="text-align:center;margin-bottom:20px;">
        <span style="display:inline-block;padding:4px 14px;border-radius:12px;font-size:11px;font-weight:600;background:${currentStep === 0 && !hasProcess ? "#fef3c7;color:#d97706" : currentStep >= 4 ? "#dcfce7;color:#16a34a" : "#dbeafe;color:#2563eb"}">
          ${currentStep === 0 && !hasProcess ? "⏳ Aguardando elaboração do laudo técnico" :
            steps[currentStep]?.status === "em_andamento" ? `🔄 Em andamento: ${steps[currentStep]?.label}` :
            currentStep >= 4 ? "✅ Processo encerrado" :
            `📋 Fase atual: ${steps[currentStep]?.label || "Em andamento"}`}
        </span>
      </div>

      ${hasProcess ? `
      <div style="margin-top:10px;">
        ${steps.map((step: any, i: number) => {
          const allItems = [
            ...(step.movimentacoes || []).map((m: any) => ({
              tipo: "Movimentação",
              desc: m.descricao || m.tipo || "—",
              data: m.created_at,
            })),
            ...(step.historico || []).map((t: any) => ({
              tipo: t.acao === "concluida" ? "Tarefa concluída" : "Tarefa",
              desc: t.titulo || "—",
              data: t.data_acao,
            })),
            ...(step.tarefas || []).map((t: any) => ({
              tipo: t.concluida ? "Tarefa concluída" : "Tarefa pendente",
              desc: t.titulo || "—",
              data: t.data_vencimento ? t.data_vencimento + "T12:00:00" : t.created_at,
            })),
          ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

          if (allItems.length === 0) return "";

          const status = step.status || "pendente";
          const headerColor = status === "concluida" ? "#1a5632" : status === "em_andamento" ? "#f59e0b" : "#9ca3af";

          return `
            <div style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <div style="background:#f8f9fa;padding:8px 12px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${headerColor};"></div>
                <span style="font-size:11px;font-weight:600;color:#374151;">Fase ${i + 1}: ${step.label}</span>
                <span style="font-size:10px;color:#9ca3af;margin-left:auto;">${allItems.length} atividade${allItems.length > 1 ? "s" : ""}</span>
              </div>
              <div style="padding:0;">
                ${allItems.slice(0, 5).map((item: any) => `
                  <div style="padding:6px 12px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:8px;font-size:11px;">
                    <span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:600;background:${
                      item.tipo.includes("concluída") ? "#dcfce7;color:#16a34a" :
                      item.tipo === "Movimentação" ? "#dbeafe;color:#2563eb" :
                      "#fef3c7;color:#d97706"
                    }">${item.tipo}</span>
                    <span style="flex:1;color:#374151;">${item.desc}</span>
                    <span style="color:#9ca3af;font-size:10px;">${item.data ? new Date(item.data).toLocaleDateString("pt-BR") : "—"}</span>
                  </div>
                `).join("")}
                ${allItems.length > 5 ? `<div style="padding:4px 12px;font-size:10px;color:#9ca3af;text-align:center;">+ ${allItems.length - 5} atividade(s)</div>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
      ` : ""}
    `;

    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; line-height: 1.5; }
  .page { padding: 40px 50px; max-width: 210mm; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a5632; padding-bottom: 20px; margin-bottom: 30px; }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .header-logo { height: 50px; }
  .header h1 { font-size: 20px; color: #1a5632; margin: 0; }
  .header .subtitle { font-size: 12px; color: #666; margin-top: 2px; }
  .header .date { font-size: 12px; color: #999; text-align: right; }
  .section { margin-bottom: 25px; }
  .section h2 { font-size: 15px; color: #1a5632; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-bottom: 12px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
  .summary-card { background: #f8f9fa; border-radius: 8px; padding: 14px; text-align: center; border: 1px solid #e5e5e5; }
  .summary-card .value { font-size: 22px; font-weight: 700; color: #1a5632; }
  .summary-card .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #1a5632; color: white; font-size: 11px; padding: 8px 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
  tr:nth-child(even) { background: #fafafa; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #1a5632; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #666; }
  .footer-logo { height: 30px; opacity: 0.6; }
  .stamp { text-align: center; }
  .stamp .name { font-weight: 700; color: #1a1a1a; font-size: 13px; }
  .stamp .crea { color: #666; font-size: 11px; }
  @media print { .page { padding: 20px 30px; } }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <img src="/logo-laudoagro.png" alt="LaudoAgro" class="header-logo" onerror="this.style.display='none'" />
      <div>
        <h1>${type === "extrato" ? "Extrato de Posição" : "Relatório de Acompanhamento"}</h1>
        <div class="subtitle">${type === "extrato" ? "Posição consolidada de contratos e laudos" : "Acompanhamento periódico de movimentações"}</div>
      </div>
    </div>
    <div class="date">
      <strong>Oliveira Agro — Perícias e Pareceres</strong><br>
      Emitido em ${today}
    </div>
  </div>

  <div class="section">
    <h2>👤 Cliente: ${esc(cliente.nome)}</h2>
  </div>

  ${resumoHTML}

  ${qualificacaoHTML}

  <div class="section">
    <h2>📍 Andamento do Procedimento</h2>
    ${workflowHTML}
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${cliente.contratos.length}</div>
      <div class="label">Contratos</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatCurrency(cliente.totalOperacoes)}</div>
      <div class="label">Volume Total</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color:${cliente.contratosVencidos > 0 ? '#dc2626' : '#16a34a'}">${cliente.contratosVencidos}</div>
      <div class="label">Vencidos</div>
    </div>
    <div class="summary-card">
      <div class="value">${cliente.laudos.length}</div>
      <div class="label">Laudos</div>
    </div>
  </div>

  <div class="section">
    <h2>📋 Contratos</h2>
    <table>
      <thead><tr>
        <th>Banco</th><th>Contrato</th><th style="text-align:right">Valor</th><th>Vencimento</th><th>Status</th><th>Laudo</th><th>Protocolo</th>
      </tr></thead>
      <tbody>${contratosHTML}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>📄 Laudos Técnicos</h2>
    <table>
      <thead><tr><th>Número</th><th>Cultura</th><th>Safra</th><th>Status</th><th>Data</th></tr></thead>
      <tbody>${laudosHTML}</tbody>
    </table>
  </div>

  ${cliente.movimentacoes.length > 0 ? `
  <div class="section">
    <h2>⚖️ Movimentações Processuais</h2>
    <table>
      <thead><tr><th>Tipo</th><th>Descrição</th><th>Fase</th><th>Data</th></tr></thead>
      <tbody>${cliente.movimentacoes.map((m: any) => {
        const faseLabels: Record<string, string> = { "1": "Laudo", "2": "Notificação", "3": "Resposta", "4": "Judicial", "5": "Encerrado" };
        return `<tr>
          <td style="text-transform:capitalize">${esc(m.tipo || "—")}</td>
          <td>${esc(m.descricao || "—")}</td>
          <td>${esc(faseLabels[m.fase] || m.fase)}</td>
          <td>${m.created_at ? new Date(m.created_at).toLocaleDateString("pt-BR") : "—"}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>
  </div>
  ` : ""}

  ${cliente.tarefas.length > 0 ? `
  <div class="section">
    <h2>✅ Tarefas</h2>
    <table>
      <thead><tr><th>Tarefa</th><th>Prioridade</th><th>Vencimento</th><th>Status</th></tr></thead>
      <tbody>${cliente.tarefas.map((t: any) => `<tr>
        <td>${esc(t.titulo || "—")}</td>
        <td style="text-transform:capitalize">${esc(t.prioridade || "normal")}</td>
        <td>${t.data_vencimento ? new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${t.concluida ? "#dcfce7;color:#16a34a" : "#fef3c7;color:#d97706"}">${t.concluida ? "Concluída" : "Pendente"}</span></td>
      </tr>`).join("")}</tbody>
    </table>
  </div>
  ` : ""}

  ${atividadesHTML}

  ${type === "periodico" ? `
  <div class="section">
    <h2>📌 Observações e Próximos Passos</h2>
    <ul style="list-style:disc;padding-left:20px;font-size:12px;color:#333;line-height:1.8">
      ${cliente.contratosVencidos > 0 ? `<li><strong style="color:#dc2626">${cliente.contratosVencidos} contrato(s) vencido(s)</strong> — providenciar protocolo de prorrogação imediatamente.</li>` : ""}
      ${cliente.contratos.filter(c => !c.possui_laudo).length > 0 ? `<li>${cliente.contratos.filter(c => !c.possui_laudo).length} contrato(s) sem laudo técnico — necessário elaborar laudo agronômico.</li>` : ""}
      ${cliente.contratos.filter(c => !c.protocolo_realizado && c.data_limite_protocolo).length > 0 ? `<li>${cliente.contratos.filter(c => !c.protocolo_realizado && c.data_limite_protocolo).length} contrato(s) sem protocolo de prorrogação — agendar protocolo.</li>` : ""}
      ${cliente.contratosVencidos === 0 && cliente.contratos.every(c => c.possui_laudo) ? `<li style="color:#16a34a">✅ Situação regularizada — todos os contratos em dia com laudos vinculados.</li>` : ""}
    </ul>
  </div>
  ` : ""}

  <div class="footer">
    <div>
      <img src="/logo-laudoagro.png" alt="LaudoAgro" class="footer-logo" onerror="this.style.display='none'" /><br>
      <strong>Oliveira Agro</strong> — Perícias e Pareceres<br>
      Relatório gerado automaticamente em ${today}
    </div>
    <div class="stamp">
      <div style="border-top:1px solid #999;padding-top:8px;min-width:200px">
        <div class="name">${profNome}</div>
        ${crea ? `<div class="crea">${crea}</div>` : ""}
      </div>
    </div>
  </div>
</div>
</body></html>`;
  };

  const handleGenerateReport = async (cliente: ClienteResumo, type: "extrato" | "periodico") => {
    setGenerating(true);
    try {
      const html = generatePDFContent(cliente, type);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type === "extrato" ? "Extrato" : "Relatorio"}_${cliente.nome.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Relatório de ${cliente.nome} gerado com sucesso`);
    } catch {
      toast.error("Erro ao gerar relatório");
    }
    setGenerating(false);
  };

  const handlePreview = (cliente: ClienteResumo) => {
    setSelectedCliente(cliente);
    setPreviewOpen(true);
  };

  const handleExportCSV = () => {
    const header = ["Cliente", "Contratos", "Volume Total (R$)", "Vencidos", "Em Dia", "Laudos", "Processos", "Tem Laudo"];
    const rows = clientes.map(c => [
      `"${c.nome}"`,
      c.contratos.length,
      c.totalOperacoes.toFixed(2),
      c.contratosVencidos,
      c.contratosEmDia,
      c.laudos.length,
      c.processos.length,
      c.temLaudo ? "Sim" : "Não",
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_Clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  return (
    <AppLayout>
      <PageHeader
        icon={FileBarChart}
        title="Relatórios para Clientes"
        subtitle="Gere extratos de posição e relatórios de acompanhamento por cliente."
        breadcrumb={[{ label: "Agro" }, { label: "Relatórios" }]}
      />

      {recorte.semLiderados && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground mb-6">
          {SEM_LIDERADOS_MSG}
        </div>
      )}



      {/* Toolbar */}
      <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-9" />
        </div>
        <Select value={reportType} onValueChange={(v: "extrato" | "periodico") => setReportType(v)}>
          <SelectTrigger className="w-[220px]">
            <Filter className="w-4 h-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="extrato">Extrato de Posição</SelectItem>
            <SelectItem value="periodico">Relatório Periódico</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExportCSV} disabled={clientes.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Exportar CSV
        </Button>
      </motion.div>

      {/* Clients grid */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : clientes.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Importe contratos na página de Vencimentos para começar."
          action={{ label: "Ir para Vencimentos", href: "/vencimentos", variant: "outline" }}
        />
      ) : (
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map((cliente) => (
            <Card key={cliente.nome} className="hover:shadow-card-hover transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {cliente.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{cliente.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{cliente.contratos.length} contrato{cliente.contratos.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {cliente.contratosVencidos > 0 && (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-semibold">
                      {cliente.contratosVencidos} vencido{cliente.contratosVencidos > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-secondary/50 rounded-md p-2">
                    <p className="text-xs text-muted-foreground">Volume</p>
                    <p className="text-xs font-bold text-foreground">{formatCurrency(cliente.totalOperacoes)}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-md p-2">
                    <p className="text-xs text-muted-foreground">Laudos</p>
                    <p className="text-xs font-bold text-foreground">{cliente.laudos.length}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-md p-2">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className={`text-xs font-bold ${cliente.contratosVencidos > 0 ? "text-destructive" : "text-success"}`}>
                      {cliente.contratosVencidos > 0 ? "Atenção" : "Regular"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handlePreview(cliente)}>
                    <FileText className="w-3 h-3" /> Visualizar
                  </Button>
                  <Button size="sm" className="flex-1 text-xs" onClick={() => handleGenerateReport(cliente, reportType)} disabled={generating}>
                    <Download className="w-3 h-3" /> {reportType === "extrato" ? "Extrato" : "Relatório"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia — {selectedCliente?.nome}</DialogTitle>
          </DialogHeader>
          {selectedCliente && (
            <div
              className="border border-border rounded-lg overflow-hidden"
              dangerouslySetInnerHTML={{ __html: generatePDFContent(selectedCliente, reportType) }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={() => selectedCliente && handleGenerateReport(selectedCliente, reportType)} disabled={generating}>
              <Download className="w-4 h-4" /> Baixar {reportType === "extrato" ? "Extrato" : "Relatório"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
