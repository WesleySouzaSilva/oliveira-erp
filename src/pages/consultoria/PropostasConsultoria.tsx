import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Search, MoreVertical, Eye, RefreshCcw, Trash2, CircleDot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";

type Status = "rascunho" | "enviada" | "aceita" | "recusada";

type Proposta = {
  id: string;
  titulo: string;
  empresa_id: string | null;
  prospect_nome: string | null;
  valor_sugerido: number | null;
  status: Status;
  observacoes: string | null;
  inputs: Record<string, unknown>;
  resultado: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  empresa?: { razao_social: string; nome_fantasia: string | null } | null;
  autor?: { nome: string | null } | null;
};

const STATUS_LABEL: Record<Status, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};

const STATUS_STYLE: Record<Status, string> = {
  rascunho: "bg-muted text-foreground",
  enviada: "bg-blue-500/15 text-blue-700",
  aceita: "bg-primary/15 text-primary",
  recusada: "bg-destructive/15 text-destructive",
};

const fmtBRL = (v: number | null | undefined) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : "—";

const fmtData = (d: string) => new Date(d).toLocaleDateString("pt-BR");

export default function PropostasConsultoria() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useUrlFilters({ busca: "", statusFiltro: "todos" });
  const { busca } = filters;
  const statusFiltro = filters.statusFiltro as Status | "todos";
  const [aberta, setAberta] = useState<Proposta | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("consultoria_propostas")
      .select(`
        id, titulo, empresa_id, prospect_nome, valor_sugerido, status, observacoes,
        inputs, resultado, created_at, created_by,
        empresa:empresas_consultoria(razao_social, nome_fantasia),
        autor:profiles!consultoria_propostas_created_by_fkey(nome)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      // Fallback sem joins (caso a FK não esteja exposta no PostgREST)
      const { data: d2, error: e2 } = await (supabase as any)
        .from("consultoria_propostas")
        .select("id, titulo, empresa_id, prospect_nome, valor_sugerido, status, observacoes, inputs, resultado, created_at, created_by")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (e2) {
        toast({ title: "Erro ao carregar propostas", description: e2.message, variant: "destructive" });
        setLoading(false); return;
      }
      const rows = (d2 || []) as Proposta[];
      const empIds = Array.from(new Set(rows.map((r) => r.empresa_id).filter(Boolean) as string[]));
      const userIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]));
      const [{ data: emps }, { data: profs }] = await Promise.all([
        empIds.length
          ? (supabase as any).from("empresas_consultoria").select("id,razao_social,nome_fantasia").in("id", empIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? supabase.from("profiles_publico").select("id,nome").in("id", userIds)
          : Promise.resolve({ data: [] }),
      ]);
      const empMap = new Map<string, any>((emps || []).map((e: any) => [e.id, e]));
      const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));
      setPropostas(rows.map((r) => ({
        ...r,
        empresa: r.empresa_id ? empMap.get(r.empresa_id) ?? null : null,
        autor: r.created_by ? profMap.get(r.created_by) ?? null : null,
      })));
      setLoading(false);
      return;
    }
    setPropostas((data || []) as Proposta[]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const lista = useMemo(() => {
    return propostas.filter((p) => {
      if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const alvo = `${p.titulo} ${p.prospect_nome ?? ""} ${p.empresa?.nome_fantasia ?? ""} ${p.empresa?.razao_social ?? ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [propostas, busca, statusFiltro]);

  const mudarStatus = async (id: string, status: Status) => {
    const { error } = await (supabase as any)
      .from("consultoria_propostas")
      .update({ status })
      .eq("id", id);
    if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
    setPropostas((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    if (aberta?.id === id) setAberta({ ...aberta, status });
    toast({ title: "Status atualizado" });
  };

  const excluir = async () => {
    if (!excluirId) return;
    const { error } = await (supabase as any)
      .from("consultoria_propostas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", excluirId);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    setPropostas((prev) => prev.filter((p) => p.id !== excluirId));
    setExcluirId(null);
    if (aberta?.id === excluirId) setAberta(null);
    toast({ title: "Proposta excluída" });
  };

  const refazer = (p: Proposta) => {
    navigate(`/consultoria-empresarial?proposta=${p.id}`);
  };

  const nomeAlvo = (p: Proposta) =>
    p.empresa?.nome_fantasia || p.empresa?.razao_social || p.prospect_nome || "—";

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={FileText}
          title="Propostas"
          subtitle="Histórico de simulações de consultoria empresarial."
          breadcrumb={[{ label: "Empresarial" }, { label: "Propostas" }]}
          actions={
            <Button onClick={() => navigate("/consultoria-empresarial")}>
              <FileText className="w-4 h-4" /> Nova proposta no simulador
            </Button>
          }
        />

        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setFilters({ busca: e.target.value })} className="pl-9" placeholder="Buscar por título, empresa ou prospect" />
            </div>
            <Select value={statusFiltro} onValueChange={(v) => setFilters({ statusFiltro: v })}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="aceita">Aceita</SelectItem>
                <SelectItem value="recusada">Recusada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <DataTable<Proposta>
            data={lista}
            loading={loading}
            getRowId={(p) => p.id}
            onRowClick={(p) => setAberta(p)}
            defaultSort={{ key: "data", dir: "desc" }}
            tableId="propostas-consultoria"
            columnsToggle
            emptyState={{
              icon: FileText,
              title: "Nenhuma proposta ainda",
              description: "Use o Simulador de Planos e clique em Salvar como proposta para começar.",
              action: { label: "Ir para o Simulador", variant: "outline", onClick: () => navigate("/consultoria-empresarial") },
            }}
            columns={[
              {
                key: "titulo",
                header: "Título",
                sortAccessor: (p) => p.titulo,
                alwaysVisible: true,
                render: (p) => <span className="font-medium">{p.titulo}</span>,
              },
              {
                key: "alvo",
                header: "Empresa / Prospect",
                sortAccessor: (p) => nomeAlvo(p),
                render: (p) => (
                  <>
                    {nomeAlvo(p)}
                    {!p.empresa_id && p.prospect_nome && (
                      <Badge variant="outline" className="ml-2 text-[10px]">prospect</Badge>
                    )}
                  </>
                ),
              },
              {
                key: "valor",
                header: "Valor sugerido",
                align: "right",
                sortAccessor: (p) => (typeof p.valor_sugerido === "number" ? p.valor_sugerido : null),
                render: (p) => fmtBRL(p.valor_sugerido),
              },
              {
                key: "status",
                header: "Status",
                sortAccessor: (p) => STATUS_LABEL[p.status],
                alwaysVisible: true,
                render: (p) => <StatusBadge status={p.status} label={STATUS_LABEL[p.status]} />,
              },
              {
                key: "data",
                header: "Data",
                sortAccessor: (p) => new Date(p.created_at),
                render: (p) => fmtData(p.created_at),
              },
              {
                key: "autor",
                header: "Autor",
                sortAccessor: (p) => p.autor?.nome ?? null,
                render: (p) => <span className="text-muted-foreground">{p.autor?.nome ?? "—"}</span>,
              },
              {
                key: "acoes",
                header: "",
                sortable: false,
                width: "w-12",
                align: "right",
                alwaysVisible: true,
                render: (p) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAberta(p)}>
                        <Eye className="w-4 h-4 mr-2" /> Abrir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => refazer(p)}>
                        <RefreshCcw className="w-4 h-4 mr-2" /> Refazer no simulador
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                      {(["rascunho","enviada","aceita","recusada"] as Status[]).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => mudarStatus(p.id, s)} disabled={p.status === s}>
                          <CircleDot className="w-4 h-4 mr-2" /> {STATUS_LABEL[s]}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setExcluirId(p.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ] as DataTableColumn<Proposta>[]}
          />
        </Card>
      </div>

      {/* Drawer de detalhe */}
      <Sheet open={!!aberta} onOpenChange={(v) => !v && setAberta(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {aberta && (
            <>
              <SheetHeader>
                <SheetTitle>{aberta.titulo}</SheetTitle>
                <SheetDescription>
                  {nomeAlvo(aberta)} · {fmtData(aberta.created_at)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 mt-5">
                <div className="flex items-center gap-3">
                  <StatusBadge status={aberta.status} label={STATUS_LABEL[aberta.status]} />
                  <span className="text-lg font-semibold">{fmtBRL(aberta.valor_sugerido)}</span>
                </div>

                <div>
                  <h3 className="text-xs uppercase text-muted-foreground mb-1">Inputs</h3>
                  <pre className="text-xs bg-muted/40 p-3 rounded-md overflow-auto">
                    {JSON.stringify(aberta.inputs, null, 2)}
                  </pre>
                </div>

                <div>
                  <h3 className="text-xs uppercase text-muted-foreground mb-1">Resultado</h3>
                  <pre className="text-xs bg-muted/40 p-3 rounded-md overflow-auto">
                    {JSON.stringify(aberta.resultado, null, 2)}
                  </pre>
                </div>

                {aberta.observacoes && (
                  <div>
                    <h3 className="text-xs uppercase text-muted-foreground mb-1">Observações</h3>
                    <p className="text-sm whitespace-pre-wrap">{aberta.observacoes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button onClick={() => refazer(aberta)}>
                    <RefreshCcw className="w-4 h-4" /> Refazer no simulador
                  </Button>
                  <Select value={aberta.status} onValueChange={(v) => mudarStatus(aberta.id, v as Status)}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="enviada">Enviada</SelectItem>
                      <SelectItem value="aceita">Aceita</SelectItem>
                      <SelectItem value="recusada">Recusada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!excluirId} onOpenChange={(v) => !v && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação faz exclusão lógica (pode ser recuperada por suporte).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}