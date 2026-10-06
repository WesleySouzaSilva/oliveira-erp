import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logIaConsumo, callClaude } from "../_shared/ia-claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function headerSafe(value: string | undefined | null) {
  return (value || "").trim().replace(/[^\x20-\x7E]/g, "");
}

const ROUTES = [
  { path: "/", titulo: "Dashboard", descricao: "Visão geral" },
  { path: "/meus-laudos", titulo: "Meus Laudos", descricao: "Laudos técnicos" },
  { path: "/novo-laudo", titulo: "Novo Laudo", descricao: "Iniciar laudo (7 etapas)" },
  { path: "/clientes", titulo: "Clientes (CRM)", descricao: "Produtores rurais" },
  { path: "/novo-cliente", titulo: "Novo Cliente", descricao: "Cadastrar produtor" },
  { path: "/processos", titulo: "Processos", descricao: "Alongamento (5 fases)" },
  { path: "/vencimentos", titulo: "Vencimentos", descricao: "Calendário de vencimentos" },
  { path: "/acordos", titulo: "Acordos", descricao: "Acordos firmados" },
  { path: "/peticoes", titulo: "Petições", descricao: "Banco de petições" },
  { path: "/agenda", titulo: "Agenda", descricao: "Calendário" },
  { path: "/tarefas", titulo: "Tarefas", descricao: "Lista de tarefas" },
  { path: "/templates", titulo: "Templates", descricao: "Modelos de laudo" },
  { path: "/dados-climaticos", titulo: "Dados Climáticos", descricao: "INMET / NASA POWER" },
  { path: "/feed", titulo: "Feed", descricao: "Atualizações" },
  { path: "/notificacoes", titulo: "Notificações", descricao: "Avisos" },
  { path: "/equipe", titulo: "Equipe", descricao: "Membros" },
  { path: "/gestao-geral", titulo: "Gestão Geral", descricao: "Painel admin" },
  { path: "/gestao-rh", titulo: "Gestão de Pessoas", descricao: "RH" },
  { path: "/gestao-comercial", titulo: "Gestão Comercial", descricao: "Pipeline" },
  { path: "/metricas", titulo: "Métricas", descricao: "Dashboard executivo" },
  { path: "/metricas/overview-marketing", titulo: "Métricas — Marketing", descricao: "Meta Ads" },
  { path: "/metricas/overview-comercial", titulo: "Métricas — Comercial", descricao: "Funil" },
  { path: "/metricas/marketing", titulo: "Lançamento de Marketing", descricao: "Dados diários" },
  { path: "/metricas/comercial", titulo: "Lançamento Comercial", descricao: "Diário" },
  { path: "/metricas/leads-diarios", titulo: "Leads Diários", descricao: "Por dia" },
  { path: "/metricas/metas", titulo: "Metas", descricao: "Metas e ranking" },
  { path: "/metricas/contratos-fechados", titulo: "Contratos Fechados", descricao: "Histórico" },
  { path: "/configuracoes", titulo: "Configurações", descricao: "Perfil" },
  { path: "/ajuda", titulo: "Ajuda", descricao: "Central de ajuda" },
];

const SYSTEM_BASE = `Você é a Olívia, assistente oficial da Oliveira Agro — plataforma de reestruturação rural especializada em laudos técnicos (Manual de Crédito Rural — MCR 2.6.4), análise de abusividade contratual, defesas judiciais e alongamento de dívidas agrícolas. Atende escritórios de agronomia e advocacia que trabalham com produtores rurais.

# Identidade e tom
- Persona feminina, profissional, cordial e direta. Linguagem do agro: "produtor", "safra", "perda", "renegociação".
- Frases curtas. Sem floreio, sem emoji, sem markdown decorativo (use **negrito** apenas em nome de cliente ou número de laudo quando ajudar a leitura).
- Use 1ª pessoa: "te levo até lá", "criei a tarefa", "encontrei 3 vencimentos".
- Slogan da marca (não repetir em toda mensagem, apenas quando relevante): "Se é Agro, começa aqui".

# Saudação (regra rígida)
- PRIMEIRA mensagem da conversa: comece EXATAMENTE com "Olá! Sou a Olívia, assistente oficial da Oliveira Agro." e em seguida responda.
- Demais mensagens: NUNCA se apresente, NUNCA repita "Olá", responda direto.

# Domínio (use isto para entender o usuário)
## Laudo técnico (MCR 2.6.4)
Documento que comprova perda de receita do produtor por evento climático/biológico, base para renegociação bancária. Tem 7 etapas no Wizard:
  1) Identificação do produtor e propriedade
  2) Culturas, áreas e produtividade esperada vs. obtida
  3) Evento causador (estiagem, geada, granizo, praga) + período + decretos
  4) Dados climáticos (INMET / NASA POWER) e NDVI
  5) Cálculo de perda (% e R$) e receita bruta projetada
  6) Contratos vinculados (banco, número, saldo, vencimento)
  7) Conclusão técnica + assinatura A1
Resultado: PDF Parte I (Perda) e Parte II (Capacidade de pagamento). Saída também em DOCX.

## Processo de alongamento (5 fases)
  Fase 1 — Laudo pronto e protocolado
  Fase 2 — Notificação extrajudicial ao banco
  Fase 3 — Negociação administrativa
  Fase 4 — Ação judicial (petições do banco de modelos)
  Fase 5 — Acordo / sentença
Cada fase tem prazo de até 15 dias bancários; alertas automáticos disparam em D-3.

## Abusividade contratual
Análise comparando taxas do contrato vs. tetos legais (Resolução BACEN, Selic, MCR). Sinaliza juros, mora, comissão de permanência, capitalização e tarifas abusivas. Base para defesa/revisional.

## Outras áreas
- CRM (clientes/produtores), Drive do cliente (arquivos), Vencimentos (3 marcos: vencimento original, prorrogado, judicial), Acordos, Petições (banco modular com IA), Agenda, Tarefas, Templates de conclusão.
- Métricas: Marketing (Meta Ads, leads pagos/orgânicos), Comercial (funil, contratos fechados, metas por closer/SDR, ranking).
- RH: somente admin/setor RH (módulo restrito).

## Módulos além do Agro (existem e você DEVE reconhecê-los)
- Consultoria Empresarial: carteira de empresas cliente (\`/consultoria/empresas\`), avenças mensais e Central de Demandas Internas (\`/consultoria/demandas\`). MRR = soma dos valores mensais das avenças ativas — dado RESTRITO (só CEO/admin/coordenador).
- Demandas Gerais: causas avulsas de áreas diversas do jurídico (\`/causas\`), com prazo próprio integrado à Central de Vencimentos.
- Financeiro (CEO): receitas, despesas e saldo consolidados (\`/financeiro\`, \`/financeiro/lancamentos\`). Acesso RESTRITO ao CEO.
- Acordos: agro (\`/acordos\`, produtores) e empresarial (dentro de \`/consultoria/empresas/:id\`). Valores monetários dos acordos são sensíveis — não exponha valor_acordo nem valor_causa mesmo quando aparecerem em cache; foque em prazos, status e responsáveis.

## Papéis
admin · agronomo · advogado · comercial · closer · sdr · marketing · social_seller · rh · financeiro. Permissões setoriais aplicam — não prometa acesso a área que o usuário não vê.

# Suas 4 capacidades
1) NAVEGAR — \`navegar_para\` quando o usuário pedir para abrir/ver/ir a uma tela.
2) CONSULTAR — \`consultar_dados\` antes de responder qualquer "quantos / liste / mostre / qual o status / tem algum...". NUNCA invente números.
3) CRIAR — \`criar_tarefa\`, \`criar_lead_comercial\`, \`registrar_atividade_cliente\`, \`criar_lembrete_vencimento\`.
4) EXPLICAR — dúvidas curtas de uso da plataforma e de domínio (MCR, abusividade, fases). Máx. 4 linhas.

# Roteamento de intenção (siga rigorosamente)
| Frase do usuário                                          | Ação                                       |
|-----------------------------------------------------------|--------------------------------------------|
| "abrir laudos", "vai pra clientes", "me leva pra agenda"  | navegar_para                               |
| "quantos laudos esse mês", "liste vencimentos da semana"  | consultar_dados → responda com número      |
| "tenho algum vencimento hoje?", "qual o último laudo?"    | consultar_dados → responda                 |
| "buscar cliente João da Silva"                            | consultar_dados (buscar_cliente)           |
| "cria tarefa de ligar pro Joaquim sexta"                  | criar_tarefa (pergunte data se ambígua)    |
| "registra que falei com a Maria hoje sobre o contrato"    | registrar_atividade_cliente                |
| "lembrar do vencimento do Banco do Brasil dia 30"         | criar_lembrete_vencimento                  |
| "novo lead: Fazenda Boa Esperança, soja, MT"              | criar_lead_comercial                       |
| "como gero um laudo?", "o que é MCR 2.6.4?"               | EXPLICAR curto, sem tool                   |
| "panorama do cliente X", "resumo do produtor Y"           | consultar_dados(panorama_cliente)          |
| "como tá o funil?", "quantos leads em proposta?"          | consultar_dados(leads_funil)               |
| "ranking de vendas do mês", "quem vendeu mais"            | consultar_dados(ranking_comercial)         |
| "vencimentos atrasados", "o que venceu e não pagou?"      | consultar_dados(vencimentos_vencidos)      |
| "tarefas de hoje", "minha agenda hoje"                    | consultar_dados(tarefas_do_dia)            |
| "processos por fase", "como tão os alongamentos"          | consultar_dados(processos_por_fase)        |
| "petições recentes"                                       | consultar_dados(peticoes_recentes)         |
| "marcar tarefa X como feita"                              | tarefas_pendentes → marcar_tarefa_concluida|
| "avançar processo do Joaquim pra fase 3"                  | buscar processo → avancar_fase_processo    |
| "vencimento do BB do João foi pago"                       | vencimentos_proximos → marcar_vencimento_pago |
| "marca reunião com Maria sexta às 10h"                    | agendar_reuniao                            |
| "registra acordo de 50 mil com Pedro pra dia 30"          | registrar_acordo_tarefa                    |
| "como tá a semana?", "compara com semana passada"         | consultar_dados(insights_semanais)         |
| "estou batendo a meta?", "progresso das metas"            | consultar_dados(progresso_metas)           |
| "clientes pra consolidar laudo", "quem tem 2+ contratos"  | consultar_dados(clientes_para_consolidar)  |
| "por que tamo perdendo?", "top motivos de perda"          | consultar_dados(top_motivos_perda)         |
| "gera o laudo de perda do Silva", "monta laudo do João"   | buscar laudo → gerar_laudo                 |
| "gera petição de alongamento pro processo do Pedro"       | buscar processo → gerar_peticao            |
| "analisa abusividade do contrato do João no BB"           | analisar_abusividade                       |
| "quantas empresas na consultoria", "carteira de avenças"  | consultar_dados(contar_empresas|carteira_empresas) |
| "demandas abertas da consultoria", "o que tá pendente pras empresas" | consultar_dados(demandas_consultoria) |
| "qual o MRR", "faturamento recorrente das avenças"        | consultar_dados(mrr_consultoria) [restrito CEO/coord] |
| "causas avulsas em aberto", "demandas gerais"             | consultar_dados(contar_causas|causas_avulsas) |
| "resumo financeiro do mês", "receita x despesa"           | consultar_dados(financeiro_resumo) [restrito CEO] |
| "acordos pendentes", "acordos das empresas"               | consultar_dados(acordos_agro|acordos_empresa) |

# Análise (quando o usuário pedir insights)
- Ao receber insights_semanais: comente variações > ±10% e aponte O QUE FAZER ("Sua taxa SQL→Proposta caiu 18% — vale revisar a abordagem em propostas").
- Ao receber progresso_metas: destaque quem está abaixo de 50% e quem passou de 100%; sugira foco.
- Ao receber clientes_para_consolidar: sugira agendar visita e gerar laudo único.

# Boas práticas
- Pré-checagem: se faltar título, data ou nome de cliente para criar algo, PERGUNTE em 1 linha antes de chamar a tool.
- Datas naturais ("amanhã", "sexta", "fim do mês") → converta para YYYY-MM-DD no payload da tool.
- Após \`consultar_dados\`, responda com o número/lista direto — não fale "vou consultar".
- Após criar algo, confirme em 1 frase: "Pronto, criei a tarefa 'Ligar pro Joaquim' para 28/05." e, quando útil, ofereça abrir a tela ("Quer que eu te leve até lá?").
- Se o pedido é ambíguo entre 2 telas, ofereça as 2 opções numeradas.
- Quando o usuário cita um produtor pelo nome, prefira \`buscar_cliente\` antes de qualquer criação que precise de cliente_id.
- Cite "Fonte N" apenas quando o RAG retornar conhecimento usado na resposta.

# Anti-padrões (NUNCA)
- Nunca prometa acesso a dados de outra organização (RLS bloqueia).
- Nunca diga "vou verificar" sem chamar a tool no mesmo turno.
- Nunca invente número de laudo, CPF, saldo de contrato, taxa de juros.
- Nunca peça ao usuário para digitar dados que você consegue puxar via \`consultar_dados\`.
- Nunca se apresente fora da primeira mensagem.
- Se \`consultar_dados\` retornar \`{ erro: "sem_permissao" }\`, explique com naturalidade que aquela informação é restrita ao CEO/coordenação e NÃO tente contornar (não chame a mesma tool de novo, não bata em outra tabela buscando o mesmo valor).
- Nunca exponha valores monetários de acordos (\`valor_acordo\`) nem de causas (\`valor_causa\`) na resposta ao usuário comum.
- Nunca escreva blocos longos quando 2 frases bastam.

# Rotas conhecidas
${ROUTES.map(r => `- ${r.path} — ${r.titulo}: ${r.descricao}`).join("\n")}
`;

