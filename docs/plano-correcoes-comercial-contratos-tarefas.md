# Plano — Correções de Contratos, Tarefas e menu Comercial

> **Status:** em análise (titular) — 22/10/2026
> **Origem de tudo:** `correcoes sistema erp oliveira.md` (pedido do titular, 6 correções).
> Nenhum item vem de plano/plano de trás: cada correção abaixo cita o trecho do arquivo de origem.
> **Fonte de referência:** `/projetos/fontes-sistema-antigo` (sistema antigo) sempre que o pedido diz "espelhar o fonte".

Planos relacionados já existentes: `docs/plano-contratos-e-timeline.md` (fases 1-3 já entregues), `docs/plano-tarefas.md`.

---

## 1. Leitura central (o que os dois lados mostram hoje)

**ERP atual (oliveira-erp + oliveira-api):**
- Contratos do escritório com o cliente: tabela `contratos_cliente` (Flyway `V7__contratos_cliente.sql`), anexos em `arquivos_cliente` (caminho `uploads/<slug-cliente>/<numero>/`, leitura só por `GET /arquivos/{id}/conteudo`).
- Tarefas: API própria (`src/lib/api/tarefas.ts`), anexos só no encaminhar (`tarefas_anexos` pendurado na linha do histórico), `prazoFatal` já existe no modelo mas não tem campo na tela.
- Menu ERP: JSX direto em `src/components/erp/LayoutErp.tsx` — hoje "Contratos Clientes" está no grupo **Clientes** (`LayoutErp.tsx:182-186`). Não existe grupo "Comercial" no shell `/erp`.
- Tabelas novas nascem na API Spring (Flyway), nunca no Supabase (`docs/CONVENCOES.md:18`). Última: `V18__tribunal_codigos.sql`.

**Sistema antigo (referência):**
- Contrato cliente × banco vive em `contratos_vencimentos` (migration supabase `20260318033122…`): um cliente com N contratos — banco, nº, valor total, valor da parcela, 1º vencimento, próximo vencimento, último vencimento, observações.
- Exibição espelhada no `ClienteDetalhe.tsx:673-722`: lista de linhas por contrato (banco + nº à esquerda; total, parcela, 1º, Próx, Último à direita), cadastro via `EditClienteDialog.tsx` com 7 campos por contrato.

**Ponto de dependência que amarra 3 correções:** a API ainda **não tem tabela `processos`** — `tarefas.processo_id` e `arquivos_cliente.processo_id` existem sem FK por decisão registrada em `V5__tarefa.sql:10` e `V7:13-14` ("a tabela `processos` entra com o módulo processo, fora desta fase"). Tudo que pede "processo" hoje (item 4 e item 6) depende ou dessa decisão ou de uma consulta ao legado — ver **Decisões em aberto (D2, D5)**.

---

## 2. As 6 correções e o que muda em cada uma

### Correção 1 — Anexo do contrato visível na expansão da lista
*Origem: "nos contratos temos a opção de vincular o arquivo, mais não conseguimos visualizar… na lista de contratos quando expande vemos descrição, podemos incluir abaixo de descrição os anexos vinculados"*

Hoje a expansão mostra só a descrição (`src/components/erp/DetalheContrato.tsx:17-27`, montada em `src/pages/erp/Contratos.tsx:306-312` e no dialog `ContratosClienteDialog.tsx:589-597`). O contrato não tem coluna de anexo: os arquivos ficam em `arquivos_cliente` já com FK `contrato_id` (`V7:37-49`).

A API **já tem** tudo: `GET /contratos/{id}/arquivos` (front já tem `listarArquivos()` em `src/lib/api/contratos.ts:111-113` — nunca chamada) e `GET /arquivos/{id}/conteudo` (`ContratoController.java:154-167`). Falta só o front.

