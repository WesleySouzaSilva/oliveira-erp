// Códigos de verificação (TOTP) de acesso aos tribunais.
//
// Esta função é o ÚNICO caminho até os segredos. O front nunca recebe a chave:
// recebe apenas o código de 6 dígitos e quantos segundos faltam para expirar.
//
// Segredos exigidos na configuração da função:
//   TOTP_ENCRYPTION_KEY  — 32 bytes aleatórios em base64 (chave AES-GCM)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — já existentes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// Cifra do segredo em repouso (AES-GCM 256)
// ---------------------------------------------------------------------------
async function chaveAes(): Promise<CryptoKey> {
  const b64 = Deno.env.get("TOTP_ENCRYPTION_KEY");
  if (!b64) throw new Error("TOTP_ENCRYPTION_KEY não configurada na função");
  const bruta = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bruta.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY deve ter 32 bytes em base64");
  return crypto.subtle.importKey("raw", bruta, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function cifrar(texto: string): Promise<string> {
  const chave = await chaveAes();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(texto)),
  );
  const saida = new Uint8Array(iv.length + cifrado.length);
  saida.set(iv);
  saida.set(cifrado, iv.length);
  return btoa(String.fromCharCode(...saida));
}

async function decifrar(base64: string): Promise<string> {
  const chave = await chaveAes();
  const bruta = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const claro = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bruta.slice(0, 12) },
    chave,
    bruta.slice(12),
  );
  return new TextDecoder().decode(claro);
}

// ---------------------------------------------------------------------------
// Núcleo TOTP (RFC 6238) — validado contra os vetores oficiais do Apêndice B
// ---------------------------------------------------------------------------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(entrada: string): Uint8Array {
  const limpo = entrada.toUpperCase().replace(/\s+/g, "").replace(/=+$/, "");
  if (!limpo.length) throw new Error("chave vazia");
  let bits = 0;
  let valor = 0;
  const saida: number[] = [];
  for (const ch of limpo) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error(`caractere inválido na chave: ${ch}`);
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      saida.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(saida);
}

async function totp(
  segredoBase32: string,
  opcoes: { digitos?: number; periodo?: number; algoritmo?: string; timestamp?: number } = {},
): Promise<string> {
  const { digitos = 6, periodo = 30, algoritmo = "SHA-1", timestamp = Date.now() } = opcoes;

  const mensagem = new Uint8Array(8);
  let contador = BigInt(Math.floor(timestamp / 1000 / periodo));
  for (let i = 7; i >= 0; i--) {
    mensagem[i] = Number(contador & 0xffn);
    contador >>= 8n;
  }

  const chave = await crypto.subtle.importKey(
    "raw",
    base32Decode(segredoBase32),
    { name: "HMAC", hash: algoritmo },
    false,
    ["sign"],
  );
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", chave, mensagem));

  const offset = assinatura[assinatura.length - 1] & 0x0f;
  const truncado =
    ((assinatura[offset] & 0x7f) << 24) |
    (assinatura[offset + 1] << 16) |
    (assinatura[offset + 2] << 8) |
    assinatura[offset + 3];

  return String(truncado % 10 ** digitos).padStart(digitos, "0");
}

const segundosRestantes = (periodo: number, timestamp: number) =>
  periodo - (Math.floor(timestamp / 1000) % periodo);

// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const ip = req.headers.get("x-forwarded-for") ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const registrar = async (linha: Record<string, unknown>) => {
    try {
      await admin.from("tj_auditoria").insert({ ip, user_agent: userAgent, ...linha });
    } catch (e) {
      console.error("falha ao gravar auditoria:", (e as Error).message);
    }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Não autorizado" }, 401);

    // Organização do chamador — vem do banco, nunca do corpo da requisição.
    const { data: membro } = await admin
      .from("membros")
      .select("organizacao_id, papel")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!membro?.organizacao_id) return json({ error: "Conta sem vínculo com organização" }, 403);
    const orgId = membro.organizacao_id as string;

    // Conta desativada na tela de Equipe perde o acesso aqui também. A tela do
    // app já barra, mas quem guarda o segredo é esta função — ela não pode
    // depender de o navegador se comportar bem.
    const { data: perfil } = await admin
      .from("profiles")
      .select("ativo")
      .eq("id", caller.id)
      .maybeSingle();
    if (perfil?.ativo === false) {
      await registrar({
        organizacao_id: orgId,
        user_id: caller.id,
        acao: "acesso_bloqueado",
        sucesso: false,
        detalhe: { motivo: "conta_desativada" },
      });
      return json({ error: "Conta desativada" }, 403);
    }

    const { data: custodiante } = await admin
      .from("tj_custodiantes")
      .select("id")
      .eq("organizacao_id", orgId)
      .eq("user_id", caller.id)
      .maybeSingle();
    // Administradores da organização mandam aqui como custodiantes: são eles
    // que respondem pelos acessos aos tribunais. Quem é só custodiante
    // cadastrado continua valendo, para não quebrar quem já existe.
    const ehAdmin = membro.papel === "admin";
    const ehCustodiante = !!custodiante || ehAdmin;

    const exigirCustodiante = async (acao: string) => {
      if (ehCustodiante) return null;
      await registrar({
        organizacao_id: orgId,
        user_id: caller.id,
        acao,
        sucesso: false,
        detalhe: { motivo: "nao_custodiante" },
      });
      return json({ error: "Apenas custodiantes podem executar esta ação" }, 403);
    };

    const corpo = await req.json().catch(() => ({}));
    const { action, credencial_id, user_id, nome, descricao, segredo, digitos, periodo, algoritmo } = corpo;

    // -----------------------------------------------------------------------
    // listar — credenciais que o chamador pode ver. Nunca devolve o segredo.
    // -----------------------------------------------------------------------
    if (action === "listar") {
      let ids: string[] | null = null;
      if (!ehCustodiante) {
        const { data: acessos } = await admin
          .from("tj_credencial_acessos")
          .select("credencial_id")
          .eq("user_id", caller.id);
        ids = (acessos ?? []).map((a) => a.credencial_id as string);
        if (!ids.length) return json({ credenciais: [], custodiante: false });
      }

      let q = admin
        .from("tj_credenciais")
        .select("id, nome, descricao, digitos, periodo, ativo")
        .eq("organizacao_id", orgId)
        .eq("ativo", true)
        .order("nome");
      if (ids) q = q.in("id", ids);

      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({ credenciais: data ?? [], custodiante: ehCustodiante });
    }

    // -----------------------------------------------------------------------
    // codigo — o coração. Confere permissão, calcula e devolve só os dígitos.
    // -----------------------------------------------------------------------
    if (action === "codigo") {
      if (!credencial_id) return json({ error: "Credencial obrigatória" }, 400);

      const { data: cred } = await admin
        .from("tj_credenciais")
        .select("id, nome, segredo_cifrado, digitos, periodo, algoritmo, ativo, organizacao_id")
        .eq("id", credencial_id)
        .eq("organizacao_id", orgId)
        .maybeSingle();

      if (!cred || !cred.ativo) {
        await registrar({
          organizacao_id: orgId, user_id: caller.id, credencial_id,
          acao: "consulta_codigo", sucesso: false, detalhe: { motivo: "inexistente_ou_inativa" },
        });
        return json({ error: "Credencial não encontrada" }, 404);
      }

      if (!ehCustodiante) {
        const { data: acesso } = await admin
          .from("tj_credencial_acessos")
          .select("id")
          .eq("credencial_id", credencial_id)
          .eq("user_id", caller.id)
          .maybeSingle();
        if (!acesso) {
          await registrar({
            organizacao_id: orgId, user_id: caller.id, credencial_id,
            credencial_nome: cred.nome, acao: "consulta_codigo", sucesso: false,
            detalhe: { motivo: "sem_permissao" },
          });
          return json({ error: "Você não tem acesso a esta credencial" }, 403);
        }
      }

      const agora = Date.now();
      const codigo = await totp(await decifrar(cred.segredo_cifrado as string), {
        digitos: cred.digitos as number,
        periodo: cred.periodo as number,
        algoritmo: cred.algoritmo as string,
        timestamp: agora,
      });

      // A tela renova o código sozinha a cada período, e cada renovação gravava
      // uma linha — o histórico afogava as consultas de verdade. Consultas
      // encadeadas passam a ser marcadas como renovação, para dar para filtrar.
      // A detecção é feita aqui, no servidor: o navegador não decide o que é
      // renovação, senão bastaria mentir para sumir do histórico.
      const { data: anterior } = await admin
        .from("tj_auditoria")
        .select("created_at")
        .eq("user_id", caller.id)
        .eq("credencial_id", credencial_id)
        .eq("acao", "consulta_codigo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const renovacao =
        !!anterior &&
        agora - new Date(anterior.created_at as string).getTime() < (cred.periodo as number) * 2000;

      await registrar({
        organizacao_id: orgId, user_id: caller.id, credencial_id,
        credencial_nome: cred.nome, acao: "consulta_codigo", sucesso: true,
        detalhe: renovacao ? { renovacao: true } : null,
      });

      return json({
        codigo,
        periodo: cred.periodo,
        expira_em: segundosRestantes(cred.periodo as number, agora),
      });
    }

    // -----------------------------------------------------------------------
    // criar — só custodiante. Valida a chave gerando um código na hora, para
    // que o custodiante confira contra o celular antes de confiar no cadastro.
    // -----------------------------------------------------------------------
    if (action === "criar") {
      const barrado = await exigirCustodiante("criar");
      if (barrado) return barrado;
      if (!nome || !segredo) return json({ error: "Nome e chave são obrigatórios" }, 400);

      const cfg = {
        digitos: Number(digitos) || 6,
        periodo: Number(periodo) || 30,
        algoritmo: algoritmo || "SHA-1",
      };

      let conferencia: string;
      try {
        conferencia = await totp(segredo, { ...cfg, timestamp: Date.now() });
      } catch (e) {
        return json({ error: `Chave inválida: ${(e as Error).message}` }, 400);
      }

      // Remover uma credencial só a desativa, para o histórico não perder a
      // referência — mas o nome continua ocupado pela restrição de unicidade.
      // Sem este aviso, recadastrar um tribunal apagado falha com um erro de
      // banco que não diz nada a quem está usando.
      const { data: homonima } = await admin
        .from("tj_credenciais")
        .select("id, ativo")
        .eq("organizacao_id", orgId)
        .eq("nome", nome)
        .maybeSingle();
      if (homonima) {
        return json({
          error: homonima.ativo
            ? `Já existe um acesso chamado "${nome}".`
            : `Já existiu um acesso chamado "${nome}", que foi removido. Escolha outro nome (por exemplo "${nome} 2") — o histórico do anterior continua guardado.`,
        }, 409);
      }

      const { data, error } = await admin
        .from("tj_credenciais")
        .insert({
          organizacao_id: orgId,
          nome,
          descricao: descricao ?? null,
          segredo_cifrado: await cifrar(segredo),
          ...cfg,
          criado_por: caller.id,
        })
        .select("id, nome")
        .single();

      if (error) return json({ error: error.message }, 400);

      await registrar({
        organizacao_id: orgId, user_id: caller.id, credencial_id: data.id,
        credencial_nome: data.nome, acao: "criar", sucesso: true,
      });

      // Devolve o código atual só para conferência imediata contra o celular.
      return json({ success: true, credencial: data, codigo_conferencia: conferencia });
    }

    // -----------------------------------------------------------------------
    // remover — desativa (mantém a linha e o histórico)
    // -----------------------------------------------------------------------
    if (action === "remover") {
      const barrado = await exigirCustodiante("remover");
      if (barrado) return barrado;
      if (!credencial_id) return json({ error: "Credencial obrigatória" }, 400);

      // Apaga de verdade. O histórico não depende desta linha: tj_auditoria não
      // tem chave estrangeira para cá e guarda credencial_nome como texto.
      // Antes isto apenas desativava, e o nome ficava ocupado para sempre —
      // recadastrar o mesmo tribunal passava a ser impossível.
      const { data, error } = await admin
        .from("tj_credenciais")
        .delete()
        .eq("id", credencial_id)
        .eq("organizacao_id", orgId)
        .select("id, nome")
        .maybeSingle();

      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "Credencial não encontrada" }, 404);

      await registrar({
        organizacao_id: orgId, user_id: caller.id, credencial_id,
        credencial_nome: data.nome, acao: "remover", sucesso: true,
      });
      return json({ success: true });
    }

    // -----------------------------------------------------------------------
    // renomear — só custodiante. Não toca no segredo.
    // -----------------------------------------------------------------------
    if (action === "renomear") {
      const barrado = await exigirCustodiante("renomear");
      if (barrado) return barrado;
      if (!credencial_id || !nome) return json({ error: "Credencial e nome são obrigatórios" }, 400);

      const { data: homonima } = await admin
        .from("tj_credenciais")
        .select("id")
        .eq("organizacao_id", orgId)
        .eq("nome", nome)
        .neq("id", credencial_id)
        .maybeSingle();
      if (homonima) return json({ error: `Já existe um acesso chamado "${nome}".` }, 409);

      const { data, error } = await admin
        .from("tj_credenciais")
        .update({ nome, descricao: descricao ?? null })
        .eq("id", credencial_id)
        .eq("organizacao_id", orgId)
        .select("id, nome")
        .maybeSingle();

      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "Credencial não encontrada" }, 404);

      await registrar({
        organizacao_id: orgId, user_id: caller.id, credencial_id,
        credencial_nome: data.nome, acao: "renomear", sucesso: true,
      });
      return json({ success: true });
    }

    // -----------------------------------------------------------------------
    // conceder / revogar acesso — só custodiante
    // -----------------------------------------------------------------------
    if (action === "conceder" || action === "revogar") {
      const barrado = await exigirCustodiante(action);
      if (barrado) return barrado;
      if (!credencial_id || !user_id) return json({ error: "Credencial e pessoa são obrigatórias" }, 400);

      const { data: cred } = await admin
        .from("tj_credenciais").select("id, nome")
        .eq("id", credencial_id).eq("organizacao_id", orgId).maybeSingle();
      if (!cred) return json({ error: "Credencial não encontrada" }, 404);

      // A pessoa precisa ser da mesma organização.
      const { data: alvo } = await admin
        .from("membros").select("user_id")
        .eq("user_id", user_id).eq("organizacao_id", orgId).maybeSingle();
      if (!alvo) return json({ error: "Esta pessoa não é da sua organização" }, 400);

      if (action === "conceder") {
        const { error } = await admin
          .from("tj_credencial_acessos")
          .upsert({ credencial_id, user_id, concedido_por: caller.id }, { onConflict: "credencial_id,user_id" });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin
          .from("tj_credencial_acessos").delete()
          .eq("credencial_id", credencial_id).eq("user_id", user_id);
        if (error) return json({ error: error.message }, 400);
      }

      await registrar({
        organizacao_id: orgId, user_id: caller.id, credencial_id,
        credencial_nome: cred.nome, acao: action, sucesso: true,
        detalhe: { alvo: user_id },
      });
      return json({ success: true });
    }

    // -----------------------------------------------------------------------
    // acessos — quem enxerga uma credencial (só custodiante)
    // -----------------------------------------------------------------------
    if (action === "acessos") {
      const barrado = await exigirCustodiante("acessos");
      if (barrado) return barrado;
      if (!credencial_id) return json({ error: "Credencial obrigatória" }, 400);

      const { data: acessos } = await admin
        .from("tj_credencial_acessos")
        .select("user_id, created_at")
        .eq("credencial_id", credencial_id);

      const ids = (acessos ?? []).map((a) => a.user_id as string);
      const { data: perfis } = ids.length
        ? await admin.from("profiles").select("id, nome").in("id", ids)
        : { data: [] as { id: string; nome: string }[] };
      const nomes = new Map((perfis ?? []).map((p) => [p.id, p.nome]));

      return json({
        acessos: (acessos ?? []).map((a) => ({
          user_id: a.user_id,
          nome: nomes.get(a.user_id as string) ?? null,
          desde: a.created_at,
        })),
      });
    }

    // -----------------------------------------------------------------------
    // auditoria — histórico (só custodiante)
    // -----------------------------------------------------------------------
    if (action === "auditoria") {
      const barrado = await exigirCustodiante("auditoria");
      if (barrado) return barrado;

      let q = admin
        .from("tj_auditoria")
        .select("id, credencial_nome, user_id, acao, sucesso, detalhe, ip, created_at")
        .eq("organizacao_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (credencial_id) q = q.eq("credencial_id", credencial_id);

      const { data: linhas, error } = await q;
      if (error) return json({ error: error.message }, 400);

      const ids = [...new Set((linhas ?? []).map((l) => l.user_id as string).filter(Boolean))];
      const { data: perfis } = ids.length
        ? await admin.from("profiles").select("id, nome").in("id", ids)
        : { data: [] as { id: string; nome: string }[] };
      const nomes = new Map((perfis ?? []).map((p) => [p.id, p.nome]));

      return json({
        registros: (linhas ?? []).map((l) => ({ ...l, nome: nomes.get(l.user_id as string) ?? null })),
      });
    }

    // -----------------------------------------------------------------------
    // membros — pessoas da organização, para o custodiante escolher a quem conceder
    // -----------------------------------------------------------------------
    if (action === "membros") {
      const barrado = await exigirCustodiante("membros");
      if (barrado) return barrado;

      const { data: lista } = await admin
        .from("membros").select("user_id, papel").eq("organizacao_id", orgId);
      const ids = (lista ?? []).map((m) => m.user_id as string);
      const { data: perfis } = ids.length
        ? await admin.from("profiles").select("id, nome, ativo").in("id", ids)
        : { data: [] as { id: string; nome: string; ativo: boolean }[] };
      const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

      return json({
        membros: (lista ?? [])
          .map((m) => ({
            user_id: m.user_id,
            papel: m.papel,
            nome: porId.get(m.user_id as string)?.nome ?? null,
            ativo: porId.get(m.user_id as string)?.ativo !== false,
          }))
          .filter((m) => m.ativo)
          .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
      });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("totp-tribunais:", (err as Error).message);
    return json({ error: "Erro interno" }, 500);
  }
});
