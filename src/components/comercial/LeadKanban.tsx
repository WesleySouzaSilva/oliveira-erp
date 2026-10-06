import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Phone, Mail, NotebookPen } from "lucide-react";
import type { Lead } from "@/hooks/useComercial";
import { BlocoNotasAtendimento } from "@/components/comercial/BlocoNotasAtendimento";

const ETAPA_CONFIG: Record<string, { label: string; color: string }> = {
  mql: { label: "MQL", color: "bg-blue-100 text-blue-800" },
  sql: { label: "SQL", color: "bg-indigo-100 text-indigo-800" },
  reuniao: { label: "Reunião", color: "bg-amber-100 text-amber-800" },
  proposta: { label: "Proposta", color: "bg-purple-100 text-purple-800" },
  fechamento: { label: "Fechado", color: "bg-emerald-100 text-emerald-800" },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-800" },
};

const ORIGEM_LABEL: Record<string, string> = {
  google: "Google",
  indicacao: "Indicação",
  redes_sociais: "Redes Sociais",
  site: "Site",
  evento: "Evento",
  outro: "Outro",
};

interface Props {
  leads: Lead[];
  onUpdateEtapa: (id: string, etapa: string) => void;
}

export function LeadKanban({ leads, onUpdateEtapa }: Props) {
  const etapas = ["mql", "sql", "reuniao", "proposta", "fechamento", "perdido"];
  const [notaLead, setNotaLead] = useState<Lead | null>(null);

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {etapas.map(etapa => {
        const cfg = ETAPA_CONFIG[etapa];
        const etapaLeads = leads.filter(l => l.etapa_funil === etapa);
        return (
          <div key={etapa} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
              <span className="text-xs text-muted-foreground font-medium">{etapaLeads.length}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {etapaLeads.map(lead => (
                <Card key={lead.id} className="p-3 space-y-2 shadow-sm hover:shadow-md transition-shadow">
                  <p className="font-semibold text-sm truncate">{lead.nome}</p>
                  {lead.empresa && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      <span className="truncate">{lead.empresa}</span>
                    </div>
                  )}
                  {lead.telefone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{lead.telefone}</span>
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">
                      {ORIGEM_LABEL[lead.origem] || lead.origem}
                    </Badge>
                    {lead.valor_estimado ? (
                      <span className="text-[10px] font-semibold text-accent">
                        R$ {Number(lead.valor_estimado).toLocaleString("pt-BR")}
                      </span>
                    ) : null}
                  </div>
                  <Select value={lead.etapa_funil} onValueChange={v => onUpdateEtapa(lead.id, v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {etapas.map(e => (
                        <SelectItem key={e} value={e}>{ETAPA_CONFIG[e].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => setNotaLead(lead)}
                  >
                    <NotebookPen className="w-3 h-3 mr-1.5" /> Bloco de notas
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>

    <Dialog open={!!notaLead} onOpenChange={(o) => !o && setNotaLead(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atendimento — {notaLead?.nome}</DialogTitle>
        </DialogHeader>
        {notaLead && (
          <BlocoNotasAtendimento
            origem="lead"
            leadId={notaLead.id}
            clienteNomeInicial={notaLead.nome}
            clienteContatoInicial={notaLead.telefone || ""}
            contextoExtra={`Lead em etapa ${notaLead.etapa_funil}${notaLead.empresa ? ` · ${notaLead.empresa}` : ""}.`}
            compact
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