Mudanças:
1. `src/lib/api/contratos.ts` — criar `baixarArquivoContrato(id, nome)` usando o helper `baixarArquivo()` (`src/lib/api/http.ts:228`) apontando para `/arquivos/{id}/conteudo`.
2. `src/components/erp/DetalheContrato.tsx` — abaixo da descrição, seção "Anexos": ao abrir a expansão busca `listarArquivos(contrato.id)` (1 request por linha expandida; nada de carregar tudo na "Expandir tudo") e renderiza no padrão da trilha de tarefa (`src/components/erp/TarefaMovimentacao.tsx:138-158`: Paperclip + nome + tamanho + botão baixar). Sem anexo → "Sem anexos."
3. `src/lib/contratoDetalhes.ts:13-15` — `temDetalhes()` passa a considerar anexo (hoje contrato com anexo e sem descrição fica com seta cinza).
4. `src/components/erp/ContratosClienteDialog.tsx` — mesmo componente na expansão (:589-597) recebe a correção automaticamente; **e** no modo edição passa a listar os anexos já gravados em vez de zerar a fila (:162, :182, :483).
5. Testes: ajustar `src/pages/erp/__tests__/Contratos.test.tsx:60-69` e `ContratosClienteDialog.test.tsx:76-112` ("seta abre só a descrição") + caso novo: expansão lista o anexo e o download chama o endpoint.

Tamanho: **P** (front + testes, sem migração).

---

### Correção 2 — Anexo do contrato no histórico da tarefa
*Origem: "no histórico da tarefa também não está mostrando o arquivo anexado do contrato… só não mostra o primeiro item quando gera o contrato"*

Causa encontrada (2 motivos):
1. A tarefa nascida do contrato só tem a linha `ACAO_CRIADA`; os arquivos do contrato ficam em `arquivos_cliente` e **nada** os copia para `tarefas_anexos` (`TarefaService.java:166-213` grava só a linha; a leitura da trilha descarta anexo sem `historico_id`, `TarefaService.java:652-666`).
2. A tarefa criada pelo dialog (`EncaminharContratoTarefa.tsx:77-84`) **nem manda `contratoId`** — nasce órfã do contrato (`src/lib/api/tarefas.ts:44-45`; as tarefas de setor da API têm o vínculo, `ContratoService.java:249`).

Mudanças (abordagem front, sem mexer no backend):
1. `src/components/erp/EncaminharContratoTarefa.tsx` — receber `contratoId` nas props (:42-53) e enviar em `criarTarefa`.
2. `src/pages/erp/Tarefas.tsx:572` — passar a tarefa completa (com `contratoId`, já disponível em `:131`) ao `TarefaTimeline`.
3. `src/components/erp/TarefaMovimentacao.tsx:48` — `TarefaTimeline` ganha prop `contratoId`; na linha `criada` de tarefa com contrato, lista `listarArquivos(contratoId)` com download via `/arquivos/{id}/conteudo` (cache por `contratoId` para não rebuscar em cada render).

Não reabre a timeline própria de `contrato_historico` — descartada pelo titular em 20/10 (`docs/plano-contratos-e-timeline.md:172`).

Tamanho: **P**.

---

### Correção 3 — Menu "Comercial" com "Contratos Cliente"
*Origem: "vamos mudar para Contratos Cliente para um novo menu chamado Comercial"*

1. `src/components/erp/LayoutErp.tsx` — novo grupo `<p>Comercial</p>` no padrão dos grupos atuais (:176-180); mover para lá o item de :182-186 com o rótulo **"Contratos Cliente"** (hoje "Contratos Clientes"), destino continua `/erp/contratos`.
2. `src/pages/erp/Contratos.tsx:166` — rótulo interno da tela acompanha ("Contratos Cliente").

Sem migração, sem rota nova. Tamanho: **P**.

---

### Correção 4 — Contratos do cliente com o banco (novo módulo, espelho do fonte antigo)
*Origem: "criar um novo menu de Contratos dentro de Clientes… espelho do fonte onde temos o contrato do cliente com o banco… um único cliente com vários contratos, datas de vencimento, valores… nova tabela no banco"*

**Referência do fonte antigo** (espelhar fielmente a parte operacional):
- Modelo: `contratos_vencimentos` — colunas a espelhar: `banco`, `numero_contrato`, `valor_total_operacao numeric(15,2)`, `valor_parcela numeric(15,2)`, `primeiro_vencimento date`, `vencimento_proxima_parcela date`, `vencimento_ultima_parcela date`, `observacoes text` (+ `organizacao_id`, `cliente_id`, controle de auditoria). **Fora do escopo** (eram do módulo Vencimentos/portal do antigo): laudo, protocolo, notificação, `status_prazo`, `resolvido`.
- UI de cadastro: `EditClienteDialog.tsx:166-297` — por contrato: Banco (lista fixa BB/Caixa/Bradesco/Itaú/Santander/Sicoob/Sicredi/Cresol/Banrisul/BNB/BASA/BNDES/Safra/CNH/BTG/ABC/Rabobank + "Outro" com texto livre), Nº do Contrato, Valor Total, Valor Parcela, 1º Vencimento, Próximo Vencimento, Último Vencimento; ações de editar/deletar por linha.
- UI de exibição: `ClienteDetalhe.tsx:688-717` — linhas com banco + nº à esquerda e os 5 valores/datas à direita.

