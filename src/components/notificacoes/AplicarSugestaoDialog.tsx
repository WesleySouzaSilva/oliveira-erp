import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useVarreduraSugestoes } from "@/hooks/useVarreduraSugestoes";
import { normTexto, ORIGEM_VARREDURA } from "@/lib/varredura";
import { formatDataBR } from "@/lib/notificacoesBanco";
import type { OperacaoCredito } from "@/hooks/useOperacoesCredito";

/** Sugestões da varredura para uma operação. Nada é aplicado sem clique + confirmação. */
export function AplicarSugestaoDialog({
  operacao,
  tipo,
  open,
  onOpenChange,
  meuNome,
}: {
  operacao: OperacaoCredito | null;
  tipo: "instituicao" | "protocolo";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meuNome: string;
}) {
  const { sugestoes, aplicarInstituicao, aplicarProtocolo, descartar, loading } = useVarreduraSugestoes(tipo);
  const [confirmado, setConfirmado] = useState(false);
  const [aplicando, setAplicando] = useState<string | null>(null);

  const nome = operacao?.cliente_nome || operacao?.titular_nome || operacao?.grupo || "";
  const doCliente = useMemo(() => {
    const alvo = normTexto(nome);
    if (!alvo) return [];
    return sugestoes.filter(
      (s) =>
        s.status === "pendente" &&
        (normTexto(s.cliente_nome) === alvo ||
          normTexto(s.cliente_nome).includes(alvo) ||
          alvo.includes(normTexto(s.cliente_nome))),
    );
  }, [sugestoes, nome]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {tipo === "instituicao" ? "Sugestões de instituição" : "Sugestões de protocolo"}
          </DialogTitle>
          <DialogDescription>
            {nome} — {operacao?.banco}. {ORIGEM_VARREDURA}. Aplicar exige sua conferência na cédula.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : doCliente.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sugestão da varredura para este cliente.</p>
        ) : (
          <div className="space-y-2">
            {doCliente.map((s) => (
              <div key={s.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-semibold">
                  {s.valor}
                  {s.codigo && <span className="font-normal text-muted-foreground"> · cód. {s.codigo}</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {tipo === "protocolo" && s.data ? `Data ${formatDataBR(s.data)} · ` : ""}
                  apareceu {s.vezes}× · arquivo {s.arquivo || "—"}
                </p>
                {s.variantes?.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Também escrito como: {s.variantes.join(", ")}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    disabled={!confirmado || aplicando === s.id || !operacao}
                    onClick={async () => {
                      if (!operacao) return;
                      setAplicando(s.id);
                      const ok =
                        tipo === "instituicao"
                          ? await aplicarInstituicao(s, operacao.id, meuNome)
                          : await aplicarProtocolo(s, operacao.id, meuNome);
                      setAplicando(null);
                      if (ok) onOpenChange(false);
                    }}
                  >
                    Aplicar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => descartar(s.id, `Descartada por ${meuNome}`)}>
                    Descartar
                  </Button>
                  <Badge variant="outline" className="ml-auto font-normal">
                    sugestão
                  </Badge>
                </div>
              </div>
            ))}
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={confirmado} onCheckedChange={(v) => setConfirmado(!!v)} />
              <span>
                Confirmo que conferi {tipo === "instituicao" ? "a instituição" : "o protocolo"} na cédula/no documento
                antes de aplicar.
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
