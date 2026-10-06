// Andamentos pelo DataJud (API pública do CNJ). Mão única: DataJud -> app.
// Guarda metadados e movimentos em tabelas próprias da Controladoria.
import { adminClient, autenticar, corsHeaders, espera, json } from "../_shared/controladoria.ts";

const BASE = "https://api-publica.datajud.cnj.jus.br";
const UF_TR: Record<string, string> = {
  "01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce", "07": "dft", "08": "es", "09": "go",
  "10": "ma", "11": "mt", "12": "ms", "13": "mg", "14": "pa", "15": "pb", "16": "pr", "17": "pe", "18": "pi",
  "19": "rj", "20": "rn", "21": "rs", "22": "ro", "23": "rr", "24": "sc", "25": "se", "26": "sp", "27": "to",
};

/** Alias do tribunal a partir do número CNJ (NNNNNNN DD AAAA J TR OOOO). */
export function aliasTribunal(cnj: string): string | null {
  if (!/^\d{20}$/.test(cnj)) return null;
  const j = cnj[13];
  const tr = cnj.slice(14, 16);
  const n = String(Number(tr));
  if (j === "8") return UF_TR[tr] ? `tj${UF_TR[tr]}` : null;
  if (j === "4") return Number(tr) >= 1 && Number(tr) <= 6 ? `trf${n}` : null;
  if (j === "5") return tr === "00" ? "tst" : Number(tr) <= 24 ? `trt${n}` : null;
  if (j === "6") return tr === "00" ? "tse" : UF_TR[tr] ? `tre-${UF_TR[tr]}` : null;
  if (j === "3") return "stj";
  if (j === "7") return "stm";
  if (j === "9") return ({ "13": "tjmmg", "21": "tjmrs", "26": "tjmsp" } as Record<string, string>)[tr] ?? null;
  return null;
}

