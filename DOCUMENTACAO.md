# Oliveira Advogados — Documentação do sistema

Aplicação interna do escritório Oliveira Advogados: uma SPA em React que centraliza a operação
jurídica do agronegócio e do crédito bancário (clientes, laudos, processos, notificações,
acordos), a consultoria empresarial, o comercial/marketing, o RH e o pós-venda — além de um
**Portal** de autoatendimento para clientes externos.

O backend é o **Supabase** (Postgres + Edge Functions em Deno). Não há servidor próprio.

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Front | React 18 + TypeScript + Vite 6 |
| UI | Tailwind CSS 3 + shadcn/ui (Radix) + lucide-react + framer-motion |
| Estado/dados | TanStack React Query 5 + Supabase JS 2 |
| Rotas | react-router-dom 6 (todas em lazy chunks) |
| Gráficos/planilha | recharts, xlsx |
| PDF | jspdf, react-pdf, geração no servidor via Edge Function |
| Backend | Supabase Edge Functions (Deno) |
| Banco | PostgreSQL (Supabase) com RLS |
| Testes | vitest + Testing Library; Playwright (e2e) |
| Migrações | drizzle-kit (SQL manual) + Supabase migrations |

---

## 2. Como rodar

```bash
npm install          # ou bun install (há bun.lock)
npm run dev          # Vite em modo desenvolvimento
npm run build        # build de produção
npm run test         # vitest run
npm run lint         # eslint
```

Variáveis do front ficam em `.env` (somente chaves **públicas**):

```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```

Todos os segredos sensíveis (tokens de integração, chaves de IA, service role) **nunca** vão
para o navegador: ficam nos Secrets das Edge Functions e/ou em tabelas de segredo do banco
(`app_secrets`). Ver seção 11.

---

## 3. Mapa de pastas

```
src/
  App.tsx                 composição de rotas e provedores
  main.tsx                bootstrap (instala o guarda do "Ver como")
  pages/                  150 arquivos — 1 por tela (74 "telas" + abas/sub-telas)
  components/             247 arquivos — componentes de domínio + ui/ (58 primitivos shadcn)
  hooks/                  37 hooks de dados, identidade e UI
  lib/                    31 helpers (regra de negócio de front, formatação, guards)
  contexts/               AuthContext, AreaContext
  integrations/supabase/  client.ts (cliente do banco) + types
  data/                   dados estáticos
  test/                   testes de segurança/RLS
supabase/
  functions/              56 Edge Functions (Deno) + _shared/
  migrations/             200 migrações SQL (auto-geradas, nome <timestamp>_<uuid>)
  config.toml             project_id
drizzle/
  migrations/             56 migrações SQL manuais (0000_…0055_)
  schema.ts               intencionalmente vazio (drizzle usado só como runner)
docs/                     scripts SQL avulsos (reversão de papéis)
```

---

## 4. Arquitetura — Frontend

### 4.1 Inicialização e provedores

`src/main.tsx` é mínimo: instala o guarda de escrita do modo "Ver como" no cliente do banco
(`instalarGuardaVerComo`) e renderiza `<App />`.

`src/App.tsx` é a raiz de composição. Aninhamento dos provedores (de fora para dentro):

```
QueryClientProvider → AuthProvider → AreaProvider → TooltipProvider
  → ConfirmDialogProvider → BrowserRouter → Suspense → Routes
```

### 4.2 Rotas, lazy chunks e pré-carregamento

Todas as ~150 telas são carregadas por `lazyRetry(() => import(...))` (`src/lib/lazyRetry.ts`),
que tenta de novo 2× e, se o chunk estiver velho (deploy novo), recarrega a página uma vez.
`registrarRotas` (App.tsx) monta o mapa rota→componente e:
- **preload no hover** do menu lateral (`preloadRota`);
- **preload ocioso** das 10 rotas mais usadas após a primeira tela (`preloadMaisUsadasQuandoOcioso`),
  pulado em conexão econômica/2G (`conexaoEconomica`).

Objetivo: manter o pacote inicial pequeno (~171 KB gzip). Rotas legadas redirecionam
(`/gestao→/`, `/pipeline→/processos?view=kanban`, `/acessos→/configuracoes?tab=acessos`).

Guardiões de rota:
- `ProtectedRoute` — exige login interno; portal vai para `/portal`; sem permissão → `/acesso-negado`.
- `CeoRoute` — soma a checagem `is_ceo` (Financeiro e Master).
- `PortalRoute` — usuário externo; `require="empresa"|"cliente"` separa os dois portais.

### 4.3 Autenticação e tipos de usuário

- `src/contexts/AuthContext.tsx` — escuta `onAuthStateChange` + `getSession()`, expõe `{user, session, loading, signOut}`.
- `src/hooks/usePortalUser.ts` — classifica o usuário em `interno` (existe em `membros`),
  `portal_empresa` (`empresa_portal_usuarios`) ou `portal_cliente` (`cliente_portal_usuarios`).
  Cache de 5 min.

### 4.4 Permissões no cliente

`src/hooks/usePermissions.ts` é o motor:
- `ROLE_RESTRICTIONS` — o que cada papel (`membros.papel`) não pode acessar;
- `PATH_TO_PERMISSION` — rota → chave de permissão;
- se o membro pertence a um **grupo de permissão** (`permission_groups.modulos`),
  `expandModulesToPermKeys` **substitui** as restrições de papel pelos módulos do grupo;
- `canAccessPath` libera rotas não mapeadas (a barreira real é o RLS).

Catálogos em `src/lib/permissionModules.ts` (`MODULE_CATALOG`, `PERFIS_PRONTOS`).
RH e Acessos são só admin; métricas recortam por setor.

> Importante: tudo isso é **UX**. A autorização de verdade está no **RLS do banco** (seção 8.3).

### 4.5 Modo "Ver como" (somente leitura)

`src/lib/verComo.ts`: admin/CEO visualiza a interface "com os olhos" de outra pessoa **sem trocar
sessão** (`auth.uid()` continua do admin). O guarda `instalarGuardaVerComo` embrulha o cliente
(`from`, `rpc`, `functions.invoke`, `storage`) e faz escritas retornarem erro falso (`code: "VER_COMO"`)
sem sair do navegador. RPCs de leitura passam por lista branca/prefixos (`get_`, `is_`, `has_`, `can_`…).
Telas pessoais leem `useUsuarioEfetivo()`. Registra entrada em `audit_log` via `ver_como_registrar`.

### 4.6 Camada de dados

- `src/integrations/supabase/client.ts` — `createClient<Database>(...)`, sessão persistida e
  auto-refresh; storage de auth "brokered" para o preview do Lovable.
- `src/lib/queryClient.ts` — singleton React Query: `staleTime` 5 min, `gcTime` 30 min,
  `refetchOnWindowFocus: false`, `retry: 1`.
- `src/lib/lerTudo.ts` — leitura **em blocos de 1000** via `.range()`, porque a API corta listas
  longas em silêncio. Usado em telas que passam de 1.000 linhas.
- Chamadas a Edge Functions: `supabase.functions.invoke(nome, { body })`. A região é pinada em
  **sa-east-1** só na Controladoria (`src/lib/controladoria.ts`, `RadarClientesTab.tsx`), porque o
  DJEN bloqueia IPs fora do Brasil.

### 4.7 UI kit e tema

shadcn/ui (`components.json`: style "default", baseColor slate, CSS vars). 58 primitivos em
`src/components/ui`. `tailwind.config.ts`: dark mode por classe, tema HSL por variável, fontes
DM Sans/Sora/Manrope/JetBrains Mono, token `area-accent`, cores `success/warning/info`, paleta da sidebar.

### 4.8 Organização por domínio (`src/components/`)

`acordos`, `cliente` (Perfil 360), `comercial`, `consultoria`, `dashboard`, `equipe` (acessos/permissões),
`kanban` (primitivos de board), `laudo` (wizard de etapas), `mensagens`, `metricas`, `notificacoes`,
`pdf`, `portal`, `posVenda`, `processo` (timeline ADVBOX/DataJud), `radar`, `rh`, `sidebar`,
`treinamentos`, `tribunais`, `ui`, `vencimentos`. Componentes soltos na raiz: `AppLayout`,
`AppSidebar`, `ProtectedRoute`, `CeoRoute`, `VerComo`, `GlobalSearch`, `AssistenteIA`, `IntegracoesPanel`.

---

## 5. Arquitetura — Backend (Edge Functions)

