import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Users } from "lucide-react";
import { EtiquetasGarantia } from "@/components/radar/EtiquetasGarantia";
import { labelEstrategia, labelTipoGarantia, siglaTipoGarantia } from "@/lib/garantias";
import { ROTULO_NUMERO_INVALIDO } from "@/lib/numeroOperacao";

const dataBR = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

interface OpResumo {
  id: string;
  banco: string;
  numero: string;
  vence_em: string | null;
  estrategia: string | null;
  garantias: { tipo: string; descricao: string | null; identificacao: string | null; grau: string | null }[];
  avalistas: { nome: string; pessoa_id: string | null }[];
}

interface Props {
  clienteId: string | null;
  /** Nome do grupo/família para montar o quadro "Quem avaliza quem". */
  grupo?: string | null;
}

export function GarantiasEstrategiaBloco({ clienteId, grupo }: Props) {
  const [ops, setOps] = useState<OpResumo[]>([]);
  const [quadro, setQuadro] = useState<{ nome: string; devedora: number; avaliza: number; deQuem: string[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) {
      setOps([]);
      setLoading(false);
      return;
    }
    const run = async () => {
      setLoading(true);
      // Operações da família quando houver grupo; senão, só as do cliente.
      let idsClientes = [clienteId];
      let nomePorCliente = new Map<string, string>();
      if (grupo) {
        const { data } = await supabase
          .from("clientes")
          .select("id, nome")
          .eq("grupo", grupo)
          .is("deleted_at", null);
        (data as any[])?.forEach((c) => nomePorCliente.set(c.id, c.nome));
        if (data?.length) idsClientes = (data as any[]).map((c) => c.id);
      }
      if (!nomePorCliente.size) {
        const { data } = await supabase.from("clientes").select("id, nome").eq("id", clienteId).maybeSingle();
        if (data) nomePorCliente.set((data as any).id, (data as any).nome);
      }

      const { data: operacoes } = await supabase
        .from("operacoes_credito")
        .select("id, banco, numero, numero_invalido, vence_em, estrategia, cliente_id")
        .in("cliente_id", idsClientes)
        .is("deleted_at", null)
        .order("vence_em");

      const listaOps = (operacoes as any[]) || [];
      const ids = listaOps.map((o) => o.id);
      const [gar, ava] = ids.length
        ? await Promise.all([
            supabase.from("operacao_garantias").select("operacao_id, tipo, descricao, identificacao, grau").in("operacao_id", ids),
            supabase.from("operacao_avalistas").select("operacao_id, nome, pessoa_id").in("operacao_id", ids),
          ])
        : [{ data: [] } as any, { data: [] } as any];

      const garPorOp = new Map<string, any[]>();
      ((gar.data as any[]) || []).forEach((g) => {
        garPorOp.set(g.operacao_id, [...(garPorOp.get(g.operacao_id) || []), g]);
      });
      const avaPorOp = new Map<string, any[]>();
      ((ava.data as any[]) || []).forEach((a) => {
        avaPorOp.set(a.operacao_id, [...(avaPorOp.get(a.operacao_id) || []), a]);
      });

      setOps(
        listaOps
          .filter((o) => !grupo || o.cliente_id === clienteId || true)
          .map((o) => ({
            id: o.id,
            banco: o.banco,
            numero: (o as any).numero_invalido ? ROTULO_NUMERO_INVALIDO : o.numero,
            vence_em: o.vence_em,
            estrategia: o.estrategia,
            garantias: garPorOp.get(o.id) || [],
            avalistas: avaPorOp.get(o.id) || [],
          })),
      );

      // Quem avaliza quem, dentro da família.
      const porPessoa = new Map<string, { devedora: number; avaliza: number; deQuem: Set<string> }>();
      const get = (nome: string) => {
        if (!porPessoa.has(nome)) porPessoa.set(nome, { devedora: 0, avaliza: 0, deQuem: new Set() });
        return porPessoa.get(nome)!;
      };
      listaOps.forEach((o) => {
        const titular = nomePorCliente.get(o.cliente_id) || "Sem titular";
        get(titular).devedora += 1;
        (avaPorOp.get(o.id) || []).forEach((a) => {
          const e = get(a.nome);
          e.avaliza += 1;
          e.deQuem.add(titular);
        });
      });
      setQuadro(
        Array.from(porPessoa.entries())
          .map(([nome, v]) => ({ nome, devedora: v.devedora, avaliza: v.avaliza, deQuem: Array.from(v.deQuem) }))
          .sort((a, b) => b.devedora + b.avaliza - (a.devedora + a.avaliza)),
      );
      setLoading(false);
    };
    run();
  }, [clienteId, grupo]);

  if (!clienteId) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="w-4 h-4" /> Garantias e estratégia
      </h3>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : ops.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma operação cadastrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-1">Banco</th>
                <th className="text-left py-1">Operação</th>
                <th className="text-left py-1">Vence em</th>
                <th className="text-left py-1">Estratégia</th>
                <th className="text-left py-1">Garantias</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((o) => (
                <tr key={o.id} className="border-t border-border align-top">
                  <td className="py-2 pr-3">{o.banco}</td>
                  <td className="py-2 pr-3">{o.numero}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{dataBR(o.vence_em)}</td>
                  <td className="py-2 pr-3">{labelEstrategia(o.estrategia) || "—"}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <EtiquetasGarantia
                        tipos={o.garantias.map((g) => g.tipo)}
                        temAvalista={o.avalistas.length > 0}
                      />
                      <span className="text-xs text-muted-foreground">
                        {o.garantias
                          .map((g) =>
                            [labelTipoGarantia(g.tipo) + (g.grau ? ` ${g.grau}` : ""), g.descricao, g.identificacao]
                              .filter(Boolean)
                              .join(" · "),
                          )
                          .join(" | ")}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {quadro.length > 0 && (
        <div className="pt-2 border-t border-border">
          <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
            <Users className="w-4 h-4" /> Quem avaliza quem
          </h4>
          <ul className="text-sm space-y-1">
            {quadro.map((p) => (
              <li key={p.nome}>
                <span className="font-medium">{p.nome}</span>{" "}
                <span className="text-muted-foreground">
                  — devedora principal em {p.devedora} {p.devedora === 1 ? "operação" : "operações"}; avalista em{" "}
                  {p.avaliza} {p.avaliza === 1 ? "operação" : "operações"}
                  {p.deQuem.length ? ` (de ${p.deQuem.join(", ")})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const siglaGarantia = siglaTipoGarantia;
