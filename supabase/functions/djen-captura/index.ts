// Captura de intimações do DJEN (comunicaapi.pje.jus.br) por OAB monitorada.
import {
  adminClient, advbox, adminsControladoria, autenticar, calendarioControladoria, corsHeaders,
  espera, hojeBR, json, normaliza, somaDias, usuariosDaOrg, mapaUsuariosAdvbox,
} from "../_shared/controladoria.ts";

const DJEN = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const UA_NAV = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function djenPagina(params: URLSearchParams) {
  for (let t = 1; t <= 6; t++) {
    const res = await fetch(`${DJEN}?${params}`, { headers: { Accept: "application/json", "User-Agent": UA_NAV } });
    if (res.status === 429) {
      const ra = Number(res.headers.get("Retry-After"));
      await espera(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60000) : 3000 * 2 ** (t - 1));
      continue;
    }
    const txt = await res.text();
    if (res.status === 403) throw new Error("DJEN_BLOQUEIO: o DJEN recusou a consulta feita pelo servidor (só aceita acessos do Brasil). Use \"Buscar agora\" na tela.");
    if (!res.ok) throw new Error(`DJEN respondeu ${res.status}: ${txt.slice(0, 200)}`);
    const body = JSON.parse(txt);
    const restante = Number(res.headers.get("X-RateLimit-Remaining"));
    return { body, restante: Number.isFinite(restante) ? restante : null };
  }
  throw new Error("DJEN limitou as consultas (429) repetidamente");
}

const dia = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Pagina a consulta ao DJEN até esgotar (máx. 100 páginas de 100). */
async function buscarTodas(filtro: Record<string, string>, ini: string, fim: string) {
  const itens: any[] = [];
  let count = 0;
  for (let pagina = 1; pagina <= 100; pagina++) {
    const p = new URLSearchParams({
      ...filtro,
      dataDisponibilizacaoInicio: ini, dataDisponibilizacaoFim: fim,
      itensPorPagina: "100", pagina: String(pagina),
    });
    const { body: b, restante } = await djenPagina(p);
    count = Number(b?.count ?? 0);
    const lote: any[] = b?.items ?? [];
    itens.push(...lote);
    if (lote.length < 100 || itens.length >= count) break;
    await espera(restante !== null && restante <= 2 ? 15000 : 1500);
  }
  return { itens, count };
}

