import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BancoContratadoCheckbox } from "@/components/cliente/BancoContratadoCheckbox";

export const normBancoNome = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Seção única "Bancos contratados", usada no fechamento e no editar cadastro.
 * Lista os bancos que aparecem nas operações e permite acrescentar um banco
 * contratado que ainda não tem operação cadastrada.
 */
export function BancosContratadosSection({
  bancosDasOperacoes,
  marcados,
  onChange,
  disabled = false,
  avisoBloqueio,
  obrigatorio = false,
  salvando,
}: {
  bancosDasOperacoes: string[];
  marcados: string[];
  onChange: (bancos: string[]) => void;
  disabled?: boolean;
  avisoBloqueio?: string;
  obrigatorio?: boolean;
  salvando?: string | null;
}) {
  const [novo, setNovo] = useState("");

  const lista = useMemo(() => {
    const vistos = new Map<string, string>();
    [...bancosDasOperacoes, ...marcados]
      .map((b) => (b || "").trim())
      .filter(Boolean)
      .forEach((b) => {
        const k = normBancoNome(b);
        if (k && !vistos.has(k)) vistos.set(k, b);
      });
    return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [bancosDasOperacoes, marcados]);

  const estaMarcado = (banco: string) =>
    marcados.some((m) => normBancoNome(m) === normBancoNome(banco));

  const alternar = (banco: string, checked: boolean) => {
    const semEle = marcados.filter((m) => normBancoNome(m) !== normBancoNome(banco));
    onChange(checked ? [...semEle, banco] : semEle);
  };

  const acrescentar = () => {
    const nome = novo.trim();
    if (!nome) return;
    if (!estaMarcado(nome)) onChange([...marcados, nome]);
    setNovo("");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-serif text-sm font-bold text-foreground">Bancos contratados</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Marque as instituições que fazem parte do contrato do escritório. Só banco marcado entra no
        radar, gera tarefa e abre processo no ADVBOX.
        {obrigatorio && " É obrigatório marcar pelo menos um banco."}
      </p>
      {disabled && avisoBloqueio && (
        <p className="mt-2 text-xs font-semibold text-amber-600">{avisoBloqueio}</p>
      )}

      {lista.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nenhum banco nas operações ainda. Acrescente abaixo se já houver banco contratado.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {lista.map((banco) => (
            <BancoContratadoCheckbox
              key={normBancoNome(banco)}
              banco={banco}
              checked={estaMarcado(banco)}
              disabled={disabled}
              loading={salvando === normBancoNome(banco)}
              title={disabled ? avisoBloqueio : undefined}
              onChange={(checked) => alternar(banco, checked)}
            />
          ))}
        </div>
      )}

      {!disabled && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                acrescentar();
              }
            }}
            placeholder="Acrescentar banco contratado sem operação cadastrada"
            aria-label="Acrescentar banco contratado"
          />
          <Button type="button" variant="outline" onClick={acrescentar} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Acrescentar
          </Button>
        </div>
      )}
    </section>
  );
}
