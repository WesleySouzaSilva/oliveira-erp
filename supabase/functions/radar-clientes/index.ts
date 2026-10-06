// Radar de clientes: procura no DJEN, pelo nome, processos contra clientes que
// ainda não conhecemos. Nota de confiança por sinais. Avisos ainda desligados
// (aguardam calibração do titular).
import { adminClient, autenticar, corsHeaders, espera, hojeBR, json, normaliza, somaDias } from "../_shared/controladoria.ts";

const DJEN = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const TERMOS_BANCO = ["BANCO", "COOPERATIVA", "SICREDI", "SICOOB", "CRESOL", "CAIXA ECONOMICA", "BRADESCO", "ITAU", "SANTANDER", "UNICRED", "BANRISUL", "BB ", "BANCO DO BRASIL", "CREDI", "FINANCEIRA", "FIDC", "SECURITIZADORA", "ADMINISTRADORA DE CONSORCIO", "CONSORCIO"];
const CLASSES = /EXECUCAO DE TITULO EXTRAJUDICIAL|BUSCA E APREENSAO|MONITORIA|COBRANCA|CUMPRIMENTO DE SENTENCA|RECUPERACAO JUDICIAL|FALENCIA/;
const CLASSE_DESTAQUE = /EXECUCAO DE TITULO EXTRAJUDICIAL|BUSCA E APREENSAO/;
const TRF_UF: Record<string, string[]> = {
  TRF1: ["AC", "AM", "AP", "BA", "DF", "GO", "MA", "MT", "PA", "PI", "RO", "RR", "TO"], TRF2: ["RJ", "ES"],
  TRF3: ["SP", "MS"], TRF4: ["PR", "SC", "RS"], TRF5: ["AL", "CE", "PB", "PE", "RN", "SE"], TRF6: ["MG"],
};
const soDig = (s: any) => String(s ?? "").replace(/\D/g, "");