/** DataJud manda a data em ISO ou como "yyyyMMddHHmmss". */
function dataIso(v: any): string | null {
  const t = String(v ?? "");
  const m = t.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}Z`;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function consultar(alias: string, cnj: string, key: string) {
  for (let t = 1; t <= 5; t++) {
    const res = await fetch(`${BASE}/api_publica_${alias}/_search`, {
      method: "POST",
      headers: { Authorization: `APIKey ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { match: { numeroProcesso: cnj } }, size: 10 }),
    });
    if (res.status === 429 || res.status >= 500) { await espera(2000 * 2 ** (t - 1)); continue; }
    const txt = await res.text();
    if (!res.ok) throw new Error(`DataJud ${res.status}`);
    return JSON.parse(txt)?.hits?.hits ?? [];
  }
  throw new Error("DataJud limitou as consultas");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const a = await autenticar(req, admin);
  if (!a.ok) return json({ error: "Não autorizado" }, 401);
  const key = Deno.env.get("DATAJUD_API_KEY");
  if (!key) return json({ error: "Chave do DataJud não configurada" }, 500);
  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const simular = body.simular === true;
  const limite = Math.min(Number(body.limite) || 400, 1000);
  const orcamento = Math.min(Number(body.orcamento_ms) || 130000, 140000);
  const inicio = Date.now();

  if (a.origem === "manual") {
    const { data: m } = await admin.from("membros").select("papel").eq("user_id", a.userId!).in("organizacao_id", a.orgIds);
    if (!(m || []).some((x: any) => x.papel === "admin")) return json({ error: "Só administradores" }, 403);
  }

  const saida: any[] = [];
  for (const orgId of a.orgIds) {
    // 1. Semear e recalcular frequência a partir de processos_judiciais.
    const pjs: any[] = [];
    for (let de = 0; ; de += 1000) {
      const { data } = await admin.from("processos_judiciais").select("id, numero_cnj").eq("organizacao_id", orgId).range(de, de + 999);
      pjs.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const comNumero = pjs.filter((p) => /^\d{20}$/.test(p.numero_cnj || ""));
    const desde = new Date(Date.now() - 90 * 86400e3).toISOString().slice(0, 10);
    const quentes = new Set<string>();
    for (let de = 0; ; de += 1000) {
      const { data } = await admin.from("djen_comunicacoes").select("numero_processo").eq("organizacao_id", orgId).gte("data_disponibilizacao", desde).range(de, de + 999);
      for (const r of data || []) if (r.numero_processo) quentes.add(r.numero_processo);
      if (!data || data.length < 1000) break;
    }
    const ativosPj = new Set<string>();
    const { data: ativos } = await admin.from("clientes").select("id").eq("organizacao_id", orgId).is("deleted_at", null).eq("base_historica_advbox", false);
    const idsAtivos = new Set((ativos || []).map((c: any) => c.id));
    for (let de = 0; ; de += 1000) {
      const { data } = await admin.from("processo_judicial_clientes").select("processo_judicial_id, cliente_id").eq("organizacao_id", orgId).range(de, de + 999);
      for (const r of data || []) if (idsAtivos.has(r.cliente_id)) ativosPj.add(r.processo_judicial_id);
      if (!data || data.length < 1000) break;
    }
    const semear = comNumero.map((p) => ({
      organizacao_id: orgId, numero_cnj: p.numero_cnj, processo_judicial_id: p.id,
      frequencia: quentes.has(p.numero_cnj) || ativosPj.has(p.id) ? "diaria" : "semanal",
    }));
    const diarias = semear.filter((s) => s.frequencia === "diaria").length;
    if (!simular) {
      // Novos entram; os existentes só têm a frequência atualizada.
      for (let i = 0; i < semear.length; i += 500) {
        await admin.from("controladoria_datajud_processos").upsert(semear.slice(i, i + 500), { onConflict: "organizacao_id,numero_cnj", ignoreDuplicates: true });
      }
      for (const f of ["diaria", "semanal"]) {
        const nums = semear.filter((s) => s.frequencia === f).map((s) => s.numero_cnj);
        for (let i = 0; i < nums.length; i += 300) {
          await admin.from("controladoria_datajud_processos").update({ frequencia: f }).eq("organizacao_id", orgId).eq("origem", "advbox").in("numero_cnj", nums.slice(i, i + 300));
        }
      }
    }

    // 2. Consultar os que estão vencidos.
    let fila: any[];
    if (simular) {
      fila = comNumero.slice(0, Math.min(limite, 50)).map((p) => ({ numero_cnj: p.numero_cnj, consultado_em: null }));
    } else {
      const { data } = await admin.from("controladoria_datajud_processos").select("id, numero_cnj, frequencia, consultado_em")
        .eq("organizacao_id", orgId).lte("proxima_consulta_em", new Date().toISOString())
        .order("proxima_consulta_em").limit(limite);
      fila = data || [];
    }
    const { data: exec } = simular ? { data: null } : await admin.from("controladoria_monitor_execucoes")
      .insert({ organizacao_id: orgId, tipo: "datajud", modo: "real", origem: a.origem }).select("id").single();

    let req_ = 0, encontrados = 0, naoEnc = 0, semAlias = 0, movsNovos = 0;
    const erros: any[] = [];
    const amostra: any[] = [];
    const porTribunal: Record<string, number> = {};
    let parar = false;
    const processar = async (p: any): Promise<void> => {
      const alias = aliasTribunal(p.numero_cnj);
      if (!alias) {
        semAlias++;
        if (!simular) await admin.from("controladoria_datajud_processos").update({ erro: "sem tribunal", consultado_em: new Date().toISOString(), proxima_consulta_em: new Date(Date.now() + 30 * 86400e3).toISOString() }).eq("id", p.id);
        return;
      }
      porTribunal[alias] = (porTribunal[alias] || 0) + 1;
      let hits: any[] = [];
      try { hits = await consultar(alias, p.numero_cnj, key); req_++; }
      catch (e) { erros.push({ cnj: p.numero_cnj, erro: String((e as Error).message) }); req_++; if (erros.length > 20) parar = true; return; }
      await espera(500);
      const src = hits.map((h: any) => h._source).filter(Boolean);
      const movs = new Map<string, any>();
      for (const s of src) for (const m of s.movimentos || []) {
        const dh = dataIso(m?.dataHora);
        if (!dh) continue;
        const k = `${m.codigo ?? 0}|${dh}`;
        if (!movs.has(k)) movs.set(k, {
          organizacao_id: orgId, numero_cnj: p.numero_cnj, codigo: Number(m.codigo) || 0, nome: m.nome ?? null,
          data_hora: dh, complementos: m.complementosTabelados ?? null, carga_inicial: !p.consultado_em,
        });
      }
      const s0 = src[0];
      if (s0) encontrados++; else naoEnc++;
      if (simular) {
        if (amostra.length < 20) amostra.push({ cnj: p.numero_cnj, tribunal: alias, encontrado: !!s0, classe: s0?.classe?.nome ?? null, movimentos: movs.size });
        movsNovos += movs.size;
        return;
      }
      const lista = [...movs.values()];
      for (let i = 0; i < lista.length; i += 500) {
        const { count } = await admin.from("controladoria_datajud_movimentos").upsert(lista.slice(i, i + 500), { onConflict: "organizacao_id,numero_cnj,codigo,data_hora", ignoreDuplicates: true, count: "exact" });
        movsNovos += count || 0;
      }
      const dias = p.frequencia === "diaria" ? 1 : 7;
      await admin.from("controladoria_datajud_processos").update({
        tribunal: alias, classe: s0?.classe?.nome ?? null, orgao_julgador: s0?.orgaoJulgador?.nome ?? null,
        assuntos: s0?.assuntos ?? null, data_ajuizamento: dataIso(s0?.dataAjuizamento), grau: s0?.grau ?? null,
        dados_brutos: s0 ? { ...s0, movimentos: undefined } : null, nao_encontrado: !s0, erro: null,
        consultado_em: new Date().toISOString(),
        proxima_consulta_em: new Date(Date.now() + dias * 86400e3 - 3600e3).toISOString(),
      }).eq("id", p.id).then(({ error }) => { if (error) erros.push({ cnj: p.numero_cnj, erro: error.message }); });
    };
    // 3 consultas em paralelo, dentro do orçamento de tempo.
    let prox = 0;
    const trabalhador = async () => {
      while (!parar && prox < fila.length && Date.now() - inicio < orcamento) await processar(fila[prox++]);
    };
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
    const resumo = { processos_com_numero: comNumero.length, diarias, semanais: comNumero.length - diarias, na_fila: fila.length, requisicoes: req_, encontrados, nao_encontrados: naoEnc, sem_tribunal: semAlias, movimentos: movsNovos, por_tribunal: porTribunal, erros: erros.length, segundos: Math.round((Date.now() - inicio) / 1000) };
    if (exec) await admin.from("controladoria_monitor_execucoes").update({ status: "concluida", requisicoes: req_, processados: encontrados + naoEnc, erros, resumo, concluido_em: new Date().toISOString() }).eq("id", exec.id);
    saida.push({ orgId, simular, resumo, amostra, erros: erros.slice(0, 5) });
  }
  return json({ resultado: saida });
});
