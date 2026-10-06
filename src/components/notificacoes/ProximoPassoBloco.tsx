import { useState } from "react";
import { Check, X, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DECISOES, labelDecisao, proximoPasso, type PrazosConfig } from "@/lib/notificacoesBanco";
import type { ItemNotificacao } from "@/hooks/useNotificacoesBanco";
import type { ContextoProximoPasso } from "@/lib/notificacoesBanco";

/**
 * Bloco do próximo passo: semáforo dos requisitos + sugestão.
 * A decisão é sempre do Willian (podeDecidir).
 */
export function ProximoPassoBloco({
  item,
  contexto,
  config,
  podeDecidir,
  meuNome,
  onDecidir,
}: {
  item: ItemNotificacao;
  contexto: ContextoProximoPasso;
  config: PrazosConfig;
  podeDecidir: boolean;
  meuNome: string;
  onDecidir: (d: { decisao: string; motivo: string; sugestao: string | null; nome: string }) => Promise<boolean>;
}) {
  const [decisao, setDecisao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!item.ficha) return null;
  const passo = proximoPasso(item.ficha, contexto, config);
  const silencio = item.dias_parados >= config.dias_silencio && !!item.ficha.protocolo_data;
  if (item.estado !== "respondida" && !silencio) return null;

  return (
    <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3">
      <p className="flex items-center gap-2 font-serif text-sm font-bold">
        <Scale className="h-4 w-4 text-accent" /> Próximo passo
      </p>

      <ul className="mt-2 space-y-1 text-xs">
        {passo.requisitos.map((r) => (
          <li key={r.label} className="flex items-start gap-1.5">
            {r.ok ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            )}
            <span className={r.ok ? "" : "text-destructive"}>
              {r.label}
              {r.detalhe && <span className="text-muted-foreground"> — {r.detalhe}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 rounded border border-border bg-card p-2 text-xs">
        {passo.faltando.length > 0 ? (
          <p className="font-semibold text-destructive">Falta {passo.faltando.join("; ")} para ajuizar.</p>
        ) : passo.sugestao ? (
          <p>
            <Badge className="mr-2 bg-accent font-normal text-accent-foreground">Sugestão</Badge>
            <span className="font-semibold">{labelDecisao(passo.sugestao)}</span> — {passo.motivo}
          </p>
        ) : (
          <p className="text-muted-foreground">Sem sugestão por enquanto: aguardando resposta dentro do prazo.</p>
        )}
      </div>

      {item.ficha.decisao && (
        <p className="mt-2 text-xs text-muted-foreground">
          Decisão registrada: <strong>{labelDecisao(item.ficha.decisao)}</strong>
          {item.ficha.decisao_motivo ? ` — ${item.ficha.decisao_motivo}` : ""}
        </p>
      )}

      {podeDecidir ? (
        <div className="mt-3 space-y-2">
          <Select value={decisao} onValueChange={setDecisao}>
            <SelectTrigger aria-label="Decisão">
              <SelectValue placeholder="Decidir o próximo passo" />
            </SelectTrigger>
            <SelectContent>
              {DECISOES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            rows={2}
            placeholder="Motivo da decisão"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!decisao || !motivo.trim() || salvando}
            onClick={async () => {
              setSalvando(true);
              const ok = await onDecidir({
                decisao,
                motivo: motivo.trim(),
                sugestao: passo.sugestao,
                nome: meuNome,
              });
              setSalvando(false);
              if (ok) {
                setDecisao("");
                setMotivo("");
              }
            }}
          >
            Registrar decisão
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">A decisão de ajuizar é do Willian.</p>
      )}
    </div>
  );
}
