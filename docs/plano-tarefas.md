# Plano — Tarefas (reajuste)

> **Status:** rascunho para análise do titular. Nada foi implementado ainda.
> Substitui, para a parte de Tarefas, o recorte do `planejamento-tarefas-api.md`
> (a API) e o kanban atual do front.
> Origem dos exemplos: `docs/exemplo-quadro-tarefas.html`,
> `docs/exemplo-detalhado-tarefa.html` e `docs/exemplo-detalhado-tarefa-time-line.html`
> (páginas reais do ADVBOX salvas do navegador).

---

## 1. Origem — o que os exemplos mostram

1. **`exemplo-quadro-tarefas.html`** — a tela "Atividades" (o **Quadro**):
   - topo: gráfico "Atividade" + caixa "Produtividade" (nº de tarefas pendentes);
   - **calendário mensal interativo**: cada dia mostra a contagem de tarefas e um
     marcador por tarefa (tooltip "N tarefas"); clicar no dia abre a lista do dia;
   - **lista (DataTable)**: barra com Buscar · Filtrar · Ordenar · Exportar, e
     filtros de responsáveis + intervalo de datas.
2. **`exemplo-detalhado-tarefa.html`** — a mesma lista em detalhe (linhas completas:
   Resolvido · Importante · Urgente · Lido · Tarefa · Cliente/Partes ·
   Data compromisso · Prazo fatal · Responsáveis), com paginação
   ("1–50 de N", registros por página) e o **formulário da tarefa**:
   comentário com @menções, Data + Hora, Prazo fatal, anexos, privada (cadeado),
   mostrar na agenda, tarefa futura, responsável (encaminhar),
   "Alteração de etapa processual" e "Notificar cliente? SMS/E-mail".
3. **`exemplo-detalhado-tarefa-time-line.html`** — a **Timeline** (histórico) da
   atividade/processo: filtro (Todas / Agendamentos / Minhas / Pendentes /
   Concluídas / Trocas de fase), feed cronológico com estados
   (criada/editada/excluída/concluída/registrada), "Mostrar edições",
   "Carregar mais antigas" — e, no processo, andamentos + intimações/publicações.

---

## 2. Estado atual (ponto de partida)

**API (`oliveira-api`, branch `OA-04/fundacao-api`)** — em memória, não commitado:
- módulo `tarefa` (tabelas `tarefas` + `tarefas_historico`, V5) e CRUD + `PATCH`;
- módulo `identity/membro` + `setor` (V6) — `GET/POST /membros`, `PATCH /membros/{id}`,
  `GET/POST /setores`;
- `contratos_cliente` + `arquivos_cliente` (V7) + `StorageService` (uploads).
- 105 testes verdes (unit + IT).

**Front (`oliveira-erp`, branch `OE-4/tarefas-na-home`)** — em memória, não commitado:
- `src/pages/erp/Tarefas.tsx` (lista + kanban + KPIs + busca + drawer + "Nova tarefa");
- bloco "Minhas tarefas" na Home, item no menu, rota `/erp/tarefas`;
- `src/lib/api/tarefas.ts` e `src/lib/api/contratos.ts`; `http.ts` com `PATCH` + `FormData`.
- Ainda **não há** provider/botão de tema claro/escuro.

**Schema atual de `tarefas` (V5):** `id, organizacao_id, processo_id, fase,
responsavel_id, titulo, descricao, data_vencimento, concluida, prioridade,
nome_cliente, created_by, created_at, updated_at`.
`tarefas_historico`: `id, organizacao_id, tarefa_id, processo_id, fase,
responsavel_id, acao, executado_por, data_vencimento_original, titulo, descricao,
nome_cliente, prioridade, data_acao, created_at`.

---

## 3. Modelo de dados — mudanças propostas (migração V8)

