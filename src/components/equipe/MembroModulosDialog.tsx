import { invalidarMembrosOrg } from "@/hooks/useOrgMembers";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { MODULE_CATALOG, SELECTABLE_MODULE_CATALOG } from "@/lib/permissionModules";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  membroId: string | null;
  membroNome: string | null;
  orgId: string | null;
}

export function MembroModulosDialog({ open, onOpenChange, membroId, membroNome, orgId }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const groupName = useMemo(
    () => `Personalizado — ${membroNome || "Membro"}`,
    [membroNome],
  );

  useEffect(() => {
    if (!open || !membroId) return;
    setLoading(true);
    (async () => {
      const { data: membro } = await supabase
        .from("membros")
        .select("permission_group_id")
        .eq("id", membroId)
        .maybeSingle();
      const pgid = (membro as any)?.permission_group_id ?? null;
      setGroupId(pgid);
      if (pgid) {
        const { data: grp } = await supabase
          .from("permission_groups")
          .select("modulos")
          .eq("id", pgid)
          .maybeSingle();
        setSelected(new Set(((grp as any)?.modulos as string[]) ?? []));
      } else {
        setSelected(new Set());
      }
      setLoading(false);
    })();
  }, [open, membroId]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const handleSave = async () => {
    if (!membroId || !orgId) return;
    setSaving(true);
    try {
      const modulos = Array.from(selected);
      let useGroupId = groupId;
      if (useGroupId) {
        const { error } = await supabase
          .from("permission_groups")
          .update({ nome: groupName, modulos })
          .eq("id", useGroupId); invalidarMembrosOrg();
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("permission_groups")
          .insert({
            organizacao_id: orgId,
            nome: groupName,
            descricao: "Permissões personalizadas por usuário",
            modulos,
          })
          .select()
          .single(); invalidarMembrosOrg();
        if (error) throw error;
        useGroupId = (data as any).id;
        const { error: upErr } = await supabase
          .from("membros")
          .update({ permission_group_id: useGroupId } as any)
          .eq("id", membroId); invalidarMembrosOrg();
        if (upErr) throw upErr;
      }
      toast.success("Permissões personalizadas salvas");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const askConfirm = useConfirm();
  const handleReset = async () => {
    if (!membroId) return;
    if (!(await askConfirm({ title: "Voltar ao padrão", description: "Voltar a usar as permissões padrão do cargo?", confirmText: "Voltar ao padrão" }))) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("membros")
        .update({ permission_group_id: null } as any)
        .eq("id", membroId); invalidarMembrosOrg();
      if (error) throw error;
      if (groupId) {
        await supabase.from("permission_groups").delete().eq("id", groupId); invalidarMembrosOrg();
      }
      toast.success("Voltou ao padrão do cargo");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao restaurar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Módulos personalizados — {membroNome || "Membro"}
          </DialogTitle>
          <DialogDescription>
            Marque os módulos que este usuário poderá acessar. Quando há seleção personalizada, ela{" "}
            <strong>substitui</strong> as permissões padrão do cargo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-3 py-2">
            {groupId && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-xs">
                <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>
                  Este usuário já tem permissões personalizadas ativas. As restrições do cargo estão sendo ignoradas.
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SELECTABLE_MODULE_CATALOG.map((mod) => {
                const checked = selected.has(mod.key);
                return (
                  <label
                    key={mod.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                    } ${mod.sensivel ? "ring-1 ring-destructive/20" : ""}`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(mod.key)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {mod.label}
                        {mod.sensivel && (
                          <span className="text-[9px] uppercase tracking-wide text-destructive font-bold">
                            Sensível
                          </span>
                        )}
                      </div>
                      {mod.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{mod.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {selected.size} módulo{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}.
              Administradores sempre têm acesso total.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {groupId && (
            <Button variant="outline" onClick={handleReset} disabled={saving} className="mr-auto">
              <RotateCcw className="w-4 h-4" /> Usar padrão do cargo
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar permissões"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}