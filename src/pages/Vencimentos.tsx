import { useEffect, useState } from "react";
import { useVencimentosData, type Contrato, type DuplicateGroup } from "@/hooks/useVencimentosData";
import { useVencimentosFilters } from "@/hooks/useVencimentosFilters";
import { useSheetsSync } from "@/hooks/useSheetsSync";
import { useCsvImportExport } from "@/hooks/useCsvImportExport";
import { emptyContrato } from "@/components/vencimentos/lib/types";
import { VencimentoFormDialog } from "@/components/vencimentos/VencimentoFormDialog";
import { DuplicatesReviewDialog } from "@/components/vencimentos/DuplicatesReviewDialog";
import { GoogleSheetsDialog } from "@/components/vencimentos/GoogleSheetsDialog";
import { SyncStatusBar } from "@/components/vencimentos/SyncStatusBar";
import { VencimentosToolbar } from "@/components/vencimentos/VencimentosToolbar";
import { VencimentosSummary } from "@/components/vencimentos/VencimentosSummary";
import { VencimentosDuplicatesBanner } from "@/components/vencimentos/VencimentosDuplicatesBanner";
import { VencimentosTable } from "@/components/vencimentos/VencimentosTable";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarClock, FileText, GitBranch, Radar, ShieldAlert } from "lucide-react";
import { RadarPanel } from "@/components/radar/RadarPanel";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { KanbanPrazosSection } from "@/components/vencimentos/KanbanPrazosSection";
import { MinhasOperacoesPanel } from "@/components/radar/MinhasOperacoesPanel";


const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

type SecaoId = "minhas" | "radar" | "pipeline" | "contratos";

const SECOES: { id: SecaoId; label: string; icon: typeof Radar }[] = [
  { id: "minhas", label: "Minhas operações", icon: ShieldAlert },
  { id: "radar", label: "Radar crítico", icon: Radar },
  { id: "pipeline", label: "Prazos do pipeline", icon: GitBranch },
  { id: "contratos", label: "Base de contratos", icon: FileText },
];