56 funções em `supabase/functions/`, todas em Deno, usando `@supabase/supabase-js` via esm.sh.
Rotas forçadas em `sa-east-1` nos módulos que falam com o DJEN.

### 5.1 Helpers compartilhados (`_shared/`)

| Arquivo | Papel |
|---|---|
| `auth.ts` | `getCaller(req)` valida o JWT (`getUser`, nunca `getClaims`); `orgIdsDoUsuario`, `ehAdmin` (via `membros.papel='admin'`); respostas 401/403. |
| `controladoria.ts` | `autenticar()` aceita **`x-cron-secret`** (comparado a `app_secrets.controladoria_cron_secret`) **ou** JWT interno — e **rejeita usuários do portal**. `corsHeaders`, `adminClient()`, `calendarioControladoria()`, normalização de acentos, cliente `advbox()` com backoff 429/403, mapas de usuários ADVBOX↔app. |
| `dias-uteis.ts` | Calendário de dias úteis (Páscoa por Meeus/Butcher, feriados fixos e móveis + tabela `feriados`); usado por prazos do ADVBOX. Não é usado pela Controladoria (que tem calendário próprio). |
| `ia-claude.ts` | `callClaude()` chama `api.anthropic.com/v1/messages` (`ANTHROPIC_API_KEY`) com **fallback** para o Lovable AI Gateway (Gemini, `LOVABLE_API_KEY`) em 429/5xx/rede; registra cada chamada em `ia_consumo`. Suporta PDF como bloco `document`. |
| `provas.ts` | Provas: `autenticar` (só interno), `ehLider` via RPC `prova_is_lider`, embaralhamento, `questoesParaResponder` (remove gabarito), `gravarECorrigir` (corrige no servidor com service_role). |
| `zapsign.ts` | `zapsignToken()` (`ZAPSIGN_API_TOKEN`), cliente `api.zapsign.com.br/api/v1` com backoff, `finalizarAssinado` (baixa o PDF assinado → bucket `cliente-drive` + `arquivos_cliente`). |

### 5.2 Funções por domínio

**Controladoria / CNJ** — `djen-captura` (raspa comunicações do DJEN por OAB monitorada),
`radar-clientes` (busca no DJEN por nome de cliente), `datajud-andamentos` (movimentos do DataJud),
`controladoria-d5` (relatório diário D-5), `controladoria-conferencia-advbox` (reconciliação noturna ADVBOX×app).

**ADVBOX** — `advbox-import`, `advbox-importar-base`, `advbox-sync` (tarefas/prazos bidirecionais).

**ZapSign** — `zapsign-enviar`, `zapsign-sync`, `zapsign-webhook` (público, protegido por `x-zapsign-secret`),
`zapsign-webhook-registrar`.

**Provas** — `prova-publica` (link de candidato sem login, rate-limit por IP), `prova-iniciar`,
`prova-enviar` (correção no servidor), `prova-corrigir` (dissertativas pelo líder).

**Laudos / IA** — `ai-laudo`, `chat-laudo`, `gerar-laudo-completo`, `gerar-laudo-docx`,
`analise-contrato`, `analise-contrato-chat`, `extrair-contrato-vencimento`, `gerar-documento-juridico`,
`gerar-secao-peticao`, `gerar-acordos-recorrentes`, `assistente-ia` (OlivIA interna, RAG + tools),
`olivia-ingest` (PDF/DOCX → embeddings), `olivia-briefing`, `olivia-portal` (OlivIA do portal, streaming).

**Clima / Agro** — `consultar-cemaden`, `consultar-conab`, `consultar-cptec`, `consultar-decretos`,
`consultar-ipea`, `consultar-ndvi`, `consultar-sgs`, `consultar-yr`, `dados-climaticos` (INMET + NASA POWER),
`scraping-agro` (Firecrawl).

**Integrações** — `asaas-sync`, `meta-ads-sync`, `sync-google-sheets`, `integrations-status`.

**Portal** — `portal-convidar`, `portal-cliente-convidar`.

**Documentos / relatórios** — `gerar-pdf`, `gerar-relatorio-cliente`, `gerar-relatorio-atendimento`, `assinar-laudo`.

**Plataforma** — `api-gateway` (API externa por `x-api-key`), `api-keys`, `totp-tribunais`
(códigos TOTP; segredos cifrados AES-GCM), `gerenciar-equipe`, `verificar-prazos`.

### 5.3 Modelo de autenticação das funções

| Padrão | Como |
|---|---|
| Usuário interno | `Authorization: Bearer <JWT>` validado por `getCaller`/`autenticar` |
| Cron / máquina | header `x-cron-secret` comparado a segredo em `app_secrets` ou env |
| Webhook público | segredo próprio (`x-zapsign-secret`) + idempotência |
| Candidato de prova | token da aplicação, sem JWT |
| Portal (externo) | **rejeitado** nas funções internas; o portal fala com o banco via RLS/views |

### 5.4 Agendamentos (cron)

`pg_cron` + `pg_net` habilitados por migração. Horários declarados em SQL:
- `gerar-acordos-recorrentes-diario` — `0 10 * * *`;
- `tarefa-mensal-sdr-leads` — `0 8 1 * *` (`fn_criar_tarefa_mensal_sdr_leads()`);
- `radar-regra-historico` — `10 3 * * *` (`fn_radar_regra_historico()`).

A captura do DJEN roda 6×/dia em **sa-east-1**; a conferência ADVBOX é noturna e rotativa; a
sincronização ADVBOX↔app é diária às 06:00. As funções de cron autenticam por `x-cron-secret`.

---

## 6. APIs externas

| Serviço | Endpoint | Auth | Chamado por |
|---|---|---|---|
| **DJEN** (CNJ) | `comunicaapi.pje.jus.br/api/v1/comunicacao` | pública | `djen-captura`, `radar-clientes` |
| **DataJud** (CNJ) | `api-publica.datajud.cnj.jus.br` | `DATAJUD_API_KEY` | `datajud-andamentos` |
| **ADVBOX** | `app.advbox.com.br/api/v1` | `ADVBOX_TOKEN`/`ADVBOX_API_TOKEN` (Bearer) | `advbox-*`, `controladoria-*`, `djen-captura` |
| **ZapSign** | `api.zapsign.com.br/api/v1` | `ZAPSIGN_API_TOKEN` (Bearer) | `zapsign-*` |
| **Anthropic Claude** | `api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` | laudos, OlivIA, assistente, análise de contratos |
| **Lovable AI Gateway** | `ai.gateway.lovable.dev/v1/…` | `LOVABLE_API_KEY` | fallback de IA + embeddings |
| **Asaas** | `api.asaas.com/v3` | `ASAAS_API_KEY` | `asaas-sync` |
| **Meta Ads (Graph)** | `graph.facebook.com/v21.0` | `META_ADS_ACCESS_TOKEN` | `meta-ads-sync` |
| **Firecrawl** | `api.firecrawl.dev/v1/scrape` | `FIRECRAWL_API_KEY` | `scraping-agro` |
| **INMET** | `apitempo.inmet.gov.br/estacoes/T` | pública | `dados-climaticos` |
| **NASA POWER** | `power.larc.nasa.gov/api/temporal/daily/point` | pública | `dados-climaticos` |
| **NASA MODIS TESViS** | `modis.ornl.gov/rst/api/v1` | pública | `consultar-ndvi` |
| **CONAB** | `consultaprecosdemercado.conab.gov.br` | pública | `consultar-conab` |
| **INPE CPTEC** | `servicos.cptec.inpe.br/XML/*` | pública | `consultar-cptec` |
| **IPEA** | `ipeadata.gov.br/api/odata4/…` | pública | `consultar-ipea` |
| **BCB SGS** | `api.bcb.gov.br/dados/serie/bcdata.sgs.{código}/dados` | pública | `consultar-sgs` (usado no Laudo de Abusividade) |
| **MET Norway** | `api.met.no/weatherapi/locationforecast/2.0/complete` | pública | `consultar-yr` |
| **CEMADEN** | `resources.cemaden.gov.br/graficos/json/*.json` | pública | `consultar-cemaden` |
| **S2ID / DOU / Defesas Civis** | portais de decretos | pública | `consultar-decretos` |
| **CEPEA / Notícias Agrícolas / Agrolink** | via Firecrawl | `FIRECRAWL_API_KEY` | `scraping-agro` |
| **Google Sheets** | `docs.google.com/.../gviz/tq?tqx=out:csv` | pública (planilha) | `sync-google-sheets` |

---

## 7. Banco de dados

### 7.1 Dois sistemas de migração

