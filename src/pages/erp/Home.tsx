import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Circle, ListChecks, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usuarioApi } from "@/lib/api/http";
import { concluirTarefa, listarTarefas, type Tarefa } from "@/lib/api/tarefas";

const HOJE = new Date().toISOString().split("T")[0];

/**
 * Home dos módulos já migrados (`/erp`): o login manda para cá e o menu lateral
 * (montado no `LayoutErp`) mostra só o que já fala com a nossa API. Por enquanto
 * isso é Tarefas e Clientes — cada módulo migrado vira um atalho aqui.
 */
export default function HomeErp() {
  const usuario = usuarioApi();
  const primeiroNome = (usuario?.nome || usuario?.email || "").split(" ")[0].split("@")[0];

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  useEffect(() => {
    let vivo = true;
    listarTarefas({ minhas: true, concluida: false, size: 10 })
      .then((pagina) => {
        if (vivo) setTarefas(pagina.content);
      })
      .catch(() => {
        /* sem sessão o guard do LayoutErp manda para o login; falha de rede não polui a Home */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const alternar = async (tarefa: Tarefa) => {
    setTarefas((atual) => atual.filter((t) => t.id !== tarefa.id));
    try {
      await concluirTarefa(tarefa.id, true);
    } catch {
      setTarefas((atual) => [tarefa, ...atual].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento)));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold">Olá, {primeiroNome || "usuário"}</h1>
        <p className="text-sm text-muted-foreground">
          Módulos na API própria — o restante do sistema continua no legado.
        </p>
      </header>

      {/* Minhas tarefas */}
      <Card>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-accent" /> Minhas tarefas
          </h2>
          <Link to="/erp/tarefas" className="text-xs text-accent font-medium hover:underline inline-flex items-center gap-1">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {tarefas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            Nenhuma tarefa pendente. Cadastre um cliente ou crie uma tarefa em Tarefas.
          </p>
        ) : (
          <div className="divide-y">
            {tarefas.map((tarefa) => {
              const atrasada = tarefa.dataVencimento < HOJE;
              const hoje = tarefa.dataVencimento === HOJE;
              return (
                <div key={tarefa.id} className="px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => alternar(tarefa)}
                    className="shrink-0"
                    aria-label="Concluir tarefa"
                  >
                    <Circle className="w-4 h-4 text-muted-foreground hover:text-accent transition-colors" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tarefa.titulo}</p>
                    {tarefa.nomeCliente && (
                      <p className="text-[10px] text-accent font-medium mt-0.5">
                        Cliente: {tarefa.nomeCliente}
                      </p>
                    )}
                  </div>
                  {tarefa.prioridade === "urgente" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold uppercase shrink-0">
                      Urgente
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      atrasada
                        ? "bg-destructive/10 text-destructive"
                        : hoje
                        ? "bg-accent/15 text-accent"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {atrasada
                      ? "Atrasada"
                      : hoje
                      ? "Hoje"
                      : new Date(tarefa.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Atalhos dos módulos migrados */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/erp/tarefas" className="group">
          <Card className="p-4 transition-colors group-hover:border-primary">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <ListChecks className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-medium">Tarefas</p>
                  <p className="text-xs text-muted-foreground">Painel em lista ou kanban</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
          </Card>
        </Link>

        <Link to="/erp/clientes" className="group">
          <Card className="p-4 transition-colors group-hover:border-primary">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-medium">Clientes</p>
                  <p className="text-xs text-muted-foreground">Listagem e cadastro</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
