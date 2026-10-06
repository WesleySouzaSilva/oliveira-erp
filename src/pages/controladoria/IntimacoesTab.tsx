import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, ExternalLink, ChevronDown, ChevronRight, Keyboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSkeleton } from "@/components/ui/loaders";
import { brData, capturarPeloNavegador, capturarPeloServidor, montarCalendario } from "@/lib/controladoria";

export const SITUACOES: Record<string, string> = {
  nova: "Nova",
  lida: "Lida",
  tarefa_criada: "Tarefa criada",
  sem_providencia: "Sem providência",
  tratada_advbox: "Tratada no ADVBOX",
};

const SO_CIENCIA = ["Pauta de julgamento", "Lista de distribuição", "Ata de sessão"];

type Intimacao = Record<string, any>;
type Fila = "novas" | "minhas" | "sem_resp" | "com_prazo" | "ciencia" | "reu" | "fora" | "tratadas" | "todas";
type Acao = "lida" | "tratada_advbox" | "sem_providencia" | "atribuir" | "tarefa";

const FILAS: { id: Fila; label: string }[] = [
  { id: "novas", label: "Novas" },
  { id: "minhas", label: "Minhas" },
  { id: "sem_resp", label: "Sem responsável" },
  { id: "com_prazo", label: "Com prazo identificado" },
  { id: "ciencia", label: "Só ciência" },
  { id: "reu", label: "Cliente réu" },
  { id: "fora", label: "Fora do ADVBOX" },
  { id: "tratadas", label: "Tratadas" },
  { id: "todas", label: "Todas" },
];

/** Filas de trabalho olham só as novas; "Tratadas" olha as que já têm destino. */
function naFila(i: Intimacao, fila: Fila, uid: string | null) {
  const nova = i.status_triagem === "nova";
  switch (fila) {
    case "novas": return nova;
    case "minhas": return nova && !!uid && i.responsavel_id === uid;
    case "sem_resp": return nova && !i.responsavel_id;
    case "com_prazo": return nova && i.prazo_sugerido_dias != null;
    case "ciencia": return nova && SO_CIENCIA.includes(i.tipo_comunicacao);
    case "reu": return nova && i.polo_cliente === "P";
    case "fora": return nova && !!i.advbox_nao_cadastrado;
    case "tratadas": return !nova;
    default: return true;
  }
}

async function executarLote(ids: string[], acao: Acao, payload: Record<string, unknown>, onMudou: () => void) {
  const { data, error } = await supabase.rpc("controladoria_triagem_lote" as any, { _ids: ids, _acao: acao, _payload: payload } as any);
  if (error) { toast.error(error.message); return false; }
  const lote = data as unknown as string;
  onMudou();
  toast.success(`${ids.length} intimaç${ids.length === 1 ? "ão atualizada" : "ões atualizadas"}`, {
    duration: 8000,
    action: {
      label: "Desfazer",
      onClick: async () => {
        const { error: e2 } = await supabase.rpc("controladoria_triagem_desfazer" as any, { _lote: lote } as any);
        if (e2) toast.error(e2.message); else { toast.success("Ação desfeita"); onMudou(); }
      },
    },
  });
  return true;
}

/** Selo das intimações achadas só pelo nome do advogado (OAB escrita diferente). */
function seloNome(i: any) {
  const escrita = ((i.advogados as any[]) || []).map((a) => a?.advogado ?? a)
    .map((a) => String(a?.numero_oab ?? "")).find((n) => n && !/^\d+$/.test(n));
  return `Achada pelo nome${escrita ? `: OAB escrita como ${escrita}` : ""}`;
}

function UltimaBusca() {
  const { data } = useQuery({
    queryKey: ["controladoria_ultima_captura"],
    queryFn: async () => (await supabase.from("controladoria_execucoes").select("inicio, fim, erro")
      .eq("funcao", "djen-captura").not("fim", "is", null).order("fim", { ascending: false }).limit(1)).data?.[0] ?? null,
  });
  if (!data?.fim) return null;
  const d = new Date(data.fim);
  const hoje = new Date().toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <p className="text-xs text-muted-foreground">
      Última busca no DJEN: {hoje ? "hoje" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {hora}
      {data.erro ? " (com erro)" : ""}
    </p>
  );
}