| Pasta | Arquivos | Responsável |
|---|---|---|
| `supabase/migrations/` | 200 (`<timestamp>_<uuid>.sql`) | Core da plataforma: identidade, clientes/processos, laudos, petições, comercial/mkt, RH, consultoria, portal, financeiro |
| `drizzle/migrations/` | 56 (`0000_…0055_`) | Módulos operacionais: distribuição de operações, ADVBOX, garantias, **Controladoria**, **Treinamentos/Provas**, **Assinaturas**, notificações-banco |

`drizzle/schema.ts` é vazio de propósito — o Drizzle é usado apenas como **runner** de SQL manual.
Total: **≈184 tabelas distintas** (124 em `supabase` + 60 em `drizzle`), com nomes disjuntos.
Intervalo das migrações Supabase: 2026-03-18 → 2026-09-18.

### 7.2 Grupos de tabelas por domínio

**Identidade / plataforma** — `profiles`, `membros`, `organizacoes`, `org_settings`, `user_sessions`,
`audit_log`, `api_keys`, `app_secrets`, `permission_groups`, `rate_limits`, `notificacoes_sistema`
(enum `app_role`).

**Clientes / processos** — `clientes`, `processos`, `processo_andamentos`, `documentos`,
`arquivos_cliente`, `atendimentos_notas`, `atividades_clientes`, `carteira_responsaveis`,
`avencas`/`avenca_valores`, `operacoes_credito`, `operacao_avalistas`, `operacao_garantias`,
`cliente_banco_escopo(_historico)`, `processos_judiciais`, `processo_judicial_clientes`,
`advbox_*` (alias, disparos, pendências, reconciliação, sync_log, agenda), `causas_avulsas`, `causa_notas`.

**Controladoria / DJEN / DataJud** — `controladoria_*` (`membros`, `oabs`, `advbox_usuarios`,
`conferencia_advbox`, `conferencia_processos`, `datajud_processos`, `datajud_movimentos`,
`radar_buscas`, `radar_resultados`, `radar_decisoes`, `execucoes`, `monitor_execucoes`,
`d5_snapshots`, `d5_itens`, `feriados_forenses`, `triagem_lotes`, `triagem_lote_itens`),
`djen_comunicacoes`, `radar_etapas_config`, `radar_funcoes`, `varredura_sugestoes`.

**Treinamentos** — `setores`, `membro_setores`, `trein_*` (trilhas, versões, módulos, aulas,
progresso, questionários, perguntas, tentativas, atribuições); provas: `provas`, `prova_questoes`,
`prova_alternativas`, `prova_aplicacoes`, `prova_respostas`.

**Assinaturas** — `assinatura_config`, `assinatura_documentos`, `assinatura_signatarios`, `assinatura_eventos`.

**Portal** — `cliente_portal_usuarios`, `empresa_portal_usuarios`, `portal_chamados`,
`portal_chamado_mensagens`; visibilidade por views (`portal_cliente_*_view`, `portal_ofertas_view`,
`portal_empresa_plano_view`) e `contratos_vencimentos.visivel_cliente`.

**Notificações** — `notificacao_config`, `notificacao_contatos`, `notificacao_decisoes`,
`notificacao_complementacoes`, `notificacoes_banco`.

**Tarefas / kanban / workflow** — `tarefas`, `tarefas_historico`, `tarefa_comentarios`,
`acordos_tarefas`, `acordos_historico`, `kanban_*`, `workflow_tarefas`.

**Financeiro / honorários** — `financeiro_lancamentos`, `financeiro_cobrancas`, `honorarios_calculos`,
`contratos_vencimentos`, `tj_*` (credenciais de tribunais).

**Comercial / Marketing** — `comercial_leads`, `comercial_atividades`, `comercial_metas`,
`mkt_leads_diarios`, `mkt_lancamentos_diarios`, `mkt_metas_mensais`, `mkt_metas_individuais`,
`mkt_contratos_fechados`, `mkt_meta_ads_config`, `mkt_leads_organicos_origem`, `mkt_tentativas_data_futura`.

**RH** — `rh_*` (apurações, contratos, documentos, feedbacks, metas, PDIs, playbooks, regimentos,
reuniões 1on1, salários, tabela salarial, política).

**Consultoria / produtização** — `empresas_consultoria`, `consultoria_onboarding(_itens)`,
`consultoria_demandas`, `consultoria_propostas`, `consultoria_simulacoes`, `empresa_*`
(contatos, acordos, demandas externas, documentos), `pedidos_servico`, `ofertas_catalogo`.

**Pós-venda** — `pos_venda_onboardings`, `pos_venda_checklist_itens`, `pos_venda_govbr_acessos`.

**Laudos / IA / chat** — `laudos`, `laudo_memoria`, `laudo_conversas`, `laudo_etapa_historico`,
`peticoes`, `analises_contratos`, `analises_ia`, `analise_contrato_jobs`, `analise_chat_mensagens`,
`ia_consumo`, `olivia_conhecimento`, `olivia_conversas`, `olivia_mensagens`, `conversas`,
`conversa_membros`, `mensagens`.

### 7.3 RLS e modelo de acesso

~**679 políticas** `CREATE POLICY` (544 em supabase, 135 em drizzle). Helpers são `SECURITY DEFINER`,
`STABLE`, `SET search_path=public`, revogados de `PUBLIC/anon` e concedidos a `authenticated, service_role`.

| Helper | Regra |
|---|---|
| `has_role(uid, app_role)` | papel do membro (`membros.papel`) |
| `user_org_ids`, `is_admin_in_org`, `is_member_anywhere`, `shares_org` | escopo por organização |
| `is_ceo(uid)` | `membros.is_ceo` — Financeiro/Master |
| `controladoria_is_internal(uid, org)` | é membro da org **e não** é usuário do portal |
| `controladoria_is_admin` | `controladoria_membros.papel='admin'` |
| `cliente_do_usuario_portal` / `empresa_do_usuario_portal` | resolve o vínculo do portal |
| `trein_is_internal/gestor/admin`, `prova_is_lider` | treinamentos por setor |

Resumo: `anon` = nada. Membro interno = escopo por organização + papel. Admin/CEO = helpers acima.
Usuário do portal = apenas SELECT aditivo limitado aos seus IDs. Módulos isolados (Controladoria,
Treinamentos) têm grupos e helpers próprios.

### 7.4 Funções de banco (RPC) relevantes

`trein_publicar`, `trein_quiz_responder`, `trein_quiz_perguntas`, `trein_recalcular`, `trein_atribuir`,
`prova_anonimizar_candidatos`, `ver_como_registrar`, `ver_como_pode`, `papel_radar`,
`controladoria_triagem_lote`/`_desfazer`, `advbox_importar_clientes/processos`, `fn_djen_prazo_sugerido`,
`match_olivia_conhecimento`, `mkt_dashboard_agregado`, `saude_sistema`, `fundir_clientes`,
`search_clientes_norm`, `get_proximos_vencimentos_kanban`, `normalize_person_name`/`f_unaccent`.

### 7.5 Buckets de storage

`avatars` (público), `laudos`, `assinaturas`, `cliente-drive`, `empresa-documentos`, `certificados`,
`rh-arquivos`, `portal-anexos`, `treinamentos` (**privado**, políticas por caminho com
`trein_pode_ver_trilha`/`trein_pode_editar_trilha`).

### 7.6 Triggers notáveis

Auditoria (`audit_clientes/processos/laudos/peticoes/tarefas/operacoes_credito/contratos_vencimentos`),
`on_auth_user_created`, `protege_gestao_clientes`, `protege_prazo_operacoes`, carimbo de organização
(`trg_set_org_*`), ciclo de vida de chamados do portal (`trg_portal_chamados_*`), `trg_workflow_avancar`,
`trg_kanban_card_move` e vários `updated_at`.

---

## 8. Catálogo de telas

Para cada tela: **rota** — o que faz — quem acessa — **Acessa:** dados (tabela) / RPC / Edge Function.
"Acessa tabela" significa leitura/escrita via cliente Supabase **sob RLS**; "invoca" significa Edge Function.

### 8.1 Home e núcleo do agronegócio

- **Home** (`/`) — Entrada por área: painel Empresarial, painel de Demandas Gerais ou (padrão) o
  Dashboard Agro. Acessa: `useMembroAtual`, `usePermissions`, `useTarefas`.
  - **Dashboard Agro** (componente `pages/Dashboard.tsx`) — saudação por papel, cartões de Radar,
    alertas da OlivIA, banner de contratos vencidos, resumo de operações, vencimentos dos próximos
    5 dias, "Minhas tarefas", últimos laudos e atalhos. Ação em massa "Criar lembretes" (admin).
    **Acessa:** `contratos_vencimentos`, `laudos`, `movimentacoes`, `peticoes`, `processos`, `profiles`.
