import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { brData } from "@/lib/controladoria";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ConfiguracaoTab() {
  const qc = useQueryClient();
  const { orgId, members } = useOrgMembers();
  const [nova, setNova] = useState({ numero: "", uf: "PR", advogado_nome: "" });

  const { data } = useQuery({
    queryKey: ["controladoria_config"],
    queryFn: async () => {
      const [oabs, forenses, feriados, cm, exec, lotes, advu] = await Promise.all([
        supabase.from("controladoria_oabs").select("*").order("created_at"),
        supabase.from("controladoria_feriados_forenses").select("*").order("data"),
        supabase.from("feriados").select("data, nome, tipo, ativo").order("data"),
        supabase.from("controladoria_membros").select("user_id, papel"),
        supabase.from("controladoria_execucoes").select("funcao, inicio, fim, novas, total, erro, detalhes").order("inicio", { ascending: false }).limit(8),
        (supabase.from("controladoria_triagem_lotes" as any) as any).select("*").order("created_at", { ascending: false }).limit(50),
        (supabase.from("controladoria_advbox_usuarios" as any) as any).select("*").order("advbox_nome"),
      ]);
      return { oabs: oabs.data || [], forenses: forenses.data || [], feriados: feriados.data || [], cm: cm.data || [], exec: exec.data || [], lotes: (lotes.data as any[]) || [], advu: (advu.data as any[]) || [] };
    },
  });
  const recarregar = () => qc.invalidateQueries({ queryKey: ["controladoria_config"] });
  const nomeDe = (id: string) => members.find((m) => m.user_id === id)?.nome || "·";

  async function addOab() {
    if (!orgId || !nova.numero.trim()) return;
    const { error } = await supabase.from("controladoria_oabs").insert({
      organizacao_id: orgId, numero: nova.numero.replace(/\D/g, ""), uf: nova.uf.toUpperCase().slice(0, 2), advogado_nome: nova.advogado_nome || null,
    });
    if (error) { toast.error(error.message.includes("row-level") ? "Só o administrador da Controladoria pode alterar." : error.message); return; }
    setNova({ numero: "", uf: "PR", advogado_nome: "" });
    recarregar();
  }
  async function vincular(id: string, userId: string) {
    const valores = userId === "__nenhum__" ? { user_id: null, origem: null } : { user_id: userId, origem: "manual" };
    const { error, data: d } = await (supabase.from("controladoria_advbox_usuarios" as any) as any)
      .update({ ...valores, atualizado_em: new Date().toISOString() }).eq("id", id).select();
    if (error || !d?.length) { toast.error("Só o administrador da Controladoria pode alterar."); return; }
    toast.success("Vínculo salvo");
    recarregar();
  }
  async function patch(tabela: "controladoria_oabs" | "controladoria_feriados_forenses" | "controladoria_membros", id: Record<string, string>, valores: Record<string, unknown>) {
    let q: any = supabase.from(tabela).update(valores as any);
    for (const [k, v] of Object.entries(id)) q = q.eq(k, v);
    const { error, data: d } = await q.select();
    if (error || !d?.length) { toast.error("Só o administrador da Controladoria pode alterar."); return; }
    recarregar();
  }

  const ultima: any = data?.exec.find((e: any) => e.funcao === "djen-captura" && e.fim);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4 space-y-2 lg:col-span-2">
        <h3 className="font-serif text-lg font-semibold">Última captura do DJEN</h3>
        {ultima ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>{new Date(ultima.fim).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            <Badge variant={ultima.erro ? "destructive" : "secondary"}>{ultima.erro ? "Falhou" : "Deu certo"}</Badge>
            <span>{ultima.novas ?? 0} novas</span>
            <span className="text-muted-foreground">{ultima.detalhes?.novas_por_nome ?? 0} pelo nome</span>
            {ultima.erro && <span className="text-xs text-destructive w-full">{ultima.erro}</span>}
          </div>
        ) : <p className="text-sm text-muted-foreground">Nenhuma captura registrada.</p>}
        <p className="text-xs text-muted-foreground">Roda todos os dias às 01h, 03h, 05h, 07h, 12h e 18h. Se falhar, os administradores recebem um aviso.</p>
      </Card>
      <Card className="p-4 space-y-3">
        <h3 className="font-serif text-lg font-semibold">OABs monitoradas</h3>
        {data?.oabs.map((o: any) => (
          <div key={o.id} className="flex items-center gap-3 text-sm">
            <span className="font-mono">{o.numero}/{o.uf}</span>
            <span className="flex-1">{o.advogado_nome}</span>
            <span className="text-xs text-muted-foreground">{o.ultima_captura ? `última: ${new Date(o.ultima_captura).toLocaleString("pt-BR")}` : "nunca capturada"}</span>
            <Switch checked={o.ativo} onCheckedChange={(v) => patch("controladoria_oabs", { id: o.id }, { ativo: v })} aria-label="Ativa" />
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2 items-end border-t pt-3">
          <div><Label htmlFor="oab-n">Número</Label><Input id="oab-n" value={nova.numero} onChange={(e) => setNova({ ...nova, numero: e.target.value })} /></div>
          <div><Label htmlFor="oab-uf">UF</Label><Input id="oab-uf" maxLength={2} value={nova.uf} onChange={(e) => setNova({ ...nova, uf: e.target.value })} /></div>
          <div><Label htmlFor="oab-nome">Advogado</Label><Input id="oab-nome" value={nova.advogado_nome} onChange={(e) => setNova({ ...nova, advogado_nome: e.target.value })} /></div>
          <Button onClick={addOab}>Adicionar</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-serif text-lg font-semibold">Equipe da Controladoria</h3>
        <p className="text-xs text-muted-foreground">O administrador recebe as tarefas do ADVBOX que não têm e-mail correspondente no app.</p>
        {data?.cm.map((m: any) => (
          <div key={m.user_id} className="flex items-center gap-3 text-sm">
            <span className="flex-1">{nomeDe(m.user_id)}</span>
            <Badge variant={m.papel === "admin" ? "default" : "outline"}>{m.papel === "admin" ? "Administrador" : "Membro"}</Badge>
            <Switch checked={m.papel === "admin"} onCheckedChange={(v) => patch("controladoria_membros", { user_id: m.user_id }, { papel: v ? "admin" : "membro" })} aria-label="Administrador" />
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-serif text-lg font-semibold">Feriados forenses (a conferir)</h3>
        <p className="text-xs text-muted-foreground">Desligados, a Controladoria conta o dia como útil (prazo sai mais cedo). Ligue depois de conferir o calendário do tribunal.</p>
        {data?.forenses.map((f: any) => (
          <div key={f.id} className="flex items-center gap-3 text-sm">
            <span className="w-24">{brData(f.data)}</span>
            <span className="flex-1">{f.nome}</span>
            <Switch checked={f.ativo} onCheckedChange={(v) => patch("controladoria_feriados_forenses", { id: f.id }, { ativo: v })} aria-label="Ativo" />
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center">
          <h3 className="font-serif text-lg font-semibold flex-1">Feriados cadastrados</h3>
          <Button asChild variant="outline" size="sm"><Link to="/feriados">Cadastrar feriado local</Link></Button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {data?.feriados.filter((f: any) => f.ativo !== false).map((f: any) => (
            <div key={f.data + f.nome} className="flex gap-3 text-sm"><span className="w-24">{brData(String(f.data))}</span><span className="flex-1">{f.nome}</span><span className="text-xs text-muted-foreground">{f.tipo}</span></div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3 lg:col-span-2">
        <h3 className="font-serif text-lg font-semibold">Usuários do ADVBOX × usuários do app</h3>
        <p className="text-xs text-muted-foreground">Usado pela captura e pelo D-5 para definir o responsável. Vínculo escolhido aqui (manual) nunca é trocado pelo automático por e-mail.</p>
        {!data?.advu.length && <p className="text-sm text-muted-foreground">Lista ainda não carregada do ADVBOX (preenche na próxima captura ou D-5).</p>}
        <div className="space-y-1">
          {data?.advu.map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-64 font-medium">{u.advbox_nome || u.advbox_user_id}</span>
              <span className="w-64 text-muted-foreground truncate">{u.advbox_email || "sem e-mail"}</span>
              <Select value={u.user_id || "__nenhum__"} onValueChange={(v) => vincular(u.id, v)}>
                <SelectTrigger className="w-64" aria-label={`Usuário do app para ${u.advbox_nome}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum__">Sem correspondência</SelectItem>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {u.user_id ? <Badge variant={u.origem === "manual" ? "default" : "outline"}>{u.origem === "manual" ? "Manual" : "Por e-mail"}</Badge> : <Badge variant="destructive">Sem vínculo</Badge>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-2 lg:col-span-2">
        <h3 className="font-serif text-lg font-semibold">Últimas execuções</h3>
        {data?.exec.map((e: any, k: number) => (
          <div key={k} className="flex gap-3 text-sm">
            <span className="w-40">{new Date(e.inicio).toLocaleString("pt-BR")}</span>
            <span className="w-40">{e.funcao === "djen-captura" ? "Captura DJEN" : "Relatório D-5"}</span>
            <span className="flex-1">{e.erro ? <span className="text-destructive">{e.erro.replace("DJEN_BLOQUEIO: ", "")}</span> : e.funcao === "djen-captura" ? `${e.novas} novas` : `${e.total} itens`}</span>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-2 lg:col-span-2">
        <h3 className="font-serif text-lg font-semibold">Histórico de triagem em lote</h3>
        {!data?.lotes.length && <p className="text-sm text-muted-foreground">Nenhum lote ainda.</p>}
        <div className="max-h-80 overflow-y-auto space-y-1">
          {data?.lotes.map((l: any) => (
            <div key={l.id} className="flex flex-wrap gap-3 text-sm">
              <span className="w-40">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
              <span className="w-40">{nomeDe(l.user_id)}</span>
              <span className="w-44">{ACOES_LOTE[l.acao] || l.acao}</span>
              <span className="w-20">{l.quantidade}</span>
              <span className="flex-1 text-muted-foreground">{l.observacao}</span>
              {l.desfeito_em && <Badge variant="outline">desfeito em {new Date(l.desfeito_em).toLocaleString("pt-BR")}</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const ACOES_LOTE: Record<string, string> = {
  lida: "Marcadas como lidas", tratada_advbox: "Tratadas no ADVBOX", sem_providencia: "Sem providência",
  atribuir: "Responsável atribuído", tarefa: "Tarefas geradas",
};
