import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClienteSemContrato {
  id: string;
  nome: string;
  bancosSemMarcacao: string[];
  bancos: string[];
  urgente: boolean;
  proximoVencimento: string | null;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

const fmt = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "";

/**
 * Cliente cadastrado que não vai gerar nada no ADVBOX porque nenhum banco dele
 * está marcado como contratado — inclusive quem nunca foi marcado.
 */
export function SemBancoContratadoPanel() {
  const [lista, setLista] = useState<ClienteSemContrato[]>([]);
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [{ data: ops }, { data: esc }] = await Promise.all([
        supabase
          .from("operacoes_credito")
          .select("cliente_id, banco, vence_em, clientes(nome)")
          .is("deleted_at", null)
          .not("cliente_id", "is", null),
        supabase.from("cliente_banco_escopo").select("cliente_id, banco, escopo"),
      ]);
      if (!ativo) return;

      const escopoPar = new Map<string, string>();
      ((esc as any[]) || []).forEach((e) => {
        escopoPar.set(`${e.cliente_id}|${norm(e.banco)}`, e.escopo);
      });

      const hoje = new Date();
      const limite = new Date(hoje.getTime() + 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const hojeStr = hoje.toISOString().slice(0, 10);

      const porCliente = new Map<
        string,
        {
          nome: string;
          bancos: Set<string>;
          semMarcacao: Set<string>;
          temContratado: boolean;
          urgente: boolean;
          prox: string | null;
        }
      >();

      ((ops as any[]) || []).forEach((o) => {
        const id = String(o.cliente_id);
        const banco = String(o.banco || "").trim();
        if (!banco) return;
        const atual =
          porCliente.get(id) ?? {
            nome: String(o.clientes?.nome || ""),
            bancos: new Set<string>(),
            semMarcacao: new Set<string>(),
            temContratado: false,
            urgente: false,
            prox: null as string | null,
          };
        if (!atual.nome && o.clientes?.nome) atual.nome = String(o.clientes.nome);
        atual.bancos.add(banco);
        const escopo = escopoPar.get(`${id}|${norm(banco)}`);
        if (escopo === "contratado") atual.temContratado = true;
        if (!escopo) {
          atual.semMarcacao.add(banco);
          const v = o.vence_em as string | null;
          if (v && v >= hojeStr && v <= limite) {
            atual.urgente = true;
            if (!atual.prox || v < atual.prox) atual.prox = v;
          }
        }
        porCliente.set(id, atual);
      });

      const fila: ClienteSemContrato[] = [];
      porCliente.forEach((v, id) => {
        if (v.temContratado) return;
        fila.push({
          id,
          nome: v.nome || "Cliente sem nome",
          bancos: [...v.bancos],
          bancosSemMarcacao: [...v.semMarcacao],
          urgente: v.urgente,
          proximoVencimento: v.prox,
        });
      });
      fila.sort((a, b) => {
        if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
        if (a.urgente && b.urgente)
          return String(a.proximoVencimento).localeCompare(String(b.proximoVencimento));
        return a.nome.localeCompare(b.nome);
      });
      setLista(fila);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (lista.length === 0) return null;

  const urgentes = lista.filter((c) => c.urgente);
  const demais = lista.filter((c) => !c.urgente);

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 text-left font-serif text-sm font-bold"
      >
        {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Clientes sem nenhum banco contratado ({lista.length})
      </button>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">
        Cadastrados, mas não geram tarefa nem processo no ADVBOX enquanto nenhum banco estiver
        contratado. Clique no nome para abrir o cadastro na seção "Bancos contratados".
      </p>
      {aberto && (
        <div className="mt-2 space-y-3 pl-6">
          {urgentes.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2">
              <p className="text-xs font-bold text-destructive">
                Vencimento em até 30 dias em banco sem marcação — nenhuma tarefa será criada no
                ADVBOX até marcar o banco ({urgentes.length})
              </p>
              <ul className="mt-1 space-y-1 text-xs">
                {urgentes.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/clientes/${encodeURIComponent(c.nome)}?editar=bancos`}
                      className="font-medium text-destructive hover:underline"
                    >
                      {c.nome}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      · {c.bancosSemMarcacao.join(", ")} · vence {fmt(c.proximoVencimento)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="space-y-1 text-xs">
            {demais.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/clientes/${encodeURIComponent(c.nome)}?editar=bancos`}
                  className="text-primary hover:underline"
                >
                  {c.nome}
                </Link>{" "}
                <span className="text-muted-foreground">· {c.bancos.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
