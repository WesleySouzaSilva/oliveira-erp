import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Calendar, DollarSign, Users, ChevronRight, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Apuracao {
  id: string;
  membro_id: string;
  semestre: string;
  ano: number;
  setor: string | null;
  nivel: string | null;
  salario_fixo: number;
  peso_nivel: number;
  cota_individual: number;
  meta_1_id: string | null;
  meta_1_batida: boolean;
  meta_1_pontos: number;
  meta_2_id: string | null;
  meta_2_batida: boolean;
  meta_2_pontos: number;
  meta_3_id: string | null;
  meta_3_batida: boolean;
  meta_3_pontos: number;
  pontuacao_total: number;
  faixa_termometro: string;
  metas_batidas_total: number;
  multiplicador_base: number;
  multiplicador_antiguidade: number;
  multiplicador_final: number;
  bonus_final: number;
  modo_calibracao: boolean;
  feedback_gestor: string | null;
  aprovado_por: string | null;
  data_pagamento: string | null;
  status: string;
}

interface PoolSemestral {
  id: string;
  semestre: string;
  ano: number;
  faturamento_semestral: number;
  meta_faturamento: number;
  gatilho_atingido: boolean;
  pool_definido: number;
  pool_liberado: number;
  status: string;
}

const SETOR_LABEL: Record<string, string> = {
  juridico: "Jurídico", comercial: "Comercial", marketing: "Marketing",
  pos_venda: "Pós-Venda", gestao_pessoas: "Gestão de Pessoas",
};

const NIVEL_LABEL: Record<string, string> = {
  gestor: "Gestor", coordenador: "Coordenador", senior: "Sênior", pleno: "Pleno", junior: "Júnior",
};

