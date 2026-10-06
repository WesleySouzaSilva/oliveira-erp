import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, XCircle, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Mede a "saúde" do cadastro de um cliente: % de campos críticos preenchidos.
 * Clique para ver detalhes dos campos faltantes e como preenchê-los.
 */
const CAMPOS = [
  { key: "cpf_cnpj", label: "CPF/CNPJ", dica: "Informe o CPF (11 dígitos) ou CNPJ (14 dígitos) do produtor." },
  { key: "telefone", label: "Telefone", dica: "Adicione o celular ou telefone fixo com DDD para contato direto." },
  { key: "email", label: "E-mail", dica: "Cadastre um e-mail válido para envio de relatórios e notificações." },
  { key: "municipio", label: "Município", dica: "Informe o município da sede da propriedade ou residência." },
  { key: "uf", label: "UF", dica: "Selecione a sigla do estado (ex: MG, SP, PR)." },
  { key: "nome_propriedade", label: "Propriedade", dica: "Registre o nome da fazenda, sítio ou propriedade rural." },
  { key: "cultura_principal", label: "Cultura principal", dica: "Indique a cultura predominante na safra atual (ex: soja, milho)." },
  { key: "area_total_hectares", label: "Área (ha)", dica: "Preencha a área total da propriedade em hectares." },
] as const;

export function CadastroSaudeBadge({ cliente }: { cliente: any | null }) {
  const [aberto, setAberto] = useState(false);

  const { pct, campos } = useMemo(() => {
    if (!cliente) {
      return {
        pct: 0,
        campos: CAMPOS.map((c) => ({ ...c, ok: false })),
      };
    }
    let ok = 0;
    const lista = CAMPOS.map((c) => {
      const v = cliente[c.key];
      const preenchido = v !== null && v !== undefined && String(v).trim() !== "";
      if (preenchido) ok++;
      return { ...c, ok: preenchido };
    });
    return { pct: Math.round((ok / CAMPOS.length) * 100), campos: lista };
  }, [cliente]);

  const faltando = campos.filter((c) => !c.ok);
  const tone =
    pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-destructive";
  const toneText =
    pct >= 85 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-destructive";

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Card
          className={cn(
            "p-3 cursor-pointer transition-shadow hover:shadow-md border",
            aberto && "ring-1 ring-primary"
          )}
          role="button"
          aria-label="Ver detalhes da saúde do cadastro"
        >
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium flex items-center gap-1.5">
              {pct >= 85 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              )}
              Saúde do cadastro
            </p>
            <span className="text-xs font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${tone} transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {faltando.length > 0 && pct < 100 && (
            <div className="flex items-center gap-1 mt-1.5">
              <p className="text-[11px] text-muted-foreground truncate">
                Faltam: {faltando.slice(0, 3).map((c) => c.label).join(", ")}
                {faltando.length > 3 ? ` e +${faltando.length - 3}` : ""}
              </p>
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            </div>
          )}
        </Card>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b bg-muted/30">
          <h4 className="text-sm font-semibold">Saúde do cadastro</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pct === 100
              ? "Cadastro completo!"
              : `${faltando.length} de ${CAMPOS.length} campos críticos pendentes`}
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
            <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {campos.map((c) => (
            <div
              key={c.key}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-2 text-sm",
                c.ok ? "bg-emerald-50/50" : "bg-amber-50/50"
              )}
            >
              {c.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <XCircle className={cn("w-4 h-4 mt-0.5 shrink-0", toneText)} />
              )}
              <div className="min-w-0">
                <p className={cn("font-medium text-xs", c.ok ? "text-emerald-700" : toneText)}>
                  {c.label}
                </p>
                {!c.ok && (
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {c.dica}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {faltando.length > 0 && (
          <div className="p-3 border-t bg-muted/20 text-[11px] text-muted-foreground">
            <span className={cn("font-medium", toneText)}>Dica:</span> preencher todos os
            campos acelera a geração de laudos e relatórios jurídicos.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default CadastroSaudeBadge;
