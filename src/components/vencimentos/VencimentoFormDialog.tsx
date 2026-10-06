import { useRef, useState } from "react";
import { Save, Sparkles, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientSearchInput } from "@/components/ClientSearchInput";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { Contrato } from "@/hooks/useVencimentosData";
import { STATUS_OPTIONS } from "./lib/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingContrato: Partial<Contrato> | null;
  setEditingContrato: (c: Partial<Contrato> | null) => void;
  onSave: () => void;
  saving: boolean;
}

export function VencimentoFormDialog({
  open,
  onOpenChange,
  editingContrato,
  setEditingContrato,
  onSave,
  saving,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaPreenchido, setIaPreenchido] = useState(false);

  const handleLerContrato = async (file: File) => {
    if (!editingContrato) return;
    const max = 6 * 1024 * 1024;
    if (file.size > max) {
      toast({ title: "Arquivo muito grande", description: "Tamanho máximo: 6MB. Reduza/recorte o documento e tente novamente.", variant: "destructive" });
      return;
    }
    setIaLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = reader.result as string;
          resolve(r.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("extrair-contrato-vencimento", {
        body: { arquivo_base64: base64, arquivo_mime: file.type, arquivo_nome: file.name },
      });
      if (error) throw error;
      if (!data?.ok || !data?.dados) {
        throw new Error(data?.error || "Falha na extração.");
      }
      const dados = data.dados as Record<string, any>;
      // Merge não-destrutivo: só preenche campos vazios
      const cur: any = editingContrato;
      const merged: any = { ...cur };
      const isEmpty = (v: any) => v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v));
      let preenchidos = 0;
      for (const [k, v] of Object.entries(dados)) {
        if (v === null || v === undefined) continue;
        if (isEmpty(cur[k])) {
          merged[k] = v;
          preenchidos++;
        }
      }
      setEditingContrato(merged);
      setIaPreenchido(true);
      toast({
        title: preenchidos > 0 ? "Contrato lido pela IA" : "Nada novo a preencher",
        description: preenchidos > 0
          ? `${preenchidos} campo(s) preenchido(s). Confira antes de salvar.`
          : "A IA não encontrou dados novos para os campos vazios.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Não foi possível ler o contrato",
        description: e?.message || "Tente outro arquivo ou preencha manualmente.",
        variant: "destructive",
      });
    } finally {
      setIaLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingContrato?.id ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        {editingContrato && (
          <div className="grid gap-4 py-2">
            <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-medium">Ler contrato com IA</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={iaLoading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {iaLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Lendo...</>
                  ) : (
                    <><FileUp className="w-4 h-4" /> Enviar PDF/foto</>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLerContrato(f);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Envie o PDF ou foto do contrato. A IA preenche os campos vazios para você revisar — nada é salvo automaticamente.
              </p>
              {iaPreenchido && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Campos preenchidos pela IA. Confira tudo antes de salvar.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Nome do Cliente *</Label>
              <ClientSearchInput
                value={editingContrato.nome_cliente || ""}
                onChange={(v) => setEditingContrato({ ...editingContrato, nome_cliente: v })}
                onSelectClient={(c) =>
                  setEditingContrato({
                    ...editingContrato,
                    nome_cliente: c.nome_cliente,
                    ...(c.banco && !editingContrato.banco ? { banco: c.banco } : {}),
                  })
                }
                placeholder="Digite para buscar clientes existentes..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Banco</Label>
                <Input
                  value={editingContrato.banco || ""}
                  onChange={(e) => setEditingContrato({ ...editingContrato, banco: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Nº Contrato</Label>
                <Input
                  value={editingContrato.numero_contrato || ""}
                  onChange={(e) => setEditingContrato({ ...editingContrato, numero_contrato: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>1º Vencimento</Label>
                <Input
                  type="date"
                  value={editingContrato.primeiro_vencimento || ""}
                  onChange={(e) => setEditingContrato({ ...editingContrato, primeiro_vencimento: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Próximo Vencimento</Label>
                <Input
                  type="date"
                  value={editingContrato.vencimento_proxima_parcela || ""}
                  onChange={(e) => setEditingContrato({ ...editingContrato, vencimento_proxima_parcela: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Último Vencimento</Label>
                <Input
                  type="date"
                  value={editingContrato.vencimento_ultima_parcela || ""}
                  onChange={(e) => setEditingContrato({ ...editingContrato, vencimento_ultima_parcela: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data Limite Protocolo</Label>
                <Input
                  value={editingContrato.data_limite_protocolo || ""}
                  onChange={(e) => setEditingContrato({ ...editingContrato, data_limite_protocolo: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor Parcela (R$)</Label>
                <CurrencyInput
                  value={editingContrato.valor_parcela ?? null}
                  onChange={(v) => setEditingContrato({ ...editingContrato, valor_parcela: v })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <CurrencyInput
                  value={editingContrato.valor_total_operacao ?? null}
                  onChange={(v) => setEditingContrato({ ...editingContrato, valor_total_operacao: v })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vencidas"
                  checked={!!editingContrato.parcelas_vencidas}
                  onChange={(e) => setEditingContrato({ ...editingContrato, parcelas_vencidas: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="vencidas">Parcelas vencidas</Label>
              </div>
              <div className="grid gap-2">
                <Label>Notificado antes do vencimento?</Label>
                <Select
                  value={
                    editingContrato.notificado_antes_vencimento === true
                      ? "sim"
                      : editingContrato.notificado_antes_vencimento === false
                      ? "nao"
                      : ""
                  }
                  onValueChange={(v) =>
                    setEditingContrato({
                      ...editingContrato,
                      notificado_antes_vencimento: v === "sim" ? true : v === "nao" ? false : null,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Observações / Detalhes da dívida</Label>
              <textarea
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Detalhes da dívida, histórico de negociação, observações..."
                value={editingContrato.observacoes || ""}
                onChange={(e) => setEditingContrato({ ...editingContrato, observacoes: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Responsável</Label>
                <Input
                  value={editingContrato.responsavel_gestao || ""}
                  onChange={(e) => setEditingContrato({ ...editingContrato, responsavel_gestao: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editingContrato.status_prazo || "pendente"}
                  onValueChange={(v) => setEditingContrato({ ...editingContrato, status_prazo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || !editingContrato?.nome_cliente}>
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
