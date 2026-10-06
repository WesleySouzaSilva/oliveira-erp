import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sprout, Building2, HeartHandshake, Layers } from "lucide-react";
import { calc, fmt, type Nicho } from "@/hooks/useMetricasCalc";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const ICONS: Record<Nicho, any> = { agro: Sprout, empresarial: Building2, bpc: HeartHandshake, outros: Layers };
const LABELS: Record<Nicho, string> = { agro: "Agro", empresarial: "Empresarial", bpc: "BPC", outros: "Outros" };

interface Props {
  nicho: Nicho;
  leadsPagos: number;
  leadsOrganicos: number;
  contratos: number;
  receita: number;
  investimento: number;
  sparkline: { data: string; receita: number }[];
  metas?: {
    investimento: number;
    leads: number;
    contratos: number;
    receita: number;
  };
}

export function NichoCard({
  nicho,
  leadsPagos,
  leadsOrganicos,
  contratos,
  receita,
  investimento,
  sparkline,
  metas,
}: Props) {
  const Icon = ICONS[nicho];
  const totalLeads = leadsPagos + leadsOrganicos;
  const pagoPct = totalLeads ? (leadsPagos / totalLeads) * 100 : 0;
  const ticket = calc.ticketMedio(receita, contratos);
  const roas = calc.roas(receita, investimento);

  const progress = (atual: number, meta: number) => (meta ? Math.min((atual / meta) * 100, 100) : 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <CardTitle className="text-lg">{LABELS[nicho]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Leads</span>
            <span className="font-semibold">{fmt.num(totalLeads)}</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            <div className="bg-primary" style={{ width: `${pagoPct}%` }} />
            <div className="bg-accent" style={{ width: `${100 - pagoPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Pago {fmt.num(leadsPagos)}</span>
            <span>Org. {fmt.num(leadsOrganicos)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Contratos</p>
            <p className="font-bold text-base">{fmt.num(contratos)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Receita</p>
            <p className="font-bold text-base">{fmt.brl(receita)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ticket Médio</p>
            <p className="font-semibold">{fmt.brl(ticket)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">ROAS</p>
            <p className="font-semibold">{fmt.roas(roas)}</p>
          </div>
        </div>

        {sparkline.length > 1 && (
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <Line type="monotone" dataKey="receita" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {metas && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metas do mês</p>
            {[
              { label: "Investimento", atual: investimento, meta: metas.investimento, fmt: fmt.brl },
              { label: "Leads", atual: totalLeads, meta: metas.leads, fmt: fmt.num },
              { label: "Contratos", atual: contratos, meta: metas.contratos, fmt: fmt.num },
              { label: "Receita", atual: receita, meta: metas.receita, fmt: fmt.brl },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>{m.label}</span>
                  <span>
                    {m.fmt(m.atual)} / {m.fmt(m.meta)}
                  </span>
                </div>
                <Progress value={progress(m.atual, m.meta)} className="h-1" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}