const tools = [
  {
    name: "navegar_para",
    description: "Leva o usuário para uma rota.",
    input_schema: {
      type: "object",
      properties: {
        rota: { type: "string" },
        motivo: { type: "string" },
      },
      required: ["rota"],
    },
  },
  {
    name: "consultar_dados",
    description: "Consulta dados respeitando RLS.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: [
            "contar_laudos", "contar_clientes", "contar_processos",
            "vencimentos_proximos", "laudos_recentes", "clientes_recentes",
            "buscar_cliente", "tarefas_pendentes", "metricas_periodo",
            "processos_por_fase", "leads_funil", "peticoes_recentes",
            "panorama_cliente", "ranking_comercial", "tarefas_do_dia",
            "vencimentos_vencidos",
            "insights_semanais", "progresso_metas", "clientes_para_consolidar",
            "top_motivos_perda",
            "contar_empresas", "carteira_empresas", "demandas_consultoria", "mrr_consultoria",
            "contar_causas", "causas_avulsas",
            "financeiro_resumo",
            "acordos_agro", "acordos_empresa",
          ],
        },
        params: { type: "object" },
      },
      required: ["tipo"],
    },
  },
  {
    name: "marcar_tarefa_concluida",
    description: "Marca uma tarefa existente como concluída. Use depois de buscar pelo título via consultar_dados(tarefas_pendentes) e obter o id.",
    input_schema: {
      type: "object",
      properties: {
        tarefa_id: { type: "string", description: "UUID da tarefa" },
      },
      required: ["tarefa_id"],
    },
  },
  {
    name: "avancar_fase_processo",
    description: "Avança a fase de um processo de alongamento (1→5). Use depois de identificar o processo (pelo nome do cliente ou número do laudo via consultar_dados).",
    input_schema: {
      type: "object",
      properties: {
        processo_id: { type: "string", description: "UUID do processo" },
        nova_fase: { type: "integer", description: "1 a 5" },
        observacao: { type: "string" },
      },
      required: ["processo_id", "nova_fase"],
    },
  },
  {
    name: "marcar_vencimento_pago",
    description: "Marca um contrato de vencimento como resolvido/pago. Use depois de consultar_dados(vencimentos_proximos|vencimentos_vencidos) para obter o id.",
    input_schema: {
      type: "object",
      properties: {
        contrato_id: { type: "string", description: "UUID do registro em contratos_vencimentos" },
        motivo: { type: "string", description: "Ex.: 'pago', 'renegociado', 'quitado'" },
      },
      required: ["contrato_id"],
    },
  },
  {
    name: "agendar_reuniao",
    description: "Cria uma tarefa de reunião com data, hora e cliente. Atalho para reuniões marcadas no chat.",
    input_schema: {
      type: "object",
      properties: {
        nome_cliente: { type: "string" },
        titulo: { type: "string", description: "Ex.: 'Reunião com produtor sobre alongamento'" },
        data: { type: "string", description: "YYYY-MM-DD" },
        hora: { type: "string", description: "HH:mm (opcional)" },
        observacoes: { type: "string" },
      },
      required: ["titulo", "data"],
    },
  },
  {
    name: "registrar_acordo_tarefa",
    description: "Registra uma tarefa de acompanhamento de acordo firmado (cobrança, follow-up). Para contratos já em fase de acordo.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        nome_cliente: { type: "string" },
        data_vencimento: { type: "string", description: "YYYY-MM-DD" },
        valor_acordo: { type: "number" },
        prioridade: { type: "string", enum: ["baixa", "normal", "alta", "urgente"] },
        observacoes: { type: "string" },
      },
      required: ["titulo", "data_vencimento"],
    },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma tarefa na agenda do usuário logado.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        descricao: { type: "string" },
        data_vencimento: { type: "string", description: "YYYY-MM-DD" },
        prioridade: { type: "string", enum: ["baixa", "normal", "alta", "urgente"] },
        nome_cliente: { type: "string" },
      },
      required: ["titulo", "data_vencimento"],
    },
  },
  {
    name: "criar_lead_comercial",
    description: "Registra um novo lead no funil comercial.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        telefone: { type: "string" },
        email: { type: "string" },
        origem: { type: "string" },
        etapa_funil: { type: "string", enum: ["mql", "sql", "reuniao", "proposta", "fechado", "perdido"] },
        valor_estimado: { type: "number" },
        observacoes: { type: "string" },
      },
      required: ["nome"],
    },
  },
  {
    name: "registrar_atividade_cliente",
    description: "Registra uma atividade (ligação, visita, e-mail) no histórico de um cliente.",
    input_schema: {
      type: "object",
      properties: {
        nome_cliente: { type: "string" },
        tipo: { type: "string", enum: ["atendimento", "ligacao", "visita", "email", "whatsapp", "reuniao"] },
        descricao: { type: "string" },
        data_atividade: { type: "string", description: "YYYY-MM-DD" },
        banco: { type: "string" },
      },
      required: ["nome_cliente", "descricao"],
    },
  },
  {
    name: "criar_lembrete_vencimento",
    description: "Cria um registro de vencimento de contrato para acompanhamento.",
    input_schema: {
      type: "object",
      properties: {
        nome_cliente: { type: "string" },
        banco: { type: "string" },
        numero_contrato: { type: "string" },
        vencimento_proxima_parcela: { type: "string", description: "YYYY-MM-DD" },
        valor_parcela: { type: "number" },
        observacoes: { type: "string" },
      },
      required: ["nome_cliente", "vencimento_proxima_parcela"],
    },
  },
  {
    name: "gerar_laudo",
    description: "Dispara a geração de conteúdo de um laudo técnico (perda de safra ou capacidade de pagamento) usando IA. Use depois de identificar o laudo via consultar_dados. Salva o conteúdo no laudo e retorna link para visualização.",
    input_schema: {
      type: "object",
      properties: {
        laudo_id: { type: "string", description: "UUID do laudo" },
        tipo: { type: "string", enum: ["perda", "capacidade"], description: "Tipo de laudo" },
      },
      required: ["laudo_id", "tipo"],
    },
  },
  {
    name: "gerar_peticao",
    description: "Abre o processo com geração de petição pré-selecionada. Use depois de identificar o processo.",
    input_schema: {
      type: "object",
      properties: {
        processo_id: { type: "string", description: "UUID do processo" },
        tipo_peticao: {
          type: "string",
          enum: ["pedido_administrativo", "acao_revisional", "acao_de_alongamento", "defesa_execucao", "tutela_urgencia"],
        },
      },
      required: ["processo_id", "tipo_peticao"],
    },
  },
  {
    name: "analisar_abusividade",
    description: "Analisa abusividade de contratos de crédito rural usando IA. Retorna parecer técnico curto sobre taxas, capitalização, IOF e tarifas. Aceita nome_cliente (busca contratos) ou lista manual.",
    input_schema: {
      type: "object",
      properties: {
        nome_cliente: { type: "string" },
        contratos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              banco: { type: "string" },
              numero_contrato: { type: "string" },
              taxa_juros: { type: "number" },
              valor: { type: "number" },
              prazo_meses: { type: "integer" },
              modalidade: { type: "string" },
            },
          },
        },
      },
    },
  },
];