export default function Vencimentos() {
  const { user } = useAuth();

  const [secao, setSecao] = useState<SecaoId>(() => {
    const hash = (typeof window !== "undefined" ? window.location.hash : "").replace("#", "");
    return (SECOES.some((s) => s.id === hash) ? hash : "minhas") as SecaoId;
  });

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (SECOES.some((s) => s.id === hash)) setSecao(hash as SecaoId);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const abrirSecao = (id: SecaoId) => {
    setSecao(id);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${id}`);
  };
  const { contratos, setContratos, loading, loadContratos, duplicateGroups, duplicateExtrasCount, bancos } = useVencimentosData();

  const filters = useVencimentosFilters(contratos);
  const {
    search, setSearch, filterStatus, setFilterStatus, filterBanco, setFilterBanco,
    sortKey, sortDir, showResolvidos, setShowResolvidos, toggleSort,
    filtered, paginatedContratos, hasMore, totalCount, shownCount, loadMore,
  } = filters;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Partial<Contrato> | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicatesDialogOpen, setDuplicatesDialogOpen] = useState(false);

  const sheets = useSheetsSync({
    user,
    onAfterSync: async (data) => {
      await loadContratos();
      if ((data?.duplicate_conflicts ?? 0) > 0) {
        toast.info("Foram encontrados conflitos por duplicidade. Revise os contratos duplicados.");
        setDuplicatesDialogOpen(true);
      }
    },
  });
  const {
    syncConfig, syncing, sheetsDialogOpen, setSheetsDialogOpen,
    sheetsUrl, setSheetsUrl, sheetsName, setSheetsName,
    handleConnectSheets, handleResync, handleDisconnectSheets,
  } = sheets;

  const csv = useCsvImportExport({
    user,
    filtered,
    onAfterImport: async ({ duplicateConflicts }) => {
      await loadContratos();
      if (duplicateConflicts > 0 || duplicateGroups.length > 0) {
        setDuplicatesDialogOpen(true);
      }
    },
  });
  const { fileInputRef, handleImportCSV, exportCSV } = csv;

  const handleSave = async () => {
    if (!editingContrato || !user) return;

    setSaving(true);
    const payload = {
      ...editingContrato,
      user_id: user.id,
      valor_parcela: editingContrato.valor_parcela ? Number(editingContrato.valor_parcela) : null,
      valor_total_operacao: editingContrato.valor_total_operacao ? Number(editingContrato.valor_total_operacao) : null,
      updated_at: new Date().toISOString(),
    };

    delete (payload as any).id;

    if (editingContrato.id) {
      const { error } = await supabase
        .from("contratos_vencimentos")
        .update(payload)
        .eq("id", editingContrato.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Contrato atualizado");
    } else {
      const { error } = await supabase
        .from("contratos_vencimentos")
        .insert([payload as any]);
      if (error) toast.error("Erro ao criar");
      else toast.success("Contrato criado");
    }

    setSaving(false);
    setDialogOpen(false);
    setEditingContrato(null);
    await loadContratos();
  };

  const askConfirm = useConfirm();
  const handleDelete = async (id: string) => {
    if (!(await askConfirm({ title: "Excluir contrato", description: "Excluir este contrato?", destructive: true, confirmText: "Excluir" }))) return;

    const { error } = await supabase
      .from("contratos_vencimentos")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Excluído");
      await loadContratos();
    }
  };

  const handleResolve = async (id: string, motivo: string) => {
    const { error } = await supabase
      .from("contratos_vencimentos")
      .update({ resolvido: true, motivo_resolucao: motivo, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao resolver contrato"); return; }
    toast.success("Contrato marcado como resolvido");
    await loadContratos();
  };

  const handleUpdateStatus = async (id: string, novoStatus: string) => {
    const valor = (novoStatus || "").trim() || null;
    const { error } = await supabase
      .from("contratos_vencimentos")
      .update({ status_prazo: valor, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    setContratos((prev) => prev.map((c) => (c.id === id ? { ...c, status_prazo: valor } : c)));
    toast.success("Status atualizado");
  };

  const handleUpdateNotificado = async (id: string, valor: boolean | null) => {
    const { error } = await supabase
      .from("contratos_vencimentos")
      .update({ notificado_antes_vencimento: valor, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar notificação"); return; }
    setContratos((prev) => prev.map((c) => (c.id === id ? { ...c, notificado_antes_vencimento: valor } : c)));
    toast.success("Notificação atualizada");
  };

  const handleUnresolve = async (id: string) => {
    const { error } = await supabase
      .from("contratos_vencimentos")
      .update({ resolvido: false, motivo_resolucao: null, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao reabrir contrato"); return; }
    toast.success("Contrato reaberto");
    await loadContratos();
  };

  const handleDeleteDuplicateExtras = async (group: DuplicateGroup) => {
    const idsToDelete = group.items.slice(1).map((item) => item.id);
    if (idsToDelete.length === 0) return;

    if (!(await askConfirm({ title: "Excluir duplicados", description: `Excluir ${idsToDelete.length} registro(s) duplicado(s) de ${group.nome_cliente}?`, destructive: true, confirmText: "Excluir" }))) return;

    const { error } = await supabase
      .from("contratos_vencimentos")
      .update({ deleted_at: new Date().toISOString() } as any)
      .in("id", idsToDelete);

    if (error) {
      toast.error("Erro ao excluir duplicados");
      return;
    }

    toast.success(`${idsToDelete.length} duplicado(s) excluído(s)`);
    await loadContratos();
  };

  const handleDeleteAllDuplicateExtras = async () => {
    const allIds = duplicateGroups.flatMap((g) => g.items.slice(1).map((item) => item.id));
    if (allIds.length === 0) return;

    if (!(await askConfirm({ title: "Excluir TODOS os duplicados", description: `Excluir TODOS os ${allIds.length} registro(s) duplicado(s) de ${duplicateGroups.length} grupo(s)? O registro mais recente de cada grupo será mantido.`, destructive: true, confirmText: "Excluir tudo" }))) return;

    const { error } = await supabase
      .from("contratos_vencimentos")
      .update({ deleted_at: new Date().toISOString() } as any)
      .in("id", allIds);

    if (error) {
      toast.error("Erro ao excluir duplicados");
      return;
    }

    toast.success(`${allIds.length} duplicado(s) excluído(s) de ${duplicateGroups.length} grupo(s)`);
    await loadContratos();
  };

  return (
    <AppLayout>
      <PageHeader
        icon={CalendarClock}
        title="Controle de Vencimentos"
        subtitle="Gerencie os contratos e prazos de prorrogação dos seus clientes."
        breadcrumb={[{ label: "Agro" }, { label: "Vencimentos & Notificações" }]}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-16">
          <VencimentosSummary
            filtered={filtered}
            contratos={contratos}
            showResolvidos={showResolvidos}
            setShowResolvidos={setShowResolvidos}
          />

          <nav aria-label="Seções de vencimentos" className="rounded-lg border border-border bg-card p-2 shadow-card">
            <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase text-muted-foreground">Seções</p>
            {SECOES.map((s) => {
              const Icone = s.icon;
              const ativo = secao === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => abrirSecao(s.id)}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    ativo
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icone className={`h-4 w-4 ${ativo ? "text-accent" : ""}`} /> {s.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden rounded-lg border border-destructive/20 bg-destructive/5 p-4 xl:block">
            <ShieldAlert className="mb-2 h-5 w-5 text-destructive" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Priorize operações vencidas e sem responsável antes de revisar a base completa.
            </p>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {secao === "minhas" && (
            <section id="minhas" className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
              <MinhasOperacoesPanel />
            </section>
          )}

          {secao === "radar" && (
            <section id="radar" className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
                <RadarPanel />
              </div>
            </section>
          )}

          {secao === "pipeline" && (
            <section id="pipeline">
              <KanbanPrazosSection />
            </section>
          )}

          {secao === "contratos" && (
          <section id="contratos" className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <header className="border-b border-border bg-secondary/30 px-4 py-4 sm:px-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-lg font-bold text-foreground">Base de contratos e prazos</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Consulte, cadastre, sincronize e atualize os contratos da carteira.</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{filtered.length} resultados</span>
              </div>
              <VencimentosToolbar
                search={search}
                setSearch={setSearch}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterBanco={filterBanco}
                setFilterBanco={setFilterBanco}
                bancos={bancos}
                onNovo={() => {
                  setEditingContrato({ ...emptyContrato });
                  setDialogOpen(true);
                }}
                onImportClick={() => fileInputRef.current?.click()}
                syncConfig={syncConfig}
                syncing={syncing}
                onResync={handleResync}
                onDisconnectSheets={handleDisconnectSheets}
                onOpenSheets={() => {
                  setSheetsDialogOpen(true);
                  setSheetsUrl("");
                  setSheetsName("");
                }}
                onExport={exportCSV}
                duplicateGroupsCount={duplicateGroups.length}
                onOpenDuplicates={() => setDuplicatesDialogOpen(true)}
                fileInputRef={fileInputRef}
                onImportCSV={handleImportCSV}
              />
            </header>

            <div className="p-4 sm:p-5">
              <VencimentosDuplicatesBanner
                duplicateGroupsCount={duplicateGroups.length}
                duplicateExtrasCount={duplicateExtrasCount}
                onOpen={() => setDuplicatesDialogOpen(true)}
              />

              <VencimentosTable
                loading={loading}
                filtered={filtered}
                paginatedContratos={paginatedContratos}
                hasMore={hasMore}
                totalCount={totalCount}
                shownCount={shownCount}
                loadMore={loadMore}
                sortKey={sortKey}
                sortDir={sortDir}
                toggleSort={toggleSort}
                onEdit={(c) => { setEditingContrato(c); setDialogOpen(true); }}
                onDelete={handleDelete}
                onResolve={handleResolve}
                onUnresolve={handleUnresolve}
                onUpdateStatus={handleUpdateStatus}
                onUpdateNotificado={handleUpdateNotificado}
              />
            </div>
          </section>
          )}
        </div>
      </div>


      <VencimentoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingContrato={editingContrato}
        setEditingContrato={setEditingContrato}
        onSave={handleSave}
        saving={saving}
      />

      <DuplicatesReviewDialog
        open={duplicatesDialogOpen}
        onOpenChange={setDuplicatesDialogOpen}
        duplicateGroups={duplicateGroups}
        duplicateExtrasCount={duplicateExtrasCount}
        onDeleteAllDuplicateExtras={handleDeleteAllDuplicateExtras}
        onDeleteDuplicateExtras={handleDeleteDuplicateExtras}
        onEditItem={(item) => {
          setDuplicatesDialogOpen(false);
          setEditingContrato(item);
          setDialogOpen(true);
        }}
        onDeleteItem={handleDelete}
      />

      <GoogleSheetsDialog
        open={sheetsDialogOpen}
        onOpenChange={setSheetsDialogOpen}
        sheetsUrl={sheetsUrl}
        setSheetsUrl={setSheetsUrl}
        sheetsName={sheetsName}
        setSheetsName={setSheetsName}
        onConnect={handleConnectSheets}
        syncing={syncing}
      />

      <SyncStatusBar syncConfig={syncConfig} syncing={syncing} onResync={handleResync} />
    </AppLayout>
  );
}
