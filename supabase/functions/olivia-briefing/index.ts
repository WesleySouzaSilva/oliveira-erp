import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// ====== Permissões (espelha src/hooks/usePermissions.ts) ======
const ROLE_RESTRICTIONS: Record<string, string[]> = {
  advogado: ["novo-laudo","climaticos","laudos","templates","abusividade","comercial","rh"],
  assessor_juridico: ["novo-laudo","climaticos","laudos","templates","abusividade","comercial","rh"],
  estagiario_direito: ["novo-laudo","climaticos","laudos","templates","abusividade","comercial","rh"],
  coordenador: ["novo-laudo","climaticos","laudos","templates","abusividade","rh"],
  agronomo: ["rh"],
  engenheiro_agronomo: ["rh"],
  pos_venda: ["rh"],
  gestor_pos_venda: [],
  advogado_pos_venda: ["rh"],
  estagiario_pos_venda: ["rh"],
  setor_acordos: ["novo-laudo","climaticos","laudos","templates","abusividade","comercial","rh"],
  comercial: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","rh"],
  closer: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","rh"],
  sdr: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","rh"],
  social_seller: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","rh"],
  marketing: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","clientes","rh"],
  gerente_marketing: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","clientes","rh"],
  criacao: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","clientes","rh"],
  copywriter: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","clientes","rh"],
  social_media: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes","vencimentos","clientes","rh"],
};

const MODULE_PERMS: Record<string, string[]> = {
  juridico: ["novo-laudo","climaticos","laudos","templates","abusividade","processos","peticoes"],
  vencimentos: ["vencimentos"],
  comercial: ["comercial"],
  marketing: ["marketing"],
  metricas_comercial: ["comercial"],
  clientes: ["clientes"],
  relatorios: ["relatorios"],
  equipe: ["equipe"],
  gestao: ["gestao"],
  acordos: ["acordos"],
  rh: ["rh"],
  acessos: ["acessos"],
};