- **Clientes** (`/clientes`) — Lista buscável e paginada montada a partir de contratos, operações e
  laudos: bancos, nº de contratos, VIP, adimplência e status. **Acessa:** `clientes`,
  `contratos_vencimentos`, `operacoes_credito`, `laudos`, `atividades_clientes`; `usePagination`.
- **Cliente Detalhe — Perfil 360** (`/clientes/:nome`) — Visão 360 com abas Perfil 360 / Atividades /
  Processos / Drive / Atendimentos / Conversas / Operações; edita cadastro, contratos, anexos e
  convida ao portal. **Acessa:** `clientes`, `contratos_vencimentos`, `operacoes_credito`,
  `cliente_banco_escopo`, `cliente_execucoes`, `laudos`, `processos`, `movimentacoes`,
  `atividades_clientes`, `atendimentos_notas`, `tarefas`, `peticoes`, `processo_judicial_clientes`,
  `operacao_garantias`/`operacao_avalistas`, `cliente_portal_usuarios` (convite);
  invoca `portal-cliente-convidar`. (`useOperacoesCredito`, `usePapelRadar`.)
- **Novo Cliente** (`/novo-cliente`) — Cadastro do produtor (CPF/CNPJ, município, propriedade,
  contatos), múltiplos contratos bancários, checklist comercial e urgência de laudo derivada.
  **Acessa:** `clientes`, `contratos_vencimentos`, `processos`, `laudos`, `membros`,
  `notificacoes_sistema`, `tarefas`; `lib/upsertCliente`.
- **Fechamento de Cliente** (`/clientes/fechamento`) — Fechamento: grupo, titulares e operações;
  leitura de PDF/imagem por IA para preencher banco/número/valor/vencimento; dispara ADVBOX e cria
  tarefas. **Acessa:** `clientes`, `operacoes_credito`, `cliente_banco_escopo(_historico)`,
  `cliente_execucoes`, `pos_venda_onboardings`, `pos_venda_checklist_itens`, `carteira_responsaveis`,
  `radar_etapas_config`, `membros`, `profiles_publico`, `notificacoes_sistema`;
  invoca `extrair-contrato-vencimento`, `advbox-sync`.
- **Processos (Alongamento)** (`/processos`) — Pipeline em Kanban + lista, filtros de fase
  (Laudo, Notificação, Resposta Banco, Judicial, Encerrado), criar/editar/excluir, busca de cliente
  e importação. **Acessa:** `processos`, `clientes`, `contratos_vencimentos`, `laudos`; `usePagination`.
- **Processo Detalhe** (`/processos/:id`) — Fase atual, timeline, `FaseContent`, tarefas,
  movimentações, vínculo de cliente e cartões ADVBOX/andamentos + resumo por IA.
  **Acessa:** `processos`, `movimentacoes`, `profiles`; via componentes: `arquivos_cliente`,
  `documentos`, `processo_andamentos`, `controladoria_datajud_processos`/`controladoria_datajud_movimentos`,
  `laudos`; invoca `ai-laudo`, `advbox-sync`, `assistente-ia`. (`useTarefas`, `useWorkflowTasks`.)
- **Processos sem Cliente** (`/processos/sem-cliente`) — Backlog de processos sem cliente vinculado,
  com nome inferido, banco, fase e sugestão por nome; cada vínculo é confirmado individualmente.
  **Acessa:** `processos`, `clientes`.
- **Processos Judiciais** (`/processos-judiciais`) — Base judicial do ADVBOX (somente leitura), abas
  Processos / CPF pendente / Duplicados, com popover de movimentos DataJud por número CNJ.
  **Acessa:** `processos_judiciais`, `clientes`, `advbox_clientes_alias`; usa `lerTudo`.
- **Painel do Caso** (`/caso/:id`) — Monta documentos: cartões do agrônomo (produtor, cultura/safra,
  contrato, hipóteses MCR, conclusão) e abas notificação/petição com geração por IA, template e export.
  **Acessa:** `processos`, `profiles`; invoca `gerar-documento-juridico`.
- **Visão Jurídica** (`/juridico/overview`) — KPIs jurídicos: processos, petições, vitórias, índice de
  vitória, quebra por tipo de decisão, produtividade da equipe e últimas decisões. **Acessa:**
  `processos`, `peticoes`, `movimentacoes`, `tarefas`, `membros`, `profiles_publico`.
- **Templates** (`/templates`) — Biblioteca de templates de conclusão de laudo (hipótese MCR e
  variáveis), com favoritos, copiar/editar/excluir. **Acessa:** `templates_conclusao`.
- **Novo Laudo** (`/novo-laudo`) — Assistente em etapas (Identificação, Documentos & IA, Enquadramento
  MCR, Safra, Capacidade, Projeção, Finalização), seleção de cliente obrigatória, chat de IA e
  salvamento automático. **Acessa:** `laudos`, `documentos`, `clientes`; invoca `ai-laudo`,
  `gerar-laudo-completo`, `gerar-laudo-docx`, `gerar-pdf` (via componentes do wizard).
- **Meus Laudos** (`/laudos`) — Acervo de laudos com KPIs, Kanban por etapa (Entrevista → Retificação),
  lista por cliente, filtros e ações (duplicar, baixar, excluir). **Acessa:** `laudos`, `documentos`,
  `processos`; `usePagination`.
- **Visualizar Laudo** (`/laudos/:id`) — Leitura: arquivos anexos com preview de PDF, link do PDF
  gerado e todas as seções/narrativas. **Acessa:** `laudos`, `documentos`.
- **Laudo de Abusividade** (`/abusividade`) — Calculadora de juros abusivos: entradas do contrato,
  comparação com o mercado (BACEN), alertas de mora/remuneração/seguro e export em PDF.
  **Acessa:** `contratos_vencimentos`; invoca `consultar-sgs`.
- **Análise de Contratos** (`/analise-contratos`) — Upload para parecer por IA: resumo executivo,
  comparativo BACEN, semáforo, citações, recomendação; abas Resumo/Parecer, chat e análises anteriores.
  **Acessa:** `analises_contratos`, `analise_chat_mensagens`, `analise_contrato_jobs`, `membros`;
  invoca `analise-contrato`, `analise-contrato-chat`.
- **Relatórios** (`/relatorios`) — Relatório por cliente (Extrato de Posição, Acompanhamento):
  qualificação, resumo, atendimentos, contratos, laudos, movimentações e tarefas, com preview e PDF.
  **Acessa:** `clientes`, `contratos_vencimentos`, `laudos`, `processos`, `movimentacoes`,
  `atividades_clientes`, `tarefas`, `tarefas_historico`, `profiles`; `useSubordinados`.
- **Petições** (`/peticoes`) — Construtor de petições: tipo (notificação, cautelar, mandamental,
  embargos…), cliente/laudo, edição de seções, "Gerar com IA"/"Gerar Tudo com IA", salvar e exportar.
  **Acessa:** `peticoes`, `laudos`, `contratos_vencimentos`; invoca `gerar-secao-peticao`.
- **Histórico de Petições** (`/peticoes/historico`) — Tabela ordenável/filtrável das petições geradas;
  download de backup `.txt`. **Acessa:** `peticoes`, `profiles_publico`.
- **Vencimentos** (`/vencimentos`) — Abas Minhas operações / Radar crítico / Prazos do pipeline /
  Base de contratos; tabela com filtros, import/export CSV, sincronização Google Sheets e revisão de
  duplicados. **Acessa:** `contratos_vencimentos`, `sheets_sync_config`; invoca `sync-google-sheets`.
  (`useVencimentosData`, `useVencimentosFilters`, `useCsvImportExport`, `useSheetsSync`.)
- **Agenda** (`/agenda`) — Calendário mensal de tarefas internas e eventos sincronizados do ADVBOX,
  filtro por membro, criar/concluir/excluir e "Sincronizar Advbox". **Acessa:** `advbox_agenda`,
  `contratos_vencimentos`; `useTarefas`, `useAdvboxSync`.
- **Tarefas** (`/tarefas`) — Painel de tarefas por membro, filtros de data, KPIs, drawer de detalhe e
  export PDF; não-admin vê só as suas. **Acessa:** `tarefas`, `tarefas_historico`, `peticoes`.
