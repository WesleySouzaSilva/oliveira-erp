import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cloud, Search, MapPin, Thermometer, Droplets, Wind, Sun,
  AlertTriangle, Loader2, TrendingDown, TrendingUp, Satellite,
  BarChart3, Gauge,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Area,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface Station {
  codigo: string;
  nome: string;
  uf: string;
  latitude: number;
  longitude: number;
  altitude: number;
  dataInicio: string;
  distanciaKm?: number | null;
}

interface MonthlyData {
  mes: string;
  precipitacao: number;
  tempMedia: number | null;
  tempMax: number | null;
  tempMin: number | null;
  radiacaoSolar: number | null;
  umidadeRelativa: number | null;
}

interface NasaSummary {
  precipitacao_total_mm: number;
  temperatura_media_c: number | null;
  temperatura_maxima_c: number | null;
  temperatura_minima_c: number | null;
  dias_sem_chuva: number;
  dias_chuva_intensa: number;
  dias_geada: number;
  dias_acima_35c: number;
  total_dias: number;
}

interface AIAnalysis {
  precipitacao_media_historica_mm?: number;
  eventos_extremos?: string[];
  analise_textual?: string;
  classificacao_risco?: string;
  deficit_hidrico_mm?: number;
  balanco_hidrico_mensal?: string;
  recomendacoes_laudo?: string;
}

type ActiveTab = "resumo" | "precipitacao" | "temperatura" | "analise";

