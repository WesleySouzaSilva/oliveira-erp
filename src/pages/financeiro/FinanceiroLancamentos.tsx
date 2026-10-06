import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, Pencil, Lock, Download } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useUrlFilters } from "@/hooks/useUrlFilters";

type Lanc = {
  id: string; organizacao_id: string;
  tipo: "receita"|"despesa"; descricao: string; valor: number; data: string;
  categoria: string | null; setor: "agro"|"empresarial"|"geral"; origem: string;
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SETOR_STYLE: Record<string, string> = {
  agro: "bg-primary/10 text-primary",
  empresarial: "bg-accent/15 text-accent",
  geral: "bg-muted text-muted-foreground",
};

export default function FinanceiroLancamentos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId } = useOrgMembers();
  const [rows, setRows] = useState<Lanc[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useUrlFilters({
    busca: "",
    fTipo: "todos",
    fSetor: "todos",
    fDe: "",
    fAte: "",
  });
  const { busca, fTipo, fSetor, fDe, fAte } = filters;

  const [editor, setEditor] = useState<{ open: boolean; editing?: Lanc | null }>({ open: false });
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [bulkRemove, setBulkRemove] = useState<{ ids: string[] } | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("financeiro_lancamentos")
      .select("*")
      .is("deleted_at", null)
      .order("data", { ascending: false })
      .limit(1000);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setRows(((data as any[]) || []).map(l => ({ ...l, valor: Number(l.valor) })));
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => rows.filter(r => {
    if (fTipo !== "todos" && r.tipo !== fTipo) return false;
    if (fSetor !== "todos" && r.setor !== fSetor) return false;
    if (fDe && r.data < fDe) return false;
    if (fAte && r.data > fAte) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      if (!r.descricao.toLowerCase().includes(q) && !(r.categoria || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rows, fTipo, fSetor, fDe, fAte, busca]);

  const totais = useMemo(() => {
    const rec = filtradas.filter(r => r.tipo === "receita").reduce((s,r) => s + r.valor, 0);
    const desp = filtradas.filter(r => r.tipo === "despesa").reduce((s,r) => s + r.valor, 0);
    return { rec, desp, saldo: rec - desp };
  }, [filtradas]);

  const excluir = async () => {
    if (!removerId) return;
    const id = removerId; setRemoverId(null);
    const { error } = await (supabase as any)
      .from("financeiro_lancamentos")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setRows(arr => arr.filter(r => r.id !== id));
    toast({ title: "Lançamento removido" });
  };

  const excluirEmMassa = async (ids: string[]) => {
    const { error } = await (supabase as any)
      .from("financeiro_lancamentos")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setRows((arr) => arr.filter((r) => !ids.includes(r.id)));
    toast({ title: `${ids.length} lançamento(s) removido(s)` });
  };

  const exportarCsv = (selecionadas: Lanc[]) => {
    const header = ["data", "tipo", "setor", "descricao", "categoria", "valor"];
    const linhas = selecionadas.map((l) => [
      l.data, l.tipo, l.setor,
      `"${(l.descricao || "").replace(/"/g, '""')}"`,
      `"${(l.categoria || "").replace(/"/g, '""')}"`,
      String(l.valor),
    ].join(","));
    const csv = [header.join(","), ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lancamentos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          backTo="/financeiro"
          icon={Lock}
          title="Lançamentos manuais"
          subtitle="Receitas e despesas registradas à mão. Restrito ao CEO."
          breadcrumb={[
            { label: "Financeiro", to: "/financeiro" },
            { label: "Lançamentos" },
          ]}
          actions={
            <Button onClick={() => setEditor({ open: true, editing: null })}>
              <Plus className="w-4 h-4 mr-2" /> Novo lançamento
            </Button>
          }
        />

        <Card className="p-3 grid md:grid-cols-5 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={e => setFilters({ busca: e.target.value })} placeholder="Buscar descrição/categoria" className="pl-9" />
          </div>
          <Select value={fTipo} onValueChange={(v) => setFilters({ fTipo: v })}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fSetor} onValueChange={(v) => setFilters({ fSetor: v })}>
            <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              <SelectItem value="agro">Agro</SelectItem>
              <SelectItem value="empresarial">Empresarial</SelectItem>
              <SelectItem value="geral">Geral</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input type="date" value={fDe} onChange={e => setFilters({ fDe: e.target.value })} className="h-9" title="De" />
            <Input type="date" value={fAte} onChange={e => setFilters({ fAte: e.target.value })} className="h-9" title="Até" />
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Receitas (filtro)</div><div className="text-2xl font-semibold text-primary">{fmtBRL(totais.rec)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Despesas (filtro)</div><div className="text-2xl font-semibold text-destructive">{fmtBRL(totais.desp)}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Saldo</div><div className={`text-2xl font-semibold ${totais.saldo>=0?"text-primary":"text-destructive"}`}>{fmtBRL(totais.saldo)}</div></Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <DataTable<Lanc>
            data={filtradas}
            loading={loading}
            getRowId={(l) => l.id}
            defaultSort={{ key: "data", dir: "desc" }}
            selectable
            tableId="financeiro-lancamentos"
            columnsToggle
            bulkActions={(selRows, clear) => (
              <>
                <Button size="sm" variant="outline" className="h-7" onClick={() => exportarCsv(selRows)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
                </Button>
                <Button size="sm" variant="destructive" className="h-7" onClick={() => setBulkRemove({ ids: selRows.map(r => r.id) })}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir selecionados
                </Button>
              </>
            )}
            emptyState={{
              title: "Nenhum lançamento",
              description: "Ajuste os filtros ou registre um novo lançamento.",
              action: { label: "Novo lançamento", icon: Plus, onClick: () => setEditor({ open: true, editing: null }) },
            }}
            columns={[
              {
                key: "data",
                header: "Data",
                sortAccessor: (l) => l.data,
                render: (l) => new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR"),
                width: "w-28",
                alwaysVisible: true,
              },
              {
                key: "tipo",
                header: "Tipo",
                sortAccessor: (l) => l.tipo,
                render: (l) => (
                  <Badge variant="outline" className={l.tipo === "receita" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}>
                    {l.tipo}
                  </Badge>
                ),
              },
              {
                key: "setor",
                header: "Setor",
                sortAccessor: (l) => l.setor,
                render: (l) => <Badge className={SETOR_STYLE[l.setor]}>{l.setor}</Badge>,
              },
              {
                key: "descricao",
                header: "Descrição",
                sortAccessor: (l) => l.descricao,
                render: (l) => <span className="font-medium">{l.descricao}</span>,
                alwaysVisible: true,
              },
              {
                key: "categoria",
                header: "Categoria",
                sortAccessor: (l) => l.categoria,
                render: (l) => l.categoria || "—",
              },
              {
                key: "valor",
                header: "Valor",
                align: "right",
                sortAccessor: (l) => (l.tipo === "despesa" ? -l.valor : l.valor),
                render: (l) => (
                  <span className={`font-semibold tabular-nums ${l.tipo==="receita"?"text-primary":"text-destructive"}`}>
                    {l.tipo === "despesa" ? "−" : ""}{fmtBRL(l.valor)}
                  </span>
                ),
                alwaysVisible: true,
              },
              {
                key: "acoes",
                header: "",
                sortable: false,
                align: "right",
                width: "w-24",
                alwaysVisible: true,
                render: (l) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditor({ open: true, editing: l })}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoverId(l.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ),
              },
            ] as DataTableColumn<Lanc>[]}
          />
        </Card>

        {editor.open && (
          <EditorLanc
            editing={editor.editing || null}
            orgId={orgId}
            userId={user?.id || null}
            onClose={() => setEditor({ open: false })}
            onSaved={() => { setEditor({ open: false }); carregar(); }}
          />
        )}

        <AlertDialog open={!!removerId} onOpenChange={(o) => !o && setRemoverId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
              <AlertDialogDescription>O lançamento será arquivado (soft-delete) e some das listas.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={excluir} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!bulkRemove} onOpenChange={(o) => !o && setBulkRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover {bulkRemove?.ids.length} lançamento(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                Os lançamentos serão arquivados (soft-delete) e somem das listas. Só afeta itens que sua permissão já permite editar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (bulkRemove) await excluirEmMassa(bulkRemove.ids);
                  setBulkRemove(null);
                }}
                className="bg-destructive text-destructive-foreground"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function EditorLanc({
  editing, orgId, userId, onClose, onSaved,
}: {
  editing: Lanc | null; orgId: string | null; userId: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<"receita"|"despesa">(editing?.tipo || "receita");
  const [descricao, setDescricao] = useState(editing?.descricao || "");
  const [valor, setValor] = useState<number>(editing?.valor || 0);
  const [data, setData] = useState(editing?.data || new Date().toISOString().slice(0,10));
  const [categoria, setCategoria] = useState(editing?.categoria || "");
  const [setor, setSetor] = useState<"agro"|"empresarial"|"geral">(editing?.setor || "geral");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!descricao.trim() || !valor || !data) {
      toast({ title: "Preencha descrição, valor e data", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const payload: any = {
      tipo, descricao: descricao.trim(), valor, data,
      categoria: categoria.trim() || null, setor,
    };
    let error;
    if (editing) {
      ({ error } = await (supabase as any)
        .from("financeiro_lancamentos").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await (supabase as any)
        .from("financeiro_lancamentos").insert({
          ...payload, organizacao_id: orgId, created_by: userId, origem: "manual",
        }));
    }
    setSalvando(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Lançamento atualizado" : "Lançamento criado" });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Select value={setor} onValueChange={(v) => setSetor(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Geral</SelectItem>
                  <SelectItem value="agro">Agro</SelectItem>
                  <SelectItem value="empresarial">Empresarial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Honorários — empresa X" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor *</Label>
              <CurrencyInput value={valor} onChange={(v) => setValor(v ?? 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: honorários, software, folha" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}
            className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}