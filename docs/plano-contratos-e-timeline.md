# Plano — Contratos do cliente: lista expansível, histórico e timeline de tarefas

> **Status:** aprovado pelo titular em 15/10/2026 (ver §5, decisões 1–12; §8 guarda a
> observação da faixa de valor para a próxima etapa).
> **Entregue no front:** Fase 1 (seta da linha só com a descrição, `Expandir/Recolher tudo`),
> tela **Contratos Clientes** (`/erp/contratos`, lista geral com busca/filtros/paginação e linha
> expansível), tela **Usuários** (`/erp/usuarios`, listagem + cadastro + edição com setores e
> objetos) e o menu agrupado *Clientes* (Base / Contratos Clientes) — `tsc`, `eslint`, `build` e
> 11 testes vitest verdes.
> **Em andamento:** API (V11 auditoria + `GET /contratos` + `/usuarios` + histórico de tarefa com
> IP) via subagente — ao fechar, publicar pelo `deploy/publicar-correcoes.sh` (regra de sempre:
> correção entregue = script de envio atualizado + publicar).
> Plano consolidado do módulo (atravessa front e API) — o material de referência de tela
> (`docs/exemplo-*.html`) mora neste repositório.
> Relacionados: `oliveira-erp/docs/plano-tarefas.md` (fases C/G do mesmo fluxo),
> `oliveira-api/docs/planejamento-tarefas-api.md` (contrato × tarefa).

---

## 1. Leitura central

**A tarefa é a unidade da timeline; o contrato é o continente dela.** O cliente tem 1..N
contratos; no cadastro nasce a primeira tarefa, ao criar o contrato nascem as tarefas dos
setores que ele precisa passar, cada setor encaminha para o próximo, anexa e descreve — e cada
movimento vira uma linha de histórico com quem, quando, de onde para onde. Logo, o "histórico de
contratos" e a "timeline de tarefas" são duas leituras do mesmo registro:

```
CLIENTE ─┬─ cadastro ──── tarefa ONBOARDING (o começo da timeline)
         │
         ├─ CONTRATO (1..N) ─┬─ setor de envio (informado ao criar) ─ tarefa(SETOR) ── encaminhar
         │                    ├─ anexos / descrições ────────────────── linhas do histórico
         │                    └─ histórico do contrato = histórico das SUAS tarefas
         └─ PROCESSO (1..N) — outro fluxo, fora desta fase
```

Três entregas, nesta ordem de dependência:

| # | Entrega | Onde |
| --- | --- | --- |
| 1 | Lista de contratos com a **descrição atrás de uma seta** (nunca na lista) | Front, sozinha |
| 2 | Menu **Clientes → Contratos Clientes**: lista geral com busca/filtros + detalhe com a trilha de quem fez o quê | API (lista geral + trilha) e Front |
| 3 | **Timeline/movimentação das tarefas** (aba *Histórico*) para admin e gestor de área | API (histórico completo + feed) e Front |

---

## 2. O que os fontes mostram

| Assunto | Origem | O que diz |
| --- | --- | --- |
| Contrato mora dentro do cliente | `fonts-lovable/correcoes-solicitadas` (linhas 15–20) → `oliveira-api/docs/fontes/correcoes-solicitadas.md:69` | *"Manter o cadastro de contrato dentro do próprio cliente"* |
| Contrato é o continente da timeline | `oliveira-api/docs/planejamento-tarefas-api.md:60-62` | *"dentro dele vivem várias tarefas — cada setor faz a sua função e registra; a tela do contrato mostra desde quando o contrato existe e como está andando (quem fez, quando, o quê)"* |
| Origem das tarefas automáticas | `oliveira-api/docs/fontes/tarefas-e-workflow.md:36-44` | cadastro de cliente → `ONBOARDING — <cliente>`; fase do processo; laudo finalizado → `CONFERÊNCIA DE LAUDO`; manual |
| Contracto cria tarefas por setor | `planejamento-tarefas-api.md:69-72,172-175` | 4 tarefas (Financeiro, Pós-Vendas, Laudo, Jurídico); prazo 1–5 dias = `urgente`, até 10 = `normal` |
| Encaminhar = setor **e** colaborador | `planejamento-tarefas-api.md:178-180` | *"seleciona o setor e, dentro dele, pode escolher o colaborador; sem escolher ninguém, a tarefa fica para o setor e todos do setor recebem notificação"* |
| Timeline da tarefa (modelo de tela) | `oliveira-erp/docs/exemplo-detalhado-tarefa-time-line.html` | filtro `Todas as atividades / Agendamentos / Minhas tarefas / Tarefas pendentes / Tarefas concluídas / Trocas de fase/etapas`; ícones `mode_edit` (edição) e `reply_all` (encaminhamento); botões **"Mostrar edições"** e **"Carregar mais antigas"** |
| No legado o histórico da tarefa é **só de conclusão** | `oliveira-api/docs/fontes/tarefas-e-workflow.md:28,101` | `tarefas_historico` = *"auditoria de conclusão"*, com `executado_por` |
| Menu Clientes é gateado por módulo | `oliveira-api/docs/PROGRESSO.md:75-77` + `oliveira-erp/src/lib/permissionModules.ts:97-101` | `@PreAuthorize("hasAnyRole('admin','ceo') or hasAuthority('clientes')")`; catálogo `clientes` nos dois lados |
| Base de contratos no legado | `fonts-lovable/DOCUMENTACAO.md:456-457` | tela de contratos (`contratos_vencimentos`) com *"tabela com filtros, import/export CSV"* — **não** há tela de histórico por contrato nem trilha por usuário |