- **Workflow — Jornada do Produtor** (`/workflow`) — Kanban de 5 colunas (Fechamento, Onboarding,
  Mapeamento, Notificação, Desfecho) calculado a partir de cliente, operações, onboarding e processos.
  **Acessa:** `clientes`, `operacoes_credito`, `pos_venda_onboardings`, `pos_venda_checklist_itens`,
  `processos`; `useOperacoesCredito`.
- **Fila de Vencidas** (`/fila-vencidas`) — Limpeza da fila: abas fila/histórico/duplicatas
  classificando operações vencidas (coberta, em atraso, conferir pasta, em juízo, sem prova),
  consulta de processo no ADVBOX e arquivar/desfazer. **Acessa:** `operacoes_credito`,
  `cliente_execucoes`, `arquivos_cliente`, `advbox_pendencias`, `notificacoes_banco`; invoca `advbox-sync`.
- **Vincular Operações** (`/operacoes-sem-titular`) — Operações sem titular, agrupadas por grupo de
  cliente: escolher pessoa, vincular, arquivar ("não é operação bancária") ou adiar.
  **Acessa:** `operacoes_credito`, `clientes`.
- **Importar Varredura** (`/notificacoes/varredura`) — Upload do CSV da varredura de pastas, preview de
  sugestões instituição/protocolo por responsável; salva apenas sugestões.
  **Acessa:** `varredura_sugestoes`, `audit_log`, `clientes`, `operacoes_credito` (`useVarreduraSugestoes`).
- **Triagem de Protocolos** (`/notificacoes/protocolos`) — Confirma protocolos achados pela varredura por
  par titular+banco; escolher sugestão, confirmar, descartar com motivo ou adiar; cancela peticionamento
  pendente. **Acessa:** `advbox_pendencias` (+ `useNotificacoesBanco`, `useOperacoesCredito`, `useVarreduraSugestoes`).
- **Complementações Pendentes** (`/notificacoes/complementacoes`) — Pares de protocolo cujas operações não
  têm cobertura; cria tarefas de complementação para a protocoladora após confirmação.
  **Acessa:** `operacoes_credito`, `advbox_pendencias`, `notificacoes_banco` (`useNotificacoesBanco`).
- **Notificações Extrajudiciais** (`/notificacoes`) — Um cartão por titular+banco: contadores, filtros,
  registrar protocolo/resposta/contato/complementação, alertas de dias parados e atalhos para varredura,
  triagem, complementações e prazos. Decisão restrita a admin/Willian. **Acessa:** `membros` (+ hooks de
  notificações: `notificacoes_banco`, `notificacao_*`, `advbox_pendencias`, `operacoes_credito`).

### 8.2 Controladoria (`/controladoria`, abas por `?aba=`)

Módulo isolado: tabelas `controladoria_*`/`djen_comunicacoes`, calendário próprio. Só equipe da
Controladoria; o portal nunca vê.

- **Visão geral** — Casca com as abas; cabeçalho "Intimações do DJEN e prazos dos próximos 5 dias úteis".
- **Intimações** (`?aba=intimacoes`) — Filas (Novas, Minhas, Sem responsável, Com prazo, Só ciência,
  Cliente réu, Fora do ADVBOX, Tratadas); filtros; painel lateral com o texto e o prazo destacado;
  gera tarefa com prazo fatal em dias úteis; ações em lote com desfazer.
  **Acessa:** `djen_comunicacoes`, `controladoria_oabs`, `controladoria_execucoes`,
  `controladoria_feriados_forenses`, `feriados`; RPC `controladoria_triagem_lote`/`_desfazer`.
- **Prazos D-5** (`?aba=d5`) — Retrato diário dos prazos D-0…D-5 por responsável, vencidos em vermelho,
  botão "Gerar novamente". **Acessa:** `controladoria_d5_snapshots`, `controladoria_d5_itens`,
  `profiles`; invoca `controladoria-d5`.
- **Movimentações novas** (`?aba=movimentacoes`) — Movimentos do DataJud ainda não vistos, agrupados por
  responsável, com link e "Visto". **Acessa:** `controladoria_datajud_movimentos`, `processos_judiciais`.
- **Radar de clientes** (`?aba=radar`) — Processos do DJEN atribuídos a clientes por pontuação
  (confirmado/provável/improável), com sinais explicativos; simula 10 clientes e decide
  "É do cliente"/"Homônimo". **Acessa:** `controladoria_radar_resultados`; invoca `radar-clientes`
  (região **SaEast1**).
- **Conferência ADVBOX** (`?aba=conferencia`) — Divergências "Só no ADVBOX"/"Só no app" com cobertura da
  semana; conferência noturna automática e botão resolver. **Acessa:** `controladoria_conferencia_advbox`,
  `controladoria_conferencia_processos`, `processos_judiciais`.
- **Configuração** (`?aba=config`) — OABs monitoradas, equipe/papéis, feriados forenses e locais, vínculo
  usuários ADVBOX×app, execuções recentes e histórico de triagem. Acesso: admin da Controladoria.
  **Acessa:** `controladoria_oabs`, `controladoria_membros`, `controladoria_advbox_usuarios`,
  `controladoria_execucoes`, `controladoria_feriados_forenses`, `controladoria_triagem_lotes`, `feriados`.

### 8.3 Treinamentos e Provas

Módulo isolado por setores (`setores`, `membro_setores`), bucket privado `treinamentos`.

- **Treinamentos** (`/treinamentos`) — Casca com abas conforme papel; botão "Provas" para liderança.
- **Meus treinamentos** (`?aba=meus`) — Trilhas atribuídas com progresso, prazo/atraso, nota e
  certificado; provas pendentes. **Acessa:** `trein_trilhas`, `trein_aulas`, `trein_aula_progresso`,
  `trein_atribuicoes`, `provas`, `prova_aplicacoes`, `profiles`.
- **Catálogo** (`?aba=catalogo`) — Trilhas ativas por setor, busca, selos (obrigatória, rascunho, versão)
  e criação por quem edita o setor. **Acessa:** `trein_trilhas`.
- **Acompanhamento** (`?aba=painel`) — Painel de gestão: resumo, tabela por setor, matriz pessoa×trilha,
  provas de passagem de cargo, atalho "ver como". **Acessa:** `trein_trilhas`, `trein_atribuicoes`,
  `provas`, `prova_aplicacoes`, `membro_setores`.
- **Configuração** (`?aba=config`) — Cria/renomeia/reordena setores e subgrupos, marca pessoas e define
  líderes. **Acessa:** `setores`, `membro_setores`.
- **Player da Trilha** (`/treinamentos/trilha/:id`) — Módulos/aulas, progresso, vídeos (YouTube/Vimeo/arquivo),
  PDFs, links, checklists e questionários com nota mínima. **Acessa:** `trein_trilhas`, `trein_modulos`,
  `trein_aulas`, `trein_aula_progresso`, `trein_questionarios`, `trein_tentativas`, `trein_atribuicoes`;
  RPC `trein_quiz_perguntas`, `trein_quiz_responder` (correção no servidor).
- **Editor de Trilha** (`/treinamentos/editar/:id`) — Dados, módulos, aulas (vídeo/documento/texto/checklist),
  upload, questionários/perguntas e publicação de versão. **Acessa:** `trein_trilhas`, `trein_modulos`,
  `trein_aulas`, `trein_questionarios`, `trein_perguntas`, bucket `treinamentos`; RPC `trein_publicar`.
- **Provas** (`/treinamentos/provas`) — Cadastro de provas (geral/passagem de cargo/candidato), questões
  (múltipla escolha/dissertativas), pesos, publicação, estatísticas e limpeza de dados antigos de
  candidatos. **Acessa:** `provas`, `prova_questoes`, `prova_alternativas`, `prova_aplicacoes`,
  `rh_tabela_salarial`, `trein_trilhas`; RPC `trein_meu_papel`, `prova_anonimizar_candidatos`.
- **Aplicações de Prova** (`/treinamentos/provas/:id/aplicacoes`) — Aplicações por pessoa/candidato,
  atribuir à equipe, gerar link público e corrigir. **Acessa:** `provas`, `prova_questoes`,
  `prova_respostas`, `prova_aplicacoes`, `profiles`; invoca `prova-corrigir`.
- **Responder Prova** (`/treinamentos/prova/:aplicacaoId`) — Interface interna do colaborador para
  responder a prova atribuída. **Acessa:** via Edge Functions `prova-iniciar`, `prova-enviar`.
