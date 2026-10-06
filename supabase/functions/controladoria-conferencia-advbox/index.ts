// Conferência automática ADVBOX × app (djen_comunicacoes), rotativa, por lote.
// Prioridade: (a) intimação no app em 7 dias; (b) andamento DataJud em 30 dias; (c) rodízio pelo mais antigo.
import {
  adminClient, advbox, adminsControladoria, autenticar, corsHeaders, espera, hojeBR, json, somaDias,
} from "../_shared/controladoria.ts";

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const dia = (v: unknown) => (v ? String(v).slice(0, 10) : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticar(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const limite = Math.min(Math.max(Number(body?.limite) || 25, 1), 60);
  const somente = ["a", "b", "c"].includes(body?.somente) ? body.somente as string : null;
  const token = Deno.env.get("ADVBOX_TOKEN") ?? Deno.env.get("ADVBOX_API_TOKEN");
  if (!token) return json({ error: "ADVBOX_TOKEN ausente" }, 500);

  const t0 = Date.now();
  const hoje = hojeBR();
  const d7 = somaDias(hoje, -7);
  const resultado: any[] = [];

  for (const orgId of auth.orgIds) {
    const { data: exec } = await admin.from("controladoria_execucoes")
      .insert({ organizacao_id: orgId, funcao: "conferencia-advbox", origem: auth.origem }).select("id").single();
    const det: any = { processos: [], pares: 0, so_advbox: 0, so_app: 0, novas_so_advbox: 0, erros: 0 };
    let erro: string | null = null;
    try {
      const { data: pjs } = await admin.from("processos_judiciais")
        .select("id, numero_cnj, numero_cnj_formatado, advbox_lawsuit_id")
        .eq("organizacao_id", orgId).not("advbox_lawsuit_id", "is", null).limit(5000);
      const porCnj = new Map<string, any>();
      for (const p of (pjs as any[]) || []) { const k = soDigitos(p.numero_cnj); if (k) porCnj.set(k, p); }

      const { data: confs } = await admin.from("controladoria_conferencia_processos")
        .select("processo_judicial_id, conferido_em").eq("organizacao_id", orgId).limit(5000);
      const conferido = new Map<string, number>(((confs as any[]) || []).map((c) => [c.processo_judicial_id, new Date(c.conferido_em).getTime()]));
      const recente = (id: string) => (conferido.get(id) ?? 0) > Date.now() - 20 * 3600e3;

      const { data: intim } = await admin.from("djen_comunicacoes").select("numero_processo")
        .eq("organizacao_id", orgId).gte("data_disponibilizacao", d7).limit(5000);
      const a = [...new Set(((intim as any[]) || []).map((r) => r.numero_processo).filter((n) => porCnj.has(n)))];
      const { data: movs } = await admin.from("controladoria_datajud_movimentos").select("numero_cnj")
        .eq("organizacao_id", orgId).gte("data_hora", new Date(Date.now() - 30 * 86400e3).toISOString()).limit(20000);
      const b = [...new Set(((movs as any[]) || []).map((r) => soDigitos(r.numero_cnj)).filter((n) => porCnj.has(n) && !a.includes(n)))];
      const aSet = new Set(a), bSet = new Set(b);
      const c = [...porCnj.keys()].filter((n) => !aSet.has(n) && !bSet.has(n))
        .sort((x, y) => (conferido.get(porCnj.get(x).id) ?? 0) - (conferido.get(porCnj.get(y).id) ?? 0));

      const fila: { cnj: string; prio: string }[] = [];
      const add = (lista: string[], prio: string, filtraRecente: boolean) => {
        for (const n of lista) if (!filtraRecente || !recente(porCnj.get(n).id)) fila.push({ cnj: n, prio });
      };
      if (!somente || somente === "a") add(a, "a", !somente);
      if (!somente || somente === "b") add(b, "b", !somente);
      if (!somente || somente === "c") add(c, "c", false);
      const lote = fila.slice(0, limite);
      det.fila = { a: a.length, b: b.length, c: c.length };

      const novosRisco: string[] = [];
      for (const { cnj, prio } of lote) {
        if (Date.now() - t0 > 120_000) { det.interrompido_por_tempo = true; break; }
        const pj = porCnj.get(cnj);
        const r = await advbox(`/publications/${encodeURIComponent(pj.advbox_lawsuit_id)}`, token);
        if (r.status !== 200) {
          det.erros++;
          await admin.from("controladoria_conferencia_processos").upsert({ organizacao_id: orgId, processo_judicial_id: pj.id, conferido_em: new Date().toISOString(), prioridade: prio, erro: `ADVBOX ${r.status}` });
          await espera(300);
          continue;
        }
        const pubsTodas: any[] = Array.isArray(r.body) ? r.body : (r.body?.data ?? r.body?.publications ?? []);
        if (!det.amostra_chaves && pubsTodas[0]) det.amostra_chaves = Object.keys(pubsTodas[0]).slice(0, 30);
        const pubs = pubsTodas.map((p) => ({ p, start: dia(p?.start ?? p?.date) })).filter((x) => x.start && x.start >= somaDias(d7, -5));
        const { data: appRows } = await admin.from("djen_comunicacoes").select("djen_id, data_disponibilizacao, texto")
          .eq("organizacao_id", orgId).eq("numero_processo", cnj).gte("data_disponibilizacao", somaDias(d7, -5));
        // Pareamento por (processo, dia): o DJEN repete o mesmo ato no mesmo dia e o
        // ADVBOX junta as repetidas. Sem comparação de texto (DJEN vem em HTML).
        const app = (appRows as any[]) || [];
        const diasApp = [...new Set(app.map((y) => y.data_disponibilizacao as string))];
        const diasAdv = new Map<string, any>();
        for (const x of pubs) if (!diasAdv.has(x.start!)) diasAdv.set(x.start!, x);
        const soAdv = [...diasAdv.values()].filter((x) => x.start! >= d7 && !diasApp.some((d) => d >= somaDias(x.start!, -5) && d <= x.start!));
        const soAppDias = new Set(diasApp.filter((d) => d >= d7 && ![...diasAdv.keys()].some((s) => s >= d && s <= somaDias(d, 5))));
        const pares = diasApp.filter((d) => d >= d7 && !soAppDias.has(d)).length;
        const soApp = app.filter((y) => soAppDias.has(y.data_disponibilizacao)).filter((y, k, arr) => arr.findIndex((z) => z.data_disponibilizacao === y.data_disponibilizacao) === k);
        // Diferenças antigas deste processo que o pareamento por dia resolveu.
        const { data: abertas } = await admin.from("controladoria_conferencia_advbox").select("id, lado, data")
          .eq("organizacao_id", orgId).eq("processo_judicial_id", pj.id).is("resolvido_em", null);
        const resolver = ((abertas as any[]) || []).filter((d) => d.lado === "so_app"
          ? [...diasAdv.keys()].some((s) => s >= d.data && s <= somaDias(d.data, 5))
          : diasApp.some((x) => x >= somaDias(d.data, -5) && x <= d.data)).map((d) => d.id);
        if (resolver.length) await admin.from("controladoria_conferencia_advbox").update({ resolvido_em: new Date().toISOString() }).in("id", resolver);
        const linhas = [
          ...soAdv.map((x) => {
            const txt = String(x.p?.publication ?? x.p?.description ?? x.p?.text ?? x.p?.content ?? x.p?.title ?? x.p?.header ?? "");
            return {
              organizacao_id: orgId, processo_judicial_id: pj.id, numero_cnj: cnj, data: x.start, lado: "so_advbox",
              chave: `adv:${x.p?.id ?? `${x.start}:${txt.slice(0, 80)}`}`, trecho: txt.slice(0, 500) || null,
            };
          }),
          ...soApp.map((y) => ({
            organizacao_id: orgId, processo_judicial_id: pj.id, numero_cnj: cnj, data: y.data_disponibilizacao, lado: "so_app",
            chave: `djen:${y.djen_id}`, trecho: String(y.texto ?? "").slice(0, 500) || null,
          })),
        ];
        if (linhas.length) {
          const { data: ins } = await admin.from("controladoria_conferencia_advbox")
            .upsert(linhas, { onConflict: "organizacao_id,lado,chave", ignoreDuplicates: true }).select("lado");
          for (const i of (ins as any[]) || []) if (i.lado === "so_advbox") novosRisco.push(pj.numero_cnj_formatado || cnj);
        }
        await admin.from("controladoria_conferencia_processos").upsert({
          organizacao_id: orgId, processo_judicial_id: pj.id, conferido_em: new Date().toISOString(), prioridade: prio,
          pares, so_advbox: soAdv.length, so_app: soApp.length, erro: null,
        });
        det.pares += pares; det.so_advbox += soAdv.length; det.so_app += soApp.length;
        det.processos.push({ cnj: pj.numero_cnj_formatado || cnj, prio, advbox_7d: pubs.filter((x) => x.start! >= d7).length, pares, so_advbox: soAdv.length, so_app: soApp.length });
        await espera(300);
      }
      det.novas_so_advbox = novosRisco.length;
      if (novosRisco.length) {
        const admins = await adminsControladoria(admin, orgId);
        const lista = [...new Set(novosRisco)].slice(0, 5).join(", ");
        if (admins.length) await admin.from("notificacoes_sistema").insert(admins.map((user_id) => ({
          user_id, tipo: "warning",
          mensagem: `Conferência ADVBOX: ${novosRisco.length} publicação(ões) só no ADVBOX (risco de prazo): ${lista}`,
        })));
      }
    } catch (e) {
      erro = (e as Error).message;
    }
    await admin.from("controladoria_execucoes").update({ fim: new Date().toISOString(), total: det.processos.length, novas: det.novas_so_advbox, detalhes: det, erro }).eq("id", exec!.id);
    resultado.push({ organizacao_id: orgId, ...det, erro });
  }
  return json({ ok: true, resultado });
});
