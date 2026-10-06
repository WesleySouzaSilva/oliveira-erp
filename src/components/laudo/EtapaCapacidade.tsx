import { FloatingInput } from "./FloatingInputs";
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function EtapaCapacidade({ data, onChange }: Props) {
  const update = (field: string, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const receitaBruta = Number(data.receitaBruta) || 0;
  const custoTotal = Number(data.custoTotal) || 0;
  const saldoDevedor = Number(data.saldoDevedor) || 0;
  const outrasReceitas = Number(data.outrasReceitas) || 0;
  const outrasDividas = Number(data.outrasDividas) || 0;

  const resultadoOperacional = receitaBruta + outrasReceitas - custoTotal;
  const capacidadePgto = resultadoOperacional - outrasDividas;
  const podeQuitar = capacidadePgto >= saldoDevedor;
  const percentual = saldoDevedor > 0 ? ((capacidadePgto / saldoDevedor) * 100) : 0;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Capacidade de Pagamento</h2>
        <p className="text-sm text-muted-foreground mb-4">Análise econômico-financeira da atividade para demonstrar a (in)capacidade de quitação.</p>

        <h3 className="text-sm font-semibold text-foreground mb-3">Receitas</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <FloatingInput label="Receita bruta da safra (R$)" required type="number" value={data.receitaBruta || ""} onChange={(e) => update("receitaBruta", e.target.value)} tooltip="Produção × preço de venda" />
          <FloatingInput label="Outras receitas agropecuárias (R$)" type="number" value={data.outrasReceitas || ""} onChange={(e) => update("outrasReceitas", e.target.value)} />
          <FloatingInput label="Preço médio de venda (R$/saca)" type="number" value={data.precoVenda || ""} onChange={(e) => update("precoVenda", e.target.value)} />
          <FloatingInput label="Volume comercializado (sacas)" type="number" value={data.volumeComercializado || ""} onChange={(e) => update("volumeComercializado", e.target.value)} />
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-3">Custos de Produção</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <FloatingInput label="Custo total de produção (R$)" required type="number" value={data.custoTotal || ""} onChange={(e) => update("custoTotal", e.target.value)} />
          <FloatingInput label="Custo com insumos (R$)" type="number" value={data.custoInsumos || ""} onChange={(e) => update("custoInsumos", e.target.value)} />
          <FloatingInput label="Custo com mão de obra (R$)" type="number" value={data.custoMaoObra || ""} onChange={(e) => update("custoMaoObra", e.target.value)} />
          <FloatingInput label="Custo com mecanização (R$)" type="number" value={data.custoMecanizacao || ""} onChange={(e) => update("custoMecanizacao", e.target.value)} />
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-3">Endividamento</h3>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <FloatingInput label="Saldo devedor do financiamento (R$)" required type="number" value={data.saldoDevedor || ""} onChange={(e) => update("saldoDevedor", e.target.value)} />
          <FloatingInput label="Outras dívidas rurais (R$)" type="number" value={data.outrasDividas || ""} onChange={(e) => update("outrasDividas", e.target.value)} />
        </div>
      </section>

      {/* Resultado */}
      {(receitaBruta > 0 || custoTotal > 0) && (
        <section className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Resultado da Análise</h3>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">Resultado Operacional</p>
              <p className={`text-xl font-bold ${resultadoOperacional >= 0 ? "text-success" : "text-destructive"}`}>
                R$ {resultadoOperacional.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">Capacidade de Pgto.</p>
              <p className={`text-xl font-bold ${capacidadePgto >= 0 ? "text-success" : "text-destructive"}`}>
                R$ {capacidadePgto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">% do Saldo Devedor</p>
              <p className={`text-xl font-bold ${percentual >= 100 ? "text-success" : "text-destructive"}`}>
                {percentual.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-3 p-4 rounded-lg ${
            podeQuitar ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"
          }`}>
            {podeQuitar ? (
              <>
                <TrendingUp className="w-5 h-5 text-success" />
                <p className="text-sm text-foreground">
                  <strong>Capacidade positiva.</strong> O produtor tem condições de quitar o saldo devedor.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <p className="text-sm text-foreground">
                  <strong>Incapacidade de pagamento comprovada.</strong> O resultado financeiro não permite a quitação integral do saldo devedor, justificando a prorrogação.
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