### 3.1 `tarefas` (colunas novas)
| Coluna | Tipo | Uso |
| --- | --- | --- |
| `contrato_id` | uuid (sem FK, como `processo_id`) | liga a tarefa ao contrato |
| `data_compromisso` | timestamptz | data + hora do compromisso ("mostrar na agenda") |
| `prazo_fatal` | date | prazo-limite (coluna separada do compromisso) |
| `importante` | boolean default false | a estrela |
| `lido` | boolean default false | o "lens" |
| `privada` | boolean default false | o cadeado |
| `tarefa_futura` | boolean default false | o "update" |
| `etapa` | text | etapa processual (entra agora — não é mais slot) |

Índices: `contrato_id`, `data_compromisso`, `prazo_fatal`.

### 3.2 Responsáveis múltiplos
- `tarefas.responsavel_id` continua sendo o **responsável atual**.
- Nova tabela **`tarefa_responsaveis`**: `id, organizacao_id, tarefa_id, usuario_id,
  setor_id, entrou_em, saiu_em` — guarda cada pessoa que respondeu pela tarefa e o
  período (cada um responde pelo **seu andamento**).

### 3.3 Encaminhamentos e estados (timeline)
- Ampliar `tarefas_historico` com `acao` ∈ {`criada`, `editada`, `encaminhada`,
  `concluida`, `reaberta`} e as colunas `de_usuario_id`, `para_usuario_id`, `setor_id`.
- O registro de encaminhamento ("de **X** para **Y**") fica visível a **todos os
  envolvidos** na tarefa.

### 3.4 Interações e anexos da tarefa
- `arquivos_cliente.tarefa_id` (uuid nullable) → permite anexar documentos à tarefa
  (reusa o `StorageService`; mesma pasta por cliente/contrato).
- Nova tabela **`tarefa_interacoes`**: `id, organizacao_id, tarefa_id, autor_id,
  destinatario_id (nullable), tipo ∈ {comentario, solicitacao}, texto, resolvido,
  created_at` — comentários/@menções e o "**solicitar de alguém**".

### 3.5 Notificações (no app)
- Nova tabela **`tarefa_notificacoes`**: `id, organizacao_id, tarefa_id, usuario_id,
  tipo ∈ {atribuida, encaminhada, solicitada}, titulo, lida, created_at`.
- Quem é atribuído/encaminhado/solicitado recebe o aviso **no login, dentro de Tarefas**.

### 3.6 Configuração da área (setor)
- `setores.distribuicao` (jsonb):
  ```json
  {
    "modo": "menos_tarefas",            // menos_tarefas | rodizio | manual
    "escopo_carga": "global",           // global = todas as tarefas abertas do colaborador
    "peso_urgente": true,               // urgente pesa 2 na carga e é sempre priorizado
    "desempate": "rodizio",
    "carteira": [ { "min": 1000, "max": 5000, "usuarios": ["<uuid>"] } ]
  }
  ```
- **Gestor da área**: `membros_setores.lider boolean default false` — quem edita a
  configuração do setor.

### 3.7 Contrato
- `contratos_cliente.valor numeric(15,2)` — necessário para a **carteira por faixa de
  valor** (e útil ao Processo depois).

---

## 4. Regras de negócio

### 4.1 Distribuição de tarefa ao encaminhar (balanceamento de carga)
Ao encaminhar uma tarefa para um setor, o servidor:
1. monta os **candidatos** = membros ativos do setor (`membros_setores`);
2. se houver **carteira por faixa de valor** e o contrato tiver `valor`, mantém só os
   candidatos cuja faixa cobre aquele valor (se **só um** cobre, vai para ele);
3. entre os elegíveis, escolhe o de **menor carga** (nº de tarefas abertas);
4. **empate** → **rodízio**: o próximo depois do **último que recebeu**;
5. grava o encaminhamento ("de X para Y") no histórico e **notifica** os envolvidos.

Sem limite máximo (cap): sempre o de menor carga.
**Urgente é sempre prioridade** — pesa 2 na carga (para não empilhar urgência em quem já
está cheio) e aparece sempre no topo/destaque nas listas e no calendário.
> Ex.: fun1=5, fun2=3, fun3=8 → a tarefa vai para a **fun2**.