Mudanças:
1. **Migração Flyway** (número: ver D4) `Vn__contratos_cliente_banco.sql` — tabela `contratos_cliente_banco`: `id, organizacao_id, cliente_id (FK clientes), banco, numero_contrato, valor_total_operacao, valor_parcela, primeiro_vencimento, vencimento_proxima_parcela, vencimento_ultima_parcela, observacoes, created_by, created_at, updated_at` + índice por `cliente_id` e `organizacao_id`. Formato segue `V10__contrato_objeto.sql` (comentário de decisões no topo).
2. **API Spring** — módulo em `com.oliveira.cliente` (ao lado do módulo contratos): entidade, repository, service, controller `GET/POST/PUT/DELETE /contratos-banco` (filtro por `clienteId`/`banco`/`cliente`), DTO de visualização, mesmas checagens de organização do `ContratoService`.
3. **Front — cliente HTTP** `src/lib/api/contratosBanco.ts` no padrão de `contratos.ts`.
4. **Front — item de menu** "Contratos" dentro do grupo **Clientes** em `LayoutErp.tsx` (destino `/erp/contratos-banco`), com `lazyRetry` + `registrarRotas` + `<Route>` filho de `/erp` (`src/App.tsx:15-28`, `206-216`, `292-305`).
5. **Front — tela** `src/pages/erp/ContratosBanco.tsx`: lista geral (cabeçalho Cliente, Banco, Nº, Valor total, Parcela, 1º venc., Próx. venc., Últ. venc.) com busca por cliente/banco.
6. **Front — na tela de clientes**: o botão "Contratos" da linha (`src/pages/erp/Clientes.tsx:677-686`) passa a abrir o dialog com **duas seções/abas**: "Com o escritório" (o `ContratosClienteDialog` atual) e "Com o banco" (novo componente no espelho do `EditClienteDialog` antigo). Assim fica atendido "clicar no cliente → ver os contratos com o escritório e com o banco".
7. Testes: `ContratosBanco.test.tsx` (mock de API, padrão de `Contratos.test.tsx`) + ajuste do dialog de cliente.

Tamanho: **G** (é o maior bloco: migração + módulo API + tela nova + dialog).

---

### Correção 5 — Tarefas: cards viram filtro, formulário reordenado, tipo, recorrência, anexos
*Origem: bullets 5 do arquivo (cards; ordem cliente→processo; data fatal; recorrência; tipo de tarefa; anexos)*

**(a) Cards → filtro** — hoje texto fixo (`src/pages/erp/Tarefas.tsx:456-465`: Total/Pendentes/Atrasadas/Concluídas). `KpiCard` já repassa `onClick` (`src/components/ui/kpi-card.tsx:63-114`). Criar estado `cardFiltro` (1 por vez; clicar no já selecionado limpa e volta a "Total"); aplicar no corte de tarefas; indicador visual de selecionado (borda/tone). Padrão pronto a copiar: o chip do calendário com "Limpar" (`Tarefas.tsx:479-494`, `diaSelecionado` em `:126`, zera página em `:354`). **Pendência de regra**: kanban agrupa por `dataVencimento` (:343-351) e lista/calendário por `prazoDaTarefa()` (fatal ?? vencimento) — o card "Atrasadas" precisa de uma regra única (ver D6).

