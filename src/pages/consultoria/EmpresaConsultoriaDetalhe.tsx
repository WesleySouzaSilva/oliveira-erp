import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Save, Trash2, Star, Lock, Building2, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { DemandasEmpresaSection } from "@/components/consultoria/DemandasEmpresaSection";
import { DemandasExternasEmpresaSection } from "@/components/consultoria/DemandasExternasEmpresaSection";
import { OnboardingEmpresaBloco } from "@/components/consultoria/OnboardingEmpresaBloco";
import { EmpresaDocumentosSection } from "@/components/consultoria/EmpresaDocumentosSection";

type Empresa = {
  id: string; organizacao_id: string;
  razao_social: string; nome_fantasia: string | null; cnpj: string | null;
  setor: string | null; porte: string | null;
  status: "ativa" | "suspensa" | "encerrada"; responsavel_id: string | null; observacoes: string | null;
};
type Contato = {
  id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null;
  pode_abrir_demanda: boolean; principal: boolean;
};
type Avenca = {
  id: string; organizacao_id: string; titulo: string | null;
  escopo_areas: string[]; dia_vencimento: number | null;
  vigencia_inicio: string | null; vigencia_fim: string | null;
  reajuste_indice: string | null; reajuste_proximo: string | null;
  status: "ativa" | "suspensa" | "encerrada"; responsavel_id: string | null; observacoes: string | null;
};

const AREAS = ["trabalhista", "contratos", "societario", "tributario", "lgpd", "civil", "consumidor", "ambiental"];

