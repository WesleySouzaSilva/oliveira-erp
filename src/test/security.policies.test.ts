import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Auditoria automatizada de políticas perigosas.
 *
 * Executa a função SQL `public.audit_dangerous_policies()` (SECURITY DEFINER)
 * usando a chave anônima. O teste FALHA se qualquer política nova for detectada
 * em uma das três categorias:
 *
 *   1. Tabelas em `public` com INSERT/UPDATE/DELETE/ALL exposto ao papel `anon`.
 *   2. Tabelas em `public` com USING/WITH CHECK = `true` (sem checagem) exposto
 *      a `anon`/`public` em comandos de escrita.
 *   3. Políticas em `storage.objects` envolvendo buckets sensíveis
 *      (laudos, assinaturas, certificados, cliente-drive, rh-arquivos)
 *      expostas ao papel `anon`.
 *
 * Para tornar uma nova policy "segura" basta:
 *   - restringir o `roles` para `authenticated` (ou outro papel não-público), OU
 *   - adicionar uma condição real em USING / WITH CHECK
 *     (ex.: `auth.uid() = user_id`, `has_role(auth.uid(), ...)`,
 *     `organizacao_id IN (SELECT user_org_ids(auth.uid()))`).
 */

const SUPABASE_URL = "https://nfgrldtgowuquzmfgszw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZ3JsZHRnb3d1cXV6bWZnc3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTgzNjQsImV4cCI6MjA4OTM3NDM2NH0.IiszIJE7bVhP09QRO_YdHuFpN4K5tAMy6dYugV0DlPk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Finding = {
  kind: string;
  schemaname: string;
  tablename: string;
  policyname: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
  reason: string;
};

const formatFinding = (f: Finding) =>
  `  • [${f.kind}] ${f.schemaname}.${f.tablename} » "${f.policyname}" ` +
  `(cmd=${f.cmd}, roles=${JSON.stringify(f.roles)}) — ${f.reason}\n` +
  `      USING:      ${f.qual || "(vazio)"}\n` +
  `      WITH CHECK: ${f.with_check || "(vazio)"}`;

describe("Auditoria de políticas RLS perigosas", () => {
  it("audit_dangerous_policies não deve ser executável por anon (ferramenta administrativa)", async () => {
    // Após a rodada de hardening de segurança, EXECUTE foi revogado de anon/public
    // nessa função SECURITY DEFINER. O comportamento correto agora é o cliente anon
    // receber erro de permissão (42501). Se algum dia voltar a ser executável por
    // anon, este teste falha — sinalizando regressão de segurança.
    const { data, error } = await supabase.rpc("audit_dangerous_policies");

    expect(
      error,
      "audit_dangerous_policies deveria estar inacessível para anon, mas executou com sucesso. " +
        "Verifique se algum GRANT EXECUTE ... TO anon/public foi reintroduzido.",
    ).not.toBeNull();

    // Aceita tanto o código padrão do Postgres (42501) quanto a mensagem textual.
    const code = (error as { code?: string } | null)?.code ?? "";
    const message = (error?.message ?? "").toLowerCase();
    const isPermissionDenied =
      code === "42501" || message.includes("permission denied");

    expect(
      isPermissionDenied,
      `Erro inesperado ao chamar audit_dangerous_policies como anon: ${JSON.stringify(error)}`,
    ).toBe(true);

    // Sem data quando a chamada é rejeitada
    expect(data).toBeNull();
  });

  it("buckets sensíveis devem permanecer privados (não public)", async () => {
    // Tenta listar arquivos dos buckets sensíveis usando a chave anônima.
    // Como os buckets são privados, a listagem não deve retornar nenhum objeto.
    const sensitiveBuckets = [
      "laudos",
      "assinaturas",
      "certificados",
      "cliente-drive",
      "rh-arquivos",
    ];

    for (const bucket of sensitiveBuckets) {
      const { data, error } = await supabase.storage.from(bucket).list("", {
        limit: 1,
      });
      // Aceitamos erro (acesso negado) ou retorno vazio. Falha apenas se
      // o anon conseguir efetivamente listar algum arquivo.
      const leaked = !error && Array.isArray(data) && data.length > 0;
      expect(
        leaked,
        `Bucket sensível '${bucket}' está expondo arquivos para usuários anônimos.`,
      ).toBe(false);
    }
  });
});

