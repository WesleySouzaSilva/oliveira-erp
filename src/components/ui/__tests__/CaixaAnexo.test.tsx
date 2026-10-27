import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaixaAnexo } from "@/components/ui/CaixaAnexo";

/**
 * Caixa de anexo única (OE-13): TODO ponto de anexo do ERP usa clique OU
 * arrastar — aqui ficam os três comportamentos da captura: clicar abre o
 * seletor e entrega, soltar entrega, e o X tira da fila. O envio continua
 * sendo da tela, então o teste só olha as callbacks.
 */

function montar(props: Partial<ComponentProps<typeof CaixaAnexo>> = {}) {
  const onAdicionar = vi.fn();
  const onRemover = vi.fn();
  const utils = render(
    <CaixaAnexo arquivos={[]} onAdicionar={onAdicionar} onRemover={onRemover} {...props} />,
  );
  const area = utils.container.querySelector("[data-caixa-anexo]") as HTMLElement;
  const input = utils.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { ...utils, onAdicionar, onRemover, area, input };
}

const arquivo = (nome: string, bytes = 8) => new File(["x".repeat(bytes)], nome);

describe("CaixaAnexo — clique OU arrastar", () => {
  it("clique abre o seletor e os arquivos escolhidos vão para onAdicionar", () => {
    const { area, input, onAdicionar } = montar();

    fireEvent.click(area);
    fireEvent.change(input, { target: { files: [arquivo("recibo.pdf")] } });

    expect(onAdicionar).toHaveBeenCalledTimes(1);
    expect(onAdicionar.mock.calls[0][0][0].name).toBe("recibo.pdf");
    // o input zera para permitir reescolher o mesmo arquivo em seguida
    expect(input.value).toBe("");
  });

  it("soltar o arquivo na área também entrega (mesmo caminho do clique)", () => {
    const { area, onAdicionar } = montar();

    fireEvent.drop(area, { dataTransfer: { files: [arquivo("foto.png")] } });

    expect(onAdicionar).toHaveBeenCalledTimes(1);
    expect(onAdicionar.mock.calls[0][0][0].name).toBe("foto.png");
  });

  it("lista o que foi selecionado com tamanho e remove pelo X", () => {
    const onArquivosChange = vi.fn();
    const { rerender, onRemover, area } = montar({
      arquivos: [arquivo("contrato.pdf", 2048)],
      onArquivosChange,
    });

    expect(screen.getByText("contrato.pdf")).toBeInTheDocument();
    // o tamanho vem do formatarTamanho compartilhado
    expect(screen.getByText("(2,0 KB)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remover contrato.pdf" }));
    expect(onRemover).toHaveBeenCalledWith(0);
    expect(onArquivosChange).toHaveBeenCalledWith([]);

    // sem arquivos na fila a lista some (a área continua clicável)
    rerender(<CaixaAnexo arquivos={[]} onAdicionar={vi.fn()} onRemover={vi.fn()} />);
    expect(screen.queryByText("contrato.pdf")).toBeNull();
    expect(area).toBeInTheDocument();
  });

  it("multiple=false entrega só o primeiro arquivo arrastado", () => {
    const { area, onAdicionar } = montar({ multiple: false });

    fireEvent.drop(area, { dataTransfer: { files: [arquivo("a.pdf"), arquivo("b.pdf")] } });

    expect(onAdicionar).toHaveBeenCalledTimes(1);
    expect(onAdicionar.mock.calls[0][0]).toHaveLength(1);
    expect(onAdicionar.mock.calls[0][0][0].name).toBe("a.pdf");
  });

  it("desabilitado ignora clique e arrastar", () => {
    const { area, onAdicionar } = montar({ desabilitado: true });

    fireEvent.click(area);
    fireEvent.drop(area, { dataTransfer: { files: [arquivo("bloqueado.pdf")] } });

    expect(onAdicionar).not.toHaveBeenCalled();
    expect(area).toHaveAttribute("aria-disabled", "true");
  });

  it("aceita conteúdo custom no corpo da área", () => {
    montar({ rotulo: <p>Arraste o contrato do banco</p> });

    expect(screen.getByText("Arraste o contrato do banco")).toBeInTheDocument();
  });
});
