import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Link2, Link2Off, Loader2, Search, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Lawsuit = {
  id: string | number;
  number?: string | null;
  lawsuit_number?: string | null;
  customer?: { id?: string | number; name?: string | null; document?: string | null } | null;
};

interface Props {
  processoId: string;
  organizacaoId: string | null;
  onSyncDone?: () => void;
}

function normalizeCnj(s: string | null | undefined) {
  return (s || "").replace(/\D+/g, "");
}

export function AdvboxVinculoCard({ processoId, organizacaoId, onSyncDone }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [numeroSaved, setNumeroSaved] = useState("");
  const [advboxLawsuitId, setAdvboxLawsuitId] = useState<string | null>(null);
  const [vinculadoEm, setVinculadoEm] = useState<string | null>(null);
  const [vinculadoPor, setVinculadoPor] = useState<string | null>(null);
  const [vinculadoPorNome, setVinculadoPorNome] = useState<string | null>(null);
  const [savingNumero, setSavingNumero] = useState(false);

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [lawsuits, setLawsuits] = useState<Lawsuit[]>([]);
  const [filter, setFilter] = useState("");
  const [chosen, setChosen] = useState<Lawsuit | null>(null);
  const [confirming, setConfirming] = useState(false);

  // unlink
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // sync
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("processos")
      .select("numero_processo, advbox_lawsuit_id, advbox_vinculado_em, advbox_vinculado_por")
      .eq("id", processoId)
      .single();
    if (!error && data) {
      setNumeroProcesso(data.numero_processo || "");
      setNumeroSaved(data.numero_processo || "");
      setAdvboxLawsuitId(data.advbox_lawsuit_id || null);
      setVinculadoEm(data.advbox_vinculado_em || null);
      setVinculadoPor(data.advbox_vinculado_por || null);
      if (data.advbox_vinculado_por) {
        const { data: prof } = await supabase
          .from("profiles_publico").select("nome").eq("id", data.advbox_vinculado_por).maybeSingle();
        setVinculadoPorNome(prof?.nome || null);
      } else {
        setVinculadoPorNome(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (processoId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId]);

  const saveNumero = async () => {
    setSavingNumero(true);
    const { error } = await supabase
      .from("processos").update({ numero_processo: numeroProcesso || null }).eq("id", processoId);
    setSavingNumero(false);
    if (error) { toast.error("Erro ao salvar número do processo"); return; }
    toast.success("Número do processo salvo");
    setNumeroSaved(numeroProcesso || "");
  };

  const fetchLawsuits = async (p: number) => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("advbox-sync", {
        body: { action: "list_lawsuits", params: { page: p } },
      });
      if (error) throw error;
      const list: Lawsuit[] = Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.lawsuits) ? data.lawsuits
        : Array.isArray(data) ? data : [];
      setLawsuits(list);
      setPage(p);
    } catch (e: any) {
      toast.error("Erro ao listar processos do ADVBOX", { description: e?.message || String(e) });
    } finally {
      setFetching(false);
    }
  };

  const openDialog = async () => {
    setChosen(null);
    setLawsuits([]);
    setFilter(numeroSaved || "");
    setDialogOpen(true);
    await fetchLawsuits(1);
  };

  const cnjAppDigits = normalizeCnj(numeroSaved);
  const sortedLawsuits = (() => {
    const list = [...lawsuits];
    if (filter.trim()) {
      const fDigits = normalizeCnj(filter);
      const fLower = filter.toLowerCase();
      return list.filter(l => {
        const num = (l.number || l.lawsuit_number || "").toString();
        const cust = (l.customer?.name || "").toLowerCase();
        const doc = (l.customer?.document || "").toString();
        return (
          (fDigits && normalizeCnj(num).includes(fDigits)) ||
          cust.includes(fLower) ||
          (fDigits && normalizeCnj(doc).includes(fDigits))
        );
      });
    }
    if (cnjAppDigits) {
      list.sort((a, b) => {
        const am = normalizeCnj(a.number || a.lawsuit_number || "") === cnjAppDigits ? -1 : 0;
        const bm = normalizeCnj(b.number || b.lawsuit_number || "") === cnjAppDigits ? -1 : 0;
        return am - bm;
      });
    }
    return list;
  })();

  const confirmVinculo = async () => {
    if (!chosen || !user) return;
    setConfirming(true);
    const advboxId = String(chosen.id);
    const cnj = (chosen.number || chosen.lawsuit_number || "").toString().trim();
    const update: any = {
      advbox_lawsuit_id: advboxId,
      advbox_vinculado_em: new Date().toISOString(),
      advbox_vinculado_por: user.id,
    };
    if (!numeroSaved && cnj) update.numero_processo = cnj;
    const { error } = await supabase.from("processos").update(update).eq("id", processoId);
    setConfirming(false);
    if (error) {
      const msg = (error as any).message || "";
      if (/uq_processos_org_advbox_lawsuit|duplicate key/i.test(msg)) {
        toast.error("Este processo do ADVBOX já está vinculado a outro processo desta organização.");
      } else {
        toast.error("Erro ao vincular", { description: msg });
      }
      return;
    }
    toast.success("Processo vinculado ao ADVBOX");
    setDialogOpen(false);
    await load();
  };

  const desvincular = async () => {
    setUnlinking(true);
    const { error } = await supabase
      .from("processos")
      .update({
        advbox_lawsuit_id: null,
        advbox_vinculado_em: null,
        advbox_vinculado_por: null,
      })
      .eq("id", processoId);
    setUnlinking(false);
    setUnlinkOpen(false);
    if (error) { toast.error("Erro ao desvincular"); return; }
    toast.success("Vínculo removido");
    await load();
  };

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("advbox-sync", {
        body: { action: "sync_movements", params: { processo_id: processoId } },
      });
      if (error) throw error;
      const novos = (data as any)?.andamentos_novos ?? 0;
      toast.success(novos > 0 ? `${novos} novo(s) andamento(s) sincronizado(s).` : "Nenhum andamento novo.");
      onSyncDone?.();
    } catch (e: any) {
      toast.error("Erro ao sincronizar andamentos", { description: e?.message || String(e) });
    } finally {
      setSyncing(false);
    }
  };

  const isVinculado = !!advboxLawsuitId;
  const numeroChanged = (numeroProcesso || "") !== (numeroSaved || "");

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Processo no ADVBOX</h3>
        </div>
        {isVinculado && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
            <CheckCircle2 className="h-3 w-3" /> Vinculado
          </span>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="numero_processo">Número do processo (CNJ)</Label>
        <div className="flex gap-2">
          <MaskedInput
            id="numero_processo"
            mask="cnj"
            value={numeroProcesso}
            onChange={setNumeroProcesso}
            placeholder="0000000-00.0000.0.00.0000"
            disabled={loading}
          />
          <Button
            variant="outline"
            onClick={saveNumero}
            disabled={savingNumero || !numeroChanged || loading}
          >
            {savingNumero ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Pode ser preenchido manualmente. Usado como sugestão ao vincular ao ADVBOX.
        </p>
      </div>

      {isVinculado ? (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
          <div><span className="text-muted-foreground">ADVBOX ID:</span> <span className="font-mono">{advboxLawsuitId}</span></div>
          <div><span className="text-muted-foreground">CNJ:</span> {numeroSaved || "—"}</div>
          <div className="text-xs text-muted-foreground">
            Vinculado por {vinculadoPorNome || vinculadoPor || "—"}
            {vinculadoEm ? ` em ${new Date(vinculadoEm).toLocaleString("pt-BR")}` : ""}
          </div>
          <div className="pt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={sincronizar} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar andamentos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setUnlinkOpen(true)}>
              <Link2Off className="h-4 w-4 mr-1" /> Desvincular
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={openDialog} disabled={loading || !organizacaoId} className="w-full">
          <Link2 className="h-4 w-4 mr-2" /> Vincular ao ADVBOX
        </Button>
      )}

      {/* Vincular dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular processo do ADVBOX</DialogTitle>
            <DialogDescription>
              Escolha manualmente o processo correspondente no ADVBOX. Vínculo por NOME NÃO é feito automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Filtrar por CNJ, nome ou documento…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => fetchLawsuits(page)} disabled={fetching}>
              {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recarregar"}
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto border border-border rounded-md divide-y">
            {fetching && lawsuits.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando…
              </div>
            ) : sortedLawsuits.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum processo encontrado.</div>
            ) : (
              sortedLawsuits.map((l) => {
                const num = (l.number || l.lawsuit_number || "").toString();
                const isMatch = !!cnjAppDigits && normalizeCnj(num) === cnjAppDigits;
                const isChosen = chosen && String(chosen.id) === String(l.id);
                return (
                  <button
                    key={String(l.id)}
                    type="button"
                    onClick={() => setChosen(l)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-muted/40 transition flex flex-col gap-0.5",
                      isChosen && "bg-primary/10 ring-1 ring-primary/40",
                      isMatch && !isChosen && "bg-success/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{num || "(sem CNJ)"}</span>
                      {isMatch && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">
                          CNJ bate
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">ADVBOX #{String(l.id)}</span>
                    </div>
                    <div className="text-sm">{l.customer?.name || "—"}</div>
                    {l.customer?.document && (
                      <div className="text-xs text-muted-foreground">Doc: {l.customer.document}</div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Página {page}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={fetching || page <= 1} onClick={() => fetchLawsuits(page - 1)}>Anterior</Button>
              <Button size="sm" variant="ghost" disabled={fetching} onClick={() => fetchLawsuits(page + 1)}>Próxima</Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmVinculo} disabled={!chosen || confirming}>
              {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirmar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink alert */}
      <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular do ADVBOX?</AlertDialogTitle>
            <AlertDialogDescription>
              O número do processo (CNJ) será mantido. O vínculo com o ADVBOX será removido e nenhum novo andamento será sincronizado até que seja vinculado novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={desvincular} disabled={unlinking}>
              {unlinking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}