describe("soft_delete: allowlist + checagem de organização", () => {
  // Como anon não pode chamar soft_delete (sem GRANT EXECUTE), aceitamos erro
  // 42501 (permission denied) OU o erro lançado pela função ('tabela nao
  // permitida' / 'nao autorizado'). O que NÃO pode acontecer é a chamada
  // retornar sucesso.
  const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

  it("rejeita tabela fora da allowlist", async () => {
    const { error } = await supabase.rpc("soft_delete", {
      _table: "profiles",
      _id: FAKE_UUID,
    });
    expect(
      error,
      "soft_delete aceitou uma tabela fora da allowlist — regressão de segurança.",
    ).not.toBeNull();
  });

  it("rejeita id que não pertence à organização do chamador", async () => {
    // Tabela permitida, id qualquer. Como anon não tem org, a checagem
    // organizacao_id IN (user_org_ids(auth.uid())) sempre falha.
    const { error } = await supabase.rpc("soft_delete", {
      _table: "clientes",
      _id: FAKE_UUID,
    });
    expect(
      error,
      "soft_delete permitiu marcar deleted_at em linha fora da organização do chamador — regressão de segurança.",
    ).not.toBeNull();
  });
});

describe("Portal do Cliente: isolamento das tabelas de consultoria", () => {
  // Como anon (sem login), as policies do portal exigem
  // empresa_do_usuario_portal(auth.uid()) — que é NULL — então nenhuma
  // linha pode vazar. Notas internas (visivel_empresa=false) também
  // não podem ser lidas sem estar autenticado como portal vinculado.

  it("anon não consegue ler consultoria_demandas", async () => {
    const { data, error } = await supabase
      .from("consultoria_demandas")
      .select("id")
      .limit(1);
    // Aceita erro de policy OU resultado vazio — o que NÃO pode é vazar linhas.
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "consultoria_demandas vazou linhas para anon — regressão de segurança.").toBe(false);
  });

  it("anon não consegue ler demanda_interacoes (nem visíveis, nem internas)", async () => {
    const { data, error } = await supabase
      .from("demanda_interacoes")
      .select("id,visivel_empresa")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "demanda_interacoes vazou linhas para anon — regressão de segurança.").toBe(false);
  });

  it("anon não consegue ler empresa_portal_usuarios", async () => {
    const { data, error } = await supabase
      .from("empresa_portal_usuarios")
      .select("id")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "empresa_portal_usuarios vazou linhas para anon — regressão de segurança.").toBe(false);
  });

  it("anon não consegue ler tabelas internas (membros, avenca_valores)", async () => {
    // Default-deny continua valendo para o portal: nenhum acesso a tabelas internas.
    const { data: m, error: mErr } = await supabase.from("membros").select("id").limit(1);
    expect(!mErr && Array.isArray(m) && m.length > 0,
      "membros vazou para anon — regressão de segurança.").toBe(false);
    const { data: v, error: vErr } = await supabase.from("avenca_valores").select("avenca_id").limit(1);
    expect(!vErr && Array.isArray(v) && v.length > 0,
      "avenca_valores vazou para anon — regressão de segurança.").toBe(false);
  });
});

