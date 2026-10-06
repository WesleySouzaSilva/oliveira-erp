// Relatório diário D-5: tarefas abertas (ADVBOX + app) vencendo do D-0 ao D-5 e vencidas.
import {
  adminClient, advbox, adminsControladoria, autenticar, calendarioControladoria, corsHeaders,
  espera, hojeBR, json, somaDias, usuariosDaOrg, mapaUsuariosAdvbox,
} from "../_shared/controladoria.ts";

const IGNORAR = new Set(["ALERTA DE TAREFA EXCLUÍDA", "ALERTA DE TAREFA EXCLUIDA", "COMENTÁRIO", "COMENTARIO"]);
const brData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function postsAdvbox(token: string, ini: string, fim: string) {
  const out: any[] = [];
  let totalCount: number | null = null;
  for (let offset = 0; offset < 20000; offset += 100) {
    const r = await advbox(`/posts?limit=100&offset=${offset}&deadline_start=${ini}&deadline_end=${fim}`, token);
    if (r.status !== 200) throw new Error(`ADVBOX posts respondeu ${r.status}`);
    const lote: any[] = Array.isArray(r.body) ? r.body : (r.body?.data ?? []);
    totalCount = r.body?.totalCount ?? totalCount;
    out.push(...lote);
    if (lote.length < 100) break;
    await espera(400);
  }
  return { itens: out, totalCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticar(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);
  const token = Deno.env.get("ADVBOX_TOKEN") ?? Deno.env.get("ADVBOX_API_TOKEN");
  const resultado: any[] = [];
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }

  for (const orgId of auth.orgIds) {
    const cal = await calendarioControladoria(admin, orgId);
    const hoje = hojeBR();
    if (auth.origem === "cron" && body?.forcar !== true && !cal.ehDiaUtil(hoje)) {
      resultado.push({ organizacao_id: orgId, pulado: "não é dia útil" });
      continue;
    }
    const { data: exec } = await admin.from("controladoria_execucoes")
      .insert({ organizacao_id: orgId, funcao: "controladoria-d5", origem: auth.origem }).select("id").single();
    const det: any = {};
    let erro: string | null = null;
    try {
      const d0 = cal.proximoDiaUtil(hoje);
      const fim = cal.somaUteis(d0, 5);
      const ontem = somaDias(d0, -1);
      const iniVenc = somaDias(hoje, -180);
      const dN = (prazo: string) => {
        if (prazo < d0) return null;
        let n = 0, d = d0;
        while (d < prazo) { d = somaDias(d, 1); if (cal.ehDiaUtil(d)) n++; }
        return cal.ehDiaUtil(prazo) ? n : n + 1;
      };

      const usuarios = await usuariosDaOrg(admin, orgId);
      const admins = await adminsControladoria(admin, orgId);
      const porEmail = new Map(usuarios.map((u) => [u.email, u]));
      const itens: any[] = [];
      const mapaAdv = await mapaUsuariosAdvbox(admin, orgId, token, usuarios);
      const porId = new Map(usuarios.map((u) => [u.id, u]));
      const { data: vinc } = await admin.from("controladoria_advbox_usuarios").select("advbox_user_id, advbox_nome, advbox_email").eq("organizacao_id", orgId);
      const advIdPorNome = new Map(((vinc as any[]) || []).filter((v) => v.advbox_nome).map((v) => [String(v.advbox_nome).trim().toUpperCase(), String(v.advbox_user_id)]));
      const advIdPorEmail = new Map(((vinc as any[]) || []).filter((v) => v.advbox_email).map((v) => [String(v.advbox_email).toLowerCase(), String(v.advbox_user_id)]));

      if (token) {
        const janela = await postsAdvbox(token, d0, fim);
        const venc = await postsAdvbox(token, iniVenc, ontem);
        det.advbox = { janela_api: janela.itens.length, janela_totalCount: janela.totalCount, vencidas_api: venc.itens.length };
        if (janela.itens[0]) det.advbox.amostra = Object.keys(janela.itens[0]);
        let ignorados = 0, tarefasAbertas = 0;
        const porDia: Record<string, number> = {};
        for (const [lista, ehVenc] of [[janela.itens, false], [venc.itens, true]] as const) {
          for (const p of lista) {
            const nomeTask = String(p.task ?? p.tasks?.name ?? "").trim().toUpperCase();
            if (IGNORAR.has(nomeTask)) { ignorados++; continue; }
            const prazo = String(p.date_deadline ?? p.deadline ?? p.date ?? "").slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) continue;
            const pend = ((p.users as any[]) || []).filter((u) => u?.completed == null);
            if (!pend.length) continue;
            if (!ehVenc) { tarefasAbertas++; porDia[prazo] = (porDia[prazo] || 0) + 1; }
            for (const u of pend) {
              const email = String(u.email ?? "").toLowerCase();
              const advId = u.user_id ?? u.id ?? advIdPorEmail.get(email) ?? advIdPorNome.get(String(u.name ?? "").trim().toUpperCase());
              const uidTab = advId != null ? mapaAdv.get(String(advId)) : undefined;
              const app = (uidTab ? porId.get(uidTab) ?? { id: uidTab } : undefined) ?? (email ? porEmail.get(email) : undefined);
              const base = {
                organizacao_id: orgId, origem: "ADVBOX", id_externo: String(p.id),
                titulo: p.task ?? p.tasks?.name ?? "Tarefa",
                processo: p.lawsuit?.process_number ?? p.process_number ?? p.lawsuits?.process_number ?? null,
                cliente: p.customers?.[0]?.name ?? p.lawsuit?.customers?.[0]?.name ?? p.customer ?? null,
                prazo, d_n: ehVenc ? null : dN(prazo), vencida: ehVenc,
                responsavel_nome: u.name ?? null, responsavel_email: email || null,
              };
              if (app) itens.push({ ...base, user_id: app.id });
              else for (const a of admins.length ? admins : [null]) itens.push({ ...base, user_id: a });
            }
          }
        }
        det.advbox.ignorados = ignorados;
        det.advbox.tarefas_abertas_janela = tarefasAbertas;
        det.advbox.por_dia = porDia;
      } else det.advbox = { sem_token: true };

      const { data: tApp } = await admin.from("tarefas")
        .select("id, titulo, data_vencimento, responsavel_id, created_by, nome_cliente")
        .eq("organizacao_id", orgId).eq("concluida", false)
        .gte("data_vencimento", iniVenc).lte("data_vencimento", fim);
      let app = 0;
      for (const t of (tApp as any[]) || []) {
        const prazo = String(t.data_vencimento).slice(0, 10);
        const uid = t.responsavel_id ?? t.created_by ?? null;
        const u = usuarios.find((x) => x.id === uid);
        app++;
        itens.push({
          organizacao_id: orgId, origem: "App", id_externo: t.id, titulo: t.titulo, processo: null,
          cliente: t.nome_cliente ?? null, prazo, d_n: dN(prazo), vencida: prazo < d0,
          responsavel_nome: u?.nome || u?.email || null, responsavel_email: u?.email ?? null, user_id: uid,
        });
      }
      det.app = app;

      // HTML
      const nomes = new Map(usuarios.map((u) => [u.id, u.nome || u.email]));
      const grupos = new Map<string, any[]>();
      for (const i of itens) {
        const k = i.user_id ? (nomes.get(i.user_id) || i.responsavel_nome || "Sem responsável") : (i.responsavel_nome || "Sem responsável");
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(i);
      }
      let html = `<h2>Prazos D-5: ${brData(d0)} a ${brData(fim)}</h2>`;
      for (const [nome, lst] of [...grupos].sort((a, b) => a[0].localeCompare(b[0]))) {
        lst.sort((a, b) => (a.vencida === b.vencida ? a.prazo.localeCompare(b.prazo) : a.vencida ? -1 : 1));
        const v = lst.filter((x) => x.vencida).length;
        html += `<h3>${esc(nome)}: ${lst.length - v} na janela, ${v} vencidas</h3><table border="1" cellpadding="4" cellspacing="0"><tr><th>Prazo</th><th>D</th><th>Tarefa</th><th>Processo</th><th>Cliente</th><th>Origem</th></tr>`;
        for (const x of lst) {
          html += `<tr${x.vencida ? ' style="color:#b91c1c"' : ""}><td>${brData(x.prazo)}</td><td>${x.vencida ? "VENCIDA" : `D-${x.d_n}`}</td><td>${esc(x.titulo)}</td><td>${esc(x.processo)}</td><td>${esc(x.cliente)}</td><td>${x.origem}</td></tr>`;
        }
        html += `</table>`;
      }

      // Retrato (substitui o do dia)
      await admin.from("controladoria_d5_snapshots").delete().eq("organizacao_id", orgId).eq("data_ref", hoje);
      const totalVenc = itens.filter((i) => i.vencida).length;
      const { data: snap, error: e1 } = await admin.from("controladoria_d5_snapshots").insert({
        organizacao_id: orgId, data_ref: hoje, d0, janela_fim: fim,
        total_janela: itens.length - totalVenc, total_vencidas: totalVenc, totais: det, html,
      }).select("id").single();
      if (e1) throw new Error(e1.message);
      for (let i = 0; i < itens.length; i += 500) {
        const { error } = await admin.from("controladoria_d5_itens").insert(itens.slice(i, i + 500).map((x) => ({ ...x, snapshot_id: snap!.id })));
        if (error) throw new Error(error.message);
      }

      // Notificação por pessoa
      const cont = new Map<string, { j: number; v: number }>();
      for (const i of itens) {
        if (!i.user_id) continue;
        const c = cont.get(i.user_id) || { j: 0, v: 0 };
        if (i.vencida) c.v++; else c.j++;
        cont.set(i.user_id, c);
      }
      const notifs = [...cont].map(([user_id, c]) => ({
        user_id, tipo: c.v ? "warning" : "info",
        mensagem: `Você tem ${c.j} tarefa${c.j === 1 ? "" : "s"} vencendo até ${brData(fim)} e ${c.v} vencida${c.v === 1 ? "" : "s"}`,
      }));
      if (notifs.length) await admin.from("notificacoes_sistema").insert(notifs);
      Object.assign(det, { d0, janela_fim: fim, itens: itens.length, vencidas: totalVenc, notificacoes: notifs.length });
    } catch (e) {
      erro = (e as Error).message;
    }
    await admin.from("controladoria_execucoes").update({ fim: new Date().toISOString(), total: det.itens ?? 0, detalhes: det, erro }).eq("id", exec!.id);
    resultado.push({ organizacao_id: orgId, ...det, erro });
  }
  return json({ ok: true, resultado });
});