const FAIXA_COLORS: Record<string, string> = {
  "Atenção": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Em progresso": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Meta": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Supermeta": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const FAIXA_ICONS: Record<string, string> = {
  "Atenção": "🔴", "Em progresso": "🟠", "Meta": "🔵", "Supermeta": "🟢",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", em_apuracao: "Em Apuração", aprovado: "Aprovado", pago: "Pago", suspenso: "Suspenso",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function ApuracaoBonus() {
  const { orgId, isAdmin, members } = useOrgMembers();
  
  const [apuracoes, setApuracoes] = useState<Apuracao[]>([]);
  const [pools, setPools] = useState<PoolSemestral[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSemestre, setSelectedSemestre] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() < 6 ? "S1" : "S2"}`;
  });

  // Pool dialog
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [poolForm, setPoolForm] = useState({ faturamento: "", meta_faturamento: "", pool_definido: "" });

  // Apuracao detail dialog
  const [selectedApuracao, setSelectedApuracao] = useState<Apuracao | null>(null);

  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId, selectedSemestre]);

  const loadData = async () => {
    setLoading(true);
    const [ano, sem] = selectedSemestre.split("-");
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || anonKey;
    const hdrs = { apikey: anonKey, Authorization: `Bearer ${token}` };

    const [apuRes, poolRes, profRes] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/rh_apuracoes?select=*&organizacao_id=eq.${orgId}&semestre=eq.${sem}&ano=eq.${ano}&order=setor,nivel`, { headers: hdrs }),
      fetch(`${baseUrl}/rest/v1/rh_pools_semestrais?select=*&organizacao_id=eq.${orgId}&semestre=eq.${sem}&ano=eq.${ano}`, { headers: hdrs }),
      supabase.from("profiles_publico").select("id, nome"),
    ]);

    setApuracoes(apuRes.ok ? await apuRes.json() : []);
    setPools(poolRes.ok ? await poolRes.json() : []);
    const profMap: Record<string, string> = {};
    (profRes.data || []).forEach(p => { profMap[p.id] = p.nome || ""; });
    // Map membro_id -> user_id -> name
    const memMap: Record<string, string> = {};
    members.forEach(m => { memMap[m.id] = profMap[m.user_id] || m.user_id; });
    setProfiles(memMap);
    setLoading(false);
  };

  const pool = pools[0] || null;

  const semestres = [];
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    semestres.push(`${y}-S2`, `${y}-S1`);
  }

  const totalBonus = apuracoes.reduce((s, a) => s + (a.bonus_final || 0), 0);
  const avgPontuacao = apuracoes.length > 0
    ? Math.round(apuracoes.reduce((s, a) => s + a.pontuacao_total, 0) / apuracoes.length)
    : 0;

  const handleCreatePool = async () => {
    if (!orgId) return;
    const [ano, sem] = selectedSemestre.split("-");
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || anonKey;

    const body = {
      organizacao_id: orgId,
      semestre: sem,
      ano: parseInt(ano),
      faturamento_semestral: parseFloat(poolForm.faturamento) || 0,
      meta_faturamento: parseFloat(poolForm.meta_faturamento) || 0,
      pool_definido: parseFloat(poolForm.pool_definido) || 0,
      gatilho_atingido: (parseFloat(poolForm.faturamento) || 0) >= (parseFloat(poolForm.meta_faturamento) || 0) * 0.8,
      status: "pendente",
    };

    const res = await fetch(`${baseUrl}/rest/v1/rh_pools_semestrais`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success("Pool semestral criado!");
      setPoolDialogOpen(false);
      setPoolForm({ faturamento: "", meta_faturamento: "", pool_definido: "" });
      loadData();
    } else {
      toast.error("Erro ao criar pool");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Apuração de Bônus</h1>
              <p className="text-sm text-muted-foreground">Acompanhamento semestral de metas e bonificação</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedSemestre} onValueChange={setSelectedSemestre}>
              <SelectTrigger className="w-36">
                <Calendar className="w-3.5 h-3.5 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                {semestres.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && !pool && (
              <Button size="sm" onClick={() => setPoolDialogOpen(true)}>
                <DollarSign className="w-4 h-4 mr-1" /> Definir Pool
              </Button>
            )}
          </div>
        </div>

        {/* Pool Summary */}
        {pool && (
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="text-lg font-bold">{fmt(pool.faturamento_semestral)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meta Fat.</p>
                  <p className="text-lg font-bold">{fmt(pool.meta_faturamento)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gatilho 80%</p>
                  <Badge className={pool.gatilho_atingido
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-none"
                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-none"
                  }>
                    {pool.gatilho_atingido ? "✅ Atingido" : "❌ Não atingido"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pool Definido</p>
                  <p className="text-lg font-bold">{fmt(pool.pool_definido)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Bônus</p>
                  <p className="text-lg font-bold text-primary">{fmt(totalBonus)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {!loading && apuracoes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{apuracoes.length}</p>
                <p className="text-xs text-muted-foreground">Colaboradores</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <Target className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{avgPontuacao}</p>
                <p className="text-xs text-muted-foreground">Pontuação Média</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                <p className="text-2xl font-bold">{apuracoes.filter(a => a.faixa_termometro === "Supermeta").length}</p>
                <p className="text-xs text-muted-foreground">Supermetas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <AlertCircle className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <p className="text-2xl font-bold">{apuracoes.filter(a => a.faixa_termometro === "Atenção").length}</p>
                <p className="text-xs text-muted-foreground">Em Atenção</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Apurações List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : apuracoes.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma apuração para este semestre.</p>
            {isAdmin && pool && (
              <p className="text-sm mt-2">Crie as apurações individuais para cada colaborador.</p>
            )}
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Apurações Individuais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apuracoes.map(a => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedApuracao(a)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{profiles[a.membro_id] || "Colaborador"}</p>
                        <Badge variant="outline" className="text-xs">{SETOR_LABEL[a.setor || ""] || a.setor}</Badge>
                        <Badge variant="outline" className="text-xs">{NIVEL_LABEL[a.nivel || ""] || a.nivel}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 max-w-[200px]">
                          <Progress value={a.pontuacao_total} className="h-2" />
                        </div>
                        <span className="text-xs text-muted-foreground">{a.pontuacao_total}pts</span>
                      </div>
                    </div>
                    <Badge className={`${FAIXA_COLORS[a.faixa_termometro] || ""} border-none text-xs`}>
                      {FAIXA_ICONS[a.faixa_termometro] || ""} {a.faixa_termometro}
                    </Badge>
                    <div className="text-right min-w-[80px]">
                      <p className="text-sm font-bold">{fmt(a.bonus_final)}</p>
                      <p className="text-xs text-muted-foreground">{STATUS_LABEL[a.status] || a.status}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pool Dialog */}
      <Dialog open={poolDialogOpen} onOpenChange={setPoolDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Pool Semestral — {selectedSemestre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Faturamento Semestral (R$)</Label>
              <Input type="number" value={poolForm.faturamento} onChange={e => setPoolForm(p => ({ ...p, faturamento: e.target.value }))} />
            </div>
            <div>
              <Label>Meta de Faturamento (R$)</Label>
              <Input type="number" value={poolForm.meta_faturamento} onChange={e => setPoolForm(p => ({ ...p, meta_faturamento: e.target.value }))} />
            </div>
            <div>
              <Label>Pool Definido (R$)</Label>
              <Input type="number" value={poolForm.pool_definido} onChange={e => setPoolForm(p => ({ ...p, pool_definido: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoolDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePool}>Criar Pool</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apuracao Detail Dialog */}
      <Dialog open={!!selectedApuracao} onOpenChange={() => setSelectedApuracao(null)}>
        <DialogContent className="max-w-lg">
          {selectedApuracao && (
            <>
              <DialogHeader>
                <DialogTitle>{profiles[selectedApuracao.membro_id] || "Colaborador"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{SETOR_LABEL[selectedApuracao.setor || ""] || selectedApuracao.setor}</Badge>
                  <Badge variant="outline">{NIVEL_LABEL[selectedApuracao.nivel || ""] || selectedApuracao.nivel}</Badge>
                  <Badge className={`${FAIXA_COLORS[selectedApuracao.faixa_termometro] || ""} border-none`}>
                    {FAIXA_ICONS[selectedApuracao.faixa_termometro]} {selectedApuracao.faixa_termometro}
                  </Badge>
                </div>

                {/* Thermometer */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Termômetro de Performance</p>
                  <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${selectedApuracao.pontuacao_total}%`,
                        background: selectedApuracao.pontuacao_total >= 90 ? "#1E7145"
                          : selectedApuracao.pontuacao_total >= 60 ? "#185FA5"
                          : selectedApuracao.pontuacao_total >= 30 ? "#C55A11" : "#C00000",
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {selectedApuracao.pontuacao_total} pontos
                    </span>
                  </div>
                </div>

                {/* Metas */}
                <div className="space-y-2">
                  {[1, 2, 3].map(n => {
                    const batida = selectedApuracao[`meta_${n}_batida` as keyof Apuracao] as boolean;
                    const pontos = selectedApuracao[`meta_${n}_pontos` as keyof Apuracao] as number;
                    const metaId = selectedApuracao[`meta_${n}_id` as keyof Apuracao] as string;
                    return (
                      <div key={n} className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span className="text-sm">{metaId || `Meta ${n}`}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pontos}pts</span>
                          <Badge className={batida
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-none"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-none"
                          }>
                            {batida ? "✅ Batida" : "❌ Não batida"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bonus breakdown */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Multiplicador Base</p>
                    <p className="font-bold">{(selectedApuracao.multiplicador_base * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Mult. Antiguidade</p>
                    <p className="font-bold">+{(selectedApuracao.multiplicador_antiguidade * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Cota Individual</p>
                    <p className="font-bold">{fmt(selectedApuracao.cota_individual)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Bônus Final</p>
                    <p className="font-bold text-primary text-lg">{fmt(selectedApuracao.bonus_final)}</p>
                  </div>
                </div>

                {selectedApuracao.feedback_gestor && (
                  <div>
                    <p className="text-xs text-muted-foreground">Feedback do Gestor</p>
                    <p className="text-sm mt-1 p-2 bg-muted/30 rounded">{selectedApuracao.feedback_gestor}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