function buildCanAccess(papel: string, isAdmin: boolean, groupModulos: string[] | null) {
  if (isAdmin) return (_k: string) => true;
  if (groupModulos && groupModulos.length > 0) {
    const allowed = new Set<string>();
    for (const m of groupModulos) (MODULE_PERMS[m] || []).forEach((p) => allowed.add(p));
    return (k: string) => allowed.has(k);
  }
  const restr = ROLE_RESTRICTIONS[papel] || [];
  return (k: string) => !restr.includes(k);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+/i.test(auth)) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // decoda sub do JWT
    let userId: string | undefined;
    try {
      const tok = auth.replace(/^Bearer\s+/i, "").trim();
      const parts = tok.split(".");
      let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      userId = JSON.parse(atob(b64))?.sub;
    } catch { /* */ }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const d3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const ha7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const ha15 = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
    const ha3 = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

    // ===== Identifica papel + grupo de permissão do usuário =====
    const { data: membro } = await supabase
      .from("membros")
      .select("papel, organizacao_id, permission_group_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const papel = (membro as any)?.papel || "agronomo";
    const isAdmin = papel === "admin";
    let groupModulos: string[] | null = null;
    const groupId = (membro as any)?.permission_group_id;
    if (groupId) {
      const { data: grp } = await supabase
        .from("permission_groups")
        .select("modulos")
        .eq("id", groupId)
        .maybeSingle();
      groupModulos = ((grp as any)?.modulos as string[]) || [];
    }
    const can = buildCanAccess(papel, isAdmin, groupModulos);

    const [profileRes, vencD3Res, vencidosRes, tarefasHojeRes, tarefasAtrasadasRes,
      leadsParadosRes, processosTravadosRes, laudosRascunhoRes, onboardingsRes,
      lancamentoHojeRes] = await Promise.all([
      supabase.from("profiles").select("nome").eq("id", userId).maybeSingle(),
      can("vencimentos") ? supabase.from("contratos_vencimentos")
        .select("nome_cliente, banco, vencimento_proxima_parcela, valor_parcela", { count: "exact" })
        .eq("resolvido", false)
        .gte("vencimento_proxima_parcela", hoje).lte("vencimento_proxima_parcela", d3)
        .order("vencimento_proxima_parcela").limit(5)
        : Promise.resolve({ data: [], count: 0 } as any),
      can("vencimentos") ? supabase.from("contratos_vencimentos")
        .select("id", { count: "exact", head: true })
        .eq("resolvido", false).lt("vencimento_proxima_parcela", hoje)
        : Promise.resolve({ data: null, count: 0 } as any),
      supabase.from("tarefas")
        .select("id, titulo, prioridade, nome_cliente", { count: "exact" })
        .eq("concluida", false).eq("data_vencimento", hoje).limit(5),
      supabase.from("tarefas")
        .select("id", { count: "exact", head: true })
        .eq("concluida", false).lt("data_vencimento", hoje),
      can("comercial") ? supabase.from("comercial_leads")
        .select("id, nome, etapa_funil, updated_at", { count: "exact" })
        .not("etapa_funil", "in", "(fechado,perdido)")
        .lt("updated_at", ha7).order("updated_at").limit(5)
        : Promise.resolve({ data: [], count: 0 } as any),
      can("processos") ? supabase.from("processos")
        .select("id, laudo_id, fase_atual, updated_at", { count: "exact" })
        .lt("updated_at", ha15).is("deleted_at", null).order("updated_at").limit(5)
        : Promise.resolve({ data: [], count: 0 } as any),
      can("laudos") ? supabase.from("laudos")
        .select("id, numero_laudo, dados_etapa1, updated_at", { count: "exact" })
        .eq("status", "rascunho").is("deleted_at", null)
        .lt("updated_at", ha7).limit(5)
        : Promise.resolve({ data: [], count: 0 } as any),
      // Onboardings parados — visível para gestores/admin do pós-venda
      (isAdmin || papel === "gestor_pos_venda" || papel === "pos_venda")
        ? supabase.from("pos_venda_onboardings")
          .select("id, cliente_nome, status, updated_at", { count: "exact" })
          .neq("status", "concluido")
          .lt("updated_at", ha3).order("updated_at").limit(5)
        : Promise.resolve({ data: [], count: 0 } as any),
      // Lançamento de marketing pendente hoje — só para gerente_marketing/admin
      (isAdmin || papel === "gerente_marketing")
        ? supabase.from("mkt_lancamentos_diarios")
          .select("id", { count: "exact", head: true })
          .eq("data", hoje)
        : Promise.resolve({ data: null, count: null } as any),
    ]);

    const nome = profileRes?.data?.nome?.split(/\s+/)[0] || null;
    const alertas: any[] = [];

    const vencD3 = vencD3Res.data || [];
    if (can("vencimentos") && vencD3.length) alertas.push({
      tipo: "vencimentos_d3",
      titulo: `${vencD3.length} vencimento${vencD3.length > 1 ? "s" : ""} nos próximos 3 dias`,
      itens: vencD3.map(v => `${v.nome_cliente}${v.banco ? ` (${v.banco})` : ""} — ${v.vencimento_proxima_parcela}`),
      acao: { tipo: "navegar", rota: "/vencimentos" },
    });

    const vencidos = vencidosRes.count || 0;
    if (can("vencimentos") && vencidos > 0) alertas.push({
      tipo: "vencidos",
      titulo: `${vencidos} vencimento${vencidos > 1 ? "s atrasados" : " atrasado"} sem resolução`,
      acao: { tipo: "navegar", rota: "/vencimentos" },
    });

    const tarefasHoje = tarefasHojeRes.data || [];
    if (tarefasHoje.length) alertas.push({
      tipo: "tarefas_hoje",
      titulo: `${tarefasHojeRes.count} tarefa${(tarefasHojeRes.count || 0) > 1 ? "s" : ""} para hoje`,
      itens: tarefasHoje.map(t => `${t.titulo}${t.nome_cliente ? ` — ${t.nome_cliente}` : ""}`),
      acao: { tipo: "navegar", rota: "/tarefas" },
    });

    const tarefasAtras = tarefasAtrasadasRes.count || 0;
    if (tarefasAtras > 0) alertas.push({
      tipo: "tarefas_atrasadas",
      titulo: `${tarefasAtras} tarefa${tarefasAtras > 1 ? "s atrasadas" : " atrasada"}`,
      acao: { tipo: "navegar", rota: "/tarefas" },
    });

    const leadsParados = leadsParadosRes.data || [];
    if (can("comercial") && leadsParados.length) alertas.push({
      tipo: "leads_parados",
      titulo: `${leadsParadosRes.count} lead${(leadsParadosRes.count || 0) > 1 ? "s parados" : " parado"} há 7+ dias`,
      itens: leadsParados.map(l => `${l.nome} (${l.etapa_funil}) — ${diasEntre(l.updated_at, new Date().toISOString())}d`),
      acao: { tipo: "navegar", rota: "/gestao-comercial" },
    });

    const procTravados = processosTravadosRes.data || [];
    if (can("processos") && procTravados.length) alertas.push({
      tipo: "processos_travados",
      titulo: `${processosTravadosRes.count} processo${(processosTravadosRes.count || 0) > 1 ? "s" : ""} parado${(processosTravadosRes.count || 0) > 1 ? "s" : ""} há 15+ dias`,
      itens: procTravados.map(p => `Fase ${p.fase_atual} — sem mexer há ${diasEntre(p.updated_at, new Date().toISOString())}d`),
      acao: { tipo: "navegar", rota: "/processos" },
    });

    const rascunhosVelhos = laudosRascunhoRes.data || [];
    if (can("laudos") && rascunhosVelhos.length) alertas.push({
      tipo: "laudos_rascunho",
      titulo: `${laudosRascunhoRes.count} laudo${(laudosRascunhoRes.count || 0) > 1 ? "s em rascunho" : " em rascunho"} há 7+ dias`,
      itens: rascunhosVelhos.map(l => `${l.numero_laudo || "—"} (${(l.dados_etapa1 as any)?.nomeProdutor || (l.dados_etapa1 as any)?.nome || "sem produtor"})`),
      acao: { tipo: "navegar", rota: "/meus-laudos" },
    });

    // Onboardings parados (gestor_pos_venda / admin / pos_venda)
    const onb = (onboardingsRes as any)?.data || [];
    if (onb.length) alertas.push({
      tipo: "onboardings_parados",
      titulo: `${(onboardingsRes as any).count} onboarding${((onboardingsRes as any).count || 0) > 1 ? "s parados" : " parado"} há 3+ dias`,
      itens: onb.map((o: any) => `${o.cliente_nome || "(sem cliente)"} — ${o.status || "em andamento"}`),
      acao: { tipo: "navegar", rota: "/pos-venda/onboarding" },
    });

    // Marketing — lançamento diário ausente hoje
    const lancCount = (lancamentoHojeRes as any)?.count;
    if (lancCount === 0 && (isAdmin || papel === "gerente_marketing")) alertas.push({
      tipo: "lancamento_marketing_pendente",
      titulo: "Lançamento diário de marketing ainda não preenchido hoje",
      acao: { tipo: "navegar", rota: "/metricas/marketing" },
    });

    // Saudação contextual
    const h = new Date().getHours();
    const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const cabecalho = nome ? `${saudacao}, **${nome}**!` : `${saudacao}!`;

    return new Response(JSON.stringify({
      cabecalho,
      tem_alertas: alertas.length > 0,
      alertas,
      vazio_msg: alertas.length === 0 ? "Tudo em dia por aqui — sem vencimentos críticos, tarefas atrasadas ou leads parados. Bora produzir!" : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("olivia-briefing erro", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});