export default function IntimacoesTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { members, orgId } = useOrgMembers();
  const [f, setF] = useState({ de: "", ate: "", tribunal: "todos", situacao: "todas", resp: "todos", foraAdvbox: false, busca: "" });
  const [fila, setFila] = useState<Fila>("novas");
  const [agrupar, setAgrupar] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aberta, setAberta] = useState<Intimacao | null>(null);
  const [capturando, setCapturando] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ tipo: "sem_providencia" | "atribuir" | "tarefa"; ids: string[] } | null>(null);
  const diasRef = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(() => qc.invalidateQueries({ queryKey: ["djen_comunicacoes"] }), [qc]);

  const { data: lista, isLoading } = useQuery({
    queryKey: ["djen_comunicacoes"],
    queryFn: async () => {
      const out: Intimacao[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await supabase
          .from("djen_comunicacoes")
          .select("id, djen_id, data_disponibilizacao, data_publicacao, inicio_prazo, aviso_suspensao, sigla_tribunal, tipo_comunicacao, nome_orgao, nome_classe, numero_processo, numero_processo_mascara, destinatarios, advbox_lawsuit_id, advbox_responsavel, advbox_nao_cadastrado, cliente_id, polo_cliente, status_triagem, prazo_dias, prazo_fatal, observacao, link, responsavel_id, prazo_sugerido_dias, prazo_sugerido_trecho, prazo_sugerido_multiplo, capturada_por, advogados, clientes(nome)")
          .order("data_disponibilizacao", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        out.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
      return out;
    },
  });

  const { data: feriados } = useQuery({
    queryKey: ["controladoria_calendario"],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("feriados").select("data, ativo"),
        supabase.from("controladoria_feriados_forenses").select("data").eq("ativo", true),
      ]);
      return [
        ...((a.data as any[]) || []).filter((r) => r.ativo !== false).map((r) => String(r.data).slice(0, 10)),
        ...((b.data as any[]) || []).map((r) => String(r.data).slice(0, 10)),
      ];
    },
  });
  const cal = useMemo(() => montarCalendario(feriados || []), [feriados]);
  const nomeMembro = useCallback((id?: string | null) => members.find((m) => m.user_id === id)?.nome || null, [members]);

  const tribunais = useMemo(() => [...new Set((lista || []).map((i) => i.sigla_tribunal).filter(Boolean))].sort(), [lista]);
  const responsaveis = useMemo(() => [...new Set((lista || []).map((i) => i.advbox_responsavel).filter(Boolean))].sort(), [lista]);

  const contFila = useMemo(() => {
    const c = {} as Record<Fila, number>;
    for (const q of FILAS) c[q.id] = 0;
    for (const i of lista || []) for (const q of FILAS) if (naFila(i, q.id, uid)) c[q.id]++;
    return c;
  }, [lista, uid]);

  const filtrada = useMemo(() => {
    const b = f.busca.trim().toLowerCase();
    return (lista || []).filter((i) => {
      if (!naFila(i, fila, uid)) return false;
      if (f.de && i.data_disponibilizacao < f.de) return false;
      if (f.ate && i.data_disponibilizacao > f.ate) return false;
      if (f.tribunal !== "todos" && i.sigla_tribunal !== f.tribunal) return false;
      if (f.situacao !== "todas" && i.status_triagem !== f.situacao) return false;
      if (f.resp !== "todos" && i.advbox_responsavel !== f.resp) return false;
      if (f.foraAdvbox && !i.advbox_nao_cadastrado) return false;
      if (b) {
        const txt = `${i.numero_processo_mascara ?? ""} ${i.numero_processo ?? ""} ${(i.destinatarios || []).map((d: any) => d.nome).join(" ")} ${i.clientes?.nome ?? ""}`.toLowerCase();
        if (!txt.includes(b)) return false;
      }
      return true;
    });
  }, [lista, f, fila, uid]);

  const grupos = useMemo(() => {
    const m = new Map<string, Intimacao[]>();
    for (const i of filtrada) {
      const k = i.numero_processo || i.id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    }
    return [...m.entries()];
  }, [filtrada]);

  // Ordem de navegação (↑/↓) = ordem visível
  const ordem = useMemo(() => {
    if (!agrupar) return filtrada;
    return grupos.flatMap(([k, itens]) => (expandidos.has(k) || itens.length === 1 ? itens : [itens[0]]));
  }, [agrupar, filtrada, grupos, expandidos]);

  useEffect(() => { setSel(new Set()); }, [fila, f]);

  const alternar = (ids: string[], marcar?: boolean) => setSel((s) => {
    const n = new Set(s);
    const todas = ids.every((id) => n.has(id));
    const v = marcar ?? !todas;
    ids.forEach((id) => (v ? n.add(id) : n.delete(id)));
    return n;
  });

  const mudou = useCallback(() => { setSel(new Set()); recarregar(); }, [recarregar]);

  const agir = async (acao: Acao, ids: string[], payload: Record<string, unknown> = {}) => {
    if (!ids.length) return false;
    return executarLote(ids, acao, payload, mudou);
  };

  const avancar = (atual: Intimacao) => {
    const idx = ordem.findIndex((x) => x.id === atual.id);
    const prox = ordem[idx + 1] || ordem[idx - 1];
    setAberta(prox && prox.id !== atual.id ? prox : null);
  };

  // Atalhos com o painel de leitura aberto
  useEffect(() => {
    if (!aberta || dialogo) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.getAttribute("role") === "combobox")) return;
      const idx = ordem.findIndex((x) => x.id === aberta.id);
      const k = e.key.toLowerCase();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = ordem[idx + (e.key === "ArrowDown" ? 1 : -1)];
        if (n) setAberta(n);
      } else if (e.key === " ") {
        e.preventDefault(); alternar([aberta.id]);
      } else if (k === "l") {
        e.preventDefault();
        const atual = aberta;
        agir("lida", [atual.id]).then((ok) => ok && avancar(atual));
      } else if (k === "s") {
        e.preventDefault(); setDialogo({ tipo: "sem_providencia", ids: [aberta.id] });
      } else if (k === "a") {
        e.preventDefault(); setDialogo({ tipo: "atribuir", ids: [aberta.id] });
      } else if (k === "t") {
        e.preventDefault(); diasRef.current?.focus(); diasRef.current?.select();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, ordem, dialogo]);

  async function buscarAgora() {
    try {
      setCapturando("Iniciando…");
      const { data: oabs } = await supabase.from("controladoria_oabs").select("id, numero, uf, carga_inicial_feita").eq("ativo", true);
      if (!oabs?.length) { toast.error("Nenhuma OAB ativa na Configuração"); return; }
      try {
        setCapturando("Buscando no DJEN pelo servidor (São Paulo)…");
        const r = await capturarPeloServidor();
        toast.success(`${r.recebidas} comunicações conferidas, ${r.novas} novas`);
      } catch {
        const r = await capturarPeloNavegador(oabs as any, setCapturando);
        toast.success(`${r.recebidas} comunicações conferidas, ${r.novas} novas`);
      }
      recarregar();
    } catch (e: any) {
      toast.error(e?.message?.includes("Failed to fetch")
        ? "Não foi possível falar com o DJEN a partir deste navegador. Tente de novo em instantes."
        : (e?.message || "Falha na captura"));
    } finally {
      setCapturando(null);
    }
  }

  const selIds = [...sel];
  const todasFiltroMarcadas = filtrada.length > 0 && filtrada.every((i) => sel.has(i.id));
  const porId = useMemo(() => new Map((lista || []).map((i) => [i.id, i])), [lista]);

  const linha = (i: Intimacao, extra?: React.ReactNode) => (
    <div key={i.id} className={`flex items-center gap-2 px-3 hover:bg-muted/50 ${aberta?.id === i.id ? "bg-muted/60" : ""}`}>
      <Checkbox checked={sel.has(i.id)} onCheckedChange={() => alternar([i.id])} aria-label="Selecionar intimação" />
      <button className="flex-1 text-left py-3 flex flex-wrap gap-x-4 gap-y-1 items-center" onClick={() => setAberta(i)}>
        <span className="text-sm font-medium w-24">{brData(i.data_disponibilizacao)}</span>
        <Badge variant="outline">{i.sigla_tribunal}</Badge>
        <span className="font-mono text-xs">{i.numero_processo_mascara || i.numero_processo}</span>
        {extra}
        <span className="text-sm truncate max-w-xs">{i.clientes?.nome || (i.destinatarios || []).map((d: any) => d.nome).slice(0, 2).join(", ")}</span>
        <span className="text-xs text-muted-foreground">{i.tipo_comunicacao}</span>
        {i.prazo_sugerido_dias != null && <Badge variant="secondary">{i.prazo_sugerido_dias} dias (texto)</Badge>}
        {i.advbox_nao_cadastrado && <Badge variant="destructive">Fora do ADVBOX</Badge>}
        {(i as any).capturada_por === "nome" && <Badge variant="secondary">{seloNome(i)}</Badge>}
        {i.polo_cliente === "P" && <Badge variant="outline">Cliente réu</Badge>}
        {i.aviso_suspensao && <Badge variant="secondary">Recesso 20/12–20/01</Badge>}
        <span className="ml-auto text-xs">{nomeMembro(i.responsavel_id) || i.advbox_responsavel || ""}</span>
        <Badge variant={i.status_triagem === "nova" ? "default" : "outline"}>{SITUACOES[i.status_triagem]}</Badge>
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <UltimaBusca />
      <div className="flex flex-wrap gap-2 items-center">
        {FILAS.map((q) => (
          <Badge key={q.id} variant={fila === q.id ? "default" : "outline"} className="cursor-pointer" onClick={() => setFila(q.id)}>
            {q.label}: {contFila[q.id] || 0}
          </Badge>
        ))}
        <div className="ml-auto">
          <Button onClick={buscarAgora} disabled={!!capturando}>
            <RefreshCw className={`w-4 h-4 mr-2 ${capturando ? "animate-spin" : ""}`} />
            {capturando || "Buscar agora"}
          </Button>
        </div>
      </div>

      <Card className="p-3 grid gap-3 md:grid-cols-7">
        <div><Label htmlFor="f-de">De</Label><Input id="f-de" type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></div>
        <div><Label htmlFor="f-ate">Até</Label><Input id="f-ate" type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></div>
        <div>
          <Label>Tribunal</Label>
          <Select value={f.tribunal} onValueChange={(v) => setF({ ...f, tribunal: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {tribunais.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Situação</Label>
          <Select value={f.situacao} onValueChange={(v) => setF({ ...f, situacao: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {Object.entries(SITUACOES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Responsável (ADVBOX)</Label>
          <Select value={f.resp} onValueChange={(v) => setF({ ...f, resp: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {responsaveis.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="f-busca">Processo ou parte</Label><Input id="f-busca" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} /></div>
        <div className="flex flex-col gap-2 mt-5 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={f.foraAdvbox} onCheckedChange={(v) => setF({ ...f, foraAdvbox: !!v })} /> Fora do ADVBOX</label>
          <label className="flex items-center gap-2"><Switch checked={agrupar} onCheckedChange={setAgrupar} aria-label="Agrupar por processo" /> Agrupar por processo</label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={todasFiltroMarcadas} onCheckedChange={(v) => alternar(filtrada.map((i) => i.id), !!v)} />
          Selecionar todas do filtro ({filtrada.length})
        </label>
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-2 rounded-md border bg-card px-2 py-1">
            <span className="font-medium">{sel.size} selecionada{sel.size > 1 ? "s" : ""}</span>
            <Button size="sm" variant="outline" onClick={() => agir("lida", selIds)}>Marcar como lida</Button>
            <Button size="sm" variant="outline" onClick={() => agir("tratada_advbox", selIds)}>Tratada no ADVBOX</Button>
            <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "sem_providencia", ids: selIds })}>Sem providência</Button>
            <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "atribuir", ids: selIds })}>Atribuir responsável</Button>
            <Button size="sm" onClick={() => setDialogo({ tipo: "tarefa", ids: selIds })}>Gerar tarefas</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Limpar</Button>
          </div>
        )}
      </div>

      {isLoading ? <ListSkeleton /> : filtrada.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhuma intimação com esses filtros.</Card>
      ) : agrupar ? (
        <Card className="divide-y">
          {grupos.slice(0, 300).map(([k, itens]) => {
            if (itens.length === 1) return linha(itens[0]);
            const ids = itens.map((i) => i.id);
            const aberto = expandidos.has(k);
            return (
              <div key={k}>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                  <Checkbox checked={ids.every((id) => sel.has(id))} onCheckedChange={(v) => alternar(ids, !!v)} aria-label="Selecionar o processo inteiro" />
                  <button className="flex-1 flex items-center gap-3 text-left" onClick={() => setExpandidos((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}>
                    {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-mono text-xs">{itens[0].numero_processo_mascara || k}</span>
                    <Badge>{itens.length} intimações</Badge>
                    <span className="text-sm truncate max-w-xs">{itens[0].clientes?.nome || (itens[0].destinatarios || [])[0]?.nome}</span>
                    <span className="text-xs text-muted-foreground">últ. {brData(itens[0].data_disponibilizacao)}</span>
                  </button>
                </div>
                {aberto && <div className="divide-y pl-6">{itens.map((i) => linha(i))}</div>}
              </div>
            );
          })}
          {grupos.length > 300 && <p className="p-3 text-xs text-muted-foreground">Mostrando 300 de {grupos.length} processos. Use os filtros.</p>}
        </Card>
      ) : (
        <Card className="divide-y">
          {filtrada.slice(0, 500).map((i) => linha(i))}
          {filtrada.length > 500 && <p className="p-3 text-xs text-muted-foreground">Mostrando 500 de {filtrada.length}. Use os filtros.</p>}
        </Card>
      )}

      <Sheet open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {aberta && (
            <PainelIntimacao
              key={aberta.id}
              i={porId.get(aberta.id) || aberta}
              cal={cal}
              membros={members}
              nomeMembro={nomeMembro}
              diasRef={diasRef}
              marcada={sel.has(aberta.id)}
              onAgir={async (acao, payload) => {
                const atual = aberta;
                const ok = await agir(acao, [atual.id], payload);
                if (ok && acao !== "atribuir") avancar(atual);
                return ok;
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {dialogo && (
        <DialogoLote
          tipo={dialogo.tipo}
          itens={dialogo.ids.map((id) => porId.get(id)).filter(Boolean) as Intimacao[]}
          membros={members}
          uid={uid}
          cal={cal}
          onFechar={() => setDialogo(null)}
          onConfirmar={async (acao, payload) => {
            const ids = dialogo.ids;
            const atual = aberta && ids.length === 1 && ids[0] === aberta.id ? aberta : null;
            const ok = await agir(acao, ids, payload);
            if (ok) { setDialogo(null); if (atual && acao !== "atribuir") avancar(atual); }
          }}
        />
      )}
    </div>
  );
}

function DialogoLote({ tipo, itens, membros, uid, cal, onFechar, onConfirmar }: {
  tipo: "sem_providencia" | "atribuir" | "tarefa"; itens: Intimacao[];
  membros: { user_id: string; nome: string | null }[]; uid: string | null;
  cal: ReturnType<typeof montarCalendario>;
  onFechar: () => void; onConfirmar: (acao: Acao, payload: Record<string, unknown>) => Promise<void>;
}) {
  const sugestaoUnica = useMemo(() => {
    const s = [...new Set(itens.map((i) => i.prazo_sugerido_dias).filter((x) => x != null))];
    return s.length === 1 && itens.every((i) => i.prazo_sugerido_dias != null) ? String(s[0]) : "";
  }, [itens]);
  const [motivo, setMotivo] = useState("");
  const [resp, setResp] = useState(uid || "");
  const [dias, setDias] = useState(sugestaoUnica);
  const [enviando, setEnviando] = useState(false);
  const n = parseInt(dias, 10);
  const calculo = useMemo(() => (n > 0 ? itens.map((i) => ({ i, fatal: i.inicio_prazo ? cal.prazoFatal(i.inicio_prazo, n) : null })) : []), [itens, n, cal]);
  const semInicio = calculo.filter((c) => !c.fatal).length;
  const porData = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of calculo) if (c.fatal) m.set(c.fatal, (m.get(c.fatal) || 0) + 1);
    return [...m.entries()].sort();
  }, [calculo]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      if (tipo === "sem_providencia") await onConfirmar("sem_providencia", { motivo: motivo.trim() });
      else if (tipo === "atribuir") await onConfirmar("atribuir", { responsavel_id: resp });
      else {
        const fatais: Record<string, string> = {};
        for (const c of calculo) if (c.fatal) fatais[c.i.id] = c.fatal;
        await onConfirmar("tarefa", { dias: n, responsavel_id: resp || null, fatais });
      }
    } finally { setEnviando(false); }
  };

  const titulo = tipo === "sem_providencia" ? "Sem providência" : tipo === "atribuir" ? "Atribuir responsável" : "Gerar tarefas: conferência";
  const pode = tipo === "sem_providencia" ? !!motivo.trim() : tipo === "atribuir" ? !!resp : n > 0 && semInicio === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{titulo} ({itens.length})</DialogTitle></DialogHeader>
        {tipo === "sem_providencia" && (
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo (vale para todas)</Label>
            <Textarea id="motivo" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
        {(tipo === "atribuir" || tipo === "tarefa") && (
          <div className="space-y-1.5">
            <Label>{tipo === "tarefa" ? "Responsável das tarefas" : "Responsável"}</Label>
            <Select value={resp} onValueChange={setResp}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{membros.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome || "·"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {tipo === "tarefa" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dias-lote">Prazo em dias úteis (um só para todas)</Label>
              <div className="flex items-center gap-2">
                <Input id="dias-lote" type="number" min={1} className="w-28" value={dias} onChange={(e) => setDias(e.target.value)} autoFocus />
                {sugestaoUnica && dias === sugestaoUnica && <Badge variant="secondary">sugerido pelo texto</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">O prazo fatal de cada uma é contado a partir do início do prazo dela, no calendário da Controladoria.</p>
            </div>
            {n > 0 && (
              <div className="rounded border p-3 text-sm space-y-1 max-h-60 overflow-y-auto">
                <p className="font-medium">{itens.length - semInicio} tarefa{itens.length - semInicio === 1 ? "" : "s"} serão criadas:</p>
                {porData.map(([d, q]) => <p key={d}>{brData(d)}: {q} tarefa{q > 1 ? "s" : ""}</p>)}
                {semInicio > 0 && <p className="text-destructive">{semInicio} sem início do prazo: tire da seleção para continuar.</p>}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={enviando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!pode || enviando}>{enviando ? "Salvando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TextoDestacado({ texto, trecho }: { texto: string; trecho?: string | null }) {
  if (!trecho) return <>{texto}</>;
  const idx = texto.toLowerCase().indexOf(trecho.toLowerCase());
  if (idx < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <mark className="bg-accent/40 text-foreground rounded px-0.5" id="trecho-prazo">{texto.slice(idx, idx + trecho.length)}</mark>
      {texto.slice(idx + trecho.length)}
    </>
  );
}

function PainelIntimacao({ i, cal, membros, nomeMembro, diasRef, marcada, onAgir }: {
  i: Intimacao; cal: ReturnType<typeof montarCalendario>;
  membros: { user_id: string; nome: string | null }[]; nomeMembro: (id?: string | null) => string | null;
  diasRef: React.RefObject<HTMLInputElement>; marcada: boolean;
  onAgir: (acao: Acao, payload?: Record<string, unknown>) => Promise<boolean>;
}) {
  const { data: texto } = useQuery({
    queryKey: ["djen_texto", i.id],
    queryFn: async () => (await supabase.from("djen_comunicacoes").select("texto").eq("id", i.id).single()).data?.texto as string,
  });
  const sugerido = i.prazo_sugerido_dias != null ? String(i.prazo_sugerido_dias) : "";
  const [obs, setObs] = useState("");
  const [dias, setDias] = useState<string>(i.prazo_dias ? String(i.prazo_dias) : sugerido);
  const [resp, setResp] = useState<string>(i.responsavel_id || "");
  const [salvando, setSalvando] = useState(false);
  const n = parseInt(dias, 10);
  const fatal = i.inicio_prazo && n > 0 ? cal.prazoFatal(i.inicio_prazo, n) : null;

  useEffect(() => {
    if (texto && i.prazo_sugerido_trecho) setTimeout(() => document.getElementById("trecho-prazo")?.scrollIntoView({ block: "center" }), 50);
  }, [texto, i.prazo_sugerido_trecho]);

  const rodar = async (acao: Acao, payload?: Record<string, unknown>) => {
    setSalvando(true);
    try { await onAgir(acao, payload); } finally { setSalvando(false); }
  };

  const gerarTarefa = () => fatal && rodar("tarefa", { dias: n, responsavel_id: resp || null, fatais: { [i.id]: fatal } });

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle className="font-mono text-base flex items-center gap-2">
          {i.numero_processo_mascara || i.numero_processo}
          {marcada && <Badge variant="secondary">selecionada</Badge>}
          <Badge variant={i.status_triagem === "nova" ? "default" : "outline"}>{SITUACOES[i.status_triagem]}</Badge>
        </SheetTitle>
      </SheetHeader>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground rounded border px-2 py-1">
        <Keyboard className="w-3.5 h-3.5" />
        <span><kbd>↑</kbd>/<kbd>↓</kbd> navegar</span><span><kbd>L</kbd> lida</span><span><kbd>S</kbd> sem providência</span>
        <span><kbd>T</kbd> tarefa</span><span><kbd>A</kbd> atribuir</span><span><kbd>Espaço</kbd> marcar</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-muted-foreground">Tribunal:</span> {i.sigla_tribunal} · {i.nome_orgao}</div>
        <div><span className="text-muted-foreground">Classe:</span> {i.nome_classe}</div>
        <div><span className="text-muted-foreground">Disponibilização:</span> {brData(i.data_disponibilizacao)}</div>
        <div><span className="text-muted-foreground">Publicação:</span> {brData(i.data_publicacao)}</div>
        <div><span className="text-muted-foreground">Início do prazo:</span> {brData(i.inicio_prazo)}</div>
        <div><span className="text-muted-foreground">Tipo:</span> {i.tipo_comunicacao}</div>
        <div><span className="text-muted-foreground">ADVBOX:</span> {i.advbox_lawsuit_id ? `processo ${i.advbox_lawsuit_id}` : i.advbox_nao_cadastrado ? "processo não cadastrado no ADVBOX" : "ainda não conferido"}</div>
        <div><span className="text-muted-foreground">Responsável:</span> {nomeMembro(i.responsavel_id) || "·"}{i.advbox_responsavel ? ` (ADVBOX: ${i.advbox_responsavel})` : ""}</div>
        <div className="col-span-2"><span className="text-muted-foreground">Cliente:</span> {i.clientes?.nome ? `${i.clientes.nome} (polo ${i.polo_cliente === "A" ? "ativo" : i.polo_cliente === "P" ? "passivo" : "?"})` : "não identificado"}</div>
        <div className="col-span-2"><span className="text-muted-foreground">Partes:</span> {(i.destinatarios || []).map((d: any) => `${d.nome} (${d.polo})`).join("; ")}</div>
        {i.observacao && <div className="col-span-2"><span className="text-muted-foreground">Observação:</span> {i.observacao}</div>}
      </div>
      {i.aviso_suspensao && (
        <div className="flex gap-2 items-start text-sm p-2 rounded border border-accent bg-accent/10">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> Período de 20/12 a 20/01: prazos suspensos (CPC art. 220). Confira a contagem.
        </div>
      )}
      {i.prazo_sugerido_multiplo && (
        <div className="flex gap-2 items-start text-sm p-2 rounded border border-accent bg-accent/10">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> Mais de um prazo no texto: nenhum prazo foi sugerido. Leia e informe.
        </div>
      )}
      {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="text-sm underline inline-flex items-center gap-1">Abrir no tribunal <ExternalLink className="w-3 h-3" /></a>}
      <div className="rounded border p-3 text-sm whitespace-pre-wrap max-h-[40vh] overflow-y-auto bg-muted/30">
        {texto ? <TextoDestacado texto={texto} trecho={i.prazo_sugerido_trecho} /> : "Carregando…"}
      </div>

      <div className="space-y-3 border-t pt-3">
        <div><Label htmlFor="obs">Observação / motivo</Label><Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <Label htmlFor="dias" className="flex items-center gap-1">Prazo (dias úteis)</Label>
            <Input id="dias" ref={diasRef} type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") gerarTarefa(); }} />
            {sugerido && dias === sugerido && <Badge variant="secondary" className="mt-1">sugerido pelo texto</Badge>}
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={resp} onValueChange={setResp}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{membros.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.nome || "·"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="text-sm">Prazo fatal: <strong>{fatal ? brData(fatal) : "·"}</strong></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={gerarTarefa} disabled={salvando || !fatal}>Gerar tarefa</Button>
          <Button variant="outline" disabled={salvando} onClick={() => rodar("lida")}>Marcar lida</Button>
          <Button variant="outline" disabled={salvando} onClick={() => rodar("tratada_advbox")}>Tratada no ADVBOX</Button>
          <Button variant="outline" disabled={salvando || !resp || resp === i.responsavel_id} onClick={() => rodar("atribuir", { responsavel_id: resp })}>Atribuir</Button>
          <Button variant="ghost" disabled={salvando} onClick={() => {
            if (!obs.trim()) { toast.error("Escreva o motivo na observação"); return; }
            rodar("sem_providencia", { motivo: obs.trim() });
          }}>Sem providência</Button>
        </div>
      </div>
    </div>
  );
}
