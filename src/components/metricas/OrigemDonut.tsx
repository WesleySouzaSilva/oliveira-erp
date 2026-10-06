import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { ORIGENS_ORGANICAS, fmt } from "@/hooks/useMetricasCalc";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--accent) / 0.7)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--accent) / 0.5)",
  "hsl(var(--muted-foreground))",
  "hsl(var(--muted-foreground) / 0.6)",
];

interface Props {
  data: { origem_tipo: string; quantidade: number }[];
  title?: string;
}

export function OrigemDonut({ data, title = "Origens dos Leads Orgânicos" }: Props) {
  const total = data.reduce((s, d) => s + d.quantidade, 0);
  const labelMap = Object.fromEntries(ORIGENS_ORGANICAS.map((o) => [o.value, o.label]));
  const chartData = data
    .filter((d) => d.quantidade > 0)
    .map((d) => ({ name: labelMap[d.origem_tipo] || d.origem_tipo, value: d.quantidade }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem leads orgânicos no período.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 text-xs">
              {chartData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {fmt.num(d.value)} ({((d.value / total) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}