---

## 3. Comparação: o que você descreveu × os fontes

| Tema | Você descreveu | Nos fontes | Veredito |
| --- | --- | --- | --- |
| Lista de contratos | Número, objeto, valor, abertura; **descrição nunca na lista**, só ao abrir a seta | Nas listas do ADVBOX a descrição aparece truncada como 2ª linha (`TarefasLista.tsx:150-152`); não há seta de expansão | **Novo** — é decisão de UX sua; sigo ela |
| Histórico de contratos | Lista de **todos** os contratos, com busca por objeto, valor, data e cliente; resumida, abrindo em detalhe | O legado tem base de contratos com filtros (`DOCUMENTACAO.md:456`), mas **não** uma tela de histórico por contrato | **Difere** (do legado) — é tela nova |
| Detalhe com interações | No detalhe, ver **o que cada usuário fez** | O legado não registra interação em contrato; o ADVBOX registra na timeline da atividade | **Bate** (com o ADVBOX) / **Novo** (nosso modelo) |
| Quem vê | Cada **gestor de cada área**, conforme a permissão | O legado só tem *"não-admin vê as próprias tarefas"* (`tarefas-e-workflow.md:32,84`); gestor de área não existe como papel na API | **Novo** — vira a permissão `gestor_area` (§5) |
| Timeline das tarefas | Quem iniciou, quando, para quem redirecionou; admin e gestor veem tudo | Legado grava **só a conclusão**; o ADVBOX tem a timeline completa com filtros | **Difere** (legado) / **Bate** (ADVBOX) |
| Escopo de quem atende | Só os **objetos/categorias que a pessoa atende** (o "setor" do dia a dia — banco, empresa, ...) | O objeto/categoria já existe (`tipo_objeto`, V9) e é justamente o `contratos_cliente.objeto_id` (V10); `membro_setores` (Comercial, Financeiro, ...) continua sendo o **setor de encaminhamento** | **Bate** — escopo por `tipo_objeto`, encaminhamento por `setores` |

---

## 4. Estado atual (verificado no código, não no doc)

**Front (`oliveira-erp`, branch `OE-10/objeto-categoria-e-contrato`, commitada e com push, sem PR)**

- `/erp` com menu: Tarefas, Clientes, e (só admin/ceo) Cadastro → Objetos, Sub-Categorias
  (`src/components/erp/LayoutErp.tsx:153-167`).
- Contratos do cliente: `src/components/erp/ContratosClienteDialog.tsx` — lista
  (Número, Objeto, Valor, Abertura, Situação, Ações) + formulário de criar/editar + excluir.
  **A descrição não aparece em lugar nenhum da lista** e não há expansão (linhas 280-335).
- Abriu por `src/pages/erp/Clientes.tsx:622` (botão "Contratos" e "Salvar e gerar contrato").
- Tarefas: `src/pages/erp/Tarefas.tsx` (lista ADVBOX + calendário + kanban), drawer de detalhe
  sem histórico e **sem encaminhar** (linhas 611-712).

**API (`oliveira-api`, branch `OA-10/objeto-e-sub-objeto`, commitada e com push, sem PR)**

