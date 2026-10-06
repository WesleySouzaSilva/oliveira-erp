import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Tractor, Shield, Building2, Crown, MessageCircle, Save, FileText } from "lucide-react";
import { SalvarPropostaDialog } from "@/components/consultoria/SalvarPropostaDialog";

type TipoCliente = "urbana" | "rural";

interface Plano {
  id: string;
  nome: string;
  precoBase: number;
  faixa: string;
  icon: any;
  badge?: string;
  exclusivoRural?: boolean;
  entregaveis: string[];
  entregueePor: string;
  naoIncluso?: string;
}

const PLANOS: Plano[] = [
  {
    id: "agro",
    nome: "Plano Agro",
    precoBase: 1200,
    faixa: "R$ 1.000 – R$ 1.500",
    icon: Tractor,
    badge: "Exclusivo rural",
    exclusivoRural: true,
    entregaveis: [
      "Informativo diário de notícias agro (WhatsApp ou e-mail)",
      "Workshop jurídico bimestral coletivo",
      "Visita bimestral na propriedade (até 50km incluso)",
      "Até 3 consultas jurídicas/mês",
      "Revisão de até 2 contratos rurais/mês",
      "Notificação extrajudicial simples inclusa",
      "Acompanhamento de até 2 processos judiciais",
      "Demandas ativas com proveito econômico: êxito negociado",
    ],
    entregueePor: "Crystian ou Willian (visitas) + Cezar (assessoria diária)",
  },
  {
    id: "essencial",
    nome: "Essencial",
    precoBase: 1500,
    faixa: "R$ 1.200 – R$ 1.800",
    icon: Shield,
    entregaveis: [
      "1 reunião mensal até 1h (Cezar)",
      "Até 3 consultas jurídicas/mês",
      "Revisão de até 2 contratos simples/mês",
      "Alertas regulatórios do setor",
      "Acompanhamento de até 3 processos judiciais",
      "Notificação extrajudicial simples inclusa",
      "Diligências e cartório (custas do cliente)",
      "Demandas ativas com proveito econômico: êxito negociado",
    ],
    naoIncluso: "Análise de riscos, intermediação de cobranças, reunião com Crystian",
    entregueePor: "Cezar — Squad Empresarial",
  },
  {
    id: "empresarial",
    nome: "Empresarial",
    precoBase: 2800,
    faixa: "R$ 2.500 – R$ 3.500 + variável",
    icon: Building2,
    badge: "Mais contratado",
    entregaveis: [
      "2 reuniões mensais até 1h (Cezar)",
      "Consultas jurídicas ilimitadas",
      "Revisão de até 5 contratos/mês (inclusive complexos)",
      "1 reunião trimestral estratégica com Crystian",
      "Desconto de 15% em demandas avulsas",
      "Acompanhamento de até 7 processos judiciais",
      "Notificação extrajudicial simples inclusa",
      "Diligências e cartório (custas do cliente)",
      "Demandas ativas com proveito econômico: êxito negociado",
      "Análise de riscos de negócios semestral",
      "Intermediação de cobranças: fixo + 10% sobre valor recuperado",
    ],
    entregueePor: "Cezar (operação) + Crystian (estratégia trimestral)",
  },
  {
    id: "estrategico",
    nome: "Estratégico",
    precoBase: 5500,
    faixa: "R$ 4.500 – R$ 7.000 + variável",
    icon: Crown,
    entregaveis: [
      "Reuniões mensais ilimitadas (Cezar)",
      "Consultas jurídicas ilimitadas — prioridade máxima",
      "Contratos ilimitados, inclusive negociação com terceiros",
      "1 reunião mensal estratégica com Crystian",
      "Desconto de 20% em demandas avulsas",
      "Acompanhamento de processos ilimitado",
      "Notificação extrajudicial simples inclusa",
      "Diligências e cartório (custas do cliente)",
      "Demandas ativas com proveito econômico: êxito negociado",
      "Análise de riscos de negócios trimestral contínua",
      "Intermediação de cobranças: fixo + 10% sobre valor recuperado",
    ],
    entregueePor: "Cezar (operação) + Crystian (estratégia mensal)",
  },
];

