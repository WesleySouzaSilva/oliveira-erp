import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTitulo: string;
  inputs: Record<string, unknown>;
  resultado: Record<string, unknown>;
  valorSugerido: number | null;
  onSaved?: () => void;
}

export function SalvarPropostaDialog({
  open, onOpenChange, defaultTitulo, inputs, resultado, valorSugerido, onSaved,
}: Props) {
  const { user } = useAuth();
  const [modo, setModo] = useState<"empresa" | "prospect">("empresa");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [prospectNome, setProspectNome] = useState("");
  const [titulo, setTitulo] = useState(defaultTitulo);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setTitulo(defaultTitulo); }, [defaultTitulo]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("empresas_consultoria")
        .select("id,razao_social,nome_fantasia")
        .is("deleted_at", null)
        .order("razao_social", { ascending: true });
      setEmpresas((data || []) as Empresa[]);
    })();
  }, [open]);

  const salvar = async () => {
    if (!user) return;
    if (!titulo.trim()) { toast({ title: "Informe um título", variant: "destructive" }); return; }
    if (modo === "empresa" && !empresaId) { toast({ title: "Selecione uma empresa", variant: "destructive" }); return; }
    if (modo === "prospect" && !prospectNome.trim()) { toast({ title: "Informe o nome do prospect", variant: "destructive" }); return; }

    setSalvando(true);
    try {
      const { data: membro } = await supabase
        .from("membros").select("organizacao_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!membro?.organizacao_id) throw new Error("Sem organização vinculada");

      const { error } = await (supabase as any).from("consultoria_propostas").insert({
        organizacao_id: membro.organizacao_id,
        empresa_id: modo === "empresa" ? empresaId : null,
        prospect_nome: modo === "prospect" ? prospectNome.trim() : null,
        titulo: titulo.trim(),
        inputs,
        resultado,
        valor_sugerido: valorSugerido,
        status: "rascunho",
        observacoes: observacoes.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Proposta salva com sucesso" });
      onOpenChange(false);
      setEmpresaId(""); setProspectNome(""); setObservacoes("");
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Erro ao salvar proposta", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Salvar como proposta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={modo} onValueChange={(v) => setModo(v as any)} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="empresa" /> Empresa já cadastrada
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="prospect" /> Prospect (novo)
            </label>
          </RadioGroup>

          {modo === "empresa" ? (
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {empresas.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma empresa cadastrada</div>
                  )}
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Nome do prospect</Label>
              <Input value={prospectNome} onChange={(e) => setProspectNome(e.target.value)} placeholder="Ex: Fazenda Santa Cruz" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Título da proposta</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar proposta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}