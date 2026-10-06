import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientSearchInput } from "@/components/ClientSearchInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";

export const TIPOS_CONTATO: { value: string; label: string }[] = [
  { value: "telefone", label: "Telefone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reuniao", label: "Reunião" },
  { value: "email", label: "E-mail" },
  { value: "presencial", label: "Presencial" },
  { value: "outro", label: "Outro" },
];

export type ContatoSalvo = {
  id: string;
  cliente_nome: string;
  created_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteInicial?: { id?: string | null; nome?: string | null } | null;
  onSaved?: (n: ContatoSalvo) => void;
};

export function RegistrarContatoDialog({ open, onOpenChange, clienteInicial, onSaved }: Props) {
  const { user } = useAuth();
  const { orgId } = useOrgMembers();
  const [nome, setNome] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>("telefone");
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(clienteInicial?.nome ?? "");
    setClienteId(clienteInicial?.id ?? null);
    setTipo("telefone");
    setTitulo("");
    setNotas("");
  }, [open, clienteInicial]);

  const salvar = async () => {
    if (!user) return;
    if (!nome.trim() || !notas.trim()) {
      toast({ title: "Preencha cliente e notas", variant: "destructive" });
      return;
    }
    setSalvando(true);
    // resolve cliente_id se o usuário não selecionou via sugestão
    let resolvedId = clienteId;
    if (!resolvedId) {
      const { data: c } = await supabase
        .from("clientes")
        .select("id")
        .ilike("nome", nome.trim())
        .is("deleted_at", null)
        .limit(1);
      resolvedId = (c?.[0] as any)?.id ?? null;
    }
    const payload: any = {
      operador_id: user.id,
      organizacao_id: orgId,
      origem: "pos_venda",
      cliente_nome: nome.trim(),
      cliente_id: resolvedId,
      tipo_contato: tipo,
      titulo: titulo.trim() || null,
      notas_brutas: notas,
      status: "finalizado",
    };
    const { data, error } = await supabase
      .from("atendimentos_notas")
      .insert(payload)
      .select("id, cliente_nome, created_at")
      .single();
    setSalvando(false);
    if (error) {
      toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Contato registrado" });
    onSaved?.(data as ContatoSalvo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Cliente</label>
            {clienteInicial?.nome ? (
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            ) : (
              <ClientSearchInput
                value={nome}
                onChange={(v) => { setNome(v); setClienteId(null); }}
                onSelectClient={(c) => { setNome(c.nome_cliente); setClienteId(null); }}
                placeholder="Buscar cliente…"
              />
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo de contato</label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CONTATO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Título (opcional)</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Follow-up notificação" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={5}
              placeholder="O que foi conversado, próximos passos…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar contato"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}