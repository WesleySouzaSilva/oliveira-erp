import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContratosClienteDialog } from "@/components/erp/ContratosClienteDialog";
import { baixarArquivoContrato, excluirArquivo, listarArquivos } from "@/lib/api/contratos";
import { criarTarefa } from "@/lib/api/tarefas";

/**
 * Contratos do cliente: a lista mostra so numero, objeto, valor, abertura, situacao e
 * acoes — a descricao so existe depois que a pessoa aperta a seta da linha
 * (decisao 6 de `docs/plano-contratos-e-timeline.md`) — e a expansao lista os ANEXOS do
 * contrato; na EDICAO os anexos ja gravados entram no form (correcao 1, Fase 1), e a
 * primeira tarefa do contrato novo nasce vinculada (correcao 2).
 */

vi.mock("@/lib/api/contratos", () => {
  const base = (id: string, numero: string, extras: Record<string, unknown> = {}) => ({
    id,
    clienteId: "cliente-1",
    numero,
    situacao: "ativo",
    dataAbertura: "2026-10-01",
    valor: 15000,
    objetoId: "tipo-1",
    ...extras,
  });
  return {
    listarContratos: vi.fn(async () => [
      base("contrato-1", "CT-001", {
        descricao: "Revisao do contrato de safra 2026",
        banco: "Banco do Brasil",
        dataInicio: "2026-10-05",
      }),
      base("contrato-2", "CT-002", { descricao: null }),
    ]),
    criarContrato: vi.fn(async () => ({
      id: "contrato-9",
      clienteId: "cliente-1",
      numero: "CT-009",
      situacao: "ativo",
    })),
    atualizarContrato: vi.fn(),
    excluirContrato: vi.fn(async () => undefined),
    buscarContrato: vi.fn(),
    anexarArquivos: vi.fn(async () => []),
    // O contrato-1 ja tem anexo gravado (expansao e modo edicao); os demais nao tem.
    listarArquivos: vi.fn(async (contratoId: string) =>
      contratoId === "contrato-1"
        ? [
            {
              id: "arq-9",
              contratoId: "contrato-1",
              nomeOriginal: "contrato-assinado.pdf",
              arquivoPath: "uploads/fazenda-santa-rita/CT-001/contrato-assinado.pdf",
              tamanhoBytes: 2048,
            },
          ]
        : [],
    ),
    excluirArquivo: vi.fn(async () => undefined),
    baixarArquivoContrato: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/api/tarefas", () => ({
  criarTarefa: vi.fn(async () => ({ id: "tarefa-1" })),
  // O "Primeira tarefa do contrato" lista os tipos para o select novo (Fase 4).
  listarTiposTarefa: vi.fn(async () => []),
  // Constante pura da lib: o mock do módulo inteiro precisa repassá-la.
  RECORRENCIAS_TAREFA: [
    { valor: "unica", rotulo: "Única" },
    { valor: "diaria", rotulo: "Diária" },
    { valor: "semanal", rotulo: "Semanal" },
    { valor: "mensal", rotulo: "Mensal" },
  ],
}));

vi.mock("@/lib/api/objetos", () => ({
  listarTiposObjeto: vi.fn(async () => [{ id: "tipo-1", tipoObjeto: "Arroz" }]),
}));

