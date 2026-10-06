
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { carregarCalendario, dataEvento } from "../_shared/dias-uteis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADVBOX_BASE = "https://app.advbox.com.br/api/v1";

// ---- Ids fixos do ADVBOX ---------------------------------------------------
const U = {
  willian: 151894,
  maycon: 151893,
  fernanda: 265642,
  vitoria: 274073,
  lucas: 296876,
  adrielli: 301807, // financeiro
};
const T = {
  pedido_administrativo: 4751238,
  aguardar_email: 4751240,
  acompanhar_citacao: 4640483,
  encaminhar_laudo: 9469100,
  solicitar_documentos: 4640585,
  cobrar_honorarios_boleto: 4640589,
};
// Processo aberto pela integração: mesma fase e tipo usados nos processos rurais.
const STAGE_ONBOARDING = 2119743; // 1º CONTATO (ONBOARDING)
const TIPO_ALONGAMENTO = 1439148; // ALONGAMENTO DE DÍVIDA RURAL

// ---- Utilidades de data/texto ---------------------------------------------
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const somaDias = (base: string | Date, dias: number) => {
  const d = typeof base === "string" ? new Date(`${base}T00:00:00`) : new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
};
const br = (s?: string | null) => (s ? s.split("-").reverse().join("/") : "sem data");
const brDate = (d: Date) => br(isoDia(d));
const moeda = (v: number | null | undefined) =>
  v == null ? "saldo não informado" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

/**
 * Quem PROTOCOLA (peticionamento e cobrança do banco): só Willian ou Vitoria,
 * nunca quem mapeia. Carteira da Fernanda e da Vitoria → Vitoria; demais → Willian.
 */
const protocolador = (resp?: string | null) => {
  const r = (resp || "").toLowerCase();
  return r.includes("vit") || r.includes("fernanda") ? U.vitoria : U.willian;
};

/** Quem MAPEIA: Willian→Maycon; Maycon→Maycon; Fernanda→Fernanda; Vitória→Fernanda. */
const mapeador = (resp?: string | null) => {
  const r = (resp || "").toLowerCase();
  if (r.includes("fernanda") || r.includes("vit")) return U.fernanda;
  return U.maycon;
};

type OpBasica = {
  id?: string | null;
  numero?: string | null;
  vence_em?: string | null;
  saldo_devedor?: number | null;
  data_conferida?: boolean | null;
};

/** Texto padrão de uma tarefa por titular + banco. */
function textoGrupo(cliente: string, banco: string, ops: OpBasica[]) {
  const lista = ops
    .map((o) => {
      const venc = o.vence_em ? `vence ${br(o.vence_em)}` : "sem vencimento";
      const conf = o.vence_em ? (o.data_conferida ? "data conferida" : "data NÃO conferida") : "";
      return `${o.numero || "número a conferir"} (${venc}${conf ? `, ${conf}` : ""}, ${moeda(o.saldo_devedor)})`;
    })
    .join("; ");
  return (
    `${cliente} — ${banco}. Operações conhecidas: ${lista}. ` +
    `Podem existir outras operações neste banco: o pedido cobre todas as operações do titular junto à instituição.`
  );
}

// Cooperativas: o nome genérico não identifica a parte contrária.
const BANCOS_GENERICOS = ["cresol", "sicredi", "sicoob", "unicred", "cresol baser", "sistema cresol"];
const MSG_BANCO_GENERICO =
  "Nome genérico: informe a cooperativa singular (ex.: Cresol Triunfo, Sicredi Campos Gerais). Sem isso o processo não pode ser aberto no ADVBOX.";
const PENDENCIA_BANCO_GENERICO =
  "Identificar a instituição exata na cédula antes de abrir o processo no ADVBOX";
const bancoGenerico = (banco?: string | null) =>
  BANCOS_GENERICOS.includes((banco || "").trim().toLowerCase().replace(/\s+/g, " "));

