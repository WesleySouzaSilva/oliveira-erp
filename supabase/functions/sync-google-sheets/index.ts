import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ContratoRow = {
  id: string;
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
  vencimento_proxima_parcela: string | null;
  valor_total_operacao: number | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeKeyPart(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildContratoKey(data: {
  nome_cliente?: string | null;
  numero_contrato?: string | null;
  banco?: string | null;
  vencimento_proxima_parcela?: string | null;
  valor_total_operacao?: number | null;
}): string {
  const nome = normalizeKeyPart(data.nome_cliente);
  if (!nome) return "";

  const numero = normalizeKeyPart(data.numero_contrato);
  const banco = normalizeKeyPart(data.banco);

  if (numero) {
    return `num|${nome}|${numero}|${banco || "-"}`;
  }

  const vencimento = (data.vencimento_proxima_parcela || "").trim();
  const total = data.valor_total_operacao != null ? Number(data.valor_total_operacao).toFixed(2) : "";
  return `fallback|${nome}|${banco || "-"}|${vencimento}|${total}`;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^"|"$/g, "");
}

function parseMoney(val: string): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[R$\s"]/g, "");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let numeric: string;
  if (lastComma > lastDot) {
    numeric = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    numeric = cleaned.replace(/,/g, "");
  }

  const n = parseFloat(numeric);
  return isNaN(n) ? null : n;
}

function parseDate(val: string): string | null {
  if (!val) return null;
  const trimmed = val.trim().replace(/^"|"$/g, "");

  const brMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  return null;
}

function parseBool(val: string): boolean {
  const v = val.trim().toUpperCase().replace(/^"|"$/g, "");
  return v === "TRUE" || v === "SIM" || v === "S" || v === "1" || v === "X";
}

function addToLookup(map: Map<string, ContratoRow[]>, row: ContratoRow) {
  const key = buildContratoKey(row);
  if (!key) return;
  const items = map.get(key) || [];
  items.push(row);
  map.set(key, items);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error("Not authenticated");

    // Derivar SEMPRE no servidor as organizações do usuário (fonte da verdade).
    // Nunca confiar em organizacao_id vindo do body sem validar contra esta lista.
    const { data: membrosUser, error: membrosErr } = await supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", user.id);
    if (membrosErr) throw membrosErr;
    const userOrgIds: string[] = (membrosUser || [])
      .map((m: { organizacao_id: string | null }) => m.organizacao_id)
      .filter((v): v is string => !!v);

    const body = await req.json();
    const { action, spreadsheet_url, sheet_name, config_id } = body;
    const bodyOrgId: string | undefined = body?.organizacao_id;

    // Autorização da organização — derivada do user.id, validada contra body se enviado.
    let organizacaoId: string | null = null;
    if (bodyOrgId) {
      if (!userOrgIds.includes(bodyOrgId)) {
        return new Response(
          JSON.stringify({ error: "organização não autorizada" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      organizacaoId = bodyOrgId;
    } else if (userOrgIds.length === 1) {
      organizacaoId = userOrgIds[0];
    } else if (userOrgIds.length > 1) {
      return new Response(
        JSON.stringify({ error: "informe organizacao_id: usuário pertence a várias organizações" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // userOrgIds.length === 0 → organizacaoId permanece null (escopo só do próprio user_id)

    if (action !== "sync") {
      throw new Error("Ação não reconhecida");
    }

    const match = spreadsheet_url?.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error("URL inválida do Google Sheets. Use o link de compartilhamento.");
    }

    const spreadsheetId = match[1];
    const sheetParam = sheet_name || "Sheet1";

    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetParam)}`;
    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error("Não foi possível acessar a planilha. Verifique se está compartilhada como 'Qualquer pessoa com o link'.");
    }

    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/).filter((l: string) => l.trim());

    if (lines.length < 2) throw new Error("Planilha vazia");

    const headers = parseCSVLine(lines[0]).map(normalizeHeader);
    const rows = lines.slice(1);

    // Busca contratos no escopo da organização inteira (evita duplicatas entre membros da equipe)
    let existingQuery = supabase
      .from("contratos_vencimentos")
      .select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_total_operacao, created_at, updated_at, user_id, organizacao_id")
      .is("deleted_at", null);
    if (organizacaoId) {
      // organizacaoId já foi validado contra user_org_ids — seguro usar no filtro.
      existingQuery = existingQuery.eq("organizacao_id", organizacaoId);
    } else {
      existingQuery = existingQuery.eq("user_id", user.id);
    }
    const { data: existingContratos, error: existingError } = await existingQuery;

    if (existingError) throw existingError;

    const existingLookup = new Map<string, ContratoRow[]>();
    for (const existing of (existingContratos || []) as ContratoRow[]) {
      addToLookup(existingLookup, existing);
    }

    const duplicateExamples: Array<{
      nome_cliente: string;
      numero_contrato: string | null;
      banco: string | null;
      existing_ids: string[];
    }> = [];

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let duplicateConflicts = 0;

    for (const row of rows) {
      const cols = parseCSVLine(row);
      if (cols.length < 2 || cols.every((c) => !c.replace(/"/g, ""))) continue;

      const get = (name: string) => {
        const idx = headers.findIndex((h: string) => h.includes(name));
        return idx >= 0 ? cols[idx]?.replace(/^"|"$/g, "") : "";
      };

      const nomeCliente = get("nome") || get("cliente") || cols[0]?.replace(/^"|"$/g, "") || "";
      if (!nomeCliente) {
        skipped++;
        continue;
      }

      const payload = {
        user_id: user.id,
        organizacao_id: organizacaoId,
        nome_cliente: nomeCliente,
        banco: get("banco") || cols[1]?.replace(/^"|"$/g, "") || null,
        numero_contrato: get("contrato") || get("numero") || cols[2]?.replace(/^"|"$/g, "") || null,
        vencimento_proxima_parcela: parseDate(get("vencimento") || cols[3] || ""),
        valor_parcela: parseMoney(get("parcela") || cols[4] || ""),
        valor_total_operacao: parseMoney(get("total") || get("operacao") || get("valor") || cols[5] || ""),
        parcelas_vencidas: parseBool(get("vencidas") || cols[6] || ""),
        possui_laudo: parseBool(get("laudo") || cols[7] || ""),
        data_limite_protocolo: get("limite") || get("protocolo") || cols[8]?.replace(/^"|"$/g, "") || null,
        protocolo_realizado: parseBool(get("realizado") || cols[9] || ""),
        status_prazo: get("status") || cols[13]?.replace(/^"|"$/g, "") || "pendente",
        updated_at: new Date().toISOString(),
      };

      const key = buildContratoKey(payload);
      if (!key) {
        skipped++;
        continue;
      }

      const matches = existingLookup.get(key) || [];

      if (matches.length > 1) {
        duplicateConflicts++;
        if (duplicateExamples.length < 20) {
          duplicateExamples.push({
            nome_cliente: payload.nome_cliente,
            numero_contrato: payload.numero_contrato,
            banco: payload.banco,
            existing_ids: matches.map((m) => m.id),
          });
        }
        continue;
      }

      if (matches.length === 1) {
        const targetId = matches[0].id;
        // Atualiza pelo ID — evita o filtro user_id que bloqueava registros de colegas
        const updatePayload: Record<string, unknown> = { ...payload };
        delete (updatePayload as any).user_id; // não sobrescreve dono original
        if (!organizacaoId) delete (updatePayload as any).organizacao_id;
        const { error: updateError } = await supabase
          .from("contratos_vencimentos")
          .update(updatePayload)
          .eq("id", targetId);

        if (updateError) {
          skipped++;
          continue;
        }

        updated++;
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("contratos_vencimentos")
        .insert(payload)
        .select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_total_operacao, created_at, updated_at")
        .single();

      if (insertError || !inserted) {
        skipped++;
        continue;
      }

      created++;
      addToLookup(existingLookup, inserted as ContratoRow);
    }

    if (config_id) {
      await supabase
        .from("sheets_sync_config")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", config_id)
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: created + updated,
        created,
        updated,
        skipped,
        duplicate_conflicts: duplicateConflicts,
        duplicate_examples: duplicateExamples,
        total_rows: rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
