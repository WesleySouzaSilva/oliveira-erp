import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, User, ArrowRight,
  FileText, BarChart3, Download, CalendarIcon, FileDown, History, Trash2, ListChecks,
} from "lucide-react";
import jsPDF from "jspdf";
import { Link } from "react-router-dom";
import { TarefaDetalheDrawer } from "@/components/TarefaDetalheDrawer";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import logoDark from "@/assets/logo-dark.png";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

interface MemberData {
  userId: string;
  nome: string;
  papel: string;
  tarefas: any[];
  peticoes: any[];
}

const roleLabel = (papel: string) => {
  const map: Record<string, string> = {
    admin: "Admin",
    advogado: "Advogado",
    agronomo: "Agrônomo",
    engenheiro_agronomo: "Eng. Agrônomo",
    estagiario_direito: "Estagiário",
    assessor_juridico: "Assessor",
    pos_venda: "Pós-Venda",
  };
  return map[papel] || papel;
};

export default function Tarefas() {
  const { user } = useAuth();
  const { members, isAdmin } = useOrgMembers();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [allTarefas, setAllTarefas] = useState<any[]>([]);
  const [allPeticoes, setAllPeticoes] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedTarefa, setSelectedTarefa] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hoje = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user || members.length === 0) return;
    const load = async () => {
      const memberIds = members.map((m) => m.user_id);
      const [tarefasRes, petRes, histRes] = await Promise.all([
        supabase.from("tarefas" as any).select("*").in("responsavel_id", memberIds).order("data_vencimento", { ascending: true }),
        supabase.from("peticoes").select("id, user_id, titulo, created_at, status").in("user_id", memberIds),
        supabase.from("tarefas_historico" as any).select("*").order("data_acao", { ascending: false }).limit(200),
      ]);
      setAllTarefas((tarefasRes.data || []) as any[]);
      setAllPeticoes((petRes.data || []) as any[]);
      setHistorico((histRes.data || []) as any[]);
      setLoading(false);
    };
    load();
  }, [user, members]);

  const memberData: MemberData[] = useMemo(() => {
    return members.map((m) => ({
      userId: m.user_id,
      nome: m.nome || "Sem nome",
      papel: m.papel,
      tarefas: allTarefas.filter((t: any) => t.responsavel_id === m.user_id),
      peticoes: allPeticoes.filter((p) => p.user_id === m.user_id),
    }));
  }, [members, allTarefas, allPeticoes]);

  const visibleMembers = isAdmin ? memberData : memberData.filter((m) => m.userId === user?.id);
  const activeMember = selectedMember
    ? visibleMembers.find((m) => m.userId === selectedMember) || visibleMembers[0]
    : visibleMembers[0];

  // Filter by date range
  const filterByDate = (items: any[], dateField: string) => {
    if (!dateFrom && !dateTo) return items;
    return items.filter((item) => {
      const d = item[dateField]?.split("T")[0];
      if (!d) return true;
      if (dateFrom && d < format(dateFrom, "yyyy-MM-dd")) return false;
      if (dateTo && d > format(dateTo, "yyyy-MM-dd")) return false;
      return true;
    });
  };

  const filteredTarefas = filterByDate(activeMember?.tarefas || [], "data_vencimento");
  const filteredPeticoes = filterByDate(activeMember?.peticoes || [], "created_at");

  const pendentes = filteredTarefas.filter((t: any) => !t.concluida);
  const atrasadas = pendentes.filter((t: any) => t.data_vencimento < hoje);
  const hojeTarefas = pendentes.filter((t: any) => t.data_vencimento === hoje);
  const futuras = pendentes.filter((t: any) => t.data_vencimento > hoje);
  const concluidas = filteredTarefas.filter((t: any) => t.concluida);

  const toggleConcluida = async (id: string, concluida: boolean) => {
    const tarefa = allTarefas.find((t: any) => t.id === id);
    await supabase.from("tarefas" as any).update({ concluida } as any).eq("id", id);
    setAllTarefas((prev) => prev.map((t: any) => (t.id === id ? { ...t, concluida } : t)));
    if (selectedTarefa?.id === id) {
      setSelectedTarefa((prev: any) => prev ? { ...prev, concluida } : prev);
    }
    // Log to history when completing
    if (concluida && tarefa && user) {
      await supabase.from("tarefas_historico" as any).insert({
        tarefa_id: id,
        organizacao_id: tarefa.organizacao_id,
        processo_id: tarefa.processo_id || null,
        fase: tarefa.fase || null,
        responsavel_id: tarefa.responsavel_id,
        executado_por: user.id,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao || null,
        data_vencimento_original: tarefa.data_vencimento,
        nome_cliente: tarefa.nome_cliente || null,
        prioridade: tarefa.prioridade || "normal",
        acao: "concluida",
      } as any);
    }
  };

  const openTarefa = (tarefa: any) => {
    setSelectedTarefa(tarefa);
    setDrawerOpen(true);
  };

  const exportCSV = () => {
    if (!activeMember) return;
    const period = [
      dateFrom ? format(dateFrom, "dd/MM/yyyy") : "início",
      dateTo ? format(dateTo, "dd/MM/yyyy") : "hoje",
    ].join(" a ");

    const lines: string[] = [];
    lines.push(`Relatório de Performance - ${activeMember.nome}`);
    lines.push(`Cargo: ${roleLabel(activeMember.papel)}`);
    lines.push(`Período: ${period}`);
    lines.push("");
    lines.push("=== RESUMO ===");
    lines.push(`Petições no período: ${filteredPeticoes.length}`);
    lines.push(`Tarefas pendentes: ${pendentes.length}`);
    lines.push(`Tarefas atrasadas: ${atrasadas.length}`);
    lines.push(`Tarefas concluídas: ${concluidas.length}`);
    lines.push("");

    if (filteredPeticoes.length > 0) {
      lines.push("=== PETIÇÕES ===");
      lines.push("Título;Status;Data de Criação");
      filteredPeticoes.forEach((p) => {
        lines.push(`${p.titulo};${p.status};${new Date(p.created_at).toLocaleDateString("pt-BR")}`);
      });
      lines.push("");
    }

    lines.push("=== TAREFAS ===");
    lines.push("Título;Descrição;Vencimento;Status");
    filteredTarefas.forEach((t: any) => {
      const status = t.concluida
        ? "Concluída"
        : t.data_vencimento < hoje
        ? "Atrasada"
        : t.data_vencimento === hoje
        ? "Vence hoje"
        : "Pendente";
      lines.push(
        `${t.titulo};${t.descricao || ""};${new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")};${status}`
      );
    });

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${activeMember.nome.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório CSV exportado!");
  };

  const exportPDF = async () => {
    if (!activeMember) return;
    const period = [
      dateFrom ? format(dateFrom, "dd/MM/yyyy") : "início",
      dateTo ? format(dateTo, "dd/MM/yyyy") : "hoje",
    ].join(" a ");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Colors (from design system HSL values)
    const primary: [number, number, number] = [30, 62, 43]; // dark green
    const accent: [number, number, number] = [180, 120, 30]; // amber
    const destructive: [number, number, number] = [220, 60, 60];
    const muted: [number, number, number] = [130, 130, 140];
    const textColor: [number, number, number] = [30, 62, 43];
    const lightBg: [number, number, number] = [245, 242, 235];

    // Load logo
    const loadImage = (src: string): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext("2d")!.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve("");
        img.src = src;
      });

    const logoData = await loadImage(logoDark);

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 20) {
        doc.addPage();
        y = margin;
      }
    };

    // === HEADER ===
    doc.setFillColor(...lightBg);
    doc.rect(0, 0, pageW, 50, "F");

    if (logoData) {
      doc.addImage(logoData, "PNG", margin, 10, 35, 12);
    }

    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Relatório de Performance", pageW - margin, 16, { align: "right" });
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageW - margin, 21, { align: "right" });

    // Green accent line
    doc.setDrawColor(...primary);
    doc.setLineWidth(1.2);
    doc.line(margin, 50, pageW - margin, 50);

    y = 60;

    // === COLLABORATOR INFO ===
    doc.setFontSize(18);
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "bold");
    doc.text(activeMember.nome, margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(`${roleLabel(activeMember.papel)}  ·  Período: ${period}`, margin, y);
    y += 14;

    // === SUMMARY CARDS ===
    const cardW = (contentW - 12) / 4;
    const cards = [
      { label: "Petições", value: String(filteredPeticoes.length), color: accent },
      { label: "Pendentes", value: String(pendentes.length), color: accent },
      { label: "Atrasadas", value: String(atrasadas.length), color: atrasadas.length > 0 ? destructive : muted },
      { label: "Concluídas", value: String(concluidas.length), color: primary },
    ];

    cards.forEach((card, i) => {
      const x = margin + i * (cardW + 4);
      doc.setFillColor(...lightBg);
      doc.roundedRect(x, y, cardW, 22, 2, 2, "F");

      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "normal");
      doc.text(card.label, x + 4, y + 7);

      doc.setFontSize(16);
      doc.setTextColor(...card.color);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, x + 4, y + 17);
    });

    y += 32;

    // === TABLE HELPER ===
    const drawTable = (
      title: string,
      titleColor: [number, number, number],
      headers: string[],
      rows: string[][],
      colWidths: number[]
    ) => {
      checkPage(20);

      // Section title
      doc.setFontSize(11);
      doc.setTextColor(...titleColor);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, y);
      y += 6;

      // Header row
      doc.setFillColor(...primary);
      doc.roundedRect(margin, y, contentW, 8, 1, 1, "F");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      let xOffset = margin + 3;
      headers.forEach((h, i) => {
        doc.text(h, xOffset, y + 5.5);
        xOffset += colWidths[i];
      });
      y += 10;

      // Data rows
      doc.setFont("helvetica", "normal");
      rows.forEach((row, rIdx) => {
        checkPage(9);
        if (rIdx % 2 === 0) {
          doc.setFillColor(250, 248, 244);
          doc.rect(margin, y - 1, contentW, 8, "F");
        }

        doc.setFontSize(7);
        doc.setTextColor(...textColor);
        xOffset = margin + 3;
        row.forEach((cell, i) => {
          const maxW = colWidths[i] - 4;
          const truncated = doc.getTextWidth(cell) > maxW
            ? cell.substring(0, Math.floor(cell.length * maxW / doc.getTextWidth(cell))) + "…"
            : cell;
          if (cell === "Atrasada") doc.setTextColor(...destructive);
          else if (cell === "Concluída") doc.setTextColor(...primary);
          else if (cell === "Vence hoje") doc.setTextColor(...accent);
          else doc.setTextColor(...textColor);
          doc.text(truncated, xOffset, y + 4.5);
          xOffset += colWidths[i];
        });
        y += 8;
      });

      y += 6;
    };

    // === ATRASADAS ===
    if (atrasadas.length > 0) {
      const rows = atrasadas.map((t: any) => [
        t.titulo,
        t.descricao || "—",
        new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR"),
        "Atrasada",
      ]);
      drawTable(
        `⚠ Prazo Fatal (${atrasadas.length})`,
        destructive,
        ["Tarefa", "Descrição", "Vencimento", "Status"],
        rows,
        [contentW * 0.4, contentW * 0.3, contentW * 0.15, contentW * 0.15]
      );
    }

    // === PENDENTES ===
    const pendentesSemAtraso = [...hojeTarefas, ...futuras];
    if (pendentesSemAtraso.length > 0) {
      const rows = pendentesSemAtraso.map((t: any) => {
        const status = t.data_vencimento === hoje ? "Vence hoje" : "Pendente";
        return [
          t.titulo,
          t.descricao || "—",
          new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR"),
          status,
        ];
      });
      drawTable(
        `Tarefas Pendentes (${pendentesSemAtraso.length})`,
        accent,
        ["Tarefa", "Descrição", "Vencimento", "Status"],
        rows,
        [contentW * 0.4, contentW * 0.3, contentW * 0.15, contentW * 0.15]
      );
    }

    // === CONCLUÍDAS ===
    if (concluidas.length > 0) {
      const rows = concluidas.map((t: any) => [
        t.titulo,
        t.descricao || "—",
        new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR"),
        "Concluída",
      ]);
      drawTable(
        `Tarefas Concluídas (${concluidas.length})`,
        primary,
        ["Tarefa", "Descrição", "Vencimento", "Status"],
        rows,
        [contentW * 0.4, contentW * 0.3, contentW * 0.15, contentW * 0.15]
      );
    }

    // === PETIÇÕES ===
    if (filteredPeticoes.length > 0) {
      const rows = filteredPeticoes.map((p: any) => [
        p.titulo,
        p.status,
        new Date(p.created_at).toLocaleDateString("pt-BR"),
      ]);
      drawTable(
        `Petições (${filteredPeticoes.length})`,
        accent,
        ["Título", "Status", "Data de Criação"],
        rows,
        [contentW * 0.55, contentW * 0.2, contentW * 0.25]
      );
    }

    // === FOOTER on each page ===
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text("Se é Agro, começa aqui.", margin, pageH - 10);
      doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 10, { align: "right" });
      doc.setDrawColor(220, 218, 210);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
    }

    doc.save(`relatorio_${activeMember.nome.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Relatório PDF exportado!");
  };

  return (
    <AppLayout>
      <PageHeader
        icon={ListChecks}
        title="Tarefas da Equipe"
        subtitle="Acompanhe as tarefas pendentes de cada colaborador"
        breadcrumb={[{ label: "Agro" }, { label: "Tarefas" }]}
      />

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left: Member list */}
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="lg:col-span-1">
          <div className="bg-card rounded-lg shadow-card border border-border">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-accent" />
                {isAdmin ? "Colaboradores" : "Meu Painel"}
              </h2>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <ListSkeleton rows={4} />
              ) : (
                visibleMembers.map((m) => {
                  const mPendentes = m.tarefas.filter((t: any) => !t.concluida);
                  const mAtrasadas = mPendentes.filter((t: any) => t.data_vencimento < hoje);
                  const isActive = activeMember?.userId === m.userId;

                  return (
                    <button
                      key={m.userId}
                      onClick={() => setSelectedMember(m.userId)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                        isActive ? "bg-accent/10" : "hover:bg-secondary/50"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {m.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.nome}</p>
                        <p className="text-[11px] text-muted-foreground">{roleLabel(m.papel)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {mAtrasadas.length > 0 && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold">
                            {mAtrasadas.length}
                          </span>
                        )}
                        <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded-full font-medium">
                          {mPendentes.length}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>

        {/* Right: Task detail */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="lg:col-span-3 space-y-4">
          {activeMember && (
            <>
              {/* Date filter + Export */}
              <div className="bg-card rounded-lg shadow-card border border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <CalendarIcon className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-sm font-medium text-foreground">Período:</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[140px] justify-start text-left text-xs",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-xs text-muted-foreground">até</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[140px] justify-start text-left text-xs",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  {(dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                    >
                      Limpar
                    </Button>
                  )}

                  <div className="flex-1" />

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={exportCSV}
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={exportPDF}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Exportar PDF
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-card rounded-lg p-4 shadow-card border border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    <span className="text-xs text-muted-foreground">Petições</span>
                  </div>
                  <p className="text-2xl font-display font-bold mt-1 text-foreground">{filteredPeticoes.length}</p>
                </div>
                <div className="bg-card rounded-lg p-4 shadow-card border border-border">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Total</span>
                  </div>
                  <p className="text-2xl font-display font-bold mt-1 text-foreground">{filteredTarefas.length}</p>
                </div>
                <div className="bg-card rounded-lg p-4 shadow-card border border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent" />
                    <span className="text-xs text-muted-foreground">Pendentes</span>
                  </div>
                  <p className="text-2xl font-display font-bold mt-1 text-foreground">{pendentes.length}</p>
                </div>
                <div className="bg-card rounded-lg p-4 shadow-card border border-border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-xs text-muted-foreground">Atrasadas</span>
                  </div>
                  <p className={`text-2xl font-display font-bold mt-1 ${atrasadas.length > 0 ? "text-destructive" : "text-foreground"}`}>
                    {atrasadas.length}
                  </p>
                </div>
                <div className="bg-card rounded-lg p-4 shadow-card border border-border">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Concluídas</span>
                  </div>
                  <p className="text-2xl font-display font-bold mt-1 text-foreground">{concluidas.length}</p>
                </div>
              </div>

              {/* Atrasadas */}
              {atrasadas.length > 0 && (
                <div className="bg-card rounded-lg shadow-card border border-border">
                  <div className="p-4 border-b border-border flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <h3 className="text-sm font-semibold text-destructive">
                      Prazo fatal ({atrasadas.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {atrasadas.map((t: any) => (
                      <TaskRow key={t.id} tarefa={t} hoje={hoje} onToggle={toggleConcluida} onClick={() => openTarefa(t)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Hoje */}
              {hojeTarefas.length > 0 && (
                <div className="bg-card rounded-lg shadow-card border border-border">
                  <div className="p-4 border-b border-border flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-semibold text-accent">Hoje ({hojeTarefas.length})</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {hojeTarefas.map((t: any) => (
                      <TaskRow key={t.id} tarefa={t} hoje={hoje} onToggle={toggleConcluida} onClick={() => openTarefa(t)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Futuras */}
              {futuras.length > 0 && (
                <div className="bg-card rounded-lg shadow-card border border-border">
                  <div className="p-4 border-b border-border flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Próximas ({futuras.length})</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {futuras.map((t: any) => (
                      <TaskRow key={t.id} tarefa={t} hoje={hoje} onToggle={toggleConcluida} onClick={() => openTarefa(t)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Concluídas */}
              {concluidas.length > 0 && (
                <details className="bg-card rounded-lg shadow-card border border-border">
                  <summary className="p-4 cursor-pointer text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Concluídas ({concluidas.length})
                  </summary>
                  <div className="divide-y divide-border border-t border-border">
                    {concluidas.slice(0, 10).map((t: any) => (
                      <TaskRow key={t.id} tarefa={t} hoje={hoje} onToggle={toggleConcluida} done onClick={() => openTarefa(t)} />
                    ))}
                  </div>
                </details>
              )}

              {/* Histórico de tarefas concluídas/excluídas */}
              {historico.length > 0 && (
                <details className="bg-card rounded-lg shadow-card border border-border">
                  <summary className="p-4 cursor-pointer text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Histórico ({historico.length})
                    {isAdmin && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full ml-1">Completo</span>}
                  </summary>
                  <div className="divide-y divide-border border-t border-border">
                    {historico.map((h: any) => {
                      const getMemberName = (uid: string) => members.find(m => m.user_id === uid)?.nome || "—";
                      const isExcluida = h.acao === "excluida";
                      return (
                        <div key={h.id} className="px-4 py-3 flex items-center gap-3">
                          {isExcluida ? (
                            <Trash2 className="w-4 h-4 text-destructive shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate text-foreground">{h.titulo}</p>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                                isExcluida ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                              }`}>
                                {isExcluida ? "Excluída" : "Concluída"}
                              </span>
                            </div>
                            {h.nome_cliente && (
                              <p className="text-[10px] text-accent font-medium">Cliente: {h.nome_cliente}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground">
                              Por {getMemberName(h.executado_por)} · Responsável: {getMemberName(h.responsavel_id)}
                              {h.data_vencimento_original && ` · Vencia: ${new Date(h.data_vencimento_original + "T12:00:00").toLocaleDateString("pt-BR")}`}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(h.data_acao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {filteredTarefas.length === 0 && filteredPeticoes.length === 0 && (
                <div className="bg-card rounded-lg shadow-card border border-border p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {dateFrom || dateTo
                      ? "Nenhuma atividade encontrada no período selecionado."
                      : "Nenhuma tarefa encontrada para este colaborador."}
                  </p>
                  <Link to="/agenda" className="text-xs text-accent font-medium hover:underline mt-2 inline-flex items-center gap-1">
                    Criar tarefa na Agenda <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>

      <TarefaDetalheDrawer
        tarefa={selectedTarefa}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggleConcluida={toggleConcluida}
      />
    </AppLayout>
  );
}

function TaskRow({ tarefa: t, hoje, onToggle, done, onClick }: { tarefa: any; hoje: string; onToggle: (id: string, v: boolean) => void; done?: boolean; onClick?: () => void }) {
  const isUrgente = t.prioridade === "urgente";
  return (
    <div className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors ${done ? "opacity-60" : ""}`} onClick={onClick}>
      <button onClick={(e) => { e.stopPropagation(); onToggle(t.id, !t.concluida); }} className="shrink-0">
        {done ? (
          <CheckCircle2 className="w-4 h-4 text-primary" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground hover:text-accent transition-colors" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {t.titulo}
          </p>
          {isUrgente && !done && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold shrink-0 uppercase">
              Urgente
            </span>
          )}
        </div>
        {t.descricao && (
          <p className="text-xs text-muted-foreground truncate">{t.descricao}</p>
        )}
        {t.nome_cliente && (
          <p className="text-[10px] text-accent font-medium mt-0.5">Cliente: {t.nome_cliente}</p>
        )}
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
          done
            ? "bg-primary/10 text-primary"
            : t.data_vencimento < hoje
            ? "bg-destructive/10 text-destructive"
            : t.data_vencimento === hoje
            ? "bg-accent/10 text-accent"
            : "bg-secondary text-foreground"
        }`}
      >
        {done
          ? "Concluída"
          : t.data_vencimento < hoje
          ? "Atrasada"
          : t.data_vencimento === hoje
          ? "Hoje"
          : new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
      </span>
    </div>
  );
}
