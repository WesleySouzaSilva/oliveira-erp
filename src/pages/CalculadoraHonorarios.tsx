import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/CurrencyInput";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Save, MessageCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { gerarPropostaHonorariosPDF } from "@/lib/pdfPropostaHonorarios";

const FAIXAS = [
  { id: 1, max: 1_000_000, ini: 0.05, exit: 0.05, label: "Até R$ 1.000.000" },
  { id: 2, max: 3_000_000, ini: 0.04, exit: 0.04, label: "R$ 1.000.001 – R$ 3.000.000" },
  { id: 3, max: 10_000_000, ini: 0.03, exit: 0.03, label: "R$ 3.000.001 – R$ 10.000.000" },
  { id: 4, max: Infinity, ini: 0.02, exit: 0.02, label: "Acima de R$ 10.000.000" },
];

const COMPLEXIDADES = [
  { id: "padrao", label: "Padrão", mult: 1.0, desc: "Documentação completa, devedor cooperativo" },
  { id: "intermediario", label: "Intermediário", mult: 1.2, desc: "Múltiplos credores ou garantias complexas" },
  { id: "alto", label: "Alto", mult: 1.5, desc: "Litígio paralelo ou urgência" },
  { id: "critico", label: "Crítico", mult: 2.0, desc: "RJ iminente, múltiplas jurisdições" },
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function CalculadoraHonorarios() {
  const { user } = useAuth();
  const [nomeCliente, setNomeCliente] = useState("");
  const [docCliente, setDocCliente] = useState("");
  const [valorDivida, setValorDivida] = useState<number | null>(null);
  const [complexidadeId, setComplexidadeId] = useState("padrao");
  const [pctInicialCustom, setPctInicialCustom] = useState<string>("");
  const [pctExitoCustom, setPctExitoCustom] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  // Nº de proposta gerado uma única vez por sessão (rascunho — confirmado ao salvar)
  const [numeroProposta] = useState(
    () => `PROP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
  );

  const divida = valorDivida ?? 0;
  const faixa = useMemo(() => FAIXAS.find((f) => divida <= f.max) ?? FAIXAS[FAIXAS.length - 1], [divida]);
  const complexidade = COMPLEXIDADES.find((c) => c.id === complexidadeId) ?? COMPLEXIDADES[0];

  // Percentual inicial sugerido (faixa × complexidade) — é também o MÍNIMO permitido
  const pctSugeridoNum = faixa.ini * complexidade.mult * 100;
  const pctMinimoNum = faixa.ini * 100; // piso absoluto = % da faixa, sem complexidade
  const pctCustomNum = pctInicialCustom.trim()
    ? Number(pctInicialCustom.replace(",", "."))
    : NaN;
  const pctCustomValido = !isNaN(pctCustomNum) && pctCustomNum >= pctMinimoNum;
  const pctCustomAbaixoMin = !isNaN(pctCustomNum) && pctCustomNum < pctMinimoNum;
  const pctInicialAplicado = pctCustomValido ? pctCustomNum : pctSugeridoNum;

  // Êxito personalizado (mínimo = % da faixa, sem complexidade)
  const pctExitoMinimoNum = faixa.exit * 100;
  const pctExitoCustomNum = pctExitoCustom.trim()
    ? Number(pctExitoCustom.replace(",", "."))
    : NaN;
  const pctExitoValido = !isNaN(pctExitoCustomNum) && pctExitoCustomNum >= pctExitoMinimoNum;
  const pctExitoAbaixoMin = !isNaN(pctExitoCustomNum) && pctExitoCustomNum < pctExitoMinimoNum;
  const pctExitoAplicado = pctExitoValido ? pctExitoCustomNum : pctExitoMinimoNum;

  const honInicial = divida * (pctInicialAplicado / 100);
  const honExito = divida * (pctExitoAplicado / 100);
  const total = honInicial + honExito;

  const podeAgir =
    nomeCliente.trim().length > 0 && divida > 0 && !pctCustomAbaixoMin && !pctExitoAbaixoMin;
  const mostrarResultado = divida > 0;

  // Formatação leve de CPF/CNPJ
  const formatarDoc = (raw: string): string => {
    const v = raw.replace(/\D/g, "").slice(0, 14);
    if (v.length <= 11) {
      return v
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }
    return v
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const mensagemWhats = () => {
    const linhas = [
      "*Proposta de Honorários — Oliveira Advogados*",
      `_Nº ${numeroProposta}_`,
      "",
      `*Cliente:* ${nomeCliente}`,
      `*Serviço:* Alongamento / Reestruturação de Dívida`,
      `*Valor da dívida:* ${fmtBRL(divida)}`,
      "",
      `*Honorário inicial:* ${fmtBRL(honInicial)} (${pctInicialAplicado.toFixed(2)}%)`,
      `*Honorário de êxito:* ${fmtBRL(honExito)} (${pctExitoAplicado.toFixed(2)}%)`,
      "",
      `*Total:* ${fmtBRL(total)}`,
    ];
    if (complexidade.mult !== 1.0) {
      linhas.push("", `_Complexidade aplicada: ${complexidade.mult.toFixed(1)}×_`);
    }
    linhas.push("", "_Oliveira Advogados — Castro/PR_");
    return linhas.join("\n");
  };

  const enviarWhats = () => {
    if (!podeAgir) return;
    const url = `https://wa.me/?text=${encodeURIComponent(mensagemWhats())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const salvar = async () => {
    if (!podeAgir || !user) return;
    setSalvando(true);
    try {
      const { data: membro } = await supabase
        .from("membros")
        .select("organizacao_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from("honorarios_calculos").insert({
        cliente_nome: nomeCliente.trim(),
        cliente_documento: docCliente.trim() || null,
        numero_proposta: numeroProposta,
        valor_divida: divida,
        faixa_aplicada: faixa.id,
        complexidade_multiplicador: complexidade.mult,
        honorario_inicial: honInicial,
        honorario_exito: honExito,
        honorario_total: total,
        operador_id: user.id,
        organizacao_id: membro?.organizacao_id ?? null,
      });
      if (error) throw error;
      toast({ title: "Cálculo salvo com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const gerarPDF = async () => {
    if (!podeAgir) return;
    setGerandoPDF(true);
    try {
      const blob = await gerarPropostaHonorariosPDF({
        clienteNome: nomeCliente.trim(),
        clienteDocumento: docCliente.trim() || undefined,
        numeroProposta,
        valorDivida: divida,
        faixaId: faixa.id,
        complexidadeLabel: pctCustomValido ? "Personalizado" : complexidade.label,
        complexidadeMult: pctInicialAplicado / (faixa.ini * 100),
        pctInicial: faixa.ini,
        pctExito: pctExitoAplicado / 100,
        honorarioInicial: honInicial,
        honorarioExito: honExito,
        total,
        operadorNome: user?.user_metadata?.full_name || user?.email,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const nomeArq = `Proposta_Honorarios_${nomeCliente.trim().replace(/\s+/g, "_")}.pdf`;
      a.download = nomeArq;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Proposta em PDF gerada" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-[680px] mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Calculadora de Honorários</h1>
          <p className="text-muted-foreground mt-1">
            Alongamento / Reestruturação de Dívida ·{" "}
            <span className="font-mono text-foreground">{numeroProposta}</span>
          </p>
        </header>

        {/* Seção 1 — Dados do caso */}
        <Card className="p-5 space-y-4">
          <h2 className="font-medium">Dados do caso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do cliente</Label>
              <Input
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Ex: João Maria"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CPF / CNPJ <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                value={docCliente}
                onChange={(e) => setDocCliente(formatarDoc(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={18}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor total da dívida</Label>
              <CurrencyInput value={valorDivida} onChange={setValorDivida} />
            </div>
          </div>
        </Card>

        {/* Seção 2 — Faixa aplicável */}
        <Card className="p-5 space-y-3">
          <h2 className="font-medium">Faixa aplicável</h2>
          <div className="space-y-2">
            {FAIXAS.map((f) => {
              const ativa = divida > 0 && f.id === faixa.id;
              return (
                <div
                  key={f.id}
                  className={cn(
                    "border rounded-md p-3 flex items-center justify-between transition-colors",
                    ativa ? "border-primary bg-primary/10" : "border-border bg-background",
                  )}
                >
                  <div>
                    <div className="font-medium text-sm">Faixa {f.id}</div>
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                  </div>
                  <div className="text-sm text-right">
                    <span className="text-muted-foreground">Inicial </span>
                    <span className="font-medium">{(f.ini * 100).toFixed(0)}%</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Êxito </span>
                    <span className="font-medium">{(f.exit * 100).toFixed(0)}%</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Total </span>
                    <span className="font-medium">{((f.ini + f.exit) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Seção 3 — Complexidade */}
        <Card className="p-5 space-y-3">
          <h2 className="font-medium">Complexidade do caso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {COMPLEXIDADES.map((c) => {
              const ativo = c.id === complexidadeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setComplexidadeId(c.id)}
                  className={cn(
                    "text-left border rounded-md p-3 transition-colors",
                    ativo ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.label}</span>
                    <span className="text-xs text-muted-foreground">{c.mult.toFixed(1)}×</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            O multiplicador incide apenas sobre o honorário inicial. O honorário de êxito é fixo pela faixa.
          </p>

          {/* Override manual do % inicial */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label className="text-sm">% inicial personalizado (opcional)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sugerido: <strong>{pctSugeridoNum.toFixed(2)}%</strong> · Mínimo permitido:{" "}
                  <strong>{pctMinimoNum.toFixed(2)}%</strong> (faixa)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min={pctMinimoNum}
                  value={pctInicialCustom}
                  onChange={(e) => setPctInicialCustom(e.target.value)}
                  placeholder={pctSugeridoNum.toFixed(2)}
                  className={cn("w-28", pctCustomAbaixoMin && "border-destructive")}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            {pctCustomAbaixoMin && (
              <p className="text-xs text-destructive">
                Valor abaixo do mínimo da faixa ({pctMinimoNum.toFixed(2)}%). Ajuste para prosseguir.
              </p>
            )}
            {pctCustomValido && pctCustomNum !== pctSugeridoNum && (
              <p className="text-xs text-amber-600">
                Percentual personalizado aplicado: {pctCustomNum.toFixed(2)}% (substitui a sugestão da complexidade).
              </p>
            )}
          </div>

          {/* Override manual do % de êxito */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label className="text-sm">% êxito personalizado (opcional)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sugerido: <strong>{pctExitoMinimoNum.toFixed(2)}%</strong> · Mínimo permitido:{" "}
                  <strong>{pctExitoMinimoNum.toFixed(2)}%</strong> (faixa)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min={pctExitoMinimoNum}
                  value={pctExitoCustom}
                  onChange={(e) => setPctExitoCustom(e.target.value)}
                  placeholder={pctExitoMinimoNum.toFixed(2)}
                  className={cn("w-28", pctExitoAbaixoMin && "border-destructive")}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            {pctExitoAbaixoMin && (
              <p className="text-xs text-destructive">
                Valor abaixo do mínimo da faixa ({pctExitoMinimoNum.toFixed(2)}%). Ajuste para prosseguir.
              </p>
            )}
            {pctExitoValido && pctExitoCustomNum !== pctExitoMinimoNum && (
              <p className="text-xs text-amber-600">
                Êxito personalizado aplicado: {pctExitoCustomNum.toFixed(2)}% (acima da faixa).
              </p>
            )}
          </div>
        </Card>

        {/* Seção 4 — Resultado */}
        {mostrarResultado && (
          <Card className="p-5 space-y-4 bg-muted/40">
            {nomeCliente.trim() && (
              <div className="text-lg font-medium">{nomeCliente.trim()}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md bg-background border p-4">
                <div className="text-xs text-muted-foreground">Honorário inicial</div>
                <div className="text-xl font-semibold mt-1">{fmtBRL(honInicial)}</div>
              </div>
              <div className="rounded-md bg-background border p-4">
                <div className="text-xs text-muted-foreground">Honorário de êxito</div>
                <div className="text-xl font-semibold mt-1 text-green-600">{fmtBRL(honExito)}</div>
              </div>
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total</span>
                {complexidade.mult !== 1.0 && (
                  <Badge className="bg-orange-500 hover:bg-orange-500 text-white">
                    complexidade {complexidade.mult.toFixed(1).replace(".", ",")}×
                  </Badge>
                )}
              </div>
              <div style={{ fontSize: 22, fontWeight: 500 }}>{fmtBRL(total)}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              Faixa {faixa.id} aplicada: {(faixa.ini * 100).toFixed(0)}% inicial × {complexidade.mult.toFixed(1)}× (complexidade) ={" "}
              {pctInicialAplicado.toFixed(2)}% + {pctExitoAplicado.toFixed(2)}% êxito sobre {fmtBRL(divida)} — total{" "}
              {(pctInicialAplicado + pctExitoAplicado).toFixed(2)}%
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={gerarPDF}
                disabled={!podeAgir || gerandoPDF}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                {gerandoPDF ? "Gerando..." : "Gerar proposta em PDF"}
              </Button>
              <Button
                onClick={enviarWhats}
                disabled={!podeAgir}
                className="flex-1"
                style={{ backgroundColor: "#25D366", borderColor: "#25D366", color: "#fff" }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar resumo por WhatsApp
              </Button>
              <Button
                onClick={salvar}
                disabled={!podeAgir || salvando}
                variant="outline"
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {salvando ? "Salvando..." : "Salvar cálculo"}
              </Button>
            </div>
          </Card>
        )}

      </div>
    </AppLayout>
  );
}