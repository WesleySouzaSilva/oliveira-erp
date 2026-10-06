import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings, Plus, Trash2, Pencil, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MODULE_CATALOG, SELECTABLE_MODULE_CATALOG } from "@/lib/permissionModules";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePermissionGroups, type PermissionGroup } from "@/hooks/usePermissionGroups";

interface PermissoesTabProps {
  orgId: string;
  membroId: string;
  canEdit: boolean; // só admin
}

export function PermissoesTab({ orgId, membroId, canEdit }: PermissoesTabProps) {
  const { groups, loading, create, update, remove, assignToMember, refetch } =
    usePermissionGroups(orgId);

  const [assignedGroupId, setAssignedGroupId] = useState<string | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);

  // Modal de gerenciamento
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionGroup | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formModulos, setFormModulos] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carrega o grupo atualmente atribuído ao membro
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("membros")
        .select("permission_group_id")
        .eq("id", membroId)
        .maybeSingle();
      setAssignedGroupId((data as any)?.permission_group_id ?? null);
    })();
  }, [membroId]);

  const handleAssign = async (value: string) => {
    const newId = value === "__none__" ? null : value;
    setSavingAssign(true);
    try {
      await assignToMember(membroId, newId);
      setAssignedGroupId(newId);
      toast.success(newId ? "Grupo atribuído ao colaborador" : "Grupo removido — voltou ao padrão do cargo");
    } catch (e: any) {
      toast.error("Erro ao atribuir grupo: " + (e?.message || "desconhecido"));
    } finally {
      setSavingAssign(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormNome("");
    setFormDescricao("");
    setFormModulos([]);
    setFormOpen(true);
  };

  const openEdit = (g: PermissionGroup) => {
    setEditing(g);
    setFormNome(g.nome);
    setFormDescricao(g.descricao ?? "");
    setFormModulos([...g.modulos]);
    setFormOpen(true);
  };

  const toggleModulo = (key: string) => {
    setFormModulos((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    if (!formNome.trim()) {
      toast.error("Informe o nome do grupo");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, {
          nome: formNome.trim(),
          descricao: formDescricao.trim() || null,
          modulos: formModulos,
        });
        toast.success("Grupo atualizado");
      } else {
        await create(formNome.trim(), formModulos, formDescricao.trim() || null);
        toast.success("Grupo criado");
      }
      setFormOpen(false);
    } catch (e: any) {
      toast.error("Erro ao salvar grupo: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const askConfirm = useConfirm();
  const handleDelete = async (g: PermissionGroup) => {
    if (!(await askConfirm({ title: "Excluir grupo", description: `Excluir o grupo "${g.nome}"? Colaboradores vinculados voltarão ao padrão do cargo.`, destructive: true, confirmText: "Excluir" }))) return;
    try {
      await remove(g.id);
      if (assignedGroupId === g.id) setAssignedGroupId(null);
      toast.success("Grupo excluído");
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e?.message || "desconhecido"));
    }
  };

  const assignedGroup = groups.find((g) => g.id === assignedGroupId);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Grupo de permissão</p>
            <p className="text-xs text-muted-foreground">
              Define exatamente quais módulos este colaborador enxerga. Se nenhum for
              atribuído, valem as permissões padrão do cargo.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Gerenciar grupos
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={assignedGroupId ?? "__none__"}
            onValueChange={handleAssign}
            disabled={!canEdit || savingAssign || loading}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Padrão do cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Padrão do cargo (sem grupo)</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {assignedGroup && (
          <div className="rounded-md bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Módulos liberados por "{assignedGroup.nome}"
            </div>
            {assignedGroup.modulos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum módulo selecionado (acesso bloqueado a tudo, exceto o painel inicial).</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {assignedGroup.modulos.map((k) => {
                  const m = MODULE_CATALOG.find((x) => x.key === k);
                  return (
                    <Badge key={k} variant="secondary" className="text-[10px]">
                      {m?.label ?? k}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: gerenciar grupos */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Grupos de permissão</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Novo grupo
              </Button>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum grupo criado ainda. Crie um para começar (ex.: "Comercial Pleno", "Marketing Júnior").
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {groups.map((g) => (
                  <div key={g.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{g.nome}</p>
                        {g.descricao && (
                          <p className="text-xs text-muted-foreground">{g.descricao}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(g)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.modulos.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">sem módulos</span>
                      ) : (
                        g.modulos.map((k) => {
                          const m = MODULE_CATALOG.find((x) => x.key === k);
                          return (
                            <Badge key={k} variant="outline" className="text-[10px]">
                              {m?.label ?? k}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: criar/editar grupo */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar grupo" : "Novo grupo de permissão"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do grupo *</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex.: Comercial Pleno"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                rows={2}
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Para que serve esse grupo?"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Módulos liberados</Label>
                <span className="text-[11px] text-muted-foreground">
                  {formModulos.length} selecionado{formModulos.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto rounded-md border p-2">
                {SELECTABLE_MODULE_CATALOG.map((m) => {
                  const checked = formModulos.includes(m.key);
                  return (
                    <label
                      key={m.key}
                      className={`flex gap-2 rounded-md p-2 cursor-pointer hover:bg-muted/50 ${checked ? "bg-muted/30" : ""}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleModulo(m.key)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{m.label}</span>
                          {m.sensivel && (
                            <span title="Módulo sensível">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {m.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}