**(b) Formulário reordenado** — `DialogNovaTarefa` (`Tarefas.tsx:1002-1277`), ordem nova conforme o pedido:
1. **Cliente** (1º): `ClienteBusca` já existe (:1180-1185) — subir para o topo; hoje o id não vai para a API (só `nomeCliente`), e sem `clienteId` não há como buscar os processos do cliente → **ver D1**.
2. **Processo** (2º, opcional): seletor filtrado pelo cliente; `processoId` já é aceito pela API (`tarefas.ts:59`) mas nunca enviado (:1095-1103). Enquanto não existe tabela `processos`, fica como? → **D2**.
3. **Data Vencimento** (quando precisa ser feito) + **Data Fatal** (último prazo do designado): `prazoFatal` já existe na API (`tarefas.ts:30,57,92`) e já é coluna da lista (`TarefasLista.tsx:140-147`) — falta o campo digitável.
4. **Recorrência**: select Única / Diária / Semanal / Mensal; exige coluna nova na migração (ver D3). Precedente de UI no Acordos (`src/pages/Acordos.tsx:201-207`).
5. **Tipo de tarefa**: select de tipos pré-cadastrados; nova tabela + nova tela de cadastro (abaixo).
6. **Anexos**: na criação a API é JSON puro (`tarefas.ts:134-136`) — criar `GET/POST /tarefas/{id}/arquivos` (previstos já no `docs/plano-tarefas.md:206`), criar a tarefa e subir os arquivos em seguida, pendurados na linha `criada` (padrão do contrato). Isso também deixa `TarefaMovimentacao` capaz de listar anexos já existentes na abertura.

**Nova tela — cadastro de tipos de tarefa**: tabela `tarefa_tipos` (`id, organizacao_id, nome, ativo, auditoria`); tela `/erp/tipos-tarefa` no padrão CRUD de Setores/Funções (admin, grupo Cadastro em `LayoutErp.tsx:208-220`).

**O que a API ganha** (migração única com a de D1/D3): `tarefas.tipo_id` (FK `tarefa_tipos`), `tarefas.cliente_id` (FK `clientes`; `nome_cliente` continua sendo preenchido junto para compatibilidade), `tarefas.recorrencia` (texto: unica|diaria|semanal|mensal). **Título deixa de ser digitado na tela** — passa a ser o nome do tipo (a API continua aceitando `titulo`, sem quebra: busca e histórico continuam funcionando).

**Detalhe da tarefa** (`DetalheTarefa`, `Tarefas.tsx:735-998`): exibir/editar tipo, data fatal, recorrência (hoje vencimento é somente leitura, :913-918).
**EncaminharContratoTarefa** herda os novos campos (título fixo passa a vir do tipo).

**(c) Anexos: clicar OU arrastar em todo o sistema** — já existem 8 telas com drag & drop (modelo a copiar: `FaseContent.tsx:274-292`, `ClienteDrive.tsx:262-289`, entre outras) e ~19 telas só com clique. Criar componente compartilhado `src/components/ui/CaixaAnexo` (clique abre o seletor, arrastar solta, `multiple`) e migrar as telas da lista levantada — o pedido diz "corrigir de todas as funções que chamam anexo no sistema" (ver D7 para confirmar o escopo da migração).

Tamanho: **G** (migração + 2 tabelas + tela de tipos + form + endpoints de anexo).

---

### Correção 6 — Filtros da tela de tarefas e filtro por coluna
*Origem: último bullet do arquivo (menu de filtro com Processo; remover título; filtro por coluna na lista de tarefas e de clientes)*

1. **Processo no menu de filtro** — o select "Tipo de busca" (`Tarefas.tsx:106-110`, `CAMPOS_BUSCA`) ganha a opção "Processo" (`FiltroTarefas.processoId` já é suportado pela API em `tarefas.ts:114,126`). Para **mostrar** o processo na linha (não só filtrar), a API devolve só o UUID — exibir rótulo/número depende do módulo processos → **D5**.
2. **Remover campo título** — o título passa a vir do tipo pré-cadastrado (correção 5b); em `CAMPOS_BUSCA` o rótulo "Título" vira "Tipo de tarefa" apontando para o mesmo campo `titulo` (que agora guarda o tipo) — sem mudança de backend, a busca continua batendo.
3. **Filtro por coluna na lista de tarefas** — a lista é em memória (recorte de até 200 itens, `TarefasLista.tsx:48-53`), então o filtro por coluna é local: pequeno `Input` sob cada `TableHead` (colunas: descrição/tipo, cliente, processo, vencimento, prazo fatal, setor).
4. **Filtro por coluna na lista de clientes** — a listagem é paginada na API (`Clientes.tsx:557-560`); a API **já aceita** `nome`, `cpfCnpj`, `situacao` (`src/lib/api/clientes.ts:94-104`, `ClienteCamposFiltro.java:12-33`) — os inputs das colunas enviam esses parâmetros; município e telefone precisam de parâmetro novo na API (adição pequena) → **D8**.