function ufsDoTribunal(sigla: string): string[] {
  const s = (sigla || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (TRF_UF[s]) return TRF_UF[s];
  if (s === "TJDFT") return ["DF"];
  const m = s.match(/^(TJ|TRE|TJM)([A-Z]{2})$/);
  return m ? [m[2]] : [];
}

async function paginaDjen(p: URLSearchParams) {
  for (let t = 1; t <= 6; t++) {
    const res = await fetch(`${DJEN}?${p}`, { headers: { Accept: "application/json" } });
    if (res.status === 429) { await espera(3000 * 2 ** (t - 1)); continue; }
    if (!res.ok) throw new Error(`DJEN ${res.status}`);
    return res.json();
  }
  throw new Error("DJEN limitou as consultas");
}

type Cli = { id: string; nome: string; cpf_cnpj: string | null; uf: string | null; municipio: string | null };
const LIGACOES = new Set(["DE", "DA", "DO", "DOS", "DAS", "E"]);
const palavrasNome = (n: string) => normaliza(n).split(" ").filter((p) => p && !LIGACOES.has(p)).length;

function pontuar(cli: Cli, it: any, ufsDoNome: number, nomesClientes: Map<string, string>) {
  const alvo = normaliza(cli.nome);
  const dest: any[] = it.destinatarios || [];
  const d = dest.find((x) => normaliza(x?.nome) === alvo);
  if (!d) return null; // nome completo idêntico é obrigatório
  const sinais: { sinal: string; pontos: number }[] = [];
  const texto = String(it.texto || "");
  const doc = soDig(cli.cpf_cnpj);
  let confirmadoCpf = false;
  if (doc.length >= 11 && soDig(texto).includes(doc)) { confirmadoCpf = true; sinais.push({ sinal: "CPF/CNPJ do cliente no texto", pontos: 100 }); }
  if (palavrasNome(cli.nome) >= 3) sinais.push({ sinal: "nome com 3 ou mais palavras", pontos: 20 });
  if (ufsDoNome >= 3) sinais.push({ sinal: `mesmo nome em ${ufsDoNome} UFs diferentes (risco de homônimo)`, pontos: -20 });
  const outros = [...new Set(dest.map((x) => normaliza(x?.nome)).filter((n) => n && n !== alvo && nomesClientes.has(n)))];
  if (outros.length) sinais.push({ sinal: `outro cliente nosso no processo (${outros.map((n) => nomesClientes.get(n)).join(", ")})`, pontos: 40 });
  const polo = String(d.polo || "").toUpperCase();
  const passivo = polo === "P";
  const autor = polo === "A";
  if (passivo) sinais.push({ sinal: "cliente no polo passivo", pontos: 20 });
  if (autor) sinais.push({ sinal: "cliente autor (informativo)", pontos: 0 });
  const ativos = dest.filter((x) => String(x?.polo || "").toUpperCase() === "A").map((x) => ` ${normaliza(x?.nome)} `);
  const banco = ativos.some((n) => TERMOS_BANCO.some((t) => n.includes(` ${t.trim()} `) || n.includes(` ${t.trim()}`)));
  if (banco) sinais.push({ sinal: "banco/cooperativa/consórcio no polo ativo", pontos: 20 });
  const classe = normaliza(it.nomeClasse);
  if (CLASSES.test(classe)) sinais.push({ sinal: `classe de interesse (${it.nomeClasse})`, pontos: 15 });
  const ufs = ufsDoTribunal(it.siglaTribunal);
  const ufCli = (cli.uf || "").toUpperCase();
  if (ufCli && ufs.length) {
    if (ufs.includes(ufCli)) sinais.push({ sinal: `tribunal compatível com a UF do cliente (${ufCli})`, pontos: 15 });
    else sinais.push({ sinal: `tribunal fora da UF do cliente (${ufCli})`, pontos: -15 });
  }
  const nota = Math.max(0, Math.min(100, sinais.reduce((s, x) => s + x.pontos, 0)));
  const faixa = confirmadoCpf || nota >= 70 ? "confirmado" : nota >= 40 ? "provavel" : "improvavel";
  const destaque = !autor && passivo && banco && CLASSE_DESTAQUE.test(classe);
  return {
    nota, faixa, destaque, autor, sinais,
    polos: dest.map((x) => ({ nome: x?.nome, polo: x?.polo })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const a = await autenticar(req, admin);
  if (!a.ok) return json({ error: "Não autorizado" }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const acao = body.acao || "simular";

  if (acao === "decidir") {
    if (!a.userId) return json({ error: "Não autorizado" }, 401);
    const decisao = body.decisao;
    if (!["e_cliente", "homonimo"].includes(decisao) || typeof body.resultado_id !== "string") return json({ error: "Dados inválidos" }, 400);
    const { data: r } = await admin.from("controladoria_radar_resultados").select("*").eq("id", body.resultado_id).maybeSingle();
    if (!r || !a.orgIds.includes(r.organizacao_id)) return json({ error: "Não encontrado" }, 404);
    await admin.from("controladoria_radar_decisoes").upsert({ organizacao_id: r.organizacao_id, cliente_id: r.cliente_id, numero_processo: r.numero_processo, decisao, decidido_por: a.userId, decidido_em: new Date().toISOString() }, { onConflict: "organizacao_id,cliente_id,numero_processo" });
    await admin.from("controladoria_radar_resultados").update({ status: decisao, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (decisao === "e_cliente" && /^\d{20}$/.test(r.numero_processo)) {
      // Passa a acompanhar os andamentos pelo DataJud.
      await admin.from("controladoria_datajud_processos").upsert({ organizacao_id: r.organizacao_id, numero_cnj: r.numero_processo, cliente_id: r.cliente_id, origem: "radar", frequencia: "diaria" }, { onConflict: "organizacao_id,numero_cnj", ignoreDuplicates: true });
    }
    await admin.from("audit_log").insert({ user_id: a.userId, acao: `radar_${decisao}`, tabela: "controladoria_radar_resultados", registro_id: r.id, organizacao_id: r.organizacao_id } as any);
    return json({ ok: true });
  }

  if (a.origem === "manual") {
    const { data: m } = await admin.from("membros").select("papel").eq("user_id", a.userId!).in("organizacao_id", a.orgIds);
    if (!(m || []).some((x: any) => x.papel === "admin")) return json({ error: "Só administradores" }, 403);
  }
  if (acao !== "simular") return json({ error: "Rodada real desligada até a calibração" }, 400);

  const qtd = Math.min(Number(body.clientes) || 10, 30);
  const inicio = Date.now();
  const hoje = hojeBR();
  const saida: any[] = [];
  for (const orgId of a.orgIds) {
    const { data: todos } = await admin.from("clientes").select("id, nome, cpf_cnpj, uf, municipio, base_historica_advbox, deleted_at").eq("organizacao_id", orgId).limit(5000);
    const contaNome = new Map<string, number>();
    for (const c of todos || []) if (!c.deleted_at) contaNome.set(normaliza(c.nome), (contaNome.get(normaliza(c.nome)) || 0) + 1);
    const ativos = ((todos || []) as any[]).filter((c) => !c.deleted_at && !c.base_historica_advbox && normaliza(c.nome).split(" ").length >= 2);
    const ids = Array.isArray(body.cliente_ids) ? ativos.filter((c) => body.cliente_ids.includes(c.id)) : ativos.slice(0, qtd);
    // Processos já conhecidos
    const conhecidosOab = new Set<string>();
    for (let de = 0; ; de += 1000) {
      const { data } = await admin.from("djen_comunicacoes").select("numero_processo").eq("organizacao_id", orgId).range(de, de + 999);
      for (const r of data || []) if (r.numero_processo) conhecidosOab.add(r.numero_processo);
      if (!data || data.length < 1000) break;
    }
    let requisicoes = 0;
    const resultados: any[] = [];
    const descartes = { ja_ligado: 0, captura_oab: 0, decidido: 0, nome_diferente: 0 };
    for (const cli of ids) {
      const { data: rel } = await admin.from("processo_judicial_clientes").select("processos_judiciais(numero_cnj)").eq("cliente_id", cli.id);
      const ligados = new Set((rel || []).map((r: any) => r.processos_judiciais?.numero_cnj).filter(Boolean));
      const { data: dec } = await admin.from("controladoria_radar_decisoes").select("numero_processo").eq("cliente_id", cli.id);
      const decididos = new Set((dec || []).map((d: any) => d.numero_processo));
      const itens: any[] = [];
      for (let pagina = 1; pagina <= 5; pagina++) {
        const b = await paginaDjen(new URLSearchParams({ nomeParte: cli.nome, dataDisponibilizacaoInicio: somaDias(hoje, -90), dataDisponibilizacaoFim: hoje, itensPorPagina: "100", pagina: String(pagina) }));
        requisicoes++;
        const its: any[] = b?.items ?? [];
        itens.push(...its);
        await espera(1500);
        if (its.length < 100) break;
      }
      const alvo = normaliza(cli.nome);
      const porProc = new Map<string, any[]>();
      for (const it of itens) {
        const num = soDig(it.numero_processo);
        if (!num) continue;
        if (!(it.destinatarios || []).some((x: any) => normaliza(x?.nome) === alvo)) { descartes.nome_diferente++; continue; }
        if (!porProc.has(num)) porProc.set(num, []);
        porProc.get(num)!.push(it);
      }
      const ufsNome = new Set<string>();
      for (const its of porProc.values()) for (const it of its) {
        const u = ufsDoTribunal(it.siglaTribunal);
        if (u.length === 1) ufsNome.add(u[0]);
      }
      const nomesOutros = new Map<string, string>();
      for (const c of (todos || []) as any[]) if (!c.deleted_at && c.id !== cli.id) nomesOutros.set(normaliza(c.nome), c.nome);
      nomesOutros.delete(alvo);
      for (const [num, its] of porProc) {
        if (ligados.has(num)) { descartes.ja_ligado++; continue; }
        if (conhecidosOab.has(num)) { descartes.captura_oab++; continue; }
        if (decididos.has(num)) { descartes.decidido++; continue; }
        let melhor: any = null, itM: any = null;
        for (const it of its) {
          const p = pontuar(cli, it, ufsNome.size, nomesOutros);
          if (p && (!melhor || p.nota > melhor.nota)) { melhor = p; itM = it; }
        }
        if (!melhor) continue;
        resultados.push({
          cliente_id: cli.id, numero: num, djen_id: itM.id ?? null, orgao: itM.nomeOrgao ?? null, link: itM.link ?? null,
          trecho: String(itM.texto || "").slice(0, 600),
          cliente: cli.nome, cliente_uf: cli.uf, processo: itM.numeroprocessocommascara || num, tribunal: itM.siglaTribunal,
          classe: itM.nomeClasse, polos: melhor.polos, nota: melhor.nota, faixa: melhor.faixa, destaque: melhor.destaque,
          autor: melhor.autor, sinais: melhor.sinais, data: itM.data_disponibilizacao, comunicacoes: its.length,
        });
      }
    }
    resultados.sort((x, y) => y.nota - x.nota);
    // Guarda como simulação (sem aviso). Não sobrescreve decisões já tomadas.
    if (resultados.length) {
      const agora = new Date().toISOString();
      const linhas = resultados.map((r) => ({
        organizacao_id: orgId, cliente_id: r.cliente_id, numero_processo: r.numero, numero_processo_mascara: r.processo,
        djen_id: typeof r.djen_id === "number" ? r.djen_id : null, data_disponibilizacao: r.data ? String(r.data).slice(0, 10) : null,
        tribunal: r.tribunal, classe: r.classe, orgao: r.orgao, polos: r.polos, trecho: r.trecho, link: r.link,
        nota: r.nota, faixa: r.faixa, sinais: r.sinais, destaque: r.destaque, cliente_autor: !!r.autor,
        status: "novo", simulacao: true, updated_at: agora,
      }));
      const { error } = await admin.from("controladoria_radar_resultados").upsert(linhas, { onConflict: "organizacao_id,cliente_id,numero_processo" });
      if (error) console.error("radar salvar", error.message);
    }
    const porFaixa = resultados.reduce((m: any, r) => ({ ...m, [r.faixa]: (m[r.faixa] || 0) + 1 }), {});
    saida.push({ orgId, clientes: ids.map((c) => c.nome), requisicoes, segundos: Math.round((Date.now() - inicio) / 1000), por_faixa: porFaixa, descartes, resultados: resultados.map(({ trecho, ...r }) => r) });
  }
  return json({ resultado: saida });
});
