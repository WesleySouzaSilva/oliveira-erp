import { FloatingInput, FloatingSelect } from "./FloatingInputs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const soloTipos = ["Latossolo Vermelho", "Argissolo", "Neossolo", "Cambissolo", "Nitossolo", "Outro"];
const sistemaIrrigacao = ["Sequeiro", "Irrigação por pivô central", "Irrigação por aspersão", "Irrigação por gotejamento", "Outro"];

export function EtapaSafra({ data, onChange }: Props) {
  const update = (field: string, value: string) => {
    onChange({ ...data, [field]: value });
  };

  // Mock chart data - produtividade por safra
  const produtividadeData = [
    { safra: "19/20", realizada: Number(data.produtividade1920) || 0, media: Number(data.mediaHistorica) || 0 },
    { safra: "20/21", realizada: Number(data.produtividade2021) || 0, media: Number(data.mediaHistorica) || 0 },
    { safra: "21/22", realizada: Number(data.produtividade2122) || 0, media: Number(data.mediaHistorica) || 0 },
    { safra: "22/23", realizada: Number(data.produtividade2223) || 0, media: Number(data.mediaHistorica) || 0 },
    { safra: "23/24", realizada: Number(data.produtividade2324) || 0, media: Number(data.mediaHistorica) || 0 },
  ];

  const hasChartData = produtividadeData.some((d) => d.realizada > 0);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Dados Técnicos da Safra</h2>
        <p className="text-sm text-muted-foreground mb-4">Informações sobre solo, manejo e produtividade.</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <FloatingSelect label="Tipo de solo" required options={soloTipos.map((s) => ({ value: s, label: s }))} value={data.tipoSolo || ""} onChange={(e) => update("tipoSolo", e.target.value)} />
          <FloatingSelect label="Sistema de irrigação" required options={sistemaIrrigacao.map((s) => ({ value: s, label: s }))} value={data.sistemaIrrigacao || ""} onChange={(e) => update("sistemaIrrigacao", e.target.value)} />
          <FloatingInput label="Espaçamento (m)" type="number" value={data.espacamento || ""} onChange={(e) => update("espacamento", e.target.value)} tooltip="Espaçamento entre linhas" />
          <FloatingInput label="Densidade de plantio (plantas/ha)" type="number" value={data.densidade || ""} onChange={(e) => update("densidade", e.target.value)} />
          <FloatingInput label="Data de plantio" type="date" value={data.dataPlantio || ""} onChange={(e) => update("dataPlantio", e.target.value)} />
          <FloatingInput label="Data de colheita prevista" type="date" value={data.dataColheita || ""} onChange={(e) => update("dataColheita", e.target.value)} />
        </div>
      </section>

      {/* Produtividade */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Produtividade</h2>
        <p className="text-sm text-muted-foreground mb-4">Histórico de produtividade por safra (sacas/ha ou kg/ha).</p>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <FloatingInput label="Média histórica (sc/ha)" required type="number" value={data.mediaHistorica || ""} onChange={(e) => update("mediaHistorica", e.target.value)} tooltip="Média das últimas 5 safras" />
          <FloatingInput label="Produtividade esperada" type="number" value={data.produtividadeEsperada || ""} onChange={(e) => update("produtividadeEsperada", e.target.value)} />
          <FloatingInput label="Produtividade realizada" required type="number" value={data.produtividadeRealizada || ""} onChange={(e) => update("produtividadeRealizada", e.target.value)} />
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4">
          {["19/20", "20/21", "21/22", "22/23", "23/24"].map((s) => {
            const key = `produtividade${s.replace("/", "")}`;
            return (
              <FloatingInput
                key={s}
                label={`Safra ${s}`}
                type="number"
                value={data[key] || ""}
                onChange={(e) => update(key, e.target.value)}
              />
            );
          })}
        </div>

        {hasChartData && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Comparativo de Produtividade</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={produtividadeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="safra" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="realizada" name="Realizada" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                {Number(data.mediaHistorica) > 0 && (
                  <ReferenceLine y={Number(data.mediaHistorica)} stroke="hsl(var(--accent))" strokeDasharray="5 5" label={{ value: "Média", position: "right", fontSize: 11, fill: "hsl(var(--accent))" }} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Observações técnicas */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">Observações técnicas</h3>
        <div className="floating-label-group">
          <textarea placeholder=" " rows={4} value={data.observacoes || ""} onChange={(e) => update("observacoes", e.target.value)} />
          <label>Observações sobre manejo, pragas, doenças, etc.</label>
        </div>
      </section>
    </div>
  );
}
