import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TIPOS, STATUS } from "@/pages/consultoria/DemandasExternas";

type Empresa = { id: string; organizacao_id: string; razao_social: string; nome_fantasia: string | null };

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  empresa?: Empresa | null;
  /** Quando passado, edita; senão cria. */
  demandaId?: string | null;
}

export function DemandaExternaDialog({ open, onClose, onSaved, empresa: empresaFixa, demandaId }: Props) {
  const { user } = useAuth();
  const { orgId, members } = useOrgMembers();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState(empresaFixa?.id || "");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("cobranca");
  const [parteContraria, setParteContraria] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [status, setStatus] = useState("aberta");
  const [responsavelId, setResponsavelId] = useState(user?.id || "");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || empresaFixa) return;
    (supabase as any)
      .from("empresas_consultoria")
      .select("id,organizacao_id,razao_social,nome_fantasia")
      .is("deleted_at", null)
      .order("razao_social")
      .then(({ data }: any) => setEmpresas((data || []) as Empresa[]));
  }, [open, empresaFixa]);

  useEffect(() => {
    if (!open) return;
    if (!demandaId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("empresa_demandas_externas")
        .select("*")
        .eq("id", demandaId)
        .maybeSingle();
      if (!data) return;
      setEmpresaId(data.empresa_id);
      setTitulo(data.titulo || "");
      setTipo(data.tipo || "cobranca");
      setParteContraria(data.parte_contraria || "");
      setValor(data.valor ?? null);
      setStatus(data.status || "aberta");
      setResponsavelId(data.responsavel_id || "");
      setPrazo(data.prazo || "");
      setDescricao(data.descricao || "");
    })();
  }, [open, demandaId]);

  const reset = () => {
    setEmpresaId(empresaFixa?.id || ""); setTitulo(""); setTipo("cobranca");
    setParteContraria(""); setValor(null); setStatus("aberta");
    setResponsavelId(user?.id || ""); setPrazo(""); setDescricao("");
  };

  const submit = async () => {
    if (!empresaId) return toast({ title: "Selecione a empresa", variant: "destructive" });
    if (!titulo.trim()) return toast({ title: "Título é obrigatório", variant: "destructive" });

    const empresaRef = empresaFixa || empresas.find((e) => e.id === empresaId);
    const orgRef = empresaRef?.organizacao_id || orgId;
    if (!orgRef) return toast({ title: "Organização não encontrada", variant: "destructive" });

    setSaving(true);
    const payload: any = {
      organizacao_id: orgRef,
      empresa_id: empresaId,
      titulo: titulo.trim(),
      tipo,
      parte_contraria: parteContraria.trim() || null,
      valor,
      status,
      responsavel_id: responsavelId || null,
      prazo: prazo || null,
      descricao: descricao.trim() || null,
    };
    let error;
    if (demandaId) {
      ({ error } = await (supabase as any)
        .from("empresa_demandas_externas").update(payload).eq("id", demandaId));
    } else {
      payload.created_by = user?.id;
      ({ error } = await (supabase as any)
        .from("empresa_demandas_externas").insert(payload));
    }
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: demandaId ? "Demanda atualizada" : "Demanda criada" });
    reset(); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{demandaId ? "Editar demanda externa" : "Nova demanda externa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {!empresaFixa && (
            <div>
              <Label>Empresa *</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Cobrança Banco X parc. 3/12" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parte contrária</Label>
              <Input value={parteContraria} onChange={(e) => setParteContraria(e.target.value)} placeholder="Banco / credor / autor" />
            </div>
            <div>
              <Label>Valor da disputa</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}