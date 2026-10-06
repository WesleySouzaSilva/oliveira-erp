import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loaders";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Link2, RefreshCw, UserX, Users } from "lucide-react";

export interface ContaAcesso {
  user_id: string;
  email: string | null;
  nome: string | null;
  ativo: boolean;
  email_confirmado: boolean;
  criado_em: string | null;
  ultimo_acesso: string | null;
  papel: string | null;
  is_ceo: boolean;
  membro_id: string | null;
  portal: "cliente" | "empresa" | null;
  situacao: "equipe" | "outra_org" | "portal" | "sem_vinculo";
}

const CARGOS: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor_pos_venda", label: "Gestor de Pós-Venda" },
  { value: "pos_venda", label: "Pós-Venda" },
  { value: "advogado_pos_venda", label: "Advogado de Pós-Venda" },
  { value: "estagiario_pos_venda", label: "Estagiário de Pós-Venda" },
  { value: "agronomo", label: "Agrônomo" },
  { value: "engenheiro_agronomo", label: "Eng. Agrônomo" },
  { value: "advogado", label: "Advogado" },
  { value: "assessor_juridico", label: "Assessor Jurídico" },
  { value: "estagiario_direito", label: "Estagiário" },
  { value: "comercial", label: "Comercial" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
  { value: "social_seller", label: "Social Seller" },
  { value: "marketing", label: "Marketing" },
  { value: "gerente_marketing", label: "Ger. Marketing" },
  { value: "criacao", label: "Criação" },
  { value: "copywriter", label: "Copywriter" },
  { value: "social_media", label: "Social Media" },
];

const cargoLabel = (v: string | null) =>
  (v && CARGOS.find((c) => c.value === v)?.label) || v || "—";

function formatData(iso: string | null) {
  if (!iso) return "Nunca acessou";
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  const base = d.toLocaleDateString("pt-BR");
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return base;
}

