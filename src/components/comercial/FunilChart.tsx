import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FunilChartProps {
  data: { etapa: string; count: number }[];
}

const COLORS = [
  "hsl(var(--accent))",
  "hsl(38, 70%, 50%)",
  "hsl(156, 35%, 40%)",
  "hsl(156, 35%, 30%)",
  "hsl(156, 35%, 17%)",
];

export function FunilChart({ data }: FunilChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="etapa" width={80} tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
