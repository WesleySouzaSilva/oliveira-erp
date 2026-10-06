import { invalidarMembrosOrg } from "@/hooks/useOrgMembers";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgMembers } from "@/hooks/useOrgMembers";

/** Cargos disponíveis (rótulos em português). */
export const CARGO_OPTIONS: { value: string; label: string }[] = [
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor_pos_venda", label: "Gestor de Pós-Venda" },
  { value: "pos_venda", label: "Pós-Venda" },
  { value: "advogado_pos_venda", label: "Advogado de Pós-Venda" },
  { value: "estagiario_pos_venda", label: "Estagiário de Pós-Venda" },
  { value: "agronomo", label: "Agrônomo" },
  { value: "engenheiro_agronomo", label: "Eng. Agrônomo" },
  { value: "advogado", label: "Advogado" },
  { value: "assessor_juridico", label: "Assessor Jurídico" },
  { value: "estagiario_direito", label: "Estagiário de Direito" },
  { value: "setor_acordos", label: "Setor de Acordos" },
  { value: "comercial", label: "Comercial" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
  { value: "social_seller", label: "Social Seller" },
  { value: "marketing", label: "Marketing" },
  { value: "gerente_marketing", label: "Gerente de Marketing" },
  { value: "criacao", label: "Criação" },
  { value: "copywriter", label: "Copywriter" },
  { value: "social_media", label: "Social Media" },
];

/** Squads (áreas de atuação). A chave 'demandas-gerais' é mantida no banco. */
export const SQUAD_OPTIONS: { value: string; label: string }[] = [
  { value: "agro", label: "Agro" },
  { value: "empresarial", label: "Empresarial" },
  { value: "demandas-gerais", label: "Demandas complexas" },
  { value: "previdenciario", label: "Previdenciário" },
];

const AVISO_ADMIN =
  "Administrador ignora todos os grupos de permissão e vira custodiante automático dos Códigos dos Tribunais.";

interface Props {
  membroId: string;
  userId: string;
  papel: string;
  /** Somente admin edita. */
  canEdit: boolean;
  onChanged?: () => void;
}

export function VinculoAcessoBlock({ membroId, userId, papel, canEdit, onChanged }: Props) {
  const { members } = useOrgMembers();
  const [cargo, setCargo] = useState(papel);
  const [areas, setAreas] = useState<string[]>([]);
  const [liderId, setLiderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setCargo(papel), [papel, membroId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase.from("membros").select("areas, papel").eq("id", membroId).maybeSingle(),
        supabase.from("profiles_publico").select("lider_id").eq("id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      setAreas(((m as any)?.areas as string[]) || []);
      if ((m as any)?.papel) setCargo((m as any).papel);
      setLiderId(((p as any)?.lider_id as string) ?? null);
    })();
    return () => { cancelled = true; };
  }, [membroId, userId]);

  const eraAdmin = papel === "admin";
  const cargoOptions = useMemo(
    () => (eraAdmin ? [{ value: "admin", label: "Administrador" }, ...CARGO_OPTIONS] : CARGO_OPTIONS),
    [eraAdmin],
  );

  const lideresDisponiveis = members.filter((m) => m.user_id !== userId);

  const saveCargo = async (value: string) => {
    setSaving(true);
    const { error } = await supabase.from("membros").update({ papel: value as any }).eq("id", membroId); invalidarMembrosOrg();
    setSaving(false);
    if (error) { toast.error("Não foi possível alterar o cargo: " + error.message); return; }
    setCargo(value);
    toast.success("Cargo atualizado");
    onChanged?.();
  };

  const toggleSquad = async (value: string) => {
    const next = areas.includes(value) ? areas.filter((a) => a !== value) : [...areas, value];
    setSaving(true);
    const { error } = await supabase.from("membros").update({ areas: next } as any).eq("id", membroId); invalidarMembrosOrg();
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o squad: " + error.message); return; }
    setAreas(next);
    toast.success("Squad atualizado");
    onChanged?.();
  };

  const saveLider = async (value: string) => {
    const newId = value === "__none__" ? null : value;
    if (newId === userId) { toast.error("A pessoa não pode ser líder dela mesma."); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ lider_id: newId }).eq("id", userId);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o líder: " + error.message); return; }
    setLiderId(newId);
    toast.success("Líder atualizado");
    onChanged?.();
  };

  const cargoLabel =
    cargo === "admin"
      ? "Administrador"
      : CARGO_OPTIONS.find((c) => c.value === cargo)?.label || cargo;

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Vínculo e acesso</h3>
      </div>

      {/* Cargo */}
      <div className="space-y-1.5">
        <Label className="text-xs">Cargo</Label>
        {canEdit ? (
          <Select value={cargo} onValueChange={saveCargo} disabled={saving}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar cargo" /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {cargoOptions.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm font-medium">{cargoLabel}</p>
        )}
        {cargo === "admin" && (
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
            {AVISO_ADMIN}
          </p>
        )}
      </div>

      {/* Squad */}
      <div className="space-y-1.5">
        <Label className="text-xs">Squad</Label>
        {canEdit ? (
          <div className="grid grid-cols-2 gap-2">
            {SQUAD_OPTIONS.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={areas.includes(s.value)}
                  disabled={saving}
                  onCheckedChange={() => toggleSquad(s.value)}
                />
                {s.label}
              </label>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {areas.length === 0 ? (
              <span className="text-sm text-muted-foreground">Sem squad definido</span>
            ) : (
              areas.map((a) => (
                <Badge key={a} variant="secondary">
                  {SQUAD_OPTIONS.find((s) => s.value === a)?.label || a}
                </Badge>
              ))
            )}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Quem tem um squad só não vê nenhum seletor de área no menu — entra direto no contexto dele.
        </p>
      </div>

      {/* Líder */}
      <div className="space-y-1.5">
        <Label className="text-xs">Líder</Label>
        {canEdit ? (
          <Select value={liderId ?? "__none__"} onValueChange={saveLider} disabled={saving}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Sem líder" /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="__none__" className="text-sm">Sem líder</SelectItem>
              {lideresDisponiveis.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id} className="text-sm">
                  {m.nome || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm font-medium">
            {members.find((m) => m.user_id === liderId)?.nome || "Sem líder"}
          </p>
        )}
      </div>
    </div>
  );
}
