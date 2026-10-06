import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Activity, BarChart3, Kanban, Target, ShieldAlert } from "lucide-react";
import { useComercial } from "@/hooks/useComercial";
import { useAuth } from "@/contexts/AuthContext";
import { MetricCards } from "@/components/comercial/MetricCards";
import { FunilChart } from "@/components/comercial/FunilChart";
import { LeadKanban } from "@/components/comercial/LeadKanban";
import { LeadFormDialog } from "@/components/comercial/LeadFormDialog";
import { AtividadeFormDialog } from "@/components/comercial/AtividadeFormDialog";
import { MetaComercialFormDialog } from "@/components/comercial/MetaComercialFormDialog";
import { MetasComercialList } from "@/components/comercial/MetasComercialList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_LABEL: Record<string, string> = {
  ligacao: "Ligação",
  reuniao_video: "Reunião Vídeo",
  reuniao_presencial: "Reunião Presencial",
  email: "E-mail",
  whatsapp: "WhatsApp",
  follow_up: "Follow-up",
};

const ORIGEM_LABEL: Record<string, string> = {
  google: "Google", indicacao: "Indicação", redes_sociais: "Redes Sociais",
  site: "Site", evento: "Evento", outro: "Outro",
};

export default function GestaoComercial() {
  const { user } = useAuth();
  const {
    leads, atividades, metas, loading,
    createLead, updateLead, createAtividade, createMeta,
    getMetrics, userRole, canViewComercial, canViewMarketing, canManage,
    members,
  } = useComercial();
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showAtivForm, setShowAtivForm] = useState(false);
  const [showMetaForm, setShowMetaForm] = useState(false);

  const metrics = getMetrics();

  // If user has no access at all
  if (!loading && userRole === "other") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Este módulo é exclusivo para os times de Comercial, Marketing e Administração.
          </p>
        </div>
      </AppLayout>
    );
  }

  const handleUpdateEtapa = (id: string, etapa: string) => {
    const dateField = etapa === "sql" ? "data_conversao_sql"
      : etapa === "reuniao" ? "data_reuniao"
      : etapa === "proposta" ? "data_proposta"
      : etapa === "fechamento" ? "data_fechamento"
      : null;

    const update: any = { etapa_funil: etapa };
    if (dateField) update[dateField] = new Date().toISOString().split("T")[0];
    updateLead(id, update);
  };

  const getLeadName = (leadId: string) => leads.find(l => l.id === leadId)?.nome || "—";

  const roleLabel = userRole === "admin" ? "CEO / Admin" : userRole === "comercial" ? "Comercial" : "Marketing";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Comercial & Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Visualizando como: <Badge variant="secondary" className="ml-1">{roleLabel}</Badge>
            </p>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <>
                <Button onClick={() => setShowLeadForm(true)} size="sm">
                  <PlusCircle className="w-4 h-4 mr-1" /> Novo Lead
                </Button>
                <Button onClick={() => setShowAtivForm(true)} size="sm" variant="outline">
                  <Activity className="w-4 h-4 mr-1" /> Atividade
                </Button>
                <Button onClick={() => setShowMetaForm(true)} size="sm" variant="outline">
                  <Target className="w-4 h-4 mr-1" /> Nova Meta
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metrics — commercial metrics only for comercial/admin */}
        {canViewComercial && <MetricCards metrics={metrics} />}

        {/* Marketing-only view: simplified leads by origin */}
        {!canViewComercial && canViewMarketing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Leads por Origem</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.porOrigem.filter(o => o.count > 0).map(o => (
                    <div key={o.origem} className="flex items-center justify-between">
                      <span className="text-sm">{ORIGEM_LABEL[o.origem] || o.origem}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all"
                            style={{ width: `${metrics.totalLeads > 0 ? (o.count / metrics.totalLeads) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-8 text-right">{o.count}</span>
                      </div>
                    </div>
                  ))}
                  {metrics.porOrigem.every(o => o.count === 0) && (
                    <p className="text-sm text-muted-foreground">Nenhum lead cadastrado ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Funil de Conversão</CardTitle></CardHeader>
              <CardContent><FunilChart data={metrics.funilData} /></CardContent>
            </Card>
          </div>
        )}

        {/* Tabs — full view for comercial/admin */}
        {canViewComercial && (
          <Tabs defaultValue="kanban">
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1"><Kanban className="w-4 h-4" /> Pipeline</TabsTrigger>
              <TabsTrigger value="metas" className="gap-1"><Target className="w-4 h-4" /> Metas</TabsTrigger>
              <TabsTrigger value="funil" className="gap-1"><BarChart3 className="w-4 h-4" /> Funil</TabsTrigger>
              <TabsTrigger value="atividades" className="gap-1"><Activity className="w-4 h-4" /> Atividades</TabsTrigger>
            </TabsList>

            <TabsContent value="kanban" className="mt-4">
              {loading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : (
                <LeadKanban leads={leads} onUpdateEtapa={handleUpdateEtapa} />
              )}
            </TabsContent>

            <TabsContent value="metas" className="mt-4">
              <MetasComercialList metas={metas} members={members} />
            </TabsContent>

            <TabsContent value="funil" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Funil de Conversão</CardTitle></CardHeader>
                  <CardContent><FunilChart data={metrics.funilData} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Leads por Origem</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.porOrigem.filter(o => o.count > 0).map(o => (
                        <div key={o.origem} className="flex items-center justify-between">
                          <span className="text-sm">{ORIGEM_LABEL[o.origem] || o.origem}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent rounded-full transition-all"
                                style={{ width: `${metrics.totalLeads > 0 ? (o.count / metrics.totalLeads) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold w-8 text-right">{o.count}</span>
                          </div>
                        </div>
                      ))}
                      {metrics.porOrigem.every(o => o.count === 0) && (
                        <p className="text-sm text-muted-foreground">Nenhum lead cadastrado ainda.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="atividades" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead className="text-right">Duração</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atividades.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhuma atividade registrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        atividades.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="text-sm">
                              {format(new Date(a.data_atividade), "dd/MM/yy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-medium text-sm">{getLeadName(a.lead_id)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{TIPO_LABEL[a.tipo] || a.tipo}</Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{a.descricao || "—"}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{a.resultado || "—"}</TableCell>
                            <TableCell className="text-right text-sm">{a.duracao_minutos ? `${a.duracao_minutos}min` : "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {canManage && (
        <>
          <LeadFormDialog open={showLeadForm} onOpenChange={setShowLeadForm} onSave={createLead} />
          <AtividadeFormDialog open={showAtivForm} onOpenChange={setShowAtivForm} onSave={createAtividade} leads={leads} />
          <MetaComercialFormDialog
            open={showMetaForm}
            onOpenChange={setShowMetaForm}
            onSave={createMeta}
            members={members}
            currentUserId={user?.id || ""}
          />
        </>
      )}
    </AppLayout>
  );
}
