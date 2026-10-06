import { useEffect, useMemo, useState } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { Link } from "react-router-dom";
import { TimelineCliente } from "@/components/cliente/TimelineCliente";
import { ProcessosJudiciaisCliente } from "@/components/cliente/ProcessosJudiciaisCliente";
import { CadastroSaudeBadge } from "@/components/cliente/CadastroSaudeBadge";
import {
  Building2,
  Gavel,
  FileText,
  CalendarClock,
  CircleDollarSign,
  Star,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ExternalLink,
  Loader2,
  Scale,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFaseLabel, getFaseBadgeColor } from "@/data/mockProcessos";

interface Props {
  produtor: string;
  /** Quando embutido em página, esconde o cabeçalho (que já existe na página) */
  hideHeader?: boolean;
  /** Callback opcional quando navega para um processo (útil para fechar drawers) */
  onNavigate?: () => void;
}

interface ProcessoRow {
  id: string;
  fase_atual: string;
  created_at: string;
  laudo: { dados_etapa1: any } | null;
}
interface ContratoRow {
  id: string;
  banco: string | null;
  numero_contrato: string | null;
  valor_total_operacao: number | null;
  valor_parcela: number | null;
  vencimento_proxima_parcela: string | null;
  parcelas_vencidas: boolean | null;
  resolvido: boolean;
}
interface MovRow {
  id: string;
  processo_id: string;
  tipo: string;
  descricao: string;
  created_at: string;
}
interface PeticaoRow {
  id: string;
  processo_id: string | null;
  tipo: string;
  titulo: string;
  status: string;
}