const fmtBR = (iso: string) => {
  const d = new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`;
};

/** Aviso aos admins da Controladoria, no máximo 1 a cada 6 horas por tipo. */
async function avisarAdmins(admin: ReturnType<typeof adminClient>, orgId: string, tipo: string, mensagem: string) {
  const desde = new Date(Date.now() - 6 * 3600e3).toISOString();
  const { data: rec } = await admin.from("controladoria_execucoes").select("id")
    .eq("organizacao_id", orgId).eq("funcao", "djen-sentinela").eq("origem", tipo).gte("inicio", desde).limit(1);
  if ((rec || []).length) return false;
  const admins = await adminsControladoria(admin, orgId);
  if (admins.length) await admin.from("notificacoes_sistema").insert(admins.map((user_id) => ({ user_id, tipo: "error", mensagem })));
  await admin.from("controladoria_execucoes").insert({ organizacao_id: orgId, funcao: "djen-sentinela", origem: tipo, fim: new Date().toISOString(), erro: mensagem.slice(0, 500) });
  return true;
}

/** Preenche cliente_id das intimações sem cliente que já têm processo_judicial_id:
 * nome do destinatário casa com exatamente 1 cliente do processo -> cliente + polo;
 * nenhum nome casa e o processo tem 1 cliente só -> cliente, polo nulo; senão nada. */
async function clientePorProcesso(admin: ReturnType<typeof adminClient>, orgId: string) {
  const out = { analisadas: 0, por_nome: 0, por_cliente_unico: 0, sem_cliente: 0 };
  const { data: rows } = await admin.from("djen_comunicacoes").select("id, destinatarios, processo_judicial_id")
    .eq("organizacao_id", orgId).is("cliente_id", null).not("processo_judicial_id", "is", null).limit(5000);
  const lista = (rows as any[]) || [];
  if (!lista.length) return out;
  const pjIds = [...new Set(lista.map((r) => r.processo_judicial_id))];
  const rel = new Map<string, string[]>();
  for (let i = 0; i < pjIds.length; i += 200) {
    const { data } = await admin.from("processo_judicial_clientes").select("processo_judicial_id, cliente_id").in("processo_judicial_id", pjIds.slice(i, i + 200));
    for (const r of (data as any[]) || []) rel.set(r.processo_judicial_id, [...(rel.get(r.processo_judicial_id) || []), r.cliente_id]);
  }
  const cliIds = [...new Set([...rel.values()].flat())];
  const nomes = new Map<string, Set<string>>();
  for (let i = 0; i < cliIds.length; i += 200) {
    const { data } = await admin.from("clientes").select("id, nome, grafias_alternativas").in("id", cliIds.slice(i, i + 200));
    for (const c of (data as any[]) || []) nomes.set(c.id, new Set([c.nome, ...((c.grafias_alternativas as string[]) || [])].map(normaliza).filter((k) => k.length >= 3)));
  }
  for (const r of lista) {
    out.analisadas++;
    const clis = [...new Set(rel.get(r.processo_judicial_id) || [])];
    const casados = new Map<string, string | null>();
    for (const d of (r.destinatarios as any[]) || []) {
      const k = normaliza(d?.nome);
      if (!k) continue;
      for (const c of clis) if (nomes.get(c)?.has(k) && !casados.has(c)) casados.set(c, d?.polo ?? null);
    }
    let upd: any = null;
    if (casados.size === 1) { const [[c, polo]] = [...casados]; upd = { cliente_id: c, polo_cliente: polo }; out.por_nome++; }
    else if (casados.size === 0 && clis.length === 1) { upd = { cliente_id: clis[0], polo_cliente: null }; out.por_cliente_unico++; }
    else { out.sem_cliente++; continue; }
    await admin.from("djen_comunicacoes").update(upd).eq("id", r.id).is("cliente_id", null);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticar(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const soVincular = body?.acao === "vincular_advbox";
  const parcial = body?.parcial === true;
  const inicioForcado = typeof body?.dataInicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dataInicio) ? body.dataInicio : null;
  const fimForcado = typeof body?.dataFim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dataFim) ? body.dataFim : null;
  const retroNome = body?.acao === "retroativa_nome";
  if (retroNome && !inicioForcado) return json({ error: "Informe dataInicio" }, 400);

  // Sentinela diária (07h): houve captura com sucesso nas últimas 8 horas?
  if (body?.acao === "sentinela") {
    const out: any[] = [];
    for (const orgId of auth.orgIds) {
      const { data: oabs } = await admin.from("controladoria_oabs").select("id").eq("organizacao_id", orgId).eq("ativo", true).limit(1);
      if (!(oabs || []).length) continue;
      const { data: ok } = await admin.from("controladoria_execucoes").select("fim")
        .eq("organizacao_id", orgId).eq("funcao", "djen-captura").is("erro", null).not("fim", "is", null)
        .order("fim", { ascending: false }).limit(1);
      const ultima = (ok as any[])?.[0]?.fim as string | undefined;
      const parada = !ultima || Date.now() - new Date(ultima).getTime() > 8 * 3600e3;
      if (parada) await avisarAdmins(admin, orgId, "parada", `Captura de intimações parada desde ${ultima ? fmtBR(ultima) : "sempre"}`);
      out.push({ organizacao_id: orgId, ultima_ok: ultima ?? null, parada });
    }
    return json({ ok: true, sentinela: out });
  }

  const t0 = Date.now();
  const resultado: any[] = [];

  for (const orgId of auth.orgIds) {
    if (retroNome && !(auth.origem === "manual" && (await adminsControladoria(admin, orgId)).includes(auth.userId!))) {
      resultado.push({ organizacao_id: orgId, erro: "Só o administrador da Controladoria pode rodar a carga retroativa" });
      continue;
    }
    const { data: exec } = await admin.from("controladoria_execucoes")
      .insert({ organizacao_id: orgId, funcao: retroNome ? "djen-captura-retro" : "djen-captura", origem: auth.origem }).select("id").single();
    const det: any = { oabs: [] };
    let novasTotal = 0;
    let erro: string | null = null;
    const novasIds: string[] = [];
    try {
      const cal = await calendarioControladoria(admin, orgId);
      if (soVincular && Array.isArray(body?.novasIds)) novasIds.push(...body.novasIds.slice(0, 5000).map((x: unknown) => String(Number(x))));
      const hoje = hojeBR();

      if (!soVincular) {
        const { data: oabs } = await admin.from("controladoria_oabs").select("*").eq("organizacao_id", orgId).eq("ativo", true);
        const { data: clientes } = await admin.from("clientes").select("id, nome, grafias_alternativas").eq("organizacao_id", orgId).is("deleted_at", null);
        const mapaCli = new Map<string, string>();
        for (const c of (clientes as any[]) || []) {
          for (const n of [c.nome, ...((c.grafias_alternativas as string[]) || [])]) {
            const k = normaliza(n);
            if (k.length >= 5 && !mapaCli.has(k)) mapaCli.set(k, c.id);
          }
        }

        for (const oab of (oabs as any[]) || []) {
          const ini = inicioForcado ?? (oab.carga_inicial_feita ? somaDias(hoje, -5) : somaDias(hoje, -31));
          const fim = fimForcado ?? hoje;
          const itens: any[] = [];
          let count = 0;
          const lote = body?.lotes?.[oab.id];
          const origemItem = new Map<number, "oab" | "nome" | "ambos">();
          const nomeInfo = { count_api: 0, recebidas: 0, aceitas_so_nome: 0, ambos: 0, descartadas_homonimo: 0, descartadas_sem_advogado: 0 };
          if (Array.isArray(body?.lotes ? lote : null)) {
            // Itens buscados pelo navegador (plano B).
            itens.push(...(lote as any[]).slice(0, 5000));
            count = itens.length;
          } else if (body?.lotes) {
            continue;
          } else {
            if (!retroNome) {
              const r = await buscarTodas({ numeroOab: oab.numero, ufOab: oab.uf }, ini, fim);
              itens.push(...r.itens); count = r.count;
            }
            for (const it of itens) origemItem.set(Number(it.id), "oab");
            // Rede de segurança: mesma janela pelo nome do advogado.
            if (oab.nome_busca) {
              // Busca pelo nome em try/catch próprio: se falhar, a da OAB segue gravando.
              let r: { itens: any[]; count: number } = { itens: [], count: 0 };
              try {
                r = await buscarTodas({ nomeAdvogado: oab.nome_busca }, ini, fim);
              } catch (eNome) {
                const msg = (eNome as Error).message;
                det.nome_erro = [...(det.nome_erro || []), `${oab.numero}/${oab.uf}: ${msg.slice(0, 300)}`];
                try { await avisarAdmins(admin, orgId, "erro", `Busca pelo nome falhou: ${msg.slice(0, 300)}`); } catch { /* segue */ }
              }
              nomeInfo.count_api = r.count; nomeInfo.recebidas = r.itens.length;
              const alvoNome = normaliza(oab.nome_busca);
              const alvoDig = soDigitos(oab.numero);
              for (const it of r.itens) {
                const id = Number(it.id);
                if (!id) continue;
                if (origemItem.has(id)) {
                  if (origemItem.get(id) === "oab") { origemItem.set(id, "ambos"); nomeInfo.ambos++; }
                  continue;
                }
                const advs = ((it.destinatarioadvogados as any[]) || []).map((a) => a?.advogado ?? a);
                const mesmoNome = advs.filter((a) => normaliza(a?.nome) === alvoNome);
                if (mesmoNome.some((a) => soDigitos(a?.numero_oab) === alvoDig)) {
                  origemItem.set(id, "nome"); itens.push(it); nomeInfo.aceitas_so_nome++;
                } else if (mesmoNome.length) nomeInfo.descartadas_homonimo++;
                else nomeInfo.descartadas_sem_advogado++;
              }
            }
          }

          const ids = [...new Set(itens.map((i) => Number(i.id)).filter(Boolean))];
          const existentes = new Set<number>();
          for (let i = 0; i < ids.length; i += 200) {
            const { data } = await admin.from("djen_comunicacoes").select("djen_id").eq("organizacao_id", orgId).in("djen_id", ids.slice(i, i + 200));
            for (const r of (data as any[]) || []) existentes.add(Number(r.djen_id));
          }

          const vistos = new Set<number>();
          const linhas = [];
          for (const it of itens) {
            const djenId = Number(it.id);
            if (!djenId || vistos.has(djenId)) continue;
            vistos.add(djenId);
            const disp = dia(it.data_disponibilizacao ?? it.datadisponibilizacao);
            const pub = disp ? cal.diaUtilSeguinte(disp) : null;
            const ini2 = pub ? cal.diaUtilSeguinte(pub) : null;
            const noRecesso = (d: string | null) => {
              if (!d) return false;
              const md = d.slice(5);
              return md >= "12-20" || md <= "01-20";
            };
            const dest = (it.destinatarios as any[]) || [];
            let clienteId: string | null = null;
            let polo: string | null = null;
            for (const d of dest) {
              const id = mapaCli.get(normaliza(d?.nome));
              if (id) { clienteId = id; polo = d?.polo ?? null; break; }
            }
            const linha: any = {
              organizacao_id: orgId,
              djen_id: djenId,
              hash: it.hash ?? null,
              oab_id: oab.id,
              data_disponibilizacao: disp,
              sigla_tribunal: it.siglaTribunal ?? null,
              tipo_comunicacao: it.tipoComunicacao ?? null,
              nome_orgao: it.nomeOrgao ?? null,
              nome_classe: it.nomeClasse ?? null,
              numero_processo: soDigitos(it.numero_processo) || null,
              numero_processo_mascara: it.numeroprocessocommascara ?? null,
              texto: it.texto ?? null,
              link: it.link ?? null,
              meio: it.meio ?? null,
              ativo: it.ativo ?? null,
              status: it.status ?? null,
              data_cancelamento: it.data_cancelamento ?? null,
              destinatarios: dest,
              advogados: it.destinatarioadvogados ?? [],
              data_publicacao: pub,
              inicio_prazo: ini2,
              aviso_suspensao: noRecesso(pub) || noRecesso(ini2),
            };
            if (!existentes.has(djenId)) {
              linha.cliente_id = clienteId;
              linha.polo_cliente = polo;
              const orig = origemItem.get(djenId);
              if (orig) linha.capturada_por = orig;
              if (retroNome) {
                linha.status_triagem = "tratada_advbox";
                linha.observacao = `carga retroativa pelo nome, conferida no ADVBOX em ${String(body?.conferidaEm || "").slice(0, 5) || "27/09"}`;
              }
            }
            linhas.push(linha);
          }
          // Novas e já existentes em lotes separados: num lote misto, campos só das
          // novas (cliente, triagem, capturada_por) iriam como nulo nas existentes.
          const grupos = [linhas.filter((l) => !existentes.has(l.djen_id)), linhas.filter((l) => existentes.has(l.djen_id))];
          for (const g of grupos) for (let i = 0; i < g.length; i += 100) {
            const { error } = await admin.from("djen_comunicacoes").upsert(g.slice(i, i + 100), { onConflict: "organizacao_id,djen_id" });
            if (error) throw new Error(error.message);
          }
          const novasLinhas = linhas.filter((l) => !existentes.has(l.djen_id));
          const novas = novasLinhas.map((l) => l.djen_id);
          novasTotal += novas.length;
          if (!retroNome) novasIds.push(...novas.map(String));
          else det.retro_novas = [...(det.retro_novas || []), ...novasLinhas.map((l) => ({ djen_id: l.djen_id, processo: l.numero_processo_mascara, tribunal: l.sigla_tribunal, disponibilizacao: l.data_disponibilizacao }))];
          if (!retroNome) await admin.from("controladoria_oabs").update({ carga_inicial_feita: true, ultima_captura: new Date().toISOString() }).eq("id", oab.id);
          const novasPor = { oab: 0, nome: 0, ambos: 0 };
          for (const l of novasLinhas) if (l.capturada_por) novasPor[l.capturada_por as "oab"]++;
          det.novas_por_nome = (det.novas_por_nome || 0) + novasPor.nome;
          det.descartadas_homonimo = (det.descartadas_homonimo || 0) + nomeInfo.descartadas_homonimo;
          det.oabs.push({ oab: `${oab.numero}/${oab.uf}`, inicio: ini, fim, count_api: count, recebidas: vistos.size, novas: novas.length, novas_por: novasPor, nome: oab.nome_busca ? nomeInfo : undefined });
        }
      }

      // Ligação com o ADVBOX (processos ainda não consultados), com orçamento de tempo.
      const token = Deno.env.get("ADVBOX_TOKEN") ?? Deno.env.get("ADVBOX_API_TOKEN");
      const adv: any = { consultados: 0, achados: 0, nao_cadastrados: 0, pendentes: 0, erros: 0 };
      det.novas_ids = parcial ? novasIds : undefined;

      // Usuários do ADVBOX × app (uma vez por execução): tabela de vínculo primeiro, e-mail como reserva.
      const mapaAdv = await mapaUsuariosAdvbox(admin, orgId, token, await usuariosDaOrg(admin, orgId));

      // Backfill: preenche SÓ advbox_responsavel_id nas linhas que já têm lawsuit
      // (não mexe em situação nem em responsavel_id). Usado uma vez para as 334.
      if (body?.acao === "backfill_responsavel_id" && token) {
        const { data: linhas } = await admin.from("djen_comunicacoes")
          .select("djen_id, advbox_lawsuit_id")
          .eq("organizacao_id", orgId)
          .not("advbox_lawsuit_id", "is", null)
          .is("advbox_responsavel_id", null)
          .limit(2000);
        const bf: any = { consultados: 0, preenchidos: 0, erros: 0, pendentes: 0 };
        for (const r of (linhas as any[]) || []) {
          if (Date.now() - t0 > 110_000) { bf.pendentes++; continue; }
          const g = await advbox(`/lawsuits/${encodeURIComponent(r.advbox_lawsuit_id)}`, token);
          bf.consultados++;
          if (g.status !== 200) { bf.erros++; continue; }
          const l = g.body?.data ?? g.body;
          const rid = l?.responsible?.id ?? l?.responsible_id ?? null;
          if (rid == null) continue;
          await admin.from("djen_comunicacoes").update({ advbox_responsavel_id: String(rid) })
            .eq("organizacao_id", orgId).eq("djen_id", r.djen_id).is("advbox_responsavel_id", null);
          bf.preenchidos++;
          await espera(250);
        }
        det.backfill = bf;
      }

      if (parcial) { /* lote parcial do navegador: vínculo e aviso ficam para o fim */ }
      else if (token) {
        const { data: pend } = await admin.from("djen_comunicacoes").select("numero_processo, numero_processo_mascara")
          .eq("organizacao_id", orgId).is("advbox_consultado_em", null).not("numero_processo", "is", null).limit(5000);
        const proc = new Map<string, string>();
        for (const r of (pend as any[]) || []) if (!proc.has(r.numero_processo)) proc.set(r.numero_processo, r.numero_processo_mascara || r.numero_processo);
        for (const [num, mascara] of proc) {
          if (Date.now() - t0 > 110_000) { adv.pendentes++; continue; }
          const r = await advbox(`/lawsuits?process_number=${encodeURIComponent(mascara)}`, token);
          if (r.status !== 200) { adv.erros++; adv.ultimo_status = r.status; continue; }
          const lista: any[] = Array.isArray(r.body) ? r.body : (r.body?.data ?? []);
          const l = lista.find((x) => soDigitos(x?.process_number) === num) ?? null;
          adv.consultados++;
          if (!adv.amostra && l) adv.amostra = Object.keys(l).slice(0, 40);
          const resp = l ? (typeof l.responsible === "string" ? l.responsible : (l.responsible?.name ?? l.responsible_name ?? l.users?.[0]?.name ?? null)) : null;
          const respId = l ? (l.responsible?.id ?? l.responsible_id ?? null) : null;
          const upd = l
            ? { advbox_lawsuit_id: String(l.id), advbox_responsavel: resp, advbox_responsavel_id: respId != null ? String(respId) : null, advbox_nao_cadastrado: false, advbox_consultado_em: new Date().toISOString() }
            : { advbox_nao_cadastrado: true, advbox_consultado_em: new Date().toISOString() };
          if (l) adv.achados++; else adv.nao_cadastrados++;
          await admin.from("djen_comunicacoes").update(upd).eq("organizacao_id", orgId).eq("numero_processo", num);
          await espera(250);
        }
      } else adv.sem_token = true;
      det.advbox = adv;

      // Preenche o responsável do app nas intimações NOVAS: responsible_id do
      // ADVBOX -> e-mail (via /settings) -> usuário do app pelo e-mail (sem
      // diferenciar maiúsculas), mesma regra do D-5. Não toca em quem já tem
      // responsável nem nas 334 da carga inicial.
      if (novasIds.length && mapaAdv.size) {
        const usuarios = await usuariosDaOrg(admin, orgId);
        const porEmail = new Map(usuarios.map((u) => [u.email, u.id]));
        const { data: semResp } = await admin.from("djen_comunicacoes")
          .select("djen_id, advbox_responsavel_id")
          .eq("organizacao_id", orgId).in("djen_id", novasIds.map(Number))
          .is("responsavel_id", null).not("advbox_responsavel_id", "is", null);
        let atribuidas = 0;
        for (const r of (semResp as any[]) || []) {
          const uid = mapaAdv.get(String(r.advbox_responsavel_id)) ?? null;
          if (!uid) continue;
          await admin.from("djen_comunicacoes").update({ responsavel_id: uid })
            .eq("organizacao_id", orgId).eq("djen_id", r.djen_id).is("responsavel_id", null);
          atribuidas++;
        }
        det.responsaveis_atribuidos = atribuidas;
      }

      // Cliente pela ligação com o processo judicial (nunca sobrescreve cliente_id).
      if (!parcial || body?.acao === "cliente_por_processo") det.cliente_por_processo = await clientePorProcesso(admin, orgId);

      // Notificação: UMA por responsável.
      if (!parcial && novasIds.length) {
        const { data: novasRows } = await admin.from("djen_comunicacoes").select("advbox_responsavel")
          .eq("organizacao_id", orgId).in("djen_id", novasIds.map(Number));
        const usuarios = await usuariosDaOrg(admin, orgId);
        const admins = await adminsControladoria(admin, orgId);
        const porUser = new Map<string, number>();
        for (const r of (novasRows as any[]) || []) {
          const nome = normaliza(r.advbox_responsavel);
          const u = nome ? usuarios.find((x) => normaliza(x.nome) === nome || x.email === String(r.advbox_responsavel || "").toLowerCase()) : null;
          const alvos = u ? [u.id] : admins;
          for (const a of alvos) porUser.set(a, (porUser.get(a) || 0) + 1);
        }
        const notifs = [...porUser].map(([user_id, n]) => ({
          user_id, tipo: "info",
          mensagem: `${n} nova${n > 1 ? "s" : ""} intimaç${n > 1 ? "ões" : "ão"} do DJEN na Controladoria`,
        }));
        if (notifs.length) await admin.from("notificacoes_sistema").insert(notifs);
        det.notificacoes = notifs.length;
      }
    } catch (e) {
      erro = (e as Error).message;
    }
    await admin.from("controladoria_execucoes").update({ fim: new Date().toISOString(), novas: novasTotal, detalhes: det, erro }).eq("id", exec!.id);
    // Sentinela: execução agendada com erro avisa os admins na hora (máx. 1 a cada 6 h).
    if (erro && auth.origem === "cron") {
      try { await avisarAdmins(admin, orgId, "erro", `Falha na captura de intimações do DJEN: ${erro.slice(0, 300)}`); } catch { /* não derruba a resposta */ }
    }
    resultado.push({ organizacao_id: orgId, novas: novasTotal, ...det, erro });
  }
  return json({ ok: true, resultado });
});
