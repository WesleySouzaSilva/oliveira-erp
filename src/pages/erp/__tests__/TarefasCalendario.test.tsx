import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarioTarefas } from "@/pages/erp/TarefasCalendario";
import { prazoDaTarefa } from "@/lib/api/tarefas";
import type { Tarefa } from "@/lib/api/tarefas";

const tarefaEm = (dia: string, extras: Partial<Tarefa> = {}): Tarefa => ({
  id: `id-${dia}`,
  responsavelId: "usuario-1",
  titulo: `Tarefa de ${dia}`,
  dataVencimento: dia,
  concluida: false,
  importante: false,
  lido: false,
  privada: false,
  tarefaFutura: false,
  prioridade: "normal",
  ...extras,
});

describe("CalendarioTarefas", () => {
  it("marca o dia com a contagem de pendentes e avisa o pai ao clicar", () => {
    const onSelecionar = vi.fn();
    render(
      <CalendarioTarefas
        tarefas={[tarefaEm("2026-10-13"), tarefaEm("2026-10-13")]}
        diaSelecionado={null}
        onSelecionar={onSelecionar}
      />,
    );

    // total-bar do mes = soma das pendentes do mes
    expect(screenByTitle("Tarefas pendentes")?.textContent).toBe("2");

    const dia13 = screenByTitle("2 tarefas");
    expect(dia13).toBeTruthy();
    fireEvent.click(dia13!);
    expect(onSelecionar).toHaveBeenCalledWith("2026-10-13");
  });

  it("desmarca o dia ja escolhido (volta para todas as tarefas)", () => {
    const onSelecionar = vi.fn();
    render(
      <CalendarioTarefas
        tarefas={[tarefaEm("2026-10-13")]}
        diaSelecionado="2026-10-13"
        onSelecionar={onSelecionar}
      />,
    );
    fireEvent.click(screenByTitle("1 tarefas")!);
    expect(onSelecionar).toHaveBeenCalledWith(null);
  });

  it("nao marca prazo concluido e usa prazoFatal quando existe", () => {
    const onSelecionar = vi.fn();
    render(
      <CalendarioTarefas
        tarefas={[
          tarefaEm("2026-10-20", { concluida: true }),
          tarefaEm("2026-10-05", { prazoFatal: "2026-10-21" }),
        ]}
        diaSelecionado={null}
        onSelecionar={onSelecionar}
      />,
    );
    // dia 5 (vencimento) nao deve ter badge; dia 21 (prazo fatal) deve
    expect(screenByTitle("1 tarefas")).toBeTruthy();
    expect(prazoDaTarefa(tarefaEm("2026-10-05", { prazoFatal: "2026-10-21" }))).toBe("2026-10-21");
  });
});

/** Busca por `title` sem depender do jest-dom. */
function screenByTitle(title: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[title="${title}"]`);
}
