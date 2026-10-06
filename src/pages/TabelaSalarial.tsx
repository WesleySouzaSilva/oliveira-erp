import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Building2, Lock } from "lucide-react";

interface FaixaSalarial {
  id: string;
  setor: string;
  nivel: string;
  subfaixa: string;
  sal_min: number;
  sal_max: number;
}

const SETOR_LABEL: Record<string, string> = {
  juridico: "Jurídico",
  comercial: "Comercial",
  marketing: "Marketing",
  pos_venda: "Pós-Venda",
  gestao_pessoas: "Gestão de Pessoas",
};

const NIVEL_ORDER = ["estagiario", "junior", "pleno", "senior", "coordenador", "gestor"];
const NIVEL_LABEL: Record<string, string> = {
  estagiario: "Estagiário",
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  coordenador: "Coordenador",
  gestor: "Gestor",
};

const NIVEL_COLORS: Record<string, string> = {
  estagiario: "bg-muted text-muted-foreground",
  junior: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pleno: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  senior: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  coordenador: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  gestor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function TabelaSalarial() {
  const { user } = useAuth();
  const { orgId, isAdmin } = useOrgMembers();
  const [faixas, setFaixas] = useState<FaixaSalarial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetor, setSelectedSetor] = useState("todos");
  const [userNivel, setUserNivel] = useState<string | null>(null);
  const [userSetor, setUserSetor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Fetch user's own nivel and setor from profile
    supabase.from("profiles").select("nivel, setor").eq("id", user.id).single()
      .then(({ data }) => {
        setUserNivel(data?.nivel || null);
        setUserSetor(data?.setor || null);
      });
  }, [user]);

  useEffect(() => {
    if (!orgId) return;
    loadFaixas();
  }, [orgId]);

  const loadFaixas = async () => {
    setLoading(true);
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || anonKey;
    const res = await fetch(
      `${baseUrl}/rest/v1/rh_tabela_salarial?select=id,setor,nivel,subfaixa,sal_min,sal_max&organizacao_id=eq.${orgId}&order=setor,nivel,subfaixa`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
    );
    const data = res.ok ? await res.json() : [];
    setFaixas(data);
    setLoading(false);
  };

  // Non-admin: must have nivel set — otherwise see nothing
  const visibleFaixas = isAdmin
    ? faixas
    : !userNivel
      ? []
      : faixas.filter(f => {
          if (f.nivel !== userNivel) return false;
          if (userSetor && f.setor !== userSetor) return false;
          return true;
        });

  const setores = [...new Set(visibleFaixas.map(f => f.setor))];
  const filteredFaixas = selectedSetor === "todos" ? visibleFaixas : visibleFaixas.filter(f => f.setor === selectedSetor);

  // Group by setor then nivel
  const grouped = filteredFaixas.reduce((acc, f) => {
    if (!acc[f.setor]) acc[f.setor] = {};
    if (!acc[f.setor][f.nivel]) acc[f.setor][f.nivel] = [];
    acc[f.setor][f.nivel].push(f);
    return acc;
  }, {} as Record<string, Record<string, FaixaSalarial[]>>);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Tabela Salarial</h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Faixas salariais por setor, nível e subfaixa"
                  : "Sua faixa salarial atual"}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Select value={selectedSetor} onValueChange={setSelectedSetor}>
              <SelectTrigger className="w-48">
                <Building2 className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Setores</SelectItem>
                {setores.map(s => (
                  <SelectItem key={s} value={s}>{SETOR_LABEL[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!isAdmin && !userNivel && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-6">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Seu nível ainda não foi definido pelo administrador. Quando configurado, sua faixa salarial aparecerá aqui.
              </p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : Object.keys(grouped).length === 0 && (isAdmin || userNivel) ? (
          <div className="text-center py-20 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma faixa salarial cadastrada.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([setor, niveis]) => (
            <Card key={setor}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  {SETOR_LABEL[setor] || setor}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nível</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Subfaixa</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Salário Mínimo</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Salário Máximo</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Faixa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NIVEL_ORDER.filter(n => niveis[n]).map(nivel =>
                        (niveis[nivel] || [])
                          .sort((a, b) => a.subfaixa.localeCompare(b.subfaixa))
                          .map((f, idx) => (
                            <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              {idx === 0 && (
                                <td rowSpan={niveis[nivel].length} className="py-2 px-3 align-middle">
                                  <Badge className={`${NIVEL_COLORS[nivel] || ""} border-none`}>
                                    {NIVEL_LABEL[nivel] || nivel}
                                  </Badge>
                                </td>
                              )}
                              <td className="text-center py-2 px-3 font-mono text-xs">{f.subfaixa}</td>
                              <td className="text-right py-2 px-3 font-medium">{fmt(f.sal_min)}</td>
                              <td className="text-right py-2 px-3 font-medium">{fmt(f.sal_max)}</td>
                              <td className="text-right py-2 px-3">
                                <div className="w-full bg-muted rounded-full h-2 max-w-[120px] ml-auto">
                                  <div
                                    className="h-2 rounded-full bg-primary/60"
                                    style={{
                                      width: `${Math.min(100, (f.sal_max / (niveis[nivel][niveis[nivel].length - 1]?.sal_max || f.sal_max)) * 100)}%`,
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
}
