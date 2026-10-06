import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput } from "@/components/ui/masked-input";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MATERIAS, STATUS_LIST, type CausaAvulsa } from "./constants";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  causa?: CausaAvulsa | null;
  onSaved?: (id: string) => void;
}

type Draft = {
  titulo: string;
  materia: string;
  cliente_nome: string;
  cliente_documento: string;
  cliente_contato: string;
  numero_processo: string;
  parte_contraria: string;
  valor_causa: number | null;
  status: string;
  responsavel_id: string;
  prazo: string;
  descricao: string;
};

const EMPTY: Draft = {
  titulo: "",
  materia: "outros",
  cliente_nome: "",
  cliente_documento: "",
  cliente_contato: "",
  numero_processo: "",
  parte_contraria: "",
  valor_causa: null,
  status: "novo",
  responsavel_id: "",
  prazo: "",
  descricao: "",
};

export function CausaFormDialog({ open, onOpenChange, causa, onSaved }: Props) {
  const { user } = useAuth();
  const { orgId, members } = useOrgMembers();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (causa) {
      setDraft({
        titulo: causa.titulo ?? "",
        materia: causa.materia ?? "outros",
        cliente_nome: causa.cliente_nome ?? "",
        cliente_documento: causa.cliente_documento ?? "",
        cliente_contato: causa.cliente_contato ?? "",
        numero_processo: causa.numero_processo ?? "",
        parte_contraria: causa.parte_contraria ?? "",
        valor_causa: causa.valor_causa ?? null,
        status: causa.status ?? "novo",
        responsavel_id: causa.responsavel_id ?? "",
        prazo: causa.prazo ?? "",
        descricao: causa.descricao ?? "",
      });
    } else {
      setDraft(EMPTY);
    }
  }, [open, causa]);

  const patch = (p: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...p }));

  const handleSave = async () => {
    if (!draft.titulo.trim()) { toast.error("Informe o título."); return; }
    if (!draft.cliente_nome.trim()) { toast.error("Informe o nome do cliente."); return; }
    if (!orgId || !user) { toast.error("Organização não carregada."); return; }
    setSaving(true);
    const payload: any = {
      titulo: draft.titulo.trim(),
      materia: draft.materia,
      cliente_nome: draft.cliente_nome.trim(),
      cliente_documento: draft.cliente_documento.trim() || null,
      cliente_contato: draft.cliente_contato.trim() || null,
      numero_processo: draft.numero_processo.trim() || null,
      parte_contraria: draft.parte_contraria.trim() || null,
      valor_causa: draft.valor_causa,
      status: draft.status,
      responsavel_id: draft.responsavel_id || null,
      prazo: draft.prazo || null,
      descricao: draft.descricao.trim() || null,
    };
    try {
      if (causa) {
        const { error } = await (supabase as any)
          .from("causas_avulsas")
          .update(payload)
          .eq("id", causa.id);
        if (error) throw error;
        toast.success("Causa atualizada.");
        onSaved?.(causa.id);
      } else {
        payload.organizacao_id = orgId;
        payload.created_by = user.id;
        const { data, error } = await (supabase as any)
          .from("causas_avulsas")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Causa criada.");
        onSaved?.(data.id);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{causa ? "Editar causa" : "Nova causa"}</DialogTitle>
          <DialogDescription>
            Trabalho pontual de outra matéria (fora do Agro e da Consultoria Empresarial).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Título *</Label>
            <Input value={draft.titulo} onChange={(e) => patch({ titulo: e.target.value })} placeholder="Ex.: Reclamatória trabalhista — João da Silva" />
          </div>

          <div>
            <Label>Matéria</Label>
            <Select value={draft.materia} onValueChange={(v) => patch({ materia: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIAS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_LIST.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cliente</p>
          </div>

          <div>
            <Label>Nome do cliente *</Label>
            <Input value={draft.cliente_nome} onChange={(e) => patch({ cliente_nome: e.target.value })} />
          </div>
          <div>
            <Label>CPF/CNPJ</Label>
            <MaskedInput mask="cpfCnpj" value={draft.cliente_documento} onChange={(v) => patch({ cliente_documento: v })} />
          </div>
          <div>
            <Label>Contato (telefone)</Label>
            <MaskedInput mask="telefone" value={draft.cliente_contato} onChange={(v) => patch({ cliente_contato: v })} />
          </div>
          <div>
            <Label>Parte contrária</Label>
            <Input value={draft.parte_contraria} onChange={(e) => patch({ parte_contraria: e.target.value })} placeholder="Ex.: Empresa X S/A" />
          </div>

          <div className="md:col-span-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Processo</p>
          </div>

          <div>
            <Label>Nº do processo (CNJ)</Label>
            <MaskedInput mask="cnj" value={draft.numero_processo} onChange={(v) => patch({ numero_processo: v })} placeholder="0000000-00.0000.0.00.0000" />
          </div>
          <div>
            <Label>Valor da causa</Label>
            <CurrencyInput value={draft.valor_causa} onChange={(v) => patch({ valor_causa: v })} />
          </div>

          <div>
            <Label>Responsável</Label>
            <Select value={draft.responsavel_id || "__none__"} onValueChange={(v) => patch({ responsavel_id: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— sem responsável —</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={draft.prazo} onChange={(e) => patch({ prazo: e.target.value })} />
          </div>

          <div className="md:col-span-2">
            <Label>Descrição / observações</Label>
            <Textarea rows={4} value={draft.descricao} onChange={(e) => patch({ descricao: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : (causa ? "Salvar" : "Criar causa")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CausaFormDialog;