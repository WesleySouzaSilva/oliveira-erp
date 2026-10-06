import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Empresa = { id: string; organizacao_id: string; razao_social: string; nome_fantasia: string | null };
type Contato = { id: string; nome: string; empresa_id: string };
type Avenca = { id: string; titulo: string | null; escopo_areas: string[]; empresa_id: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  empresa?: Empresa | null; // se fixo (vindo do detalhe)
}

export function NovaDemandaDialog({ open, onClose, onSaved, empresa: empresaFixa }: Props) {
  const { user } = useAuth();
  const { orgId, members } = useOrgMembers();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [avencas, setAvencas] = useState<Avenca[]>([]);

  const [empresaId, setEmpresaId] = useState<string>(empresaFixa?.id || "");
  const [contatoId, setContatoId] = useState<string>("");
  const [avencaId, setAvencaId] = useState<string>("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState<string>("");
  const [prioridade, setPrioridade] = useState<string>("media");
  const [prazo, setPrazo] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>(user?.id || "");
  const [saving, setSaving] = useState(false);

  // Carrega empresas (se não veio fixa)
  useEffect(() => {
    if (!open || empresaFixa) return;
    (supabase as any)
      .from("empresas_consultoria")
      .select("id,organizacao_id,razao_social,nome_fantasia")
      .is("deleted_at", null)
      .order("razao_social")
      .then(({ data }: any) => setEmpresas((data || []) as Empresa[]));
  }, [open, empresaFixa]);

  // Carrega contatos e avenças quando a empresa muda
  useEffect(() => {
    if (!empresaId) { setContatos([]); setAvencas([]); return; }
    (async () => {
      const [c, a] = await Promise.all([
        (supabase as any).from("empresa_contatos").select("id,nome,empresa_id").eq("empresa_id", empresaId),
        (supabase as any).from("avencas").select("id,titulo,escopo_areas,empresa_id").eq("empresa_id", empresaId).is("deleted_at", null),
      ]);
      setContatos((c.data || []) as Contato[]);
      setAvencas((a.data || []) as Avenca[]);
    })();
  }, [empresaId]);

  const areasSugeridas = (() => {
    if (avencaId) {
      const av = avencas.find((a) => a.id === avencaId);
      if (av?.escopo_areas?.length) return av.escopo_areas;
    }
    return ["trabalhista", "contratos", "societario", "tributario", "lgpd", "civil", "consumidor", "ambiental"];
  })();

  const reset = () => {
    setEmpresaId(empresaFixa?.id || ""); setContatoId(""); setAvencaId("");
    setAssunto(""); setDescricao(""); setArea(""); setPrioridade("media");
    setPrazo(""); setResponsavelId(user?.id || "");
  };

  const salvar = async () => {
    if (!assunto.trim() || !empresaId) {
      toast({ title: "Informe empresa e assunto", variant: "destructive" });
      return;
    }
    const orgFromEmpresa = empresaFixa?.organizacao_id || empresas.find((e) => e.id === empresaId)?.organizacao_id || orgId;
    if (!orgFromEmpresa) {
      toast({ title: "Organização não identificada", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("consultoria_demandas").insert({
      organizacao_id: orgFromEmpresa,
      empresa_id: empresaId,
      contato_id: contatoId || null,
      avenca_id: avencaId || null,
      assunto: assunto.trim(),
      descricao: descricao.trim() || null,
      area: area || null,
      prioridade,
      prazo: prazo || null,
      responsavel_id: responsavelId || null,
      aberta_por: user?.id || null,
      origem: "interno",
    });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Demanda criada" });
    reset();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Nova demanda</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {!empresaFixa && (
            <div>
              <Label>Empresa *</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Solicitante</Label>
              <Select value={contatoId} onValueChange={setContatoId} disabled={!empresaId}>
                <SelectTrigger><SelectValue placeholder={contatos.length ? "Selecione" : "Nenhum contato"} /></SelectTrigger>
                <SelectContent>
                  {contatos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contrato de consultoria (opcional)</Label>
              <Select value={avencaId} onValueChange={setAvencaId} disabled={!empresaId}>
                <SelectTrigger><SelectValue placeholder={avencas.length ? "Selecione" : "Sem contratos"} /></SelectTrigger>
                <SelectContent>
                  {avencas.map((a) => <SelectItem key={a.id} value={a.id}>{a.titulo || "Contrato de consultoria"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Assunto *</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Revisão de cláusula de aviso prévio" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {areasSugeridas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {saving ? "Salvando..." : "Criar demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const PRIORIDADE_STYLE: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-500/15 text-blue-700",
  alta: "bg-orange-500/15 text-orange-700",
  urgente: "bg-destructive/15 text-destructive",
};

export const STATUS_STYLE: Record<string, string> = {
  aberta: "bg-primary/15 text-primary",
  em_analise: "bg-blue-500/15 text-blue-700",
  aguardando_empresa: "bg-yellow-500/15 text-yellow-700",
  concluida: "bg-emerald-500/15 text-emerald-700",
  cancelada: "bg-muted text-muted-foreground",
};

export const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_empresa: "Aguardando empresa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};