- **Prova Pública** (`/prova/:token`) — Página **sem login**, link único/expirável para candidatos, com
  aviso de privacidade e retenção (LGPD). **Acessa:** invoca `prova-publica` (token, sem JWT).

### 8.4 Assinaturas (`/assinaturas`) — ZapSign

- **Visão geral** — Casca com abas Documentos / Novo envio / Configuração.
- **Documentos** (`?aba=documentos`) — Documentos enviados com status, signatários, CPF mascarado e links;
  sincroniza, baixa o assinado, importa externo por token e vincula cliente. **Acessa:**
  `assinatura_documentos`, `assinatura_signatarios`, `clientes`, `setores`; invoca `zapsign-sync`
  (ações `baixar`, `link`, `link_novo`).
- **Novo envio** (`?aba=novo`) — Upload de PDF/DOCX (ou arquivo do drive do cliente), detecção de
  marcadores, tipo, setor, prazo, canal, signatários e revisão. **Acessa:** `assinatura_config`,
  `arquivos_cliente`, `clientes`, `membro_setores`, `setores`; invoca `zapsign-enviar`.
- **Configuração** (`?aba=config`) — Signatário do escritório e registro do webhook. Acesso: admin.
  **Acessa:** `assinatura_config`; invoca `zapsign-webhook-registrar`.

### 8.5 Comercial e Marketing

**Comercial**
- **Atendimentos Comerciais** (`/comercial/atendimentos`) — Atendimentos registrados com busca, criação,
  vínculo a cliente e export PDF; inicia o workflow pós-venda. **Acessa:** `atendimentos_notas`, `clientes`;
  RPC `search_clientes_norm`; invoca `gerar-relatorio-atendimento` (via componente de notas).
- **Comercial & Marketing** (`/comercial`) — KPIs, Kanban de leads (sql/reunião/proposta/fechamento),
  funil e leads por origem; abas Pipeline/Metas/Funil/Atividades. **Acessa:** `comercial_leads`,
  `comercial_atividades`, `comercial_metas` (`useComercial`).
- **Consultoria Empresarial (simulador)** (`/consultoria-empresarial`) — Simulador de planos (Agro,
  Essencial, Empresarial, Estratégico) para estimar mensalidade e êxito; salva/carrega proposta.
  **Acessa:** `consultoria_propostas`, `consultoria_simulacoes`, `membros`.

**Métricas** (RLS por papel/setor; ver 4.4)
- **Métricas (roteador)** (`/metricas`) — Decide por papel: dashboard consolidado (admin/coordenador),
  overview-marketing, overview-comercial ou acesso-negado. **Acessa:** `usePermissions`.
- **Dashboard de Métricas** — KPIs do funil, funil duplo pago/orgânico, origens, cards por nicho,
  rankings de closers/SDRs contra metas, filtros e CSV. **Acessa:** `useMetricas` (`mkt_lancamentos_diarios`,
  `mkt_metas_mensais`, `mkt_metas_individuais`, `mkt_leads_organicos_origem`, `mkt_tentativas_data_futura`, `membros`).
- **Overview Marketing** (`/metricas/overview-marketing`) — Mídia paga Meta Ads (investimento,
  impressões, alcance, CTR, CPC, CPL, leads) + bloco de orgânicos. **Acessa:** `useMetricas`/`useMetricasCalc`,
  `useSubordinados`.
- **Overview Comercial** (`/metricas/overview-comercial`) — Conversões do funil, metas vs contratos,
  ranking de closers e divergências. **Acessa:** `useMetricas`, `useMetricasAgregado`
  (RPC `mkt_dashboard_agregado`), `useContratosFechados`, `useSubordinados`.
- **Lançamento Marketing** (`/metricas/marketing`) — Formulário diário de mídia paga por nicho,
  sincronização Meta Ads, resumo e alerta de dias pendentes. **Acessa:** `useMetricas`; invoca `meta-ads-sync`.
- **Lançamento Comercial** (`/metricas/comercial`) — Lançamento diário individual de SDR/Closer.
  **Acessa:** `useMetricas`.
- **Histórico de Lançamentos** (`/metricas/comercial/historico`) — Tabela de lançamentos com filtros,
  totais e edição. **Acessa:** `mkt_lancamentos_diarios`.
- **Performance Individual** (`/metricas/performance`) — Comparativo por closer e por SDR, com filtros e export.
  **Acessa:** `mkt_lancamentos_diarios`.
- **Leads Orgânicos** (`/metricas/organicos`) — Leads orgânicos por origem e comparação com o total lançado.
  **Acessa:** `useMetricas`.
- **Metas** (`/metricas/metas`) — Metas globais por nicho e individuais por membro. **Acessa:** `useMetricas`.
- **Integração Meta Ads** (`/metricas/integracao-meta`) — Contas/campanhas por nicho, teste de conexão,
  disparo de sync e logs. **Acessa:** `mkt_meta_ads_config`, `mkt_meta_ads_sync_log`, `membros`; invoca `meta-ads-sync`.
- **Contratos Fechados** (`/metricas/contratos-fechados`) — CRUD de contratos fechados com dashboard,
  import/export Excel e progresso de meta. **Acessa:** `mkt_contratos_fechados`, `membros` (`useContratosFechados`).
- **Tentativas em Data Futura** (`/metricas/tentativas`) — Auditoria (só admin) de lançamentos em datas
  futuras. **Acessa:** `mkt_tentativas_data_futura`.
- **Propostas Enviadas** (`/metricas/propostas-enviadas`) — Lista unificada de propostas de honorários e
  consultoria, com verificação e exclusão (admin). **Acessa:** `honorarios_calculos`, `consultoria_simulacoes`.
- **Consumo IA** (`/metricas/consumo-ia`) — Custos de IA a partir de `ia_consumo`, com câmbio editável
  e gráficos. Acessa: só admin. **Acessa:** `ia_consumo`.

### 8.6 Consultoria Empresarial

- **Empresas** (`/consultoria/empresas`) — Lista de empresas em consultoria fixa com busca, ordenação e
  criação. **Acessa:** `empresas_consultoria`, `membros`.
- **Detalhe da Empresa** (`/consultoria/empresas/:id`) — Contatos, avenças (valores sob RLS financeira),
  demandas internas/externas, onboarding e documentos; convida contatos ao portal.
  **Acessa:** `empresas_consultoria`, `empresa_contatos`, `avencas`, `avenca_valores`,
  `empresa_portal_usuarios`; RPC `can_view_consultoria_financeiro`; invoca `portal-convidar`.
- **Demandas (Inbox)** (`/consultoria/demandas`) — Caixa em lista ou Kanban, filtros e ações em massa.
  **Acessa:** `consultoria_demandas`.
- **Detalhe da Demanda** (`/consultoria/demandas/:id`) — Dados, prazo, prioridade, status e thread de
  interações (notas internas/visíveis). **Acessa:** `consultoria_demandas`, `demanda_interacoes`.
- **Demandas Externas** (`/consultoria/demandas-externas`) — Lista (cobrança, ação, notificação, dívida)
  com valor, parte contrária e atribuições. **Acessa:** `empresa_demandas_externas`.
- **Detalhe da Demanda Externa** (`/consultoria/demandas-externas/:id`) — Edição e gestão de acordos.
  **Acessa:** `empresa_demandas_externas`, `empresa_acordos`.
- **Propostas de Consultoria** (`/consultoria/propostas`) — Lista por status com sheet, edição e contato.
  **Acessa:** `consultoria_propostas`, `empresas_consultoria`, `profiles_publico`.
- **Carteira de Avenças** (`/consultoria/carteira`) — Carteira por empresa (status, MRR, NPS, risco,
  último contato); colunas financeiras sob RLS. **Acessa:** `avencas`, `avenca_valores`, `empresas_consultoria`.
- **Onboarding de Consultoria** (`/consultoria/onboarding`) — Lista de onboardings com progresso; cria a
  partir de empresa/avença com template. **Acessa:** `consultoria_onboarding`, `consultoria_onboarding_itens`,
  `empresas_consultoria`, `avencas`, `profiles_publico`.
- **Detalhe do Onboarding** (`/consultoria/onboarding/:id`) — Checklist com percentual, marcar/desmarcar
  itens com observações e concluir/reabrir. **Acessa:** `consultoria_onboarding`, `consultoria_onboarding_itens`,
  `empresas_consultoria`.

### 8.7 Demandas Gerais (causas avulsas)