### 4.2 Múltiplos responsáveis
A tarefa transita por vários colaboradores; cada um responde pelo seu andamento. O
responsável **atual** aparece na lista; o **histórico** (quem teve, quando) fica na
timeline, visível a todos os envolvidos.

### 4.3 Anexos e interações
A qualquer momento é possível anexar documentos/textos e **solicitar de alguém**
(uma solicitação dentro da tarefa). Quem é solicitado recebe notificação no login.

### 4.4 Timeline
Feed cronológico da tarefa (e do contrato) com filtros (Todas / Agendamentos /
Minhas / Pendentes / Concluídas / Trocas de fase), estados por item
(criada/editada/excluída/concluída/encaminhada), "Mostrar edições" e
"Carregar mais antigas". Andamentos e intimações entram com o módulo Processo.

### 4.5 Slots "(função não implementada)"
Ficam visíveis na UI, desabilitados, até a decisão futura:
- **Notificar cliente** (SMS/E-mail);
- **Exportar** (xlsx/pdf).

A **alteração de etapa processual** entra agora (implementada) — junto do campo
`tarefas.etapa` e do fluxo no formulário da tarefa.

---

## 5. Telas

### T1. Quadro de Tarefas (`/erp/tarefas`) — 3 abas
- **Topo:** cards com a visão geral do próprio usuário (pendentes, atrasadas, hoje,
  concluídas). Sem o gráfico "Atividade".
- **Cabeçalho:** Buscar · Filtrar (responsáveis, intervalo de datas) · Ordenar
  (Tarefa / Partes / Data compromisso / Prazo fatal / Responsável) · Exportar *(slot)*.
- **Aba Lista:** tabela detalhada — marcadores clicáveis Resolvido/Importante/Urgente/
  Lido, Tarefa, Cliente/Partes, Data compromisso, Prazo fatal, Responsáveis, ações —
  com paginação ("1–N de M", registros por página).
- **Aba Calendário:** mês interativo — contagem por dia, marcador por tarefa, tooltip
  "N tarefas", clique abre o dia, setas ◀▶ de mês, "hoje" destacado.
- **Aba Kanban:** reaproveita o que já existe.

### T2. Detalhe/edição da tarefa (drawer/modal)
Comentário (com @menções), Data + Hora, Prazo fatal, anexos, privada, mostrar na
agenda, tarefa futura, responsável (encaminhar), a alteração de etapa processual, e os
slots de notificar cliente / exportar.

### T3. Timeline da tarefa/contrato
Filtros + feed cronológico com estados + "Mostrar edições" + "Carregar mais antigas".

### T4. Configuração da área (só o gestor da área)
Distribuição (modo, escopo da carga, peso de urgência, desempate) e **carteira por
faixa de valor** por colaborador.

### T5. Controle de tarefas por colaborador
Lista com a contagem de tarefas abertas por pessoa (visão do gestor da área / admin).

### T6. Notificações
Badge no menu + lista dentro de Tarefas.

### T0. Tema claro/escuro (global)
Provider + botão no topo do `LayoutErp`, persistido — vale para **todas** as telas.

---

## 6. API — endpoints

| Recurso | Endpoint |
| --- | --- |
| Listar/criar tarefa | `GET /tarefas` (filtros: `minhas`, `responsavelId`, `setorId`, `contratoId`, `concluida`, `importante`, `urgente`, `lido`, `compromissoDe/Ate`, `prazoDe/Ate`, `busca`, `page/size`, `sort`) · `POST /tarefas` |
| Editar/concluir | `PATCH /tarefas/{id}` |
| **Encaminhar** (distribui) | `POST /tarefas/{id}/encaminhar { setorId?, membroId?, mensagem? }` |
| Histórico/timeline | `GET /tarefas/{id}/historico` |
| Interações | `GET/POST /tarefas/{id}/interacoes` |
| Anexos | `GET/POST /tarefas/{id}/arquivos` · `GET /arquivos/{id}/conteudo` · `DELETE /arquivos/{id}` |
| Config da área | `GET/PATCH /setores/{id}/distribuicao` |
| Carga por colaborador | `GET /setores/{id}/carga` |
| Notificações | `GET /notificacoes?tarefas` · `PATCH /notificacoes/{id}/lida` |
| Contrato → tarefas | `POST /clientes/{id}/contratos` dispara as 4 tarefas de setor |

