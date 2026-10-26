# Plano — Integrações externas (status central + fluxo manual de reserva)

> **STATUS (20/10/2026): esta é a PRÓXIMA etapa.** As correções das telas e da API estão
> entregues (PRs #9 e #10, mergeáveis) e as buscas com tipo entraram em Contratos,
> Clientes, Usuários e Tarefas. O que vem agora é este plano: o módulo
> `plataforma/integracao` na API + a tela **Ferramentas → Integrações** no front, fechando
> com a **ViaCEP** ponta a ponta (preenchimento do endereço do cliente com reserva manual).
> Anotada em 20/10/2026, depois do CEP: **Consulta CNPJ (Conecta gov.br)** — ver a seção
> própria no fim do documento (acesso exige credencial de órgão público e IP liberado no
> firewall do SERPRO).

Feature anotada em 19/10/2026 para ETAPA PRÓPRIA (não misturar com a entrega de
códigos dos tribunais). Objetivo: concentrar num lugar só TODA integração externa
que o sistema usa (APIs, robôs de scraping, webhooks), saber se cada uma está no
ar, e — o mais importante — o sistema NUNCA fica amarrado a nenhuma delas.

## O problema hoje

- As integrações vivem espalhadas nas 56 edge functions do Supabase (ADVBOX,
  DataJud, DJEN, ZapSign, Asaas, Meta Ads, Anthropic, CEMADEN, CONAB, CPTec,
  IPEA, SGS, Yahoo, Google Sheets, Firecrawl, NDVI...) e migram para a API
  Spring módulo a módulo.
- O legado tinha um ensaio (`supabase/functions/integrations-status`) que
  checava 6 integrações hardcoded, sem histórico e sem cadastro.
- Sem um status central, quando um terceiro cai ninguém sabe qual é o culpado e
  a tela só "não funciona".

## Regra de ouro (decisão do titular 19/10/2026)

> Se funciona pela integração, segue automatizado. Se a integração está fora do
> ar, o FLUXO CONTINUA MANUALMENTE — o sistema avisa o usuário que a integração
> está indisponível e ele faz o procedimento à mão. A integração cai, o trabalho
> não.

Exemplo canônico (a primeira integração): **CEP — ViaCEP (https://viacep.com.br/)**

- OK → digitar o CEP preenche logradouro, bairro, cidade e UF sozinho.
- Fora do ar → aviso "Consulta de CEP indisponível no momento — preencha o
  endereço manualmente" e os campos continuam abertos para digitação (hoje o
  cadastro de cliente já tem todos eles; o preenchimento automático é o extras).

Todo módulo que depender de integração externa consulta o registry antes de
chamar: responde rápido com o status cacheado; se indisponível, degrada na hora
com a mensagem personalizada em vez de segurar a requisição.

## Desenho aprovado — API (oliveira-api)

1. **`IntegracaoProvedor`** (interface): cada integração é um `@Component` que
   declara `id`, `nome`, `categoria`, `descricao`, **`ondeEhUsada`** (onde no
   sistema ela faz falta — ver abaixo), `urlDocs`, se tem a chave configurada e
   `verificar()` → status + mensagem do motivo + latência. O Spring injeta
   `List<IntegracaoProvedor>` no registry — **nova integração = 1 classe nova**,
   nada de mexer em controller/tabela.
   `ondeEhUsada` é obrigatório: o card precisa dizer para QUEM olha a tela o que
   quebra se aquela API cair. Exemplos:
     ViaCEP — "Cadastro de clientes → bloco de endereço: ao digitar o CEP a
     API preenche logradouro, bairro, cidade e UF sozinho."
     Advbox — "Sincronização diária de clientes, processos, tarefas e agenda."
     ZapSign — "Envio de documentos para assinatura do cliente."
2. **Duas tabelas (migration nova)**:
   `integracao` — o CADASTRO do que usamos: `id_provedor`, `url_base`,
   `descricao_token`, `token_cifrado`, `token_prefixo`, `token_atualizado_em`,
   `ativo` (ver "Cadastro e segredo do token" abaixo).
   `integracao_status` — snapshot do último resultado (status, mensagem, latência,
   verificado_em). O `GET /api/v1/integracoes` lê as duas — tela rápida, sem tocar
   na rede.
3. **Fila de verificação — um teste por vez** (decisão do titular, 20/10/2026):
   os testes NÃO rodam todos de uma vez. A tela abre, dispara a fila
   (`POST /api/v1/integracoes/verificar`), e o servidor processa **UMA integração de
   cada vez**, na ordem da fila (cada uma com timeout de 8 s) — assim não chamamos
   todas as APIs externas na mesma batida. `GET /api/v1/integracoes` lê o snapshot
   (`integracao_status`) e a tela vai pintando cada card conforme a fila entrega o
   resultado dele.
   O `@Scheduled` de ~10 min continua, mas também varre **em fila** (mesma ordem,
   mesmo um-por-vez) — só para o snapshot não ficar velho quando ninguém abriu a tela.
4. **Cadastro pela tela (só admin)**: URL base, descrição do token e o próprio
   token (cifrado) — ver a seção seguinte.
5. **Exceção `IntegracaoIndisponivel`** no handler RFC 7807 → HTTP 503 com a
   mensagem personalizada da integração. Chamada externa SEMPRE com timeout
   curto: fora → responde na hora, não trava o fluxo nem a API inteira.

## Cadastro e segredo do token (20/10/2026)

- **URL base cadastrada, código só monta**: admin cadastra a URL BASE da
  integração, e todo código que chama aquela API monta a partir dela
  (`{urlBase}/ws/{cep}/json/`, `{urlBase}/api/v1/settings`). Nenhuma URL fica
  escrita no código — trocar produção por homologação é mudar o cadastro, sem
  novo build.
- **`descricao_token`**: campo de texto com o PROCESSO de geração do token — o
  fluxo (ex.: "OAuth2 client_credentials em /oauth2/jwt-token, expira em 30 min")
  ou a frase "sem token — a API é pública e responde direto". Serve para quem
  for renovar a credencial não precisar voltar ao fornecedor nem abrir o código.
- **Token cifrado, e só a API decifra**: o token chega em texto pelo
  `POST/PATCH /integracoes/{id}` (por HTTPS) e a API **cifra antes de gravar**
  (AES-GCM 256 — o mesmo padrão e a mesma propriedade do TOTP:
  `api.segredo.integracao-chave`, por variável de ambiente em produção). Na hora
  de usar, o provedor decifra em memória; **nenhum endpoint devolve o token** —
  a resposta traz só o prefixo e quando foi atualizado. Nem o admin vê o token
  depois de salvo (igual aos códigos dos tribunais).
- **Endpoints**: `POST /integracoes` e `PATCH /integracoes/{id}` (admin) aceitam
  `urlBase`, `descricaoToken` e `token` (write-only, opcional);
  `GET /integracoes` devolve `urlBase`, `descricaoToken`, `tokenPrefixo` e
  `tokenAtualizadoEm` — nunca o token.

## Desenho aprovado — front (oliveira-erp)

6. Menu **Ferramentas → Integrações**: cards com o nome, a categoria e o
   resultado visual do teste:
     **verde ✓** no ar (respondeu dentro do esperado)
     **vermelho ✗** fora do ar (com o motivo e a latência)
     **cinza ·** não configurada (falta credencial)
   Cada card mostra também a última verificação, a latência e a linha de
   **onde aquela integração é usada** (o `ondeEhUsada` do provedor) — é o que
   transforma o card em informação para o usuário comum.
7. **Sem controle de permissão nenhuma nesta tela** (decisão do titular,
   20/10/2026): qualquer usuário autenticado abre, vê o resultado e dispara a
   verificação — o botão "Verificar agora" está liberado para todo mundo (o
   teste só bate na API de terceiros, nada de escrita). O cadastro/edição de
   credencial continua admin, porque é segredo.
8. Ao abrir a tela, o front dispara a fila e **atualiza os cards um a um**
   conforme cada teste termina (polling de ~2 s em `GET /integracoes` enquanto a
   fila roda; para quando não resta teste pendente). Abrir a tela de novo não
   empilha fila: se já houver uma rodando, ela só acompanha.

## Primeira integração: ViaCEP

- **Onde é usada**: tela de **cadastro de clientes → bloco de endereço** — ao
  digitar o CEP a API é consultada e traz o endereço completo (logradouro,
  bairro, cidade e UF), gravando junto os códigos IBGE da V16. É a linha que
  aparece no card da integração.
- URL: `https://viacep.com.br/ws/{cep}/json/` (API pública, sem chave).
- Sonda: CEP válido de teste (ex.: 01001-000) esperando `ok: true`.
- Uso no cadastro de cliente (endereços): preencher automaticamente quando OK;
  quando fora, aviso + campos manuais (os campos já existem — V17 endereços).
- Mensagem de indisponibilidade: "Consulta de CEP (ViaCEP) indisponível no
  momento — preencha o endereço manualmente."

## Próxima anotada: Consulta CNPJ — Conecta gov.br (SERPRO)

Anotada em 20/10/2026, ainda **sem implementação** — só entra na fila depois do
CEP. Catálogo: https://www.gov.br/conecta/catalogo/apis/consulta-cnpj
(Swagger: `.../apis/consulta-cnpj/swagger_api_cnpj.md/swagger_view`).

- **O que entrega**: dados não sigilosos da Receita Federal em três serviços que
  só diferem pela quantidade de campos — Básica (identificação, situação
  cadastral, CNAE, endereço), QSA (quadro de sócios e administradores) e Empresa
  (tudo, detalhado).
- **Endpoints de produção** (base `https://apigateway.conectagov.estaleiro.serpro.gov.br`):
  `/api-cnpj-basica/v2/basica/`, `/api-cnpj-qsa/v2/qsa/`,
  `/api-cnpj-empresa/v2/empresa/`.
- **Homologação** (base `https://h-apigateway.conectagov.np.estaleiro.serpro.gov.br`):
  mesmos caminhos `/v2/...`; CNPJs de teste: `90026000000153`, `30202699000133`,
  `90009736000113`, `10422241000182` (e os alfanuméricos `6TS1HJ0S000170`,
  `B2SLG07D000115`, `H4KR4PKR000173`, `4J1ZE13P000140`, `7EXHVL29000111`).
- **Autenticação**: OAuth2 client_credentials. `POST {base}/oauth2/jwt-token`,
  header `Authorization: Basic base64(client_id:client_secret)`, corpo
  `grant_type=client_credentials` → `access_token` para as consultas.
- **Dois bloqueios que não são de código**: (1) a API é liberada para **órgãos e
  entidades da Administração Pública** (Portaria RFB 1384/2016) — escritório
  privado provavelmente não obtém credencial; (2) é preciso **cadastrar os IPs do
  consumidor** para o firewall do SERPRO, o que conflita com edge function
  (IPs rotativos): só funcionaria chamando de um servidor com IP fixo.
- **Plano**: como sonda/registro, entra no registry igual às outras (id
  `conecta_cnpj`, categoria Cadastro, sem chave = "Não configurada", mensagem
  explicando a exigência de IP liberado). Para uso real no cadastro de cliente,
  preferir fallback público (BrasilAPI/ReceitaWS) e manter o Conecta anotado como
  opção oficial — o preenchimento manual continua sendo a reserva.
- **Onde seria usada**: cadastro de clientes → ao digitar o CNPJ, trazer razão
  social, situação cadastral, CNAE e endereço (é o que o card diria).
- **Teste de alcance (20/10/2026)**: do PC do escritório o DNS resolve
  (`189.9.168.140`) mas o TCP 443 não completa — `curl` termina com HTTP 000,
  sem conectar. Ou seja, nem dá para sondar sem antes existir liberação de saída
  na rede e IP cadastrado no SERPRO.

## Ordem de execução (etapa atual)

- [ ] V19 `integracao` (url_base, descricao_token, token_cifrado) +
      `integracao_status` + `IntegracaoProvedor` + registry + **fila de
      verificação (um teste por vez)** + `@Scheduled` varrendo em fila
- [ ] `GET /integracoes` (snapshot lido da tabela, sem nunca devolver o token) ·
      `POST /integracoes/verificar` (dispara a fila, **sem gate**) ·
      `POST /integracoes` + `PATCH/DELETE /{id}` (cadastro, só admin; o token
      é cifrado antes de gravar)
- [ ] Tela **Ferramentas → Integrações**: **sem permissão nenhuma** (qualquer
      usuário autenticado abre e dispara), cards com **verde ✓ / vermelho ✗ /
      cinza ·**, atualizando um a um conforme a fila entrega cada resultado
- [ ] ViaCEP: sonda + preenchimento automático no endereço do cliente com
      fallback manual (primeira integração ponta a ponta)
- [ ] Migrar as demais integrações conforme os módulos saem do Supabase
      (ADVBOX, DataJud, DJEN, ZapSign...), cada uma com sua mensagem de reserva
- [ ] CNPJ: sonda da Consulta CNPJ (Conecta gov.br) anotada no registry +
      preenchimento do cadastro de cliente por API pública, com reserva manual

## Decisões do titular (20/10/2026)

1. **Fila, não bateria**: ao abrir a tela de Integrações os testes rodam **um de
   cada vez**, na ordem da fila — não chamamos todas as APIs externas na mesma
   batida.
2. **Visual**: cada integração responde com um ícone — **verde** no ar,
   **vermelho** com falha (e o motivo), **cinza** não configurada.
3. **Tela sem permissão**: a tela é visível e operável por **todos os usuários
   autenticados**, sem controle por papel ou módulo. Só o cadastro de credencial
   continua admin, porque é segredo.
4. **Cadastro de nova integração: só admin** (confirmado em 20/10/2026). O
   usuário comum só VÊ se cada uma está no ar — verde, vermelho ou cinza.
5. **Descrição de uso obrigatória**: toda integração entra no registry com a
   linha de onde ela é usada no sistema (tela + o que ela faz ali). Sem isso o
   card não informa nada para quem não construiu o sistema.
6. **URL base no cadastro**: a URL base é cadastrada na tela e o código só monta
   a partir dela — nenhuma URL hardcodada (20/10/2026).
7. **Token cifrado**: o token vai para o banco cifrado (AES-GCM 256, mesma chave
   do TOTP) e nunca volta em resposta de endpoint; o provedor decifra em memória
   na hora de chamar (20/10/2026).
