# Plano — Integrações externas (status central + fluxo manual de reserva)

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
   declara `id`, `nome`, `categoria`, `descricao`, `urlDocs`, se tem a chave
   configurada e `verificar()` → status + mensagem do motivo + latência. O
   Spring injeta `List<IntegracaoProvedor>` no registry — **nova integração =
   1 classe nova**, nada de mexer em controller/tabela.
2. **Tabela `integracao_status`** (migration nova): snapshot do último
   resultado por integração (status, mensagem, latência, verificado_em). O
   `GET /api/v1/integracoes` lê a tabela — tela rápida, sem tocar na rede.
3. **`@Scheduled`** a cada ~10 min sonda todas em paralelo (timeout de 8 s
   cada) e grava o snapshot.
4. **Cadastro pela tela**: admin registra a URL/base de cada integração que
   usamos (e credencial quando houver — gravada no servidor, nunca no front).
5. **Exceção `IntegracaoIndisponivel`** no handler RFC 7807 → HTTP 503 com a
   mensagem personalizada da integração. Chamada externa SEMPRE com timeout
   curto: fora → responde na hora, não trava o fluxo nem a API inteira.

## Desenho aprovado — front (oliveira-erp)

6. Menu **Ferramentas → Integrações**: cards com badge "No ar / Fora do ar /
   Não configurada", latência, última verificação e o motivo. **Visualização
   para TODOS os usuários** (cada um enxerga o que depende do seu dia a dia).
7. Cadastro/edição de integração e botão "Verificar agora": **só admin**.

## Primeira integração: ViaCEP

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
- **Teste de alcance (20/10/2026)**: do PC do escritório o DNS resolve
  (`189.9.168.140`) mas o TCP 443 não completa — `curl` termina com HTTP 000,
  sem conectar. Ou seja, nem dá para sondar sem antes existir liberação de saída
  na rede e IP cadastrado no SERPRO.

## Ordem de execução (etapa futura)

- [ ] V19 `integracao_status` + `IntegracaoProvedor` + registry + scheduler
- [ ] `GET /integracoes` (todos) · `POST /integracoes` + `/{id}/verificar` (admin)
- [ ] Tela Ferramentas → Integrações (leitura todos; gestão admin)
- [ ] ViaCEP: sonda + preenchimento automático no endereço do cliente com
      fallback manual (primeira integração ponta a ponta)
- [ ] Migrar as demais integrações conforme os módulos saem do Supabase
      (ADVBOX, DataJud, DJEN, ZapSign...), cada uma com sua mensagem de reserva
- [ ] CNPJ: sonda da Consulta CNPJ (Conecta gov.br) anotada no registry +
      preenchimento do cadastro de cliente por API pública, com reserva manual