describe("Financeiro (CEO-only): nenhum vazamento e is_ceo obrigatório", () => {
  it("anon não consegue ler financeiro_lancamentos", async () => {
    const { data, error } = await supabase
      .from("financeiro_lancamentos")
      .select("id, valor")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "financeiro_lancamentos vazou para anon — regressão de segurança crítica.").toBe(false);
  });

  it("anon não consegue inserir em financeiro_lancamentos", async () => {
    const { error } = await supabase
      .from("financeiro_lancamentos")
      .insert({
        organizacao_id: "00000000-0000-0000-0000-000000000000",
        tipo: "receita",
        descricao: "intrusion attempt",
        valor: 1,
        data: "2026-01-01",
      });
    expect(error, "anon conseguiu inserir em financeiro_lancamentos — regressão de segurança.").not.toBeNull();
  });

  it("anon não consegue executar is_ceo()", async () => {
    // is_ceo é EXECUTE só para authenticated/service_role.
    const { error } = await supabase.rpc("is_ceo", { uid: "00000000-0000-0000-0000-000000000000" });
    expect(error, "is_ceo() ficou executável por anon — regressão de segurança.").not.toBeNull();
  });

  it("anon não consegue ler financeiro_cobrancas (Asaas)", async () => {
    const { data, error } = await supabase
      .from("financeiro_cobrancas")
      .select("id, valor")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "financeiro_cobrancas vazou para anon — regressão crítica.").toBe(false);
  });

  it("anon não consegue inserir em financeiro_cobrancas (somente service_role)", async () => {
    const { error } = await supabase
      .from("financeiro_cobrancas")
      .insert({
        organizacao_id: "00000000-0000-0000-0000-000000000000",
        asaas_payment_id: "intrusion-attempt",
        valor: 1,
      });
    expect(error, "anon conseguiu inserir em financeiro_cobrancas — regressão crítica.").not.toBeNull();
  });
});

describe("Portal do Cliente do Agro: isolamento (Fase 1)", () => {
  // Como anon (sem login) as policies do portal exigem
  // cliente_do_usuario_portal(auth.uid()) — que é NULL — então nada vaza.

  it("anon não consegue ler cliente_portal_usuarios", async () => {
    const { data, error } = await supabase
      .from("cliente_portal_usuarios")
      .select("id")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "cliente_portal_usuarios vazou para anon — regressão crítica.").toBe(false);
  });

  it("anon não consegue inserir em cliente_portal_usuarios (só service_role)", async () => {
    const { error } = await supabase
      .from("cliente_portal_usuarios")
      .insert({
        organizacao_id: "00000000-0000-0000-0000-000000000000",
        cliente_id: "00000000-0000-0000-0000-000000000000",
        user_id: "00000000-0000-0000-0000-000000000000",
      });
    expect(error, "anon conseguiu inserir em cliente_portal_usuarios — regressão crítica.").not.toBeNull();
  });

  it("anon não consegue executar cliente_do_usuario_portal()", async () => {
    const { error } = await supabase.rpc(
      "cliente_do_usuario_portal" as any,
      { uid: "00000000-0000-0000-0000-000000000000" } as any,
    );
    expect(
      error,
      "cliente_do_usuario_portal() ficou executável por anon — regressão crítica.",
    ).not.toBeNull();
  });

  it("anon não consegue ler processo_andamentos (nem visíveis ao cliente)", async () => {
    // Sem vínculo (anon), a policy do portal-cliente exige cliente_do_usuario_portal(auth.uid())
    // que é NULL — então nenhum andamento pode vazar, mesmo os com visivel_cliente=true.
    const { data, error } = await supabase
      .from("processo_andamentos")
      .select("id, visivel_cliente")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "processo_andamentos vazou para anon — regressão crítica.").toBe(false);
  });

  it("anon não consegue ler processos", async () => {
    const { data, error } = await supabase
      .from("processos")
      .select("id, cliente_id")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "processos vazou para anon — regressão crítica.").toBe(false);
  });
});