/** Menor vencimento (ou null) de um grupo. */
function vencimentoMaisProximo(ops: OpBasica[]): string | null {
  const datas = ops.map((o) => o.vence_em).filter(Boolean) as string[];
  if (!datas.length) return null;
  return datas.sort()[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- AUTH ---------------------------------------------------------------
    // Two accepted modes:
    //  (a) User JWT (header "Authorization: Bearer <jwt>") — normal app calls.
    //  (b) Shared cron secret (header "x-cron-secret") — pg_cron path.
    const authHeader = req.headers.get("Authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");

    // Resolve expected cron secret: prefer DB-stored value (used by pg_cron),
    // fall back to env var if present. Lookup uses service_role (declared below)
    // — so create the admin client first.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let expectedCronSecret: string | null = null;
    if (cronSecretHeader) {
      const { data: row } = await supabaseAdmin
        .from("app_secrets")
        .select("value")
        .eq("key", "advbox_cron_secret")
        .maybeSingle();
      expectedCronSecret = (row?.value as string | undefined) ?? Deno.env.get("ADVBOX_CRON_SECRET") ?? null;
    }
    const isCron =
      !!cronSecretHeader &&
      !!expectedCronSecret &&
      cronSecretHeader === expectedCronSecret;

    if (!isCron && !authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-scoped client + userId only when in JWT mode.
    let supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      authHeader
        ? { global: { headers: { Authorization: authHeader } } }
        : undefined
    );
    const token = authHeader ? authHeader.replace("Bearer ", "") : "";
    let userId = "";
    if (!isCron) {
      const { data: claimsData, error: claimsError } =
        await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    const ADVBOX_TOKEN = Deno.env.get("ADVBOX_TOKEN") ?? Deno.env.get("ADVBOX_API_TOKEN");
    if (!ADVBOX_TOKEN) {
      return new Response(
        JSON.stringify({ error: "ADVBOX_TOKEN not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // (supabaseAdmin already initialized above for cron-secret lookup)

    const { action, params } = await req.json();
    const advboxHeaders: Record<string, string> = {
      Authorization: `Bearer ${ADVBOX_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "OliveiraAgroApp/1.0",
    };

    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /**
     * Chamada ao ADVBOX com espera automática quando o limite de requisições é
     * atingido (429). Mensagem clara em PT-BR quando o token está inválido (401).
     */
    const fetchAdvbox = async (url: string, options?: RequestInit) => {
      const MAX_TENTATIVAS = 4;
      for (let tentativa = 1; ; tentativa++) {
        const res = await fetch(url, {
          ...options,
          headers: { ...advboxHeaders, ...options?.headers },
        });
        const text = await res.text();

        if (res.status === 429 && tentativa < MAX_TENTATIVAS) {
          const retryAfter = Number(res.headers.get("Retry-After"));
          const espera_ms = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 30_000)
            : Math.min(2000 * 2 ** (tentativa - 1), 30_000);
          await espera(espera_ms);
          continue;
        }

        if (res.status === 401 || res.status === 403) {
          throw new Error(
            "Acesso ao ADVBOX recusado (credencial inválida ou expirada). Atualize o token de integração do ADVBOX.",
          );
        }
        if (res.status === 429) {
          throw new Error(
            "O ADVBOX está limitando as consultas no momento (muitas requisições). Tente novamente em alguns minutos.",
          );
        }

        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Advbox returned non-JSON (${res.status}): ${text.substring(0, 200)}`);
        }
        if (!res.ok) throw new Error(`Advbox API error [${res.status}]: ${JSON.stringify(data)}`);
        return data;
      }
    };

    /** Chama esta mesma função (reaproveita a rotina das 07:00 sem duplicar código). */
    const chamarSelf = async (corpo: unknown) => {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/advbox-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(cronSecretHeader ? { "x-cron-secret": cronSecretHeader } : {}),
        },
        body: JSON.stringify(corpo),
      });
      return await res.json();
    };

    /**
     * Número real da tarefa (id do post) quando o POST não devolve o id:
     * lê a página mais recente de tarefas e casa pelo processo e tipo.
     * Uma única consulta por tarefa, respeitando o limite do ADVBOX.
     */
    const acharPostId = async (lawsuitsId: unknown, tasksId: unknown) => {
      try {
        const lote: any = await fetchAdvbox(`${ADVBOX_BASE}/posts?limit=100&offset=0`);
        const itens: any[] = lote?.data ?? (Array.isArray(lote) ? lote : []);
        const doProcesso = itens.filter((p) => String(p.lawsuits_id ?? "") === String(lawsuitsId));
        const doTipo = doProcesso.filter(
          (p) => String(p.tasks_id ?? p.task_id ?? "") === String(tasksId),
        );
        const candidatos = doTipo.length ? doTipo : doProcesso;
        candidatos.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
        return candidatos[0]?.id ?? null;
      } catch {
        return null;
      }
    };

    let result: unknown;


    switch (action) {
      case "test_connection": {
        const data = await fetchAdvbox(`${ADVBOX_BASE}/settings`);
        result = { connected: true, users: data };
        break;
      }

      // Read-only: returns the ADVBOX account settings payload as-is
      // (users, task types, lawsuit types/groups, stages, customer origins...).
      // Never logs or persists the response — it is returned to the caller only.
      case "get_settings": {
        result = await fetchAdvbox(`${ADVBOX_BASE}/settings`);
        break;
      }

      case "list_lawsuits": {
        const page = params?.page || 1;
        result = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits?page=${page}&per_page=50`);
        break;
      }

      case "get_lawsuit": {
        const id = String(params?.id ?? "").replace(/\D/g, "");
        if (!id) throw new Error("id obrigatório");
        result = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits/${id}`);
        break;
      }

      // Somente leitura: dados mínimos dos processos informados, para a fila de
      // vencidas conferir se já existe ação com aquele banco antes de peticionar.
      case "processos_resumo": {
        const ids = Array.from(
          new Set(
            (Array.isArray(params?.ids) ? params.ids : [])
              .map((i: unknown) => String(i ?? "").replace(/\D/g, ""))
              .filter(Boolean),
          ),
        ).slice(0, 20) as string[];
        const processos: Record<string, unknown> = {};
        for (const id of ids) {
          try {
            const raw = (await fetchAdvbox(`${ADVBOX_BASE}/lawsuits/${id}`)) as any;
            const l = raw?.data ?? raw;
            processos[id] = {
              numero: l?.process_number ?? l?.protocol_number ?? null,
              tipo: l?.type_lawsuits?.name ?? l?.type_lawsuit ?? l?.folder ?? null,
              distribuicao: (l?.date ?? l?.distribution_date ?? l?.created_at ?? null)?.toString().slice(0, 10) ?? null,
            };
          } catch {
            processos[id] = { numero: null, tipo: null, distribuicao: null, erro: true };
          }
          // Respeita o limite de leitura do ADVBOX (30 GET/min).
          await new Promise((r) => setTimeout(r, 2100));
        }
        result = { processos };
        break;
      }

      // Fase B — criação de processo (POST /lawsuits). Campos whitelisted.
      case "create_lawsuit": {
        const p = params ?? {};
        // A parte contrária só entra na criação: banco genérico bloqueia o processo.
        if (bancoGenerico(p.banco as string | undefined)) {
          const quem = mapeador(p.responsavel as string | undefined);
          await supabaseAdmin.from("advbox_pendencias").insert({
            tipo: "banco_generico",
            titulo: PENDENCIA_BANCO_GENERICO,
            descricao:
              `${p.cliente_nome || "Cliente"} — banco "${p.banco}" está genérico. ` +
              `Conferir a cooperativa singular na cédula (operação ${p.numero || "sem número"}). Mapeamento: ${quem}.`,
            status: "aberta",
          });
          result = { ok: false, bloqueado: "banco_generico", motivo: MSG_BANCO_GENERICO };
          break;
        }
        const body: Record<string, unknown> = {
          users_id: String(p.users_id ?? ""),
          customers_id: Array.isArray(p.customers_id) ? p.customers_id.map((x: unknown) => Number(x)) : [],
          stages_id: String(p.stages_id ?? ""),
          type_lawsuits_id: String(p.type_lawsuits_id ?? ""),
        };
        if (typeof p.notes === "string" && p.notes.trim()) body.notes = p.notes;
        if (typeof p.folder === "string" && p.folder.trim()) body.folder = p.folder.slice(0, 30);
        if (!body.users_id || !body.stages_id || !body.type_lawsuits_id || (body.customers_id as number[]).length === 0) {
          throw new Error("users_id, customers_id, stages_id e type_lawsuits_id são obrigatórios");
        }
        result = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        break;
      }

      // Fase B — atualização pontual de processo (PUT /lawsuits/{id}).
      case "update_lawsuit": {
        const id = String(params?.id ?? "").replace(/\D/g, "");
        if (!id) throw new Error("id obrigatório");
        const p = params?.fields ?? {};
        const allowed = ["users_id", "customers_id", "customers", "stages_id", "type_lawsuits_id", "process_number", "protocol_number", "folder", "date", "notes"];
        const body: Record<string, unknown> = {};
        for (const k of allowed) if (p[k] !== undefined) body[k] = p[k];
        if (Object.keys(body).length === 0) throw new Error("nenhum campo para atualizar");
        result = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        break;
      }

      // Vincular parte (cliente/parte contrária) a processo existente.
      case "add_lawsuit_customer": {
        const id = String(params?.id ?? "").replace(/\D/g, "");
        const customerId = String(params?.customers_id ?? "").replace(/\D/g, "");
        if (!id || !customerId) throw new Error("id e customers_id obrigatórios");
        result = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits/${id}/customers`, {
          method: "POST",
          body: JSON.stringify({ customers_id: [Number(customerId)] }),
        });
        break;
      }



      // Fase C — criação de tarefa em processo (POST /tasks). Campos whitelisted.
      case "create_task": {
        const p = params ?? {};
        const body: Record<string, unknown> = {};
        const allowed = [
          "tasks_id", "lawsuits_id", "users_id", "from", "guests", "comments",
          "start_date", "start_time", "end_date", "end_time",
          "date_deadline", "hour_deadline", "urgent", "important", "display_schedule",
        ];
        for (const k of allowed) if (p[k] !== undefined) body[k] = p[k];
        if (!body.tasks_id || !body.lawsuits_id) {
          throw new Error("tasks_id e lawsuits_id são obrigatórios");
        }
        result = await fetchAdvbox(`${ADVBOX_BASE}/posts`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        break;
      }

      // Disparo imediato de UM cliente: cadastro no ADVBOX, processo por
      // titular + banco contratado e as tarefas cuja data de agenda já chegou.
      // As regras de dias úteis, responsável e prazo fatal são as da rotina.
      // params: { cliente_id, motivo? }
      case "disparo_imediato": {
        const p = (params ?? {}) as Record<string, unknown>;
        if (!p.cliente_id) throw new Error("cliente_id obrigatório");
        const clienteId = String(p.cliente_id);
        const motivo = String(p.motivo ?? "disparo imediato");

        const { data: cliRow } = await supabaseAdmin
          .from("clientes")
          .select("id, nome, cpf_cnpj, organizacao_id, advbox_customers_id")
          .eq("id", clienteId)
          .maybeSingle();
        const cli = cliRow as any;
        if (!cli) throw new Error("cliente não encontrado");

        const { data: opRows } = await supabaseAdmin
          .from("operacoes_credito")
          .select("id, banco, numero, vence_em, responsavel, advbox_lawsuits_id")
          .eq("cliente_id", clienteId)
          .is("deleted_at", null);
        const opsCli = ((opRows as any[]) || []);

        const { data: escRows } = await supabaseAdmin
          .from("cliente_banco_escopo")
          .select("banco, escopo")
          .eq("cliente_id", clienteId);
        const escopoDe = new Map<string, string>();
        for (const e of ((escRows as any[]) || [])) {
          escopoDe.set(String(e.banco).trim().toLowerCase(), e.escopo);
        }

        const bloqueios: string[] = [];
        const porBancoD = new Map<string, { banco: string; ops: any[] }>();
        for (const o of opsCli) {
          const banco = String(o.banco || "").trim();
          if (!banco) { bloqueios.push("operação sem banco informado"); continue; }
          const k = banco.toLowerCase();
          // Só banco marcado como CONTRATADO gera envio. Sem marcação não envia.
          if (escopoDe.get(k) !== "contratado") {
            bloqueios.push(
              escopoDe.has(k) ? `${banco}: banco não contratado` : `${banco}: banco sem marcação de contratado`,
            );
            continue;
          }

          if (bancoGenerico(banco)) { bloqueios.push(`${banco}: ${MSG_BANCO_GENERICO}`); continue; }
          if (!porBancoD.has(k)) porBancoD.set(k, { banco, ops: [] });
          porBancoD.get(k)!.ops.push(o);
        }

        // (a) cadastro do cliente no ADVBOX — procurar antes de criar.
        const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
        let customersId: string | null = cli.advbox_customers_id ? String(cli.advbox_customers_id) : null;
        if (!customersId && porBancoD.size > 0) {
          try {
            const busca: any = await fetchAdvbox(
              `${ADVBOX_BASE}/customers?search=${encodeURIComponent(cli.cpf_cnpj || cli.nome || "")}`,
            );
            const lista: any[] = Array.isArray(busca) ? busca : (busca?.data ?? []);
            const doc = soDigitos(cli.cpf_cnpj);
            const achado = lista.find((c: any) =>
              (doc && soDigitos(c.identification ?? c.cpf ?? c.cnpj) === doc) ||
              String(c.name ?? c.nome ?? "").trim().toLowerCase() ===
                String(cli.nome || "").trim().toLowerCase());
            if (achado?.id) customersId = String(achado.id);
          } catch {
            // busca indisponível: segue para a criação
          }
        }
        if (!customersId && porBancoD.size > 0) {
          const criado: any = await fetchAdvbox(`${ADVBOX_BASE}/customers`, {
            method: "POST",
            body: JSON.stringify({
              customer: { name: cli.nome, identification: cli.cpf_cnpj || undefined },
            }),
          });
          const novoId = criado?.id ?? criado?.data?.id ?? null;
          if (novoId) customersId = String(novoId);
        }
        if (customersId && String(cli.advbox_customers_id ?? "") !== customersId) {
          await supabaseAdmin.from("clientes")
            .update({ advbox_customers_id: customersId })
            .eq("id", clienteId);
        }

        // (b) processo por titular + banco, só quando ainda não existe.
        const processos: any[] = [];
        for (const g of porBancoD.values()) {
          const jaTem = g.ops.find((o: any) => o.advbox_lawsuits_id);
          if (jaTem) {
            processos.push({ banco: g.banco, lawsuits_id: String(jaTem.advbox_lawsuits_id), criado: false });
            const semVinculo = g.ops.filter((o: any) => !o.advbox_lawsuits_id).map((o: any) => o.id);
            if (semVinculo.length) {
              await supabaseAdmin.from("operacoes_credito")
                .update({
                  advbox_lawsuits_id: String(jaTem.advbox_lawsuits_id),
                  advbox_titular_customers_id: customersId,
                })
                .in("id", semVinculo);
            }
            continue;
          }
          if (!customersId) { bloqueios.push(`${g.banco}: cliente sem cadastro no ADVBOX`); continue; }
          const respGrupo = g.ops.find((o: any) => o.responsavel)?.responsavel ?? null;
          try {
            const criadoProc: any = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits`, {
              method: "POST",
              body: JSON.stringify({
                users_id: String(protocolador(respGrupo)),
                customers_id: [Number(customersId)],
                stages_id: String(STAGE_ONBOARDING),
                type_lawsuits_id: String(TIPO_ALONGAMENTO),
                notes: `Alongamento rural - ${g.banco} - operacoes: ${
                  g.ops.map((o: any) => o.numero || "sem numero").join(", ")
                }`.slice(0, 500),
              }),
            });
            const lawId = criadoProc?.id ?? criadoProc?.data?.id ?? null;
            if (!lawId) { bloqueios.push(`${g.banco}: o ADVBOX não devolveu o número do processo`); continue; }
            await supabaseAdmin.from("operacoes_credito")
              .update({ advbox_lawsuits_id: String(lawId), advbox_titular_customers_id: customersId })
              .in("id", g.ops.map((o: any) => o.id));
            processos.push({ banco: g.banco, lawsuits_id: String(lawId), criado: true });
          } catch (e) {
            bloqueios.push(`${g.banco}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        // (c) tarefas já dentro da janela — mesma rotina, só deste cliente.
        // Marcação em lote de cliente antigo pela Base: operação já vencida NÃO
        // vira tarefa; vai para a fila de vencidas para ser classificada lá.
        const semVencidas = p.sem_vencidas === true || p.origem === "base_lote";
        let tarefas = 0;
        let detalhes: any = {};
        if (processos.length) {
          const r: any = await chamarSelf({
            action: "sync_tarefas",
            params: { cliente_id: clienteId, forcar_dia: true, sem_vencidas: semVencidas },
          });
          const d = r?.data ?? r;
          tarefas = Number(d?.criadas ?? 0);
          detalhes = {
            fila_proxima_rodada: d?.fila_amanha ?? 0,
            vencidas_para_fila: semVencidas ? Number(d?.vencidas_para_fila ?? 0) : 0,
            falhas: d?.falhas ?? [],
            erro: d?.error ?? null,
          };
        }

        for (const g of porBancoD.values()) {
          for (const o of g.ops) {
            if (!o.vence_em) {
              bloqueios.push(`${g.banco} nº ${o.numero || "sem número"}: operação sem data de vencimento`);
            }
          }
        }
        const bloqueiosUnicos = [...new Set(bloqueios)];

        await supabaseAdmin.from("advbox_disparos").insert({
          organizacao_id: cli.organizacao_id ?? null,
          cliente_id: clienteId,
          motivo,
          customers_id: customersId,
          processos,
          tarefas,
          detalhes,
          bloqueios: bloqueiosUnicos,
          disparado_por: userId || null,
        });

        result = {
          ok: true,
          cliente: cli.nome,
          customers_id: customersId,
          processos,
          tarefas,
          bloqueios: bloqueiosUnicos,
          detalhes,
        };
        break;
      }



      // Fase C — rotina de tarefas do ADVBOX a partir das operações do radar.
      // Uma tarefa de peticionamento por TITULAR + BANCO (nunca por operação).
      // params: { cliente_id?, dry_run?, limite?, janela_dias?, incluir_vencidas?, teto_por_pessoa? }
      case "sync_tarefas": {
        const p = (params ?? {}) as Record<string, unknown>;
        const dryRun = p.dry_run === true;
        const hoje = new Date();
        const hojeIso = isoDia(hoje);

        // Calendário de dias úteis (fins de semana + feriados nacionais/locais).
        const cal = await carregarCalendario(supabaseAdmin);
        // O disparo imediato roda em qualquer dia (forcar_dia): as datas da
        // tarefa já respeitam os dias úteis.
        if (!dryRun && p.forcar_dia !== true && !cal.ehDiaUtil(hojeIso)) {
          await supabaseAdmin.from("advbox_sync_log").insert({
            tipo_sync: isCron ? "tarefas_cron" : "tarefas",
            registros_sincronizados: 0,
            status: "ignorado",
            erro: `Dia não útil (${cal.nomeFeriado(hojeIso) ?? "fim de semana"})`,
          });
          result = {
            ignorado: true,
            motivo: `${br(hojeIso)} não é dia útil (${cal.nomeFeriado(hojeIso) ?? "fim de semana"}); a rotina roda no próximo dia útil`,
            criadas: 0,
          };
          break;
        }
        // Base de cálculo: hoje, ou o próximo dia útil quando a simulação roda
        // em sábado/domingo/feriado.
        const baseIso = cal.proximoDiaUtil(hojeIso);

        const COLS =
          "id, banco, numero, vence_em, saldo_devedor, responsavel, data_conferida, restaurada_conferir, notificado_em, dispensar_alerta, laudo_status, precisa_laudo, laudo_retificacao_avaliada_em, execucao_ativa, advbox_lawsuits_id, cliente_id, clientes(nome)";

        let q = supabaseAdmin
          .from("operacoes_credito")
          .select(COLS)
          .is("deleted_at", null)
          .not("advbox_lawsuits_id", "is", null);
        if (p.cliente_id) q = q.eq("cliente_id", p.cliente_id as string);
        const { data: opsData, error: opsErr } = await q.limit(Number(p.limite ?? 1000));
        if (opsErr) throw new Error(opsErr.message);

        // Operação restaurada de um arquivamento por duplicata não gera tarefa
        // enquanto alguém não confirmar que ela existe mesmo.
        const todas = ((opsData as any[]) || []).filter((o) => o.restaurada_conferir !== true);

        // ---- Agrupamento por titular + banco --------------------------------
        type Grupo = { cliente_id: string; cliente: string; banco: string; lawsuits_id: number; ops: any[] };
        const grupos = new Map<string, Grupo>();
        for (const o of todas) {
          if (!o.cliente_id || !o.banco) continue;
          const k = `${o.cliente_id}|${String(o.banco).trim().toLowerCase()}`;
          if (!grupos.has(k)) {
            grupos.set(k, {
              cliente_id: o.cliente_id,
              cliente: o.clientes?.nome || "cliente não vinculado",
              banco: String(o.banco).trim(),
              lawsuits_id: Number(o.advbox_lawsuits_id),
              ops: [],
            });
          }
          grupos.get(k)!.ops.push(o);
        }

        // ---- Escopo contratado por titular + banco ---------------------------
        // Só banco marcado como CONTRATADO gera tarefa e abre processo.
        // Par SEM marcação não envia nada ao ADVBOX (continua visível no radar).
        const { data: escopoRows } = await supabaseAdmin
          .from("cliente_banco_escopo")
          .select("cliente_id, banco, escopo");
        const escopoPar = new Map<string, string>();
        for (const e of ((escopoRows as any[]) || [])) {
          escopoPar.set(`${e.cliente_id}|${String(e.banco).trim().toLowerCase()}`, e.escopo);
        }
        const contratado = (cid: string, banco: string) =>
          escopoPar.get(`${cid}|${banco.trim().toLowerCase()}`) === "contratado";

        for (const [k, g] of [...grupos.entries()]) {
          if (!contratado(g.cliente_id, g.banco)) grupos.delete(k);
        }

        // Marcação em lote de cliente antigo (Base): operação JÁ VENCIDA não vira
        // tarefa; ela é classificada na fila "Limpeza da fila de vencidas".
        const semVencidas = p.sem_vencidas === true;
        let vencidasParaFila = 0;
        if (semVencidas) {
          for (const [k, g] of [...grupos.entries()]) {
            const antes = g.ops.length;
            g.ops = g.ops.filter((o: any) => !(o.vence_em && String(o.vence_em) < hojeIso));
            vencidasParaFila += antes - g.ops.length;
            if (!g.ops.length) grupos.delete(k);
          }
        }

        // ---- Notificações já protocoladas (titular + banco) ------------------
        // Havendo pedido protocolado, o caminho é COMPLEMENTAÇÃO, nunca um novo
        // peticionamento.
        const { data: notifRows } = await supabaseAdmin
          .from("notificacoes_banco")
          .select("id, cliente_id, titular_nome, banco, estado, protocolo_data, resposta_data")
          .not("protocolo_data", "is", null);
        // Complementação posterior mantém o pedido vivo mesmo com resposta antiga.
        const { data: compRows } = await supabaseAdmin
          .from("notificacao_complementacoes")
          .select("notificacao_id, data");
        const ultimaComp = new Map<string, string>();
        for (const c of ((compRows as any[]) || [])) {
          const d = String(c.data).slice(0, 10);
          const atual = ultimaComp.get(c.notificacao_id);
          if (!atual || d > atual) ultimaComp.set(c.notificacao_id, d);
        }
        const notifPar = new Map<string, any>();
        for (const n of ((notifRows as any[]) || [])) {
          if (n.estado === "encerrada") continue;
          const comp = ultimaComp.get(n.id);
          const ultimoEvento = [n.resposta_data ? String(n.resposta_data).slice(0, 10) : null, comp ?? null]
            .filter(Boolean)
            .sort()
            .pop();
          // Último evento há mais de 90 dias: o caminho volta a ser pedido novo.
          if (ultimoEvento) {
            n.resposta_data = ultimoEvento;
            const dias = Math.round(
              (new Date(`${isoDia(hoje)}T00:00:00`).getTime() -
                new Date(`${String(n.resposta_data).slice(0, 10)}T00:00:00`).getTime()) / 86_400_000,
            );
            if (dias > 90) continue;
          }
          if (n.cliente_id) notifPar.set(`${n.cliente_id}|${String(n.banco).trim().toLowerCase()}`, n);
        }

        // Clientes que já têm laudo entregue: operação nova neles pede avaliação
        // de retificação.
        const clienteComLaudo = new Set<string>(
          todas
            .filter((o: any) => ["entregue", "concluido", "finalizado"].includes(o.laudo_status || ""))
            .map((o: any) => o.cliente_id as string),
        );





        // Quem protocola é o MESMO para todos os bancos do mesmo cliente:
        // definido pela carteira do cliente, não pela operação.
        const respCliente = new Map<string, string | null>();
        for (const o of todas) {
          if (!o.cliente_id) continue;
          if (!respCliente.get(o.cliente_id) && o.responsavel) respCliente.set(o.cliente_id, o.responsavel);
        }
        const protocoladorCliente = (cid: string) => protocolador(respCliente.get(cid) ?? null);

        // Histórico de disparos: titular + banco + tipo + data-alvo.
        const { data: jaCriadas } = await supabaseAdmin
          .from("advbox_tarefas_criadas")
          .select("operacao_id, cliente_id, banco, tasks_id, data_alvo");
        const feitoGrupo = new Set<string>();
        const alvosAnteriores = new Map<string, string[]>();
        const feitoOp = new Set<string>();
        // Mesma chave usada pelo fechamento (titular + banco + tipo), sem data:
        // impede que a rotina repita o que o fechamento já criou.
        const feitoGrupoTipo = new Set<string>();
        for (const r of ((jaCriadas as any[]) || [])) {
          if (r.operacao_id) feitoOp.add(`${r.operacao_id}:${r.tasks_id}`);
          if (r.cliente_id && r.banco) {
            const base = `${r.cliente_id}|${String(r.banco).trim().toLowerCase()}|${r.tasks_id}`;
            feitoGrupoTipo.add(base);
            if (r.data_alvo) {
              feitoGrupo.add(`${base}|${r.data_alvo}`);
              alvosAnteriores.set(base, [...(alvosAnteriores.get(base) ?? []), r.data_alvo]);
            }
          }
        }

        const incluirVencidas = p.incluir_vencidas === true;
        const janelaDias = Number(p.janela_dias ?? 30);
        const limiteJanela = isoDia(somaDias(hoje, janelaDias));

        const planejadas: Record<string, unknown>[] = [];

        // Dados das citações (para o texto da tarefa "Acompanhar Citação").
        const { data: execRows } = await supabaseAdmin
          .from("cliente_execucoes")
          .select("id, operacao_id, cliente_id, numero_processo, vara, tipo, status");
        const { data: citRows } = await supabaseAdmin
          .from("execucao_citacoes")
          .select("execucao_id, pessoa_nome, papel, citado, data_juntada");
        const citPorExec = new Map<string, any[]>();
        for (const c of ((citRows as any[]) || [])) {
          citPorExec.set(c.execucao_id, [...(citPorExec.get(c.execucao_id) ?? []), c]);
        }
        const execPorOperacao = new Map<string, any>();
        for (const e of ((execRows as any[]) || [])) {
          if (e.operacao_id && e.status !== "encerrado") execPorOperacao.set(e.operacao_id, e);
        }
        const textoCitacao = (cliente: string, op: any) => {
          const ex = execPorOperacao.get(op.id);
          const cits = ex ? (citPorExec.get(ex.id) ?? []) : [];
          const citados = cits.filter((c) => c.citado);
          const quem = citados.length
            ? citados.map((c) => `${c.pessoa_nome} (${c.papel})`).join("; ")
            : cits.length
              ? `ainda sem citação confirmada (partes: ${cits.map((c) => c.pessoa_nome).join("; ")})`
              : "conferir no processo quem foi citado";
          const juntadas = citados.map((c) => c.data_juntada).filter(Boolean).sort();
          const juntada = juntadas.length ? br(juntadas[0]) : "juntada do mandado ainda não informada";
          const proc = ex?.numero_processo
            ? `Processo ${ex.numero_processo}${ex.vara ? ` — ${ex.vara}` : ""}`
            : "Processo sem número informado no sistema";
          return (
            `ACOMPANHAR CITAÇÃO. Cliente: ${cliente}. ${proc}. ` +
            `Citado: ${quem}. Juntada do mandado: ${juntada}. ` +
            `Conferir a juntada no processo e LANÇAR O PRAZO DE DEFESA no ADVBOX a partir dela.`
          );
        };

        for (const g of grupos.values()) {
          // Operações ainda sem protocolo e sem dispensa.
          const alvo = g.ops.filter((o: any) => !o.notificado_em && !o.dispensar_alerta);
          const vencMin = vencimentoMaisProximo(alvo);
          // Pedido já protocolado neste titular + banco → complementação.
          const notif = notifPar.get(`${g.cliente_id}|${g.banco.toLowerCase()}`);

          // 1) PEDIDO ADMINISTRATIVO (ou COMPLEMENTAÇÃO) — um por titular + banco.
          if (vencMin) {
            const dentroJanela = vencMin >= hojeIso && vencMin <= limiteJanela;
            const vencidasG = alvo.filter((o: any) => o.vence_em && o.vence_em < hojeIso);
            const temVencida = vencidasG.length > 0;
            if (dentroJanela || (temVencida && incluirVencidas) || p.cliente_id) {
              // PRAZO FATAL: vencimento - 3 dias; caindo em dia não útil, ANTECIPA
              // (protocolar depois do vencimento não adianta).
              let fatal = cal.diaUtilAnterior(isoDia(somaDias(vencMin, -3)));
              let urgente = false;
              let alerta = "";
              // Prazo calculado já passou do vencimento (ou já passou): sai no
              // próximo dia útil, urgente e com o aviso no começo do texto.
              if (temVencida || fatal <= baseIso || fatal > vencMin) {
                fatal = cal.proximoDiaUtil(baseIso);
                urgente = true;
                const vencAviso = temVencida ? vencimentoMaisProximo(vencidasG)! : vencMin;
                alerta =
                  `ATENÇÃO: o vencimento é ${br(vencAviso)} e não há pedido protocolado. ` +
                  `Protocolar imediatamente, ainda que em pedido genérico. `;
              }
              // COMPLEMENTAÇÃO tem prazo próprio: vencimento - 3 dias ÚTEIS;
              // operação já vencida, 2 dias úteis a partir de hoje.
              if (notif) {
                fatal = temVencida
                  ? cal.somaDiasUteis(baseIso, 2)
                  : cal.somaDiasUteis(vencMin, -3);
                if (fatal <= baseIso) fatal = cal.somaDiasUteis(baseIso, 2);
                urgente = temVencida;
                alerta = temVencida
                  ? `ATENÇÃO: há operação vencida em ${br(vencimentoMaisProximo(vencidasG)!)}. `
                  : "";
              }
              const chaveBase = `${g.cliente_id}|${g.banco.toLowerCase()}|${T.pedido_administrativo}`;
              const dataAlvo = vencMin;
              const anteriores = alvosAnteriores.get(chaveBase) ?? [];
              const jaFeito = feitoGrupo.has(`${chaveBase}|${dataAlvo}`);
              const antecipou = anteriores.length > 0 && anteriores.every((a) => a > dataAlvo);
              if (!jaFeito) {
                const numeros = alvo.map((o: any) => o.numero || "número a conferir").join(", ");
                // Peso das operações novas sobre o saldo do titular no banco.
                const soma = (l: any[]) => l.reduce((s, o) => s + (Number(o.saldo_devedor) || 0), 0);
                const total = soma(g.ops);
                const peso = total ? soma(alvo) / total : 0;
                const laudoEntregue = g.ops.some((o: any) =>
                  ["entregue", "concluido", "finalizado"].includes(o.laudo_status || ""),
                );
                const pct = `${(peso * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
                // 10% ou mais da dívida no banco: o laudo de capacidade é
                // retificado ANTES, com 5 dias úteis de folga.
                if (notif && peso >= 0.1 && !laudoEntregue) {
                  const fatalLaudo = cal.somaDiasUteis(fatal, -5) <= baseIso
                    ? cal.proximoDiaUtil(baseIso)
                    : cal.somaDiasUteis(fatal, -5);
                  planejadas.push({
                    cliente_id: g.cliente_id,
                    banco: g.banco,
                    data_alvo: fatalLaudo,
                    operacao_id: null,
                    tasks_id: T.encaminhar_laudo,
                    tipo: "Retificar laudo de capacidade",
                    cliente: g.cliente,
                    lawsuits_id: g.lawsuits_id,
                    users_id: U.lucas,
                    guests: [U.lucas, U.willian],
                    prazo_fatal: fatalLaudo,
                    data_evento: dataEvento(cal, fatalLaudo, hojeIso),
                    date_deadline: br(fatalLaudo),
                    urgent: 1,
                    comments:
                      `RETIFICAR LAUDO DE CAPACIDADE - ${g.cliente} / ${g.banco}. ` +
                      `Motivo: operação nova representa ${pct} da dívida no banco (${numeros}). ` +
                      `Prazo fatal ${br(fatalLaudo)}. A complementação do pedido depende deste laudo.`,
                    _venc: vencMin,
                  });
                }
                const cabecalho = notif
                  ? `COMPLEMENTAÇÃO DO PEDIDO - ${g.cliente} / ${g.banco}. Pedido original protocolado em ` +
                    `${br(notif.protocolo_data)} - operação ${numeros}.`
                  : "PEDIDO ADMINISTRATIVO - ALONGAMENTO.";
                const prefixo = antecipou
                  ? `Atualização: nova operação vence em ${br(dataAlvo)}. `
                  : "";
                const trava =
                  notif && peso >= 0.1 && !laudoEntregue
                    ? `Operação nova representa ${pct} da dívida no banco: só protocolar depois do laudo retificado. `
                    : "";
                planejadas.push({
                  cliente_id: g.cliente_id,
                  banco: g.banco,
                  data_alvo: dataAlvo,
                  operacao_id: null,
                  tasks_id: T.pedido_administrativo,
                  tipo: notif ? "Complementação" : "Peticionamento",
                  cliente: g.cliente,
                  lawsuits_id: g.lawsuits_id,
                  users_id: protocoladorCliente(g.cliente_id),
                  // Participante: quem MAPEIA monta os dados.
                  guests: [
                    ...new Set([
                      protocoladorCliente(g.cliente_id),
                      mapeador(respCliente.get(g.cliente_id) ?? null),
                      U.willian,
                    ]),
                  ],
                  prazo_fatal: fatal,
                  data_evento: dataEvento(cal, fatal, hojeIso),
                  date_deadline: br(fatal),
                  urgent: urgente ? 1 : 0,
                  comments: `${alerta}${cabecalho} ${trava}Prazo fatal ${br(fatal)}. ${prefixo}${textoGrupo(g.cliente, g.banco, alvo)}`,
                  _venc: vencMin,
                });
              }
            }
          }


          // 2) LAUDO — sempre para Lucas, por operação que precisa de laudo.
          const laudoNoGrupo = feitoGrupoTipo.has(
            `${g.cliente_id}|${g.banco.toLowerCase()}|${T.encaminhar_laudo}`,
          );
          for (const o of g.ops) {
            const semLaudo = !["entregue", "concluido", "finalizado"].includes(o.laudo_status || "");
            if (o.precisa_laudo && semLaudo && !laudoNoGrupo && !feitoOp.has(`${o.id}:${T.encaminhar_laudo}`)) {
              let fatal = baseIso;
              let urgente = true;
              if (o.vence_em) {
                const a = cal.proximoDiaUtil(isoDia(somaDias(o.vence_em, -30)));
                if (a > baseIso) {
                  fatal = a;
                  urgente = false;
                }
              }
              planejadas.push({
                cliente_id: g.cliente_id,
                banco: g.banco,
                data_alvo: null,
                operacao_id: o.id,
                tasks_id: T.encaminhar_laudo,
                tipo: "Laudo",
                cliente: g.cliente,
                lawsuits_id: g.lawsuits_id,
                users_id: U.lucas,
                prazo_fatal: fatal,
                data_evento: dataEvento(cal, fatal, hojeIso),
                date_deadline: br(fatal),
                urgent: urgente ? 1 : 0,
                comments: `ENCAMINHAR PARA LAUDO - ENGENHEIRO. Prazo fatal ${br(fatal)}. ${textoGrupo(g.cliente, g.banco, [o])}`,
                _venc: o.vence_em || "9999-12-31",
              });
            }
          }

          // 2b) RETIFICAÇÃO DO LAUDO — operação nova em cliente que já tem laudo
          // entregue. Não é refazer: é avaliar e registrar o que decidiu.
          if (clienteComLaudo.has(g.cliente_id)) {
            for (const o of g.ops) {
              const jaEntregue = ["entregue", "concluido", "finalizado"].includes(o.laudo_status || "");
              if (jaEntregue || o.laudo_retificacao_avaliada_em) continue;
              if (feitoOp.has(`${o.id}:${T.encaminhar_laudo}`)) continue;
              const fatal = cal.somaDiasUteis(baseIso, 5);
              planejadas.push({
                cliente_id: g.cliente_id,
                banco: g.banco,
                data_alvo: null,
                operacao_id: o.id,
                tasks_id: T.encaminhar_laudo,
                tipo: "Retificação de laudo",
                cliente: g.cliente,
                lawsuits_id: g.lawsuits_id,
                users_id: U.lucas,
                prazo_fatal: fatal,
                data_evento: dataEvento(cal, fatal, hojeIso),
                date_deadline: br(fatal),
                urgent: 0,
                comments:
                  `AVALIAR RETIFICAÇÃO DO LAUDO - entrou operação ${o.numero || "número a conferir"}, ` +
                  `${g.banco}, ${moeda(o.saldo_devedor)}. Cliente: ${g.cliente}. Prazo fatal ${br(fatal)}. ` +
                  `Avaliar se muda a dívida, a capacidade de pagamento ou o prazo pedido e registrar a decisão no sistema. ` +
                  `Não refazer o laudo automaticamente.`,
                _venc: o.vence_em || "9999-12-31",
              });
            }
          }



          // 3) AGUARDAR E-MAIL DO BANCO — por titular + banco, após o protocolo.
          const protocolados = g.ops.filter((o: any) => o.notificado_em);
          if (protocolados.length) {
            const maisRecente = protocolados.map((o: any) => o.notificado_em).sort().reverse()[0];
            const dataAlvo = isoDia(somaDias(maisRecente, 15));
            const fatal = cal.proximoDiaUtil(dataAlvo);
            const chave = `${g.cliente_id}|${g.banco.toLowerCase()}|${T.aguardar_email}|${dataAlvo}`;
            if (!feitoGrupo.has(chave)) {
              planejadas.push({
                cliente_id: g.cliente_id,
                banco: g.banco,
                data_alvo: dataAlvo,
                operacao_id: null,
                tasks_id: T.aguardar_email,
                tipo: "Cobrança do banco",
                cliente: g.cliente,
                lawsuits_id: g.lawsuits_id,
                users_id: protocoladorCliente(g.cliente_id),
                prazo_fatal: fatal,
                data_evento: dataEvento(cal, fatal, hojeIso),
                date_deadline: br(fatal),
                urgent: 0,
                comments: `AGUARDAR E-MAIL DE RESPOSTA DO BANCO. Prazo fatal ${br(fatal)}. ${textoGrupo(g.cliente, g.banco, protocolados)}`,
                _venc: dataAlvo,
              });
            }
          }

          // 4) ACOMPANHAR CITAÇÃO — Willian com Vitoria como convidada.
          for (const o of g.ops) {
            if (o.execucao_ativa && !feitoOp.has(`${o.id}:${T.acompanhar_citacao}`)) {
              const fatal = cal.proximoDiaUtil(baseIso);
              planejadas.push({
                cliente_id: g.cliente_id,
                banco: g.banco,
                data_alvo: null,
                operacao_id: o.id,
                tasks_id: T.acompanhar_citacao,
                tipo: "Citação",
                cliente: g.cliente,
                lawsuits_id: g.lawsuits_id,
                users_id: U.willian,
                guests: [U.willian, U.vitoria],
                prazo_fatal: fatal,
                data_evento: dataEvento(cal, fatal, hojeIso),
                date_deadline: br(fatal),
                urgent: 1,
                comments: textoCitacao(g.cliente, o),
                _venc: o.vence_em || hojeIso,
              });
            }
          }
        }

        // Ordem da fila: vencimento mais próximo primeiro; empatou no dia,
        // operação com garantia real (AF/HIP/REC) na frente.
        const { data: garRows } = await supabaseAdmin
          .from("operacao_garantias")
          .select("operacao_id, tipo");
        const PRIO = ["alienacao_fiduciaria", "hipoteca", "cessao_recebiveis"];
        const opsComGarantia = new Set(
          ((garRows as any[]) || []).filter((g) => PRIO.includes(g.tipo)).map((g) => g.operacao_id),
        );
        const grupoComGarantia = new Set<string>();
        for (const o of todas) {
          if (o.cliente_id && o.banco && opsComGarantia.has(o.id)) {
            grupoComGarantia.add(`${o.cliente_id}|${String(o.banco).trim().toLowerCase()}`);
          }
        }
        let pendentes = planejadas.sort((a, b) => {
          const va = String(a._venc), vb = String(b._venc);
          if (va !== vb) return va < vb ? -1 : 1;
          const ga = grupoComGarantia.has(`${a.cliente_id}|${String(a.banco).toLowerCase()}`) ? 0 : 1;
          const gb = grupoComGarantia.has(`${b.cliente_id}|${String(b.banco).toLowerCase()}`) ? 0 : 1;
          return ga - gb;
        });

        // Teto de tarefas novas por pessoa por dia; o excedente fica para amanhã.
        const teto = Number(p.teto_por_pessoa ?? 10);
        const { data: hojeRows } = await supabaseAdmin
          .from("advbox_tarefas_criadas")
          .select("users_id, created_at")
          .gte("created_at", `${hojeIso}T00:00:00Z`);
        const usadas = new Map<string, number>();
        for (const r of ((hojeRows as any[]) || [])) {
          usadas.set(String(r.users_id), (usadas.get(String(r.users_id)) ?? 0) + 1);
        }
        const aptas: Record<string, unknown>[] = [];
        const adiadas: Record<string, unknown>[] = [];
        for (const t of pendentes) {
          const k = String(t.users_id);
          const n = usadas.get(k) ?? 0;
          if (n >= teto) adiadas.push(t);
          else {
            usadas.set(k, n + 1);
            aptas.push(t);
          }
        }
        pendentes = aptas;
        const porPessoa = (lista: Record<string, unknown>[]) => {
          const m: Record<string, number> = {};
          for (const t of lista) m[String(t.users_id)] = (m[String(t.users_id)] ?? 0) + 1;
          return m;
        };

        if (dryRun) {
          result = {
            dry_run: true,
            total: pendentes.length,
            por_pessoa: porPessoa(pendentes),
            fila_amanha: adiadas.length,
            fila_amanha_por_pessoa: porPessoa(adiadas),
            vencidas_para_fila: vencidasParaFila,
            tarefas: pendentes,
          };
          break;
        }

        const criadas: unknown[] = [];
        const falhas: unknown[] = [];
        // Tarefas cuja data de vencimento foi corrigida DEPOIS de criadas:
        // quem protocola precisa concluir a antiga na tela do ADVBOX.
        const { data: desatualRows } = await supabaseAdmin
          .from("advbox_tarefas_criadas")
          .select("operacao_id, cliente_id, banco, advbox_post_id, data_alvo")
          .eq("data_desatualizada", true);
        const avisoAntiga = (op?: string | null, cid?: string | null, banco?: string | null) => {
          const achado = ((desatualRows as any[]) || []).find(
            (r) =>
              (op && r.operacao_id === op) ||
              (!op && cid && r.cliente_id === cid &&
                String(r.banco || "").toLowerCase() === String(banco || "").toLowerCase()),
          );
          if (!achado) return "";
          const num = achado.advbox_post_id || "sem número registrado";
          return `ATENÇÃO: a tarefa nº ${num} no ADVBOX ficou com a data antiga — concluir na tela do ADVBOX. `;
        };
        for (const t of pendentes) {
          try {
            const aviso = avisoAntiga(
              t.operacao_id as string | null,
              t.cliente_id as string | null,
              t.banco as string | null,
            );
            const body: Record<string, unknown> = {
              tasks_id: t.tasks_id,
              lawsuits_id: t.lawsuits_id,
              users_id: t.users_id,
              from: t.users_id,
              // Willian (151894) entra como participante em toda tarefa da integração,
              // mantendo quem executa como responsável principal.
              guests: [...new Set([...(t.guests as number[] ?? [t.users_id as number]), U.willian])],
              comments: `${aviso}${t.comments}`,
              start_date: br(String(t.data_evento)),
              start_time: "08:00",
              end_date: t.date_deadline,
              end_time: "18:00",
              date_deadline: t.date_deadline,
              hour_deadline: "18:00",
              urgent: t.urgent,
              important: 1,
            };
            const resp: any = await fetchAdvbox(`${ADVBOX_BASE}/posts`, {
              method: "POST",
              body: JSON.stringify(body),
            });
            let postId = resp?.id ?? resp?.data?.id ?? null;
            if (!postId) postId = await acharPostId(t.lawsuits_id, t.tasks_id);
            await supabaseAdmin.from("advbox_tarefas_criadas").insert({
              operacao_id: t.operacao_id ?? null,
              cliente_id: t.cliente_id ?? null,
              banco: t.banco ?? null,
              data_alvo: t.data_alvo ?? null,
              origem: "radar",
              lawsuits_id: String(t.lawsuits_id),
              tasks_id: String(t.tasks_id),
              advbox_post_id: postId ? String(postId) : null,
              post_id_pendente: !postId,
              users_id: String(t.users_id),
              urgente: t.urgent === 1,
              texto: `${aviso}${t.comments}`,
            });
            if (aviso) {
              await supabaseAdmin
                .from("advbox_tarefas_criadas")
                .update({ data_desatualizada: false })
                .eq("data_desatualizada", true)
                .eq(t.operacao_id ? "operacao_id" : "cliente_id", (t.operacao_id ?? t.cliente_id) as string);
            }
            criadas.push({ ...t, advbox_post_id: postId });
          } catch (e) {
            falhas.push({ cliente_id: t.cliente_id, tasks_id: t.tasks_id, erro: String(e) });
          }
        }
        await supabaseAdmin.from("advbox_sync_log").insert({
          tipo_sync: isCron ? "tarefas_cron" : "tarefas",
          registros_sincronizados: criadas.length,
          status: falhas.length ? "parcial" : "sucesso",
          erro: falhas.length ? JSON.stringify(falhas).slice(0, 500) : null,
        });
        result = {
          criadas: criadas.length,
          por_pessoa: porPessoa(criadas as Record<string, unknown>[]),
          fila_amanha: adiadas.length,
          fila_amanha_por_pessoa: porPessoa(adiadas),
          vencidas_para_fila: vencidasParaFila,
          falhas,
          tarefas: criadas,
        };
        break;
      }

      // Workflow de cliente novo — tarefas disparadas na assinatura do contrato.
      // params: { cliente_id?, dry_run?, simulacao? }
      // simulacao = { cliente, operacoes: [{ banco, numero, vence_em, saldo_devedor,
      //   data_conferida, responsavel, advbox_lawsuits_id }], hora? }
      case "tarefas_fechamento": {
        const p = (params ?? {}) as Record<string, unknown>;
        const dryRun = p.dry_run === true || !!p.simulacao;
        const hoje = new Date();
        const hojeIso = isoDia(hoje);
        const cal = await carregarCalendario(supabaseAdmin);

        let clienteNome = "";
        let clienteId: string | null = null;
        let ops: any[] = [];
        // Hora local de Brasília (UTC-3) para a regra das 17h.
        const horaFechamento = Number(
          (p.hora as number | undefined) ??
            ((p.simulacao as any)?.hora as number | undefined) ??
            ((hoje.getUTCHours() + 24 - 3) % 24),
        );

        if (p.simulacao) {
          const s = p.simulacao as any;
          clienteNome = s.cliente || "Cliente simulado";
          clienteId = s.cliente_id ?? null;
          ops = (s.operacoes || []).map((o: any, i: number) => ({ id: `sim-${i}`, ...o }));
        } else {
          if (!p.cliente_id) throw new Error("cliente_id obrigatório");
          clienteId = String(p.cliente_id);
          const { data: cli } = await supabaseAdmin
            .from("clientes").select("nome, created_at").eq("id", clienteId).maybeSingle();
          clienteNome = (cli as any)?.nome || "cliente";
          // Só vale para contratos assinados agora. Cadastro antigo continua
          // coberto apenas pela rotina das 07:00.
          const criadoEm = (cli as any)?.created_at ? new Date((cli as any).created_at) : null;
          if (p.force !== true && criadoEm && Date.now() - criadoEm.getTime() > 24 * 60 * 60 * 1000) {
            result = {
              ignorado: true,
              motivo: "cliente cadastrado antes do disparo automático; coberto pela rotina das 07:00",
              cliente: clienteNome,
            };
            break;
          }
          const { data: opRows, error: opErr } = await supabaseAdmin
            .from("operacoes_credito")
            .select("id, banco, numero, vence_em, saldo_devedor, responsavel, data_conferida, restaurada_conferir, advbox_lawsuits_id")
            .eq("cliente_id", clienteId)
            .is("deleted_at", null);
          if (opErr) throw new Error(opErr.message);
          ops = ((opRows as any[]) || []).filter((o) => o.restaurada_conferir !== true);
        }

        // Grupos por banco.
        const porBanco = new Map<string, { banco: string; lawsuits_id: number | null; ops: any[] }>();
        for (const o of ops) {
          const k = String(o.banco || "sem banco").trim().toLowerCase();
          if (!porBanco.has(k)) {
            porBanco.set(k, {
              banco: String(o.banco || "sem banco").trim(),
              lawsuits_id: o.advbox_lawsuits_id ? Number(o.advbox_lawsuits_id) : null,
              ops: [],
            });
          }
          porBanco.get(k)!.ops.push(o);
        }
        const gruposFech = [...porBanco.values()];
        if (!gruposFech.length) throw new Error("cliente sem operações cadastradas");

        // Processo principal: banco com o vencimento mais próximo.
        const ordenados = [...gruposFech].sort((a, b) => {
          const va = vencimentoMaisProximo(a.ops) ?? "9999-12-31";
          const vb = vencimentoMaisProximo(b.ops) ?? "9999-12-31";
          return va < vb ? -1 : va > vb ? 1 : 0;
        });
        const principal = ordenados[0];
        const respPrincipal = principal.ops[0]?.responsavel;

        const tarefas: Record<string, unknown>[] = [];

        const baseFech = cal.proximoDiaUtil(hojeIso);

        // a) Financeiro — gerar boleto (mesmo dia útil; D+1 se fechou depois das 17h).
        const fatalBoleto = horaFechamento >= 17
          ? cal.somaDiasUteis(baseFech, 1)
          : baseFech;
        tarefas.push({
          etapa: "Financeiro — gerar boleto",
          cliente_id: clienteId,
          banco: principal.banco,
          data_alvo: fatalBoleto,
          tasks_id: T.cobrar_honorarios_boleto,
          lawsuits_id: principal.lawsuits_id,
          users_id: U.adrielli,
          prazo_fatal: fatalBoleto,
          data_evento: dataEvento(cal, fatalBoleto, hojeIso),
          date_deadline: br(fatalBoleto),
          urgent: 0,
          comments: `COBRAR HONORÁRIOS/ENVIAR BOLETO. Contrato assinado hoje. Prazo fatal ${br(fatalBoleto)}. ${clienteNome}.`,
        });

        // b) Onboarding — solicitar documentos (3 dias úteis, para quem mapeia).
        const fatalDocs = cal.somaDiasUteis(baseFech, 3);
        tarefas.push({
          etapa: "Onboarding — documentos",
          cliente_id: clienteId,
          banco: principal.banco,
          data_alvo: fatalDocs,
          tasks_id: T.solicitar_documentos,
          lawsuits_id: principal.lawsuits_id,
          users_id: mapeador(respPrincipal),
          prazo_fatal: fatalDocs,
          data_evento: dataEvento(cal, fatalDocs, hojeIso),
          date_deadline: br(fatalDocs),
          urgent: 0,
          comments: `SOLICITAR DOCUMENTOS. Prazo fatal ${br(fatalDocs)}. ${textoGrupo(clienteNome, principal.banco, principal.ops)}`,
        });

        // c) Laudo — sempre Lucas, 3 dias úteis.
        tarefas.push({
          etapa: "Laudo",
          cliente_id: clienteId,
          banco: principal.banco,
          data_alvo: fatalDocs,
          tasks_id: T.encaminhar_laudo,
          lawsuits_id: principal.lawsuits_id,
          users_id: U.lucas,
          prazo_fatal: fatalDocs,
          data_evento: dataEvento(cal, fatalDocs, hojeIso),
          date_deadline: br(fatalDocs),
          urgent: 0,
          comments: `ENCAMINHAR PARA LAUDO - ENGENHEIRO. Prazo fatal ${br(fatalDocs)}. ${textoGrupo(clienteNome, principal.banco, principal.ops)}`,
        });

        // Quem protocola: um só para o cliente inteiro (carteira do cliente).
        const respCarteira =
          respPrincipal ?? ops.find((o: any) => o.responsavel)?.responsavel ?? null;
        const protocoladorDoCliente = protocolador(respCarteira);

        // d) Peticionamento — um por titular + banco.
        for (const g of gruposFech) {
          const vencMin = vencimentoMaisProximo(g.ops);
          const vencidas = g.ops.filter((o: any) => o.vence_em && o.vence_em < hojeIso);
          const futuras = g.ops.filter((o: any) => o.vence_em && o.vence_em >= hojeIso);
          const vencMinFuturo = vencimentoMaisProximo(futuras);

          let fatal: string;
          let urgente = 0;
          let prefixo = "";
          if (vencidas.length) {
            fatal = cal.somaDiasUteis(baseFech, 3);
            urgente = 1;
            prefixo = `Há operação já vencida em ${br(vencimentoMaisProximo(vencidas))} - protocolar imediatamente. O pedido cobre todas as operações do titular neste banco, inclusive as a vencer. `;
          } else if (vencMinFuturo) {
            // Antecipa quando cair em dia não útil.
            fatal = cal.diaUtilAnterior(isoDia(somaDias(vencMinFuturo, -3)));
            if (fatal <= baseFech) {
              fatal = baseFech;
              urgente = 1;
            }
          } else {
            fatal = cal.somaDiasUteis(baseFech, 3);
            prefixo = "Operações sem data de vencimento informada. ";
          }

          tarefas.push({
            etapa: `Peticionamento — ${g.banco}`,
            cliente_id: clienteId,
            banco: g.banco,
            // MESMA chave da rotina das 07:00: vencimento mais próximo do
            // titular naquele banco (ou o prazo, quando não há vencimento).
            data_alvo: vencMin ?? fatal,
            tasks_id: T.pedido_administrativo,
            lawsuits_id: g.lawsuits_id,
            users_id: protocoladorDoCliente,
            prazo_fatal: fatal,
            data_evento: dataEvento(cal, fatal, hojeIso),
            date_deadline: br(fatal),
            urgent: urgente,
            comments: `PEDIDO ADMINISTRATIVO - ALONGAMENTO. Prazo fatal ${br(fatal)}. ${prefixo}${textoGrupo(clienteNome, g.banco, g.ops)}`,
          });
        }

        if (dryRun) {
          result = { dry_run: true, cliente: clienteNome, total: tarefas.length, tarefas };
          break;
        }

        // Não repetir: titular + banco + tipo + data-alvo.
        const { data: jaFech } = await supabaseAdmin
          .from("advbox_tarefas_criadas")
          .select("cliente_id, banco, tasks_id, data_alvo")
          .eq("cliente_id", clienteId);
        const feitoFech = new Set(
          ((jaFech as any[]) || []).map(
            (r) => `${String(r.banco || "").toLowerCase()}|${r.tasks_id}|${r.data_alvo}`,
          ),
        );

        const criadasF: unknown[] = [];
        const falhasF: unknown[] = [];
        for (const t of tarefas) {
          if (!t.lawsuits_id) {
            falhasF.push({ etapa: t.etapa, erro: "sem processo no ADVBOX para este banco" });
            continue;
          }
          if (feitoFech.has(`${String(t.banco).toLowerCase()}|${t.tasks_id}|${t.data_alvo}`)) continue;
          try {
            const resp: any = await fetchAdvbox(`${ADVBOX_BASE}/posts`, {
              method: "POST",
              body: JSON.stringify({
                tasks_id: t.tasks_id,
                lawsuits_id: t.lawsuits_id,
                users_id: t.users_id,
                from: t.users_id,
                guests: [...new Set([t.users_id as number, U.willian])],
                comments: t.comments,
                start_date: br(String(t.data_evento)),
                start_time: "08:00",
                end_date: t.date_deadline,
                end_time: "18:00",
                date_deadline: t.date_deadline,
                hour_deadline: "18:00",
                urgent: t.urgent,
                important: 1,
              }),
            });
            let postId = resp?.id ?? resp?.data?.id ?? null;
            if (!postId) postId = await acharPostId(t.lawsuits_id, t.tasks_id);
            await supabaseAdmin.from("advbox_tarefas_criadas").insert({
              operacao_id: null,
              cliente_id: clienteId,
              banco: t.banco as string,
              data_alvo: t.data_alvo as string,
              origem: "fechamento",
              lawsuits_id: String(t.lawsuits_id),
              tasks_id: String(t.tasks_id),
              advbox_post_id: postId ? String(postId) : null,
              post_id_pendente: !postId,
              users_id: String(t.users_id),
              urgente: t.urgent === 1,
              texto: String(t.comments),
            });
            criadasF.push({ ...t, advbox_post_id: postId });
          } catch (e) {
            falhasF.push({ etapa: t.etapa, erro: String(e) });
          }
        }
        await supabaseAdmin.from("advbox_sync_log").insert({
          tipo_sync: "tarefas_fechamento",
          registros_sincronizados: criadasF.length,
          status: falhasF.length ? "parcial" : "sucesso",
          erro: falhasF.length ? JSON.stringify(falhasF).slice(0, 500) : null,
        });
        result = { cliente: clienteNome, criadas: criadasF.length, tarefas: criadasF, falhas: falhasF };
        break;
      }


      // Leitura: página de clientes (limit/offset — page/per_page são ignorados
      // pela API do ADVBOX).
      // Resumo semanal: uma tarefa por responsável pelo protocolo, no último
      // dia útil da semana, com o que tem prazo fatal nos próximos 10 dias.
      // params: { dry_run?, dias?, forcar? }
      case "resumo_semanal": {
        const p = (params ?? {}) as Record<string, unknown>;
        const dryRun = p.dry_run === true;
        const hojeIso = isoDia(new Date());
        const cal = await carregarCalendario(supabaseAdmin);

        if (!p.forcar && !dryRun && !cal.ehUltimoDiaUtilDaSemana(hojeIso)) {
          result = { ignorado: true, motivo: `${br(hojeIso)} não é o último dia útil da semana` };
          break;
        }

        const dias = Number(p.dias ?? 10);
        const limite = isoDia(somaDias(hojeIso, dias));
        const { data: opsData } = await supabaseAdmin
          .from("operacoes_credito")
          .select("id, banco, numero, vence_em, saldo_devedor, responsavel, notificado_em, dispensar_alerta, laudo_status, precisa_laudo, advbox_lawsuits_id, cliente_id, clientes(nome)")
          .is("deleted_at", null)
          .is("notificado_em", null)
          .not("advbox_lawsuits_id", "is", null);

        type Linha = { cliente: string; banco: string; numero: string; fatal: string; pronta: boolean; lawsuits_id: number };
        const porPessoa = new Map<number, Linha[]>();
        for (const o of ((opsData as any[]) || [])) {
          if (o.dispensar_alerta || !o.vence_em) continue;
          const fatal = cal.diaUtilAnterior(isoDia(somaDias(o.vence_em, -3)));
          if (fatal < hojeIso || fatal > limite) continue;
          const uid = protocolador(o.responsavel);
          const pronta = ["entregue", "concluido", "finalizado"].includes(o.laudo_status || "") || !o.precisa_laudo;
          porPessoa.set(uid, [
            ...(porPessoa.get(uid) ?? []),
            {
              cliente: o.clientes?.nome || "cliente não vinculado",
              banco: o.banco || "banco não informado",
              numero: o.numero || "número a conferir",
              fatal,
              pronta,
              lawsuits_id: Number(o.advbox_lawsuits_id),
            },
          ]);
        }

        const resumos = [...porPessoa.entries()].map(([uid, linhas]) => {
          const ordenadas = linhas.sort((a, b) => (a.fatal < b.fatal ? -1 : 1));
          const texto =
            `RESUMO DA SEMANA — prazos fatais até ${br(limite)} (${ordenadas.length} operações). ` +
            ordenadas
              .map((l) => `${l.cliente} / ${l.banco} / ${l.numero} — prazo fatal ${br(l.fatal)} — ${l.pronta ? "pronta para protocolar" : "aguardando laudo"}`)
              .join(" | ");
          const fatalResumo = ordenadas[0].fatal;
          return {
            users_id: uid,
            lawsuits_id: ordenadas[0].lawsuits_id,
            total: ordenadas.length,
            prazo_fatal: fatalResumo,
            data_evento: cal.proximoDiaUtil(hojeIso),
            date_deadline: br(fatalResumo),
            comments: texto,
          };
        });

        if (dryRun) {
          result = { dry_run: true, total: resumos.length, resumos };
          break;
        }

        const criadosR: unknown[] = [];
        const falhasR: unknown[] = [];
        for (const r of resumos) {
          try {
            const resp: any = await fetchAdvbox(`${ADVBOX_BASE}/posts`, {
              method: "POST",
              body: JSON.stringify({
                tasks_id: T.pedido_administrativo,
                lawsuits_id: r.lawsuits_id,
                users_id: r.users_id,
                from: r.users_id,
                guests: [...new Set([r.users_id, U.willian])],
                comments: r.comments,
                start_date: br(r.data_evento),
                start_time: "08:00",
                end_date: r.date_deadline,
                end_time: "18:00",
                date_deadline: r.date_deadline,
                hour_deadline: "18:00",
                urgent: 0,
                important: 1,
              }),
            });
            criadosR.push({ users_id: r.users_id, total: r.total, advbox_post_id: resp?.id ?? null });
          } catch (e) {
            falhasR.push({ users_id: r.users_id, erro: String(e) });
          }
        }
        await supabaseAdmin.from("advbox_sync_log").insert({
          tipo_sync: "resumo_semanal",
          registros_sincronizados: criadosR.length,
          status: falhasR.length ? "parcial" : "sucesso",
          erro: falhasR.length ? JSON.stringify(falhasR).slice(0, 500) : null,
        });
        result = { criadas: criadosR.length, resumos: criadosR, falhas: falhasR };
        break;
      }

      // Conferência: tarefas já criadas com data do evento ou prazo fatal em
      // sábado, domingo ou feriado (a API não permite alterar depois de criada).
      case "auditoria_datas": {
        const p = (params ?? {}) as Record<string, unknown>;
        // Só interessam as tarefas criadas pela integração (a partir desta data).
        const desde = String(p.desde ?? "2026-09-01");
        const cal = await carregarCalendario(supabaseAdmin);
        const nomeUser: Record<string, string> = Object.fromEntries(
          Object.entries(U).map(([nome, id]) => [String(id), nome]),
        );
        const nossosUsers = new Set(Object.keys(nomeUser));

        const paraIso = (s?: string | null) => {
          if (!s) return null;
          const d = String(s).slice(0, 10);
          return d.includes("/") ? d.split("/").reverse().join("-") : d;
        };

        // Tarefas criadas por ESTA integração (as únicas que seguem a nossa regra).
        const { data: nossasRows } = await supabaseAdmin
          .from("advbox_tarefas_criadas")
          .select("advbox_post_id");
        const nossosPosts = new Set(
          ((nossasRows as any[]) || []).map((r) => String(r.advbox_post_id)).filter((v) => v && v !== "null"),
        );

        const problemas: unknown[] = [];
        const outras: unknown[] = [];
        let conferidas = 0;
        for (let offset = 0; offset < 3000; offset += 1000) {
          let lote: any;
          try {
            lote = await fetchAdvbox(`${ADVBOX_BASE}/posts?limit=1000&offset=${offset}`);
          } catch (e) {
            problemas.push({ motivo: `não foi possível ler as tarefas: ${String(e)}` });
            break;
          }
          const itens: any[] = lote?.data ?? (Array.isArray(lote) ? lote : []);
          if (!itens.length) break;
          for (const post of itens) {
            const criado = String(post.created_at ?? "").slice(0, 10);
            if (criado && criado < desde) continue;
            if (String(post.task ?? "").startsWith("ALERTA DE TAREFA EXCLU")) continue;
            const users: any[] = Array.isArray(post.users) ? post.users : [];
            const meus = users.filter((u) => nossosUsers.has(String(u.user_id)));
            if (!meus.length) continue;
            conferidas++;
            const evento = paraIso(post.date);
            const fatal = paraIso(post.date_deadline);
            const ruimEvento = !!evento && !cal.ehDiaUtil(evento);
            const ruimFatal = !!fatal && !cal.ehDiaUtil(fatal);
            if (!ruimEvento && !ruimFatal) continue;
            const linha = {
              advbox_post_id: post.id ?? null,
              tarefa: post.task ?? null,
              processo: post.lawsuits_id ?? null,
              responsaveis: meus.map((u) => nomeUser[String(u.user_id)] ?? u.name).join(", "),
              criada_em: post.created_at ?? null,
              data_evento: evento ? br(evento) : null,
              prazo_fatal: fatal ? br(fatal) : null,
              motivo: [
                ruimEvento ? `data do evento em dia não útil (${cal.nomeFeriado(evento!) ?? "fim de semana"})` : null,
                ruimFatal ? `prazo fatal em dia não útil (${cal.nomeFeriado(fatal!) ?? "fim de semana"})` : null,
              ].filter(Boolean).join("; "),
              sugestao_data_evento: evento ? br(cal.diaUtilAnterior(evento)) : null,
              sugestao_prazo_fatal: fatal ? br(cal.diaUtilAnterior(fatal)) : null,
            };
            if (nossosPosts.has(String(post.id))) problemas.push(linha);
            else outras.push(linha);
          }
          if (itens.length < 1000) break;
        }
        result = {
          conferidas,
          com_problema: problemas.length,
          tarefas: problemas,
          outras_areas: outras.length,
          tarefas_outras_areas: outras,
        };
        break;
      }


      // Preenche o número real (id) das tarefas gravadas sem ele.
      // Lê poucas páginas de tarefas e casa por processo + tipo + data.
      case "casar_post_ids": {
        const { data: semId } = await supabaseAdmin
          .from("advbox_tarefas_criadas")
          .select("id, lawsuits_id, tasks_id, created_at, data_prazo")
          .is("advbox_post_id", null)
          .limit(100);
        const faltantes = ((semId as any[]) || []);
        if (!faltantes.length) {
          result = { pendentes: 0, casadas: 0, ainda_sem_numero: 0 };
          break;
        }
        const posts: any[] = [];
        for (let offset = 0; offset < 3000; offset += 1000) {
          let lote: any;
          try {
            lote = await fetchAdvbox(`${ADVBOX_BASE}/posts?limit=1000&offset=${offset}`);
          } catch (e) {
            posts.push({ _erro: String(e) });
            break;
          }
          const itens: any[] = lote?.data ?? (Array.isArray(lote) ? lote : []);
          posts.push(...itens);
          if (itens.length < 1000) break;
        }
        const usados = new Set<string>();
        let casadas = 0;
        for (const r of faltantes) {
          const cands = posts.filter(
            (p) =>
              !usados.has(String(p.id)) &&
              String(p.lawsuits_id ?? "") === String(r.lawsuits_id) &&
              (!p.tasks_id || String(p.tasks_id) === String(r.tasks_id)),
          );
          if (!cands.length) continue;
          const alvo = String(r.created_at ?? "").slice(0, 10);
          cands.sort((a, b) => {
            const da = Math.abs(
              new Date(String(a.created_at ?? alvo).slice(0, 10)).getTime() - new Date(alvo).getTime(),
            );
            const db = Math.abs(
              new Date(String(b.created_at ?? alvo).slice(0, 10)).getTime() - new Date(alvo).getTime(),
            );
            return da - db;
          });
          const achado = cands[0];
          usados.add(String(achado.id));
          await supabaseAdmin
            .from("advbox_tarefas_criadas")
            .update({ advbox_post_id: String(achado.id), post_id_pendente: false })
            .eq("id", r.id);
          casadas++;
        }
        result = {
          pendentes: faltantes.length,
          casadas,
          ainda_sem_numero: faltantes.length - casadas,
        };
        break;
      }

      case "list_customers": {
        const limit = Math.min(Number(params?.limit ?? 200), 500);
        const offset = Number(params?.offset ?? 0);
        result = await fetchAdvbox(`${ADVBOX_BASE}/customers?limit=${limit}&offset=${offset}`);
        break;
      }



      case "list_posts": {
        const page = params?.page || 1;
        const extra = params?.lawsuits_id
          ? `&lawsuits_id=${String(params.lawsuits_id).replace(/\D/g, "")}`
          : "";
        const lim = params?.limit ? `&limit=${Number(params.limit)}&offset=${Number(params.offset ?? 0)}` : "";
        result = await fetchAdvbox(`${ADVBOX_BASE}/posts?page=${page}&per_page=50${extra}${lim}`);
        break;
      }


      case "get_movements": {
        const lawsuitId = params?.lawsuit_id;
        if (!lawsuitId) throw new Error("lawsuit_id is required");
        result = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits/${lawsuitId}/movements?per_page=50`);
        break;
      }

      case "sync_movements": {
        // Determine the scope of orgs to sync:
        //  - JWT mode: only the authenticated user's org (derived server-side).
        //  - Cron mode: every org that has at least one linked process.
        // Never trust the client to pass org/user identifiers — always re-derive.
        let orgIds: string[] = [];
        let authedUserId = "";

        if (isCron) {
          const { data: orgsRows } = await supabaseAdmin
            .from("processos")
            .select("organizacao_id")
            .not("advbox_lawsuit_id", "is", null);
          orgIds = Array.from(
            new Set((orgsRows || []).map((r: any) => r.organizacao_id).filter(Boolean))
          );
        } else {
          // Re-validate user strictly with getUser.
          const { data: userData, error: userErr } = await supabase.auth.getUser(token);
          if (userErr || !userData?.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          authedUserId = userData.user.id;
          const { data: membro } = await supabaseAdmin
            .from("membros")
            .select("organizacao_id")
            .eq("user_id", authedUserId)
            .limit(1)
            .maybeSingle();
          const orgId = membro?.organizacao_id as string | undefined;
          if (!orgId) throw new Error("Usuário sem organização vinculada");
          orgIds = [orgId];
        }

        const targetProcessoId = params?.processo_id as string | undefined;
        // Cron mode never accepts a per-process filter.
        const effectiveProcessoId = isCron ? undefined : targetProcessoId;

        // Always scope by organizacao_id (one org at a time) — never mix data.
        let processos: any[] = [];
        for (const orgId of orgIds) {
          let q = supabaseAdmin
            .from("processos")
            .select("id, advbox_lawsuit_id, organizacao_id")
            .eq("organizacao_id", orgId)
            .not("advbox_lawsuit_id", "is", null);
          if (effectiveProcessoId) q = q.eq("id", effectiveProcessoId);
          const { data, error: procErr } = await q;
          if (procErr) throw procErr;
          processos.push(...(data || []));
        }

        const byProcesso: Record<string, number> = {};
        const byOrg: Record<string, number> = {};
        let totalInseridos = 0;
        let totalRecebidos = 0;

        for (const p of processos) {
          const lawsuitId = p.advbox_lawsuit_id as string;
          const rows: any[] = [];
          let page = 1;
          // Paginate until empty / non-array
          // Safety cap to avoid infinite loops on a misbehaving API.
          while (page <= 50) {
            const data: any = await fetchAdvbox(
              `${ADVBOX_BASE}/lawsuits/${lawsuitId}/movements?page=${page}&per_page=50`
            );
            const list: any[] = Array.isArray(data) ? data
              : Array.isArray(data?.data) ? data.data
              : Array.isArray(data?.movements) ? data.movements
              : [];
            if (list.length === 0) break;
            for (const m of list) {
              const advMovId = String(m.id ?? m.movement_id ?? "").trim();
              if (!advMovId) continue;
              const rawDate = m.date ?? m.movement_date ?? m.created_at ?? null;
              const dataIso = rawDate ? String(rawDate).slice(0, 10) : null;
              if (!dataIso) continue;
              const descricao = String(m.description ?? m.text ?? m.title ?? "").trim() || "(sem descrição)";
              const tipo = m.type ?? m.movement_type ?? null;
              rows.push({
                organizacao_id: p.organizacao_id, // enforced from org-scoped query
                processo_id: p.id,                // enforced from org-scoped query
                advbox_lawsuit_id: lawsuitId,
                advbox_movement_id: advMovId,
                data: dataIso,
                descricao,
                tipo: tipo ? String(tipo) : null,
                raw: m,
                origem: "advbox",
                sincronizado_em: new Date().toISOString(),
              });
            }
            if (list.length < 50) break;
            page += 1;
          }
          totalRecebidos += rows.length;

          let inseridos = 0;
          if (rows.length > 0) {
            // Idempotência: UNIQUE (organizacao_id, advbox_movement_id). ignoreDuplicates evita updates.
            const { data: upData, error: upErr } = await supabaseAdmin
              .from("processo_andamentos")
              .upsert(rows, {
                onConflict: "organizacao_id,advbox_movement_id",
                ignoreDuplicates: true,
              })
              .select("id");
            if (upErr) throw upErr;
            inseridos = upData?.length ?? 0;
          }
          byProcesso[p.id] = inseridos;
          byOrg[p.organizacao_id] = (byOrg[p.organizacao_id] || 0) + inseridos;
          totalInseridos += inseridos;
        }

        await supabaseAdmin.from("advbox_sync_log").insert({
          user_id: authedUserId || null,
          tipo_sync: isCron ? "movements_cron" : "movements",
          registros_sincronizados: totalInseridos,
          status: "concluido",
        });

        result = {
          modo: isCron ? "cron" : "manual",
          organizacoes: orgIds.length,
          processos_sincronizados: processos.length,
          andamentos_recebidos: totalRecebidos,
          andamentos_novos: totalInseridos,
          por_processo: byProcesso,
          por_organizacao: byOrg,
        };
        break;
      }

      case "list_tasks": {
        const page = params?.page || 1;
        result = await fetchAdvbox(`${ADVBOX_BASE}/tasks?page=${page}&per_page=50`);
        break;
      }

      case "sync_agenda": {
        // 1) Discover org of the caller
        const { data: membro } = await supabaseAdmin
          .from("membros")
          .select("organizacao_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        const orgId = membro?.organizacao_id;
        if (!orgId) throw new Error("Usuário sem organização vinculada");

        // 2) Pull Advbox users to build email -> advbox_user_id map
        const usersResp = await fetchAdvbox(`${ADVBOX_BASE}/users?per_page=100`);
        const advUsers: any[] = Array.isArray(usersResp)
          ? usersResp
          : (usersResp as any)?.data ?? [];
        const advUserById = new Map<string, any>();
        advUsers.forEach((u: any) => {
          if (u?.id != null) advUserById.set(String(u.id), u);
        });

        // 3) Build email -> membro user_id map (current org) via auth.users
        const { data: orgMembers } = await supabaseAdmin
          .from("membros")
          .select("user_id")
          .eq("organizacao_id", orgId);
        const memberIds = new Set(
          (orgMembers || []).map((m: any) => m.user_id)
        );
        const emailToMember = new Map<string, string>();
        let authPage = 1;
        while (authPage <= 20) {
          const { data: authData, error: authErr } =
            await supabaseAdmin.auth.admin.listUsers({
              page: authPage,
              perPage: 200,
            });
          if (authErr || !authData) break;
          for (const u of authData.users) {
            if (u.email && memberIds.has(u.id)) {
              emailToMember.set(u.email.toLowerCase().trim(), u.id);
            }
          }
          if (authData.users.length < 200) break;
          authPage++;
        }

        // 4) Fetch all Advbox tasks (paginate up to 10 pages)
        const allTasks: any[] = [];
        for (let page = 1; page <= 10; page++) {
          const resp: any = await fetchAdvbox(
            `${ADVBOX_BASE}/tasks?page=${page}&per_page=50`
          );
          const chunk: any[] = Array.isArray(resp) ? resp : resp?.data ?? [];
          if (chunk.length === 0) break;
          allTasks.push(...chunk);
          if (chunk.length < 50) break;
        }

        // 5) Map and upsert
        const rows = allTasks
          .map((t: any) => {
            const advboxId = String(t.id ?? t.task_id ?? "");
            if (!advboxId) return null;
            const rawDate =
              t.date || t.due_date || t.deadline || t.start_date || null;
            const data = rawDate
              ? String(rawDate).substring(0, 10)
              : null;
            if (!data) return null;

            const titulo =
              t.title ||
              t.description ||
              t.subject ||
              t.name ||
              "Compromisso Advbox";

            // Find responsible user email
            let respEmail: string | null = null;
            const respIds = [
              t.user_id,
              t.responsible_id,
              t.assigned_to,
              ...((t.users as any[]) || []).map((u: any) => u?.id),
            ].filter(Boolean);
            for (const rid of respIds) {
              const u = advUserById.get(String(rid));
              if (u?.email) {
                respEmail = String(u.email).toLowerCase().trim();
                break;
              }
            }

            const responsavel_id = respEmail
              ? emailToMember.get(respEmail) || null
              : null;

            const clienteNome =
              t.customer?.name ||
              t.customer_name ||
              t.lawsuit?.customer?.name ||
              null;

            const status = t.status || (t.done ? "concluida" : "pendente");
            const concluida =
              t.done === true || t.completed === true || status === "concluida";

            return {
              organizacao_id: orgId,
              advbox_id: advboxId,
              data,
              hora: t.hour || t.time || null,
              titulo: String(titulo).slice(0, 500),
              descricao: t.description || t.notes || null,
              cliente_nome: clienteNome,
              responsavel_email: respEmail,
              responsavel_id,
              status,
              concluida,
              raw: t,
              synced_at: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        let upserted = 0;
        if (rows.length > 0) {
          const { error: upErr, count } = await supabaseAdmin
            .from("advbox_agenda")
            .upsert(rows as any[], {
              onConflict: "organizacao_id,advbox_id",
              count: "exact",
            });
          if (upErr) throw new Error(`Upsert falhou: ${upErr.message}`);
          upserted = count ?? rows.length;
        }

        await supabaseAdmin.from("advbox_sync_log").insert({
          user_id: userId,
          tipo_sync: "agenda",
          registros_sincronizados: upserted,
          status: "concluido",
        });

        result = {
          total_advbox: allTasks.length,
          importados: upserted,
          sem_responsavel: rows.filter((r: any) => !r.responsavel_id).length,
        };
        break;
      }

      case "count_agronegocio": {
        // Read-only: official filter `group` (partial, case-insensitive) per
        // api.softwareadvbox.com.br docs; response has totalCount/data/limit/offset.
        let attempt = 0;
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        let data: any = null;
        while (true) {
          attempt += 1;
          try {
            data = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits?group=${encodeURIComponent("AGRONEGÓCIO")}&limit=1&offset=0`);
            break;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("[429]") && attempt < 8) { await sleep(12000); continue; }
            throw e;
          }
        }
        const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const todosAgro = list.every((l) => String(l.group ?? "").toUpperCase().includes("AGRONEG"));
        result = {
          filtro_respeitado: todosAgro,
          total_count: typeof data?.totalCount === "number" ? data.totalCount : null,
          itens_na_resposta: list.length,
        };
        await supabaseAdmin.from("advbox_sync_log").insert({
          user_id: userId || null,
          tipo_sync: "count_agronegocio",
          registros_sincronizados: (result as any).total_count ?? 0,
          status: todosAgro ? "concluido" : "filtro_ignorado",
          erro: JSON.stringify(result),
        });
        break;
      }

      // Read-only: detalhe de uma tarefa (post) para conferir campos aceitos.
      case "get_post": {
        const id = String(params?.id ?? "").replace(/\D/g, "");
        if (!id) throw new Error("id obrigatório");
        result = await fetchAdvbox(`${ADVBOX_BASE}/posts/${id}`);
        break;
      }

      // Tentativa de encerrar/remover tarefa criada por engano (DELETE /posts/{id}).
      case "delete_post": {
        const id = String(params?.id ?? "").replace(/\D/g, "");
        if (!id) throw new Error("id obrigatório");
        try {
          result = { ok: true, resposta: await fetchAdvbox(`${ADVBOX_BASE}/posts/${id}`, { method: "DELETE" }) };
        } catch (e) {
          result = { ok: false, erro: e instanceof Error ? e.message : String(e) };
        }
        break;
      }


      // Auditoria / ajuste do responsável do PROCESSO nos processos ligados
      // às nossas operações. params: { dry_run?, limit?, offset? }
      case "processos_responsavel": {
        const dry = params?.dry_run !== false;
        const limit = Number(params?.limit ?? 25);
        const offset = Number(params?.offset ?? 0);
        const WILLIAN = "151894";
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const { data: ops } = await supabaseAdmin
          .from("operacoes_credito")
          .select("advbox_lawsuits_id")
          .is("deleted_at", null)
          .not("advbox_lawsuits_id", "is", null);
        const ids = [...new Set((ops ?? []).map((o: any) => String(o.advbox_lawsuits_id)))].sort();
        const fatia = ids.slice(offset, offset + limit);

        const linhas: unknown[] = [];
        const erros: unknown[] = [];
        for (const id of fatia) {
          try {
            const det: any = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits/${id}`);
            const l = det?.data ?? det ?? {};
            const grupo = String(l.group ?? "").toUpperCase();
            const respAtual = String(l.responsible_id ?? l.users_id ?? "");
            const respNome = l.responsible ?? null;
            const agro = grupo.includes("AGRONEG");
            let alterado = false;
            if (!dry && agro && respAtual !== WILLIAN) {
              // Grava o responsável ANTIGO antes de trocar (permite reverter).
              const { data: jaMarca } = await supabaseAdmin
                .from("advbox_processos_marcas")
                .select("id")
                .eq("advbox_lawsuits_id", String(id))
                .eq("marca", "responsavel_anterior")
                .maybeSingle();
              if (!jaMarca) {
                await supabaseAdmin.from("advbox_processos_marcas").insert({
                  advbox_lawsuits_id: String(id),
                  marca: "responsavel_anterior",
                  observacao: JSON.stringify({
                    responsible_id: respAtual || null,
                    responsible: respNome,
                    trocado_para: WILLIAN,
                  }),
                });
              }
              await fetchAdvbox(`${ADVBOX_BASE}/lawsuits/${id}`, {
                method: "PUT",
                body: JSON.stringify({ users_id: WILLIAN }),
              });
              alterado = true;
              await sleep(1200);
            }
            linhas.push({
              id,
              grupo: l.group ?? null,
              tipo: l.type ?? l.type_lawsuit_id ?? null,
              responsavel_atual: respAtual || null,
              responsavel_nome: respNome,
              agro,
              precisa_mudar: agro && respAtual !== WILLIAN,
              alterado,
            });
          } catch (e) {
            erros.push({ id, erro: String(e) });
          }
          await sleep(2100);
        }
        const porAnterior: Record<string, number> = {};
        for (const x of linhas as any[]) {
          if (!x.precisa_mudar) continue;
          const k = x.responsavel_nome || x.responsavel_atual || "(sem responsável)";
          porAnterior[k] = (porAnterior[k] ?? 0) + 1;
        }
        result = {
          total_processos: ids.length,
          fatia: { offset, limit, lidos: fatia.length },
          precisam_mudar: linhas.filter((x: any) => x.precisa_mudar).length,
          alterados: linhas.filter((x: any) => x.alterado).length,
          por_responsavel_anterior: porAnterior,
          linhas,
          erros,
        };
        break;
      }


      case "sync_customer": {
        result = await fetchAdvbox(`${ADVBOX_BASE}/customers`, {
          method: "POST",
          body: JSON.stringify({ customer: params?.customer }),
        });
        break;
      }

      case "sync_all": {
        const custData = await fetchAdvbox(`${ADVBOX_BASE}/customers?per_page=50`);
        const lawData = await fetchAdvbox(`${ADVBOX_BASE}/lawsuits?per_page=50`);
        const postData = await fetchAdvbox(`${ADVBOX_BASE}/posts?per_page=50`);

        const arr = (v: unknown) => Array.isArray(v) ? v.length : 0;
        const totalRecords = arr(custData) + arr(lawData) + arr(postData);

        await supabase.from("advbox_sync_log").insert({
          user_id: userId,
          tipo_sync: "all",
          registros_sincronizados: totalRecords,
          status: "concluido",
        });

        result = { customers: custData, lawsuits: lawData, posts: postData, total: totalRecords };
        break;
      }

      // ===================== FASE A — RECONCILIAÇÃO (só leitura no ADVBOX) ====
      case "recon_fase_a": {
        const jobId = crypto.randomUUID();
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const norm = (s: unknown) =>
          String(s ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

        const getPaginado = async (path: string, max = 5000) => {
          const out: any[] = [];
          let offset = 0;
          const limit = 200;
          while (out.length < max) {
            let data: any = null;
            let attempt = 0;
            while (true) {
              attempt++;
              try {
                const sep = path.includes("?") ? "&" : "?";
                data = await fetchAdvbox(`${ADVBOX_BASE}${path}${sep}limit=${limit}&offset=${offset}`);
                break;
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (msg.includes("[429]") && attempt < 8) { await sleep(12000); continue; }
                throw e;
              }
            }
            const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            out.push(...list);
            const total = typeof data?.totalCount === "number" ? data.totalCount : null;
            if (list.length < limit) break;
            if (total !== null && out.length >= total) break;
            offset += limit;
            await sleep(2200); // respeita 30 GET/min
          }
          return out;
        };

        const job = async () => {
          try {
            // --- nossos dados -------------------------------------------------
            const { data: clientes } = await supabaseAdmin
              .from("clientes")
              .select("id, nome, cpf_cnpj, grupo, situacao, organizacao_id, advbox_customers_id")
              .is("deleted_at", null);
            const ativos = (clientes || []).filter(
              (c: any) => !c.situacao || String(c.situacao).toLowerCase() === "ativo"
            );

            const { data: operacoes } = await supabaseAdmin
              .from("operacoes_credito")
              .select("id, cliente_id, titular_nome, banco, numero, responsavel, advbox_lawsuits_id");

            // --- ADVBOX (só GET) ---------------------------------------------
            const advCustomers = await getPaginado("/customers");
            await sleep(2200);
            const advLawsuits = await getPaginado(`/lawsuits?group=${encodeURIComponent("AGRONEGÓCIO")}`);

            const docDe = (c: any) => soDigitos(c?.identification ?? c?.document ?? c?.cpf ?? c?.cnpj);
            const porDoc = new Map<string, any>();
            const porNome = new Map<string, any[]>();
            for (const c of advCustomers) {
              const doc = docDe(c);
              if (doc.length >= 11) porDoc.set(doc, c);
              const n = norm(c.name ?? c.nome);
              if (n) porNome.set(n, [...(porNome.get(n) || []), c]);
            }

            const casadosCpf: any[] = [];
            const casadosNome: any[] = [];
            const soAqui: any[] = [];
            const vinculados = new Set<string>();
            const advIdPorNome = new Map<string, string>();

            for (const cli of ativos) {
              const doc = soDigitos(cli.cpf_cnpj);
              let match = doc.length >= 11 ? porDoc.get(doc) : undefined;
              let modo = "cpf";
              if (!match) {
                const cand = porNome.get(norm(cli.nome)) || [];
                if (cand.length >= 1) { match = cand[0]; modo = cand.length === 1 ? "nome" : "nome_ambiguo"; }
              }
              if (match && modo !== "nome_ambiguo") {
                const advId = String(match.id);
                vinculados.add(advId);
                advIdPorNome.set(norm(cli.nome), advId);
                (modo === "cpf" ? casadosCpf : casadosNome).push({
                  cliente_id: cli.id, nome: cli.nome, advbox_customers_id: advId, advbox_nome: match.name ?? match.nome,
                });
                await supabaseAdmin.from("clientes").update({ advbox_customers_id: advId }).eq("id", cli.id);
              } else {
                soAqui.push({ cliente_id: cli.id, nome: cli.nome, cpf_cnpj: cli.cpf_cnpj, motivo: modo });
              }
            }

            const soLa = advCustomers
              .filter((c: any) => !vinculados.has(String(c.id)))
              .map((c: any) => ({ advbox_customers_id: String(c.id), nome: c.name ?? c.nome }));

            // --- processos por titular ---------------------------------------
            // A API do ADVBOX não devolve partes contrárias (só o cliente), então
            // o casamento é por TITULAR + tipo de ação aceito.
            const TIPOS_ACEITOS = ["1439148", "1821777", "2083400", "1467961"];
            const processosPorCustomer = new Map<string, any[]>();
            const processosPorNome = new Map<string, any[]>();
            for (const l of advLawsuits) {
              if (!TIPOS_ACEITOS.includes(String(l.type_lawsuit_id ?? l.type_lawsuits_id ?? ""))) continue;
              for (const c of (l.customers || [])) {
                const cid = String(c?.customer_id ?? c?.id ?? "");
                if (cid) processosPorCustomer.set(cid, [...(processosPorCustomer.get(cid) || []), l]);
                const n = norm(c?.name);
                if (n) processosPorNome.set(n, [...(processosPorNome.get(n) || []), l]);
              }
            }

            const clienteById = new Map((clientes || []).map((c: any) => [c.id, c]));
            const pares = new Map<string, any>();
            for (const op of operacoes || []) {
              const cli: any = clienteById.get(op.cliente_id);
              if (!cli) continue;
              if (cli.situacao && String(cli.situacao).toLowerCase() !== "ativo") continue;
              const titular = op.titular_nome || cli.nome;
              const banco = op.banco;
              if (!titular || !banco) continue;
              const key = `${norm(titular)}|${norm(banco)}`;
              const p = pares.get(key) || {
                titular, banco, cliente_id: cli.id,
                advbox_customers_id: cli.advbox_customers_id || advIdPorNome.get(norm(titular)) || null,
                operacoes: [] as any[],
              };
              p.operacoes.push({ id: op.id, numero: op.numero });
              pares.set(key, p);
            }

            const bancosPorTitular = new Map<string, Set<string>>();
            for (const p of pares.values()) {
              const k = norm(p.titular);
              bancosPorTitular.set(k, (bancosPorTitular.get(k) || new Set()).add(p.banco));
            }

            const resumoProc = (l: any) => ({
              advbox_lawsuits_id: String(l.id),
              numero_cnj: l.process_number ?? l.protocol_number ?? null,
              tipo: l.type ?? null,
              fase: l.stage ?? null,
              responsavel: l.responsible ?? null,
              cliente: (l.customers || []).map((c: any) => c?.name).join(", "),
            });

            const comProcesso: any[] = [];
            const semProcesso: any[] = [];
            const multiplos: any[] = [];

            for (const p of pares.values()) {
              const custId = p.advbox_customers_id;
              let cands: any[] = custId ? (processosPorCustomer.get(String(custId)) || []) : [];
              if (cands.length === 0) cands = processosPorNome.get(norm(p.titular)) || [];
              const bancosDoTitular = bancosPorTitular.get(norm(p.titular))?.size ?? 1;

              if (cands.length === 1 && bancosDoTitular === 1) {
                const advId = String(cands[0].id);
                comProcesso.push({ titular: p.titular, banco: p.banco, ...resumoProc(cands[0]), operacoes: p.operacoes.length });
                for (const o of p.operacoes) {
                  await supabaseAdmin.from("operacoes_credito")
                    .update({ advbox_lawsuits_id: advId, advbox_titular_customers_id: custId })
                    .eq("id", o.id);
                }
              } else if (cands.length === 0) {
                semProcesso.push({
                  titular: p.titular, banco: p.banco,
                  tem_cadastro_advbox: !!custId,
                  operacoes: p.operacoes.map((o: any) => o.numero),
                });
              } else {
                multiplos.push({
                  titular: p.titular, banco: p.banco,
                  bancos_do_titular: bancosDoTitular,
                  operacoes: p.operacoes.map((o: any) => o.numero),
                  processos: cands.map(resumoProc),
                });
              }
            }

            const resumo = {
              job_id: jobId,
              clientes_ativos: ativos.length,
              advbox_customers: advCustomers.length,
              advbox_lawsuits_agro: advLawsuits.length,
              casados_por_cpf: casadosCpf.length,
              casados_so_por_nome: casadosNome.length,
              so_no_nosso_app: soAqui.length,
              so_no_advbox: soLa.length,
              pares_titular_banco: pares.size,
              pares_com_processo: comProcesso.length,
              pares_sem_processo: semProcesso.length,
              pares_a_decidir: multiplos.length,
            };

            await supabaseAdmin.from("advbox_reconciliacao").insert({
              organizacao_id: (ativos[0] as any)?.organizacao_id ?? null,
              criado_por: userId || null,
              fase: "A",
              resumo,
              detalhe: {
                casados_cpf: casadosCpf, casados_nome: casadosNome,
                so_aqui: soAqui, so_la: soLa.slice(0, 200),
                com_processo: comProcesso, sem_processo: semProcesso, a_decidir: multiplos,
              },
            });
          } catch (e) {
            await supabaseAdmin.from("advbox_reconciliacao").insert({
              criado_por: userId || null,
              fase: "A",
              resumo: { job_id: jobId, erro: e instanceof Error ? e.message : String(e) },
              detalhe: {},
            });
          }
        };

        // roda em segundo plano: a varredura passa do limite de tempo da chamada
        // @ts-ignore EdgeRuntime global
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job());
        else job();
        result = { iniciado: true, job_id: jobId };
        break;
      }


      default:

        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    // Log individual syncs (except those that log internally)
    if (
      action !== "sync_all" &&
      action !== "test_connection" &&
      action !== "get_settings" &&
      action !== "sync_agenda" &&
      action !== "sync_movements"
    ) {
      await supabase.from("advbox_sync_log").insert({
        user_id: userId,
        tipo_sync: action,
        registros_sincronizados: Array.isArray(result)
          ? result.length
          : 1,
        status: "concluido",
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Advbox sync error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
