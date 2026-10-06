import { invalidarMembrosOrg } from "@/hooks/useOrgMembers";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, UserPlus, Trash2, Shield, ShieldCheck, ShieldAlert,
  Building2, Mail, Camera, ToggleLeft, ToggleRight, Eye, EyeOff, Sliders, Layers,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/ui/loaders";
import { MembroModulosDialog } from "@/components/equipe/MembroModulosDialog";
import { GruposPermissaoDialog } from "@/components/equipe/GruposPermissaoDialog";
import { ContasAcessoPanel } from "@/components/equipe/ContasAcessoPanel";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useRecorteEquipe, SEM_LIDERADOS_MSG } from "@/hooks/useSubordinados";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";

interface Membro {
  id: string;
  user_id: string;
  papel: string;
  created_at: string;
  email?: string;
  nome?: string;
  foto_url?: string | null;
  ativo?: boolean;
  permission_group_id?: string | null;
}

interface Organizacao {
  id: string;
  nome: string;
  plano: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  admin: { label: "Administrador", icon: ShieldCheck, color: "text-destructive", desc: "Acesso total ao sistema. Gerencia equipe, relatórios e configurações." },
  coordenador: { label: "Coordenador", icon: ShieldCheck, color: "text-primary", desc: "Gestão de liderados. Acesso amplo exceto laudos técnicos." },
  gestor_pos_venda: { label: "Gestor de Pós-Venda", icon: ShieldCheck, color: "text-primary", desc: "Chefia o time de pós-venda. Recebe automaticamente as tarefas de onboarding de novos clientes." },
  pos_venda: { label: "Pós-Venda", icon: Shield, color: "text-primary", desc: "Onboarding de clientes, acompanhamento pós-contratação." },
  advogado_pos_venda: { label: "Advogado de Pós-Venda", icon: ShieldAlert, color: "text-accent", desc: "Diligencia acordos e follow-ups jurídicos do pós-venda." },
  estagiario_pos_venda: { label: "Estagiário de Pós-Venda", icon: Shield, color: "text-muted-foreground", desc: "Apoio operacional ao time de pós-venda na cadência de acordos." },
  agronomo: { label: "Agrônomo", icon: Shield, color: "text-success", desc: "Criação de laudos, dados climáticos e templates." },
  engenheiro_agronomo: { label: "Eng. Agrônomo", icon: Shield, color: "text-success", desc: "Criação de laudos técnicos e análises." },
  advogado: { label: "Advogado", icon: ShieldAlert, color: "text-accent", desc: "Processos jurídicos e petições. Sem acesso a laudos e dados climáticos." },
  assessor_juridico: { label: "Assessor Jurídico", icon: ShieldAlert, color: "text-accent", desc: "Apoio jurídico. Sem acesso a laudos e dados climáticos." },
  estagiario_direito: { label: "Estagiário", icon: Shield, color: "text-muted-foreground", desc: "Acesso limitado conforme atribuição." },
  // Comercial
  comercial: { label: "Comercial", icon: Shield, color: "text-chart-4", desc: "Acesso ao pipeline comercial, metas e atividades." },
  closer: { label: "Closer", icon: Shield, color: "text-chart-4", desc: "Fechamento de negócios. Acesso ao pipeline e metas comerciais." },
  sdr: { label: "SDR", icon: Shield, color: "text-chart-4", desc: "Prospecção e qualificação de leads. Pipeline comercial." },
  social_seller: { label: "Social Seller", icon: Shield, color: "text-chart-4", desc: "Vendas via redes sociais. Pipeline e atividades comerciais." },
  // Marketing
  marketing: { label: "Marketing", icon: Shield, color: "text-chart-5", desc: "Acesso a métricas de marketing, funil e origem de leads." },
  gerente_marketing: { label: "Gerente de Marketing", icon: ShieldCheck, color: "text-chart-5", desc: "Gestão completa do time de marketing e métricas." },
  criacao: { label: "Criação", icon: Shield, color: "text-chart-5", desc: "Equipe de design e criação. Métricas de marketing." },
  copywriter: { label: "Copywriter", icon: Shield, color: "text-chart-5", desc: "Redação publicitária. Métricas de marketing." },
  social_media: { label: "Social Media", icon: Shield, color: "text-chart-5", desc: "Gestão de redes sociais. Métricas de marketing." },
};

