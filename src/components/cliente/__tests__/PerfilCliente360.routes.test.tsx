import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @ts-ignore - node builtin no ambiente de teste
import fs from "fs";
// @ts-ignore - node builtin no ambiente de teste
import path from "path";
declare const process: { cwd(): string };

// Mock Supabase client used by the component.
vi.mock("@/integrations/supabase/client", () => {
  const builder = (data: any[]) => {
    const result = { data, error: null };
    // Cadeia supabase inteira vira espelho: QUALQUER método devolve o próprio builder e o
    // await resolve `{ data, error: null }` — os componentes do Perfil 360 encadeiam
    // .select().eq().order().limit() (e o que for surgindo) sem o mock precisar listar
    // cada método (faltava .limit e o TimelineCliente derrubava o teste).
    const b: any = new Proxy(
      {},
      {
        get: (_alvo, prop) => {
          if (prop === "then") {
            return (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
          }
          if (typeof prop === "symbol") return undefined;
          return (..._args: unknown[]) => b;
        },
      },
    );
    return b;
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === "clientes")
          return builder([
            { nome: "João Silva", vip: false, status_adimplencia: "adimplente", municipio: "Maringá", uf: "PR" },
          ]);
        if (table === "contratos_vencimentos")
          return builder([
            {
              id: "c1",
              nome_cliente: "João Silva",
              banco: "Banco do Brasil",
              numero_contrato: "123",
              valor_total_operacao: 100000,
              valor_parcela: 10000,
              vencimento_proxima_parcela: null,
              parcelas_vencidas: false,
              resolvido: false,
            },
          ]);
        if (table === "processos")
          return builder([
            {
              id: "proc-abc",
              fase_atual: "1",
              created_at: new Date().toISOString(),
              laudos: { dados_etapa1: { produtor: "João Silva", banco: "Banco do Brasil" } },
            },
          ]);
        if (table === "movimentacoes") return builder([]);
        if (table === "peticoes") return builder([]);
        return builder([]);
      },
    },
  };
});

import { PerfilCliente360 } from "@/components/cliente/PerfilCliente360";

/**
 * O Perfil 360 usa react-query (ex.: `ProcessosJudiciaisCliente`) — na App o provider já
 * existe; aqui o wrapper evita o "No QueryClient set" que derrubava os testes de rotas.
 */
function renderPerfil() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PerfilCliente360 produtor="João Silva" hideHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Perfil 360 — links e rotas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza link de processo apontando para /processos/:id sem query de tab", async () => {
    renderPerfil();

    const link = await waitFor(() =>
      screen.getByRole("link", { name: /Abrir/i })
    );
    const href = link.getAttribute("href") || "";
    expect(href).toBe("/processos/proc-abc");
    expect(href).not.toMatch(/\?tab=/);
    expect(href).not.toMatch(/[?&]tab=/);
  });

  it("nenhum link interno do Perfil 360 aponta para /clientes com query de tab", async () => {
    const { container } = renderPerfil();

    await waitFor(() => screen.getByRole("link", { name: /Abrir/i }));
    const links = Array.from(container.querySelectorAll("a"));
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      expect(href).not.toMatch(/[?&]tab=/);
      if (href.startsWith("/clientes/")) {
        // Se algum dia surgirem links para /clientes/ aqui, devem ser limpos.
        expect(href).not.toMatch(/\?/);
      }
    }
  });
});

describe("Perfil 360 — análise estática de fontes", () => {
  const files = [
    "src/components/cliente/PerfilCliente360.tsx",
    "src/components/processo/PerfilClienteDrawer.tsx",
  ];

  it("não usa query string ?tab= em nenhum link/navigate dos componentes do Perfil 360", () => {
    for (const rel of files) {
      const abs = path.resolve(process.cwd(), rel);
      const src = fs.readFileSync(abs, "utf-8");
      expect(src, `${rel} contém ?tab= em links`).not.toMatch(/[`"'][^`"']*\?tab=/);
    }
  });

  it("ClienteDetalhe inicializa aba padrão como 'perfil360'", () => {
    const abs = path.resolve(process.cwd(), "src/pages/ClienteDetalhe.tsx");
    const src = fs.readFileSync(abs, "utf-8");
    expect(src).toMatch(/useState<[^>]+>\("perfil360"\)/);
  });

  it("ProcessoDetalhe linka o nome do produtor para /clientes/<nome> sem query", () => {
    const abs = path.resolve(process.cwd(), "src/pages/ProcessoDetalhe.tsx");
    const src = fs.readFileSync(abs, "utf-8");
    // Deve existir um Link to={`/clientes/${encodeURIComponent(processo.produtor)}`}
    expect(src).toMatch(/to=\{`\/clientes\/\$\{encodeURIComponent\(processo\.produtor\)\}`\}/);
    // E não pode anexar ?tab=
    expect(src).not.toMatch(/\/clientes\/\$\{encodeURIComponent\(processo\.produtor\)\}\?tab=/);
  });
});