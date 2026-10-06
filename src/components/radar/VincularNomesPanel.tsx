import { useCallback, useEffect, useMemo, useState } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { normNome } from "@/lib/situacaoCliente";
import { notifyRadarChanged } from "@/hooks/useOperacoesCredito";

interface Ficha {
  id: string;
  nome: string;
  grafias_alternativas: string[] | null;
}

/** Semelhança simples entre dois nomes: proporção de palavras em comum. */
function semelhanca(a: string, b: string) {
  const pa = new Set(normNome(a).split(" ").filter(Boolean));
  const pb = new Set(normNome(b).split(" ").filter(Boolean));
  if (!pa.size || !pb.size) return 0;
  let comuns = 0;
  pa.forEach((p) => {
    if (pb.has(p)) comuns += 1;
  });
  return comuns / Math.max(pa.size, pb.size);
}

export function VincularNomesPanel() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [nomes, setNomes] = useState<string[]>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cl, cv] = await Promise.all([
      supabase.from("clientes").select("id, nome, grafias_alternativas").is("deleted_at", null),
      lerTudo(() => supabase.from("contratos_vencimentos").select("nome_cliente").is("deleted_at", null)),
    ]);
    const lista = ((cl.data as any[]) || []) as Ficha[];
    setFichas(lista);
    const conhecidos = new Set(lista.map((f) => normNome(f.nome)));
    lista.forEach((f) => (f.grafias_alternativas || []).forEach((g) => conhecidos.add(normNome(g))));
    const pendentes = Array.from(
      new Set(
        (((cv.data as any[]) || []).map((r) => (r.nome_cliente || "").trim()) as string[])
          .filter((n) => n && !conhecidos.has(normNome(n))),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    setNomes(pendentes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sugestoes = useMemo(() => {
    const map: Record<string, string> = {};
    nomes.forEach((n) => {
      let melhor = "";
      let score = 0;
      fichas.forEach((f) => {
        const s = semelhanca(n, f.nome);
        if (s > score) {
          score = s;
          melhor = f.id;
        }
      });
      if (score >= 0.5) map[n] = melhor;
    });
    return map;
  }, [nomes, fichas]);

  const vincular = async (nome: string) => {
    const fichaId = escolha[nome] || sugestoes[nome];
    const ficha = fichas.find((f) => f.id === fichaId);
    if (!ficha) {
      toast.error("Escolha a ficha do cliente");
      return;
    }
    setSalvando(nome);
    const grafias = Array.from(new Set([...(ficha.grafias_alternativas || []), nome]));
    const [u1, u2] = await Promise.all([
      supabase.from("contratos_vencimentos").update({ nome_cliente: ficha.nome }).eq("nome_cliente", nome),
      supabase.from("clientes").update({ grafias_alternativas: grafias }).eq("id", ficha.id),
    ]);
    setSalvando(null);
    if (u1.error || u2.error) {
      toast.error("Não foi possível vincular");
      return;
    }
    toast.success(`Vinculado a ${ficha.nome}`);
    await load();
    notifyRadarChanged();
  };

  if (nomes.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/5 p-4">
      <h2 className="text-base font-serif font-bold flex items-center gap-2 mb-1">
        <Link2 className="w-4 h-4 text-orange-600" /> Nomes a vincular ({nomes.length})
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Contratos antigos cujo nome não bate com nenhuma ficha. Ao vincular, o nome antigo fica guardado como grafia
        alternativa do cliente.
      </p>
      <div className="space-y-2">
        {nomes.map((n) => (
          <div key={n} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm min-w-[16rem]">{n}</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[16rem]"
              value={escolha[n] ?? sugestoes[n] ?? ""}
              onChange={(e) => setEscolha((s) => ({ ...s, [n]: e.target.value }))}
              aria-label={`Ficha para ${n}`}
            >
              <option value="">Escolher ficha…</option>
              {fichas
                .slice()
                .sort((a, b) => semelhanca(n, b.nome) - semelhanca(n, a.nome))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
            </select>
            <Button size="sm" variant="outline" disabled={salvando === n} onClick={() => vincular(n)}>
              Vincular
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
