import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, ShieldCheck } from "lucide-react";
import { useOperacoesCredito, diasRestantes, type OperacaoCredito } from "@/hooks/useOperacoesCredito";
import { OperacaoFormDialog } from "./OperacaoFormDialog";
import { GarantiasEstrategiaDialog } from "./GarantiasEstrategiaDialog";
import { EtiquetasGarantia } from "./EtiquetasGarantia";
import { GarantiasEstrategiaBloco } from "@/components/cliente/GarantiasEstrategiaBloco";
import { labelEstrategia } from "@/lib/garantias";

const formatDataBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const formatBRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Número informado, ignorando "sem número"
const numeroLimpo = (numero: string | null | undefined) => {
  const txt = (numero || "").trim();
  if (!txt || /^sem\s*n/i.test(txt)) return "";
  return txt.replace(/\D/g, "");
};
// Quando veio da varredura sem número, tenta o número que está no nome do arquivo
const numeroDoArquivo = (arquivo: string | null | undefined) => {
  const nome = (arquivo || "").split(/[\\/]/).pop() || "";
  const achados = nome.match(/\d{5,}/g);
  return achados && achados.length ? achados[0] : "";
};
// Quanto mais campos preenchidos, mais completa é a linha
const completude = (o: OperacaoCredito) =>
  [o.banco, o.numero && !/^sem\s*n/i.test(o.numero) ? o.numero : null, o.modalidade, o.vence_em, o.saldo_devedor, o.responsavel]
    .filter(Boolean).length;

export function ClienteOperacoesTab({ clienteId }: { clienteId: string | null }) {
  const { operacoes, loading, reload } = useOperacoesCredito({ clienteId: clienteId || undefined });
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<OperacaoCredito | null>(null);
  const [garantiasOpen, setGarantiasOpen] = useState(false);
  const [opGarantias, setOpGarantias] = useState<OperacaoCredito | null>(null);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const grupo = operacoes.find((o) => o.grupo)?.grupo || null;

  // Agrupa cópias da mesma cédula (mesmo banco + mesmo número), vindas da varredura em pastas diferentes
  const { unicas, copias } = useMemo(() => {
    const porChave = new Map<string, { melhor: OperacaoCredito; repetidas: number }>();
    const soltas: OperacaoCredito[] = [];
    for (const o of operacoes) {
      const num = numeroLimpo(o.numero) || numeroDoArquivo(o.origem_arquivo);
      if (!num) { soltas.push(o); continue; }
      const chave = `${(o.banco || "").toLowerCase()}|${num}`;
      const atual = porChave.get(chave);
      if (!atual) porChave.set(chave, { melhor: o, repetidas: 0 });
      else {
        atual.repetidas++;
        if (completude(o) > completude(atual.melhor)) atual.melhor = o;
      }
    }
    const agrupadas = [...porChave.values()];
    return {
      unicas: [...agrupadas.map((a) => a.melhor), ...soltas],
      copias: agrupadas.reduce((s, a) => s + a.repetidas, 0),
    };
  }, [operacoes]);

  const lista = mostrarTodas ? operacoes : unicas;

  if (!clienteId) {
    return <p className="text-sm text-muted-foreground">Cadastre a ficha do cliente para lançar operações de crédito.</p>;
  }


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Operações de crédito deste cliente: {unicas.length}
          {copias > 0 && ` (${copias} ${copias === 1 ? "cópia" : "cópias"} do mesmo documento agrupadas)`}
        </p>
        <div className="flex items-center gap-2">
          {copias > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setMostrarTodas((v) => !v)}>
              {mostrarTodas ? "Agrupar repetidas" : "Mostrar todas"}
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditando(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nova operação
          </Button>
        </div>
      </div>



      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : operacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma operação cadastrada para este cliente.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Banco</th>
                <th className="text-left px-3 py-2">Operação</th>
                <th className="text-left px-3 py-2">Modalidade</th>
                <th className="text-left px-3 py-2">Garantias</th>
                <th className="text-left px-3 py-2">Estratégia</th>
                <th className="text-left px-3 py-2">Vence em</th>
                <th className="text-right px-3 py-2">Saldo devedor</th>
                <th className="text-left px-3 py-2">Responsável</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => {
                const dias = diasRestantes(o.vence_em);
                const numArquivo = numeroLimpo(o.numero) ? "" : numeroDoArquivo(o.origem_arquivo);
                return (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-3 py-2">{o.banco || "—"}</td>
                    <td className="px-3 py-2">
                      {numeroLimpo(o.numero) ? o.numero : numArquivo ? `${numArquivo} (do documento)` : "Sem número"}
                    </td>
                    <td className="px-3 py-2">{o.modalidade || "—"}</td>

                    <td className="px-3 py-2">
                      <EtiquetasGarantia tipos={o.garantias_tipos} temAvalista={o.tem_avalista} />
                    </td>
                    <td className="px-3 py-2 text-xs">{labelEstrategia(o.estrategia) || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {o.vence_em ? (
                        <>
                          {formatDataBR(o.vence_em)}{" "}
                          <span className={dias <= 30 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                            ({dias} dias)
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sem vencimento</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatBRL(o.saldo_devedor)}</td>
                    <td className="px-3 py-2">{o.responsavel || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {o.notificado_em
                        ? `Protocolado em ${formatDataBR(o.notificado_em)}`
                        : o.dispensar_alerta
                          ? "Alerta dispensado"
                          : "No radar"}
                      {o.natureza_credito && (
                        <span className="block text-muted-foreground">{o.natureza_credito}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Garantias e estratégia"
                        onClick={() => { setOpGarantias(o); setGarantiasOpen(true); }}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditando(o); setFormOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <GarantiasEstrategiaBloco clienteId={clienteId} grupo={grupo} />

      <OperacaoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clienteId={clienteId}
        operacao={editando}
        onSaved={reload}
      />

      <GarantiasEstrategiaDialog
        open={garantiasOpen}
        onOpenChange={setGarantiasOpen}
        operacao={opGarantias}
        onSaved={reload}
      />
    </div>
  );
}
