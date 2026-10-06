import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const bancos = [
  "Banco do Brasil","Caixa Econômica Federal","Bradesco","Itaú","Santander",
  "Sicoob","Sicredi","Cresol","Banrisul","BNB","BASA","BNDES","Banco Safra","Banco CNH",
  "BTG Pactual","ABC Brasil","Rabobank","Outro",
];

const isOutroBanco = (banco: string | null | undefined) =>
  !!banco && banco !== "" && !bancos.includes(banco);

interface ContratoExistente {
  id: string;
  banco: string | null;
  numero_contrato: string | null;
  valor_total_operacao: number | null;
  valor_parcela: number | null;
  primeiro_vencimento: string | null;
  vencimento_proxima_parcela: string | null;
  vencimento_ultima_parcela: string | null;
}

interface NovoContrato {
  tempId: string;
  banco: string;
  numero_contrato: string;
  valor_total_operacao: string;
  valor_parcela: string;
  primeiro_vencimento: string;
  vencimento_proxima_parcela: string;
  vencimento_ultima_parcela: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeCliente: string;
  contratosExistentes: ContratoExistente[];
  onSaved: () => void;
}

export function EditClienteDialog({ open, onOpenChange, nomeCliente, contratosExistentes, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Editable existing contracts
  const [editContratos, setEditContratos] = useState<ContratoExistente[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // New contracts to add
  const [novosContratos, setNovosContratos] = useState<NovoContrato[]>([]);

  useEffect(() => {
    if (open) {
      const sorted = contratosExistentes
        .map(c => ({ ...c }))
        .sort((a, b) => (a.banco || "").localeCompare(b.banco || "", "pt-BR", { sensitivity: "base" }));
      setEditContratos(sorted);
      setNovosContratos([]);
      setDeletedIds([]);
    }
  }, [open, contratosExistentes]);

  const updateExistente = (id: string, field: keyof ContratoExistente, value: any) => {
    setEditContratos(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeExistente = (id: string) => {
    setEditContratos(prev => prev.filter(c => c.id !== id));
    setDeletedIds(prev => [...prev, id]);
  };

  const addNovo = () => {
    setNovosContratos(prev => [...prev, {
      tempId: crypto.randomUUID(),
      banco: "",
      numero_contrato: "",
      valor_total_operacao: "",
      valor_parcela: "",
      primeiro_vencimento: "",
      vencimento_proxima_parcela: "",
      vencimento_ultima_parcela: "",
    }]);
  };

  const updateNovo = (tempId: string, field: keyof NovoContrato, value: string) => {
    setNovosContratos(prev => prev.map(c => c.tempId === tempId ? { ...c, [field]: value } : c));
  };

  const removeNovo = (tempId: string) => {
    setNovosContratos(prev => prev.filter(c => c.tempId !== tempId));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Delete removed contracts
      if (deletedIds.length > 0) {
        const { error } = await supabase.from("contratos_vencimentos").delete().in("id", deletedIds);
        if (error) throw error;
      }

      // 2. Update existing contracts
      for (const c of editContratos) {
        const { error } = await supabase.from("contratos_vencimentos").update({
          banco: c.banco,
          numero_contrato: c.numero_contrato,
          valor_total_operacao: c.valor_total_operacao,
          valor_parcela: c.valor_parcela,
          primeiro_vencimento: c.primeiro_vencimento,
          vencimento_proxima_parcela: c.vencimento_proxima_parcela,
          vencimento_ultima_parcela: c.vencimento_ultima_parcela,
        }).eq("id", c.id);
        if (error) throw error;
      }

      // 3. Insert new contracts
      const novos = novosContratos.filter(c => c.banco);
      if (novos.length > 0) {
        const rows = novos.map(c => ({
          user_id: user.id,
          nome_cliente: nomeCliente,
          banco: c.banco,
          numero_contrato: c.numero_contrato || null,
          valor_total_operacao: c.valor_total_operacao ? parseFloat(c.valor_total_operacao) : null,
          valor_parcela: c.valor_parcela ? parseFloat(c.valor_parcela) : null,
          primeiro_vencimento: c.primeiro_vencimento || null,
          vencimento_proxima_parcela: c.vencimento_proxima_parcela || null,
          vencimento_ultima_parcela: c.vencimento_ultima_parcela || null,
        }));
        const { error } = await supabase.from("contratos_vencimentos").insert(rows);
        if (error) throw error;
      }

      const totalChanges = deletedIds.length + editContratos.length + novos.length;
      toast.success(`Cadastro atualizado (${totalChanges} operação${totalChanges !== 1 ? "ões" : ""})`);
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Contratos — {nomeCliente}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Existing contracts */}
          {editContratos.map((c, idx) => (
            <div key={c.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">Contrato {idx + 1}</span>
                <button onClick={() => removeExistente(c.id)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Banco</Label>
                  <select
                    value={isOutroBanco(c.banco) ? "Outro" : (c.banco || "")}
                    onChange={(e) => updateExistente(c.id, "banco", e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione</option>
                    {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {(c.banco === "Outro" || isOutroBanco(c.banco)) && (
                    <Input
                      className="mt-2"
                      placeholder="Informe o banco/instituição"
                      value={isOutroBanco(c.banco) ? (c.banco || "") : ""}
                      onChange={(e) => updateExistente(c.id, "banco", e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nº do Contrato</Label>
                  <Input value={c.numero_contrato || ""} onChange={(e) => updateExistente(c.id, "numero_contrato", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Total (R$)</Label>
                  <Input
                    type="number" step="0.01"
                    value={c.valor_total_operacao ?? ""}
                    onChange={(e) => updateExistente(c.id, "valor_total_operacao", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Parcela (R$)</Label>
                  <Input
                    type="number" step="0.01"
                    value={c.valor_parcela ?? ""}
                    onChange={(e) => updateExistente(c.id, "valor_parcela", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">1º Vencimento</Label>
                  <Input
                    type="date"
                    value={c.primeiro_vencimento || ""}
                    onChange={(e) => updateExistente(c.id, "primeiro_vencimento", e.target.value || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Próximo Vencimento</Label>
                  <Input
                    type="date"
                    value={c.vencimento_proxima_parcela || ""}
                    onChange={(e) => updateExistente(c.id, "vencimento_proxima_parcela", e.target.value || null)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Último Vencimento</Label>
                  <Input
                    type="date"
                    value={c.vencimento_ultima_parcela || ""}
                    onChange={(e) => updateExistente(c.id, "vencimento_ultima_parcela", e.target.value || null)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* New contracts */}
          {novosContratos.map((c, idx) => (
            <div key={c.tempId} className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-accent">Novo Contrato {editContratos.length + idx + 1}</span>
                <button onClick={() => removeNovo(c.tempId)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Banco *</Label>
                  <select
                    value={isOutroBanco(c.banco) ? "Outro" : c.banco}
                    onChange={(e) => updateNovo(c.tempId, "banco", e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione</option>
                    {bancos.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {(c.banco === "Outro" || isOutroBanco(c.banco)) && (
                    <Input
                      className="mt-2"
                      placeholder="Informe o banco/instituição"
                      value={isOutroBanco(c.banco) ? c.banco : ""}
                      onChange={(e) => updateNovo(c.tempId, "banco", e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nº do Contrato</Label>
                  <Input value={c.numero_contrato} onChange={(e) => updateNovo(c.tempId, "numero_contrato", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Total (R$)</Label>
                  <Input type="number" step="0.01" value={c.valor_total_operacao} onChange={(e) => updateNovo(c.tempId, "valor_total_operacao", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Parcela (R$)</Label>
                  <Input type="number" step="0.01" value={c.valor_parcela} onChange={(e) => updateNovo(c.tempId, "valor_parcela", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">1º Vencimento</Label>
                  <Input type="date" value={c.primeiro_vencimento} onChange={(e) => updateNovo(c.tempId, "primeiro_vencimento", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Próximo Vencimento</Label>
                  <Input type="date" value={c.vencimento_proxima_parcela} onChange={(e) => updateNovo(c.tempId, "vencimento_proxima_parcela", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Último Vencimento</Label>
                  <Input type="date" value={c.vencimento_ultima_parcela} onChange={(e) => updateNovo(c.tempId, "vencimento_ultima_parcela", e.target.value)} />
                </div>
              </div>
            </div>
          ))}

          {/* Add button */}
          <button
            onClick={addNovo}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-accent/40 text-accent text-sm font-medium hover:bg-accent/5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar Contrato
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
