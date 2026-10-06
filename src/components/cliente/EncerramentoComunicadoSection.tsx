import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export interface ComunicadoEncerramento {
  data: string;
  canal: string;
  arquivo: string;
}

export const comunicadoVazio: ComunicadoEncerramento = { data: "", canal: "", arquivo: "" };

const CANAIS = ["E-mail", "WhatsApp", "Carta / AR", "Cartório", "Entrega em mãos"];

interface OperacaoProxima {
  id: string;
  banco: string | null;
  numero: string | null;
  vence_em: string;
}

interface Props {
  clienteId: string | null;
  /** Situação escolhida agora (encerrado, rescindido…). */
  situacao: string;
  /** Situação que estava gravada antes da edição. */
  situacaoOriginal: string;
  valor: ComunicadoEncerramento;
  onChange: (v: ComunicadoEncerramento) => void;
  /** Operações com vencimento nos próximos 60 dias (devolvidas ao pai). */
  onOperacoes: (ops: OperacaoProxima[]) => void;
  podeEncerrar: boolean;
}

const fmt = (d: string) => (d ? d.split("-").reverse().join("/") : "");

/**
 * Antes de encerrar/rescindir um cliente, o app lista as operações que vencem
 * nos próximos 60 dias e exige o registro do comunicado por escrito.
 */
export function EncerramentoComunicadoSection({
  clienteId,
  situacao,
  situacaoOriginal,
  valor,
  onChange,
  onOperacoes,
  podeEncerrar,
}: Props) {
  const [ops, setOps] = useState<OperacaoProxima[]>([]);
  const [enviando, setEnviando] = useState(false);
  const encerrando = situacao !== "ativo" && situacaoOriginal === "ativo";

  useEffect(() => {
    if (!encerrando || !clienteId) {
      setOps([]);
      onOperacoes([]);
      return;
    }
    const hoje = new Date();
    const fim = new Date(hoje.getTime() + 60 * 86_400_000);
    supabase
      .from("operacoes_credito")
      .select("id, banco, numero, vence_em")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .is("historico_em", null)
      .gte("vence_em", hoje.toISOString().slice(0, 10))
      .lte("vence_em", fim.toISOString().slice(0, 10))
      .order("vence_em")
      .then(({ data }) => {
        const lista = ((data as any[]) || []) as OperacaoProxima[];
        setOps(lista);
        onOperacoes(lista);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encerrando, clienteId]);

  if (!encerrando) return null;

  const subir = async (file: File) => {
    if (!clienteId) return;
    setEnviando(true);
    const path = `${clienteId}/encerramento/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cliente-drive").upload(path, file);
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível anexar o comunicado.");
      return;
    }
    onChange({ ...valor, arquivo: path });
    toast.success("Comunicado anexado.");
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Encerramento do cliente</h3>
          {!podeEncerrar && (
            <p className="mt-1 text-xs text-muted-foreground">Encerrar cliente é decisão do Willian.</p>
          )}
          {ops.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhuma operação vence nos próximos 60 dias. Pode encerrar.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-foreground">
                {ops.length} operação(ões) vencem nos próximos 60 dias. Só é possível encerrar depois de registrar o
                comunicado por escrito ao cliente.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {ops.map((o) => (
                  <li key={o.id}>
                    {fmt(o.vence_em)} — {o.banco || "banco a conferir"} — {o.numero || "sem número"}
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Data do comunicado</Label>
                  <Input type="date" value={valor.data} onChange={(e) => onChange({ ...valor, data: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Canal</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={valor.canal}
                    onChange={(e) => onChange({ ...valor, canal: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {CANAIS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Arquivo do comunicado</Label>
                  <Input
                    type="file"
                    disabled={enviando}
                    onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
                  />
                  {valor.arquivo && (
                    <p className="mt-1 text-[11px] text-emerald-700">Anexado: {valor.arquivo.split("/").pop()}</p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                O registro fica guardado na ficha do cliente.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
