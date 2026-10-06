import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2, AlertCircle, Save, UserCheck, ChevronDown, ChevronRight, MessageSquare,
  Copy, ShieldCheck, Cloud, Settings2, RefreshCw, Archive, Gavel,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { checarSegredo } from "@/lib/semSegredos";
import { upsertClienteFromLaudo } from "@/lib/upsertCliente";
import { concluirOnboardingNoWorkflow } from "@/lib/workflow";
import { GarantiasEstrategiaDialog } from "@/components/radar/GarantiasEstrategiaDialog";
import {
  ETAPAS, ITENS_TEMPLATE, MODULOS_OPCIONAIS, PESSOA_PADRAO, RESPOSTAS_PADRAO, STATUS_LABEL,
  TEXTO_GOVBR, ATIVIDADES, REAPROVEITADOS_ETAPA4, gerarItens,
  TIPOS_PROCESSO, tiposAtivos, labelTipoProcesso,
  CHECKLIST_URGENCIA, PRIORITARIO_URGENCIA,
  type RespostasOnboarding, type StatusItem, type Titular, type OperacaoRef,
} from "@/data/onboardingAgroTemplate";

type Execucao = {
  id: string;
  tipo: string;
  status: string;
  numero_processo: string | null;
  vara: string | null;
  sistema: string | null;
  operacao_id: string | null;
  cliente_id: string | null;
  motivo_encerramento: string | null;
};

type Citacao = {
  id: string;
  execucao_id: string;
  cliente_id: string | null;
  pessoa_nome: string;
  papel: string;
  citado: boolean;
  data_juntada: string | null;
  advbox_lancado_em: string | null;
};


type Item = {
  id: string;
  chave: string | null;
  etapa: number;
  nivel: "pessoa" | "familia" | "operacao";
  origem: "cliente" | "escritorio";
  obrigatorio: boolean;
  nome_simples: string | null;
  documento: string;
  titular_cliente_id: string | null;
  titular_nome: string | null;
  operacao_id: string | null;
  operacao_label: string | null;
  status: string;
  ordem: number;
  data_recebimento: string | null;
  observacoes: string | null;
  anexo_nome: string | null;
  motivo_dispensa: string | null;
  conferido_em: string | null;
  arquivado_em: string | null;
};

type Onboarding = {
  id: string;
  organizacao_id: string | null;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_contato: string | null;
  grupo: string | null;
  status: string;
  observacoes: string | null;
  iniciado_em: string;
  etapa_atual: number;
  respostas: any;
  modulos_opcionais: any;
};

const statusCor: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground border-border",
  recebido: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  conferido: "bg-primary/15 text-primary border-primary/30",
  nao_aplica: "bg-muted text-muted-foreground border-border",
  dispensado: "bg-muted text-muted-foreground border-border",
};

const RESOLVIDOS = ["conferido", "nao_aplica", "dispensado"];