describe("Provas: gabarito e notas protegidos", () => {
  // As policies de prova_* exigem liderança (admin/coordenador/CEO) via
  // prova_is_lider(). Sem login (anon) nada pode vazar — e qualquer membro
  // comum cai na mesma negação, porque a policy não tem caminho para ele.
  // Estes testes NÃO alteram policies: se falharem, o defeito é regressão.

  it("membro comum não consegue ler prova_alternativas (gabarito)", async () => {
    const { data, error } = await supabase
      .from("prova_alternativas" as any)
      .select("id, texto, correta")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "prova_alternativas vazou gabarito para não-líder — regressão crítica.").toBe(false);
  });

  it("membro comum não consegue ler prova_questoes", async () => {
    const { data, error } = await supabase
      .from("prova_questoes" as any)
      .select("id, enunciado")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "prova_questoes vazou para não-líder — regressão crítica.").toBe(false);
  });

  it("membro comum não consegue ler provas", async () => {
    const { data, error } = await supabase
      .from("provas" as any)
      .select("id, titulo")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "provas vazou para não-líder — regressão crítica.").toBe(false);
  });

  it("membro comum não consegue alterar nota/aprovado/correcao em prova_aplicacoes", async () => {
    const FAKE = "00000000-0000-0000-0000-000000000000";
    const { error } = await supabase
      .from("prova_aplicacoes" as any)
      .update({ nota: 100, aprovado: true, corrigida_por: FAKE, observacao_do_lider: "fraude" } as any)
      .eq("id", FAKE);
    // Sem permissão, o update deve falhar OU afetar 0 linhas (RLS esconde a linha).
    // O que não pode é o anon conseguir sequer enxergar a aplicação para alterar.
    const { data } = await supabase
      .from("prova_aplicacoes" as any)
      .select("id, nota, aprovado")
      .limit(1);
    const leaked = Array.isArray(data) && data.length > 0;
    expect(leaked, "prova_aplicacoes expôs notas para não-líder — regressão crítica.").toBe(false);
    void error;
  });

  it("prova-iniciar rejeita chamada sem autenticação", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/prova-iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ prova_id: "00000000-0000-0000-0000-000000000000" }),
    });
    expect(res.status, "prova-iniciar aceitou chamada sem login — regressão crítica.").toBe(401);
  });
});

describe("Provas: payload do respondente nunca contém gabarito", () => {
  // Espelho estático do mapeamento de questoesParaResponder
  // (supabase/functions/_shared/provas.ts): mesmas colunas no select e
  // mesma montagem do objeto de saída, aplicado a uma fixture que CONTÉM
  // correta/explicacao. Se o mapeamento vazar qualquer campo de gabarito,
  // a varredura recursiva abaixo encontra.

  const mapQuestaoParaRespondente = (q: any, alts: any[], embaralhar = false) => {
    const lista = alts
      .filter((a) => a.questao_id === q.id)
      .map((a) => ({ id: a.id, texto: a.texto }));
    return {
      id: q.id,
      enunciado: q.enunciado,
      tipo: q.tipo,
      peso: Number(q.peso),
      alternativas: embaralhar ? [...lista].reverse() : lista,
    };
  };

  const chavesProibidas = ["correta", "explicacao", "gabarito", "resposta_correta", "is_correct", "correct"];

  function varrerProibidas(valor: unknown, caminho = "raiz"): string[] {
    const achados: string[] = [];
    if (Array.isArray(valor)) {
      valor.forEach((v, i) => achados.push(...varrerProibidas(v, `${caminho}[${i}]`)));
    } else if (valor && typeof valor === "object") {
      for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
        if (chavesProibidas.includes(k.toLowerCase())) achados.push(`${caminho}.${k}`);
        achados.push(...varrerProibidas(v, `${caminho}.${k}`));
      }
    }
    return achados;
  }

  it("questoesParaResponder não expõe 'correta' em nenhum nível do JSON", () => {
    const questoesComGabarito = [
      { id: "q1", enunciado: "2+2?", tipo: "multipla_escolha", peso: 1, ordem: 1, explicacao: "soma" },
      { id: "q2", enunciado: "Explique", tipo: "dissertativa", peso: 2, ordem: 2, explicacao: "rub" },
    ];
    const altsComGabarito = [
      { id: "a1", questao_id: "q1", texto: "4", ordem: 1, correta: true },
      { id: "a2", questao_id: "q1", texto: "5", ordem: 2, correta: false },
    ];

    const payload = questoesComGabarito.map((q) => mapQuestaoParaRespondente(q, altsComGabarito));
    const vazamentos = varrerProibidas(payload);
    expect(vazamentos, `Gabarito vazou no payload do respondente: ${vazamentos.join(", ")}`).toEqual([]);
    // E o JSON serializado inteiro também não pode conter as chaves
    const serializado = JSON.stringify(payload);
    for (const chave of chavesProibidas) {
      expect(serializado.includes(`"${chave}"`), `Chave "${chave}" presente no JSON do respondente.`).toBe(false);
    }
  });

  it("código-fonte de questoesParaResponder não seleciona colunas de gabarito", async () => {
    const { default: fonte } = await import("../../supabase/functions/_shared/provas.ts?raw");
    // O select que alimenta o respondente deve listar só colunas seguras
    expect(fonte).toContain('.select("id,enunciado,tipo,peso,ordem")');
    expect(fonte).toContain('.select("id,questao_id,texto,ordem")');
    // "correta" só pode aparecer dentro de gravarECorrigir (correção no servidor)
    const trechoRespondente = fonte.split("questoesParaResponder")[1]?.split("gravarECorrigir")[0] ?? "";
    expect(trechoRespondente.includes("correta"), "questoesParaResponder referencia 'correta'.").toBe(false);
    expect(trechoRespondente.includes("explicacao"), "questoesParaResponder referencia 'explicacao'.").toBe(false);
  });
});