const openAiTools = tools.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}));

async function executarConsulta(supabase: any, tipo: string, params: any = {}, userId?: string, orgId?: string | null) {
  const limit = Math.min(params.limit || 10, 50);
  switch (tipo) {
    case "contar_laudos": {
      const [{ data: laudos }, { data: processos }] = await Promise.all([
        supabase.from("laudos").select("id, status, dados_etapa1").is("deleted_at", null),
        supabase.from("processos").select("laudo_id"),
      ]);
      const processoLaudoIds = new Set((processos || []).map((p: any) => p.laudo_id).filter(Boolean));
      const visiveis = (laudos || []).filter((l: any) => {
        const d = (l.dados_etapa1 || {}) as Record<string, any>;
        const nome = (d.nome || d.nomeProdutor || d.produtor || "").trim();
        const isShellEmpty = processoLaudoIds.has(l.id) && !nome && l.status === "rascunho";
        return !isShellEmpty;
      });
      return {
        total_laudos: visiveis.length,
        finalizados: visiveis.filter((l: any) => l.status === "finalizado" || l.status === "exportado").length,
        rascunhos: visiveis.filter((l: any) => l.status === "rascunho").length,
      };
    }
    case "contar_clientes": {
      const { count } = await supabase.from("clientes").select("*", { count: "exact", head: true }).is("deleted_at", null);
      return { total_clientes: count ?? 0 };
    }
    case "contar_processos": {
      const { data } = await supabase.from("processos").select("status");
      const por_status: Record<string, number> = {};
      (data || []).forEach((r: any) => { por_status[r.status || "indef"] = (por_status[r.status || "indef"] || 0) + 1; });
      return { total: (data || []).length, por_status };
    }
    case "vencimentos_proximos": {
      const dias = params.dias || 15;
      const hoje = new Date().toISOString().slice(0, 10);
      const fim = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("contratos_vencimentos")
        .select("nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_parcela")
        .gte("vencimento_proxima_parcela", hoje).lte("vencimento_proxima_parcela", fim)
        .order("vencimento_proxima_parcela").limit(limit);
      return { proximos_vencimentos: data || [], janela_dias: dias };
    }
    case "laudos_recentes": {
      const [{ data }, { data: processos }] = await Promise.all([
        supabase
        .from("laudos").select("id, numero_laudo, status, created_at, dados_etapa1")
          .is("deleted_at", null).order("created_at", { ascending: false }).limit(Math.max(limit * 3, 30)),
        supabase.from("processos").select("laudo_id"),
      ]);
      const processoLaudoIds = new Set((processos || []).map((p: any) => p.laudo_id).filter(Boolean));
      return { laudos: (data || []).filter((l: any) => {
        const d = (l.dados_etapa1 || {}) as Record<string, any>;
        const nome = (d.nome || d.nomeProdutor || d.produtor || "").trim();
        const isShellEmpty = processoLaudoIds.has(l.id) && !nome && l.status === "rascunho";
        return !isShellEmpty;
      }).slice(0, limit).map((l: any) => ({
        id: l.id, numero: l.numero_laudo, status: l.status,
        produtor: l.dados_etapa1?.nomeProdutor || l.dados_etapa1?.nome || "—",
        criado_em: l.created_at,
      })) };
    }
    case "clientes_recentes": {
      const { data } = await supabase
        .from("clientes").select("id, nome, telefone, municipio, uf, created_at")
        .is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
      return { clientes: data || [] };
    }
    case "buscar_cliente": {
      if (!params.busca) return { erro: "Informe 'busca' com o nome do cliente" };
      const { data } = await supabase.rpc("search_clientes_norm", { q: params.busca });
      return { resultados: (data || []).slice(0, limit) };
    }
    case "tarefas_pendentes": {
      const { data } = await supabase
        .from("tarefas").select("id, titulo, data_vencimento, prioridade, nome_cliente")
        .eq("concluida", false).order("data_vencimento", { ascending: true }).limit(limit);
      return { tarefas: data || [] };
    }
    case "metricas_periodo": {
      const dias = params.dias || 30;
      const inicio = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
      const fim = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.rpc("mkt_dashboard_agregado", { p_inicio: inicio, p_fim: fim, p_nichos: null });
      return { janela: { inicio, fim }, totais: data?.totais || {} };
    }
    case "processos_por_fase": {
      const { data } = await supabase.from("processos").select("fase_atual").is("deleted_at", null);
      const por_fase: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
      (data || []).forEach((r: any) => {
        const k = String(r.fase_atual ?? "?");
        por_fase[k] = (por_fase[k] || 0) + 1;
      });
      return { total: (data || []).length, por_fase };
    }
    case "leads_funil": {
      const { data } = await supabase.from("comercial_leads").select("etapa_funil, valor_estimado");
      const por_etapa: Record<string, { qtd: number; valor: number }> = {};
      (data || []).forEach((r: any) => {
        const k = r.etapa_funil || "mql";
        if (!por_etapa[k]) por_etapa[k] = { qtd: 0, valor: 0 };
        por_etapa[k].qtd += 1;
        por_etapa[k].valor += Number(r.valor_estimado || 0);
      });
      return { total: (data || []).length, por_etapa };
    }
    case "peticoes_recentes": {
      const { data } = await supabase.from("peticoes")
        .select("id, titulo, tipo, status, created_at")
        .is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
      return { peticoes: data || [] };
    }
    case "panorama_cliente": {
      if (!params.busca) return { erro: "Informe 'busca' com o nome do cliente" };
      const { data: rs } = await supabase.rpc("search_clientes_norm", { q: params.busca });
      const cliente = (rs || [])[0];
      if (!cliente) return { erro: "Cliente não encontrado" };
      const nome = cliente.nome;
      const [vencRes, tarRes, atvRes] = await Promise.all([
        supabase.from("contratos_vencimentos").select("banco, numero_contrato, vencimento_proxima_parcela, valor_parcela")
          .eq("nome_cliente", nome).order("vencimento_proxima_parcela").limit(10),
        supabase.from("tarefas").select("id, titulo, data_vencimento, concluida")
          .eq("nome_cliente", nome).eq("concluida", false).order("data_vencimento").limit(10),
        supabase.from("atividades_clientes").select("tipo, descricao, data_atividade, banco")
          .eq("nome_cliente", nome).order("data_atividade", { ascending: false }).limit(5),
      ]);
      return {
        cliente: { id: cliente.id, nome, telefone: cliente.telefone, municipio: cliente.municipio, uf: cliente.uf },
        vencimentos: vencRes.data || [],
        tarefas_abertas: tarRes.data || [],
        ultimas_atividades: atvRes.data || [],
      };
    }
    case "ranking_comercial": {
      const dias = params.dias || 30;
      const inicio = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from("comercial_leads")
        .select("responsavel_id, valor_estimado, etapa_funil, data_fechamento")
        .eq("etapa_funil", "fechado")
        .gte("data_fechamento", inicio);
      const por_resp: Record<string, { qtd: number; valor: number }> = {};
      (data || []).forEach((r: any) => {
        const k = r.responsavel_id || "sem_responsavel";
        if (!por_resp[k]) por_resp[k] = { qtd: 0, valor: 0 };
        por_resp[k].qtd += 1;
        por_resp[k].valor += Number(r.valor_estimado || 0);
      });
      const ranking = Object.entries(por_resp)
        .map(([id, v]) => ({ responsavel_id: id, ...v }))
        .sort((a, b) => b.valor - a.valor);
      return { janela_dias: dias, ranking };
    }
    case "tarefas_do_dia": {
      const dia = params.data || new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("tarefas")
        .select("id, titulo, prioridade, concluida, nome_cliente")
        .eq("data_vencimento", dia).order("prioridade", { ascending: false });
      return { data: dia, tarefas: data || [] };
    }
    case "vencimentos_vencidos": {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("contratos_vencimentos")
        .select("nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_parcela")
        .lt("vencimento_proxima_parcela", hoje)
        .order("vencimento_proxima_parcela", { ascending: false }).limit(limit);
      return { vencidos: data || [], referencia: hoje };
    }
    case "insights_semanais": {
      const hoje = new Date();
      const fim = hoje.toISOString().slice(0, 10);
      const semAtual = new Date(hoje.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const semAnt = new Date(hoje.getTime() - 14 * 86400000).toISOString().slice(0, 10);
      const [atualRes, antRes] = await Promise.all([
        supabase.from("mkt_lancamentos_diarios")
          .select("leads_pagos, leads_organicos, leads_qualificados_sdr, reunioes_realizadas, propostas_enviadas, contratos_fechados, receita_fechada, investimento")
          .gte("data", semAtual).lte("data", fim),
        supabase.from("mkt_lancamentos_diarios")
          .select("leads_pagos, leads_organicos, leads_qualificados_sdr, reunioes_realizadas, propostas_enviadas, contratos_fechados, receita_fechada, investimento")
          .gte("data", semAnt).lt("data", semAtual),
      ]);
      const sum = (rows: any[], k: string) => (rows || []).reduce((s, r) => s + Number(r[k] || 0), 0);
      const calc = (rows: any[]) => {
        const leads = sum(rows, "leads_pagos") + sum(rows, "leads_organicos");
        const sql = sum(rows, "leads_qualificados_sdr");
        const reuns = sum(rows, "reunioes_realizadas");
        const props = sum(rows, "propostas_enviadas");
        const fech = sum(rows, "contratos_fechados");
        const receita = sum(rows, "receita_fechada");
        const invest = sum(rows, "investimento");
        return {
          leads, sql, reunioes: reuns, propostas: props, contratos: fech,
          receita, investimento: invest,
          taxa_lead_sql: leads ? +(sql / leads * 100).toFixed(1) : 0,
          taxa_sql_proposta: sql ? +(props / sql * 100).toFixed(1) : 0,
          taxa_proposta_fechado: props ? +(fech / props * 100).toFixed(1) : 0,
          roi: invest ? +(receita / invest).toFixed(2) : 0,
        };
      };
      const a = calc(atualRes.data || []); const b = calc(antRes.data || []);
      const diff = (atual: number, ant: number) => ant ? +(((atual - ant) / ant) * 100).toFixed(1) : null;
      return {
        semana_atual: { de: semAtual, ate: fim, ...a },
        semana_anterior: { de: semAnt, ate: semAtual, ...b },
        variacao_pct: {
          leads: diff(a.leads, b.leads),
          contratos: diff(a.contratos, b.contratos),
          receita: diff(a.receita, b.receita),
          taxa_sql_proposta: diff(a.taxa_sql_proposta, b.taxa_sql_proposta),
        },
      };
    }
    case "progresso_metas": {
      const hoje = new Date();
      const ano = hoje.getFullYear(); const mes = hoje.getMonth() + 1;
      const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const [metasRes, lancRes] = await Promise.all([
        supabase.from("mkt_metas_individuais")
          .select("membro_user_id, meta_contratos, meta_receita, meta_reunioes_realizadas, meta_leads_qualificados")
          .eq("ano", ano).eq("mes", mes),
        supabase.from("mkt_lancamentos_diarios")
          .select("closer_id, sdr_id, contratos_fechados, receita_fechada, reunioes_realizadas, leads_qualificados_sdr")
          .gte("data", inicioMes),
      ]);
      const lancs = lancRes.data || [];
      const realizadoPor = (uid: string) => {
        const rows = lancs.filter(l => l.closer_id === uid || l.sdr_id === uid);
        return {
          contratos: rows.reduce((s, r) => s + Number(r.contratos_fechados || 0), 0),
          receita: rows.reduce((s, r) => s + Number(r.receita_fechada || 0), 0),
          reunioes: rows.reduce((s, r) => s + Number(r.reunioes_realizadas || 0), 0),
          leads_qualificados: rows.reduce((s, r) => s + Number(r.leads_qualificados_sdr || 0), 0),
        };
      };
      const progresso = (metasRes.data || []).map((m: any) => {
        const r = realizadoPor(m.membro_user_id);
        return {
          membro_user_id: m.membro_user_id,
          contratos: { meta: m.meta_contratos, atual: r.contratos, pct: m.meta_contratos ? +(r.contratos / m.meta_contratos * 100).toFixed(1) : 0 },
          receita: { meta: m.meta_receita, atual: r.receita, pct: m.meta_receita ? +(r.receita / Number(m.meta_receita) * 100).toFixed(1) : 0 },
          reunioes: { meta: m.meta_reunioes_realizadas, atual: r.reunioes, pct: m.meta_reunioes_realizadas ? +(r.reunioes / m.meta_reunioes_realizadas * 100).toFixed(1) : 0 },
        };
      });
      return { mes: `${ano}-${String(mes).padStart(2, "0")}`, progresso };
    }
    case "clientes_para_consolidar": {
      const hoje = new Date().toISOString().slice(0, 10);
      const futuro = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from("contratos_vencimentos")
        .select("nome_cliente, banco, vencimento_proxima_parcela, valor_parcela, possui_laudo")
        .eq("resolvido", false).gte("vencimento_proxima_parcela", hoje).lte("vencimento_proxima_parcela", futuro);
      const grupos: Record<string, { contratos: any[]; bancos: Set<string>; sem_laudo: number; valor_total: number }> = {};
      (data || []).forEach((c: any) => {
        const k = c.nome_cliente;
        if (!grupos[k]) grupos[k] = { contratos: [], bancos: new Set(), sem_laudo: 0, valor_total: 0 };
        grupos[k].contratos.push(c);
        if (c.banco) grupos[k].bancos.add(c.banco);
        if (!c.possui_laudo) grupos[k].sem_laudo += 1;
        grupos[k].valor_total += Number(c.valor_parcela || 0);
      });
      const candidatos = Object.entries(grupos)
        .filter(([_, g]) => g.contratos.length >= 2 && g.sem_laudo >= 2)
        .map(([nome, g]) => ({
          nome_cliente: nome,
          qtd_contratos: g.contratos.length,
          bancos: Array.from(g.bancos),
          sem_laudo: g.sem_laudo,
          valor_total_parcelas: g.valor_total,
        }))
        .sort((a, b) => b.qtd_contratos - a.qtd_contratos).slice(0, limit);
      return { candidatos, janela: { de: hoje, ate: futuro } };
    }
    case "top_motivos_perda": {
      const dias = params.dias || 60;
      const inicio = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
      const [perdaLeadsRes, lancRes] = await Promise.all([
        supabase.from("comercial_leads")
          .select("motivo_perda").eq("etapa_funil", "perdido").gte("updated_at", inicio).not("motivo_perda", "is", null),
        supabase.from("mkt_lancamentos_diarios")
          .select("motivo_perda_principal").gte("data", inicio).not("motivo_perda_principal", "is", null),
      ]);
      const cont: Record<string, number> = {};
      (perdaLeadsRes.data || []).forEach((r: any) => { const k = (r.motivo_perda || "").trim(); if (k) cont[k] = (cont[k] || 0) + 1; });
      (lancRes.data || []).forEach((r: any) => { const k = (r.motivo_perda_principal || "").trim(); if (k) cont[k] = (cont[k] || 0) + 1; });
      const top = Object.entries(cont).map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
      return { janela_dias: dias, top_motivos: top };
    }
    case "contar_empresas": {
      const { count } = await supabase
        .from("empresas_consultoria")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativa")
        .is("deleted_at", null);
      return { total_empresas_ativas: count ?? 0 };
    }
    case "carteira_empresas": {
      const { data } = await supabase
        .from("empresas_consultoria")
        .select("id, razao_social, nome_fantasia, status, nps, risco, ultimo_contato")
        .is("deleted_at", null)
        .order("ultimo_contato", { ascending: false, nullsFirst: false })
        .limit(limit);
      const empresas = (data || []).map((e: any) => ({
        id: e.id,
        nome: e.nome_fantasia || e.razao_social,
        status: e.status, nps: e.nps, risco: e.risco, ultimo_contato: e.ultimo_contato,
      }));
      return { empresas };
    }
    case "demandas_consultoria": {
      const hoje = new Date().toISOString().slice(0, 10);
      let q = supabase
        .from("consultoria_demandas")
        .select("id, assunto, area, prioridade, status, prazo, empresa:empresa_id(nome_fantasia, razao_social)")
        .is("deleted_at", null);
      if (params.status) q = q.eq("status", params.status);
      if (params.prioridade) q = q.eq("prioridade", params.prioridade);
      if (params.atrasadas) {
        q = q.lt("prazo", hoje).not("status", "in", "(concluida,cancelada)");
      }
      const { data } = await q.order("prazo", { ascending: true, nullsFirst: false }).limit(limit);
      const demandas = (data || []).map((d: any) => ({
        id: d.id, assunto: d.assunto, area: d.area, prioridade: d.prioridade,
        status: d.status, prazo: d.prazo,
        empresa: d.empresa?.nome_fantasia || d.empresa?.razao_social || null,
      }));
      return { demandas };
    }
    case "mrr_consultoria": {
      if (!userId || !orgId) return { erro: "sem_permissao" };
      const { data: gate } = await supabase.rpc("can_view_consultoria_financeiro", { _user_id: userId, _org_id: orgId });
      if (!gate) return { erro: "sem_permissao" };
      const { data: ativas } = await supabase
        .from("avencas").select("id").eq("status", "ativa").is("deleted_at", null);
      const ids = (ativas || []).map((a: any) => a.id);
      if (ids.length === 0) return { mrr: 0, avencas_ativas: 0 };
      const { data: valores } = await supabase
        .from("avenca_valores").select("valor_mensal").in("avenca_id", ids);
      const mrr = (valores || []).reduce((s: number, r: any) => s + Number(r.valor_mensal || 0), 0);
      return { mrr, avencas_ativas: ids.length };
    }
    case "contar_causas": {
      const { data } = await supabase
        .from("causas_avulsas").select("status").is("deleted_at", null);
      const por_status: Record<string, number> = {};
      (data || []).forEach((r: any) => { const k = r.status || "indef"; por_status[k] = (por_status[k] || 0) + 1; });
      return { total: (data || []).length, por_status };
    }
    case "causas_avulsas": {
      const hoje = new Date().toISOString().slice(0, 10);
      let q = supabase
        .from("causas_avulsas")
        .select("id, titulo, materia, cliente_nome, numero_processo, status, prazo, responsavel_id")
        .is("deleted_at", null);
      if (params.status) q = q.eq("status", params.status);
      if (params.atrasadas) {
        q = q.lt("prazo", hoje).not("status", "in", "(concluido,arquivado)");
      }
      const { data } = await q.order("prazo", { ascending: true, nullsFirst: false }).limit(limit);
      return { causas: data || [] };
    }
    case "financeiro_resumo": {
      if (!userId) return { erro: "sem_permissao" };
      const { data: gate } = await supabase.rpc("is_ceo", { uid: userId });
      if (!gate) return { erro: "sem_permissao" };
      const periodo = params.periodo || "mes";
      const hoje = new Date();
      let inicio: string;
      const fim = hoje.toISOString().slice(0, 10);
      if (periodo === "30d") inicio = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      else if (periodo === "90d") inicio = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      else if (periodo === "ano") inicio = `${hoje.getFullYear()}-01-01`;
      else inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("financeiro_lancamentos")
        .select("tipo, valor")
        .is("deleted_at", null)
        .gte("data", inicio).lte("data", fim);
      let receitas = 0, despesas = 0;
      (data || []).forEach((r: any) => {
        const v = Number(r.valor || 0);
        if (r.tipo === "receita") receitas += v; else if (r.tipo === "despesa") despesas += v;
      });
      return { periodo, janela: { de: inicio, ate: fim }, receitas, despesas, saldo: receitas - despesas };
    }
    case "acordos_agro": {
      let q = supabase
        .from("acordos_tarefas")
        .select("id, titulo, status, data_vencimento, concluida, nome_cliente");
      if (params.status) q = q.eq("status", params.status);
      if (params.pendentes) q = q.eq("concluida", false);
      const { data } = await q.order("data_vencimento", { ascending: true, nullsFirst: false }).limit(limit);
      const acordos = (data || []).map((a: any) => ({
        id: a.id, titulo: a.titulo, status: a.status,
        prazo: a.data_vencimento, concluida: a.concluida, cliente: a.nome_cliente,
      }));
      return { acordos };
    }
    case "acordos_empresa": {
      let q = supabase
        .from("empresa_acordos")
        .select("id, status, data_acordo, condicoes, empresa:empresa_id(nome_fantasia, razao_social)")
        .is("deleted_at", null);
      if (params.status) q = q.eq("status", params.status);
      const { data } = await q.order("data_acordo", { ascending: false, nullsFirst: false }).limit(limit);
      const acordos = (data || []).map((a: any) => ({
        id: a.id, status: a.status, data_acordo: a.data_acordo, condicoes: a.condicoes,
        empresa: a.empresa?.nome_fantasia || a.empresa?.razao_social || null,
      }));
      return { acordos };
    }
    default:
      return { erro: `Tipo desconhecido: ${tipo}` };
  }
}

async function executarAcao(supabase: any, userId: string, orgId: string | null, nome: string, input: any): Promise<any> {
  try {
    if (nome === "criar_tarefa") {
      if (!orgId) return { erro: "Organização não identificada" };
      const { data, error } = await supabase.from("tarefas").insert({
        organizacao_id: orgId, responsavel_id: userId, created_by: userId,
        titulo: input.titulo, descricao: input.descricao || null,
        data_vencimento: input.data_vencimento,
        prioridade: input.prioridade || "normal",
        nome_cliente: input.nome_cliente || null,
      }).select("id").maybeSingle();
      if (error) return { erro: error.message };
      return { ok: true, tarefa_id: data?.id, mensagem: `Tarefa "${input.titulo}" criada para ${input.data_vencimento}` };
    }
    if (nome === "criar_lead_comercial") {
      if (!orgId) return { erro: "Organização não identificada" };
      const { data, error } = await supabase.from("comercial_leads").insert({
        organizacao_id: orgId, responsavel_id: userId,
        nome: input.nome, telefone: input.telefone || null, email: input.email || null,
        origem: input.origem || "outro", etapa_funil: input.etapa_funil || "mql",
        valor_estimado: input.valor_estimado || 0, observacoes: input.observacoes || null,
      }).select("id").maybeSingle();
      if (error) return { erro: error.message };
      return { ok: true, lead_id: data?.id, mensagem: `Lead "${input.nome}" adicionado ao funil` };
    }
    if (nome === "registrar_atividade_cliente") {
      const { data, error } = await supabase.from("atividades_clientes").insert({
        user_id: userId, organizacao_id: orgId,
        nome_cliente: input.nome_cliente, tipo: input.tipo || "atendimento",
        descricao: input.descricao,
        data_atividade: input.data_atividade || new Date().toISOString().slice(0, 10),
        banco: input.banco || null,
      }).select("id").maybeSingle();
      if (error) return { erro: error.message };
      return { ok: true, atividade_id: data?.id, mensagem: `Atividade registrada para ${input.nome_cliente}` };
    }
    if (nome === "criar_lembrete_vencimento") {
      const { data, error } = await supabase.from("contratos_vencimentos").insert({
        user_id: userId, organizacao_id: orgId,
        nome_cliente: input.nome_cliente, banco: input.banco || null,
        numero_contrato: input.numero_contrato || null,
        vencimento_proxima_parcela: input.vencimento_proxima_parcela,
        valor_parcela: input.valor_parcela || null,
        observacoes: input.observacoes || null,
      }).select("id").maybeSingle();
      if (error) return { erro: error.message };
      return { ok: true, contrato_id: data?.id, mensagem: `Lembrete criado para ${input.nome_cliente} em ${input.vencimento_proxima_parcela}` };
    }
    if (nome === "marcar_tarefa_concluida") {
      if (!input.tarefa_id) return { erro: "tarefa_id obrigatório" };
      const { data, error } = await supabase.from("tarefas")
        .update({ concluida: true })
        .eq("id", input.tarefa_id).select("id, titulo").maybeSingle();
      if (error) return { erro: error.message };
      if (!data) return { erro: "Tarefa não encontrada ou sem permissão" };
      return { ok: true, tarefa_id: data.id, mensagem: `Tarefa "${data.titulo}" marcada como concluída` };
    }
    if (nome === "avancar_fase_processo") {
      const fase = Number(input.nova_fase);
      if (!input.processo_id || !fase || fase < 1 || fase > 5) return { erro: "processo_id e nova_fase (1-5) obrigatórios" };
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: atual } = await supabase.from("processos")
        .select("status_fases, datas_fases").eq("id", input.processo_id).maybeSingle();
      const status_fases = { ...(atual?.status_fases || {}), [fase]: "concluida" };
      const datas_fases = { ...(atual?.datas_fases || {}), [fase]: hoje };
      const { data, error } = await supabase.from("processos")
        .update({ fase_atual: fase, status_fases, datas_fases })
        .eq("id", input.processo_id).select("id").maybeSingle();
      if (error) return { erro: error.message };
      if (!data) return { erro: "Processo não encontrado ou sem permissão" };
      return { ok: true, processo_id: data.id, mensagem: `Processo avançado para Fase ${fase}` };
    }
    if (nome === "marcar_vencimento_pago") {
      if (!input.contrato_id) return { erro: "contrato_id obrigatório" };
      const { data, error } = await supabase.from("contratos_vencimentos")
        .update({ resolvido: true, motivo_resolucao: input.motivo || "pago", status_prazo: "resolvido" })
        .eq("id", input.contrato_id).select("id, nome_cliente, banco").maybeSingle();
      if (error) return { erro: error.message };
      if (!data) return { erro: "Vencimento não encontrado ou sem permissão" };
      return { ok: true, contrato_id: data.id, mensagem: `Vencimento de ${data.nome_cliente}${data.banco ? ` (${data.banco})` : ""} marcado como ${input.motivo || "pago"}` };
    }
    if (nome === "agendar_reuniao") {
      if (!orgId) return { erro: "Organização não identificada" };
      const dataIso = input.data;
      const hora = input.hora ? ` às ${input.hora}` : "";
      const titulo = `📅 ${input.titulo}${hora}`;
      const desc = [input.nome_cliente ? `Cliente: ${input.nome_cliente}` : null, input.observacoes].filter(Boolean).join("\n");
      const { data, error } = await supabase.from("tarefas").insert({
        organizacao_id: orgId, responsavel_id: userId, created_by: userId,
        titulo, descricao: desc || null, data_vencimento: dataIso,
        prioridade: "alta", nome_cliente: input.nome_cliente || null,
      }).select("id").maybeSingle();
      if (error) return { erro: error.message };
      return { ok: true, tarefa_id: data?.id, mensagem: `Reunião agendada para ${dataIso}${hora}` };
    }
    if (nome === "registrar_acordo_tarefa") {
      if (!orgId) return { erro: "Organização não identificada" };
      const { data, error } = await supabase.from("acordos_tarefas").insert({
        organizacao_id: orgId, created_by: userId, responsavel_id: userId,
        titulo: input.titulo, nome_cliente: input.nome_cliente || null,
        data_vencimento: input.data_vencimento, valor_acordo: input.valor_acordo || null,
        prioridade: input.prioridade || "normal", observacoes: input.observacoes || null,
      }).select("id").maybeSingle();
      if (error) return { erro: error.message };
      return { ok: true, acordo_id: data?.id, mensagem: `Tarefa de acordo "${input.titulo}" registrada para ${input.data_vencimento}` };
    }
    if (nome === "gerar_laudo") {
      if (!input.laudo_id || !input.tipo) return { erro: "laudo_id e tipo obrigatórios" };
      const { data: laudo, error: errLaudo } = await supabase
        .from("laudos")
        .select("id, dados_etapa1, dados_etapa2, dados_etapa3, dados_etapa4, dados_etapa5, dados_etapa6")
        .eq("id", input.laudo_id).maybeSingle();
      if (errLaudo || !laudo) return { erro: "Laudo não encontrado ou sem permissão" };
      const dados = {
        ...(laudo.dados_etapa1 || {}),
        ...(laudo.dados_etapa2 || {}),
        ...(laudo.dados_etapa3 || {}),
        ...(laudo.dados_etapa4 || {}),
        ...(laudo.dados_etapa5 || {}),
        ...(laudo.dados_etapa6 || {}),
      };
      const { data: gen, error: errGen } = await supabase.functions.invoke("gerar-laudo-completo", {
        body: { tipo: input.tipo, dados },
      });
      if (errGen) return { erro: `Falha na geração: ${errGen.message || String(errGen)}` };
      // Salva resultado mesclando no dados_etapa6
      const prevEtapa6 = (laudo as any).dados_etapa6 || {};
      const novaEtapa6 = {
        ...prevEtapa6,
        [input.tipo === "perda" ? "conteudo_perda" : "conteudo_capacidade"]: gen,
        gerado_em: new Date().toISOString(),
      };
      await supabase.from("laudos").update({
        dados_etapa6: novaEtapa6,
        status: "analise",
      }).eq("id", input.laudo_id);
      return {
        ok: true,
        laudo_id: input.laudo_id,
        rota: `/laudos`,
        mensagem: `Laudo de ${input.tipo === "perda" ? "perda de safra" : "capacidade de pagamento"} gerado com sucesso. Abra em "Meus Laudos" para revisar e baixar o PDF.`,
      };
    }
    if (nome === "gerar_peticao") {
      if (!input.processo_id || !input.tipo_peticao) return { erro: "processo_id e tipo_peticao obrigatórios" };
      const { data: proc } = await supabase.from("processos")
        .select("id, nome_cliente").eq("id", input.processo_id).maybeSingle();
      if (!proc) return { erro: "Processo não encontrado ou sem permissão" };
      return {
        ok: true,
        processo_id: proc.id,
        rota: `/peticoes?cliente=${encodeURIComponent(proc.nome_cliente || "")}&tipo=${input.tipo_peticao}`,
        mensagem: `Abrindo o módulo de petições com ${proc.nome_cliente || "o cliente"} pré-selecionado (${input.tipo_peticao.replace(/_/g, " ")}). Confirme laudo e contratos para gerar as seções.`,
      };
    }
    if (nome === "analisar_abusividade") {
      let contratos = input.contratos as any[] | undefined;
      if ((!contratos || contratos.length === 0) && input.nome_cliente) {
        const { data } = await supabase.from("contratos_vencimentos")
          .select("banco, numero_contrato, valor_parcela, valor_total_operacao, parcelas_vencidas, observacoes")
          .ilike("nome_cliente", `%${input.nome_cliente}%`)
          .limit(20);
        contratos = (data || []).map((c: any) => ({
          banco: c.banco,
          numero_contrato: c.numero_contrato,
          valor_parcela: c.valor_parcela,
          valor_total: c.valor_total_operacao,
          parcelas_vencidas: c.parcelas_vencidas,
          observacoes: c.observacoes,
        }));
      }
      if (!contratos || contratos.length === 0) {
        return { erro: "Nenhum contrato encontrado para analisar. Informe o nome do cliente ou passe a lista de contratos." };
      }
      const LOVABLE_API_KEY = headerSafe(Deno.env.get("LOVABLE_API_KEY"));
      if (!LOVABLE_API_KEY) return { erro: "IA indisponível" };
      const prompt = `Analise a abusividade dos contratos de crédito rural abaixo segundo MCR, Lei 4.595/64, Súmula 596 STF, Súmula 121 STF (anatocismo), Lei 10.931/04 e jurisprudência. Para cada contrato avalie indícios de: (1) taxa acima da praticada para crédito rural (5–12% a.a. PRONAF/BNDES; 14–18% custeio convencional); (2) capitalização mensal indevida; (3) IOF e tarifas abusivas; (4) cláusulas potencialmente abusivas. Se faltarem dados (ex.: taxa, planilha), aponte EXATAMENTE quais documentos solicitar do cliente. Seja conciso (máx 8 linhas por contrato) e termine com VEREDITO: ABUSIVO / SUSPEITO / REGULAR / INSUFICIENTE e RECOMENDAÇÃO.\n\nContratos: ${JSON.stringify(contratos, null, 2)}`;
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é especialista em revisão de contratos de crédito rural brasileiro. Responde em português, técnico mas direto." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!resp.ok) return { erro: `IA falhou: ${resp.status}` };
      const j = await resp.json();
      const parecer = j?.choices?.[0]?.message?.content || "Sem resposta.";
      // Registra como atividade
      if (input.nome_cliente) {
        await supabase.from("atividades_clientes").insert({
          user_id: userId, organizacao_id: orgId,
          nome_cliente: input.nome_cliente,
          tipo: "atendimento",
          descricao: `Análise de abusividade pela Olívia:\n\n${parecer}`,
          data_atividade: new Date().toISOString().slice(0, 10),
        });
      }
      return {
        ok: true,
        mensagem: parecer,
        contratos_analisados: contratos.length,
      };
    }
    return { erro: "Ação desconhecida" };
  } catch (e: any) {
    return { erro: e?.message || "Falha ao executar" };
  }
}

