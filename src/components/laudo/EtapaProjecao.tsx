import { Plus, Trash2, DollarSign, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { FloatingInput } from "./FloatingInputs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/* ─── Types ─── */

interface ProducaoItem {
  id: string;
  tipo: "vegetal" | "animal";
  cultura: string;
  areaOuAnimais: string; // hectares or animals
  producaoTotal: string; // sacas or litros/ano
  precoMedio: string; // R$/saca or R$/litro
  custoProducao: string; // R$ total
}

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

/* ─── Helpers ─── */

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (v: number) => `${v.toFixed(1)}%`;

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3.5 h-3.5 text-muted-foreground/60 inline ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ─── Component ─── */

export function EtapaProjecao({ data, onChange }: Props) {
  const update = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const producoes: ProducaoItem[] = data.producoes || [];

  const addProducao = (tipo: "vegetal" | "animal") => {
    update("producoes", [
      ...producoes,
      {
        id: crypto.randomUUID(),
        tipo,
        cultura: "",
        areaOuAnimais: "",
        producaoTotal: "",
        precoMedio: "",
        custoProducao: "",
      },
    ]);
  };

  const removeProducao = (id: string) => {
    update("producoes", producoes.filter((p) => p.id !== id));
  };

  const updateProducao = (id: string, field: keyof ProducaoItem, value: string) => {
    update(
      "producoes",
      producoes.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  /* ─── Calculations ─── */

  // 1. Receitas
  const receitaProducao = producoes.reduce((acc, p) => {
    const producao = Number(p.producaoTotal) || 0;
    const preco = Number(p.precoMedio) || 0;
    return acc + producao * preco;
  }, 0);
  const outrasReceitas = Number(data.outrasReceitas) || 0;
  const receitaTotal = receitaProducao + outrasReceitas;

  // 2. Despesas
  const custoProducaoTotal = producoes.reduce((acc, p) => {
    return acc + (Number(p.custoProducao) || 0);
  }, 0);
  const outrasDespesas = Number(data.outrasDespesas) || 0;
  const despesaTotal = custoProducaoTotal + outrasDespesas;

  // 3. Resultado das atividades
  const resultadoAtividades = receitaTotal - despesaTotal;

  // 4. Manutenção
  const manutencaoFamiliar = Number(data.manutencaoFamiliar) || 0;
  const outrasManutencoes = Number(data.outrasManutencoes) || 0;
  const custoTotalManutencao = manutencaoFamiliar + outrasManutencoes;

  // 5. Responsabilidades
  const composicaoDividas = Number(data.composicaoDividas) || 0;
  const prazoAnos = Number(data.prazoParcelamento) || 1;
  const carenciaAnos = Number(data.carenciaAnos) || 0;
  const parcelaAnual = prazoAnos > 0 ? composicaoDividas / prazoAnos : 0;

  // 6. Resultado líquido = 3 - (4.3 + 5.2)
  const resultadoLiquido = resultadoAtividades - custoTotalManutencao - parcelaAnual;

  // 7. Superávit/déficit — simplified single-year view
  const anosNecessarios = resultadoAtividades - custoTotalManutencao > 0
    ? Math.ceil(composicaoDividas / (resultadoAtividades - custoTotalManutencao))
    : 0;

  const hasData = producoes.length > 0 || custoProducaoTotal > 0 || manutencaoFamiliar > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">
          Projeção Financeira — Capacidade de Pagamento
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Preencha os dados de produção, custos e endividamento para calcular a capacidade de reposição
          conforme modelo de laudo de capacidade de pagamento.
        </p>
      </section>

      {/* ─── PRODUÇÃO VEGETAL ─── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
          🌱 Produção Vegetal
          <InfoTip text="Cadastre cada cultura com área, produção total em sacas, preço médio de venda e custo de produção total." />
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Informe os dados de produção e receita para cada cultura vegetal.
        </p>

        {producoes.filter(p => p.tipo === "vegetal").map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[1fr_80px_100px_100px_120px_auto] gap-2 mb-2 items-end"
          >
            <FloatingInput
              label="Cultura"
              required
              value={p.cultura}
              onChange={(e) => updateProducao(p.id, "cultura", e.target.value)}
            />
            <FloatingInput
              label="Área (ha)"
              type="number"
              value={p.areaOuAnimais}
              onChange={(e) => updateProducao(p.id, "areaOuAnimais", e.target.value)}
            />
            <FloatingInput
              label="Prod. (sacas)"
              type="number"
              value={p.producaoTotal}
              onChange={(e) => updateProducao(p.id, "producaoTotal", e.target.value)}
            />
            <FloatingInput
              label="R$/saca"
              type="number"
              value={p.precoMedio}
              onChange={(e) => updateProducao(p.id, "precoMedio", e.target.value)}
            />
            <FloatingInput
              label="Custo prod. (R$)"
              type="number"
              value={p.custoProducao}
              onChange={(e) => updateProducao(p.id, "custoProducao", e.target.value)}
            />
            <button
              onClick={() => removeProducao(p.id)}
              className="p-2 hover:bg-destructive/10 rounded text-destructive mb-1"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={() => addProducao("vegetal")}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline mt-2"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar cultura vegetal
        </button>
      </section>

      {/* ─── PRODUÇÃO ANIMAL ─── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
          🐄 Produção Animal
          <InfoTip text="Cadastre pecuária com nº de animais, produção em litros/ano, preço médio/litro e custo total." />
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Informe os dados de produção e receita para cada atividade pecuária.
        </p>

        {producoes.filter(p => p.tipo === "animal").map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[1fr_80px_100px_100px_120px_auto] gap-2 mb-2 items-end"
          >
            <FloatingInput
              label="Atividade"
              required
              value={p.cultura}
              onChange={(e) => updateProducao(p.id, "cultura", e.target.value)}
            />
            <FloatingInput
              label="Animais"
              type="number"
              value={p.areaOuAnimais}
              onChange={(e) => updateProducao(p.id, "areaOuAnimais", e.target.value)}
            />
            <FloatingInput
              label="Litros/ano"
              type="number"
              value={p.producaoTotal}
              onChange={(e) => updateProducao(p.id, "producaoTotal", e.target.value)}
            />
            <FloatingInput
              label="R$/litro"
              type="number"
              value={p.precoMedio}
              onChange={(e) => updateProducao(p.id, "precoMedio", e.target.value)}
            />
            <FloatingInput
              label="Custo prod. (R$)"
              type="number"
              value={p.custoProducao}
              onChange={(e) => updateProducao(p.id, "custoProducao", e.target.value)}
            />
            <button
              onClick={() => removeProducao(p.id)}
              className="p-2 hover:bg-destructive/10 rounded text-destructive mb-1"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={() => addProducao("animal")}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline mt-2"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar produção animal
        </button>
      </section>

      {/* ─── TABELA DE PRODUÇÃO ─── */}
      {producoes.length > 0 && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-xs">
                <th className="text-left p-3">Atividade</th>
                <th className="text-right p-3">Área/Animais</th>
                <th className="text-right p-3">Produção</th>
                <th className="text-right p-3">Preço unit.</th>
                <th className="text-right p-3">Receita (R$)</th>
                <th className="text-right p-3">Custo (R$)</th>
                <th className="text-right p-3">Custo/Receita</th>
              </tr>
            </thead>
            <tbody>
              {producoes.map((p) => {
                const producao = Number(p.producaoTotal) || 0;
                const preco = Number(p.precoMedio) || 0;
                const custo = Number(p.custoProducao) || 0;
                const receita = producao * preco;
                const custoReceita = receita > 0 ? (custo / receita) * 100 : 0;
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">
                      {p.tipo === "vegetal" ? "🌱" : "🐄"} {p.cultura || "—"}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{p.areaOuAnimais || "—"}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {producao ? producao.toLocaleString("pt-BR") : "—"}
                      <span className="text-[10px] ml-0.5">{p.tipo === "vegetal" ? "sc" : "L"}</span>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{preco ? fmt(preco) : "—"}</td>
                    <td className="p-3 text-right font-semibold text-foreground">{receita ? fmt(receita) : "—"}</td>
                    <td className="p-3 text-right text-muted-foreground">{custo ? fmt(custo) : "—"}</td>
                    <td className={`p-3 text-right font-medium ${custoReceita > 100 ? "text-destructive" : "text-success"}`}>
                      {receita > 0 ? pct(custoReceita) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ─── OUTRAS RECEITAS ─── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Outras Receitas</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <FloatingInput
            label="Outras receitas agropecuárias (R$/ano)"
            type="number"
            value={data.outrasReceitas || ""}
            onChange={(e) => update("outrasReceitas", e.target.value)}
            tooltip="Arrendamento, prestação de serviços, etc."
          />
        </div>
      </section>

      {/* ─── OUTRAS DESPESAS ─── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Outras Despesas</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <FloatingInput
            label="Outras despesas operacionais (R$/ano)"
            type="number"
            value={data.outrasDespesas || ""}
            onChange={(e) => update("outrasDespesas", e.target.value)}
            tooltip="Frete, impostos extras, etc."
          />
        </div>
      </section>

      {/* ─── MANUTENÇÃO DO PROPONENTE ─── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
          Manutenção do Proponente
          <InfoTip text="Custos com manutenção familiar mensal × 12, máquinas e equipamentos." />
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <FloatingInput
            label="Manutenção familiar (R$/ano)"
            required
            type="number"
            value={data.manutencaoFamiliar || ""}
            onChange={(e) => update("manutencaoFamiliar", e.target.value)}
            tooltip="Custo de vida anual do produtor e família"
          />
          <FloatingInput
            label="Outras manutenções (R$/ano)"
            type="number"
            value={data.outrasManutencoes || ""}
            onChange={(e) => update("outrasManutencoes", e.target.value)}
            tooltip="Máquinas, equipamentos, benfeitorias"
          />
        </div>
      </section>

      {/* ─── RESPONSABILIDADES / ENDIVIDAMENTO ─── */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
          Responsabilidades — Reposição
          <InfoTip text="Valor total das dívidas a reestruturar e prazo proposto para parcelamento." />
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 mt-3">
          <FloatingInput
            label="Composição total das dívidas (R$)"
            required
            type="number"
            value={data.composicaoDividas || ""}
            onChange={(e) => update("composicaoDividas", e.target.value)}
            tooltip="Somatório de todos os contratos a alongar"
          />
          <FloatingInput
            label="Carência proposta (anos)"
            type="number"
            value={data.carenciaAnos || ""}
            onChange={(e) => update("carenciaAnos", e.target.value)}
            tooltip="Período sem pagamento de parcelas"
          />
          <FloatingInput
            label="Prazo de parcelamento (anos)"
            required
            type="number"
            value={data.prazoParcelamento || ""}
            onChange={(e) => update("prazoParcelamento", e.target.value)}
            tooltip="Número de parcelas anuais para quitação"
          />
        </div>
        {parcelaAnual > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Valor aproximado da parcela anual: <strong className="text-foreground">{fmt(parcelaAnual)}</strong>
          </p>
        )}
      </section>

      {/* ─── QUADRO COMPARATIVO (Tabela 03 resumida) ─── */}
      {hasData && (
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-accent" />
            Quadro Comparativo — Capacidade de Pagamento
          </h3>

          {/* Summary table */}
          <div className="bg-secondary rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {/* 1. Receitas */}
                <tr className="bg-accent/5">
                  <td colSpan={2} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wide">1. Receitas</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">1.1. Produção vegetal e animal</td>
                  <td className="p-3 text-right font-medium text-foreground">{fmt(receitaProducao)}</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">1.2. Outras receitas</td>
                  <td className="p-3 text-right text-foreground">{fmt(outrasReceitas)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="p-3 pl-6 text-foreground">1.3. Receita total</td>
                  <td className="p-3 text-right text-accent">{fmt(receitaTotal)}</td>
                </tr>

                {/* 2. Despesas */}
                <tr className="bg-accent/5">
                  <td colSpan={2} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wide">2. Despesas</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">2.1. Custeio da produção vegetal e animal</td>
                  <td className="p-3 text-right font-medium text-foreground">{fmt(custoProducaoTotal)}</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">2.2. Outras despesas</td>
                  <td className="p-3 text-right text-foreground">{fmt(outrasDespesas)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="p-3 pl-6 text-foreground">2.3. Despesa total</td>
                  <td className="p-3 text-right text-foreground">{fmt(despesaTotal)}</td>
                </tr>

                {/* 3. Resultado */}
                <tr className="bg-accent/5">
                  <td className="p-3 font-semibold text-foreground text-xs uppercase tracking-wide">3. Resultado das atividades (1.3 − 2.3)</td>
                  <td className={`p-3 text-right font-bold text-base ${resultadoAtividades >= 0 ? "text-success" : "text-destructive"}`}>
                    {fmt(resultadoAtividades)}
                  </td>
                </tr>

                {/* 4. Manutenção */}
                <tr className="bg-accent/5">
                  <td colSpan={2} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wide">4. Manutenção do proponente</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">4.1. Manutenção familiar</td>
                  <td className="p-3 text-right text-foreground">{fmt(manutencaoFamiliar)}</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">4.2. Outras manutenções</td>
                  <td className="p-3 text-right text-foreground">{fmt(outrasManutencoes)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="p-3 pl-6 text-foreground">4.3. Custo total com manutenção</td>
                  <td className="p-3 text-right text-foreground">{fmt(custoTotalManutencao)}</td>
                </tr>

                {/* 5. Responsabilidades */}
                <tr className="bg-accent/5">
                  <td colSpan={2} className="p-3 font-semibold text-foreground text-xs uppercase tracking-wide">5. Responsabilidades — reposição</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">5.1. Composição das dívidas</td>
                  <td className="p-3 text-right font-medium text-foreground">{fmt(composicaoDividas)}</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-muted-foreground">5.2. Valor aproximado da parcela anual</td>
                  <td className="p-3 text-right text-foreground">{fmt(parcelaAnual)}</td>
                </tr>

                {/* 6. Resultado líquido */}
                <tr className="bg-accent/5 border-t-2 border-accent">
                  <td className="p-3 font-bold text-foreground">
                    6. Resultado líquido [3 − (4.3 + 5.2)]
                  </td>
                  <td className={`p-3 text-right font-bold text-base ${resultadoLiquido >= 0 ? "text-success" : "text-destructive"}`}>
                    {fmt(resultadoLiquido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Conclusion banner */}
          <div
            className={`flex items-start gap-3 p-4 rounded-lg ${
              resultadoLiquido > 0
                ? "bg-success/10 border border-success/20"
                : resultadoAtividades - custoTotalManutencao > 0
                  ? "bg-accent/10 border border-accent/20"
                  : "bg-destructive/10 border border-destructive/20"
            }`}
          >
            {resultadoLiquido > 0 ? (
              <>
                <TrendingUp className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  <strong>Capacidade de pagamento positiva.</strong>{" "}
                  Com resultado líquido anual de <strong>{fmt(resultadoLiquido)}</strong> após manutenção e parcela,
                  o produtor demonstra viabilidade para honrar o parcelamento em <strong>{prazoAnos} ano(s)</strong>
                  {carenciaAnos > 0 ? ` com carência de ${carenciaAnos} ano(s)` : ""}.
                </div>
              </>
            ) : resultadoAtividades - custoTotalManutencao > 0 ? (
              <>
                <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  <strong>Capacidade parcial.</strong>{" "}
                  O resultado das atividades menos a manutenção é positivo ({fmt(resultadoAtividades - custoTotalManutencao)}),
                  mas insuficiente para cobrir a parcela anual de {fmt(parcelaAnual)}.
                  Estima-se necessidade de <strong>{anosNecessarios} ano(s)</strong> para quitação total
                  {carenciaAnos > 0 ? ` com carência de ${carenciaAnos} ano(s)` : ""}, justificando
                  prorrogação com condições especiais.
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  <strong>Incapacidade de pagamento comprovada.</strong>{" "}
                  O resultado financeiro não permite a quitação, justificando a prorrogação com condições especiais.
                  {composicaoDividas > 0 && (
                    <> Dívida total de <strong>{fmt(composicaoDividas)}</strong> não é sustentável com o fluxo atual.</>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
