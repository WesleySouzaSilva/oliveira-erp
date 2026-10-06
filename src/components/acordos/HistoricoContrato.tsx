import { useMemo } from "react";
import { AcordoTarefa } from "@/hooks/useAcordos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Handshake, CheckCircle2, XCircle, Clock, Phone, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const RESULTADO_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  acordo_fechado: { label: "Acordo Fechado", icon: CheckCircle2, color: "text-green-600" },
  recusado: { label: "Recusado", icon: XCircle, color: "text-red-600" },
  sem_resposta: { label: "Sem Resposta", icon: Phone, color: "text-gray-500" },
  reagendar: { label: "Reagendado", icon: RefreshCw, color: "text-yellow-600" },
};

interface HistoricoContratoProps {
  tarefas: AcordoTarefa[];
}

export function HistoricoContrato({ tarefas }: HistoricoContratoProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, AcordoTarefa[]>();

    // Group by client name (or "Sem cliente")
    const concluidas = tarefas.filter(t => t.concluida);
    concluidas.forEach(t => {
      const key = t.nome_cliente || "Sem cliente";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });

    // Sort each group by date desc
    map.forEach((items) => {
      items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });

    return Array.from(map.entries()).sort((a, b) => {
      const latestA = a[1][0]?.updated_at || "";
      const latestB = b[1][0]?.updated_at || "";
      return latestB.localeCompare(latestA);
    });
  }, [tarefas]);

  if (grouped.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Handshake className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma tentativa concluída ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([cliente, tentativas]) => (
        <Card key={cliente}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Handshake className="w-4 h-4 text-primary" />
              {cliente}
              <Badge variant="secondary" className="ml-auto text-xs">{tentativas.length} tentativas</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-[300px]">
              <div className="relative pl-4 border-l-2 border-border space-y-3">
                {tentativas.map((t, idx) => {
                  const res = RESULTADO_LABELS[t.resultado_tentativa || ""] || { label: "Concluída", icon: Clock, color: "text-muted-foreground" };
                  const ResIcon = res.icon;
                  return (
                    <div key={t.id} className="relative">
                      <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background ${
                        t.resultado_tentativa === "acordo_fechado" ? "bg-green-500" :
                        t.resultado_tentativa === "recusado" ? "bg-red-500" :
                        "bg-muted-foreground"
                      }`} />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <ResIcon className={`w-3.5 h-3.5 ${res.color}`} />
                          <span className={`text-xs font-medium ${res.color}`}>{res.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {format(new Date(t.updated_at), "dd/MM/yyyy")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t.titulo}</p>
                        {t.valor_acordo && (
                          <p className="text-xs font-medium text-green-600">
                            {t.valor_acordo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        )}
                        {t.observacoes && (
                          <p className="text-[11px] text-muted-foreground/70 italic">{t.observacoes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