function sseSend(controller: ReadableStreamDefaultController, event: string, data: any) {
  const enc = new TextEncoder();
  controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function buscarConhecimento(supabase: any, query: string): Promise<{ contexto: string; fontes: any[] }> {
  try {
    const LOVABLE_API_KEY = headerSafe(Deno.env.get("LOVABLE_API_KEY"));
    if (!LOVABLE_API_KEY || !query || query.length < 3) return { contexto: "", fontes: [] };
    const embResp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: query,
        dimensions: 1536,
      }),
    });
    if (!embResp.ok) return { contexto: "", fontes: [] };
    const embJson = await embResp.json();
    const vec = embJson.data?.[0]?.embedding;
    if (!vec) return { contexto: "", fontes: [] };

    const { data: matches, error } = await supabase.rpc("match_olivia_conhecimento", {
      query_embedding: vec,
      match_count: 5,
      filter_categoria: null,
      filter_org: null,
    });
    if (error || !matches || matches.length === 0) return { contexto: "", fontes: [] };

    const relevantes = matches.filter((m: any) => m.similarity > 0.35);
    if (relevantes.length === 0) return { contexto: "", fontes: [] };

    const contexto = relevantes.map((m: any, i: number) =>
      `[Fonte ${i + 1}] ${m.titulo ? m.titulo + " — " : ""}${m.categoria}\n${m.conteudo}`
    ).join("\n\n---\n\n");
    const fontes = relevantes.map((m: any) => ({
      id: m.id, titulo: m.titulo, categoria: m.categoria, fonte: m.fonte, similarity: m.similarity,
    }));
    return { contexto, fontes };
  } catch (e) {
    console.error("RAG falhou", e);
    return { contexto: "", fontes: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = headerSafe(Deno.env.get("LOVABLE_API_KEY"));
    const ANTHROPIC_API_KEY = headerSafe(Deno.env.get("ANTHROPIC_API_KEY"));
    if (!ANTHROPIC_API_KEY && !LOVABLE_API_KEY) throw new Error("Nenhuma chave de IA configurada");

    // Normaliza header Authorization: remove espaços extras, quebras de linha e caracteres não-ASCII
    const rawAuth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const authHeader = rawAuth.replace(/[\r\n\t]/g, "").replace(/\s+/g, " ").trim();
    if (!/^Bearer\s+\S+/i.test(authHeader)) {
      console.warn("Authorization header ausente ou malformado", { len: rawAuth.length });
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const body = await req.json();
    const { messages, rota_atual, conversa_id: convIdInput, user_message } = body;

    // Decodifica o sub do JWT localmente (não depende de sessão viva no servidor)
    // Normaliza token: remove "Bearer", espaços, aspas e caracteres não-base64url
    const token = authHeader.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
    let userId: string | undefined;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error(`JWT inválido (${parts.length} partes)`);
      let b64 = parts[1].replace(/[^A-Za-z0-9_-]/g, "").replace(/-/g, "+").replace(/_/g, "/");
      // Padding base64
      while (b64.length % 4 !== 0) b64 += "=";
      const payload = JSON.parse(atob(b64));
      userId = typeof payload?.sub === "string" ? payload.sub : undefined;
      // Valida expiração se presente
      if (payload?.exp && typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
        console.warn("JWT expirado", { exp: payload.exp });
        userId = undefined;
      }
    } catch (e) {
      console.error("JWT decode falhou", { error: String(e), tokenLen: token.length });
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Rate limiting: 30 req/min por usuário ----
    try {
      const { data: allowed, error: rlErr } = await supabase.rpc("check_rate_limit", {
        _key: `assistente-ia:${userId}`,
        _max_requests: 30,
        _window_seconds: 60,
      });
      if (rlErr) {
        console.error("[assistente-ia] rate_limit rpc error", rlErr.message);
      } else if (allowed === false) {
        return new Response(JSON.stringify({
          error: "Muitas perguntas em pouco tempo. Aguarde um instante e tente de novo.",
          limit: 30, window_seconds: 60,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      console.error("[assistente-ia] rate_limit threw", (e as Error)?.message);
      // Fail-open: infra de rate-limit não deve derrubar o chat.
    }

    const { data: membro } = await supabase
      .from("membros")
      .select("organizacao_id, papel")
      .eq("user_id", userId)
      .maybeSingle();
    const orgId: string | null = membro?.organizacao_id || null;
    const papel: string | null = (membro as any)?.papel || null;

    // Perfil do usuário (nome, setor) e organização (nome) — para personalizar
    const [profileRes, orgRes] = await Promise.all([
      supabase.from("profiles").select("nome, setor").eq("id", userId).maybeSingle(),
      orgId
        ? supabase.from("organizacoes").select("nome").eq("id", orgId).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const nomeUsuario: string | null = (profileRes as any)?.data?.nome || null;
    const setor: string | null = (profileRes as any)?.data?.setor || null;
    const orgNome: string | null = (orgRes as any)?.data?.nome || null;
    const primeiroNome = nomeUsuario ? String(nomeUsuario).trim().split(/\s+/)[0] : null;
    const hojeISO = new Date().toISOString().slice(0, 10);

    let conversaId: string | null = convIdInput || null;
    if (!conversaId) {
      const titulo = (user_message || "Nova conversa").slice(0, 60);
      const { data: novaConv } = await supabase.from("olivia_conversas").insert({
        user_id: userId, organizacao_id: orgId, titulo,
      }).select("id").maybeSingle();
      conversaId = novaConv?.id || null;
    }

    if (conversaId && user_message) {
      await supabase.from("olivia_mensagens").insert({
        conversa_id: conversaId, user_id: userId, role: "user",
        content: user_message, rota_origem: rota_atual || null,
      });
    }

    const rotaInfo = ROUTES.find(r => rota_atual && r.path !== "/" && rota_atual.startsWith(r.path)) || ROUTES[0];

    // === Consciência da tela: resolve a ENTIDADE ABERTA a partir de rota_atual ===
    // Usa o cliente `supabase` autenticado (JWT do usuário) → RLS por organização continua valendo.
    let entidadeAberta: { tipo: string; id: string; label: string } | null = null;
    try {
      const path = String(rota_atual || "").split("?")[0].split("#")[0];
      const segs = path.split("/").filter(Boolean);
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Mapeamento (path pattern → resolver)
      // /clientes/:nome            (pode ser UUID ou nome)
      // /processos/:id
      // /consultoria/empresas/:id
      // /laudos/:id                (pode não existir no router; se não achar, ignora)
      // /causas/:id
      // /consultoria/demandas/:id
      const ref = segs[segs.length - 1];

      const match = (pattern: string[]) => {
        if (segs.length !== pattern.length) return false;
        for (let i = 0; i < pattern.length - 1; i++) if (segs[i] !== pattern[i]) return false;
        return true;
      };

      if (ref) {
        if (match(["clientes", ":ref"])) {
          const decoded = (() => { try { return decodeURIComponent(ref); } catch { return ref; } })();
          let q = supabase.from("clientes").select("id, nome").is("deleted_at", null).limit(1);
          q = UUID_RE.test(decoded) ? q.eq("id", decoded) : q.ilike("nome", decoded);
          const { data } = await q.maybeSingle();
          if (data) entidadeAberta = { tipo: "cliente", id: data.id, label: data.nome || decoded };
        } else if (match(["processos", ":ref"]) && UUID_RE.test(ref)) {
          const { data } = await supabase
            .from("processos")
            .select("id, numero_processo, laudos:laudo_id(dados_etapa1)")
            .eq("id", ref)
            .is("deleted_at", null)
            .maybeSingle();
          if (data) {
            const laudoDados: any = (data as any).laudos?.dados_etapa1 || {};
            const label = data.numero_processo
              || laudoDados?.nomeProdutor || laudoDados?.nome || `Processo ${String(data.id).slice(0, 8)}`;
            entidadeAberta = { tipo: "processo", id: data.id, label };
          }
        } else if (match(["consultoria", "empresas", ":ref"]) && UUID_RE.test(ref)) {
          const { data } = await supabase
            .from("empresas_consultoria")
            .select("id, nome_fantasia, razao_social")
            .eq("id", ref).is("deleted_at", null).maybeSingle();
          if (data) entidadeAberta = { tipo: "empresa", id: data.id, label: data.nome_fantasia || data.razao_social || "Empresa" };
        } else if (match(["laudos", ":ref"]) && UUID_RE.test(ref)) {
          const { data } = await supabase
            .from("laudos")
            .select("id, numero_laudo, dados_etapa1")
            .eq("id", ref).is("deleted_at", null).maybeSingle();
          if (data) {
            const d: any = (data as any).dados_etapa1 || {};
            const label = data.numero_laudo || d?.nomeProdutor || d?.nome || `Laudo ${String(data.id).slice(0, 8)}`;
            entidadeAberta = { tipo: "laudo", id: data.id, label };
          }
        } else if (match(["causas", ":ref"]) && UUID_RE.test(ref)) {
          const { data } = await supabase
            .from("causas_avulsas").select("id, titulo").eq("id", ref).is("deleted_at", null).maybeSingle();
          if (data) entidadeAberta = { tipo: "causa", id: data.id, label: data.titulo };
        } else if (match(["consultoria", "demandas", ":ref"]) && UUID_RE.test(ref)) {
          const { data } = await supabase
            .from("consultoria_demandas").select("id, assunto").eq("id", ref).is("deleted_at", null).maybeSingle();
          if (data) entidadeAberta = { tipo: "demanda", id: data.id, label: data.assunto };
        }
      }
    } catch (e) {
      console.warn("[assistente-ia] entidadeAberta resolve falhou:", (e as Error)?.message);
    }

    // RAG: busca conhecimento relevante baseado na mensagem do usuário
    const { contexto: ragContexto, fontes: ragFontes } = await buscarConhecimento(supabase, user_message || "");

    const convoPrev: any[] = Array.isArray(messages) ? messages : [];
    const isPrimeiraMensagem = convoPrev.filter((m: any) => m?.role === "assistant").length === 0;
    const contextoUsuario = [
      `Data de hoje: ${hojeISO}`,
      primeiroNome ? `Usuário: ${primeiroNome}${nomeUsuario && nomeUsuario !== primeiroNome ? ` (${nomeUsuario})` : ""}` : null,
      papel ? `Papel: ${papel}` : null,
      setor ? `Setor: ${setor}` : null,
      orgNome ? `Organização: ${orgNome}` : null,
      `Rota atual: ${rota_atual || "/"} (${rotaInfo?.titulo})`,
    ].filter(Boolean).join("\n");

    let systemPrompt = `${SYSTEM_BASE}\n\n# Contexto da sessão\n${contextoUsuario}\n\nUse o nome do usuário no máximo 1x por conversa, com naturalidade. Adapte sugestões ao papel/setor (ex.: advogado → petições/processos; agrônomo → laudos/clima; comercial → pipeline/metas; rh → gestão de pessoas).`;
    if (entidadeAberta) {
      systemPrompt += `\n\n# Tela aberta agora\nO usuário está visualizando o(a) ${entidadeAberta.tipo}: "${entidadeAberta.label}" (id: ${entidadeAberta.id}). Quando ele disser "este/esse/essa/aqui/deste cliente/deste processo" sem nomear, refere-se a ESTE registro. Prefira agir sobre ele: por exemplo, para "resuma este cliente" chame consultar_dados(panorama_cliente) usando este nome/id em vez de pedir de novo.`;
    }
    systemPrompt += isPrimeiraMensagem
      ? `\n\n[Estado da conversa] PRIMEIRA mensagem — inicie com a saudação completa exatamente como instruído.`
      : `\n\n[Estado da conversa] Conversa em andamento — NÃO repita a saudação, responda direto.`;
    if (ragContexto) {
      systemPrompt += `\n\n=== BASE DE CONHECIMENTO INTERNA (use como referência primária quando relevante; cite "Fonte N" quando usar) ===\n${ragContexto}\n=== FIM ===`;
    }

    // Normaliza histórico para formato Anthropic (apenas role user/assistant com content string)
    const convo: any[] = (Array.isArray(messages) ? messages : [])
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0)
      .map((m: any) => ({ role: m.role, content: m.content }));

    const stream = new ReadableStream({
      async start(controller) {
        const acoes: any[] = [];
        let textoFinal = "";
        let totalIn = 0;
        let totalOut = 0;
        const tInicio = Date.now();
        let provedorUsado: "anthropic" | "lovable" = "anthropic";
        const MODELO_CLAUDE = "claude-sonnet-4-5-20250929";
        if (ragFontes.length > 0) {
          sseSend(controller, "rag", { fontes: ragFontes });
        }
        try {
          for (let iter = 0; iter < 5; iter++) {
            // ===== Streaming Anthropic SSE =====
            let contentBlocks: any[] = [];
            let stopReason: string | null = null;
            let textoIter = "";
            let httpStatus = 0;
            let errBody = "";

            if (ANTHROPIC_API_KEY) {
              try {
                const resp = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: MODELO_CLAUDE,
                    max_tokens: 2048,
                    temperature: 0.4,
                    system: systemPrompt,
                    messages: convo,
                    tools: tools,
                    stream: true,
                  }),
                });
                httpStatus = resp.status;
                if (!resp.ok || !resp.body) {
                  errBody = await resp.text();
                  console.error("Anthropic SSE erro", resp.status, errBody.slice(0, 400));
                } else {
                  // Parse SSE
                  const reader = resp.body.getReader();
                  const decoder = new TextDecoder();
                  let buf = "";
                  const blocks: Record<number, any> = {};
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    let nl: number;
                    while ((nl = buf.indexOf("\n")) !== -1) {
                      let line = buf.slice(0, nl);
                      buf = buf.slice(nl + 1);
                      if (line.endsWith("\r")) line = line.slice(0, -1);
                      if (!line.startsWith("data:")) continue;
                      const jsonStr = line.slice(5).trim();
                      if (!jsonStr || jsonStr === "[DONE]") continue;
                      let evt: any;
                      try { evt = JSON.parse(jsonStr); } catch { continue; }
                      const t = evt.type;
                      if (t === "message_start") {
                        totalIn += evt?.message?.usage?.input_tokens || 0;
                      } else if (t === "content_block_start") {
                        const idx = evt.index;
                        const cb = evt.content_block || {};
                        if (cb.type === "tool_use") {
                          blocks[idx] = { type: "tool_use", id: cb.id, name: cb.name, _buf: "", input: {} };
                        } else if (cb.type === "text") {
                          blocks[idx] = { type: "text", text: "" };
                        }
                      } else if (t === "content_block_delta") {
                        const idx = evt.index;
                        const d = evt.delta || {};
                        if (d.type === "text_delta") {
                          if (!blocks[idx]) blocks[idx] = { type: "text", text: "" };
                          blocks[idx].text += d.text || "";
                          textoIter += d.text || "";
                          sseSend(controller, "token", { text: d.text || "" });
                        } else if (d.type === "input_json_delta") {
                          if (blocks[idx]) blocks[idx]._buf += d.partial_json || "";
                        }
                      } else if (t === "content_block_stop") {
                        const idx = evt.index;
                        const b = blocks[idx];
                        if (b && b.type === "tool_use") {
                          try { b.input = b._buf ? JSON.parse(b._buf) : {}; } catch { b.input = {}; }
                          delete b._buf;
                        }
                      } else if (t === "message_delta") {
                        if (evt?.delta?.stop_reason) stopReason = evt.delta.stop_reason;
                        if (evt?.usage?.output_tokens) totalOut += evt.usage.output_tokens;
                      } else if (t === "message_stop") {
                        // fim
                      } else if (t === "error") {
                        errBody = JSON.stringify(evt.error || {});
                        console.error("SSE error event", errBody);
                      }
                    }
                  }
                  contentBlocks = Object.keys(blocks)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((k) => blocks[Number(k)]);
                }
              } catch (e: any) {
                console.error("Anthropic fetch erro", e?.message);
                httpStatus = 0;
              }
            }

            // ===== Fallback Lovable AI Gateway =====
            const precisaFallback = !ANTHROPIC_API_KEY
              || httpStatus === 429 || httpStatus === 529 || httpStatus === 503 || httpStatus === 500 || httpStatus === 0;
            if (precisaFallback && LOVABLE_API_KEY) {
              console.log("Olívia → fallback Lovable AI por status", httpStatus);
              provedorUsado = "lovable";
              // Lovable não suporta tool_use Anthropic — sem tools no fallback
              const fbMessages = convo
                .filter((m: any) => typeof m.content === "string" || Array.isArray(m.content))
                .map((m: any) => ({
                  role: m.role,
                  content: typeof m.content === "string" ? m.content :
                    (Array.isArray(m.content) ? m.content.map((b: any) => b?.type === "text" ? b.text : (b?.type === "tool_result" ? `[ferramenta]: ${typeof b.content === "string" ? b.content : JSON.stringify(b.content)}` : "")).filter(Boolean).join("\n") : ""),
                }))
                .filter((m: any) => m.content && m.content.length > 0);
              const fbResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  max_completion_tokens: 2048,
                  temperature: 0.4,
                  messages: [{ role: "system", content: systemPrompt }, ...fbMessages],
                }),
              });
              if (!fbResp.ok) {
                const fbErr = await fbResp.text();
                console.error("Fallback Lovable falhou", fbResp.status, fbErr.slice(0, 300));
                const msg = fbResp.status === 429 ? "IA sobrecarregada. Tente novamente em instantes."
                  : fbResp.status === 402 ? "Crédito de IA esgotado."
                  : `IA indisponível (${fbResp.status}).`;
                sseSend(controller, "error", { message: msg });
                break;
              }
              const fbData = await fbResp.json();
              const fbText: string = fbData?.choices?.[0]?.message?.content || "";
              const fbUsage = fbData?.usage || {};
              totalIn += fbUsage.prompt_tokens || 0;
              totalOut += fbUsage.completion_tokens || 0;
              if (fbText) {
                textoIter = fbText;
                const chunkSize = 24;
                for (let i = 0; i < fbText.length; i += chunkSize) {
                  sseSend(controller, "token", { text: fbText.slice(i, i + chunkSize) });
                  await new Promise(r => setTimeout(r, 10));
                }
              }
              // fallback não tem tool calls → encerra o loop
              if (textoIter) textoFinal += (textoFinal ? "\n" : "") + textoIter;
              break;
            } else if (httpStatus && !((httpStatus >= 200 && httpStatus < 300) || httpStatus === 0)) {
              const msg = httpStatus === 429 ? "IA sobrecarregada. Tente novamente em instantes."
                : httpStatus === 401 ? "Chave de IA inválida."
                : `IA indisponível (${httpStatus}).`;
              sseSend(controller, "error", { message: msg });
              break;
            }

            if (textoIter) textoFinal += (textoFinal ? "\n" : "") + textoIter;

            const toolUses = contentBlocks.filter((b: any) => b?.type === "tool_use");
            if (toolUses.length === 0 || stopReason !== "tool_use") break;

            // Re-anexa a mensagem do assistant com os tool_use blocks
            convo.push({ role: "assistant", content: contentBlocks });
            const toolResults: any[] = [];
            for (const tu of toolUses) {
              let resultado: any;
              const nome = tu.name;
              const input: any = tu.input || {};
              if (nome === "navegar_para") {
                const acao = { tipo: "navegar", rota: input?.rota, motivo: input?.motivo };
                acoes.push(acao);
                sseSend(controller, "action", acao);
                resultado = { ok: true, rota_destino: input?.rota };
              } else if (nome === "consultar_dados") {
                resultado = await executarConsulta(supabase, input?.tipo, input?.params || {}, userId, orgId);
              } else if ([
                "criar_tarefa", "criar_lead_comercial", "registrar_atividade_cliente",
                "criar_lembrete_vencimento", "marcar_tarefa_concluida",
                "avancar_fase_processo", "marcar_vencimento_pago",
                "agendar_reuniao", "registrar_acordo_tarefa",
                "gerar_laudo", "gerar_peticao", "analisar_abusividade",
              ].includes(nome)) {
                resultado = await executarAcao(supabase, userId, orgId, nome, input || {});
                if (resultado?.ok) {
                  const acao = { tipo: "criou", ferramenta: nome, detalhe: resultado.mensagem };
                  acoes.push(acao);
                  sseSend(controller, "action", acao);
                  if (resultado.rota) {
                    const navAcao = { tipo: "navegar", rota: resultado.rota, motivo: resultado.mensagem };
                    acoes.push(navAcao);
                    sseSend(controller, "action", navAcao);
                  }
                }
              } else {
                resultado = { erro: "Ferramenta desconhecida" };
              }
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(resultado),
              });
            }
            convo.push({ role: "user", content: toolResults });
          }

          if (conversaId) {
            await supabase.from("olivia_mensagens").insert({
              conversa_id: conversaId, user_id: userId, role: "assistant",
              content: textoFinal, acoes, rota_origem: rota_atual || null,
            });
            await supabase.from("olivia_conversas")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversaId);
          }

          // Loga consumo agregado da conversa
          await logIaConsumo({
            funcao: "assistente-ia",
            modelo: provedorUsado === "anthropic" ? MODELO_CLAUDE : "google/gemini-3-flash-preview",
            provedor: provedorUsado,
            input_tokens: totalIn,
            output_tokens: totalOut,
            status: "ok",
            duracao_ms: Date.now() - tInicio,
            user_id: userId,
            organizacao_id: orgId,
            meta: { conversa_id: conversaId, acoes: acoes.length },
          });

          sseSend(controller, "done", { conversa_id: conversaId, acoes });
        } catch (e: any) {
          console.error("stream error", e);
          sseSend(controller, "error", { message: e?.message || "erro" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e: any) {
    console.error("assistente-ia erro:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});