Tamanho: **M**.

---

## 3. Fases de execução (ordem proposta)

| Fase | Conteúdo | Correções | Tamanho |
|---|---|---|---|
| 1 | Anexos de contrato visíveis + anexo no histórico da tarefa | 1, 2 | P+P |
| 2 | Menu Comercial / "Contratos Cliente" | 3 | P |
| 3 | Contrato cliente × banco: migração + API + tela + dialog com duas seções | 4 | G |
| 4 | Tarefas: migração (cliente_id, tipo_id, recorrencia, `tarefa_tipos`), tela de tipos, form reordenado, data fatal, anexos na criação, cards-filtro | 5 (a, b) | G |
| 5 | Filtros: Processo, remover título, filtro por coluna (tarefas e clientes) | 6 | M |
| 6 | Componente `CaixaAnexo` (clique + arrastar) e migração das telas | 5 (c) | M |

Cada fase fecha com commit + testes verdes (`npm test`), na rotina de branch por correção (`docs/PADRAO-GIT.md`). Fases 1-2 são independentes; 3 e 4 não se tocam; 5 depende parcialmente de 4 (tipo de tarefa) e de D2/D5 (processo).

---

## 4. Decisões em aberto (para análise)

- **D1 — `cliente_id` em `tarefas`**: incluir a coluna (FK clientes, mantendo `nome_cliente`) para o seletor de cliente ser de verdade e permitir buscar processos do cliente? *Recomendação: sim — é o que destrava "cliente primeiro, processo em seguida".*
- **D2 — seletor de Processo**: enquanto a API não tem tabela `processos`, (a) deixar o campo desabilitado com aviso "módulo de processos em breve" ou (b) puxar a lista do sistema legado (Supabase, tabela `processos` do ADVBOX) só para exibição? *Recomendação: (a) — legado é por nome e cria amarração frágil; a decisão registrada em V5/V7 já prevê o módulo processo entrando depois.*
- **D3 — Recorrência**: gravar o campo agora e gerar as tarefas futuras numa etapa posterior (gatilho/lote), ou já gerar as instâncias na criação? *Recomendação: gravar por ora + gerar automaticamente numa próxima fase — gerar tudo de uma vez atrasa demais a correção do formulário.*
- **D4 — Número da migração nova**: `docs/PROGRESSO.md:421` já reserva **V19** para `integracao_status` e há resíduo de build (`target/classes/.../V19__contrato_historico.sql`, plano descartado em 20/10). *Recomendação: usar **V20** e confirmar com `flyway_schema_history` que V19 não foi aplicada em lugar nenhum.*
- **D5 — Processo na lista de tarefas**: mostrar o UUID do processo na coluna, ou só liberar o filtro sem exibir? *Recomendação: exibir só quando o módulo processo existir; por ora, filtro por processoId já atende.*
- **D6 — Regra única de "Atrasadas"**: usar `prazoFatal ?? dataVencimento` (regra da lista/calendário) também no kanban e nos cards? *Recomendação: sim, `prazoDaTarefa()` em tudo.*
- **D7 — Escopo do drag & drop**: migrar as ~19 telas todas de uma vez, ou só as do escopo destas correções (tarefas + contratos) e o resto numa frente própria? *Recomendação: componente novo + migrar todas nesta fase 6 — o pedido foi explícito ("todas as funções que chamam anexo").*
- **D8 — Filtro por coluna em clientes**: restringir às colunas que a API já filtra (nome, cpf/CNPJ, situação) ou estender a API com município/telefone? *Recomendação: estender — é parâmetro pequeno em `ClienteCamposFiltro`.*
- **D10 — Cadastro de bancos (titular, 22/10)**: descartado no primeiro momento (bastava a inversão das telas), o titular REABRIU o item: menu **Cadastro → Bancos** (tabela `bancos` por organização, V22, CRUD admin/ceo) alimentando o seletor de banco do formulário de contrato do Comercial, mantendo a opção "Outro" (texto livre) dos fontes.
- **D9 — Processos do cliente na tela de contratos (correção 4)**: o pedido quer ver "os processos, caso possua" — sem tabela `processos` na API, deixar a seção prevista/placeholder nesta fase? *Recomendação: sim, seção com aviso e sem dados até o módulo processo.*
