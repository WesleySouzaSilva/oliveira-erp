import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Target, Building2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MetaTemplate {
  id: string;
  meta_code: string;
  setor: string;
  nivel: string;
  ordem: number;
  descricao: string;
  alvo: string;
  alvo_calibracao: string | null;
  tipo: string;
  fonte: string | null;
  peso_pontuacao: number;
}

const SETOR_LABEL: Record<string, string> = {
  juridico: "Jurídico",
  comercial: "Comercial",
  marketing: "Marketing",
  pos_venda: "Pós-Venda",
  gestao_pessoas: "Gestão de Pessoas",
};

const NIVEL_ORDER = ["gestor", "coordenador", "senior", "pleno", "junior"];
const NIVEL_LABEL: Record<string, string> = {
  gestor: "Gestor", coordenador: "Coordenador", senior: "Sênior", pleno: "Pleno", junior: "Júnior",
};

export default function MetasSemestrais() {
  const { orgId } = useOrgMembers();
  const [metas, setMetas] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetor, setSelectedSetor] = useState("todos");
  const [selectedNivel, setSelectedNivel] = useState("todos");
  const [calibracaoAtivo, setCalibracaoAtivo] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || anonKey;
    const hdrs = { apikey: anonKey, Authorization: `Bearer ${token}` };

    const [metasRes, configRes] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/rh_metas_template?select=*&organizacao_id=eq.${orgId}&order=setor,nivel,ordem`, { headers: hdrs }),
      fetch(`${baseUrl}/rest/v1/rh_politica_config?select=config_key,config_value&organizacao_id=eq.${orgId}&config_key=eq.modo_calibracao`, { headers: hdrs }),
    ]);

    const metasData = metasRes.ok ? await metasRes.json() : [];
    const configData = configRes.ok ? await configRes.json() : [];
    setMetas(metasData);

    if (configData.length > 0) {
      const cal = configData[0].config_value;
      const now = new Date();
      const sem = now.getMonth() < 6 ? "S1" : "S2";
      const key = `${now.getFullYear()}-${sem}`;
      setCalibracaoAtivo(cal.ativo_em === key);
    }
    setLoading(false);
  };

  const setores = [...new Set(metas.map(m => m.setor))];
  const niveis = [...new Set(metas.map(m => m.nivel))];

  const filtered = metas.filter(m => {
    if (selectedSetor !== "todos" && m.setor !== selectedSetor) return false;
    if (selectedNivel !== "todos" && m.nivel !== selectedNivel) return false;
    return true;
  });

  // Group by setor then nivel
  const grouped = filtered.reduce((acc, m) => {
    if (!acc[m.setor]) acc[m.setor] = {};
    if (!acc[m.setor][m.nivel]) acc[m.setor][m.nivel] = [];
    acc[m.setor][m.nivel].push(m);
    return acc;
  }, {} as Record<string, Record<string, MetaTemplate[]>>);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Metas Semestrais</h1>
              <p className="text-sm text-muted-foreground">Templates de metas por setor e nível</p>
            </div>
          </div>
          {calibracaoAtivo && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-none gap-1">
              ⚙️ Modo Calibração Ativo (-20% nos alvos)
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={selectedSetor} onValueChange={setSelectedSetor}>
            <SelectTrigger className="w-48">
              <Building2 className="w-3.5 h-3.5 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Setores</SelectItem>
              {setores.map(s => <SelectItem key={s} value={s}>{SETOR_LABEL[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedNivel} onValueChange={setSelectedNivel}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Níveis</SelectItem>
              {NIVEL_ORDER.filter(n => niveis.includes(n)).map(n =>
                <SelectItem key={n} value={n}>{NIVEL_LABEL[n] || n}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma meta cadastrada.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([setor, niveis]) => (
            <Card key={setor}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{SETOR_LABEL[setor] || setor}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {NIVEL_ORDER.filter(n => niveis[n]).map(nivel => (
                  <div key={nivel}>
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      {NIVEL_LABEL[nivel] || nivel}
                    </h3>
                    <div className="space-y-2">
                      {(niveis[nivel] || []).sort((a, b) => a.ordem - b.ordem).map(meta => (
                        <div key={meta.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {meta.ordem}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{meta.descricao}</p>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              <Badge variant="outline" className="text-xs">
                                🎯 {calibracaoAtivo && meta.alvo_calibracao ? meta.alvo_calibracao : meta.alvo}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Peso: {meta.peso_pontuacao}%
                              </Badge>
                              {meta.tipo === "binaria" && (
                                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">
                                  Sim/Não
                                </Badge>
                              )}
                              {meta.fonte && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-xs cursor-help">
                                      <Info className="w-3 h-3 mr-1" /> Fonte
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{meta.fonte}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
}
