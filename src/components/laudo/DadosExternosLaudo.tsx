import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Satellite, FileWarning, Loader2, ExternalLink,
  TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp,
  CloudRain, AlertTriangle, Newspaper, DollarSign, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DadosExternosProps {
  municipio?: string;
  uf?: string;
  cultura?: string;
  latitude?: number;
  longitude?: number;
}

interface SectionData {
  loading: boolean;
  data: any;
  expanded: boolean;
}

type SectionKey = "conab" | "decretos" | "ndvi" | "cptec" | "cemaden" | "ipea" | "yr" | "scraping";

export function DadosExternosLaudo({ municipio, uf, cultura, latitude, longitude }: DadosExternosProps) {
  const [sections, setSections] = useState<Record<SectionKey, SectionData>>({
    conab: { loading: false, data: null, expanded: true },
    decretos: { loading: false, data: null, expanded: true },
    ndvi: { loading: false, data: null, expanded: true },
    cptec: { loading: false, data: null, expanded: false },
    cemaden: { loading: false, data: null, expanded: false },
    ipea: { loading: false, data: null, expanded: false },
    yr: { loading: false, data: null, expanded: false },
    scraping: { loading: false, data: null, expanded: false },
  });

  const updateSection = (key: SectionKey, update: Partial<SectionData>) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  };

  const toggleSection = (key: SectionKey) => {
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], expanded: !prev[key].expanded } }));
  };

  const invoke = async (key: SectionKey, fnName: string, body: any) => {
    updateSection(key, { loading: true });
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      updateSection(key, { data, loading: false, expanded: true });
    } catch (err: any) {
      toast.error(err.message || `Erro ao consultar ${fnName}`);
      updateSection(key, { loading: false });
    }
  };

  const exigeMunicipio = () => {
    if (!municipio || !municipio.trim()) {
      toast.error("Informe o município na Etapa 1 antes de consultar");
      return false;
    }
    return true;
  };

  const consultarConab = () => invoke("conab", "consultar-conab", { produto: cultura || "soja", uf, municipio });
  const consultarDecretos = () => {
    if (!exigeMunicipio()) return;
    invoke("decretos", "consultar-decretos", { municipio, uf, ano: new Date().getFullYear() });
  };
  const consultarNdvi = () => {
    if (!latitude || !longitude) { toast.error("Informe as coordenadas na Etapa 1"); return; }
    invoke("ndvi", "consultar-ndvi", { latitude, longitude });
  };
  const consultarCptec = () => {
    if (!exigeMunicipio()) return;
    invoke("cptec", "consultar-cptec", { municipio, uf });
  };
  const consultarCemaden = () => {
    if (!exigeMunicipio()) return;
    invoke("cemaden", "consultar-cemaden", { municipio, uf });
  };
  const consultarIpea = () => invoke("ipea", "consultar-ipea", { cultura });
  const consultarYr = () => {
    if (!latitude || !longitude) { toast.error("Informe as coordenadas na Etapa 1"); return; }
    invoke("yr", "consultar-yr", { latitude, longitude, municipio });
  };
  const consultarScraping = () => invoke("scraping", "scraping-agro", { cultura });

  const isAnyLoading = Object.values(sections).some((s) => s.loading);

  const consultarTodos = () => {
    consultarConab();
    consultarDecretos();
    consultarCptec();
    consultarCemaden();
    consultarIpea();
    if (latitude && longitude) { consultarNdvi(); consultarYr(); }
    consultarScraping();
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "crescente" || trend === "alta") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === "decrescente" || trend === "baixa") return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getNdviColor = (value: number) => {
    if (value > 0.6) return "bg-green-500";
    if (value > 0.4) return "bg-green-400";
    if (value > 0.2) return "bg-yellow-400";
    if (value > 0) return "bg-orange-400";
    return "bg-red-400";
  };

  const SectionHeader = ({ sectionKey, icon: Icon, iconColor, title, subtitle, onConsult }: {
    sectionKey: SectionKey; icon: any; iconColor: string; title: string; subtitle: string; onConsult: () => void;
  }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-left">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!sections[sectionKey].data && !sections[sectionKey].loading && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onConsult(); }}>
            Consultar
          </Button>
        )}
        {sections[sectionKey].loading && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
        {sections[sectionKey].expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-display font-bold text-foreground">Dados Externos — 8 Fontes</h3>
          <p className="text-xs text-muted-foreground">
            CONAB, CEPEA, IPEA, CPTEC/INPE, CEMADEN, yr.no, NDVI, Decretos e Notícias Agrícolas
          </p>
        </div>
        <Button size="sm" onClick={consultarTodos} disabled={isAnyLoading}>
          <RefreshCw className={`w-4 h-4 ${isAnyLoading ? "animate-spin" : ""}`} />
          Consultar Todos
        </Button>
      </div>

      {/* CONAB */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="conab" icon={BarChart3} iconColor="bg-accent/10 text-accent" title="Preços CONAB" subtitle={`${cultura || "Soja"} — ${uf || "Todas UFs"}`} onConsult={consultarConab} />
        {sections.conab.expanded && sections.conab.data && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-2">Fonte: {sections.conab.data.fonte}</p>
            {sections.conab.data.precos?.length > 0 ? (
              <div className="space-y-2">
                {sections.conab.data.precos.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-foreground">{p.produto || p.mensagem}</span>
                    {p.preco && <span className="font-mono font-medium text-foreground">{p.preco}</span>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhum dado encontrado</p>}
          </div>
        )}
      </motion.div>

      {/* CEPEA / Scraping */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="scraping" icon={DollarSign} iconColor="bg-green-500/10 text-green-500" title="Cotações CEPEA / Notícias Agrícolas" subtitle={`${cultura || "Soja/Milho"} — Scraping em tempo real`} onConsult={consultarScraping} />
        {sections.scraping.expanded && sections.scraping.data && (
          <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
            {/* Cotações */}
            {Object.entries(sections.scraping.data.cotacoes || {}).map(([key, val]: [string, any]) => (
              <div key={key} className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">{val.descricao || key}</span>
                  {val.url && (
                    <a href={val.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs flex items-center gap-1">
                      Fonte <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {val.conteudo && (
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{val.conteudo.substring(0, 300)}...</p>
                )}
                {val.error && <p className="text-xs text-destructive">{val.error}</p>}
              </div>
            ))}
            {/* Notícias recentes */}
            {sections.scraping.data.noticias_recentes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                  <Newspaper className="w-3 h-3" /> Notícias Recentes
                </p>
                {sections.scraping.data.noticias_recentes.map((n: any, i: number) => (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                    className="block bg-muted/20 rounded-lg px-3 py-2 mb-1 hover:bg-muted/40 transition-colors">
                    <span className="text-xs font-medium text-foreground">{n.titulo}</span>
                    {n.descricao && <p className="text-[10px] text-muted-foreground line-clamp-1">{n.descricao}</p>}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* IPEA */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="ipea" icon={TrendingUp} iconColor="bg-blue-500/10 text-blue-500" title="Indicadores IPEA" subtitle={`Preços agrícolas, câmbio, crédito rural`} onConsult={consultarIpea} />
        {sections.ipea.expanded && sections.ipea.data && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            {Object.entries(sections.ipea.data.analise || {}).map(([key, val]: [string, any]) => {
              const serie = sections.ipea.data.series?.[key];
              return (
                <div key={key} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2 mb-1">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(val.tendencia)}
                    <span className="text-foreground text-xs">{serie?.descricao || key}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-medium text-foreground text-xs">
                      {typeof val.valor_atual === "number" ? val.valor_atual.toFixed(2) : val.valor_atual}
                    </span>
                    <span className={`text-[10px] ml-2 ${val.tendencia === "alta" ? "text-green-500" : val.tendencia === "baixa" ? "text-destructive" : "text-muted-foreground"}`}>
                      {val.variacao_mensal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Decretos */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="decretos" icon={FileWarning} iconColor="bg-destructive/10 text-destructive" title="Decretos de Calamidade" subtitle={`${municipio || "Município"} — ${uf || "UF"}`} onConsult={consultarDecretos} />
        {sections.decretos.expanded && sections.decretos.data && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-2 italic">{sections.decretos.data.nota}</p>
            <div className="space-y-2">
              {(sections.decretos.data.resultados || []).map((r: any, i: number) => (
                <div key={i} className="bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{r.fonte}</span>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs flex items-center gap-1">
                        Acessar <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{r.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* CPTEC/INPE */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="cptec" icon={CloudRain} iconColor="bg-sky-500/10 text-sky-500" title="Previsão CPTEC/INPE" subtitle={`${municipio || "Município"} — Previsão 7-14 dias`} onConsult={consultarCptec} />
        {sections.cptec.expanded && sections.cptec.data && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            {sections.cptec.data.analise && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Dias c/ Chuva</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.cptec.data.analise.dias_com_chuva}/{sections.cptec.data.analise.total_dias}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">T. Máx</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.cptec.data.analise.temperatura_maxima}°C</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">T. Mín</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.cptec.data.analise.temperatura_minima}°C</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Geada</p>
                  <p className={`text-sm font-bold ${sections.cptec.data.analise.risco_geada ? "text-destructive" : "text-green-500"}`}>
                    {sections.cptec.data.analise.risco_geada ? "Sim" : "Não"}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {(sections.cptec.data.previsao || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1">
                  <span className="text-muted-foreground w-20">{p.data}</span>
                  <span className="text-foreground flex-1">{p.tempo}</span>
                  <span className="font-mono text-foreground">{p.minima}° — {p.maxima}°</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* CEMADEN */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="cemaden" icon={AlertTriangle} iconColor="bg-orange-500/10 text-orange-500" title="Alertas CEMADEN" subtitle={`${municipio || "Município"} — Monitoramento de desastres`} onConsult={consultarCemaden} />
        {sections.cemaden.expanded && sections.cemaden.data && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Nível Máx</p>
                <p className={`text-xs font-bold ${sections.cemaden.data.resumo?.tem_alerta_ativo ? "text-destructive" : "text-green-500"}`}>
                  {sections.cemaden.data.resumo?.nivel_maximo || "Normal"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Estações</p>
                <p className="text-sm font-mono font-bold text-foreground">{sections.cemaden.data.resumo?.total_estacoes_pluviometricas || 0}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Áreas Risco</p>
                <p className="text-sm font-mono font-bold text-foreground">{sections.cemaden.data.resumo?.total_areas_risco || 0}</p>
              </div>
            </div>
            {sections.cemaden.data.alertas?.length > 0 && (
              <div className="space-y-1">
                {sections.cemaden.data.alertas.map((a: any, i: number) => (
                  <div key={i} className="bg-destructive/10 rounded-lg px-3 py-2 text-xs text-foreground">
                    <span className="font-semibold">{a.nivel}</span> — {a.tipo} ({a.data || "atual"})
                  </div>
                ))}
              </div>
            )}
            {sections.cemaden.data.pluviometria?.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-foreground">Pluviometria</p>
                {sections.cemaden.data.pluviometria.slice(0, 3).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1">
                    <span className="text-muted-foreground">{p.estacao || p.municipio}</span>
                    <span className="font-mono text-foreground">{p.acumulado_24h || "—"} mm (24h)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* yr.no */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="yr" icon={Globe} iconColor="bg-indigo-500/10 text-indigo-500" title="Previsão yr.no (MET Norway)" subtitle={latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)} — 10 dias` : "Coordenadas necessárias"} onConsult={consultarYr} />
        {sections.yr.expanded && sections.yr.data && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            {sections.yr.data.analise_agroclimatica && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Precip. Total</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.yr.data.analise_agroclimatica.precipitacao_total_mm} mm</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Dias Chuva</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.yr.data.analise_agroclimatica.dias_com_chuva}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Geada</p>
                  <p className={`text-sm font-bold ${sections.yr.data.analise_agroclimatica.risco_geada ? "text-destructive" : "text-green-500"}`}>
                    {sections.yr.data.analise_agroclimatica.risco_geada ? "Risco" : "Não"}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Veranico</p>
                  <p className={`text-sm font-bold ${sections.yr.data.analise_agroclimatica.indicativo_veranico ? "text-orange-500" : "text-green-500"}`}>
                    {sections.yr.data.analise_agroclimatica.indicativo_veranico ? "Sim" : "Não"}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {(sections.yr.data.previsao || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1">
                  <span className="text-muted-foreground w-20">{p.data}</span>
                  <span className="font-mono text-foreground">{p.temperatura_minima?.toFixed(0)}° — {p.temperatura_maxima?.toFixed(0)}°</span>
                  <span className="font-mono text-sky-500">{p.precipitacao_mm} mm</span>
                  <span className="text-muted-foreground">{p.umidade_media?.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* NDVI */}
      <motion.div className="bg-card border border-border rounded-xl overflow-hidden">
        <SectionHeader sectionKey="ndvi" icon={Satellite} iconColor="bg-green-600/10 text-green-600" title="NDVI — Índice de Vegetação" subtitle={latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : "Coordenadas necessárias"} onConsult={consultarNdvi} />
        {sections.ndvi.expanded && sections.ndvi.data && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            {sections.ndvi.data.estatisticas && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Média</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.ndvi.data.estatisticas.media.toFixed(3)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Mínimo</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.ndvi.data.estatisticas.minimo.toFixed(3)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Máximo</p>
                  <p className="text-sm font-mono font-bold text-foreground">{sections.ndvi.data.estatisticas.maximo.toFixed(3)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Tendência</p>
                  <div className="flex items-center justify-center gap-1">
                    {getTrendIcon(sections.ndvi.data.estatisticas.tendencia)}
                    <span className="text-xs text-foreground capitalize">{sections.ndvi.data.estatisticas.tendencia}</span>
                  </div>
                </div>
              </div>
            )}
            {sections.ndvi.data.ndvi_data?.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-xs font-medium text-foreground mb-2">
                  Evolução NDVI ({sections.ndvi.data.periodo?.inicio} → {sections.ndvi.data.periodo?.fim})
                </p>
                <div className="flex items-end gap-1 h-20">
                  {sections.ndvi.data.ndvi_data.map((d: any, i: number) => {
                    const height = d.ndvi !== null ? Math.max(4, d.ndvi * 80) : 4;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.data}: NDVI ${d.ndvi?.toFixed(3)}`}>
                        <div className={`w-full rounded-t ${d.ndvi !== null ? getNdviColor(d.ndvi) : "bg-muted"}`} style={{ height: `${height}px` }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {sections.ndvi.data.imagem_satelite_url && (
              <a href={sections.ndvi.data.imagem_satelite_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-accent hover:underline">
                <Satellite className="w-4 h-4" /> Ver imagem de satélite <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
