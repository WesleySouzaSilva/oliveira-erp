import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRole);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return json({ error: "Missing x-api-key header" }, 401);
  }

  // Valida formato
  if (!apiKey.startsWith("oa_live_")) {
    return json({ error: "Invalid API key format" }, 401);
  }

  const keyHash = await hashKey(apiKey);

  const { data: keyRow, error } = await supabase
    .from("api_keys")
    .select("id, organizacao_id, scopes, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !keyRow) {
    return json({ error: "Invalid API key" }, 401);
  }

  if (keyRow.revoked_at) {
    return json({ error: "API key revoked" }, 401);
  }

  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return json({ error: "API key expired" }, 401);
  }

  // ---- Rate limiting: 120 req/min por chave ----
  try {
    const { data: allowed, error: rlErr } = await supabase.rpc("check_rate_limit", {
      _key: `api-gateway:${keyRow.id}`,
      _max_requests: 120,
      _window_seconds: 60,
    });
    if (rlErr) {
      console.error("[api-gateway] rate_limit rpc error", rlErr.message);
    } else if (allowed === false) {
      return json(
        { error: "Rate limit exceeded", limit: 120, window_seconds: 60 },
        429,
      );
    }
  } catch (e) {
    console.error("[api-gateway] rate_limit threw", (e as Error)?.message);
    // Fail-open intencional: não bloqueia chamadas legítimas se a infra de rate-limit falhar.
  }

  // Atualiza last_used_at (fire-and-forget)
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api-gateway\/?/, "");

  // ---- Pagination & incremental filter (opt-in, retrocompatível) ----
  const qLimit = url.searchParams.get("limit");
  const qCursor = url.searchParams.get("cursor");
  const qUpdatedSince = url.searchParams.get("updated_since");
  const MAX_LIMIT = 200;

  function parseCursor(raw: string | null): { ts: string; id: string } | null {
    if (!raw) return null;
    try {
      const decoded = JSON.parse(atob(raw));
      if (decoded && typeof decoded.ts === "string" && typeof decoded.id === "string") return decoded;
    } catch { /* ignore */ }
    return null;
  }
  function makeCursor(ts: string, id: string): string {
    return btoa(JSON.stringify({ ts, id }));
  }
  function validIso(s: string | null): string | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const paginated = qLimit !== null || qCursor !== null || qUpdatedSince !== null;
  const cursor = parseCursor(qCursor);
  const updatedSince = validIso(qUpdatedSince);
  const parsedLimit = qLimit ? Math.min(Math.max(parseInt(qLimit, 10) || 0, 1), MAX_LIMIT) : null;

  // Quando paginado, ordenamos sempre por (created_at DESC, id DESC) para cursor estável,
  // exceto vencimentos que mantém ordenação por vencimento (cursor não se aplica).

  // ---- Scope check ----
  // Mapeia cada endpoint ao scope mínimo necessário. Chaves antigas com scopes
  // vazios/nulos são tratadas como "acesso total" (retrocompatibilidade) e
  // registramos um aviso para acompanhamento.
  const scopeMap: Record<string, string> = {
    "": "clientes:read",
    "clientes": "clientes:read",
    "laudos": "laudos:read",
    "processos": "processos:read",
    "vencimentos": "contratos:read",
    "contratos": "contratos:read",
    "carteira": "kpis:read",
    "kpis": "kpis:read",
    "controladoria/d5": "controladoria:read",
  };
  const requiredScope = scopeMap[path];
  const rawScopes = Array.isArray(keyRow.scopes) ? (keyRow.scopes as string[]) : [];
  const hasNoScopes = rawScopes.length === 0;
  // Aceita scope amplo "read" (chaves novas geradas pelo ApiKeysManager pedem ["read"])
  // ou scope específico tipo "clientes:read".
  const hasFullRead = rawScopes.includes("read") || rawScopes.includes("*") || rawScopes.includes("all");
  if (requiredScope) {
    if (hasNoScopes) {
      console.warn(`[api-gateway] key ${keyRow.id} sem scopes — tratando como acesso total (legado)`);
    } else if (!hasFullRead && !rawScopes.includes(requiredScope)) {
      return json(
        { error: "Insufficient scope", required: requiredScope, granted: rawScopes },
        403,
      );
    }
  }

  // Roteamento simples de API
  try {
    if (path === "clientes" || path === "") {
      if (!paginated) {
        const { data: clientes, error: err } = await supabase
          .from("clientes")
          .select("id, nome, cpf_cnpj, email, telefone, municipio, uf, nome_propriedade, area_hectares, cultura_principal, vip, status_adimplencia, created_at, updated_at")
          .eq("organizacao_id", keyRow.organizacao_id)
          .is("deleted_at", null)
          .order("nome")
          .limit(500);
        if (err) throw err;
        return json({ clientes: clientes || [] });
      }
      const limit = parsedLimit ?? 100;
      let q = supabase
        .from("clientes")
        .select("id, nome, cpf_cnpj, email, telefone, municipio, uf, nome_propriedade, area_hectares, cultura_principal, vip, status_adimplencia, created_at, updated_at")
        .eq("organizacao_id", keyRow.organizacao_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (updatedSince) q = q.gte("updated_at", updatedSince);
      if (cursor) q = q.or(`created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`);
      const { data, error: err } = await q;
      if (err) throw err;
      const rows = data || [];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];
      return json({
        clientes: page,
        next_cursor: hasMore && last ? makeCursor(last.created_at as string, last.id as string) : null,
      });
    }

    if (path === "laudos") {
      if (!paginated) {
        const { data: laudos, error: err } = await supabase
          .from("laudos")
          .select("id, numero_laudo, status, dados_etapa1, created_at, updated_at")
          .eq("organizacao_id", keyRow.organizacao_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500);
        if (err) throw err;
        return json({ laudos: laudos || [] });
      }
      const limit = parsedLimit ?? 100;
      let q = supabase
        .from("laudos")
        .select("id, numero_laudo, status, dados_etapa1, created_at, updated_at")
        .eq("organizacao_id", keyRow.organizacao_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (updatedSince) q = q.gte("updated_at", updatedSince);
      if (cursor) q = q.or(`created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`);
      const { data, error: err } = await q;
      if (err) throw err;
      const rows = data || [];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];
      return json({
        laudos: page,
        next_cursor: hasMore && last ? makeCursor(last.created_at as string, last.id as string) : null,
      });
    }

    if (path === "processos") {
      if (!paginated) {
        const { data: processos, error: err } = await supabase
          .from("processos")
          .select("id, laudo_id, fase_atual, status_fases, datas_fases, created_at, updated_at")
          .eq("organizacao_id", keyRow.organizacao_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500);
        if (err) throw err;
        return json({ processos: processos || [] });
      }
      const limit = parsedLimit ?? 100;
      let q = supabase
        .from("processos")
        .select("id, laudo_id, fase_atual, status_fases, datas_fases, created_at, updated_at")
        .eq("organizacao_id", keyRow.organizacao_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (updatedSince) q = q.gte("updated_at", updatedSince);
      if (cursor) q = q.or(`created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`);
      const { data, error: err } = await q;
      if (err) throw err;
      const rows = data || [];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];
      return json({
        processos: page,
        next_cursor: hasMore && last ? makeCursor(last.created_at as string, last.id as string) : null,
      });
    }

    if (path === "vencimentos" || path === "contratos") {
      if (!paginated) {
        const { data: vencimentos, error: err } = await supabase
          .from("contratos_vencimentos")
          .select("id, nome_cliente, banco, numero_contrato, valor_parcela, valor_total_operacao, parcelas_vencidas, vencimento_proxima_parcela, vencimento_ultima_parcela, primeiro_vencimento, data_limite_protocolo, protocolo_realizado, possui_laudo, laudo_id, status_prazo, resolvido, created_at")
          .eq("organizacao_id", keyRow.organizacao_id)
          .is("deleted_at", null)
          .order("vencimento_proxima_parcela", { ascending: true, nullsFirst: false })
          .limit(1000);
        if (err) throw err;
        return json({ vencimentos: vencimentos || [] });
      }
      const limit = parsedLimit ?? 200;
      let q = supabase
        .from("contratos_vencimentos")
        .select("id, nome_cliente, banco, numero_contrato, valor_parcela, valor_total_operacao, parcelas_vencidas, vencimento_proxima_parcela, vencimento_ultima_parcela, primeiro_vencimento, data_limite_protocolo, protocolo_realizado, possui_laudo, laudo_id, status_prazo, resolvido, created_at, updated_at")
        .eq("organizacao_id", keyRow.organizacao_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (updatedSince) q = q.gte("updated_at", updatedSince);
      if (cursor) q = q.or(`created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`);
      const { data, error: err } = await q;
      if (err) throw err;
      const rows = data || [];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];
      return json({
        vencimentos: page,
        next_cursor: hasMore && last ? makeCursor(last.created_at as string, last.id as string) : null,
      });
    }

    if (path === "carteira" || path === "kpis") {
      const orgId = keyRow.organizacao_id;
      const [clientesRes, laudosRes, processosRes, vencRes] = await Promise.all([
        supabase.from("clientes").select("id, vip, status_adimplencia, area_hectares", { count: "exact" }).eq("organizacao_id", orgId).is("deleted_at", null),
        supabase.from("laudos").select("id, status", { count: "exact" }).eq("organizacao_id", orgId).is("deleted_at", null),
        supabase.from("processos").select("id, fase_atual", { count: "exact" }).eq("organizacao_id", orgId).is("deleted_at", null),
        supabase.from("contratos_vencimentos").select("id, valor_total_operacao, valor_parcela, parcelas_vencidas, status_prazo, resolvido, protocolo_realizado").eq("organizacao_id", orgId).is("deleted_at", null),
      ]);

      const vencimentos = vencRes.data || [];
      const valorTotalCarteira = vencimentos.reduce((s, v: any) => s + (Number(v.valor_total_operacao) || 0), 0);
      const valorTotalEmAtraso = vencimentos
        .filter((v: any) => (v.parcelas_vencidas || 0) > 0 && !v.resolvido)
        .reduce((s, v: any) => s + (Number(v.valor_parcela) || 0) * (Number(v.parcelas_vencidas) || 0), 0);

      return json({
        sob_gestao: valorTotalCarteira,
        volume_total_operacoes: valorTotalCarteira,
        clientes: {
          total: clientesRes.count || 0,
          vip: (clientesRes.data || []).filter((c: any) => c.vip).length,
          area_total_hectares: (clientesRes.data || []).reduce((s, c: any) => s + (Number(c.area_hectares) || 0), 0),
        },
        laudos: {
          total: laudosRes.count || 0,
          por_status: (laudosRes.data || []).reduce((acc: any, l: any) => {
            acc[l.status || "indefinido"] = (acc[l.status || "indefinido"] || 0) + 1;
            return acc;
          }, {}),
        },
        processos: {
          total: processosRes.count || 0,
          por_fase: (processosRes.data || []).reduce((acc: any, p: any) => {
            const k = String(p.fase_atual ?? "indefinida");
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {}),
        },
        contratos: {
          total: vencimentos.length,
          em_atraso: vencimentos.filter((v: any) => (v.parcelas_vencidas || 0) > 0 && !v.resolvido).length,
          resolvidos: vencimentos.filter((v: any) => v.resolvido).length,
          protocolados: vencimentos.filter((v: any) => v.protocolo_realizado).length,
          valor_total_carteira: valorTotalCarteira,
          valor_total_em_atraso: valorTotalEmAtraso,
        },
      });
    }

    if (path === "controladoria/d5") {
      const dataRef = url.searchParams.get("data");
      let q = supabase.from("controladoria_d5_snapshots").select("*").eq("organizacao_id", keyRow.organizacao_id);
      q = dataRef && /^\d{4}-\d{2}-\d{2}$/.test(dataRef) ? q.eq("data_ref", dataRef) : q.order("gerado_em", { ascending: false });
      const { data: snap, error: e1 } = await q.limit(1).maybeSingle();
      if (e1) throw e1;
      if (!snap) return json({ error: "Nenhum retrato encontrado" }, 404);
      const { data: itens, error: e2 } = await supabase.from("controladoria_d5_itens")
        .select("origem, id_externo, titulo, processo, cliente, prazo, d_n, vencida, responsavel_nome, responsavel_email, user_id")
        .eq("snapshot_id", snap.id).order("prazo").limit(5000);
      if (e2) throw e2;
      return json({
        data_ref: snap.data_ref, d0: snap.d0, janela_fim: snap.janela_fim, gerado_em: snap.gerado_em,
        total_janela: snap.total_janela, total_vencidas: snap.total_vencidas, html: snap.html, itens: itens || [],
      });
    }

    return json({
      error: "Unknown endpoint",
      available: ["/clientes", "/laudos", "/processos", "/vencimentos", "/contratos", "/carteira", "/kpis", "/controladoria/d5"],
    }, 404);
  } catch (e: any) {
    console.error("[api-gateway]", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