function brl(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function adimplenciaBadge(status: string, vip: boolean) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    adimplente: { label: "Adimplente", cls: "bg-success/10 text-success border-success/30", Icon: ShieldCheck },
    parcial: { label: "Parcialmente adimplente", cls: "bg-accent/10 text-accent border-accent/30", Icon: ShieldAlert },
    inadimplente: { label: "Inadimplente", cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: ShieldX },
  };
  const c = map[status] || map.adimplente;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${c.cls}`}>
        <c.Icon className="w-3.5 h-3.5" /> {c.label}
      </span>
      {vip && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-500/10 text-yellow-700 border border-yellow-500/30">
          <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" /> VIP
        </span>
      )}
    </div>
  );
}

const LIMINAR_TIPOS = new Set([
  "liminar_concedida",
  "liminar_negada",
  "decisao",
  "sentenca_procedente",
  "sentenca_improcedente",
  "acordo_homologado",
]);

function tipoLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function tipoBadge(t: string) {
  if (t.includes("concedida") || t.includes("procedente") || t === "acordo_homologado")
    return "bg-success/10 text-success border-success/30";
  if (t.includes("negada") || t.includes("improcedente"))
    return "bg-destructive/10 text-destructive border-destructive/30";
  return "bg-info/10 text-info border-info/30";
}

export function PerfilCliente360({ produtor, hideHeader, onNavigate }: Props) {
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState<any | null>(null);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [movs, setMovs] = useState<MovRow[]>([]);
  const [peticoes, setPeticoes] = useState<PeticaoRow[]>([]);

  useEffect(() => {
    if (!produtor) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const nome = produtor.trim();
        const norm = (s: string) =>
          (s || "")
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
        const target = norm(nome);

        const [cliRes, ctsRes, prRes] = await Promise.all([
          supabase
            .from("clientes")
            .select("id,nome,cpf_cnpj,grupo,vip,status_adimplencia,municipio,uf,cultura_principal,nome_propriedade,telefone,email")
            .is("deleted_at", null),
          lerTudo(() => supabase
            .from("contratos_vencimentos")
            .select("id,nome_cliente,banco,numero_contrato,valor_total_operacao,valor_parcela,vencimento_proxima_parcela,parcelas_vencidas,resolvido")
            .is("deleted_at", null)),
          lerTudo(() => supabase
            .from("processos")
            .select("id,fase_atual,created_at,laudos!inner(dados_etapa1)")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })),
        ]);

        const cli = ((cliRes.data || []) as any[]).find((c) => norm(c.nome) === target) || null;
        const cts = ((ctsRes.data || []) as any[]).filter((c) => norm(c.nome_cliente) === target);
        const pr = prRes.data || [];

        // Operações de crédito (Radar/fechamento) também aparecem como contratos do cliente
        if (cli?.id) {
          const { data: opsData } = await supabase
            .from("operacoes_credito" as any)
            .select("id,banco,numero,vence_em,saldo_devedor,notificado_em,dispensar_alerta")
            .eq("cliente_id", cli.id)
            .is("deleted_at", null);
          for (const o of (opsData || []) as any[]) {
            const jaExiste = cts.some(
              (c: any) => (c.numero_contrato || "").trim() === (o.numero || "").trim(),
            );
            if (jaExiste) continue;
            const venc = o.vence_em ? new Date(o.vence_em + "T12:00:00") : null;
            cts.push({
              id: `op-${o.id}`,
              banco: o.banco,
              numero_contrato: o.numero,
              valor_total_operacao: o.saldo_devedor,
              valor_parcela: null,
              vencimento_proxima_parcela: o.vence_em,
              parcelas_vencidas: venc ? venc.getTime() < Date.now() : false,
              resolvido: !!o.notificado_em,
            });
          }
        }

        const filteredProc = ((pr || []) as any[])
          .filter((p) => {
            const d1 = p.laudos?.dados_etapa1 || {};
            const n = norm(d1.produtor || d1.nomeProdutor || d1.nome || "");
            return n === target;
          })
          .map((p) => ({
            id: p.id,
            fase_atual: p.fase_atual,
            created_at: p.created_at,
            laudo: { dados_etapa1: p.laudos?.dados_etapa1 || {} },
          })) as ProcessoRow[];

        const procIds = filteredProc.map((p) => p.id);
        let movsData: MovRow[] = [];
        let petData: PeticaoRow[] = [];
        if (procIds.length > 0) {
          const [m, pet] = await Promise.all([
            supabase
              .from("movimentacoes")
              .select("id,processo_id,tipo,descricao,created_at")
              .in("processo_id", procIds)
              .is("deleted_at", null)
              .order("created_at", { ascending: false }),
            supabase
              .from("peticoes")
              .select("id,processo_id,tipo,titulo,status")
              .in("processo_id", procIds)
              .is("deleted_at", null),
          ]);
          movsData = (m.data || []) as MovRow[];
          petData = (pet.data || []) as PeticaoRow[];
        }

        if (cancelled) return;
        setCliente(cli);
        setContratos((cts || []) as ContratoRow[]);
        setProcessos(filteredProc);
        setMovs(movsData);
        setPeticoes(petData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [produtor]);

  const grupos = useMemo(() => {
    const map = new Map<string, { banco: string; contratos: ContratoRow[]; processos: ProcessoRow[] }>();
    const getKey = (s: string | null | undefined) => (s || "Sem banco").trim();
    for (const c of contratos) {
      const k = getKey(c.banco);
      const g = map.get(k) || { banco: k, contratos: [], processos: [] };
      g.contratos.push(c);
      map.set(k, g);
    }
    for (const p of processos) {
      const k = getKey(p.laudo?.dados_etapa1?.banco);
      const g = map.get(k) || { banco: k, contratos: [], processos: [] };
      g.processos.push(p);
      map.set(k, g);
    }
    return Array.from(map.values()).sort((a, b) => a.banco.localeCompare(b.banco));
  }, [contratos, processos]);

  const movsByProc = useMemo(() => {
    const m = new Map<string, MovRow[]>();
    for (const mv of movs) {
      const arr = m.get(mv.processo_id) || [];
      arr.push(mv);
      m.set(mv.processo_id, arr);
    }
    return m;
  }, [movs]);

  const petsByProc = useMemo(() => {
    const m = new Map<string, PeticaoRow[]>();
    for (const p of peticoes) {
      if (!p.processo_id) continue;
      const arr = m.get(p.processo_id) || [];
      arr.push(p);
      m.set(p.processo_id, arr);
    }
    return m;
  }, [peticoes]);

  const totalContratos = contratos.length;
  const contratosAbertos = contratos.filter((c) => !c.resolvido);
  const contratosVencidos = contratos.filter((c) => c.parcelas_vencidas && !c.resolvido);
  const totalVencidos = contratosVencidos.length;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const contratosVencendo30d = contratosAbertos.filter((c) => {
    if (!c.vencimento_proxima_parcela) return false;
    const d = new Date(c.vencimento_proxima_parcela);
    const diff = (d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  const totalSaldo = contratos.reduce((s, c) => s + (c.valor_total_operacao || 0), 0);
  const saldoAberto = contratosAbertos.reduce((s, c) => s + (c.valor_total_operacao || 0), 0);

  const statusCalculado: "adimplente" | "parcial" | "inadimplente" =
    contratos.length === 0
      ? (cliente?.status_adimplencia || "adimplente")
      : totalVencidos === 0
        ? "adimplente"
        : totalVencidos === contratosAbertos.length && contratosAbertos.length > 0
          ? "inadimplente"
          : "parcial";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando perfil...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
            {produtor.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{produtor}</h2>
            <p className="text-xs text-muted-foreground">Visão 360: processos por banco, contratos, andamento judicial e adimplência.</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {adimplenciaBadge(statusCalculado, !!cliente?.vip)}
          <div className="text-xs text-muted-foreground text-right">
            {cliente?.nome_propriedade && <div>{cliente.nome_propriedade}</div>}
            {cliente?.municipio && <div>{cliente.municipio}/{cliente.uf}</div>}
            {cliente?.cultura_principal && <div>Cultura: {cliente.cultura_principal}</div>}
          </div>
        </div>
        <div className="mt-3">
          <CadastroSaudeBadge cliente={cliente} />
        </div>
        {contratos.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Calculado de {contratos.length} contrato(s): {totalVencidos} vencido(s), {contratosAbertos.length - totalVencidos} em dia.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-md bg-secondary/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Processos</p>
            <p className="text-lg font-semibold text-foreground">{processos.length}</p>
          </div>
          <div className="rounded-md bg-secondary/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contratos</p>
            <p className="text-lg font-semibold text-foreground">
              {totalContratos}
              {contratosAbertos.length !== totalContratos && (
                <span className="text-xs text-muted-foreground font-normal"> ({contratosAbertos.length} aberto)</span>
              )}
            </p>
          </div>
          <div className="rounded-md bg-secondary/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo em aberto</p>
            <p className="text-sm font-semibold text-foreground">{brl(saldoAberto)}</p>
            {saldoAberto !== totalSaldo && (
              <p className="text-[10px] text-muted-foreground">de {brl(totalSaldo)} total</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {totalVencidos > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/30">
              <ShieldX className="w-3 h-3" /> {totalVencidos} vencido(s)
            </span>
          )}
          {contratosVencendo30d > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium bg-accent/10 text-accent border border-accent/30">
              <CalendarClock className="w-3 h-3" /> {contratosVencendo30d} vencendo em 30 dias
            </span>
          )}
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-border rounded-lg">
          <Scale className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum processo ou contrato encontrado para este produtor.</p>
        </div>
      ) : (
        grupos.map((g) => (
          <div key={g.banco} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/30 border-b border-border">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">{g.banco}</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {g.processos.length} proc · {g.contratos.length} contr
              </span>
            </div>

            {g.contratos.length > 0 && (
              <div className="px-4 py-3 border-b border-border/60">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contratos</p>
                <div className="space-y-2">
                  {g.contratos.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-md bg-background border border-border/60">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {c.numero_contrato || "(sem nº)"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><CircleDollarSign className="w-3 h-3" /> {brl(c.valor_total_operacao)}</span>
                          {c.valor_parcela != null && <span>· Parcela {brl(c.valor_parcela)}</span>}
                          {c.vencimento_proxima_parcela && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {new Date(c.vencimento_proxima_parcela).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      {c.parcelas_vencidas && !c.resolvido && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/30">
                          Vencido
                        </span>
                      )}
                      {c.resolvido && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success border border-success/30">
                          Resolvido
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {g.processos.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Processos & andamento</p>
                <div className="space-y-3">
                  {g.processos.map((p) => {
                    const faseNum = Number(p.fase_atual) as 1 | 2 | 3 | 4 | 5;
                    const procMovs = movsByProc.get(p.id) || [];
                    const decisoes = procMovs.filter((m) => LIMINAR_TIPOS.has(m.tipo));
                    const procPets = petsByProc.get(p.id) || [];
                    const d1 = p.laudo?.dados_etapa1 || {};
                    return (
                      <div key={p.id} className="rounded-md border border-border p-3 bg-background">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`status-badge ${getFaseBadgeColor(faseNum)}`}>
                              {getFaseLabel(faseNum)}
                            </span>
                            {d1.contratos?.length > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {d1.contratos.length} contrato(s) no laudo
                              </span>
                            )}
                          </div>
                          <Link
                            to={`/processos/${p.id}`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            onClick={() => onNavigate?.()}
                          >
                            Abrir <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>

                        {decisoes.length > 0 && (
                          <div className="space-y-1.5 mb-2">
                            {decisoes.slice(0, 3).map((m) => (
                              <div key={m.id} className="flex items-start gap-2">
                                <Gavel className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tipoBadge(m.tipo)}`}>
                                    {tipoLabel(m.tipo)}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground ml-2">
                                    {new Date(m.created_at).toLocaleDateString("pt-BR")}
                                  </span>
                                  {m.descricao && (
                                    <p className="text-xs text-foreground/80 mt-0.5 line-clamp-2">{m.descricao}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {procPets.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/60">
                            {procPets.map((pet) => (
                              <span key={pet.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-info/10 text-info border border-info/30">
                                <FileText className="w-3 h-3" /> {pet.titulo || tipoLabel(pet.tipo)} · {pet.status}
                              </span>
                            ))}
                          </div>
                        )}

                        {decisoes.length === 0 && procPets.length === 0 && (
                          <p className="text-[11px] text-muted-foreground italic">Sem decisões judiciais ou petições registradas.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))
      )}
      <ProcessosJudiciaisCliente clienteId={cliente?.id} />
      <TimelineCliente nomeCliente={produtor} />
    </div>
  );
}