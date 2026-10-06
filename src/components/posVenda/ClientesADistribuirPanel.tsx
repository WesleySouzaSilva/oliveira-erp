import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { RESPONSAVEIS_CARTEIRA } from "@/data/divisaoCarteira";
import { usePapelRadar } from "@/hooks/usePapelRadar";

interface Pendente {
  id: string;
  nome: string;
  grupo: string | null;
  cadastrado_em: string | null;
}

const SEM_GRUPO = "Sem grupo definido";

/** Grupo de operações importadas que ainda não tem ficha de cliente nem responsável. */
interface GrupoPendente {
  grupo: string;
  operacoes: number;
}

/** Dias úteis decorridos (sábado e domingo não contam). */
function diasUteisDesde(iso?: string | null) {
  if (!iso) return 0;
  const inicio = new Date(iso);
  const hoje = new Date();
  let dias = 0;
  const cursor = new Date(inicio);
  cursor.setHours(0, 0, 0, 0);
  const fim = new Date(hoje);
  fim.setHours(0, 0, 0, 0);
  while (cursor < fim) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) dias++;
  }
  return dias;
}

export function ClientesADistribuirPanel() {
  const { podeGerirCliente } = usePapelRadar();
  const [itens, setItens] = useState<Pendente[]>([]);
  const [grupos, setGrupos] = useState<GrupoPendente[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data }, { data: ops }] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, grupo, cadastrado_em")
        .is("deleted_at", null)
        .is("responsavel_pos_venda", null)
        .eq("aguardando_distribuicao", true)
        .order("cadastrado_em", { ascending: true }),
      supabase
        .from("operacoes_credito")
        .select("grupo, responsavel")
        .is("deleted_at", null)
        .is("responsavel", null),
    ]);
    setItens(((data as any[]) || []) as Pendente[]);
    // Operação com grupo herda o responsável do grupo; aqui só fica o que realmente não tem grupo.
    const contagem = new Map<string, number>();
    ((ops as any[]) || []).forEach((o) => {
      const g = (o.grupo || "").trim();
      if (!g) contagem.set(SEM_GRUPO, (contagem.get(SEM_GRUPO) || 0) + 1);
    });
    setGrupos(
      [...contagem.entries()]
        .map(([grupo, operacoes]) => ({ grupo, operacoes }))
        .sort((a, b) => b.operacoes - a.operacoes),
    );
    setLoading(false);
  }, []);

  const definirGrupo = async (g: GrupoPendente, nome: string) => {
    let q = supabase
      .from("operacoes_credito")
      .update({ responsavel: nome, updated_at: new Date().toISOString() } as any)
      .is("deleted_at", null)
      .is("responsavel", null);
    q = g.grupo === SEM_GRUPO ? q.is("grupo", null) : q.eq("grupo", g.grupo);
    const { error } = await q;
    if (error) {
      toast.error("Não foi possível definir o responsável");
      return;
    }
    toast.success(`${g.grupo} ficou com ${nome}`);
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const definir = async (cliente: Pendente, userId: string) => {
    const { error } = await supabase
      .from("clientes")
      .update({ responsavel_pos_venda: userId, aguardando_distribuicao: false, updated_at: new Date().toISOString() } as any)
      .eq("id", cliente.id);
    if (error) {
      toast.error("Não foi possível definir o responsável");
      return;
    }
    toast.success(`${cliente.nome} entrou na carteira`);
    load();
  };

  if (loading || (itens.length === 0 && grupos.length === 0)) return null;

  const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const blocoGrupos = grupos.length > 0 && (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-bold">
        <Users className="h-5 w-5 text-accent" /> Operações sem responsável{" "}
        <span className="font-sans text-sm font-semibold">
          ({grupos.reduce((s, g) => s + g.operacoes, 0)} operação(ões))
        </span>
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Operações importadas sem grupo definido. Quando há grupo, a operação já herda o responsável do grupo
        automaticamente.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Grupo</th>
              <th className="px-3 py-2 text-left">Operações</th>
              <th className="px-3 py-2 text-right">Definir responsável</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.grupo} className="border-t border-border">
                <td className="px-3 py-2 font-semibold">{g.grupo}</td>
                <td className="px-3 py-2">{g.operacoes}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    {RESPONSAVEIS_CARTEIRA.map((r) => (
                      <Button
                        key={r.userId}
                        size="sm"
                        variant="outline"
                        disabled={!podeGerirCliente}
                        title={podeGerirCliente ? undefined : "Somente o administrador distribui a carteira"}
                        onClick={() => definirGrupo(g, semAcento(r.nome))}
                      >
                        {r.nome}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  if (itens.length === 0) return <>{blocoGrupos}</>;

  return (
    <div className="space-y-4">
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-bold">
        <Users className="h-5 w-5 text-accent" /> Clientes a distribuir{" "}
        <span className="font-sans text-sm font-semibold">({itens.length})</span>
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Fechamentos cadastrados pelo comercial, ainda sem responsável de carteira.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Grupo</th>
              <th className="px-3 py-2 text-left">Na fila há</th>
              <th className="px-3 py-2 text-right">Definir responsável</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((c) => {
              const dias = diasUteisDesde(c.cadastrado_em);
              const atrasado = dias > 1;
              return (
                <tr key={c.id} className={`border-t border-border ${atrasado ? "bg-destructive/10" : ""}`}>
                  <td className="px-3 py-2 font-semibold">{c.nome}</td>
                  <td className="px-3 py-2">{c.grupo || "—"}</td>
                  <td className={`px-3 py-2 ${atrasado ? "font-semibold text-destructive" : ""}`}>
                    {dias} dia(s) útil(eis)
                    {atrasado && (
                      <Badge variant="outline" className="ml-2 border-destructive font-normal text-destructive">
                        atrasado
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {RESPONSAVEIS_CARTEIRA.map((r) => (
                        <Button
                          key={r.userId}
                          size="sm"
                          variant="outline"
                          disabled={!podeGerirCliente}
                          title={podeGerirCliente ? undefined : "Somente o administrador distribui a carteira"}
                          onClick={() => definir(c, r.userId)}
                        >
                          {r.nome}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
    {blocoGrupos}
    </div>
  );
}

export default ClientesADistribuirPanel;
