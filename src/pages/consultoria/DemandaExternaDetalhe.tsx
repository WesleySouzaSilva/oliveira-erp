import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Edit, Plus, Trash2, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { DemandaExternaDialog } from "@/components/consultoria/DemandaExternaDialog";
import { TIPOS, STATUS, STATUS_STYLE } from "@/pages/consultoria/DemandasExternas";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type Demanda = {
  id: string; organizacao_id: string; empresa_id: string;
  titulo: string; tipo: string; parte_contraria: string | null;
  valor: number | null; status: string; responsavel_id: string | null;
  prazo: string | null; descricao: string | null;
  empresa?: { razao_social: string; nome_fantasia: string | null } | null;
};
type Acordo = {
  id: string; valor_acordo: number | null; condicoes: string | null;
  data_acordo: string | null; status: string; observacoes: string | null;
};

const ACORDO_STATUS = [
  { v: "proposto", l: "Proposto" },
  { v: "aceito", l: "Aceito" },
  { v: "recusado", l: "Recusado" },
  { v: "cumprindo", l: "Cumprindo" },
  { v: "cumprido", l: "Cumprido" },
  { v: "descumprido", l: "Descumprido" },
];
const ACORDO_STYLE: Record<string, string> = {
  proposto: "bg-purple-500/15 text-purple-700",
  aceito: "bg-blue-500/15 text-blue-700",
  recusado: "bg-muted text-muted-foreground",
  cumprindo: "bg-yellow-500/15 text-yellow-700",
  cumprido: "bg-primary/15 text-primary",
  descumprido: "bg-red-500/15 text-red-700",
};
const fmtBRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DemandaExternaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();

  const [demanda, setDemanda] = useState<Demanda | null>(null);
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [acordoOpen, setAcordoOpen] = useState(false);
  const [editingAcordo, setEditingAcordo] = useState<Acordo | null>(null);

  const load = async () => {
    if (!id) return;
    const { data: d } = await (supabase as any)
      .from("empresa_demandas_externas")
      .select("*, empresa:empresas_consultoria(razao_social,nome_fantasia)")
      .eq("id", id)
      .maybeSingle();
    setDemanda(d as Demanda);
    const { data: a } = await (supabase as any)
      .from("empresa_acordos")
      .select("id,valor_acordo,condicoes,data_acordo,status,observacoes")
      .eq("demanda_externa_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setAcordos((a || []) as Acordo[]);
  };
  useEffect(() => { load(); }, [id]);

  const removerAcordo = async (acordoId: string) => {
    const ok = await confirm({
      title: "Excluir acordo?",
      description: "Esta ação não pode ser desfeita.",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await (supabase as any)
      .from("empresa_acordos").update({ deleted_at: new Date().toISOString() }).eq("id", acordoId);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Acordo removido" });
    load();
  };

  if (!demanda) return <AppLayout><div className="p-6">Carregando...</div></AppLayout>;

  const empresaNome = demanda.empresa?.nome_fantasia || demanda.empresa?.razao_social || "—";

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <PageHeader
          backTo="/consultoria/demandas-externas"
          breadcrumb={[
            { label: "Empresarial" },
            { label: "Demandas externas", to: "/consultoria/demandas-externas" },
            { label: demanda.titulo },
          ]}
          title={demanda.titulo}
          subtitle={empresaNome}
          actions={
            <>
              <StatusBadge
                status={demanda.status}
                label={STATUS.find((s) => s.v === demanda.status)?.l ?? demanda.status}
              />
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Edit className="w-4 h-4 mr-1" /> Editar
              </Button>
            </>
          }
        />

        <Card className="p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Tipo:</span> {TIPOS.find((t) => t.v === demanda.tipo)?.l ?? demanda.tipo}</div>
            <div><span className="text-muted-foreground">Parte contrária:</span> {demanda.parte_contraria ?? "—"}</div>
            <div><span className="text-muted-foreground">Valor:</span> {fmtBRL(demanda.valor)}</div>
            <div><span className="text-muted-foreground">Prazo:</span> {demanda.prazo ? new Date(demanda.prazo).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
          {demanda.descricao && (
            <p className="text-sm whitespace-pre-wrap pt-2 border-t">{demanda.descricao}</p>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" /> Acordos
            </h2>
            <Button size="sm" onClick={() => { setEditingAcordo(null); setAcordoOpen(true); }}
              className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="w-4 h-4 mr-1" /> Novo acordo
            </Button>
          </div>
          {acordos.length === 0 ? (
            <EmptyState icon={Handshake} compact title="Nenhum acordo registrado" description="Adicione propostas e o status do acordo." />
          ) : (
            <div className="space-y-2">
              {acordos.map((a) => (
                <div key={a.id} className="p-3 border rounded-md flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className={ACORDO_STYLE[a.status]}>
                        {ACORDO_STATUS.find((s) => s.v === a.status)?.l ?? a.status}
                      </Badge>
                      <span className="font-medium">{fmtBRL(a.valor_acordo)}</span>
                      {a.data_acordo && (
                        <span className="text-xs text-muted-foreground">
                          · {new Date(a.data_acordo).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                    {a.condicoes && <div className="text-sm text-muted-foreground">{a.condicoes}</div>}
                    {a.observacoes && <div className="text-xs text-muted-foreground mt-1">{a.observacoes}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingAcordo(a); setAcordoOpen(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removerAcordo(a.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <DemandaExternaDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); load(); }}
          demandaId={demanda.id}
        />

        <AcordoDialog
          open={acordoOpen}
          onClose={() => { setAcordoOpen(false); setEditingAcordo(null); }}
          onSaved={async (novoStatusAcordo) => {
            setAcordoOpen(false); setEditingAcordo(null);
            if (["aceito", "cumprindo", "cumprido"].includes(novoStatusAcordo)
              && ["aberta", "em_negociacao", "acordo_proposto"].includes(demanda.status)) {
              const ok = await confirm({
                title: "Atualizar status da demanda?",
                description: "Marcar a demanda como 'Acordo fechado'?",
              });
              if (ok) {
                await (supabase as any).from("empresa_demandas_externas")
                  .update({ status: "acordo_fechado" }).eq("id", demanda.id);
              }
            }
            load();
          }}
          demanda={demanda}
          acordo={editingAcordo}
          userId={user?.id}
        />
      </div>
    </AppLayout>
  );
}

function AcordoDialog({
  open, onClose, onSaved, demanda, acordo, userId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (status: string) => void;
  demanda: Demanda;
  acordo: Acordo | null;
  userId?: string;
}) {
  const [valor, setValor] = useState<number | null>(null);
  const [condicoes, setCondicoes] = useState("");
  const [dataAcordo, setDataAcordo] = useState("");
  const [status, setStatus] = useState("proposto");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValor(acordo?.valor_acordo ?? null);
    setCondicoes(acordo?.condicoes ?? "");
    setDataAcordo(acordo?.data_acordo ?? "");
    setStatus(acordo?.status ?? "proposto");
    setObs(acordo?.observacoes ?? "");
  }, [open, acordo]);

  const submit = async () => {
    setSaving(true);
    const payload: any = {
      organizacao_id: demanda.organizacao_id,
      demanda_externa_id: demanda.id,
      empresa_id: demanda.empresa_id,
      valor_acordo: valor,
      condicoes: condicoes.trim() || null,
      data_acordo: dataAcordo || null,
      status,
      observacoes: obs.trim() || null,
    };
    let error;
    if (acordo) {
      ({ error } = await (supabase as any)
        .from("empresa_acordos").update(payload).eq("id", acordo.id));
    } else {
      payload.created_by = userId;
      ({ error } = await (supabase as any).from("empresa_acordos").insert(payload));
    }
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: acordo ? "Acordo atualizado" : "Acordo criado" });
    onSaved(status);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{acordo ? "Editar acordo" : "Novo acordo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor do acordo</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={dataAcordo} onChange={(e) => setDataAcordo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACORDO_STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Condições</Label>
            <Textarea value={condicoes} onChange={(e) => setCondicoes(e.target.value)} rows={2}
              placeholder="Parcelas, desconto, prazo de pagamento..." />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}