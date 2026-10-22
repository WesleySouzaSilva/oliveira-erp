import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EncaminharTarefa, TarefaTimeline } from "@/components/erp/TarefaMovimentacao";
import { baixarArquivoContrato, listarArquivos } from "@/lib/api/contratos";
import { baixarAnexoTarefa } from "@/lib/api/tarefas";

/**
 * Trilha da tarefa (Fase 1, correção 2 de
 * `docs/plano-correcoes-comercial-contratos-tarefas.md`): a tarefa nascida do contrato
 * tem SÓ a linha `criada` e nada copia os arquivos para `tarefas_anexos` — com
 * `contratoId` a linha criada lista os anexos DO CONTRATO (`arquivos_cliente`), com
 * download pelo mesmo endpoint de sempre. As linhas encaminhadas seguem com
 * `tarefas_anexos` como antes.
 */

vi.mock("@/lib/api/tarefas", () => ({
  listarHistoricoTarefa: vi.fn(async () => [
    { id: "hist-1", acao: "criada", executadoPorNome: "Willian", dataAcao: "2026-10-20T10:00:00" },
    {
      id: "hist-2",
      acao: "encaminhada",
      executadoPorNome: "Willian",
      deUsuarioNome: "Willian",
      setorNome: "Financeiro",
      dataAcao: "2026-10-20T11:00:00",
      anexos: [{ id: "anexo-tarefa-1", nomeOriginal: "recibo.pdf", tamanhoBytes: 512 }],
    },
  ]),
  baixarAnexoTarefa: vi.fn(async () => undefined),
  // o EncaminharTarefa do mesmo arquivo importa daqui (não é renderizado neste teste)
  encaminharTarefa: vi.fn(async () => ({})),
}));

vi.mock("@/lib/api/contratos", () => ({
  listarArquivos: vi.fn(async () => [
    {
      id: "arq-contrato-1",
      contratoId: "contrato-7",
      nomeOriginal: "contrato-do-cliente.pdf",
      arquivoPath: "uploads/fazenda-santa-rita/CT-001/contrato-do-cliente.pdf",
      tamanhoBytes: 1536,
    },
  ]),
  baixarArquivoContrato: vi.fn(async () => undefined),
}));

vi.mock("@/lib/api/setores", () => ({ listarSetores: vi.fn(async () => []) }));
vi.mock("@/lib/api/membros", () => ({ listarMembros: vi.fn(async () => []) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("TarefaTimeline — anexos do contrato na linha criada", () => {
  it("tarefa com contratoId lista os anexos do contrato e baixa pelo endpoint", async () => {
    render(<TarefaTimeline tarefaId="tarefa-1" contratoId="contrato-7" />);

    expect(await screen.findByText("Tarefa criada")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /contrato-do-cliente\.pdf/ }),
    ).toBeInTheDocument();
    expect(vi.mocked(listarArquivos)).toHaveBeenCalledWith("contrato-7");

    fireEvent.click(screen.getByRole("button", { name: /contrato-do-cliente\.pdf/ }));
    await waitFor(() =>
      expect(vi.mocked(baixarArquivoContrato)).toHaveBeenCalledWith(
        "arq-contrato-1",
        "contrato-do-cliente.pdf",
      ),
    );

    // a linha encaminhada continua com o anexo da própria tarefa (tarefas_anexos)
    expect(await screen.findByRole("button", { name: /recibo\.pdf/ })).toBeInTheDocument();
  });

  it("tarefa sem contratoId não busca anexos do contrato; encaminhada baixa tarefas_anexos", async () => {
    vi.mocked(listarArquivos).mockClear();
    render(<TarefaTimeline tarefaId="tarefa-1" />);

    expect(await screen.findByText("Tarefa criada")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /recibo\.pdf/ }),
    ).toBeInTheDocument();
    expect(vi.mocked(listarArquivos)).not.toHaveBeenCalled();
    // sem contratoId a linha criada não tem arquivo nenhum
    expect(screen.queryByRole("button", { name: /contrato-do-cliente\.pdf/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /recibo\.pdf/ }));
    await waitFor(() =>
      expect(vi.mocked(baixarAnexoTarefa)).toHaveBeenCalledWith("anexo-tarefa-1", "recibo.pdf"),
    );
  });

  it("cache por contratoId: reabrir a timeline não rebusca os anexos", async () => {
    vi.mocked(listarArquivos).mockClear();

    const { unmount } = render(
      <TarefaTimeline tarefaId="tarefa-1" contratoId="contrato-42" />,
    );
    await screen.findByRole("button", { name: /contrato-do-cliente\.pdf/ });
    expect(vi.mocked(listarArquivos)).toHaveBeenCalledTimes(1);
    unmount();

    render(<TarefaTimeline tarefaId="tarefa-1" contratoId="contrato-42" />);
    await screen.findByRole("button", { name: /contrato-do-cliente\.pdf/ });
    // veio do cache de módulo — nenhuma chamada nova
    expect(vi.mocked(listarArquivos)).toHaveBeenCalledTimes(1);
  });
});


describe("EncaminharTarefa — anexos por clique OU arrastar (OE-13)", () => {
  it("soltar e clicar adicionam na fila de anexos; o X remove", async () => {
    render(<EncaminharTarefa tarefa={{ id: "tarefa-1" } as never} />);

    fireEvent.click(screen.getByRole("button", { name: "Responder ou encaminhar tarefa" }));

    const area = document.querySelector("[data-caixa-anexo]") as HTMLElement;
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(area).toBeTruthy();

    // arrastar
    fireEvent.drop(area, { dataTransfer: { files: [new File(["x"], "recibo.pdf")] } });
    expect(await screen.findByText("recibo.pdf")).toBeInTheDocument();

    // clicar (mesmo caminho do seletor)
    fireEvent.change(input, { target: { files: [new File(["y"], "foto.png")] } });
    expect(await screen.findByText("foto.png")).toBeInTheDocument();

    // remover um não derruba o outro
    fireEvent.click(screen.getByRole("button", { name: "Remover recibo.pdf" }));
    await waitFor(() => expect(screen.queryByText("recibo.pdf")).toBeNull());
    expect(screen.getByText("foto.png")).toBeInTheDocument();
  });
});
