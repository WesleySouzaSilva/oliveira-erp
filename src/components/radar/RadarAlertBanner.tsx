import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronUp } from "lucide-react";
import { useOperacoesCredito, diasRestantes } from "@/hooks/useOperacoesCredito";

const AMBAR_SESSION_KEY = "oliveira:radar-ambar-recolhido";

const formatDiaMes = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export function RadarAlertBanner() {
  const { operacoes, loading, vencidas, ate30, entre31e60, listaVencidas, lista0a30 } = useOperacoesCredito({
    somentePendentes: true,
  });
  const [ambarRecolhido, setAmbarRecolhido] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AMBAR_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (loading || operacoes.length === 0) return null;

  const top3Vencidas = listaVencidas.slice(0, 3);
  const top3Criticas = lista0a30.slice(0, 3);

  if (vencidas > 0 || ate30 > 0) {
    return (
      <div className="w-full">
        {vencidas > 0 && (
          <Link
            to="/vencimentos#radar"
            className="block w-full bg-rose-950 text-white px-4 sm:px-6 lg:px-10 py-4 min-h-[88px] hover:brightness-125 transition-[filter]"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-7 h-7 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold leading-tight text-[22px] sm:text-[24px] uppercase">
                  {vencidas} {vencidas === 1 ? "operação já vencida" : "operações já vencidas"} sem pedido protocolado
                </p>
                <ul className="mt-1.5 space-y-0.5 text-sm font-medium opacity-95">
                  {top3Vencidas.map(({ op, dias }) => (
                    <li key={op.id} className="truncate">
                      {op.cliente_nome || "Sem cliente"} · {op.banco} · venceu {formatDiaMes(op.vence_em)} (há{" "}
                      {Math.abs(dias)} dias)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Link>
        )}

        {ate30 > 0 && (
          <Link
            to="/vencimentos#radar"
            className="block w-full bg-destructive text-destructive-foreground px-4 sm:px-6 lg:px-10 py-4 min-h-[88px] hover:brightness-110 transition-[filter]"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-7 h-7 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold leading-tight text-[22px] sm:text-[24px] uppercase">
                  {ate30} {ate30 === 1 ? "operação vence" : "operações vencem"} em até 30 dias — pedido ainda não protocolado
                </p>
                <ul className="mt-1.5 space-y-0.5 text-sm font-medium opacity-95">
                  {top3Criticas.map(({ op, dias }) => (
                    <li key={op.id} className="truncate">
                      {op.cliente_nome || "Sem cliente"} · {op.banco} · vence {formatDiaMes(op.vence_em)} (em {dias} dias)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Link>
        )}
      </div>
    );
  }

  if (entre31e60 > 0 && !ambarRecolhido) {
    return (
      <div className="w-full bg-amber-500 text-white px-4 sm:px-6 lg:px-10 min-h-[56px] flex items-center gap-3">
        <Link to="/vencimentos#radar" className="flex-1 font-semibold text-sm sm:text-base hover:underline">
          {entre31e60} {entre31e60 === 1 ? "operação vence" : "operações vencem"} em 31–60 dias — verificar se precisa de laudo
        </Link>
        <button
          type="button"
          onClick={() => {
            setAmbarRecolhido(true);
            try { sessionStorage.setItem(AMBAR_SESSION_KEY, "1"); } catch { /* ignore */ }
          }}
          className="p-1.5 rounded hover:bg-white/20"
          aria-label="Recolher aviso"
          title="Recolher (volta no próximo acesso)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}

export { diasRestantes };
