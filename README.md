# oliveira-erp

Front **React 18 + TypeScript + Vite + Tailwind/shadcn** do sistema **Oliveira** — cópia de trabalho
do front legado (Lovable + Supabase) para a **migração gradual para a API própria**
([`oliveira-api`](../oliveira-api), Java 17 + Spring Boot).

> **Status:** base importada. Estamos trocando os acessos **módulo a módulo**: em vez de
> `supabase.from(...)`, o front passa a chamar nossa API (`/api/v1/...`). O primeiro módulo é
> **Clientes** (menu + cadastro completo).

---

## Como rodar

```bash
npm install
npm run dev      # dev server em http://localhost:5173
npm run build    # build de produção
npm run lint     # eslint
```

A API precisa estar no ar (repositório `oliveira-api`):

```bash
docker compose up -d
./mvnw spring-boot:run     # http://localhost:8080
```

Login de teste local da API: `admin@oliveira.adv.br` / `Senha@123`
(org criada no seed local — ver `oliveira-api/docs/PROGRESSO.md`).

---

## Onde fica a URL da API

**Um arquivo só** — [`src/config/api.ts`](src/config/api.ts):

```ts
export const API_BASE_URL = "http://localhost:8080/api/v1";
```

Mudou host, porta ou versão? Edite esse arquivo (ou defina `VITE_API_URL` no `.env` para
sobrescrever sem tocar no código). Nenhum outro arquivo do front referencia a API.

---

## Estrutura do que está migrando

```text
src/
├── config/
│   └── api.ts                 # URL + timeout da API (o arquivo a alterar)
├── lib/
│   └── api/
│       ├── http.ts            # fetch autenticado, token, erros RFC 7807, login/logout
│       └── clientes.ts        # recursos de cliente (listar/criar/atualizar)
├── components/erp/
│   └── LayoutErp.tsx          # layout + menu dos módulos já migrados
├── pages/erp/
│   ├── Entrar.tsx             # login na nossa API
│   └── Clientes.tsx           # lista + cadastro completo do cliente
├── integrations/supabase/     # LEGADO — sai conforme os módulos migram
└── pages/, components/        # LEGADO — telas restantes do sistema atual
```

Rotas novas ficam sob `/erp/...` (`/erp/entrar`, `/erp/clientes`) e não passam pelo login do
Supabase: autenticam contra a nossa API.

---

## Padrões do projeto

- **Git** (branch `id/super-resumo`, commits Angular, título de PR): [`docs/PADRAO-GIT.md`](docs/PADRAO-GIT.md).
- **API e regras de negócio**: [`../oliveira-api/README.md`](../oliveira-api/README.md).