export default function DadosClimaticos() {
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [station, setStation] = useState<Station | null>(null);
  const [nasaSummary, setNasaSummary] = useState<NasaSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("resumo");

  const searchAll = async () => {
    if (!uf) { toast.error("Selecione a UF"); return; }
    setLoading(true);
    setStation(null);
    setNasaSummary(null);
    setMonthlyData([]);
    setAiAnalysis(null);

    try {
      // Step 1: Find nearest INMET station
      const { data: stData, error: stErr } = await supabase.functions.invoke("dados-climaticos", {
        body: { action: "list_stations", uf, municipio },
      });
      if (stErr) throw stErr;

      const nearestStation = stData?.stations?.[0] || null;
      setStation(nearestStation);

      if (!nearestStation) {
        toast.warning("Nenhuma estação INMET encontrada. Usando apenas dados satelitais.");
      }

      // Step 2: Fetch NASA POWER data using station coords or approximate
      const lat = nearestStation?.latitude || -15.7801;
      const lon = nearestStation?.longitude || -47.9292;

      const { data: nasaData, error: nasaErr } = await supabase.functions.invoke("dados-climaticos", {
        body: { action: "nasa_power", latitude: lat, longitude: lon, dataInicio, dataFim },
      });

      if (nasaErr) {
        console.error("NASA POWER error:", nasaErr);
        toast.warning("Dados satelitais indisponíveis, continuando com análise por IA.");
      } else {
        setNasaSummary(nasaData.summary);
        setMonthlyData(nasaData.monthly || []);
      }

      // Step 3: AI Analysis enriched with satellite data
      const { data: aiData, error: aiErr } = await supabase.functions.invoke("dados-climaticos", {
        body: { action: "analyze_climate", uf, municipio, dataInicio, dataFim },
      });
      if (aiErr) throw aiErr;
      setAiAnalysis(aiData.analysis || null);

      toast.success("Dados climáticos carregados com sucesso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar dados climáticos");
    } finally {
      setLoading(false);
    }
  };

  const hasData = station || nasaSummary || aiAnalysis;

  const riskColor = aiAnalysis?.classificacao_risco === "crítico" ? "text-destructive" :
    aiAnalysis?.classificacao_risco === "atenção" ? "text-accent" : "text-success";

  const tabs: { id: ActiveTab; label: string; icon: any }[] = [
    { id: "resumo", label: "Resumo", icon: BarChart3 },
    { id: "precipitacao", label: "Precipitação", icon: Droplets },
    { id: "temperatura", label: "Temperatura", icon: Thermometer },
    { id: "analise", label: "Análise IA", icon: Cloud },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-display font-bold text-foreground">Dados Climáticos</h1>
          <span className="text-[10px] bg-info/15 text-info px-2 py-0.5 rounded-full font-semibold">INMET + NASA POWER</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Dados meteorológicos reais via estações INMET e satélite NASA POWER para fundamentar laudos agrícolas.
        </p>
      </div>

      {/* Search */}
      <div className="bg-card rounded-lg border border-border shadow-card p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Consultar região</h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="floating-label-group">
            <select value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="" disabled hidden> </option>
              {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <label>UF *</label>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
            <label>Município</label>
          </div>
          <div className="floating-label-group">
            <input type="date" placeholder=" " value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            <label>Data início</label>
          </div>
          <div className="floating-label-group">
            <input type="date" placeholder=" " value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            <label>Data fim</label>
          </div>
        </div>
        <button
          onClick={searchAll}
          disabled={loading}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-50 transition-all"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Buscando dados...</>
          ) : (
            <><Search className="w-4 h-4" /> Buscar dados climáticos</>
          )}
        </button>
      </div>

      {/* Nearest Station Badge */}
      {station && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="bg-card rounded-lg border border-border shadow-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-foreground">Estação mais próxima: {station.nome}</p>
                {station.distanciaKm != null && (
                  <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-semibold">
                    ~{station.distanciaKm} km
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Código: {station.codigo} · {station.uf} · Lat: {station.latitude.toFixed(4)} · Lon: {station.longitude.toFixed(4)} · Alt: {station.altitude}m
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Satellite className="w-3.5 h-3.5" />
              <span>Dados satelitais complementam</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tabs + Content */}
      {hasData && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Tab navigation */}
          <div className="flex gap-1 mb-6 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB: Resumo */}
          {activeTab === "resumo" && nasaSummary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={Droplets} color="text-info" label="Precipitação Total" value={`${nasaSummary.precipitacao_total_mm} mm`} />
                <MetricCard icon={Thermometer} color="text-destructive" label="Temp. Média" value={`${nasaSummary.temperatura_media_c ?? "—"}°C`} />
                <MetricCard icon={Wind} color="text-muted-foreground" label="Dias sem chuva" value={`${nasaSummary.dias_sem_chuva}`} sub={`de ${nasaSummary.total_dias} dias`} />
                <MetricCard
                  icon={AlertTriangle}
                  color={riskColor}
                  label="Classificação"
                  value={aiAnalysis?.classificacao_risco || "—"}
                  capitalize
                />
              </div>

              {/* Secondary metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Máxima</p>
                  <p className="text-lg font-bold text-foreground">{nasaSummary.temperatura_maxima_c ?? "—"}°C</p>
                </div>
                <div className="bg-card rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Mínima</p>
                  <p className="text-lg font-bold text-foreground">{nasaSummary.temperatura_minima_c ?? "—"}°C</p>
                </div>
                <div className="bg-card rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Dias de geada</p>
                  <p className="text-lg font-bold text-foreground">{nasaSummary.dias_geada}</p>
                </div>
                <div className="bg-card rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Chuva intensa (&gt;30mm)</p>
                  <p className="text-lg font-bold text-foreground">{nasaSummary.dias_chuva_intensa}</p>
                </div>
              </div>

              {/* Comparison with historical */}
              {aiAnalysis?.precipitacao_media_historica_mm && nasaSummary.precipitacao_total_mm && (
                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Precipitação vs Média Histórica</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[
                      { label: "Realizada (satélite)", value: nasaSummary.precipitacao_total_mm },
                      { label: "Média Histórica", value: aiAnalysis.precipitacao_media_historica_mm },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="mm" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex items-center gap-2">
                    {nasaSummary.precipitacao_total_mm < aiAnalysis.precipitacao_media_historica_mm ? (
                      <TrendingDown className="w-4 h-4 text-destructive" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-success" />
                    )}
                    <span className={`text-sm font-medium ${
                      nasaSummary.precipitacao_total_mm < aiAnalysis.precipitacao_media_historica_mm * 0.8
                        ? "text-destructive" : "text-success"
                    }`}>
                      {Math.round(((nasaSummary.precipitacao_total_mm - aiAnalysis.precipitacao_media_historica_mm) / aiAnalysis.precipitacao_media_historica_mm) * 100)}% em relação à média histórica
                    </span>
                  </div>
                </div>
              )}

              {aiAnalysis?.deficit_hidrico_mm && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
                  <Gauge className="w-5 h-5 text-destructive shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Déficit Hídrico Estimado</p>
                    <p className="text-xs text-muted-foreground">{aiAnalysis.deficit_hidrico_mm} mm no período analisado</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Precipitação */}
          {activeTab === "precipitacao" && monthlyData.length > 0 && (
            <div className="space-y-6">
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Precipitação Mensal (NASA POWER)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="precipitacao" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} name="Precipitação (mm)" />
                    {monthlyData[0]?.umidadeRelativa != null && (
                      <Line yAxisId="right" dataKey="umidadeRelativa" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Umidade (%)" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly table */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-2.5 text-left font-semibold text-foreground">Mês</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground">Chuva (mm)</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground">Umidade (%)</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground">Radiação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((m, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 font-medium text-foreground">{m.mes}</td>
                          <td className={`px-4 py-2 text-right ${m.precipitacao < 20 ? "text-destructive font-semibold" : "text-foreground"}`}>
                            {m.precipitacao}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{m.umidadeRelativa ?? "—"}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{m.radiacaoSolar ?? "—"} MJ/m²</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Temperatura */}
          {activeTab === "temperatura" && monthlyData.length > 0 && (
            <div className="space-y-6">
              <div className="bg-card rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Temperaturas Mensais (NASA POWER)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="°C" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area dataKey="tempMax" fill="hsl(var(--destructive) / 0.1)" stroke="hsl(var(--destructive))" strokeWidth={1.5} name="Máxima (°C)" />
                    <Line dataKey="tempMedia" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} name="Média (°C)" />
                    <Area dataKey="tempMin" fill="hsl(var(--info) / 0.1)" stroke="hsl(var(--info))" strokeWidth={1.5} name="Mínima (°C)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Temperature table */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-2.5 text-left font-semibold text-foreground">Mês</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground">Média (°C)</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground">Máxima (°C)</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-foreground">Mínima (°C)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((m, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 font-medium text-foreground">{m.mes}</td>
                          <td className="px-4 py-2 text-right text-foreground">{m.tempMedia ?? "—"}</td>
                          <td className={`px-4 py-2 text-right ${(m.tempMax ?? 0) >= 35 ? "text-destructive font-semibold" : "text-foreground"}`}>
                            {m.tempMax ?? "—"}
                          </td>
                          <td className={`px-4 py-2 text-right ${(m.tempMin ?? 99) <= 0 ? "text-info font-semibold" : "text-foreground"}`}>
                            {m.tempMin ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Análise IA */}
          {activeTab === "analise" && aiAnalysis && (
            <div className="space-y-6">
              {/* Extreme events */}
              {aiAnalysis.eventos_extremos && aiAnalysis.eventos_extremos.length > 0 && (
                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Eventos Extremos Identificados</h3>
                  <div className="space-y-2">
                    {aiAnalysis.eventos_extremos.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                        <span className="text-foreground">{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed analysis */}
              {aiAnalysis.analise_textual && (
                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Análise Climática Detalhada</h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiAnalysis.analise_textual}</p>
                </div>
              )}

              {/* Water balance */}
              {aiAnalysis.balanco_hidrico_mensal && (
                <div className="bg-card rounded-lg border border-border p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Balanço Hídrico</h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiAnalysis.balanco_hidrico_mensal}</p>
                </div>
              )}

              {/* Recommendations for laudo */}
              {aiAnalysis.recomendacoes_laudo && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Recomendações para o Laudo</h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiAnalysis.recomendacoes_laudo}</p>
                </div>
              )}
            </div>
          )}

          {/* Source disclaimer */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mt-6">
            <div className="flex items-start gap-2.5">
              <Satellite className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Dados de estações via <strong>INMET</strong> (estação mais próxima). Dados satelitais via <strong>NASA POWER</strong> (cobertura global, resolução ~50km).
                Análise complementar gerada por IA. Para fins probatórios, recomenda-se relatório oficial junto ao INMET/BDMEP.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!hasData && !loading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Selecione a UF e o período para consultar dados climáticos reais via INMET e satélite NASA POWER.
          </p>
        </div>
      )}
    </AppLayout>
  );
}

function MetricCard({ icon: Icon, color, label, value, sub, capitalize }: {
  icon: any; color: string; label: string; value: string; sub?: string; capitalize?: boolean;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold text-foreground ${capitalize ? "capitalize" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