vi.mock("@/lib/api/setores", () => ({
  listarSetores: vi.fn(async () => [
    { id: "setor-1", nome: "Financeiro" },
    { id: "setor-2", nome: "Pos-Vendas" },
  ]),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => vi.fn(async () => true),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function abrir() {
  render(
    <ContratosClienteDialog
      aberto={true}
      onAbertoChange={vi.fn()}
      clienteId="cliente-1"
      clienteNome="Fazenda Santa Rita"
    />,
  );
}

describe("ContratosClienteDialog — descricao so por trás da seta", () => {
  it("nao mostra a descricao na lista e abre/fecha com a seta da linha", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    // a descricao NUNCA aparece sem clique
    expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull();

    const seta = screen.getByRole("button", { name: "Ver descrição do contrato CT-001" });
    expect(seta.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(seta);

    expect(await screen.findByText("Revisao do contrato de safra 2026")).toBeInTheDocument();
    // a expansão lista os anexos do contrato junto com a descrição (correção 1)
    expect(
      await screen.findByRole("button", { name: /contrato-assinado\.pdf/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recolher contrato CT-001" }).getAttribute("aria-expanded"),
    ).toBe("true");

    // recolhe de volta: a descricao sai da tela
    fireEvent.click(screen.getByRole("button", { name: "Recolher contrato CT-001" }));
    await waitFor(() =>
      expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull(),
    );
  });

  it("expandir tudo / recolher tudo mexem em todas as linhas", async () => {
    abrir();
    expect(await screen.findByText("CT-002")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expandir todas as descrições" }));

    expect(await screen.findByText("Revisao do contrato de safra 2026")).toBeInTheDocument();
    // contrato sem descricao: o painel abre e diz que nao tem
    expect(await screen.findByText("Sem descrição.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recolher todas as descrições" }));
    await waitFor(() =>
      expect(screen.queryByText("Revisao do contrato de safra 2026")).toBeNull(),
    );
    expect(
      screen.getByRole("button", { name: "Ver descrição do contrato CT-001" }),
    ).toBeTruthy();
  });

  it("o botao Editar continua abrindo o formulario da linha", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    const linhas = screen.getAllByRole("row");
    const primeiraLinha = linhas.find((linha) => linha.textContent?.includes("CT-001"))!;
    fireEvent.click(within(primeiraLinha).getByRole("button", { name: /Editar/ }));

    expect(await screen.findByText("Editar contrato CT-001")).toBeInTheDocument();
    // o número saiu do formulário (agora é automático) — a edição se identifica pelo título
    expect(screen.getByText("Editar contrato CT-001")).toBeInTheDocument();
    // edição não oferece setor de envio (só o cadastro cria tarefas)
    expect(screen.queryByText(/Setores de envio/)).toBeNull();
  });

  it("formulário de novo contrato mostra os setores de envio (cada um vira uma tarefa)", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));

    expect(await screen.findByText(/Setores de envio/)).toBeInTheDocument();
    const financeiro = screen.getByLabelText("Enviar para Financeiro");
    fireEvent.click(financeiro);
    expect(financeiro).toBeChecked();
  });

  it("modo edição lista os anexos já gravados (baixa e exclui sem zerar a lista)", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    const linhas = screen.getAllByRole("row");
    const primeiraLinha = linhas.find((linha) => linha.textContent?.includes("CT-001"))!;
    fireEvent.click(within(primeiraLinha).getByRole("button", { name: /Editar/ }));

    expect(await screen.findByText("Editar contrato CT-001")).toBeInTheDocument();
    // os anexos do contrato aparecem no form; a fila de cima fica só para os novos
    expect(await screen.findByText("contrato-assinado.pdf")).toBeInTheDocument();
    expect(vi.mocked(listarArquivos)).toHaveBeenCalledWith("contrato-1");

    // baixar o anexo já gravado
    fireEvent.click(screen.getByRole("button", { name: /^contrato-assinado\.pdf/ }));
    await waitFor(() =>
      expect(vi.mocked(baixarArquivoContrato)).toHaveBeenCalledWith(
        "arq-9",
        "contrato-assinado.pdf",
      ),
    );

    // excluir (o confirm do teste já confirma) e o item sai da lista
    fireEvent.click(screen.getByRole("button", { name: "Excluir contrato-assinado.pdf" }));
    await waitFor(() => expect(vi.mocked(excluirArquivo)).toHaveBeenCalledWith("arq-9"));
    await waitFor(() => expect(screen.queryByText("contrato-assinado.pdf")).toBeNull());
  });

  it("contrato novo: a primeira tarefa nasce vinculada (contratoId no criarTarefa)", async () => {
    vi.mocked(criarTarefa).mockClear();
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));
    fireEvent.change(screen.getByLabelText(/Objeto \(categoria\)/), {
      target: { value: "tipo-1" },
    });
    fireEvent.change(screen.getByLabelText(/Valor/), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText(/Descrição/), {
      target: { value: "Contrato de safra 2027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contrato" }));

    // a janela "Primeira tarefa do contrato" abre depois de criar o registro
    const janelaTarefa = await screen.findByRole("dialog", {
      name: /Primeira tarefa do contrato/,
    });
    // fechar sem escolher setor ainda cria a tarefa — e é aqui que o contratoId viaja
    fireEvent.click(within(janelaTarefa).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(vi.mocked(criarTarefa)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarTarefa).mock.calls[0][0]).toEqual(
      expect.objectContaining({ contratoId: "contrato-9" }),
    );
  });


  it("o form de contrato aceita anexos por clique OU arrastar (CaixaAnexo)", async () => {
    abrir();
    expect(await screen.findByText("CT-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Novo contrato/ }));
    expect(await screen.findByText(/Setores de envio/)).toBeInTheDocument();

    const area = document.querySelector("[data-caixa-anexo]") as HTMLElement;
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(area).toBeTruthy();

    // arrastar
    fireEvent.drop(area, { dataTransfer: { files: [new File(["x"], "contrato-fisico.pdf")] } });
    expect(await screen.findByText("contrato-fisico.pdf")).toBeInTheDocument();

    // clicar
    fireEvent.change(input, { target: { files: [new File(["y"], "foto-obra.png")] } });
    expect(await screen.findByText("foto-obra.png")).toBeInTheDocument();

    // remover só o que foi clicado no X
    fireEvent.click(screen.getByRole("button", { name: "Remover contrato-fisico.pdf" }));
    await waitFor(() => expect(screen.queryByText("contrato-fisico.pdf")).toBeNull());
    expect(screen.getByText("foto-obra.png")).toBeInTheDocument();
  });
});