- Schema até `V10`. `contratos_cliente` (V7 + V10: `valor`, `data_abertura`, `objeto_id`),
  `arquivos_cliente`, `tarefas` (V5 + V8: `contrato_id`, `data_compromisso`, `prazo_fatal`,
  `importante`, `lido`, `privada`, `tarefa_futura`, `etapa`), `tarefas_historico`.
- Endpoints de contrato: `GET/POST /clientes/{id}/contratos`, `GET/PATCH/DELETE /contratos/{id}`,
  `POST/GET /contratos/{id}/arquivos`, `GET /arquivos/{id}/conteudo`, `DELETE /arquivos/{id}`.
  **A lista só existe por cliente** (`ContratoController.java:51`).
- `ContratoService` **não grava nenhuma trilha** (nada em `audit_log` nem em tabela própria).
- `TarefaService.historico(id)` **existe** (linha 213) mas **não tem endpoint** — o controller só
  expõe listar/buscar/criar/atualizar — e devolve a **entidade** (viola "entidade não vaza").
  Grava em `tarefas_historico` **apenas na virada `false → true`** (`acao=concluida`).
- Gestor de área: a coluna `membro_setores.lider` existe (V2:140) mas **não é o critério adotado** —
  o que habilita o acesso é a permissão `gestor_area` (§5); `membro_setores` continua sendo a
  fonte do **setor** que a pessoa opera.

---

## 5. Decisões registradas (titular, 15/10/2026)

1. **Menu "Contratos Clientes" fica dentro do menu Clientes já existente** — grupo *Clientes*
   com os filhos *Base* e *Contratos Clientes*, dentro do `LayoutErp`.
2. **Gestor de área = permissão.** Nova chave `gestor_area` nos dois catálogos (`Modulo.java` da
   API e `MODULE_CATALOG` do front), selecionável nos grupos de permissão; se ela vier no login
   (`permissoes`), o front já libera os acessos do gestor.
3. **Escopo por objeto/categoria: a pessoa vê só o que ela atende.** O "setor" do dia a dia
   (banco, empresa, ...) é o **objeto/categoria** que já existe no sistema (`tipo_objeto`, V9) —
   não é um setor novo. Quais objetos a pessoa atende fica **no cadastro dela na plataforma**
   (tabela `membro_objetos`, campo `objetos` em `GET/PATCH /membros/{id}` e no `/auth/me`).
   Lista geral, timeline e movimentação são filtrados por esses objetos
   (`contratos_cliente.objeto_id`). Objeto novo depois? O admin o cria e o adiciona às pessoas
   certas — elas já passam a receber acesso e notificação das tarefas daquele ponto.
   **Dois planos que não se misturam:** objeto/categoria = escopo de **leitura/notificação**;
   `membro_setores` (Comercial, Financeiro, ...) = para onde a tarefa é **encaminhada**.
4. **A exclusão mantém a trilha** — a linha `excluido` guarda **quem** excluiu e **o motivo**
   (campo obrigatório no diálogo de exclusão); sem FK em cascata, para a trilha sobreviver.
5. **A timeline é sobre a tarefa** — começa no cadastro do cliente (tarefa `ONBOARDING`), depois
   a criação do contrato, depois "redirecionou para o setor X", "setor X anexou documentos",
   "descreveu", "enviou para o setor Y"... O feed do contrato é a soma das histórias das suas
   tarefas.
6. **A descrição expande na própria linha** pela seta; o formulário continua só no botão Editar.
7. **A movimentação entra como aba dentro de Tarefas** — aba *Histórico* (ao lado de Lista,
   Calendário e Kanban), visível só a admin/ceo/gestor.
8. **Encaminhamento já nesta fase**: ao criar o contrato informa-se o **setor de envio**, o
   servidor cria as tarefas e grava o encaminhamento. Depois, o login passa a devolver os
   **objetos/categorias que a pessoa atende** (escopo, decisão 3) e os **setores do workflow**
   (encaminhamento) para fechar o fluxo de quem executa cada tarefa.
9. **Auditoria nas tabelas de histórico**: `contrato_historico` e `tarefas_historico` ganham
   **`created_at` e `updated_at`** (+ `setor_id`), para saber quando a tarefa foi criada, quando
   atualizou e se ela foi para o setor certo.
10. **Admin tem acesso total** — admin/ceo vê a lista de contratos inteira, sem recorte de
    escopo; o escopo por objeto só vale para quem não é admin (15/10/2026).