- **Painel** (`/demandas-gerais`) — Dashboard de causas avulsas: KPIs (abertas, prazos vencidos, ≤7 dias,
  concluídas), distribuição por status/matéria/responsável e prazos críticos. **Acessa:** `causas_avulsas`.
- **Causas** (`/causas`) — Tabela de causas de diversas matérias com busca, filtros e prazos em destaque.
  **Acessa:** `causas_avulsas`.
- **Detalhe da Causa** (`/causas/:id`) — Ficha com cliente, valor, prazo, responsável, troca de status,
  notas e soft delete. **Acessa:** `causas_avulsas`, `causa_notas`.
- **Formulário de Causa** (diálogo) — Criação/edição de causa avulsa. **Acessa:** `causas_avulsas`.

### 8.8 Pós-venda

- **Onboardings** (`/pos-venda/onboarding`) — Lista com progresso, busca, criação e exclusão com desfazer.
  **Acessa:** `pos_venda_onboardings`, `pos_venda_checklist_itens`, `membros`.
- **Detalhe do Onboarding** (`/pos-venda/onboarding/:id`) — Checklist por etapas/pessoas/operações
  (documentos, procurações, citações, processos), anexos, arquivamento e conclusão ligada ao workflow.
  **Acessa:** `pos_venda_onboardings`, `pos_venda_checklist_itens`, `pos_venda_govbr_acessos`,
  `clientes`, `operacoes_credito`, `cliente_execucoes`, `execucao_citacoes`, `notificacoes_sistema`, `profiles_publico`.
- **Relatório do Cliente** (`/pos-venda/relatorio-cliente`) — Gera relatório por IA (visão família),
  edita rascunho, finaliza e exporta PDF. **Acessa:** `relatorios_cliente`, `membros`; invoca `gerar-relatorio-cliente`.
- **Carteira de Clientes** (`/pos-venda/carteira`) — Carteira com nível por dívida (N1–N5), fase, banco,
  NPS, risco, VIP e próximo prazo; registro de contato e painéis de divisão. **Acessa:** `clientes`,
  `contratos_vencimentos`, `operacoes_credito`, `atendimentos_notas`, `processos`; `useOperacoesCredito`.
- **Triagem de Carteira** (`/pos-venda/triagem`) — Triagem por situação com vencimentos e última
  movimentação; salva situação com motivo. **Acessa:** `clientes`, `contratos_vencimentos`,
  `operacoes_credito`, `atendimentos_notas`, `atividades_clientes`; `useOperacoesCredito`.
- **Divisão de Carteira** (`/pos-venda/divisao`) — Compatibilidade: renderiza o painel de divisão
  (também disponível dentro da Carteira).
- **Painel Pós-venda** (`/pos-venda/painel`) — Ranking por relatórios, carteira, NPS, onboardings e
  acordos, com filtros. **Acessa:** `pos_venda_onboardings`, `relatorios_cliente`, `acordos_tarefas`,
  `clientes`, `contratos_vencimentos`.
- **Chamados do Portal** (`/pos-venda/chamados`) — Caixa de entrada dos chamados abertos no portal, com KPIs.
  **Acessa:** `portal_chamados`, `clientes`.
- **Detalhe do Chamado** (`/pos-venda/chamados/:id`) — Thread com respostas, status, responsável e
  prioridade + dados de cliente/processo/contrato. **Acessa:** `portal_chamados`, `clientes`,
  `contratos_vencimentos`, `processos`.

### 8.9 Produtização

- **Catálogo de Ofertas** (`/admin/ofertas`) — CRUD de ofertas (marca agro/jurídico, assinatura/avulso,
  preço, público). **Acessa:** `ofertas_catalogo`; `useIsCeo`.
- **Pedidos de Serviço** (`/admin/pedidos`) — Lista de pedidos com filtros, troca de status e
  responsável inline. **Acessa:** `pedidos_servico`, `ofertas_catalogo`, `clientes`, `empresas_consultoria`.

### 8.10 RH e carreira

- **Gestão de Pessoas** (`/rh`) — Dashboard de RH, busca/filtros de colaboradores, engajamento e drawer;
  abas Colaboradores e Regimentos & Playbooks. Papel varia (admin/coordenador/self). **Acessa:**
  `profiles_publico`, `rh_feedbacks`, `rh_metas`, `rh_reunioes_1on1`; via componentes: `rh_contratos`,
  `rh_documentos`, `rh_pdis`, `rh_playbooks`, `rh_regimentos`, `rh_salarios`, `membros`, `profiles`.
- **Tabela Salarial** (`/carreira/salarios`) — Faixas por setor/nível/subfaixa; admin vê tudo, demais só a
  própria faixa. **Acessa:** `profiles` (+ `rh_tabela_salarial`).
- **Metas Semestrais** (`/carreira/metas`) — Templates de metas por setor/nível com alvo, peso e tipo.
  **Acessa:** tabelas `rh_*` de metas.
- **Apuração de Bônus** (`/carreira/bonus`) — Pool semestral (faturamento, gatilho 80%, pool) e apurações
  individuais com termômetro e bônus final. **Acessa:** `profiles_publico` (+ `rh_*`).

### 8.11 Financeiro e Master (somente CEO — `CeoRoute`)

- **Financeiro** (`/financeiro`) — MRR de avenças ativas, KPIs por setor e painel Asaas com sincronização
  e inadimplência. **Acessa:** `avencas`, `avenca_valores`, `financeiro_cobrancas`, `financeiro_lancamentos`;
  invoca `asaas-sync`.
- **Lançamentos** (`/financeiro/lancamentos`) — CRUD de receitas/despesas com filtros, totais, exclusão em
  massa e export CSV. **Acessa:** `financeiro_lancamentos`.
- **Dashboard Master** (`/master`) — Painel executivo consolidando financeiro, empresarial (avenças,
  propostas, NPS) e agro (processos, laudos, acordos, vencimentos). **Acessa:** `financeiro_lancamentos`,
  `financeiro_cobrancas`, `avencas`, `avenca_valores`, `empresas_consultoria`, `consultoria_demandas`,
  `consultoria_propostas`, `empresa_acordos`, `empresa_demandas_externas`, `clientes`, `processos`,
  `laudos`, `contratos_vencimentos`, `acordos_tarefas`, `mkt_contratos_fechados`.

### 8.12 Comunicação, administração e ajuda

- **Feed** (`/feed`) — Feed em tempo real de notificações, agrupado por data, com filtros e "marcar como
  lida". **Acessa:** `notificacoes_sistema`.
- **Inbox** (`/inbox`) — Central de pendências com abas Tarefas (30 dias), Vencimentos (15 dias) e
  Notificações, em realtime. **Acessa:** `tarefas`, `contratos_vencimentos`, `notificacoes_sistema`.
- **Mensagens** (`/mensagens`) — Mensageria em tempo real com menções `@` que notificam.
  **Acessa:** `conversas`, `conversa_membros`, `mensagens`.
- **Acordos** (`/acordos`) — Cadência de tentativas em Kanban/lista, histórico e auditoria; tarefas
  recorrentes e vínculo a contrato. **Acessa:** `acordos_tarefas`, `acordos_historico`, `contratos_vencimentos`.
- **Configurações** (`/configuracoes`) — Abas Perfil (dados, CREA, assinatura), Integrações e Acessos da
  Equipe (admin). **Acessa:** `profiles`, `assinaturas`; `usePermissions`.
- **Equipe** (`/equipe`) — Convite por papel/e-mail, matriz de permissões, grupos, módulos extras e contas
  de acesso; coordenador vê só liderados. **Acessa:** `membros`, `organizacoes`, `profiles`,
  `profiles_publico`, `user_sessions`, `permission_groups`; invoca `gerenciar-equipe`.
- **Modo Campo** (`/campo`) — Fluxo mobile-first para agrônomos: busca cliente, observações, foto e GPS,
  gravando na timeline do cliente. **Acessa:** `atividades_clientes`.
- **Ajuda — MCR 2.6.4** (`/ajuda`) — Conteúdo do Manual de Crédito Rural (hipóteses a–d, documentos, FAQ).
- **Guia de Uso** (`/guia`) — Fluxos operacionais e princípios por papel.
- **OlivIA — Conhecimento** (`/olivia/conhecimento`) — Alimenta a base da assistente (texto, PDF/DOCX) com
  categorias e tags; ingestão por fragmentos. Acesso: admin. **Acessa:** `olivia_conhecimento`;
  invoca `olivia-ingest`.
- **Saúde do Sistema** (`/saude-sistema`) — Verificações de integridade (datas, CPF, duplicidade,
  responsável, protocolo) com cartões OK/vermelho e manuais. Acesso: admin. **Acessa:** RPC `saude_sistema`.