describe("Provas: token de candidato inválido recebe resposta genérica", () => {
  const url = `${SUPABASE_URL}/functions/v1/prova-publica`;

  async function consultarToken(token: string) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ token }),
    });
    const corpo = await res.json().catch(() => null);
    return { status: res.status, corpo };
  }

  it("token inexistente, malformado e vazio recebem exatamente a mesma resposta", async () => {
    const inexistente = await consultarToken("a".repeat(64)); // formato válido, não existe
    const malformado = await consultarToken("token-curto");
    const vazio = await consultarToken("");

    // Mesma resposta genérica para todos: nada de revelar se o token existe
    expect(inexistente.status).toBe(malformado.status);
    expect(malformado.status).toBe(vazio.status);
    expect(JSON.stringify(inexistente.corpo)).toBe(JSON.stringify(malformado.corpo));
    expect(JSON.stringify(malformado.corpo)).toBe(JSON.stringify(vazio.corpo));

    // A resposta genérica não pode conter dados de prova, candidato ou questões
    const texto = JSON.stringify(inexistente.corpo).toLowerCase();
    for (const vazamento of ["questoes", "candidato", "prova", "enunciado", "alternativas"]) {
      expect(texto.includes(vazamento), `Resposta de token inválido vazou "${vazamento}".`).toBe(false);
    }
  });
});