11. **Cadastro de usuário dentro da plataforma** — menu *Usuários* (admin/ceo) com listagem,
    cadastro e edição (`GET/POST/PATCH /api/v1/usuarios`), com os dois blocos de vínculo:
    **setores** (encaminhamento) e **objetos atendidos** (escopo). A decisão antiga de que
    "a API não cria usuário (só o script)" fica **revogada** (15/10/2026).
12. **Rastro completo com IP** — a auditoria de tarefa guarda o **IP do PC** que registrou
    (`ip_registro`), **o que mudou** (diff em `campos`) e o **de/para** do encaminhamento, além
    do usuário e do momento (15/10/2026).

**Pendentes: nenhuma.**

**Resolvido em 15/10/2026:** a dúvida sobre "banco"/"empresa" não existirem no seed de setores
(`V6__setores.sql`) fechou na decisão 3 — eles são **objetos/categorias** (`tipo_objeto`, V9),
não setores. Os 5 setores do seed continuam só como destino de encaminhamento.

---

## 6. Onde está hoje (20/10/2026)

Tudo abaixo foi entregue na API (PR **#10**) e no front (PR **#9**):

| Item | Estado |
| --- | --- |
| `GET /contratos` (carteira geral, paginação + filtros busca/cliente/objeto/situacao/valor/abertura) | entregue |
| `ContratoResumoDTO` com nomes de cliente, objeto e criador (sem N+1) | entregue |
| `tarefas_historico` com de/para, setor, diff em `campos` e IP (`V11`) | entregue |
| `GET /tarefas/{id}/historico` com gate (admin/ceo, responsável, criador ou gestor no escopo) | entregue |
| Permissão `gestor_area` + escopo por objeto em `membro_objetos` (`V11`) e no `/auth/me` | entregue |
| `POST /clientes/{id}/contratos` com setores → cria as tarefas do setor e registra o encaminhamento | entregue |
| `POST /tarefas/{id}/encaminhar` (JSON e multipart com recado e anexos, `V12`) | entregue |
| `setor_id` em `contratos_cliente` e em `tarefas` | entregue |
| Tela Contratos Clientes (lista, descrição expansível, busca com tipo, Novo contrato) | entregue |
| **Histórico do contrato** (tabela própria `contrato_historico` + timeline unificada) | **descartado** (titular, 20/10/2026) |

A **descarta** é decisão, não esquecimento: o histórico do contrato é contado pela trilha das
tarefas dele (`tarefas.contrato_id`, `V8`) e pela trilha global (`audit_log`, `V14`) — duas
trilhas que já existem e já são gravadas em toda movimentação.

Fora desta etapa, registrados em
[`../oliveira-api/docs/PROGRESSO.md`](../../oliveira-api/docs/PROGRESSO.md): o feed agregado
`GET /tarefas/movimentacoes` (a trilha por tarefa já existe) e a aba *Histórico* da tela de
Tarefas.

---

## 7. Plano de execução

### Fase 1 — Front: lista de contratos com a descrição atrás da seta

Não depende da API — entra sozinha.

- `src/components/erp/ContratosClienteDialog.tsx`: primeira coluna ganha o botão de seta
  (`ChevronDown`/`ChevronRight`, `aria-expanded`/`aria-controls`) que abre uma **linha extra
  abaixo da linha** (`<tr>` de `colSpan`) com: descrição completa, banco, observações, datas de
  início/validade e — depois — arquivos e trilha. A descrição **não** aparece na lista; um
  marcador discreto indica onde vale abrir.
- Painel reusável em `src/components/erp/DetalheContrato.tsx` (a Fase 3 o reabre no detalhe).
- `Expandir tudo / Recolher tudo` no cabeçalho da lista (com muitas linhas, abrir uma a uma
  cansa).
- Editar/excluir continuam nos botões (o clique na linha não abre o formulário).
- Teste `src/pages/erp/__tests__/ContratosClienteDialog.test.tsx`: a seta abre e fecha a
  descrição e o botão Editar continua disparando o formulário.

### Fase 2 — API: trilha do contrato, histórico completo da tarefa e permissão de gestor

**V11 — trilha, setor de envio e auditoria:**

```sql
-- Trilha do contrato: o "quem fez o quê" que a tela mostra. Sem FK em contrato_id:
-- apagar o contrato NAO apaga a trilha (decisao 4), por isso guarda cliente e numero.
CREATE TABLE contrato_historico (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id uuid NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
    contrato_id    uuid,
    cliente_id     uuid,
    numero         varchar(80),
    cliente_nome   varchar(255),
    acao           varchar(30) NOT NULL,   -- criado | editado | situacao | arquivo_anexado | arquivo_removido | excluido
    campo          varchar(60),            -- quando a acao e' de um campo (valor, descricao, ...)
    valor_anterior text,
    valor_novo     text,
    motivo         text,                   -- obrigatorio na exclusao (decisao 4)
    setor_id       uuid,                   -- setor que executou a acao (escopo do gestor, decisao 3)
    executado_por  uuid NOT NULL REFERENCES usuarios(id),
    data_acao      timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now(),   -- auditoria da movimentacao (decisao 9)
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_contrato_historico_org      ON contrato_historico(organizacao_id);
CREATE INDEX ix_contrato_historico_contrato ON contrato_historico(contrato_id, data_acao DESC);

-- Setor de envio do contrato (decisao 8) e qual setor a tarefa esta respondendo.
ALTER TABLE contratos_cliente ADD COLUMN setor_id uuid;
ALTER TABLE tarefas          ADD COLUMN setor_id uuid;

-- Historico completo da tarefa: de quem para quem, em que setor, o que mudou.
ALTER TABLE tarefas_historico
    ADD COLUMN de_usuario_id   uuid,
    ADD COLUMN para_usuario_id uuid,
    ADD COLUMN setor_id        uuid,
    ADD COLUMN campos          jsonb,      -- [{ "campo": "prazoFatal", "de": "...", "para": "..." }]
    ADD COLUMN updated_at      timestamptz NOT NULL DEFAULT now();   -- created_at ja existe

-- Objetos/categorias que a PESSOA atende — o escopo de leitura/notificacao (decisao 3).
-- Mesmo formato de membro_setores (V2), mas para tipo_objeto (cadastro unico do escritorio,
-- sem organizacao — a organizacao aqui e' a do vinculo, como no resto da identidade).
CREATE TABLE membro_objetos (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_objeto_id uuid NOT NULL REFERENCES tipo_objeto(id) ON DELETE CASCADE,
    organizacao_id uuid NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_membro_objeto UNIQUE (user_id, tipo_objeto_id)
);
CREATE INDEX ix_membro_objetos_user ON membro_objetos(user_id);
```

- `ContratoService`: grava trilha em `criar` (`criado`), `atualizar` (uma linha `editado` por
  campo que mudou), `anexarArquivos`, `removerArquivo` e `remover` (grava `excluido` com
  `motivo` **antes** de apagar).
- `TarefaService`: grava `criada` no `criar`, `editada` (diff em `campos`) no `atualizar`,
  `concluida`/`reaberta` na virada de `concluida`, `encaminhada` (`de_usuario_id` →
  `para_usuario_id`, `setor_id`) quando o responsável/setor muda.
- Endpoints novos (todos com `@PreAuthorize` espelhando o gate do menu):
  - `GET /api/v1/contratos` — lista da organização, paginada, filtros do G1
    (`ContratoCamposFiltro` + Specification; o `ContratoClienteRepository` hoje **não** estende
    `JpaSpecificationExecutor`, precisa passar a estender) — **escopada pelos objetos que a
    pessoa atende** quando ela não é admin/ceo (decisão 3).
  - `GET /api/v1/contratos/{id}/historico` — trilha do contrato (mais recente primeiro).
  - `GET /api/v1/contratos/{id}/movimentacao` — feed da tarefa: as linhas de
    `tarefas_historico` das tarefas daquele contrato + as do `contrato_historico`, cada item com
    `tipo`, `acao`, `quando`, `quem` (nome), `o_que`, `de`/`para`.
  - `GET /api/v1/tarefas/{id}/historico` — `TarefaHistoricoDTO` (nunca a entidade).
  - `GET /api/v1/tarefas/movimentacoes?usuarioId=&objetoId=&acao=&de=&ate=&page=&size=` —
    feed para **admin/ceo/gestor** (escopo por objetos, decisão 3).
  - `POST /api/v1/tarefas/{id}/encaminhar { setorId, membroId?, mensagem? }` (G12).
  - `POST /api/v1/clientes/{id}/contratos` com `setorId` → cria as tarefas dos setores
    selecionados e grava o encaminhamento (G11); prazo 1–5 dias = `urgente`, ≤10 = `normal`.
  - `GET/PATCH /api/v1/membros/{id}` ganha `objetos` (lista de ids de `tipo_objeto`) — é o
    **cadastro do usuário na plataforma**: admin/ceo marca quais objetos a pessoa atende; objeto
    novo depois, é só adicionar (decisão 3). Escrita só admin/ceo (como o resto de `/membros`).
  - `GET /api/v1/auth/me`: acrescenta `objetos` (ids/nomes dos objetos que a pessoa atende) e
    `setores` (setores de encaminhamento) — é o que o login devolve para front e servidor
    decidirem escopo e notificação (decisões 2/3/8).
- Catálogos: `Modulo.GESTOR_AREA("gestor_area", false)` na API e
  `{ key: "gestor_area", label: "Gestor de área" }` no `MODULE_CATALOG` do front.
- Autorização reutilizável no service: admin/ceo **ou** (`gestor_area` **e** objeto da linha ∈
  objetos da pessoa) **ou** responsável atual/criador da tarefa (a regra do legado).
- Testes: `ContratoServiceTest`/`TarefaServiceTest` ampliados (trilha por ação, de/para, diff,
  motivo da exclusão, escopo do gestor) + `ContratoIT`/`TarefaIT` (trilha gravada em cada verbo,
  filtros da lista geral, 403 para quem não é admin/gestor, 404 entre organizações).
  Rodar `./mvnw -B -o verify`.

### Fase 3 — Front: menu Contratos Clientes, detalhe com trilha e aba Histórico

> **20/10/2026 — fora desta etapa.** O que entrou foi a lista de Contratos Clientes
> (menu, descrição expansível, busca com tipo, Novo contrato, remoção do botão Filtrar).
> O detalhe em rota própria (`/erp/contratos/:id`), com arquivos e timeline da tarefa, só
> entra se o titular pedir — hoje a trilha é vista tarefa a tarefa, na janela da própria
> tarefa.

- **Rota** `/erp/contratos` e `/erp/contratos/:id` em `src/App.tsx` (lazy + `registrarRotas`).
- **Menu** (`src/components/erp/LayoutErp.tsx`): grupo *Clientes* → *Base* e *Contratos
  Clientes* (decisão 1), este visível para admin/ceo/gestor com o módulo `clientes`.
- **Lista** (`src/pages/erp/Contratos.tsx`): colunas Número, Cliente, Objeto, Valor, Abertura,
  Situação + marcador de movimentação; **linha expansível** com a descrição (mesmo componente da
  Fase 1). Cabeçalho no padrão ADVBOX: Buscar (nº, cliente, descrição), Filtrar (cliente, objeto,
  faixa de valor, período de abertura, situação, setor), Ordenar, paginação no servidor
  ("1–N de M"), Exportar como slot desabilitado.
- **Detalhe** (`/erp/contratos/:id`): cabeçalho (nº, cliente, objeto, valor, abertura, situação,
  validade, banco, observações), arquivos com download, tarefas do contrato e a **linha do tempo
  da tarefa** — quem iniciou, quando, para qual setor foi, quem anexou, quem descreveu, com
  *"Mostrar edições"* (o diff do `campos`) e *"Carregar mais antigas"*.
- **Tarefas** (`src/pages/erp/Tarefas.tsx`): nova aba **Histórico** (decisão 7) com o feed
  filtrável (*Todas as atividades / Agendamentos / Minhas tarefas / Pendentes / Concluídas /
  Trocas de fase*), filtro por colaborador/período/setor, visível só a admin/ceo/gestor; no
  drawer de detalhe, o histórico curto + **Encaminhar** (setor + colaborador via `GET /membros`).
- Verificação: `npx tsc --noEmit`, `npx eslint <arquivos>`, `npm run build`, teste vitest e o
  fluxo no navegador (criar contrato com setor → ver tarefas nascidas → encaminhar → ver a
  movimentação aparecer).

---

## 8. Observação para a próxima etapa — faixa de valor por usuário (não implementar ainda)

> Anotado a pedido do titular em 15/10/2026: **ele vai reunir o fluxo completo e detalhado**
> antes de desenvolver. Nada abaixo entra nesta rodada.

**O que é:** no cadastro do usuário (tela *Usuários*), **depois de escolher o papel**, definir
um **intervalo de valor de contrato** (faixa mínima/máxima em R$) que aquele usuário vai
trabalhar. Os **papéis que vão ter essa regra ainda serão definidos** por ele.

**Para que serve (as duas funções):**

1. **Quem faz o quê:** o intervalo limita quais contratos/tarefas a pessoa enxerga e cuida — hoje
   o escopo é só por objeto/categoria (§5.3), a faixa entra como camada em cima.
2. **Redirecionamento automático de tarefa:** quando o comercial lança e fecha o contrato e
   encaminha para o próximo setor (ex.: Pós-Vendas), a plataforma escolhe **o usuário cujo
   intervalo cobre o valor daquele contrato** e entrega a tarefa para ele.

**Onde já existe meio caminho (para reconciliar na próxima etapa):** o `plano-tarefas.md` §3.6/§4.1
prevê a **carteira por faixa de valor** dentro de `setores.distribuicao`
(`{ "carteira": [ { "min": 1000, "max": 5000, "usuarios": [...] } ] }`), configurada pelo gestor
do setor — a decisão nova transforma isso em **atributo do usuário no cadastro**, com o papel como
portão. Definir no planejamento seguinte: quem configura (usuário no cadastro × gestor no setor),
se a faixa é única ou por objeto, e o que acontece quando **nenhum** usuário cobre o valor.

**Campos prováveis (só rascunho):** `membro_faixa_valor (user_id, objeto_id?, valor_min,
valor_max)` ou colunas `valor_min`/`valor_max` em `membro_objetos` — escolher no planejamento.

---

## 9. Onde já está a base (para retomada)

- **Front:** branch `OE-10/objeto-categoria-e-contrato` (commit `2a3a94d`) — com push e **sem PR**.
  Arquivos: `src/components/erp/ContratosClienteDialog.tsx`, `src/pages/erp/Clientes.tsx`,
  `src/pages/erp/Objetos.tsx`, `src/pages/erp/SubObjetos.tsx`, `src/lib/api/contratos.ts`,
  `src/lib/api/objetos.ts`, `src/components/erp/LayoutErp.tsx`.
- **API:** branch `OA-10/objeto-e-sub-objeto` (commit `d712542`) — com push e **sem PR**. Arquivos:
  `com/oliveira/cliente/{controller,services,repositories,domain}`,
  `com/oliveira/tarefa/{...}`, migrações `V7`, `V9`, `V10`.
- Fora deste plano (fases do `oliveira-erp/docs/plano-tarefas.md`): C (anexos da tarefa, config por
  setor, carteira por valor, distribuição por carga) e E (Colaboradores, só admin) — a **C4**
  (4 tarefas ao criar contrato) e a **G8** (encaminhar) passam a fazer parte daqui (G11/G12).

---

## 10. Histórico de aprovação

| Data | O que mudou |
| --- | --- |
| 15/10/2026 | Aprovado com as respostas 1–9 registradas em §5: menu dentro de Clientes; `gestor_area` como permissão; escopo por setor; exclusão com motivo; timeline sobre a tarefa; descrição expandida na linha; aba *Histórico* dentro de Tarefas; encaminhar + setor de envio já nesta fase; `created_at`/`updated_at` nas tabelas de histórico. Seções 4, 5, 6 e 7 revisadas em cima das respostas. **Pendentes: nenhuma.** |
| 15/10/2026 (2) | Escopo amarrado na decisão 3: o "setor" de quem atende é o **objeto/categoria** (`tipo_objeto`) — entra a tabela `membro_objetos` no cadastro do usuário (G14), o filtro passa a ser `contratos_cliente.objeto_id` e o `/auth/me` devolve `objetos`. Os 5 setores do workflow continuam só para encaminhar. |
| 20/10/2026 | Entregue: `GET /contratos` com paginação e filtros, `ContratoResumoDTO`, trilha de tarefa com de/para/diff/IP, encaminhar com recado e anexos, tarefas por setor ao criar o contrato, escopo por objeto e permissão `gestor_area`. **Descartado** o histórico do contrato em tabela própria (a história vive nas trilhas de tarefa e no `audit_log`). Busca com tipo (número, cliente, objeto, descrição) na lista; botão Filtrar removido do header. |
| 15/10/2026 (3) | Tela Usuários: o carregamento virou independente (`Promise.allSettled`) — API do servidor ainda sem a rota `/usuarios` passa a mostrar o aviso "Cadastro de usuários ainda não publicado" em vez de derrubar setores e objetos. **§8** guarda a observação da **faixa de valor por usuário** (cadastro + redirecionamento de tarefa) para a próxima etapa. |