- **Códigos dos Tribunais** (`/codigos-tribunais`) — Gera códigos TOTP sem celular, com expiração e
  renovação; custodiantes cadastram segredos e consultam auditoria. **Acessa:** invoca `totp-tribunais`
  (segredos cifrados AES-GCM; a função é o único caminho até as credenciais).
- **Feriados e Recesso** (`/feriados`) — Calendário de prazos: cadastro de feriados estaduais/municipais/
  recesso e ativação dos nacionais calculados. **Acessa:** `feriados`, `membros`.
- **Dados Climáticos** (`/climaticos`) — Consulta por UF/município/período (INMET + NASA POWER) com abas
  Resumo, Precipitação, Temperatura e Análise IA. **Acessa:** invoca `dados-climaticos`.
- **Calculadoras** (`/calculadoras`) — Hub que leva a Honorários ou Consultoria Empresarial.
- **Calculadora de Honorários** (`/calculadora-honorarios`) — Honorário inicial e de êxito por faixas e
  complexidade, com salvar, PDF de proposta e resumo por WhatsApp. **Acessa:** `honorarios_calculos`, `membros`.
- **Radar** (`/radar`) — Redireciona para `/vencimentos#radar` (o Radar vive dentro de Vencimentos).

### 8.13 Portal externo (`/portal`, sem login interno)

- **Dispatcher** (`/portal`) — Lê o tipo e redireciona: empresa → demandas, cliente → início.
  **Acessa:** `usePortalUser` (`cliente_portal_usuarios`, `empresa_portal_usuarios`).
- **Cliente — Início** (`/portal/inicio`) — Painel B2C: processos/contratos/chamados, parcelas em atraso,
  atualizações processuais, vencimentos, card OlivIA e abertura de chamado. **Acessa** (via `usePortalCliente`):
  `clientes`, `processos`, `processo_andamentos`, `portal_chamados`, `portal_chamado_mensagens`,
  views `portal_cliente_contratos_view`/`portal_cliente_atendimentos_view`/`portal_cliente_acordos_view`,
  `notificacoes_sistema`.
- **Cliente — Contratos** (`/portal/contratos`) — Contratos bancários por banco, KPIs e "Informar contato
  do banco". **Acessa:** view `portal_cliente_contratos_view`.
- **Cliente — Chamados** (`/portal/chamados`) — Lista com filtros e abertura de novo chamado.
  **Acessa:** `portal_chamados`.
- **Cliente — Detalhe do Chamado** (`/portal/chamados/:id`) — Thread de mensagens e painéis de banco e
  processo. **Acessa:** `portal_chamados`, `portal_chamado_mensagens`.
- **Cliente — Processos** (`/portal/processos`) — Processos com fase atual e última movimentação liberada.
  **Acessa:** `processos`.
- **Cliente — Detalhe do Processo** (`/portal/processos/:id`) — Timeline de movimentações por mês e
  botão "perguntar sobre o processo". **Acessa:** `processos`, `processo_andamentos`.
- **Cliente — Atendimentos** (`/portal/atendimentos`) — Resumos de reuniões/ligações/visitas liberados.
  **Acessa:** view `portal_cliente_atendimentos_view`.
- **Cliente — Acordos** (`/portal/acordos`) — Compromissos em andamento (dias/atraso) e concluídos, sem
  valores. **Acessa:** view `portal_cliente_acordos_view`.
- **Empresa — Demandas** (`/portal/demandas`) — Lista somente-leitura das demandas de consultoria.
  **Acessa:** `consultoria_demandas`, `empresas_consultoria`.
- **Empresa — Detalhe da Demanda** (`/portal/demandas/:id`) — Descrição e atualizações visíveis.
  **Acessa:** `consultoria_demandas`, `demanda_interacoes`.
- **Empresa — Meu Plano** (`/portal/meu-plano`) — Avença ativa: título, status, valor, vencimento, escopo.
  **Acessa:** view `portal_empresa_plano_view`.
- **Empresa — Serviços** (`/portal/servicos`) — Catálogo de ofertas com pedido e solicitação livre.
  **Acessa:** `pedidos_servico`, view `portal_ofertas_view`.
- **Empresa — Meus Pedidos** (`/portal/pedidos`) — Histórico de pedidos com status. **Acessa:** `pedidos_servico`.
- **Empresa — Relatórios** (`/portal/relatorios`) — Documentos liberados via URL assinada.
  **Acessa:** `empresa_documentos`.

### 8.14 Autenticação e entrada

- **Login interno** (`/auth`) — E-mail/senha, "Entrar com Google", links de primeiro acesso e senha esquecida.
- **Login do portal** (`/portal/login`) — Entrada do usuário externo.
- **Definir senha do portal** (`/portal/definir-senha`) — Cria/recupera senha (`solicitar=1` envia link).
- **Primeiro acesso** (`/primeiro-acesso`) — Informa e-mail convidado e envia link de confirmação.
- **Esqueci minha senha** (`/esqueci-senha`) — Envia link de recuperação.
- **Nova senha** (`/reset-password`) — Define a nova senha a partir do token de recovery.
- **Acesso negado** (`/acesso-negado`) — 403 com a rota solicitada. **404** (`*`) — página não encontrada.

---

## 9. Convenções e invariantes do projeto

Extraídas de `AGENTS.md` (obrigatório seguir):

- **Controladoria é módulo isolado**: tabelas `controladoria_*`/`djen_comunicacoes`, calendário próprio;
  nunca usa `processos` nem altera `dias-uteis.ts`, para não mudar prazos do ADVBOX/laudo.
- **Captura do DJEN** roda em **sa-east-1** (`forceFunctionRegion`), 6×/dia, por OAB + nome do advogado;
  o botão "Buscar agora" do navegador é plano B (DJEN bloqueia IPs fora do Brasil).
- **Assinaturas**: visibilidade por RLS = quem enviou (`enviado_por`) + admins; externos só admins;
  funções `zapsign-*` repetem a checagem.
- **Treinamentos**: setor vem de `membro_setores`, nunca de `profiles.setor`. Correção de questionário e
  status só por funções do banco (`trein_quiz_responder`, `trein_publicar`, gatilhos) — o gabarito não
  chega ao navegador.
- **Listas grandes usam `lerTudo()`** (blocos de 1000): o teto da API corta a lista em silêncio.
- **Regras de acesso usam `(select auth.uid())`**, nunca `auth.uid()` solto.
- **Layout, busca ⌘K, assistente e telas de entrada** carregam sob demanda (pacote inicial ~171 KB gz).
- **"Ver como"** é só visual; o guarda bloqueia escritas no cliente. Telas pessoais usam `useUsuarioEfetivo()`.
- **Vínculo do usuário** vem só de `buscarMembroAtual()`; o radar usa base única `useOperacoesCredito`.
- **DataJud e Radar de clientes** guardam por número CNJ em `controladoria_datajud_*`/`controladoria_radar_*`
  (não em `processos_judiciais`, cujo id ADVBOX é obrigatório).

---

## 10. Segredos e variáveis de ambiente

**Front (`VITE_*`, públicos):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON`/`PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

**Edge Functions (Secrets do projeto):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `LOVABLE_API_KEY`, `ADVBOX_TOKEN`/`ADVBOX_API_TOKEN`, `ZAPSIGN_API_TOKEN`,
`ASAAS_API_KEY`, `META_ADS_ACCESS_TOKEN`, `FIRECRAWL_API_KEY`, `DATAJUD_API_KEY`, `CRON_SECRET`,
`TOTP_ENCRYPTION_KEY`.

**Segredos no banco (`app_secrets`):** `controladoria_cron_secret`, `advbox_cron_secret`,
`advbox_sync_cron_secret` e o segredo do webhook do ZapSign.

---

## 11. Estado atual do roadmap

**Concluído:** Controladoria (DJEN + D-5), Assinaturas (ZapSign), Treinamentos, importação ADVBOX
(clientes/processos + sync diário 06:00), DataJud (B0–B3), performance etapas 1 e 1B.

**Aguardando decisões:** importação real de clientes ADVBOX; calibrar pesos do Radar de clientes (A2);
divulgar trilhas; carregar conteúdo real das trilhas; marcar setores/líderes; cadastrar `ZAPSIGN_API_TOKEN`;
primeiro envio real; registrar o webhook.

Detalhes em `roadmap.md`; plano técnico de Controladoria/Radar em `.lovable/plan.md`.