const comercialPerms = { laudos: false, novo_laudo: false, dados_climaticos: false, processos: false, peticoes: false, vencimentos: false, clientes: false, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: true };
const marketingPerms = { laudos: false, novo_laudo: false, dados_climaticos: false, processos: false, peticoes: false, vencimentos: false, clientes: false, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: true };

const PERMISSION_MATRIX: Record<string, Record<string, boolean>> = {
  admin: { laudos: true, novo_laudo: true, dados_climaticos: true, processos: true, peticoes: true, vencimentos: true, clientes: true, relatorios: true, gestao: true, agenda: true, tarefas_todas: true, equipe: true, comercial: true },
  coordenador: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: true, vencimentos: true, clientes: true, relatorios: true, gestao: true, agenda: true, tarefas_todas: true, equipe: true, comercial: true },
  gestor_pos_venda: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: false, vencimentos: true, clientes: true, relatorios: true, gestao: true, agenda: true, tarefas_todas: true, equipe: false, comercial: false },
  pos_venda: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: false, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  advogado_pos_venda: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: false, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  estagiario_pos_venda: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: false, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  agronomo: { laudos: true, novo_laudo: true, dados_climaticos: true, processos: true, peticoes: false, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  engenheiro_agronomo: { laudos: true, novo_laudo: true, dados_climaticos: true, processos: true, peticoes: false, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  advogado: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: true, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  assessor_juridico: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: true, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  estagiario_direito: { laudos: false, novo_laudo: false, dados_climaticos: false, processos: true, peticoes: true, vencimentos: true, clientes: true, relatorios: false, gestao: false, agenda: true, tarefas_todas: false, equipe: false, comercial: false },
  comercial: comercialPerms,
  closer: comercialPerms,
  sdr: comercialPerms,
  social_seller: comercialPerms,
  marketing: marketingPerms,
  gerente_marketing: marketingPerms,
  criacao: marketingPerms,
  copywriter: marketingPerms,
  social_media: marketingPerms,
};

const PERM_LABELS: Record<string, string> = {
  laudos: "Ver Laudos",
  novo_laudo: "Criar Laudos",
  dados_climaticos: "Dados Climáticos",
  processos: "Processos",
  peticoes: "Petições",
  vencimentos: "Vencimentos",
  clientes: "Clientes",
  relatorios: "Relatórios",
  gestao: "Gestão Geral",
  agenda: "Agenda",
  tarefas_todas: "Ver Todas as Tarefas",
  equipe: "Gestão de Equipe",
};

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function Equipe() {
  const { user } = useAuth();
  const [org, setOrg] = useState<Organizacao | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("agronomo");
  const [inviting, setInviting] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Membro | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [modulosOpen, setModulosOpen] = useState(false);
  const [modulosMember, setModulosMember] = useState<Membro | null>(null);
  const [gruposOpen, setGruposOpen] = useState(false);
  // Coordenador só enxerga quem ele lidera (filtro de tela; RLS inalterado).
  const recorte = useRecorteEquipe();

  const loadData = async () => {
    if (!user) return;
    // Esta tela recarrega depois de cada alteração: renova o cache global da equipe.
    invalidarMembrosOrg();
    const { data: membroData } = await supabase
      .from("membros")
      .select("organizacao_id, papel")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membroData) { setLoading(false); return; }
    setIsAdmin(membroData.papel === "admin");

    const { data: orgData } = await supabase
      .from("organizacoes")
      .select("id, nome, plano")
      .eq("id", membroData.organizacao_id)
      .single();
    if (orgData) setOrg(orgData);

    const { data: membrosData } = await supabase
      .from("membros")
      .select("id, user_id, papel, created_at, permission_group_id")
      .eq("organizacao_id", membroData.organizacao_id);

    if (membrosData) {
      const enriched = await Promise.all(
        membrosData.map(async (m) => {
          const { data: profile } = await supabase
            .from("profiles_publico")
            .select("nome, foto_url, ativo")
            .eq("id", m.user_id)
            .single();
          return {
            ...m,
            nome: profile?.nome || null,
            foto_url: (profile as any)?.foto_url || null,
            ativo: (profile as any)?.ativo !== false,
            permission_group_id: (m as any).permission_group_id ?? null,
          } as Membro;
        })
      );
      setMembros(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const membrosVisiveis = membros.filter((m) => recorte.permite(m.user_id));

  const handleCreateOrg = async () => {
    if (!user || !orgName.trim()) return;
    setCreatingOrg(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: { action: "setup_org", email: orgName.trim() },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro ao criar organização");
    } else {
      toast.success("Organização criada!");
      setCreateOrgOpen(false);
      setOrgName("");
      loadData();
    }
    setCreatingOrg(false);
  };

  const handleInvite = async () => {
    if (!org || !inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: { action: "invite", email: inviteEmail.trim().toLowerCase(), nome: inviteName.trim(), papel: inviteRole, organizacao_id: org.id },
    });
    if (error) toast.error(error.message || "Erro ao convidar");
    else if (data?.error) toast.error(data.error);
    else {
      toast.success(`${inviteName.trim()} convidado como ${ROLE_LABELS[inviteRole]?.label || inviteRole}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      loadData();
    }
    setInviting(false);
  };

  const askConfirm = useConfirm();
  const handleRemove = async (membroId: string) => {
    if (!org) return;
    if (!(await askConfirm({ title: "Remover membro", description: "Remover este membro da organização?", destructive: true, confirmText: "Remover" }))) return;
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: { action: "remove", membro_id: membroId, organizacao_id: org.id },
    });
    if (error || data?.error) toast.error(data?.error || error?.message || "Erro ao remover");
    else { toast.success("Membro removido"); loadData(); }
  };

  const handleUpdateRole = async (membroId: string, newRole: string) => {
    if (!org) return;
    const { data, error } = await supabase.functions.invoke("gerenciar-equipe", {
      body: { action: "update_role", membro_id: membroId, papel: newRole, organizacao_id: org.id },
    });
    if (error || data?.error) toast.error(data?.error || error?.message || "Erro ao alterar papel");
    else { toast.success("Papel atualizado"); loadData(); }
  };

  const handleToggleAtivo = async (userId: string, ativo: boolean) => {
    await supabase.from("profiles").update({ ativo } as any).eq("id", userId);
    toast.success(ativo ? "Perfil ativado" : "Perfil desativado");
    setMembros(prev => prev.map(m => m.user_id === userId ? { ...m, ativo } : m));
  };

  const handleUploadFoto = async (userId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${userId}/foto.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) { toast.error("Erro ao enviar foto"); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ foto_url: urlData.publicUrl } as any).eq("id", userId);
      toast.success("Foto atualizada!");
      loadData();
    };
    input.click();
  };

  const getRoleInfo = (papel: string) => ROLE_LABELS[papel] || { label: papel, icon: Shield, color: "text-muted-foreground", desc: "" };

  return (
    <AppLayout>
      <PageHeader
        icon={Users2}
        title="Gestão de Equipe"
        subtitle="Gerencie membros, cargos e permissões da sua organização."
        breadcrumb={[{ label: "Agro" }, { label: "Equipe" }]}
      />

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !org ? (
        <motion.div {...fadeUp} transition={{ delay: 0.05 }}>
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <Building2 className="w-12 h-12 text-primary mx-auto mb-2" />
              <CardTitle>Crie sua Organização</CardTitle>
              <CardDescription>Para gerenciar uma equipe, primeiro crie sua organização.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Organização</Label>
                <Input placeholder="Ex: Escritório Mazini & Associados" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleCreateOrg} disabled={creatingOrg || !orgName.trim()}>
                <Building2 className="w-4 h-4" /> {creatingOrg ? "Criando..." : "Criar Organização"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Org info */}
          <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="bg-card rounded-lg p-5 shadow-card border border-border mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{org.nome}</h2>
                  <p className="text-xs text-muted-foreground">
                    {membrosVisiveis.length} membro{membrosVisiveis.length !== 1 ? "s" : ""} · Plano {org.plano}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setGruposOpen(true)}>
                    <Layers className="w-4 h-4" /> Grupos de Permissão
                  </Button>
                  <Button onClick={() => setInviteOpen(true)}>
                    <UserPlus className="w-4 h-4" /> Convidar Membro
                  </Button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Members grid */}
          <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
            {recorte.semLiderados && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground mb-6">
                {SEM_LIDERADOS_MSG}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {membrosVisiveis.map((m) => {
                const role = getRoleInfo(m.papel);
                const RoleIcon = role.icon;
                const isSelf = m.user_id === user?.id;
                const initials = (m.nome || "U").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

                return (
                  <div
                    key={m.id}
                    className={`bg-card rounded-xl border border-border shadow-card p-5 transition-all hover:shadow-card-hover ${
                      !m.ativo ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar / Photo */}
                        <div className="relative group">
                          {m.foto_url ? (
                            <img src={m.foto_url} alt={m.nome || ""} className="w-12 h-12 rounded-full object-cover border-2 border-border" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {initials}
                            </div>
                          )}
                          {(isAdmin || isSelf) && (
                            <button
                              onClick={() => handleUploadFoto(m.user_id)}
                              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                              <Camera className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {m.nome || "Sem nome"} {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <RoleIcon className={`w-3.5 h-3.5 ${role.color}`} />
                            <span className="text-xs text-muted-foreground">{role.label}</span>
                          </div>
                        </div>
                      </div>
                      {/* Status indicator */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        m.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    {/* Email placeholder */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Desde {new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>

                    {/* Actions */}
                    {isAdmin && !isSelf && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <Select value={m.papel} onValueChange={(v) => handleUpdateRole(m.id, v)}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="admin">Administrador</SelectItem>
                             <SelectItem value="coordenador">Coordenador</SelectItem>
                             <SelectItem value="gestor_pos_venda">Gestor de Pós-Venda</SelectItem>
                             <SelectItem value="pos_venda">Pós-Venda</SelectItem>
                             <SelectItem value="advogado_pos_venda">Advogado de Pós-Venda</SelectItem>
                             <SelectItem value="estagiario_pos_venda">Estagiário de Pós-Venda</SelectItem>
                             <SelectItem value="agronomo">Agrônomo</SelectItem>
                             <SelectItem value="engenheiro_agronomo">Eng. Agrônomo</SelectItem>
                             <SelectItem value="advogado">Advogado</SelectItem>
                             <SelectItem value="assessor_juridico">Assessor Jurídico</SelectItem>
                             <SelectItem value="estagiario_direito">Estagiário</SelectItem>
                             <SelectItem value="comercial">Comercial</SelectItem>
                             <SelectItem value="closer">Closer</SelectItem>
                             <SelectItem value="sdr">SDR</SelectItem>
                             <SelectItem value="social_seller">Social Seller</SelectItem>
                             <SelectItem value="marketing">Marketing</SelectItem>
                             <SelectItem value="gerente_marketing">Ger. Marketing</SelectItem>
                             <SelectItem value="criacao">Criação</SelectItem>
                             <SelectItem value="copywriter">Copywriter</SelectItem>
                             <SelectItem value="social_media">Social Media</SelectItem>
                           </SelectContent>
                        </Select>
                        <button
                          onClick={() => handleToggleAtivo(m.user_id, !m.ativo)}
                          className={`p-1.5 rounded-lg transition-colors ${m.ativo ? "hover:bg-destructive/10 text-success" : "hover:bg-success/10 text-muted-foreground"}`}
                          title={m.ativo ? "Desativar" : "Ativar"}
                        >
                          {m.ativo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button onClick={() => { setSelectedMember(m); setDetailOpen(true); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground" title="Ver permissões">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setModulosMember(m); setModulosOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"
                          title="Personalizar módulos deste usuário"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRemove(m.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Self - upload photo */}
                    {isSelf && !isAdmin && (
                      <div className="pt-3 border-t border-border">
                        <button
                          onClick={() => handleUploadFoto(m.user_id)}
                          className="flex items-center gap-2 text-xs text-accent hover:underline"
                        >
                          <Camera className="w-3.5 h-3.5" /> Alterar foto de perfil
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Contas e acessos (admin) */}
          {isAdmin && (
            <motion.div {...fadeUp} transition={{ delay: 0.12 }} className="mb-6">
              <ContasAcessoPanel orgId={org.id} onChanged={loadData} />
            </motion.div>
          )}

          {/* Permission Matrix */}
          <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="bg-card rounded-xl border border-border shadow-card overflow-hidden mb-6">
            <div className="p-5 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Matriz de Permissões por Cargo
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Visualize o que cada cargo pode acessar no sistema</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Permissão</th>
                    {Object.entries(ROLE_LABELS).map(([key, val]) => (
                      <th key={key} className="text-center px-3 py-3 font-semibold text-foreground whitespace-nowrap">
                        {val.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PERM_LABELS).map(([permKey, permLabel]) => (
                    <tr key={permKey} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-2.5 font-medium text-foreground">{permLabel}</td>
                      {Object.keys(ROLE_LABELS).map((role) => {
                        const has = PERMISSION_MATRIX[role]?.[permKey] ?? false;
                        return (
                          <td key={role} className="text-center px-3 py-2.5">
                            {has ? (
                              <span className="inline-block w-5 h-5 rounded-full bg-success/15 text-success text-[10px] font-bold leading-5">✓</span>
                            ) : (
                              <span className="inline-block w-5 h-5 rounded-full bg-destructive/10 text-destructive/50 text-[10px] font-bold leading-5">✗</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input placeholder="Ex: João da Silva" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail do membro</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="colaborador@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="pl-9" />
              </div>
              <p className="text-[10px] text-muted-foreground">Este e-mail será usado para login e notificações de tarefas.</p>
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gestor_pos_venda">Gestor de Pós-Venda</SelectItem>
                  <SelectItem value="pos_venda">Pós-Venda</SelectItem>
                  <SelectItem value="advogado_pos_venda">Advogado de Pós-Venda</SelectItem>
                  <SelectItem value="estagiario_pos_venda">Estagiário de Pós-Venda</SelectItem>
                  <SelectItem value="agronomo">Agrônomo</SelectItem>
                  <SelectItem value="engenheiro_agronomo">Eng. Agrônomo</SelectItem>
                  <SelectItem value="advogado">Advogado</SelectItem>
                  <SelectItem value="assessor_juridico">Assessor Jurídico</SelectItem>
                  <SelectItem value="estagiario_direito">Estagiário</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="social_seller">Social Seller</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="gerente_marketing">Ger. Marketing</SelectItem>
                  <SelectItem value="criacao">Criação</SelectItem>
                  <SelectItem value="copywriter">Copywriter</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {ROLE_LABELS[inviteRole] && (
                <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[inviteRole].desc}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}>
              <UserPlus className="w-4 h-4" /> {inviting ? "Convidando..." : "Convidar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMember?.foto_url ? (
                <img src={selectedMember.foto_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {(selectedMember?.nome || "U").charAt(0).toUpperCase()}
                </div>
              )}
              Permissões — {selectedMember?.nome || "Membro"}
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {(() => { const r = getRoleInfo(selectedMember.papel); const I = r.icon; return <I className={`w-4 h-4 ${r.color}`} />; })()}
                <span className="font-medium">{getRoleInfo(selectedMember.papel).label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{getRoleInfo(selectedMember.papel).desc}</p>
              <div className="space-y-1.5 pt-2">
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const has = PERMISSION_MATRIX[selectedMember.papel]?.[key] ?? false;
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background">
                      <span className="text-xs text-foreground">{label}</span>
                      {has ? (
                        <span className="text-xs font-semibold text-success flex items-center gap-1"><Eye className="w-3 h-3" /> Acesso</span>
                      ) : (
                        <span className="text-xs font-semibold text-destructive/60 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Bloqueado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MembroModulosDialog
        open={modulosOpen}
        onOpenChange={(v) => { setModulosOpen(v); if (!v) setModulosMember(null); }}
        membroId={modulosMember?.id ?? null}
        membroNome={modulosMember?.nome ?? null}
        orgId={org?.id ?? null}
      />

      <GruposPermissaoDialog
        open={gruposOpen}
        onOpenChange={setGruposOpen}
        orgId={org?.id ?? null}
        membros={membros}
        onChanged={loadData}
      />
    </AppLayout>
  );
}