export default function PosVendaOnboardingDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = usePapelRadar();

  const [ob, setOb] = useState<Onboarding | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [arquivados, setArquivados] = useState<Item[]>([]);
  const [titulares, setTitulares] = useState<Titular[]>([]);
  const [operacoes, setOperacoes] = useState<OperacaoRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [obs, setObs] = useState("");
  const [aberta, setAberta] = useState<number>(1);
  const [verArquivados, setVerArquivados] = useState(false);
  const [verRestoUrgencia, setVerRestoUrgencia] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  const [perguntasOpen, setPerguntasOpen] = useState(false);
  const [resp, setResp] = useState<RespostasOnboarding>({ pessoas: {}, ...RESPOSTAS_PADRAO });
  const [gerando, setGerando] = useState(false);

  const [dispensarItem, setDispensarItem] = useState<Item | null>(null);
  const [motivo, setMotivo] = useState("");
  const [conferirItem, setConferirItem] = useState<Item | null>(null);

  const [govbrItem, setGovbrItem] = useState<Item | null>(null);
  const [garantiasOp, setGarantiasOp] = useState<{ id: string; numero: string; banco: string } | null>(null);
  const [govbrForma, setGovbrForma] = useState("cliente_presente");

  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [citacoes, setCitacoes] = useState<Citacao[]>([]);
  const [encerrarExec, setEncerrarExec] = useState<Execucao | null>(null);
  const [motivoEnc, setMotivoEnc] = useState("");

  const [pedirOpen, setPedirOpen] = useState(false);

  const carregar = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: o }, { data: i }] = await Promise.all([
      supabase.from("pos_venda_onboardings").select("*").eq("id", id).maybeSingle(),
      supabase.from("pos_venda_checklist_itens").select("*").eq("onboarding_id", id).order("etapa").order("ordem"),
    ]);
    const onb = o as any as Onboarding | null;
    setOb(onb);
    setObs(onb?.observacoes || "");
    setAberta(onb?.etapa_atual || 1);
    const todos = ((i as any[]) || []) as Item[];
    setItens(todos.filter((x) => !x.arquivado_em));
    setArquivados(todos.filter((x) => !!x.arquivado_em));

    if (onb) {
      const grupo = onb.grupo || onb.cliente_nome;
      const { data: cls } = await supabase
        .from("clientes")
        .select("id, nome, grupo")
        .is("deleted_at", null)
        .or(`grupo.eq.${grupo},nome.eq.${onb.cliente_nome}`);
      let lista = ((cls as any[]) || []).map((c) => ({ id: c.id, nome: c.nome }));
      if (!lista.length && onb.cliente_id) lista = [{ id: onb.cliente_id, nome: onb.cliente_nome }];
      setTitulares(lista);

      const ids = lista.map((t) => t.id);
      if (ids.length) {
        const { data: ops } = await supabase
          .from("operacoes_credito")
          .select("id, banco, numero, cliente_id")
          .in("cliente_id", ids)
          .is("deleted_at", null);
        setOperacoes(((ops as any[]) || []).map((op) => ({ id: op.id, label: `${op.banco || "Banco"} nº ${op.numero || "—"}` })));
      } else {
        setOperacoes([]);
      }

      const r = onb.respostas && Object.keys(onb.respostas).length
        ? { ...RESPOSTAS_PADRAO, ...onb.respostas, pessoas: onb.respostas.pessoas || {} }
        : { pessoas: {}, ...RESPOSTAS_PADRAO };
      setResp(r as RespostasOnboarding);
      if (!todos.some((x) => !x.arquivado_em)) setPerguntasOpen(true);

      // Processos e cobranças em andamento (módulo de execução).
      const { data: execs } = await supabase
        .from("cliente_execucoes")
        .select("id, tipo, status, numero_processo, vara, sistema, operacao_id, cliente_id, motivo_encerramento")
        .or(`onboarding_id.eq.${onb.id}${ids.length ? `,cliente_id.in.(${ids.join(",")})` : ""}`)
        .order("created_at");
      const listaExec = ((execs as any[]) || []) as Execucao[];
      setExecucoes(listaExec);
      const execIds = listaExec.map((e) => e.id);
      if (execIds.length) {
        const { data: cits } = await supabase
          .from("execucao_citacoes")
          .select("id, execucao_id, cliente_id, pessoa_nome, papel, citado, data_juntada, advbox_lancado_em")
          .in("execucao_id", execIds);
        setCitacoes(((cits as any[]) || []) as Citacao[]);
      } else {
        setCitacoes([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [id]);

  const pessoaResp = (tid: string) => resp.pessoas?.[tid] || PESSOA_PADRAO;
  const setPessoa = (tid: string, patch: Partial<typeof PESSOA_PADRAO>) =>
    setResp((r) => ({ ...r, pessoas: { ...r.pessoas, [tid]: { ...pessoaResp(tid), ...patch } } }));

  /** Cria/atualiza os itens a partir das respostas, sem duplicar nem apagar o que já tem status. */
  const sincronizar = async () => {
    if (!ob) return;
    setGerando(true);
    const gerados = gerarItens(resp, titulares, operacoes);
    const chaveDe = (x: { chave: string | null; titular_cliente_id: string | null; operacao_id: string | null }) =>
      `${x.chave}|${x.titular_cliente_id || ""}|${x.operacao_id || ""}`;
    const existentes = new Set(itens.map(chaveDe));
    const novos = gerados.filter((g) => !existentes.has(chaveDe(g)));

    if (novos.length) {
      const { error } = await supabase.from("pos_venda_checklist_itens").insert(
        novos.map((g) => ({
          onboarding_id: ob.id,
          organizacao_id: ob.organizacao_id,
          categoria: `etapa_${g.etapa}`,
          categoria_label: ETAPAS[g.etapa - 1].titulo,
          documento: g.documento,
          nome_simples: g.nome_simples,
          chave: g.chave,
          etapa: g.etapa,
          nivel: g.nivel,
          origem: g.origem,
          obrigatorio: g.obrigatorio,
          titular_cliente_id: g.titular_cliente_id,
          titular_nome: g.titular_nome,
          operacao_id: g.operacao_id,
          operacao_label: g.operacao_label,
          ordem: g.ordem,
          prioridade: g.obrigatorio ? "ESSENCIAL" : "CONDICIONAL",
          status: "pendente",
        })) as any,
      );
      if (error) {
        setGerando(false);
        toast({ title: "Erro ao gerar o checklist", description: error.message, variant: "destructive" });
        return;
      }
    }

    // Itens que deixaram de se aplicar e ainda estão pendentes são arquivados.
    const validos = new Set(gerados.map(chaveDe));
    const sobrando = itens.filter((x) => x.chave && !validos.has(chaveDe(x)) && x.status === "pendente");
    if (sobrando.length) {
      await supabase.from("pos_venda_checklist_itens")
        .update({ arquivado_em: new Date().toISOString() } as any)
        .in("id", sobrando.map((s) => s.id));
    }

    // Módulo "Garantias e execução": liga os tipos novos. Desligar é só do administrador.
    const ativosResp = tiposAtivos(resp.processos);
    const execAtivas = execucoes.filter((e) => e.status === "ativo");
    const retirados = execAtivas.filter((e) => !ativosResp.includes(e.tipo));
    if (retirados.length && !isAdmin) {
      setGerando(false);
      toast({
        title: "Só o administrador desliga o módulo",
        description: "Peça ao Willian para encerrar a execução com motivo.",
        variant: "destructive",
      });
      return;
    }
    const tiposNovos = ativosResp.filter((t) => !execAtivas.some((e) => e.tipo === t));
    if (tiposNovos.length) {
      const alvos: (string | null)[] = operacoes.length ? operacoes.map((o) => o.id) : [null];
      const linhas: any[] = [];
      tiposNovos.forEach((tipo) =>
        alvos.forEach((opId) =>
          linhas.push({
            organizacao_id: ob.organizacao_id,
            onboarding_id: ob.id,
            cliente_id: ob.cliente_id,
            operacao_id: opId,
            grupo: ob.grupo || ob.cliente_nome,
            tipo,
            status: "ativo",
            created_by: user?.id || null,
          }),
        ),
      );
      const { error: errExec } = await supabase.from("cliente_execucoes").insert(linhas as any);
      if (errExec) {
        toast({ title: "Erro ao ligar o módulo de execução", description: errExec.message, variant: "destructive" });
      } else {
        await avisarExecucao(tiposNovos);
      }
    }

    await supabase.from("pos_venda_onboardings")
      .update({
        respostas: resp as any,
        grupo: ob.grupo || ob.cliente_nome,
        modulos_opcionais: { ...(ob.modulos_opcionais || {}), garantias_execucao: ativosResp.length > 0 } as any,
      } as any)
      .eq("id", ob.id);

    setGerando(false);
    setPerguntasOpen(false);
    toast({ title: "Checklist atualizado", description: `${novos.length} item(ns) criado(s).` });
    carregar();
  };

  const patchItem = async (item: Item, patch: Partial<Item>) => {
    setItens((arr) => arr.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("pos_venda_checklist_itens").update(patch as any).eq("id", item.id);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
  };

  const mudarStatus = (item: Item, novo: StatusItem) => {
    if (novo === "dispensado") { setDispensarItem(item); setMotivo(""); return; }
    if (novo === "conferido") { setConferirItem(item); return; }
    if (item.chave === "govbr_acesso" && novo === "recebido") { setGovbrItem(item); return; }
    patchItem(item, {
      status: novo,
      data_recebimento: novo === "recebido" ? new Date().toISOString().slice(0, 10) : item.data_recebimento,
      conferido_em: null,
    } as any);
    // Cédula recebida: abre o preenchimento rápido das garantias daquela operação.
    if (item.chave === "cedula_contrato" && novo === "recebido" && item.operacao_id) {
      setGarantiasOp({ id: item.operacao_id, numero: item.operacao_label || "", banco: "" });
    }
  };

  const confirmarConferido = async () => {
    const it = conferirItem;
    if (!it) return;
    setConferirItem(null);
    await patchItem(it, {
      status: "conferido",
      conferido_em: new Date().toISOString(),
      data_recebimento: it.data_recebimento || new Date().toISOString().slice(0, 10),
      ...(user ? { conferido_por: user.id } : {}),
    } as any);
  };

  const confirmarDispensa = async () => {
    const it = dispensarItem;
    if (!it || !motivo.trim()) return;
    const seg = checarSegredo(motivo);
    if (seg) { toast({ title: "Texto não permitido", description: seg, variant: "destructive" }); return; }
    setDispensarItem(null);
    await patchItem(it, { status: "dispensado", motivo_dispensa: motivo.trim() } as any);
  };

  const registrarGovbr = async () => {
    const it = govbrItem;
    if (!it || !ob) return;
    setGovbrItem(null);
    await supabase.from("pos_venda_govbr_acessos").insert({
      organizacao_id: ob.organizacao_id,
      onboarding_id: ob.id,
      cliente_id: it.titular_cliente_id,
      titular_nome: it.titular_nome,
      forma: govbrForma,
      conduzido_por: user?.id || null,
      nivel_conta: it.titular_cliente_id ? pessoaResp(it.titular_cliente_id).govbr : null,
    } as any);
    await patchItem(it, { status: "recebido", data_recebimento: new Date().toISOString().slice(0, 10) } as any);
    toast({ title: "Acesso gov.br registrado", description: "Guardamos só data, forma, quem conduziu e finalidade." });
  };

  /** Avisa Willian e Vitoria (quem protocola) sobre um marco do módulo de execução. */
  const avisarProtocolo = async (mensagem: string) => {
    const { data: perfis } = await supabase.from("profiles_publico").select("id, nome");
    const alvos = ((perfis as any[]) || [])
      .filter((p) => ["willian", "vitoria"].some((n) => (p.nome || "").toLowerCase().includes(n)))
      .map((p) => p.id);
    for (const uid of alvos) {
      await supabase.from("notificacoes_sistema").insert({ user_id: uid, mensagem, tipo: "urgente" } as any);
    }
  };

  const avisarExecucao = async (tipos: string[]) => {
    for (const t of tipos) {
      await avisarProtocolo(
        `⚠️ Cliente com ${labelTipoProcesso(t).toLowerCase()} em andamento — ${ob?.grupo || ob?.cliente_nome || ""}`,
      );
    }
  };

  const patchExec = async (e: Execucao, patch: Partial<Execucao>) => {
    setExecucoes((arr) => arr.map((x) => (x.id === e.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("cliente_execucoes").update(patch as any).eq("id", e.id);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
  };

  const confirmarEncerramento = async () => {
    const e = encerrarExec;
    if (!e || !motivoEnc.trim()) return;
    const { error } = await supabase
      .from("cliente_execucoes")
      .update({ status: "encerrado", motivo_encerramento: motivoEnc.trim() } as any)
      .eq("id", e.id);
    setEncerrarExec(null);
    setMotivoEnc("");
    if (error) toast({ title: "Não foi possível encerrar", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Execução encerrada", description: "A operação volta à regra normal do radar." });
      carregar();
    }
  };

  /** Registra a situação da citação de um executado e cobra o lançamento no ADVBOX. */
  const salvarCitacao = async (
    exec: Execucao,
    pessoa: Titular,
    patch: { citado?: boolean; data_juntada?: string | null },
  ) => {
    const atual = citacoes.find((c) => c.execucao_id === exec.id && c.cliente_id === pessoa.id);
    const eraCitado = !!atual?.citado;
    if (atual) {
      setCitacoes((arr) => arr.map((c) => (c.id === atual.id ? { ...c, ...patch } as Citacao : c)));
      await supabase.from("execucao_citacoes").update(patch as any).eq("id", atual.id);
    } else {
      const { data } = await supabase
        .from("execucao_citacoes")
        .insert({
          organizacao_id: ob?.organizacao_id,
          execucao_id: exec.id,
          cliente_id: pessoa.id,
          pessoa_nome: pessoa.nome,
          papel: "executado",
          citado: patch.citado ?? false,
          data_juntada: patch.data_juntada ?? null,
          created_by: user?.id || null,
        } as any)
        .select("id, execucao_id, cliente_id, pessoa_nome, papel, citado, data_juntada, advbox_lancado_em")
        .single();
      if (data) setCitacoes((arr) => [...arr, data as any as Citacao]);
    }
    const virouCitado = !eraCitado && (patch.citado ?? atual?.citado);
    const data = patch.data_juntada ?? atual?.data_juntada ?? null;
    if (virouCitado && data) {
      const [y, m, d] = data.split("-");
      await avisarProtocolo(
        `🚨 Citação registrada em ${d}/${m} — ${pessoa.nome}. Lançar prazo de defesa no ADVBOX.`,
      );
      toast({ title: "Citação registrada", description: "Lançar o prazo de defesa no ADVBOX." });
    }
  };

  const marcarAdvbox = async (c: Citacao) => {
    const agora = new Date().toISOString();
    setCitacoes((arr) => arr.map((x) => (x.id === c.id ? { ...x, advbox_lancado_em: agora } : x)));
    await supabase
      .from("execucao_citacoes")
      .update({ advbox_lancado_em: agora, advbox_lancado_por: user?.id || null } as any)
      .eq("id", c.id);
    toast({ title: "Registrado", description: "Prazo marcado como lançado no ADVBOX." });
  };

  const salvarObs = async () => {
    if (!ob) return;
    const seg = checarSegredo(obs);
    if (seg) { toast({ title: "Texto não permitido", description: seg, variant: "destructive" }); return; }
    const { error } = await supabase.from("pos_venda_onboardings").update({ observacoes: obs }).eq("id", ob.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Observações salvas" });
  };

  /** Encerra o onboarding: marca concluído, atualiza a ficha do cliente e libera o workflow. */
  const marcarConcluido = async () => {
    if (!ob || concluindo) return;
    setConcluindo(true);
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("pos_venda_onboardings")
      .update({ status: "concluido", concluido_em: agora } as any)
      .eq("id", ob.id);
    if (error) {
      setConcluindo(false);
      toast({ title: "Erro ao concluir", description: error.message, variant: "destructive" });
      return;
    }
    setOb({ ...ob, status: "concluido" });
    try {
      if (user?.id) {
        await upsertClienteFromLaudo(user.id, {
          nome: ob.cliente_nome,
          telefone: ob.cliente_contato || undefined,
        });
      }
      await concluirOnboardingNoWorkflow(ob.cliente_nome, ob.cliente_id);
    } catch {
      // best-effort: o onboarding já está concluído
    }
    setConcluindo(false);
    toast({ title: "Onboarding concluído", description: "As próximas etapas foram liberadas no workflow." });
  };

  const toggleModulo = async (key: string, val: boolean) => {
    if (!ob) return;
    const mods = { ...(ob.modulos_opcionais || {}), [key]: val };
    setOb({ ...ob, modulos_opcionais: mods });
    await supabase.from("pos_venda_onboardings").update({ modulos_opcionais: mods as any } as any).eq("id", ob.id);
  };

  const definirEtapaAtual = async (n: number) => {
    setAberta(n);
    if (ob && ob.etapa_atual !== n) {
      setOb({ ...ob, etapa_atual: n });
      await supabase.from("pos_venda_onboardings").update({ etapa_atual: n } as any).eq("id", ob.id);
    }
  };

  const porEtapa = useMemo(() => {
    const m = new Map<number, Item[]>();
    [1, 2, 3, 4, 5].forEach((e) => m.set(e, itens.filter((i) => i.etapa === e)));
    return m;
  }, [itens]);

  const progresso = (e: number) => {
    const lista = porEtapa.get(e) || [];
    const ok = lista.filter((i) => RESOLVIDOS.includes(i.status)).length;
    return { total: lista.length, ok, pct: lista.length ? Math.round((ok / lista.length) * 100) : 0 };
  };

  const avisoEtapa4 = useMemo(() => {
    const faltas: string[] = [];
    const feito = (chave: string) => itens.some((i) => i.chave === chave && RESOLVIDOS.includes(i.status));
    if (!feito("laudo_perda")) faltas.push("laudo de perda");
    if (!feito("laudo_capacidade")) faltas.push("laudo de capacidade");
    if (!feito("comprovante_envio")) faltas.push("comprovante do pedido administrativo");
    return faltas;
  }, [itens]);

  const execAtivas = useMemo(() => execucoes.filter((e) => e.status === "ativo"), [execucoes]);
  const opsEmExecucao = useMemo(
    () => new Map(execAtivas.filter((e) => e.operacao_id).map((e) => [e.operacao_id as string, e])),
    [execAtivas],
  );
  const moduloExecucao = execAtivas.length > 0;

  const textoPedido = useMemo(() => {
    const lista = (porEtapa.get(aberta) || []).filter((i) => i.origem === "cliente" && i.status === "pendente");
    if (!lista.length) return "";
    const familia = lista.filter((i) => i.nivel === "familia");
    const operacao = lista.filter((i) => i.nivel === "operacao");
    const porPessoa = new Map<string, Item[]>();
    lista.filter((i) => i.nivel === "pessoa").forEach((i) => {
      const k = i.titular_nome || "Titular";
      porPessoa.set(k, [...(porPessoa.get(k) || []), i]);
    });

    let txt = `Olá! Para seguirmos com o pedido junto ao banco, precisamos destes documentos:\n`;
    porPessoa.forEach((its, nome) => {
      txt += `\n*${nome}*\n` + its.map((i) => `• ${i.nome_simples || i.documento}`).join("\n") + "\n";
    });
    if (familia.length) txt += `\n*Da propriedade / família*\n` + familia.map((i) => `• ${i.nome_simples || i.documento}`).join("\n") + "\n";
    if (operacao.length) {
      const grupos = new Map<string, Item[]>();
      operacao.forEach((i) => { const k = i.operacao_label || "Contrato"; grupos.set(k, [...(grupos.get(k) || []), i]); });
      grupos.forEach((its, label) => {
        txt += `\n*${label}*\n` + its.map((i) => `• ${i.nome_simples || i.documento}`).join("\n") + "\n";
      });
    }
    const govbrPend = (porEtapa.get(aberta) || []).some(
      (i) => (i.chave === "govbr_acesso" || i.chave === "autorizacao_govbr" || i.chave === "govbr_regularizar") && i.status === "pendente",
    );
    if (govbrPend) txt += `\n${TEXTO_GOVBR}\n`;
    txt += `\nQualquer dúvida, é só chamar aqui. Obrigado!`;
    return txt;
  }, [porEtapa, aberta]);

  if (loading) return <AppLayout><p className="p-12 text-center text-muted-foreground">Carregando...</p></AppLayout>;
  if (!ob) return <AppLayout><p className="p-12 text-center text-muted-foreground">Onboarding não encontrado.</p></AppLayout>;

  const renderItem = (it: Item) => (
    <div key={it.id} className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-[200px] flex-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm font-medium cursor-help">{it.nome_simples || it.documento}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{it.documento}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {it.titular_nome && <Badge variant="outline" className="text-[10px]">{it.titular_nome}</Badge>}
            {it.operacao_label && <Badge variant="outline" className="text-[10px]">{it.operacao_label}</Badge>}
            {!it.obrigatorio && <Badge variant="outline" className="text-[10px]">Se houver</Badge>}
            <Badge variant="outline" className={`text-[10px] ${statusCor[it.status] || ""}`}>
              {STATUS_LABEL[it.status as StatusItem] || it.status}
            </Badge>
          </div>
          {it.chave === "govbr_regularizar" && (
            <p className="text-[11px] text-amber-700 mt-1">Cliente precisa subir a conta antes do pós-venda.</p>
          )}
          {it.motivo_dispensa && <p className="text-[11px] text-muted-foreground mt-1">Dispensado: {it.motivo_dispensa}</p>}
          {it.conferido_em && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Conferido em {new Date(it.conferido_em).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={it.status} onValueChange={(v) => mudarStatus(it, v as StatusItem)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="conferido">Conferido</SelectItem>
              <SelectItem value="nao_aplica">Não se aplica</SelectItem>
              <SelectItem value="dispensado">Dispensado</SelectItem>
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" variant="outline" disabled className="h-8">
                    <Cloud className="w-3.5 h-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Marcar a partir de arquivo do OneDrive — disponível quando o OneDrive for reconectado.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <Input
        value={it.observacoes || ""}
        onChange={(e) => setItens((arr) => arr.map((x) => (x.id === it.id ? { ...x, observacoes: e.target.value } : x)))}
        onBlur={(e) => {
          const seg = checarSegredo(e.target.value);
          if (seg) {
            toast({ title: "Texto não permitido", description: seg, variant: "destructive" });
            setItens((arr) => arr.map((x) => (x.id === it.id ? { ...x, observacoes: it.observacoes } : x)));
            return;
          }
          patchItem(it, { observacoes: e.target.value || null });
        }}
        placeholder="Observação (nunca senhas ou códigos do cliente)"
        className="h-8 text-xs"
      />
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          backTo="/pos-venda/onboarding"
          breadcrumb={[
            { label: "Pós-Venda" },
            { label: "Onboarding", to: "/pos-venda/onboarding" },
            { label: ob.grupo || ob.cliente_nome },
          ]}
          title={ob.grupo || ob.cliente_nome}
          subtitle={`${titulares.length} titular(es) · ${operacoes.length} contrato(s) · iniciado em ${new Date(ob.iniciado_em).toLocaleDateString("pt-BR")}`}
          actions={
            <>
              <Button variant="outline" onClick={() => setPerguntasOpen(true)}>
                <Settings2 className="w-4 h-4 mr-2" /> Perguntas iniciais
              </Button>
              <Button variant="outline" onClick={() => setPedirOpen(true)}>
                <MessageSquare className="w-4 h-4 mr-2" /> Pedir ao cliente
              </Button>
              <Button variant="outline" onClick={() => navigate(`/clientes/${encodeURIComponent(ob.cliente_nome)}`)}>
                <UserCheck className="w-4 h-4 mr-2" /> Ficha do cliente
              </Button>
              {ob.status === "concluido" ? (
                <Badge className="text-[11px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Concluído
                </Badge>
              ) : (
                <Button onClick={marcarConcluido} disabled={concluindo}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {concluindo ? "Concluindo..." : "Concluir onboarding"}
                </Button>
              )}
            </>
          }
        />

        <Card className="p-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            O sistema não guarda senha, código ou login do gov.br do cliente. Registramos apenas data, forma do
            acesso, quem conduziu, finalidade e nível da conta.
          </span>
        </Card>

        {ETAPAS.map((e) => {
          const p = progresso(e.etapa);
          const lista = porEtapa.get(e.etapa) || [];
          const doCliente = lista.filter((i) => i.origem === "cliente");
          const doEscritorio = lista.filter((i) => i.origem === "escritorio");
          // A etapa de execução só aparece quando há processo ou cobrança; fica sempre aberta.
          if (e.etapa === 5 && !moduloExecucao && !lista.length) return null;
          const open = e.etapa === 5 ? true : aberta === e.etapa;
          return (
            <Card key={e.etapa} className={`overflow-hidden ${e.etapa === 5 ? "border-destructive/50" : ""}`}>
              <button
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40"
                onClick={() => e.etapa !== 5 && definirEtapaAtual(open ? 0 : e.etapa)}
              >
                {e.etapa === 5
                  ? <Gavel className="w-4 h-4 text-destructive" />
                  : open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div className="flex-1 min-w-0">
                  <div className="font-serif font-semibold">
                    Etapa {e.etapa} — {e.titulo}
                    <span className="ml-2 text-xs font-sans font-normal text-muted-foreground">{e.quem}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden max-w-md">
                    <div className="h-full bg-primary" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{p.ok}/{p.total}</span>
              </button>

              {open && (
                <div className="border-t p-4 space-y-4">
                  {e.etapa === 4 && avisoEtapa4.length > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Ainda falta no fluxo: {avisoEtapa4.join(", ")}.</span>
                    </div>
                  )}
                  {e.etapa === 4 && (
                    <p className="text-xs text-muted-foreground">
                      Imposto de renda e notas de venda da etapa 3 contam automaticamente aqui.
                      {REAPROVEITADOS_ETAPA4.length ? "" : ""}
                    </p>
                  )}

                  {e.etapa === 2 && execAtivas.length > 0 && (
                    <div className="space-y-2">
                      {Array.from(opsEmExecucao.entries()).map(([opId, ex]) => (
                        <div key={opId} className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            Há {labelTipoProcesso(ex.tipo).toLowerCase()} em curso
                            {ex.numero_processo ? ` — processo nº ${ex.numero_processo}` : " — processo nº a informar"}
                            {" "}({operacoes.find((o) => o.id === opId)?.label || "contrato"}). Alinhar o pedido com a defesa.
                          </span>
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground">
                        O pedido de prorrogação segue normalmente: a execução corre em paralelo e não bloqueia o protocolo.
                      </p>
                    </div>
                  )}

                  {e.etapa === 5 && (
                    <div className="space-y-3">
                      {execAtivas.map((ex) => (
                        <div key={ex.id} className="rounded-md border border-destructive/40 p-3 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-destructive text-destructive-foreground">{labelTipoProcesso(ex.tipo)}</Badge>
                              {ex.operacao_id && (
                                <Badge variant="outline" className="text-[10px]">
                                  {operacoes.find((o) => o.id === ex.operacao_id)?.label || "Contrato"}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isAdmin}
                              title={isAdmin ? undefined : "Só o administrador encerra o módulo, com motivo"}
                              onClick={() => { setEncerrarExec(ex); setMotivoEnc(""); }}
                            >
                              Encerrar
                            </Button>
                          </div>

                          <div className="grid sm:grid-cols-3 gap-2">
                            <Input
                              className="h-8 text-xs"
                              placeholder="Número do processo"
                              defaultValue={ex.numero_processo || ""}
                              onBlur={(ev) => patchExec(ex, { numero_processo: ev.target.value || null })}
                            />
                            <Input
                              className="h-8 text-xs"
                              placeholder="Vara / comarca"
                              defaultValue={ex.vara || ""}
                              onBlur={(ev) => patchExec(ex, { vara: ev.target.value || null })}
                            />
                            <Input
                              className="h-8 text-xs"
                              placeholder="Sistema (PROJUDI, eproc...)"
                              defaultValue={ex.sistema || ""}
                              onBlur={(ev) => patchExec(ex, { sistema: ev.target.value || null })}
                            />
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Citação dos executados</h4>
                            {titulares.map((t) => {
                              const c = citacoes.find((x) => x.execucao_id === ex.id && x.cliente_id === t.id);
                              return (
                                <div key={t.id} className="flex flex-wrap items-center gap-2 text-xs border rounded-md p-2">
                                  <span className="flex-1 min-w-[160px]">{t.nome}</span>
                                  <label className="flex items-center gap-1.5">
                                    <Checkbox
                                      checked={!!c?.citado}
                                      onCheckedChange={(v) => salvarCitacao(ex, t, { citado: !!v })}
                                    />
                                    Citado
                                  </label>
                                  <Input
                                    type="date"
                                    className="h-8 w-[150px] text-xs"
                                    value={c?.data_juntada || ""}
                                    onChange={(ev) => salvarCitacao(ex, t, { data_juntada: ev.target.value || null, citado: true })}
                                    aria-label={`Data da juntada do mandado de ${t.nome}`}
                                  />
                                  {c?.citado && c?.data_juntada && !c.advbox_lancado_em && (
                                    <>
                                      <span className="text-destructive font-semibold">Lançar prazo de defesa no ADVBOX</span>
                                      <Button size="sm" variant="outline" className="h-7" onClick={() => marcarAdvbox(c)}>
                                        Lancei no ADVBOX
                                      </Button>
                                    </>
                                  )}
                                  {c?.advbox_lancado_em && (
                                    <Badge variant="outline" className="text-[10px]">
                                      ADVBOX em {new Date(c.advbox_lancado_em).toLocaleDateString("pt-BR")}
                                    </Badge>
                                  )}
                                  {!c?.citado && (
                                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700">
                                      Acompanhar citação
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {ex.tipo === "consolidacao" && (
                            <p className="text-[11px] text-destructive">
                              Ao registrar a notificação do cartório: prazo para purgar a mora — lançar no ADVBOX.
                            </p>
                          )}
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground">
                        O app não calcula prazo processual: o controle oficial é o ADVBOX. Aqui só registramos o marco e cobramos o lançamento.
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground">O cliente precisa mandar</h3>
                      {!doCliente.length && (
                        <p className="text-xs text-muted-foreground">Nada pendente com o cliente nesta etapa.</p>
                      )}
                      {doCliente.length > 0 && !resp.urgente && doCliente.map(renderItem)}
                      {doCliente.length > 0 && resp.urgente && (() => {
                        const minimos = doCliente.filter((i) => CHECKLIST_URGENCIA.includes(i.chave || ""));
                        const resto = doCliente.filter((i) => !CHECKLIST_URGENCIA.includes(i.chave || ""));
                        return (
                          <>
                            {minimos.length > 0 && (
                              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                                <p className="text-[11px] font-semibold uppercase text-destructive">
                                  Mínimo de urgência — peça só isto agora
                                </p>
                                {minimos.map((i) => (
                                  <div key={i.id}>
                                    {i.chave === PRIORITARIO_URGENCIA && (
                                      <Badge className="mb-1 bg-destructive text-destructive-foreground text-[10px]">
                                        Prioritário — identifica as operações
                                      </Badge>
                                    )}
                                    {renderItem(i)}
                                  </div>
                                ))}
                              </div>
                            )}
                            {resto.length > 0 && (
                              <div className="space-y-2">
                                <button
                                  className="flex items-center gap-2 text-xs text-muted-foreground"
                                  onClick={() => setVerRestoUrgencia((v) => !v)}
                                >
                                  {verRestoUrgencia ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  Resto do checklist — {resto.length} itens (depois)
                                </button>
                                {verRestoUrgencia && resto.map(renderItem)}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground">O escritório produz</h3>
                      {doEscritorio.length ? doEscritorio.map(renderItem)
                        : <p className="text-xs text-muted-foreground">Nenhum marco do escritório nesta etapa.</p>}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {isAdmin && (
          <Card className="p-4 space-y-3">
            <div>
              <Label className="text-sm font-semibold">Módulos opcionais</Label>
              <p className="text-xs text-muted-foreground mt-1">Desligados por padrão. Só o administrador liga, caso a caso.</p>
            </div>
            {MODULOS_OPCIONAIS.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3 border rounded-md p-3">
                <div>
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
                <Switch checked={!!(ob.modulos_opcionais || {})[m.key]} onCheckedChange={(v) => toggleModulo(m.key, v)} />
              </div>
            ))}
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Observações gerais do onboarding</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3}
            placeholder="Contexto do cliente, combinados, pendências de relacionamento. Nunca senhas ou códigos." />
          <Button size="sm" variant="outline" onClick={salvarObs}><Save className="w-4 h-4 mr-2" />Salvar observações</Button>
        </Card>

        {arquivados.length > 0 && (
          <Card className="p-4">
            <button className="flex items-center gap-2 text-sm text-muted-foreground" onClick={() => setVerArquivados((v) => !v)}>
              <Archive className="w-4 h-4" />
              Checklist antigo (arquivado) — {arquivados.length} itens
              {verArquivados ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {verArquivados && (
              <div className="mt-3 space-y-1 max-h-96 overflow-auto">
                {arquivados.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-xs border-b py-1.5">
                    <span className="truncate">{a.documento}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {a.anexo_nome && <Badge variant="outline" className="text-[10px]">{a.anexo_nome}</Badge>}
                      <span className="text-muted-foreground">{a.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Perguntas iniciais */}
      <Dialog open={perguntasOpen} onOpenChange={setPerguntasOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Perguntas iniciais</DialogTitle>
            <DialogDescription>Definem quais documentos serão pedidos. Podem ser alteradas depois.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {titulares.map((t) => {
              const p = pessoaResp(t.id);
              return (
                <div key={t.id} className="border rounded-md p-3 space-y-2">
                  <div className="text-sm font-medium">{t.nome}</div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Select value={p.tipo} onValueChange={(v) => setPessoa(t.id, { tipo: v as any })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pf">Pessoa física</SelectItem>
                        <SelectItem value="pj">Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={p.casado ? "sim" : "nao"} onValueChange={(v) => setPessoa(t.id, { casado: v === "sim" })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Casado(a) ou união estável</SelectItem>
                        <SelectItem value="nao">Solteiro(a)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={p.govbr} onValueChange={(v) => setPessoa(t.id, { govbr: v as any })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Conta gov.br" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bronze">gov.br bronze</SelectItem>
                        <SelectItem value="prata">gov.br prata</SelectItem>
                        <SelectItem value="ouro">gov.br ouro</SelectItem>
                        <SelectItem value="sem">Não tem conta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">A terra é</Label>
                <Select value={resp.terra} onValueChange={(v) => setResp((r) => ({ ...r, terra: v as any }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="propria">Própria</SelectItem>
                    <SelectItem value="arrendada">Arrendada / parceria</SelectItem>
                    <SelectItem value="ambos">Os dois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Enquadramento</Label>
                <Select value={resp.enquadramento} onValueChange={(v) => setResp((r) => ({ ...r, enquadramento: v as any }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pronaf">Pronaf</SelectItem>
                    <SelectItem value="pronamp">Pronamp</SelectItem>
                    <SelectItem value="demais">Demais produtores</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Atividades</Label>
              <div className="flex flex-wrap gap-3">
                {ATIVIDADES.map((a) => (
                  <label key={a.key} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={resp.atividades.includes(a.key)}
                      onCheckedChange={(v) =>
                        setResp((r) => ({
                          ...r,
                          atividades: v ? [...r.atividades, a.key] : r.atividades.filter((x) => x !== a.key),
                        }))
                      }
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {[
                { k: "evento_climatico", label: "Houve evento climático com decreto no município?" },
                { k: "seguro", label: "Tem seguro agrícola ou PROAGRO?" },
                { k: "justica_gratuita", label: "Vai pedir justiça gratuita?" },
              ].map((q) => (
                <div key={q.k} className="flex items-center justify-between gap-3 border rounded-md p-2.5">
                  <span className="text-xs">{q.label}</span>
                  <Switch
                    checked={!!(resp as any)[q.k]}
                    onCheckedChange={(v) => setResp((r) => ({ ...r, [q.k]: v } as any))}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1 border-t pt-3">
              <Label className="text-xs">Tem processo ou cobrança em andamento contra o cliente?</Label>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {TIPOS_PROCESSO.map((t) => (
                  <label key={t.key} className="flex items-start gap-1.5 text-xs">
                    <Checkbox
                      checked={(resp.processos || []).includes(t.key)}
                      onCheckedChange={(v) =>
                        setResp((r) => {
                          const atual = r.processos || [];
                          if (!v) return { ...r, processos: atual.filter((x) => x !== t.key) };
                          if (t.key === "nao" || t.key === "nao_sei") return { ...r, processos: [t.key] };
                          return { ...r, processos: [...atual.filter((x) => x !== "nao" && x !== "nao_sei"), t.key] };
                        })
                      }
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
              {!isAdmin && execAtivas.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Já há execução ligada: só o Willian pode desligar, com motivo.
                </p>
              )}
            </div>
          </div>



          <DialogFooter>
            <Button variant="outline" onClick={() => setPerguntasOpen(false)}>Cancelar</Button>
            <Button onClick={sincronizar} disabled={gerando}>
              <RefreshCw className="w-4 h-4 mr-2" />{gerando ? "Gerando..." : "Salvar e atualizar checklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conferir */}
      <Dialog open={!!conferirItem} onOpenChange={(o) => !o && setConferirItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar conferência</DialogTitle>
            <DialogDescription>
              Confirmo que abri o arquivo, está legível, é do cliente certo e corresponde a
              "{conferirItem?.nome_simples || conferirItem?.documento}". Fica registrado quem conferiu e quando.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConferirItem(null)}>Cancelar</Button>
            <Button onClick={confirmarConferido}><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispensar */}
      <Dialog open={!!dispensarItem} onOpenChange={(o) => !o && setDispensarItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispensar documento</DialogTitle>
            <DialogDescription>Escreva o motivo da dispensa. Fica registrado no item.</DialogDescription>
          </DialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: contrato liquidado, documento não existe para esta safra..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispensarItem(null)}>Cancelar</Button>
            <Button onClick={confirmarDispensa} disabled={!motivo.trim()}>Dispensar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acesso gov.br */}
      <Dialog open={!!govbrItem} onOpenChange={(o) => !o && setGovbrItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar acesso gov.br</DialogTitle>
            <DialogDescription>
              Só registramos o fato: data de hoje, forma, quem conduziu e a finalidade (Registrato, imposto de renda e CAR).
              Nunca senha, código ou login do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Como foi feito</Label>
            <Select value={govbrForma} onValueChange={setGovbrForma}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente_presente">Cliente presente na reunião</SelectItem>
                <SelectItem value="codigo_na_hora">Código de verificação passado pelo cliente na hora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGovbrItem(null)}>Cancelar</Button>
            <Button onClick={registrarGovbr}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pedir ao cliente */}
      <Dialog open={pedirOpen} onOpenChange={setPedirOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedir ao cliente</DialogTitle>
            <DialogDescription>Mensagem pronta com os pendentes da etapa {aberta || ob.etapa_atual}.</DialogDescription>
          </DialogHeader>
          {textoPedido ? (
            <Textarea value={textoPedido} readOnly rows={14} className="text-xs" />
          ) : (
            <p className="text-sm text-muted-foreground">Não há documentos pendentes com o cliente nesta etapa.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedirOpen(false)}>Fechar</Button>
            <Button
              disabled={!textoPedido}
              onClick={() => { navigator.clipboard.writeText(textoPedido); toast({ title: "Texto copiado" }); }}
            >
              <Copy className="w-4 h-4 mr-2" />Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encerrar execução */}
      <Dialog open={!!encerrarExec} onOpenChange={(o) => !o && setEncerrarExec(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar {encerrarExec ? labelTipoProcesso(encerrarExec.tipo).toLowerCase() : "execução"}</DialogTitle>
            <DialogDescription>
              Escreva o motivo (acordo, extinção, pagamento ou suspensão). A operação volta à regra normal do radar.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={motivoEnc} onChange={(ev) => setMotivoEnc(ev.target.value)} rows={3}
            placeholder="Ex.: acordo homologado em 10/03/2026" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarExec(null)}>Cancelar</Button>
            <Button onClick={confirmarEncerramento} disabled={!motivoEnc.trim()}>Encerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <GarantiasEstrategiaDialog
        open={!!garantiasOp}
        onOpenChange={(v) => !v && setGarantiasOp(null)}
        operacao={garantiasOp}
      />
    </AppLayout>
  );
}