---

## 7. Fases de execução

**Fase A — Consolidar (verificar + commitar)**
- [x] Bateria da API verde (105 testes).
- [ ] Commit/PR na API: membro/setores + contratos/arquivos + docs.
- [ ] Limpar lixo da raiz do `oliveira-erp` e commitar o front de Tarefas.

**Fase C — API: modelo + vínculos + histórico**
- [ ] C1. Migração V8 (colunas + índices + DTO/filtro).
- [ ] C2. `GET /tarefas/{id}/historico` + estados.
- [ ] C3. Anexos e interações da tarefa (`arquivos_cliente.tarefa_id`, `tarefa_interacoes`).
- [ ] C4. Ao criar contrato: 4 tarefas de setor + encaminhar/notificar por setor.
- [ ] C5. Distribuição por carga (menos tarefas + rodízio) no encaminhar.
- [ ] C6. Config da área (`setores.distribuicao`) + gestor (líder do setor).
- [ ] C7. Carteira por faixa de valor (`contratos_cliente.valor` + faixas).
- [ ] C8. Notificações in-app de tarefa.
- [ ] C9. Histórico de responsáveis/encaminhamentos (`tarefa_responsaveis`).
- [ ] C10. Testes de integração (campos, histórico, distribuição, notificações).

**Fase G — Front: Tarefas**
- [ ] G0. Tema claro/escuro global.
- [ ] G1. Quadro/aba Lista (colunas + paginação).
- [ ] G2. Quadro/topo: cards de visão geral.
- [ ] G3. Quadro/cabeçalho: Buscar/Filtrar/Ordenar/Exportar.
- [ ] G4. Quadro/aba Calendário interativo.
- [ ] G5. Quadro/aba Kanban.
- [ ] G6. Detalhe/edição da tarefa.
- [ ] G7. Timeline da tarefa/contrato.
- [ ] G8. Encaminhar (mostrando a carga de cada um, com troca manual) + controle por
      colaborador + config da área + notificações na tela.

**Fases seguintes:** D (Contratos do cliente no front), E (Colaboradores),
F (módulo Processo — andamentos/intimações na timeline).

---

## 8. Decisões

### Registradas (titular)
1. **Múltiplos responsáveis: sim** — cada um responde pelo seu andamento; o
   encaminhamento "de X para Y" fica visível a todos os envolvidos.
2. **TASKSCORE:** fora por enquanto.
3. **Etapa processual** e **Notificar cliente:** só slot "(função não implementada)".
4. **Exportar:** idem, slot por enquanto.
5. **Anexos/interações: sim** — anexar a qualquer momento e "solicitar de alguém",
   com notificação no login.
7. **Desempate:** rodízio (o próximo depois do último que recebeu).
9. **Sem limite por colaborador:** sempre o de menor carga.
10. **Gestor da área já nesta fase** + **carteira de clientes por faixa de valor**.
6. **Escopo da carga:** todas as tarefas abertas do colaborador (qualquer setor).
8. **Urgente: sempre prioridade** — pesa 2 na carga e aparece sempre no topo/destaque.
11. **Alteração de etapa processual:** implementar agora (deixa de ser slot).

### Pendentes
Nenhuma — plano fechado para desenvolvimento.

---

## 9. Critérios de aceite (resumo)
- Encaminhar escolhe o de menor carga; empate por rodízio; carteira por valor filtra
  os elegíveis antes da carga.
- Timeline mostra criada/editada/encaminhada/concluída e "de X para Y" para todos os
  envolvidos; notificações chegam no login.
- Os 4 marcadores (Resolvido/Importante/Urgente/Lido) persistem e refletem na lista e
  no calendário.
- Tema claro/escuro presente em todas as telas e persistido.
- ITs cobrindo: campos novos, histórico, distribuição por carga/rodízio/carteira e
  notificações.
