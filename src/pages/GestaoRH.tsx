import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ColaboradorCard } from "@/components/rh/ColaboradorCard";
import { ColaboradorDetalhe } from "@/components/rh/ColaboradorDetalhe";
import { RHDashboard } from "@/components/rh/RHDashboard";
import { RegimentosPlaybooksTab } from "@/components/rh/RegimentosPlaybooksTab";
import { Users, Search, Filter, FileText, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ColaboradorData {
  membroId: string;
  userId: string;
  nome: string | null;
  papel: string;
  fotoUrl: string | null;
  ativo: boolean;
  orgId: string;
  cargo: string | null;
  setor: string | null;
  dataEntrada: string | null;
  regimeTrabalho: string | null;
  liderNome: string | null;
  ultimoFeedbackNota: number | null;
  ultimoFeedbackData: string | null;
  engajamentoScore: number;
}

export default function GestaoRH() {
  const { user } = useAuth();
  const { members, orgId, isAdmin, loading: membersLoading } = useOrgMembers();
  const { rhRole } = usePermissions();
  const [colaboradores, setColaboradores] = useState<ColaboradorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCargo, setFilterCargo] = useState("todos");
  const [selectedColab, setSelectedColab] = useState<ColaboradorData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState("colaboradores");

  // Dashboard stats
  const [dashData, setDashData] = useState({
    totalColaboradores: 0, docsPendentes: 0, contratosPendentes: 0,
    metasAndamento: 0, proximos1on1: 0, pdisAndamento: 0,
  });

  useEffect(() => {
    if (membersLoading || !orgId) return;
    loadColaboradores();
  }, [members, orgId, membersLoading]);

  const loadColaboradores = async () => {
    setLoading(true);
    const now = new Date();

    // For self role, only show own profile
    const relevantMembers = rhRole === "self"
      ? members.filter(m => m.user_id === user?.id)
      : members;

    const relevantMemberIds = relevantMembers.map(m => m.id);
    const relevantUserIds = relevantMembers.map(m => m.user_id);

    const [profilesRes, feedbacksRes, metasRes, reunioesRes] = await Promise.all([
      supabase.from("profiles_publico").select("id, nome, foto_url, ativo, cargo, setor, lider_id, regime_trabalho, data_entrada").in("id", relevantUserIds),
      isAdmin ? supabase.from("rh_feedbacks").select("membro_id, nota, created_at").in("membro_id", relevantMemberIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      supabase.from("rh_metas").select("membro_id, progresso, status").in("membro_id", relevantMemberIds),
      supabase.from("rh_reunioes_1on1").select("membro_id, data_reuniao").in("membro_id", relevantMemberIds),
    ]);
    // Fetch new tables via REST to avoid type generation lag
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || anonKey;
    const hdrs = { apikey: anonKey, Authorization: `Bearer ${token}` };
    const ids = relevantMemberIds.map(i => `"${i}"`).join(",");
    const fetchT = async (t: string, cols: string) => {
      const r = await fetch(`${baseUrl}/rest/v1/${t}?select=${cols}&membro_id=in.(${ids})`, { headers: hdrs });
      return r.ok ? r.json() : [];
    };
    const [pdisData, docsData, contratosData] = await Promise.all([
      fetchT("rh_pdis", "membro_id,status"),
      fetchT("rh_documentos", "membro_id,status_assinatura"),
      fetchT("rh_contratos", "membro_id,status"),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));

    // Build leader name map
    const leaderIds = [...new Set((profilesRes.data || []).map(p => p.lider_id).filter(Boolean))];
    let leaderMap = new Map<string, string>();
    if (leaderIds.length > 0) {
      const { data: leaders } = await supabase.from("profiles_publico").select("id, nome").in("id", leaderIds);
      leaderMap = new Map((leaders || []).map(l => [l.id, l.nome || ""]));
    }

    const feedbacksByMembro = new Map<string, any[]>();
    for (const fb of (feedbacksRes as any).data || []) {
      if (!feedbacksByMembro.has(fb.membro_id)) feedbacksByMembro.set(fb.membro_id, []);
      feedbacksByMembro.get(fb.membro_id)!.push(fb);
    }

    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];

    const activeMetasMembros = new Set(
      (metasRes.data || []).filter(m => m.status === "ativa" && m.progresso > 0).map(m => m.membro_id)
    );
    const recent1on1Membros = new Set(
      (reunioesRes.data || []).filter(r => r.data_reuniao >= thirtyDaysAgo).map(r => r.membro_id)
    );

    // For coordenador, filter by lider_id
    let visibleMembers = relevantMembers;
    if (rhRole === "coordenador") {
      const profilesWithLeader = (profilesRes.data || []).filter(p => p.lider_id === user?.id);
      const leaderUserIds = new Set(profilesWithLeader.map(p => p.id));
      visibleMembers = relevantMembers.filter(m => leaderUserIds.has(m.user_id));
    }

    const enriched: ColaboradorData[] = visibleMembers.map(m => {
      const profile = profileMap.get(m.user_id);
      const fbs = feedbacksByMembro.get(m.id) || [];
      const lastFb = fbs[0] || null;
      const hasRecentFb = fbs.some(fb => fb.created_at >= ninetyDaysAgo);

      const engScore = (hasRecentFb ? 1 : 0) + (activeMetasMembros.has(m.id) ? 1 : 0) + (recent1on1Membros.has(m.id) ? 1 : 0);

      return {
        membroId: m.id, userId: m.user_id,
        nome: profile?.nome || null, papel: m.papel,
        fotoUrl: profile?.foto_url || null, ativo: profile?.ativo ?? true,
        orgId: orgId!, cargo: profile?.cargo || null, setor: profile?.setor || null,
        dataEntrada: profile?.data_entrada || null, regimeTrabalho: profile?.regime_trabalho || null,
        liderNome: profile?.lider_id ? (leaderMap.get(profile.lider_id) || null) : null,
        ultimoFeedbackNota: lastFb?.nota || null, ultimoFeedbackData: lastFb?.created_at || null,
        engajamentoScore: engScore,
      };
    });

    setColaboradores(enriched);

    // Dashboard stats
    const activeMetas = (metasRes.data || []).filter(m => m.status === "ativa").length;
    const upcoming1on1 = (reunioesRes.data || []).filter(r => r.data_reuniao >= new Date().toISOString().split("T")[0]).length;
    const activePdis = (pdisData as any[]).filter((p: any) => p.status === "em_andamento").length;
    const pendingDocs = (docsData as any[]).filter((d: any) => d.status_assinatura === "pendente").length;
    const pendingContratos = (contratosData as any[]).filter((c: any) => c.status === "pendente").length;

    setDashData({
      totalColaboradores: enriched.length,
      docsPendentes: pendingDocs,
      contratosPendentes: pendingContratos,
      metasAndamento: activeMetas,
      proximos1on1: upcoming1on1,
      pdisAndamento: activePdis,
    });

    setLoading(false);
  };

  // For self view, auto-open own profile
  useEffect(() => {
    if (rhRole === "self" && colaboradores.length === 1 && !drawerOpen) {
      setSelectedColab(colaboradores[0]);
      setDrawerOpen(true);
    }
  }, [colaboradores, rhRole]);

  const filtered = colaboradores.filter(c => {
    if (search && !(c.nome || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === "ativo" && !c.ativo) return false;
    if (filterStatus === "inativo" && c.ativo) return false;
    if (filterCargo !== "todos" && c.papel !== filterCargo) return false;
    return true;
  });

  const uniqueCargos = [...new Set(colaboradores.map(c => c.papel))];

  const PAPEL_LABEL: Record<string, string> = {
    admin: "Administrador", agronomo: "Agrônomo", advogado: "Advogado",
    engenheiro_agronomo: "Eng. Agrônomo", estagiario_direito: "Estagiário",
    assessor_juridico: "Assessor Jurídico", pos_venda: "Pós-Venda",
    coordenador: "Coordenador", gestor_pos_venda: "Gestor de Pós-Venda",
    advogado_pos_venda: "Advogado de Pós-Venda", estagiario_pos_venda: "Estagiário de Pós-Venda",
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Users}
          title="Gestão de Pessoas"
          subtitle={
            rhRole === "admin" ? "Retenção de talentos, feedbacks e desenvolvimento" :
            rhRole === "coordenador" ? "Acompanhamento da sua equipe" :
            "Meu perfil e desenvolvimento"
          }
          breadcrumb={[{ label: "Agro" }, { label: "Gestão de Pessoas" }]}
        />

        {/* Dashboard Cards */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="colaboradores"><Users className="w-4 h-4 mr-1.5" /> Colaboradores</TabsTrigger>
            <TabsTrigger value="documentos"><BookOpen className="w-4 h-4 mr-1.5" /> Regimentos & Playbooks</TabsTrigger>
          </TabsList>

          <TabsContent value="colaboradores" className="space-y-6 mt-4">
            {!loading && <RHDashboard role={rhRole} data={dashData} />}

            {(rhRole === "admin" || rhRole === "coordenador") && (
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCargo} onValueChange={setFilterCargo}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Cargo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Cargos</SelectItem>
                {uniqueCargos.map(c => <SelectItem key={c} value={c}>{PAPEL_LABEL[c] || c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rhRole === "self" ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
            <p className="text-muted-foreground">Clique para abrir seu perfil completo</p>
            {colaboradores.length > 0 && (
              <button
                onClick={() => { setSelectedColab(colaboradores[0]); setDrawerOpen(true); }}
                className="mt-4 text-primary underline text-sm"
              >
                Abrir Meu Perfil
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <ColaboradorCard key={c.membroId} nome={c.nome || "Sem nome"} papel={c.papel}
                cargo={c.cargo} setor={c.setor} fotoUrl={c.fotoUrl} ativo={c.ativo}
                ultimoFeedbackNota={c.ultimoFeedbackNota} engajamentoScore={c.engajamentoScore}
                onClick={() => { setSelectedColab(c); setDrawerOpen(true); }}
              />
            ))}
          </div>
        )}
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <RegimentosPlaybooksTab />
          </TabsContent>
        </Tabs>
      </div>

      <ColaboradorDetalhe open={drawerOpen} onOpenChange={setDrawerOpen}
        colaborador={selectedColab} viewerRole={rhRole} />
    </AppLayout>
  );
}