const COMPLEXIDADES = [
  { id: "simples", label: "Simples", fator: 1.0, desc: "1 CNPJ, operação única, sem litígios relevantes" },
  { id: "medio", label: "Médio", fator: 1.2, desc: "2–3 CNPJs ou múltiplos setores de atuação" },
  { id: "complexo", label: "Complexo", fator: 1.5, desc: "Grupo empresarial, vários CNPJs e processos ativos" },
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ConsultoriaEmpresarial() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [nomeCliente, setNomeCliente] = useState("");
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>("urbana");
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [complexidadeId, setComplexidadeId] = useState("simples");
  const [valorCredito, setValorCredito] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [propostaOpen, setPropostaOpen] = useState(false);

  // Prefill a partir de uma proposta salva (?proposta=<id>)
  useEffect(() => {
    const id = searchParams.get("proposta");
    if (!id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("consultoria_propostas")
        .select("inputs")
        .eq("id", id)
        .maybeSingle();
      const inp = data?.inputs;
      if (!inp) return;
      if (typeof inp.nomeCliente === "string") setNomeCliente(inp.nomeCliente);
      if (inp.tipoCliente === "urbana" || inp.tipoCliente === "rural") setTipoCliente(inp.tipoCliente);
      if (typeof inp.planoId === "string") setPlanoId(inp.planoId);
      if (typeof inp.complexidadeId === "string") setComplexidadeId(inp.complexidadeId);
      if (typeof inp.valorCredito === "number") setValorCredito(inp.valorCredito);
      toast({ title: "Proposta carregada no simulador" });
    })();
  }, [searchParams]);

  const planosVisiveis = useMemo(
    () => (tipoCliente === "rural" ? PLANOS : PLANOS.filter((p) => !p.exclusivoRural)),
    [tipoCliente],
  );

  const plano = PLANOS.find((p) => p.id === planoId) ?? null;
  const isAgro = plano?.id === "agro";
  const complexidade = COMPLEXIDADES.find((c) => c.id === complexidadeId)!;
  const fator = isAgro ? 1.0 : complexidade.fator;
  const mensalidadeFinal = plano ? Math.round(plano.precoBase * fator) : 0;

  const mostraCobranca = plano?.id === "empresarial" || plano?.id === "estrategico";
  const credito = valorCredito ?? 0;
  const exitoEstimado = mostraCobranca ? credito * 0.1 : 0;

  const podeAgir = nomeCliente.trim().length > 0 && !!plano;
  const mostrarResultado = podeAgir;

  const handleTipoChange = (t: TipoCliente) => {
    setTipoCliente(t);
    if (t === "urbana" && planoId === "agro") setPlanoId(null);
  };

  const mensagemWhats = () => {
    if (!plano) return "";
    const linhas: string[] = [];
    linhas.push("*Proposta de Consultoria — Oliveira Advogados*");
    linhas.push("");
    linhas.push(`Cliente: ${nomeCliente.trim()}`);
    linhas.push(`Tipo: ${tipoCliente === "rural" ? "Empresa rural / Agronegócio" : "Empresa urbana"}`);
    linhas.push(`Plano: ${plano.nome}`);
    const linhaMens = `Mensalidade: ${fmtBRL(mensalidadeFinal)}` +
      (!isAgro && fator !== 1.0 ? ` (complexidade ${complexidade.label} ${fator}×)` : "");
    linhas.push(linhaMens);
    if (mostraCobranca && credito > 0) {
      linhas.push("");
      linhas.push("Simulação intermediação de cobrança:");
      linhas.push(`Crédito: ${fmtBRL(credito)} → Êxito estimado: ${fmtBRL(exitoEstimado)}`);
    }
    linhas.push("");
    linhas.push("_Oliveira Advogados — Castro/PR_");
    return linhas.join("\n");
  };

  const enviarWhats = () => {
    if (!podeAgir) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagemWhats())}`, "_blank", "noopener,noreferrer");
  };

  const propostaInputs = {
    nomeCliente: nomeCliente.trim(),
    tipoCliente,
    planoId,
    complexidadeId,
    valorCredito,
  };
  const propostaResultado = plano ? {
    plano: plano.nome,
    valor_base: plano.precoBase,
    fator_complexidade: fator,
    valor_mensalidade_final: mensalidadeFinal,
    valor_credito_cobranca: mostraCobranca && credito > 0 ? credito : null,
    honorario_exito_estimado: mostraCobranca && credito > 0 ? exitoEstimado : null,
  } : {};

  const salvar = async () => {
    if (!podeAgir || !user || !plano) return;
    setSalvando(true);
    try {
      const { data: membro } = await supabase
        .from("membros")
        .select("organizacao_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("consultoria_simulacoes").insert({
        cliente_nome: nomeCliente.trim(),
        tipo_cliente: tipoCliente,
        plano: plano.nome,
        valor_base: plano.precoBase,
        fator_complexidade: fator,
        valor_mensalidade_final: mensalidadeFinal,
        valor_credito_cobranca: mostraCobranca && credito > 0 ? credito : null,
        honorario_exito_estimado: mostraCobranca && credito > 0 ? exitoEstimado : null,
        operador_id: user.id,
        organizacao_id: membro?.organizacao_id ?? null,
      });
      if (error) throw error;
      toast({ title: "Simulação salva com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-[760px] mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold">Consultoria Empresarial</h1>
          <p className="text-muted-foreground mt-1">Simulador de planos e honorários</p>
        </header>

        {/* Seção 1 — Dados do cliente */}
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-semibold">Dados do cliente</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do cliente</Label>
              <Input
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Ex: João Maria / Fazenda Santa Cruz"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de cliente</Label>
              <Select value={tipoCliente} onValueChange={(v) => handleTipoChange(v as TipoCliente)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urbana">Empresa urbana</SelectItem>
                  <SelectItem value="rural">Empresa rural / Agronegócio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Seção 2 — Plano */}
        <Card className="p-5 space-y-4">
          <h2 className="text-lg font-semibold">Plano</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {planosVisiveis.map((p) => {
              const Icon = p.icon;
              const ativo = planoId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanoId(p.id)}
                  className={cn(
                    "text-left rounded-lg border p-4 transition-colors space-y-3",
                    ativo ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="font-semibold">{p.nome}</span>
                    </div>
                    {p.badge && <Badge variant="secondary" className="text-[10px]">{p.badge}</Badge>}
                  </div>
                  <div>
                    <div className="text-xl font-semibold">{fmtBRL(p.precoBase)}<span className="text-xs font-normal text-muted-foreground">/mês</span></div>
                    <div className="text-xs text-muted-foreground">Faixa: {p.faixa}</div>
                  </div>
                  <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                    {p.entregaveis.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                  {p.naoIncluso && (
                    <div className="text-[11px] text-muted-foreground border-t pt-2">
                      <span className="font-medium">Não incluso:</span> {p.naoIncluso}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground border-t pt-2">
                    <span className="font-medium">Entregue por:</span> {p.entregueePor}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Seção 3 — Complexidade (oculta se Agro) */}
        {plano && !isAgro && (
          <Card className="p-5 space-y-4">
            <h2 className="text-lg font-semibold">Complexidade</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {COMPLEXIDADES.map((c) => {
                const ativo = complexidadeId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setComplexidadeId(c.id)}
                    className={cn(
                      "text-left rounded-lg border p-3 transition-colors",
                      ativo ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{c.label}</span>
                      <Badge variant="outline" className="text-[10px]">{c.fator}×</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Seção 4 — Intermediação de cobrança */}
        {mostraCobranca && (
          <Card className="p-5 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Simular intermediação de cobrança</h2>
              <p className="text-xs text-muted-foreground">10% sobre o valor efetivamente recuperado — formalizado por aditivo</p>
            </div>
            <div className="space-y-1.5">
              <Label>Valor do crédito a recuperar</Label>
              <CurrencyInput value={valorCredito} onChange={setValorCredito} />
            </div>
            {credito > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm">
                Honorário de êxito estimado: <span className="font-semibold">{fmtBRL(exitoEstimado)}</span>
                <p className="text-[11px] text-muted-foreground mt-1">Formalizado por aditivo contratual a cada caso iniciado.</p>
              </div>
            )}
          </Card>
        )}

        {/* Seção 5 — Resultado */}
        {mostrarResultado && plano && (
          <Card className="p-5 bg-muted/40 space-y-2">
            <div className="text-xl font-semibold">{nomeCliente.trim()}</div>
            <div className="text-sm text-muted-foreground">
              {tipoCliente === "rural" ? "Empresa rural / Agronegócio" : "Empresa urbana"} · {plano.nome}
            </div>
            <div className="flex items-baseline gap-2 pt-2">
              {!isAgro && fator !== 1.0 ? (
                <>
                  <span className="text-sm text-muted-foreground line-through">{fmtBRL(plano.precoBase)}</span>
                  <span className="text-2xl font-semibold">{fmtBRL(mensalidadeFinal)}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                  <Badge variant="secondary">{complexidade.label} {fator}×</Badge>
                </>
              ) : (
                <>
                  <span className="text-2xl font-semibold">{fmtBRL(mensalidadeFinal)}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </>
              )}
            </div>
            {mostraCobranca && credito > 0 && (
              <div className="text-sm border-t pt-2 mt-2">
                Êxito estimado (cobrança): <span className="font-semibold">{fmtBRL(exitoEstimado)}</span> sobre {fmtBRL(credito)}
              </div>
            )}
          </Card>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={enviarWhats}
            disabled={!podeAgir}
            className="bg-[#25D366] hover:bg-[#1ebe57] text-white"
          >
            <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
          </Button>
          <Button variant="outline" onClick={salvar} disabled={!podeAgir || salvando}>
            <Save className="w-4 h-4" /> {salvando ? "Salvando..." : "Salvar simulação"}
          </Button>
          <Button variant="outline" onClick={() => setPropostaOpen(true)} disabled={!podeAgir}>
            <FileText className="w-4 h-4" /> Salvar como proposta
          </Button>
        </div>

        <SalvarPropostaDialog
          open={propostaOpen}
          onOpenChange={setPropostaOpen}
          defaultTitulo={plano ? `${plano.nome} — ${nomeCliente.trim() || "Proposta"}` : "Proposta"}
          inputs={propostaInputs}
          resultado={propostaResultado}
          valorSugerido={mensalidadeFinal || null}
        />
      </div>
    </AppLayout>
  );
}