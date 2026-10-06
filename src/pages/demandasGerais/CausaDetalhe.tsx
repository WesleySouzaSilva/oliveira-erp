import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gavel, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CausaFormDialog } from "./CausaFormDialog";
import {
  MATERIA_LABEL, STATUS_LIST, STATUS_MAP,
  type CausaAvulsa, type CausaNota,
} from "./constants";

const fmtMoeda = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
const fmtHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function CausaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const confirm = useConfirm();

  const [causa, setCausa] = useState<CausaAvulsa | null>(null);
  const [notas, setNotas] = useState<CausaNota[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEdit, setOpenEdit] = useState(false);
  const [novaNota, setNovaNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  const nomePorUser = useMemo(() => {
    const m = new Map<string, string>();
    (members || []).forEach((x) => m.set(x.user_id, x.nome || x.user_id.slice(0, 8)));
    return m;
  }, [members]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: c }, { data: ns }] = await Promise.all([
      (supabase as any).from("causas_avulsas").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
      (supabase as any).from("causa_notas").select("*").eq("causa_id", id).order("created_at", { ascending: false }),
    ]);
    setCausa((c ?? null) as CausaAvulsa | null);
    setNotas((ns ?? []) as CausaNota[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const changeStatus = async (novoStatus: string) => {
    if (!causa) return;
    if (novoStatus === "concluido" || novoStatus === "arquivado") {
      const ok = await confirm({
        title: novoStatus === "concluido" ? "Concluir causa?" : "Arquivar causa?",
        description: novoStatus === "concluido"
          ? "A causa deixará de aparecer entre os prazos ativos da central de vencimentos."
          : "A causa ficará arquivada — some das listas ativas mas o histórico é preservado.",
        confirmText: novoStatus === "concluido" ? "Concluir" : "Arquivar",
      });
      if (!ok) return;
    }
    const { error } = await (supabase as any)
      .from("causas_avulsas").update({ status: novoStatus }).eq("id", causa.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status atualizado.");
    setCausa({ ...causa, status: novoStatus });
  };

  const adicionarNota = async () => {
    if (!novaNota.trim() || !causa || !user) return;
    setSavingNota(true);
    const { error } = await (supabase as any).from("causa_notas").insert({
      organizacao_id: causa.organizacao_id,
      causa_id: causa.id,
      autor_id: user.id,
      conteudo: novaNota.trim(),
    });
    setSavingNota(false);
    if (error) { toast.error(error.message); return; }
    setNovaNota("");
    load();
  };

  const excluirCausa = async () => {
    if (!causa) return;
    const ok = await confirm({
      title: "Excluir causa?",
      description: "A causa será removida (soft delete). Só faça isso se ela foi cadastrada por engano.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await (supabase as any)
      .from("causas_avulsas").update({ deleted_at: new Date().toISOString() }).eq("id", causa.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Causa excluída.");
    navigate("/causas");
  };

  if (loading) {
    return <AppLayout><div className="py-20 text-center text-muted-foreground">Carregando…</div></AppLayout>;
  }
  if (!causa) {
    return (
      <AppLayout>
        <PageHeader
          icon={Gavel}
          title="Causa não encontrada"
          breadcrumb={[{ label: "Demandas complexas" }, { label: "Causas", to: "/causas" }]}
          backTo="/causas"
        />
      </AppLayout>
    );
  }

  const s = STATUS_MAP[causa.status] ?? { tone: "neutral" as const, label: causa.status };

  return (
    <AppLayout>
      <PageHeader
        icon={Gavel}
        title={causa.titulo}
        subtitle={<span className="flex items-center gap-2">
          <StatusBadge tone={s.tone} label={s.label} />
          <StatusBadge tone="neutral" label={MATERIA_LABEL[causa.materia] ?? causa.materia} />
        </span>}
        breadcrumb={[
          { label: "Demandas complexas" },
          { label: "Causas", to: "/causas" },
          { label: causa.titulo },
        ]}
        backTo="/causas"
        actions={
          <div className="flex items-center gap-2">
            <Select value={causa.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_LIST.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setOpenEdit(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Editar
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={excluirCausa}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-serif text-lg font-semibold mb-3">Dados da causa</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</dt><dd className="font-medium">{causa.cliente_nome}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">CPF/CNPJ</dt><dd>{causa.cliente_documento || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Contato</dt><dd>{causa.cliente_contato || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Parte contrária</dt><dd>{causa.parte_contraria || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Nº processo (CNJ)</dt><dd>{causa.numero_processo || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Valor da causa</dt><dd>{fmtMoeda(causa.valor_causa)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Responsável</dt><dd>{causa.responsavel_id ? (nomePorUser.get(causa.responsavel_id) ?? "—") : "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Prazo</dt><dd>{fmtData(causa.prazo)}</dd></div>
          </dl>
          {causa.descricao && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm whitespace-pre-wrap">{causa.descricao}</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-serif text-lg font-semibold mb-3">Andamento</h2>
          <div className="space-y-2">
            <Textarea
              rows={3}
              placeholder="Escreva uma nota de andamento…"
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
            />
            <Button size="sm" onClick={adicionarNota} disabled={savingNota || !novaNota.trim()}>
              Adicionar nota
            </Button>
          </div>

          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto">
            {notas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
            )}
            {notas.map((n) => (
              <div key={n.id} className="border-l-2 border-accent/40 pl-3 py-1">
                <p className="text-xs text-muted-foreground">
                  {n.autor_id ? (nomePorUser.get(n.autor_id) ?? "—") : "—"} · {fmtHora(n.created_at)}
                </p>
                <p className="text-sm whitespace-pre-wrap">{n.conteudo}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <CausaFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        causa={causa}
        onSaved={() => load()}
      />
    </AppLayout>
  );
}