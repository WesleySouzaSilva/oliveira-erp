import { invalidarMembrosOrg } from "@/hooks/useOrgMembers";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Save, Users, ShieldCheck, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { MODULE_CATALOG, SELECTABLE_MODULE_CATALOG, PERFIS_PRONTOS, type PerfilPronto } from "@/lib/permissionModules";
import { usePermissionGroups, type PermissionGroup } from "@/hooks/usePermissionGroups";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Membro {
  id: string;
  user_id: string;
  nome?: string | null;
  papel: string;
  permission_group_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string | null;
  membros: Membro[];
  onChanged?: () => void;
}

export function GruposPermissaoDialog({ open, onOpenChange, orgId, membros, onChanged }: Props) {
  const { groups, loading, create, update, remove, assignToMember, refetch } =
    usePermissionGroups(orgId);

  const [editing, setEditing] = useState<PermissionGroup | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modulos, setModulos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedMembros, setSelectedMembros] = useState<string[]>([]);
  const [applyingGroupId, setApplyingGroupId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (open) {
      refetch();
      resetForm();
      setSelectedMembros([]);
      setApplyingGroupId(null);
    }
  }, [open, refetch]);

  function resetForm() {
    setEditing(null);
    setNome("");
    setDescricao("");
    setModulos([]);
  }

  function startEdit(g: PermissionGroup) {
    setEditing(g);
    setNome(g.nome);
    setDescricao(g.descricao ?? "");
    setModulos(g.modulos ?? []);
  }

  const toggleModulo = (key: string) =>
    setModulos((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  function aplicarPerfil(p: PerfilPronto) {
    setEditing(null);
    setNome(p.nome);
    setDescricao(p.descricao);
    setModulos(p.modulos);
    toast.success(`Perfil "${p.nome}" carregado — ajuste e salve`);
  }

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Dê um nome ao grupo");
      return;
    }
    if (modulos.length === 0) {
      toast.error("Selecione ao menos um módulo");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, { nome: nome.trim(), descricao: descricao.trim() || null, modulos });
        toast.success("Grupo atualizado");
      } else {
        await create(nome.trim(), modulos, descricao.trim() || null);
        toast.success("Grupo criado");
      }
      resetForm();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar grupo");
    } finally {
      setSaving(false);
    }
  };

  const askConfirm = useConfirm();
  const handleDelete = async (g: PermissionGroup) => {
    if (!(await askConfirm({ title: "Excluir grupo", description: `Excluir o grupo "${g.nome}"? Os membros vinculados voltarão a usar as permissões padrão do cargo.`, destructive: true, confirmText: "Excluir" }))) return;
    try {
      // Limpa o vínculo dos membros que usam esse grupo
      await supabase.from("membros").update({ permission_group_id: null }).eq("permission_group_id", g.id); invalidarMembrosOrg();
      await remove(g.id);
      toast.success("Grupo excluído");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir grupo");
    }
  };

  const handleApply = async (groupId: string) => {
    if (selectedMembros.length === 0) {
      toast.error("Selecione ao menos um membro");
      return;
    }
    setApplying(true);
    setApplyingGroupId(groupId);
    try {
      await Promise.all(selectedMembros.map((mid) => assignToMember(mid, groupId)));
      toast.success(`Grupo aplicado a ${selectedMembros.length} membro(s)`);
      setSelectedMembros([]);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aplicar grupo");
    } finally {
      setApplying(false);
      setApplyingGroupId(null);
    }
  };

  const membrosOrdenados = useMemo(
    () => [...membros].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")),
    [membros],
  );

  const countByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of membros) {
      if (m.permission_group_id) map.set(m.permission_group_id, (map.get(m.permission_group_id) ?? 0) + 1);
    }
    return map;
  }, [membros]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Grupos de Permissão
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Crie grupos reutilizáveis (ex.: "Estagiário Jurídico", "Equipe Comercial Júnior") e aplique a vários membros de uma vez.
            Quando um grupo está atribuído, ele substitui as permissões padrão do cargo.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
          {/* Coluna 1: lista de grupos + aplicação */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Grupos existentes</Label>
              <Button size="sm" variant="outline" onClick={resetForm}>
                <Plus className="w-3.5 h-3.5" /> Novo
              </Button>
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : groups.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                Nenhum grupo criado ainda. Use o formulário ao lado para criar o primeiro.
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      editing?.id === g.id ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{g.nome}</p>
                          <Badge variant="secondary" className="text-[10px]">
                            <Users className="w-3 h-3 mr-1" />
                            {countByGroup.get(g.id) ?? 0}
                          </Badge>
                        </div>
                        {g.descricao && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.descricao}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {g.modulos.slice(0, 4).map((k) => {
                            const m = MODULE_CATALOG.find((mm) => mm.key === k);
                            return (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                                {m?.label ?? k}
                              </span>
                            );
                          })}
                          {g.modulos.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{g.modulos.length - 4}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(g)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(g)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {selectedMembros.length > 0
                          ? `Aplicar a ${selectedMembros.length} membro(s) selecionado(s)`
                          : "Selecione membros à direita →"}
                      </span>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={selectedMembros.length === 0 || applying}
                        onClick={() => handleApply(g.id)}
                      >
                        {applying && applyingGroupId === g.id ? "Aplicando…" : "Aplicar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Lista de membros para aplicar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Membros</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMembros(membrosOrdenados.map((m) => m.id))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Selecionar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMembros([])}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {membrosOrdenados.map((m) => {
                  const checked = selectedMembros.includes(m.id);
                  const grupoAtivo = groups.find((g) => g.id === m.permission_group_id);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setSelectedMembros((prev) => (v ? [...prev, m.id] : prev.filter((id) => id !== m.id)))
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.nome || "Sem nome"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {m.papel}
                          {grupoAtivo && (
                            <>
                              {" · "}
                              <span className="text-primary">grupo: {grupoAtivo.nome}</span>
                            </>
                          )}
                        </p>
                      </div>
                      {m.permission_group_id && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await assignToMember(m.id, null);
                            toast.success("Vínculo de grupo removido");
                            onChanged?.();
                          }}
                          className="text-[10px] text-destructive hover:underline shrink-0"
                          title="Desvincular do grupo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna 2: formulário criar/editar */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              {editing ? `Editando: ${editing.nome}` : "Novo grupo de permissão"}
            </Label>

            {!editing && (
              <div className="rounded-lg border border-dashed border-border p-2.5">
                <p className="text-[11px] text-muted-foreground mb-2">
                  Comece por um perfil pronto e ajuste o que quiser:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PERFIS_PRONTOS.map((p) => (
                    <Button
                      key={p.nome}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      title={p.descricao}
                      onClick={() => aplicarPerfil(p)}
                    >
                      {p.nome}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex.: Estagiário Jurídico"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                placeholder="Para que serve este grupo?"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Módulos liberados</Label>
              <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto border border-border rounded-lg p-2">
                {SELECTABLE_MODULE_CATALOG.map((m) => {
                  const checked = modulos.includes(m.key);
                  return (
                    <label
                      key={m.key}
                      className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-secondary ${
                        checked ? "bg-primary/5" : ""
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleModulo(m.key)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium">{m.label}</span>
                          {m.sensivel && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-destructive/10 text-destructive">
                              <AlertTriangle className="w-2.5 h-2.5" /> sensível
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-[10px] text-muted-foreground leading-snug">{m.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              {editing ? (
                <Button variant="outline" size="sm" onClick={resetForm}>
                  Cancelar edição
                </Button>
              ) : <span />}
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4" />
                {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar grupo"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}