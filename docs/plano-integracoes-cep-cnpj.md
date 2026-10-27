# Plano — Integração Invertexto (CEP + CNPJ) no cadastro de cliente

> **Status:** em análise (titular) — 26/10/2026
> **Origem:** pedido direto do titular (26/10/2026): "usar a integração de preenchimento de
> endereço por CEP e dados de uma empresa com endereço por CNPJ, usar a API
> https://api.invertexto.com, cadastrar na aba de Integrações (url, apikey, limite de
> requisições/mês) e fazer um contador de requisições".

## Leitura central (o que existe hoje)

- **API Invertexto** (contrato levantado): autenticação por `token` (a "apikey"), como query
  `?token=` ou header `Authorization: Bearer`. Dois endpoints úteis:
  - `GET https://api.invertexto.com/v1/cep/{cep}` → logradouro, bairro, localidade, uf, cep.
  - `GET https://api.invertexto.com/v1/cnpj/{cnpj}` → razão social, situação, CNAE, sócios,
    endereço, município/UF, CEP, capital social.
  - Planos: Gratuito 3.000 req/mês · Básico R$49 100k · Premium R$99 1M — o "limite/mês"
    digitado na tela é o limite do plano contratado.
- **Aba Integrações**: `src/components/IntegracoesPanel.tsx`, usada em
  `/configuracoes` (`src/pages/Configuracoes.tsx`). Hoje é o painel LEGADO (Supabase:
  `supabase.functions.invoke("integrations-status")`), com cards de status e um
  `ApiKeysManager`. Não tem hoje como salvar url/apikey/limite de uma integração nossa.
- **Cadastro de cliente (shell ERP)**: `src/pages/erp/Clientes.tsx` — cliente tem `nome`,
  `cpfCnpj` e ENDEREÇOS 1..N (`LinhaEndereco`: tipo, logradouro, municipio, uf, ibgeCidade,
  ibgeEstado, cep, principal). Cidades IBGE já vêm de `src/lib/api/localidade.ts` (V16).
- **API Spring (oliveira-api)**: ainda NÃO tem tabela nem endpoint de configuração de
  integração nem de log de requisições — seria novidade.

## O que muda (por camada)

### Banco (Flyway, nova migração V25+)
- `integracoes` (por organização): `id, organizacao_id, chave (ex.: 'invertexto'),
  url_base, apikey, limite_mes, ativa, created_by, created_at, updated_at` — UNIQUE
  (`organizacao_id`, `chave`).
- `integracao_requisicoes`: log de CADA chamada (`id, integracao_id, tipo ('cep'|'cnpj'),
  identificador (cep/cnpj consultado), created_at`) — é por aqui que o contador soma o mês.

### API Spring
- CRUD de configuração da integração (admin): salvar/ler `url_base`, `apikey`,
  `limite_mes` em `integracoes`.
- **Proxy** (a apikey NUNCA vai para o navegador): `GET /integracoes/cep/{cep}` e
  `GET /integracoes/cnpj/{cnpj}` — a API lê a apikey gravada, chama a Invertexto, grava a
  linha em `integracao_requisicoes` e devolve os dados mapeados. Antes de chamar, confere o
  contador do mês contra `limite_mes` (bloqueia com 429/aviso se estourar).
- `GET /integracoes/invertexto/consumo` → `{ limite, usados, restantes, mes }` para a tela.

### Front (shell ERP)
- **Aba Integrações**: card "Invertexto (CEP/CNPJ)" com url, apikey e limite/mês
  (salva via API) + mostrador de consumo (usados/restantes no mês).
- **Cadastro de cliente**: no bloco de endereço, o campo **CEP** ganha busca automática
  (ao digitar 8 dígitos → preenche logradouro, bairro, município, UF e resolve o
  `ibgeCidade/ibgeEstado` pela lista IBGE). E o **CPF/CNPJ** do cliente, quando tiver 14
  dígitos e for CNPJ, ganha botão/busca → preenche **razão social (nome)** e o endereço
  principal (CEP, logradouro, número, bairro, município, UF).

## Fases (tamanho)
1. **Banco + API** (M): migração das 2 tabelas, CRUD da integração, proxy CEP/CNPJ com
   contador e consumo.
2. **Front — aba Integrações** (P): card Invertexto (form + mostrador de consumo).
3. **Front — cadastro de cliente** (M): auto-preenchimento por CEP e por CNPJ nos dois
   formulários (novo e edição).

## Decisões em aberto
- **D1 — Onde fica a UI de configuração** (ver clarify).
- **D2 — Proxy pela API (recomendado)**: a apikey fica SÓ no servidor; navegador chama
  `/integracoes/...`. Alternativa (chamar direto do navegador) expõe a apikey — não
  recomendada.
- **D3 — Contador combinado** (recomendado): CEP e CNPJ somam no mesmo contador/mês (é o
  mesmo plano/token da Invertexto). Alternativa: contadores separados.

## Pendências (após teste no servidor — 26/10/2026) — RESOLVIDAS em 27/10/2026

Testado e OK no servidor: CEP preenche o endereço; CNPJ consulta sem "erro interno" (o bug
do 500 foi corrigido — URI/token codificados e qualquer falha vira 400).

**Causa raiz achada em 27/10:** o JSON REAL da `/v1/cnpj/{cnpj}` não é chapado — o endereço
vem dentro do objeto `endereco {logradouro, numero, bairro, municipio, uf, cep}`, a situação
em `situacao.nome`, o CNAE em `atividade_principal {codigo, descricao}` e o telefone é
`telefone1` (com `telefone2` de reserva); `email` está na raiz. O mapeamento lia tudo na raiz,
então endereço/situação/CNAE voltavam nulos. Fonte: exemplo de resposta da própria
documentação (`https://api.invertexto.com/api-consulta-cnpj`, recuperado em 27/10).

Correções aplicadas:

1. **CNPJ preenche o ENDEREÇO** — `IntegracaoService.mapearCnpj(JsonNode)` lê o nó aninhado
   (`filhoObjeto`/`textoEm`) e cai para a raiz quando o provedor devolver tudo chapado;
   coberto por `IntegracaoServiceTest.mapearCnpjLeOJsonRealAninhadoDaInvertexto` (JSON real)
   e `mapearCnpjTambemLeRespostaChapadaNaRaiz`. No form, o campo livre "Rua, número, bairro"
   recebe logradouro + número + bairro.
2. **CNPJ preenche TELEFONE e E-MAIL** — `telefone`/`email` entraram no `CnpjRespostaDTO` e
   no `CnpjResposta` do front; `preencherContatoDaEmpresa` grava na primeira linha VAZIA de
   cada bloco (nunca sobrescreve o que o usuário digitou), e-mail só se passar na validação.
3. **Layout do bloco ENDEREÇO** (`Clientes.tsx`) — linha 1: **Tipo** + checkbox **Principal**
   ao lado + remover; linha 2: **CEP** + botão **Pesquisar CEP** ao lado do campo.

Validação: API `mvn verify` (unit + IT) e front `npm test` (133) + eslint limpo nos arquivos
tocados.
