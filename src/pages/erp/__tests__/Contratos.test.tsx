import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Contratos from "@/pages/erp/Contratos";
import { listarArquivos } from "@/lib/api/contratos";
import { baixarArquivo } from "@/lib/api/http";

/**
 * Contratos Clientes (lista geral): a descrição NUNCA aparece na tabela — so' depois da
 * seta da linha — e o painel que abre mostra descrição + ANEXOS do contrato (banco/datas/
 * observacoes continuam de fora, pedido do titular em 15/10/2026; os anexos entraram na
 * correção 1 da Fase 1 de `docs/plano-correcoes-comercial-contratos-tarefas.md`).
 */

// O download de contrato é o caminho REAL: `baixarArquivoContrato` (intocado aqui) chama o
// `baixarArquivo` de http.ts — capturamos o caminho /arquivos/{id}/conteudo sem rede.
vi.mock("@/lib/api/http", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/http")>();
  return { ...original, baixarArquivo: vi.fn(async () => undefined) };
});

// Só as funções de LISTA são trocadas; o resto do módulo (listarArquivos,
// baixarArquivoContrato) continua sendo o código de produção.
vi.mock("@/lib/api/contratos", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/contratos")>();
  const base = (id: string, numero: string, extras: Record<string, unknown> = {}) => ({
    id,
    clienteId: "cliente-1",
    clienteNome: "Fazenda Santa Rita",
    numero,
    objetoId: "tipo-1",
    objetoNome: "Arroz",
    valor: 15000,
    dataAbertura: "2026-10-01",
    situacao: "ativo",
    ...extras,
  });
  return {
    ...original,
    listarContratosGeral: vi.fn(async () => ({
      content: [
        base("c1", "CT-001", {
          descricao: "Revisao do contrato de safra 2026",
          banco: "Banco do Brasil",
          observacoes: "Observacao que nao deve aparecer",
        }),
        base("c2", "CT-002", { descricao: null }),
      ],
      page: { size: 50, number: 0, totalElements: 2, totalPages: 1, first: true, last: true },
    })),
    // 1 request POR EXPANSÃO: c1 tem anexo gravado, c2 não tem nada.
    listarArquivos: vi.fn(async (contratoId: string) =>
      contratoId === "c1"
        ? [
            {
              id: "arq-1",
              contratoId: "c1",
              nomeOriginal: "contrato-safra.pdf",
              arquivoPath: "uploads/fazenda-santa-rita/CT-001/contrato-safra.pdf",
              tamanhoBytes: 1536,
            },
          ]
        : [],
    ),
  };
});

vi.mock("@/lib/api/objetos", () => ({
  listarTiposObjeto: vi.fn(async () => [{ id: "tipo-1", tipoObjeto: "Arroz" }]),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Contratos Clientes", () => {
  it("lista resumida: numero, cliente, objeto, valor, abertura — sem descricao", async () => {
    render(<Contratos />);

    expect(await screen.findByText("CT-001")).toBeInTheDocument();
    expect(screen.getByText("CT-002")).toBeInTheDocument();
    // os dois contratos são do mesmo cliente/objeto na massa
    expect(screen.getAllByText("Fazenda Santa Rita")).toHaveLength(2);
    expect(screen.getAllByText("Arroz")).toHaveLength(2);
    // descricao fora da tabela
    expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull();
    // "2 contratos" aparece no subtitulo e no rodapé de paginação
    expect(screen.getAllByText(/2 contratos/).length).toBeGreaterThan(0);
  });

  it("seta abre descricao + anexos (download em /arquivos/{id}/conteudo) e recolhe", async () => {
    render(<Contratos />);

    const seta = await screen.findByRole("button", { name: "Ver descrição do contrato CT-001" });
    fireEvent.click(seta);

    expect(await screen.findByText("Revisao do contrato de safra 2026")).toBeInTheDocument();
    // pedido do titular: expandir = descrição + anexos vinculados (busca na expansão)
    expect(await screen.findByRole("button", { name: /contrato-safra\.pdf/ })).toBeInTheDocument();
    expect(vi.mocked(listarArquivos)).toHaveBeenCalledWith("c1");
    // a régua de tamanho é a da trilha de tarefa (lib/formatarTamanho)
    expect(screen.getByText("contrato-safra.pdf (1,5 KB)")).toBeInTheDocument();
    // banco/observacoes continuam de fora do painel
    expect(screen.queryByText("Banco do Brasil")).toBeNull();
    expect(screen.queryByText("Observacao que nao deve aparecer")).toBeNull();

    // o clique no download chama o endpoint de conteúdo do arquivo
    fireEvent.click(screen.getByRole("button", { name: /contrato-safra\.pdf/ }));
    await waitFor(() =>
      expect(vi.mocked(baixarArquivo)).toHaveBeenCalledWith(
        "/arquivos/arq-1/conteudo",
        "contrato-safra.pdf",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Recolher contrato CT-001" }));
    await waitFor(() => expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull());
  });

  it("contrato sem descricao tambem e expandivel (seta accent) e o painel diz 'Sem anexos.'", async () => {
    render(<Contratos />);

    const seta = await screen.findByRole("button", { name: "Ver descrição do contrato CT-002" });
    // temDetalhes() passou a valer sempre: anexo sem descricao nao pode parecer vazio
    expect(seta.querySelector("svg")?.getAttribute("class") ?? "").toContain("text-accent");

    fireEvent.click(seta);

    expect(await screen.findByText("Sem descrição.")).toBeInTheDocument();
    expect(await screen.findByText("Sem anexos.")).toBeInTheDocument();
  });

  it("Expandir tudo abre o detalhe de cada linha — 1 busca de anexos por linha", async () => {
    render(<Contratos />);
    expect(await screen.findByText("CT-002")).toBeInTheDocument();
    vi.mocked(listarArquivos).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Expandir todas as descrições" }));

    expect(await screen.findByText("Revisao do contrato de safra 2026")).toBeInTheDocument();
    expect(await screen.findByText("Sem descrição.")).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(listarArquivos)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listarArquivos)).toHaveBeenCalledWith("c1");
    expect(vi.mocked(listarArquivos)).toHaveBeenCalledWith("c2");
    expect(screen.getByText("contrato-safra.pdf (1,5 KB)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recolher todas as descrições" }));
    await waitFor(() => expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull());
  });
});