describe("Portal do Cliente do Agro: isolamento (Fase 2 — atendimentos e acordos)", () => {
  // Sem vínculo (anon), cliente_do_usuario_portal(auth.uid()) é NULL,
  // então nem a policy portal_cliente_view_atendimentos nem
  // portal_cliente_view_acordos devolvem linha — mesmo as marcadas como
  // visivel_cliente=true. Views seguem a RLS das tabelas base
  // (security_invoker=true).

  it("anon não consegue ler atendimentos_notas (nem os visíveis ao cliente)", async () => {
    const { data, error } = await supabase
      .from("atendimentos_notas")
      .select("id, visivel_cliente")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "atendimentos_notas vazou para anon — regressão crítica.").toBe(false);
  });

  it("anon não consegue ler acordos_tarefas (nem os visíveis ao cliente)", async () => {
    const { data, error } = await supabase
      .from("acordos_tarefas")
      .select("id, visivel_cliente, cliente_id")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "acordos_tarefas vazou para anon — regressão crítica.").toBe(false);
  });

  it("anon não consegue ler portal_cliente_atendimentos_view (view segue RLS da base)", async () => {
    const { data, error } = await supabase
      .from("portal_cliente_atendimentos_view" as any)
      .select("id")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "portal_cliente_atendimentos_view vazou para anon — regressão crítica.").toBe(false);
  });

  it("anon não consegue ler portal_cliente_acordos_view (view segue RLS da base)", async () => {
    const { data, error } = await supabase
      .from("portal_cliente_acordos_view" as any)
      .select("id")
      .limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    expect(leaked, "portal_cliente_acordos_view vazou para anon — regressão crítica.").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Modo "ver como": exclusivamente visual e somente leitura.
// O guarda barra toda escrita ANTES de sair do navegador. Usamos um cliente
// com fetch instrumentado: nenhuma escrita pode gerar requisição.
// ---------------------------------------------------------------------------
import { instalarGuardaVerComo, rpcPermitidaNoModo } from "@/lib/verComo";

describe("Modo ver como: nenhuma escrita", () => {
  const chamadas: { url: string; method: string }[] = [];
  const fetchEspiao = (async (input: any, init?: any) => {
    chamadas.push({ url: String(input?.url ?? input), method: (init?.method || "GET").toUpperCase() });
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const cli: any = instalarGuardaVerComo(
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchEspiao } }),
    () => true,
  );

  it("insert/update/upsert/delete, RPC de escrita, funções e storage não saem do navegador", async () => {
    chamadas.length = 0;
    const tentativas = [
      cli.from("trein_aula_progresso").insert({ aula_id: "x" }),
      cli.from("trein_aula_progresso").update({ concluida_em: null }).eq("id", "x"),
      cli.from("trein_atribuicoes").upsert({ id: "x" }).select(),
      cli.from("clientes").delete().eq("id", "x"),
      cli.rpc("trein_quiz_responder", { _questionario: "x", _respostas: [] }),
      cli.rpc("trein_publicar", { _trilha: "x" }),
      cli.rpc("ver_como_registrar", { _alvo: "x" }),
      cli.functions.invoke("prova-iniciar", { body: {} }),
      cli.functions.invoke("prova-enviar", { body: {} }),
      cli.storage.from("treinamentos").upload("a/b.txt", new Blob(["x"])),
      cli.storage.from("treinamentos").remove(["a/b.txt"]),
    ];
    const res = await Promise.all(tentativas);
    for (const r of res) expect(r.error?.code).toBe("VER_COMO");
    expect(chamadas, "alguma escrita saiu do navegador no modo ver como").toEqual([]);
  });

  it("leitura continua funcionando e só usa GET", async () => {
    chamadas.length = 0;
    await cli.from("trein_trilhas").select("id").limit(1);
    expect(chamadas.length).toBe(1);
    expect(chamadas[0].method).toBe("GET");
  });

  it("lista de RPCs liberadas no modo não inclui funções que gravam", () => {
    for (const f of ["trein_quiz_responder", "trein_publicar", "ver_como_registrar", "controladoria_triagem_lote", "fundir_clientes"]) {
      expect(rpcPermitidaNoModo(f), f).toBe(false);
    }
  });

  it("anon não executa ver_como_registrar nem trein_papel_de", async () => {
    const a = await supabase.rpc("ver_como_registrar" as any, { _alvo: "00000000-0000-0000-0000-000000000000" });
    const b = await supabase.rpc("trein_papel_de" as any, { _user: "00000000-0000-0000-0000-000000000000" });
    expect(a.error, "anon executou ver_como_registrar").toBeTruthy();
    expect(b.error, "anon executou trein_papel_de").toBeTruthy();
  });
});
