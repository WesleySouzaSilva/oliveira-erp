import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export interface LaudoMetricRow {
  id: string;
  created_at: string;
  finalizado_em?: string | null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`;
};

interface Props {
  laudos: LaudoMetricRow[];
  meses?: number;
}

export function LaudosPorMes({ laudos, meses = 12 }: Props) {
  const [open, setOpen] = useState(false);

  const { data, totalFinalizados, mediaMes, leadMedio, melhorMes } = useMemo(() => {
    const now = new Date();
    const keys: string[] = [];
    for (let i = meses - 1; i >= 0; i--) {
      keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    const base: Record<string, { criados: number; finalizados: number; leadSum: number; leadN: number }> = {};
    keys.forEach((k) => (base[k] = { criados: 0, finalizados: 0, leadSum: 0, leadN: 0 }));

    for (const l of laudos) {
      const kc = monthKey(new Date(l.created_at));
      if (base[kc]) base[kc].criados += 1;
      if (l.finalizado_em) {
        const kf = monthKey(new Date(l.finalizado_em));
        if (base[kf]) {
          base[kf].finalizados += 1;
          const lead = Math.max(
            0,
            Math.floor((new Date(l.finalizado_em).getTime() - new Date(l.created_at).getTime()) / 86400000),
          );
          base[kf].leadSum += lead;
          base[kf].leadN += 1;
        }
      }
    }

    const data = keys.map((k) => ({
      mes: monthLabel(k),
      criados: base[k].criados,
      finalizados: base[k].finalizados,
      lead: base[k].leadN ? Math.round(base[k].leadSum / base[k].leadN) : 0,
    }));

    const totalFinalizados = data.reduce((s, d) => s + d.finalizados, 0);
    const leadN = keys.reduce((s, k) => s + base[k].leadN, 0);
    const leadSum = keys.reduce((s, k) => s + base[k].leadSum, 0);
    const melhor = data.reduce((a, b) => (b.finalizados > a.finalizados ? b : a), data[0] || { mes: "—", finalizados: 0 });

    return {
      data,
      totalFinalizados,
      mediaMes: totalFinalizados ? (totalFinalizados / meses).toFixed(1) : "0",
      leadMedio: leadN ? Math.round(leadSum / leadN) : null,
      melhorMes: melhor,
    };
  }, [laudos, meses]);

  return (
    <div className="bg-card rounded-lg border border-border mb-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors rounded-t-lg"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="w-4 h-4 text-accent" />
          Laudos finalizados por mês
        </span>
        <span className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {totalFinalizados} finalizados nos últimos {meses} meses
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Finalizados</p>
              <p className="text-lg font-semibold text-foreground">{totalFinalizados}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Média por mês</p>
              <p className="text-lg font-semibold text-foreground">{mediaMes}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Lead time médio</p>
              <p className="text-lg font-semibold text-foreground">{leadMedio === null ? "—" : `${leadMedio} d`}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Melhor mês</p>
              <p className="text-lg font-semibold text-foreground">
                {melhorMes?.finalizados ? `${melhorMes.mes} (${melhorMes.finalizados})` : "—"}
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} barCategoryGap={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  name === "lead" ? `${value} dias` : value,
                  name === "criados" ? "Iniciados" : name === "finalizados" ? "Finalizados" : "Lead time médio",
                ]}
              />
              <Legend
                formatter={(v) => (v === "criados" ? "Iniciados" : v === "finalizados" ? "Finalizados" : v)}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="criados" fill="hsl(var(--muted-foreground) / 0.35)" radius={[3, 3, 0, 0]} barSize={16} />
              <Bar dataKey="finalizados" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="py-1.5 pr-3 font-medium">Mês</th>
                  <th className="py-1.5 pr-3 font-medium">Iniciados</th>
                  <th className="py-1.5 pr-3 font-medium">Finalizados</th>
                  <th className="py-1.5 font-medium">Lead time médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((d) => (
                  <tr key={d.mes}>
                    <td className="py-1.5 pr-3 text-foreground">{d.mes}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.criados}</td>
                    <td className="py-1.5 pr-3 font-semibold text-foreground">{d.finalizados}</td>
                    <td className="py-1.5 text-muted-foreground">{d.lead ? `${d.lead} d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