export function ContasAcessoPanel({ orgId, onChanged }: { orgId: string; onChanged?: () => void }) {
  const [contas, setContas] = useState<ContaAcesso[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [vincularConta, setVincularConta] = useState<ContaAcesso | null>(null);
  const [vincularCargo, setVincularCargo] = useState("assessor_juridico");
  const [vincularNome, setVincularNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const askConfirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: { action: "list_accounts", organizacao_id: orgId },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao carregar contas");
      setContas([]);
    } else {
      setContas(data.contas || []);
    }
    setLoading(false);
  };

  useEffect(() => { if (orgId) load(); /* eslint-disable-next-line */ }, [orgId]);

  const doLink = async () => {
    if (!vincularConta) return;
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: {
        action: "link",
        organizacao_id: orgId,
        user_id: vincularConta.user_id,
        papel: vincularCargo,
        nome: vincularNome.trim() || undefined,
      },
    });
    setSalvando(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao vincular");
      return;
    }
    toast.success(`${vincularNome.trim() || vincularConta.email} vinculado como ${cargoLabel(vincularCargo)}`);
    setVincularConta(null);
    load();
    onChanged?.();
  };

  const setAtivo = async (conta: ContaAcesso, ativo: boolean) => {
    if (!ativo) {
      const ok = await askConfirm({
        title: "Desativar conta",
        description: `A conta ${conta.email} deixa de ter acesso ao sistema. O login não é apagado e pode ser reativado depois.`,
        destructive: true,
        confirmText: "Desativar",
      });
      if (!ok) return;
    }
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: { action: "set_ativo", organizacao_id: orgId, user_id: conta.user_id, papel: ativo ? "ativo" : "inativo" },
    });
    if (error || data?.error) toast.error(data?.error || error?.message || "Erro ao atualizar conta");
    else { toast.success(ativo ? "Conta reativada" : "Conta desativada"); load(); }
  };

  const revogar = async (conta: ContaAcesso) => {
    if (!conta.membro_id) return;
    const ok = await askConfirm({
      title: "Revogar acesso",
      description: `${conta.nome || conta.email} perde o vínculo com a organização e todas as permissões. O login continua existindo.`,
      destructive: true,
      confirmText: "Revogar",
    });
    if (!ok) return;
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: { action: "remove", organizacao_id: orgId, membro_id: conta.membro_id },
    });
    if (error || data?.error) toast.error(data?.error || error?.message || "Erro ao revogar");
    else { toast.success("Acesso revogado"); load(); onChanged?.(); }
  };

  if (loading || !contas) return <ListSkeleton rows={4} />;

  const equipe = contas.filter((c) => c.situacao === "equipe");
  const soltas = contas.filter((c) => c.situacao === "sem_vinculo");
  const portal = contas.filter((c) => c.situacao === "portal");
  const outras = contas.filter((c) => c.situacao === "outra_org");

  const linha = (c: ContaAcesso, acoes: React.ReactNode) => (
    <div
      key={c.user_id}
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-b border-border/50 last:border-0 ${c.ativo ? "" : "opacity-60"}`}
    >
      <div className="min-w-[220px] flex-1">
        <p className="text-sm font-medium text-foreground">
          {c.nome || "Sem nome"}
          {c.is_ceo && <Badge variant="outline" className="ml-2 text-[10px]">CEO</Badge>}
          {!c.ativo && <Badge variant="secondary" className="ml-2 text-[10px]">Desativado</Badge>}
        </p>
        <p className="text-xs text-muted-foreground break-all">{c.email}</p>
      </div>
      <div className="w-40 text-xs text-muted-foreground">{cargoLabel(c.papel)}</div>
      <div className="w-36 text-xs text-muted-foreground">
        {formatData(c.ultimo_acesso)}
        {!c.email_confirmado && <span className="block text-[10px] text-destructive">e-mail não confirmado</span>}
      </div>
      <div className="flex items-center gap-2">{acoes}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> Contas e acessos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {contas.length} conta(s) de login · {equipe.length} na equipe · {soltas.length} sem vínculo
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/30 text-xs font-semibold text-foreground flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Equipe ({equipe.length})
        </div>
        {equipe.map((c) =>
          linha(
            c,
            <>
              <Button variant="ghost" size="sm" onClick={() => setAtivo(c, !c.ativo)}>
                {c.ativo ? "Desativar" : "Reativar"}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revogar(c)}>
                <UserX className="w-4 h-4" /> Revogar
              </Button>
            </>,
          ),
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-warning/10 text-xs font-semibold text-foreground">
          Contas sem vínculo ({soltas.length})
          <span className="ml-2 font-normal text-muted-foreground">
            conseguem entrar, mas não têm acesso a nada — vincule à equipe ou desative
          </span>
        </div>
        {soltas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma conta pendente.</p>
        ) : (
          soltas.map((c) =>
            linha(
              c,
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setVincularConta(c);
                    setVincularNome(c.nome || "");
                    setVincularCargo("assessor_juridico");
                  }}
                >
                  <Link2 className="w-4 h-4" /> Vincular
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAtivo(c, !c.ativo)}>
                  {c.ativo ? "Desativar" : "Reativar"}
                </Button>
              </>,
            ),
          )
        )}
      </div>

      {(portal.length > 0 || outras.length > 0) && (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 text-xs font-semibold text-foreground">
            Acessos externos e de outras organizações ({portal.length + outras.length})
          </div>
          {[...portal, ...outras].map((c) =>
            linha(
              c,
              <Badge variant="outline" className="text-[10px]">
                {c.situacao === "portal" ? `Portal ${c.portal}` : "Outra organização"}
              </Badge>,
            ),
          )}
        </div>
      )}

      <Dialog open={!!vincularConta} onOpenChange={(o) => !o && setVincularConta(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular conta à equipe</DialogTitle>
            <DialogDescription>{vincularConta?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={vincularNome} onChange={(e) => setVincularNome(e.target.value)} placeholder="Ex: João da Silva" />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={vincularCargo} onValueChange={setVincularCargo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARGOS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVincularConta(null)}>Cancelar</Button>
            <Button onClick={doLink} disabled={salvando}>
              {salvando ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