const STATUS_STYLE: Record<string, string> = {
  ativa: "bg-primary/15 text-primary",
  suspensa: "bg-yellow-500/15 text-yellow-700",
  encerrada: "bg-muted text-muted-foreground",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EmpresaConsultoriaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, members } = useOrgMembers();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [avencas, setAvencas] = useState<Avenca[]>([]);
  const [valoresVisiveis, setValoresVisiveis] = useState<Record<string, number>>({});
  const [podeVerFinanceiro, setPodeVerFinanceiro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [portalUsuariosIds, setPortalUsuariosIds] = useState<Set<string>>(new Set());
  const [convidando, setConvidando] = useState<string | null>(null);

  const [contatoOpen, setContatoOpen] = useState<{ open: boolean; editing?: Contato | null }>({ open: false });
  const [avencaOpen, setAvencaOpen] = useState<{ open: boolean; editing?: Avenca | null }>({ open: false });
  const [excluirEmpresaOpen, setExcluirEmpresaOpen] = useState(false);
  const [excluirContato, setExcluirContato] = useState<Contato | null>(null);
  const [encerrarAvenca, setEncerrarAvenca] = useState<Avenca | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [eRes, cRes, aRes] = await Promise.all([
      (supabase as any).from("empresas_consultoria").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("empresa_contatos").select("*").eq("empresa_id", id).order("principal", { ascending: false }),
      (supabase as any).from("avencas").select("*").eq("empresa_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    ]);
    if (eRes.error || !eRes.data) {
      toast({ title: "Empresa não encontrada", variant: "destructive" });
      navigate("/consultoria/empresas");
      return;
    }
    const emp = eRes.data as Empresa;
    setEmpresa(emp);
    setContatos((cRes.data || []) as Contato[]);
    const avs = (aRes.data || []) as Avenca[];
    setAvencas(avs);

    // Usuários do portal já vinculados (para mostrar status "Convidado")
    const { data: portais } = await (supabase as any)
      .from("empresa_portal_usuarios")
      .select("contato_id, ativo")
      .eq("empresa_id", id);
    setPortalUsuariosIds(
      new Set(((portais || []) as Array<{ contato_id: string | null; ativo: boolean }>)
        .filter((p) => p.ativo && p.contato_id)
        .map((p) => p.contato_id as string))
    );

    // Tenta carregar valores das avenças. RLS bloqueia se o usuário não puder.
    if (avs.length > 0) {
      const { data: vals } = await (supabase as any)
        .from("avenca_valores")
        .select("avenca_id,valor_mensal")
        .in("avenca_id", avs.map((a) => a.id));
      const map: Record<string, number> = {};
      (vals || []).forEach((v: any) => { map[v.avenca_id] = Number(v.valor_mensal); });
      setValoresVisiveis(map);
    }

    // Checa permissão pela função SECURITY DEFINER (mesma usada nas policies)
    if (user) {
      const { data: can } = await (supabase as any).rpc("can_view_consultoria_financeiro", {
        _user_id: user.id, _org_id: emp.organizacao_id,
      });
      setPodeVerFinanceiro(Boolean(can));
    }

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user]);

  const excluirEmpresa = async () => {
    if (!empresa) return;
    const { error } = await (supabase as any).from("empresas_consultoria")
      .update({ deleted_at: new Date().toISOString() }).eq("id", empresa.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Empresa removida" });
    navigate("/consultoria/empresas");
  };

  const updateEmpresaStatus = async (status: Empresa["status"]) => {
    if (!empresa) return;
    const { error } = await (supabase as any).from("empresas_consultoria")
      .update({ status }).eq("id", empresa.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEmpresa({ ...empresa, status });
  };

  const convidarParaPortal = async (c: Contato) => {
    if (!empresa || !c.email) return;
    setConvidando(c.id);
    const { data, error } = await (supabase as any).functions.invoke("portal-convidar", {
      body: { empresa_id: empresa.id, contato_id: c.id, email: c.email, nome: c.nome },
    });
    setConvidando(null);
    if (error || (data && (data as any).error)) {
      toast({
        title: "Não foi possível convidar",
        description: (data as any)?.error || error?.message || "Erro inesperado",
        variant: "destructive",
      });
      return;
    }
    setPortalUsuariosIds((prev) => new Set(prev).add(c.id));
    toast({ title: "Convite enviado", description: `Um e-mail foi enviado a ${c.email} para definir a senha.` });
  };

  if (loading || !empresa) {
    return <AppLayout><div className="p-6 text-center text-muted-foreground">Carregando...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <PageHeader
          backTo="/consultoria/empresas"
          breadcrumb={[
            { label: "Empresarial" },
            { label: "Empresas", to: "/consultoria/empresas" },
            { label: empresa.razao_social },
          ]}
          icon={Building2}
          title={empresa.razao_social}
          subtitle={
            [empresa.nome_fantasia, empresa.cnpj, empresa.setor, empresa.porte].filter(Boolean).join(" · ") || "—"
          }
          actions={
            <>
              <Select value={empresa.status} onValueChange={(v) => updateEmpresaStatus(v as any)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="suspensa">Suspensa</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setExcluirEmpresaOpen(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </>
          }
        />

        {/* CONTATOS */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold">Contatos</h2>
            <Button size="sm" onClick={() => setContatoOpen({ open: true, editing: null })}
              className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="w-4 h-4 mr-1" /> Novo contato
            </Button>
          </div>
          {contatos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum contato cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {contatos.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.nome}</span>
                      {c.principal && <Badge variant="secondary" className="text-[10px]"><Star className="w-3 h-3 mr-1" />Principal</Badge>}
                      {c.pode_abrir_demanda && <Badge variant="outline" className="text-[10px]">Pode abrir demanda</Badge>}
                      {portalUsuariosIds.has(c.id) && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          Portal ativo
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[c.cargo, c.email, c.telefone].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  {isAdmin && c.email && !portalUsuariosIds.has(c.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={convidando === c.id}
                      onClick={() => convidarParaPortal(c)}
                      title="Enviar convite de acesso ao portal do cliente"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {convidando === c.id ? "Enviando…" : "Convidar p/ portal"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setContatoOpen({ open: true, editing: c })}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setExcluirContato(c)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* AVENÇAS */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-serif font-semibold">Contratos de consultoria</h2>
              {!podeVerFinanceiro && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3" /> O valor mensal é restrito à gestão financeira.
                </p>
              )}
            </div>
            <Button size="sm" onClick={() => setAvencaOpen({ open: true, editing: null })}
              className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="w-4 h-4 mr-1" /> Novo contrato
            </Button>
          </div>
          {avencas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato de consultoria cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {avencas.map((a) => (
                <div key={a.id} className="border rounded-md p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{a.titulo || "Contrato de consultoria"}</span>
                        <StatusBadge status={a.status} label={a.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {a.escopo_areas?.length > 0 ? `Áreas: ${a.escopo_areas.join(", ")}` : "Sem áreas definidas"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vigência: {a.vigencia_inicio || "—"} a {a.vigencia_fim || "—"}
                        {a.dia_vencimento ? ` · Vence dia ${a.dia_vencimento}` : ""}
                        {a.reajuste_indice ? ` · Reajuste ${a.reajuste_indice}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      {podeVerFinanceiro ? (
                        <div className="text-lg font-semibold">
                          {valoresVisiveis[a.id] != null ? fmtBRL(valoresVisiveis[a.id]) : <span className="text-xs text-muted-foreground italic">Sem valor</span>}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Lock className="w-3 h-3" /> restrito
                        </div>
                      )}
                      <span className="text-[11px] text-muted-foreground">/mês</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => setAvencaOpen({ open: true, editing: a })}>Editar</Button>
                    {a.status !== "encerrada" && (
                      <Button variant="ghost" size="sm" onClick={() => setEncerrarAvenca(a)}>
                        Encerrar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* DEMANDAS */}
        <DemandasEmpresaSection empresa={empresa} />

        {/* DEMANDAS EXTERNAS & ACORDOS */}
        <DemandasExternasEmpresaSection empresa={empresa} />

        {/* ONBOARDING */}
        <OnboardingEmpresaBloco empresaId={empresa.id} />

        {/* DOCUMENTOS (laudos/pareceres/relatórios) */}
        <EmpresaDocumentosSection empresaId={empresa.id} />

        {contatoOpen.open && (
          <ContatoDialog
            empresa={empresa}
            editing={contatoOpen.editing || null}
            onClose={() => setContatoOpen({ open: false })}
            onSaved={() => { setContatoOpen({ open: false }); load(); }}
          />
        )}
        {avencaOpen.open && (
          <AvencaDialog
            empresa={empresa}
            editing={avencaOpen.editing || null}
            podeVerFinanceiro={podeVerFinanceiro}
            valorAtual={avencaOpen.editing ? valoresVisiveis[avencaOpen.editing.id] ?? null : null}
            onClose={() => setAvencaOpen({ open: false })}
            onSaved={() => { setAvencaOpen({ open: false }); load(); }}
          />
        )}

        <AlertDialog open={excluirEmpresaOpen} onOpenChange={setExcluirEmpresaOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
              <AlertDialogDescription>
                A empresa será marcada como removida. Contatos e contratos de consultoria permanecem registrados, mas não aparecerão na lista.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={excluirEmpresa} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!excluirContato} onOpenChange={(o) => !o && setExcluirContato(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover contato?</AlertDialogTitle>
              <AlertDialogDescription>{excluirContato?.nome} será removido desta empresa.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={async () => {
                  if (!excluirContato) return;
                  await (supabase as any).from("empresa_contatos").delete().eq("id", excluirContato.id);
                  setExcluirContato(null); load();
                }}
              >Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!encerrarAvenca} onOpenChange={(o) => !o && setEncerrarAvenca(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar contrato de consultoria?</AlertDialogTitle>
              <AlertDialogDescription>O status passa para "encerrada". O histórico fica preservado.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!encerrarAvenca) return;
                  await (supabase as any).from("avencas").update({ status: "encerrada" }).eq("id", encerrarAvenca.id);
                  setEncerrarAvenca(null); load();
                }}
              >Encerrar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function ContatoDialog({
  empresa, editing, onClose, onSaved,
}: { empresa: Empresa; editing: Contato | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: editing?.nome || "", cargo: editing?.cargo || "",
    email: editing?.email || "", telefone: editing?.telefone || "",
    principal: editing?.principal || false, pode_abrir_demanda: editing?.pode_abrir_demanda || false,
  });
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      const payload = {
        organizacao_id: empresa.organizacao_id,
        empresa_id: empresa.id,
        nome: form.nome.trim(),
        cargo: form.cargo.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        principal: form.principal,
        pode_abrir_demanda: form.pode_abrir_demanda,
      };
      const q = editing
        ? (supabase as any).from("empresa_contatos").update(payload).eq("id", editing.id)
        : (supabase as any).from("empresa_contatos").insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast({ title: editing ? "Contato atualizado" : "Contato adicionado" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif">{editing ? "Editar contato" : "Novo contato"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><MaskedInput mask="telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} placeholder="(00) 00000-0000" /></div>
          </div>
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Checkbox id="principal" checked={form.principal} onCheckedChange={(v) => setForm({ ...form, principal: !!v })} />
            <Label htmlFor="principal" className="cursor-pointer">Contato principal</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pode" checked={form.pode_abrir_demanda} onCheckedChange={(v) => setForm({ ...form, pode_abrir_demanda: !!v })} />
            <Label htmlFor="pode" className="cursor-pointer">Pode abrir demanda (portal — fase 2)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !form.nome.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvencaDialog({
  empresa, editing, podeVerFinanceiro, valorAtual, onClose, onSaved,
}: {
  empresa: Empresa; editing: Avenca | null; podeVerFinanceiro: boolean;
  valorAtual: number | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    titulo: editing?.titulo || "",
    escopo_areas: editing?.escopo_areas || [],
    dia_vencimento: editing?.dia_vencimento ?? null as number | null,
    vigencia_inicio: editing?.vigencia_inicio || "",
    vigencia_fim: editing?.vigencia_fim || "",
    reajuste_indice: editing?.reajuste_indice || "",
    reajuste_proximo: editing?.reajuste_proximo || "",
    observacoes: editing?.observacoes || "",
  });
  const [valor, setValor] = useState<number | null>(valorAtual);
  const [saving, setSaving] = useState(false);

  const toggleArea = (a: string) => {
    setForm((f) => ({
      ...f,
      escopo_areas: f.escopo_areas.includes(a) ? f.escopo_areas.filter((x) => x !== a) : [...f.escopo_areas, a],
    }));
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const payload = {
        organizacao_id: empresa.organizacao_id,
        empresa_id: empresa.id,
        titulo: form.titulo.trim() || null,
        escopo_areas: form.escopo_areas,
        dia_vencimento: form.dia_vencimento,
        vigencia_inicio: form.vigencia_inicio || null,
        vigencia_fim: form.vigencia_fim || null,
        reajuste_indice: form.reajuste_indice.trim() || null,
        reajuste_proximo: form.reajuste_proximo || null,
        observacoes: form.observacoes.trim() || null,
      };
      let avencaId = editing?.id;
      if (editing) {
        const { error } = await (supabase as any).from("avencas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("avencas").insert(payload).select("id").single();
        if (error) throw error;
        avencaId = data.id;
      }

      // Valor mensal — só persiste se o usuário tem permissão financeira.
      // RLS bloquearia mesmo se tentasse; o gate na UI evita o erro silencioso.
      if (podeVerFinanceiro && avencaId && valor != null) {
        const { error: vErr } = await (supabase as any).from("avenca_valores").upsert({
          avenca_id: avencaId,
          organizacao_id: empresa.organizacao_id,
          valor_mensal: valor,
        }, { onConflict: "avenca_id" });
        if (vErr) throw vErr;
      }

      toast({ title: editing ? "Contrato atualizado" : "Contrato criado" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-serif">{editing ? "Editar contrato" : "Novo contrato"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Contrato de consultoria 2026" /></div>

          <div className="space-y-1.5">
            <Label>Áreas cobertas</Label>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => {
                const on = form.escopo_areas.includes(a);
                return (
                  <button type="button" key={a} onClick={() => toggleArea(a)}
                    className={`text-xs px-2 py-1 rounded-md border ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Vigência início</Label><Input type="date" value={form.vigencia_inicio} onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Vigência fim</Label><Input type="date" value={form.vigencia_fim} onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Dia de vencimento</Label>
              <Input type="number" min={1} max={31} value={form.dia_vencimento ?? ""} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Índice de reajuste</Label><Input value={form.reajuste_indice} onChange={(e) => setForm({ ...form, reajuste_indice: e.target.value })} placeholder="IPCA, IGPM..." /></div>
            <div className="space-y-1.5"><Label>Próximo reajuste</Label><Input type="date" value={form.reajuste_proximo} onChange={(e) => setForm({ ...form, reajuste_proximo: e.target.value })} /></div>
          </div>

          {podeVerFinanceiro ? (
            <div className="space-y-1.5 p-3 rounded-md bg-muted/40 border">
              <Label className="flex items-center gap-1"><Lock className="w-3 h-3" /> Valor mensal (restrito)</Label>
              <CurrencyInput value={valor} onChange={setValor} />
              <p className="text-[11px] text-muted-foreground">Visível apenas para admin e coordenação financeira.</p>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1 p-3 rounded-md bg-muted/40 border">
              <Lock className="w-3 h-3" /> Valor mensal é gerido pela gestão financeira.
            </div>
          )}

          <div className="space-y-1.5"><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}