import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import { NichoPills } from "@/components/metricas/NichoPills";
import { useLancamento, registrarTentativaDataFutura } from "@/hooks/useMetricas";
import { calc, fmt, motivosPorNicho, type Nicho } from "@/hooks/useMetricasCalc";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, History } from "lucide-react";
import { Link } from "react-router-dom";

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      min={0}
      value={value || ""}
      placeholder="0"
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    />
  );
}

function FieldRow({ label, children, calcLabel }: { label: string; children: React.ReactNode; calcLabel?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {calcLabel && <span className="text-[11px] text-muted-foreground">{calcLabel}</span>}
      </div>
      {children}
    </div>
  );
}

export default function MetricasLancamentoComercial() {
  const [params] = useSearchParams();
  const [data, setData] = useState(params.get("data") || todayYMD());
  const [nicho, setNicho] = useState<Nicho>((params.get("nicho") as Nicho) || "agro");
  const initialRole: "sdr" | "closer" =
    params.get("sdr") ? "sdr" : params.get("closer") ? "closer" : "closer";
  const [role, setRole] = useState<"sdr" | "closer">(initialRole);
  const [memberId, setMemberId] = useState<string | null>(
    params.get("sdr") || params.get("closer") || null,
  );
  const [saving, setSaving] = useState(false);

  const closerId = role === "closer" ? memberId : null;
  const sdrId = role === "sdr" ? memberId : null;

  const { lancamento, setLancamento, existing, loading, save } = useLancamento(data, nicho, closerId, sdrId);
  const { members } = useOrgMembers();

  // Pré-seleciona o próprio usuário logado se nada foi informado por querystring.
  useEffect(() => {
    if (memberId) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user?.id) setMemberId(u.user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof lancamento, v: any) => setLancamento({ ...lancamento, [k]: v });
  const motivosOpts = motivosPorNicho(nicho);

  const handleSave = async () => {
    if (!memberId) {
      toast.error(`Selecione o ${role === "sdr" ? "SDR" : "Closer"} responsável`);
      return;
    }
    setSaving(true);
    try {
      await save();
      toast.success(`Lançamento de ${role === "sdr" ? "SDR" : "Closer"} salvo`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Lançamento — Comercial</h1>
              <p className="text-sm text-muted-foreground">
                Cada SDR e cada Closer faz seu próprio lançamento do dia.
              </p>
            </div>
            <Badge variant={existing ? "secondary" : "default"} className="text-xs">
              {existing ? "Editando lançamento existente" : "Novo lançamento"}
            </Badge>
            <Link
              to="/metricas/comercial/historico"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <History className="w-3.5 h-3.5" /> Ver histórico de lançamentos
            </Link>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={data}
                max={todayYMD()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v > todayYMD()) {
                    toast.error("Não é permitido lançar números para datas futuras.");
                    registrarTentativaDataFutura(v, "comercial", "lancamento-comercial");
                    return;
                  }
                  setData(v);
                }}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nicho</Label>
              <NichoPills value={nicho} onChange={setNicho} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Função</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "sdr" | "closer")}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{role === "sdr" ? "SDR" : "Closer"} responsável</Label>
              <Select value={memberId || "none"} onValueChange={(v) => setMemberId(v === "none" ? null : v)}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.user_id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Atividade {role === "sdr" ? "do SDR" : "do Closer"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {role === "sdr" && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">SDR</p>
                <FieldRow label="Leads qualificados pelo SDR">
                  <NumInput value={lancamento.leads_qualificados_sdr} onChange={(v) => set("leads_qualificados_sdr", v)} />
                </FieldRow>
                <FieldRow
                  label="Leads desqualificados pelo SDR"
                  calcLabel="lançar no início do mês referente ao mês anterior"
                >
                  <NumInput value={lancamento.leads_desqualificados_sdr} onChange={(v) => set("leads_desqualificados_sdr", v)} />
                </FieldRow>
                <FieldRow label="Reuniões agendadas">
                  <NumInput value={lancamento.reunioes_agendadas} onChange={(v) => set("reunioes_agendadas", v)} />
                </FieldRow>
                <FieldRow label="Ligações realizadas">
                  <NumInput value={lancamento.sdr_ligacoes_realizadas} onChange={(v) => set("sdr_ligacoes_realizadas", v)} />
                </FieldRow>
                <FieldRow
                  label="Ligações atendidas"
                  calcLabel={
                    lancamento.sdr_ligacoes_realizadas > 0
                      ? `Taxa de atendimento ${fmt.pctFrac(lancamento.sdr_ligacoes_atendidas / lancamento.sdr_ligacoes_realizadas)}`
                      : undefined
                  }
                >
                  <NumInput value={lancamento.sdr_ligacoes_atendidas} onChange={(v) => set("sdr_ligacoes_atendidas", v)} />
                </FieldRow>
                <FieldRow label="Follow-ups por ligação">
                  <NumInput value={lancamento.follow_ups_ligacao} onChange={(v) => set("follow_ups_ligacao", v)} />
                </FieldRow>
                <FieldRow label="Follow-ups por mensagem">
                  <NumInput value={lancamento.follow_ups_mensagem} onChange={(v) => set("follow_ups_mensagem", v)} />
                </FieldRow>
                <FieldRow label="Clientes resgatados por follow-up" calcLabel="leads frios que voltaram a engajar">
                  <NumInput value={lancamento.clientes_resgatados_followup} onChange={(v) => set("clientes_resgatados_followup", v)} />
                </FieldRow>
              </div>
              )}

              {role === "closer" && (
              <>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Closer</p>
                <FieldRow label="Reuniões realizadas">
                  <NumInput value={lancamento.reunioes_realizadas} onChange={(v) => set("reunioes_realizadas", v)} />
                </FieldRow>
                <FieldRow label="Ligações realizadas">
                  <NumInput value={lancamento.ligacoes} onChange={(v) => set("ligacoes", v)} />
                </FieldRow>
                <FieldRow label="Follow-ups realizados">
                  <NumInput value={lancamento.follow_ups} onChange={(v) => set("follow_ups", v)} />
                </FieldRow>
                <FieldRow label="Propostas enviadas">
                  <NumInput value={lancamento.propostas_enviadas} onChange={(v) => set("propostas_enviadas", v)} />
                </FieldRow>
                <FieldRow
                  label="Contratos fechados"
                  calcLabel={`Taxa closer ${fmt.pctFrac(calc.taxaFechamento(lancamento.contratos_fechados, lancamento.propostas_enviadas))}`}
                >
                  <NumInput value={lancamento.contratos_fechados} onChange={(v) => set("contratos_fechados", v)} />
                </FieldRow>
                <FieldRow
                  label="Receita fechada"
                  calcLabel={`Ticket ${fmt.brl(calc.ticketMedio(lancamento.receita_fechada, lancamento.contratos_fechados))}`}
                >
                  <CurrencyInput value={lancamento.receita_fechada} onChange={(v) => set("receita_fechada", v || 0)} />
                </FieldRow>
              </div>

              <div className="space-y-3 pt-3 border-t">
                <p className="text-xs font-bold uppercase tracking-wider text-destructive">Perdas</p>
                <FieldRow label="Contratos perdidos">
                  <NumInput value={lancamento.contratos_perdidos} onChange={(v) => set("contratos_perdidos", v)} />
                </FieldRow>
                <FieldRow label="Negócios recuperados" calcLabel="perdas que viraram 'sim'">
                  <NumInput value={lancamento.negocios_recuperados} onChange={(v) => set("negocios_recuperados", v)} />
                </FieldRow>
                <FieldRow label="Motivo principal">
                  <Select value={lancamento.motivo_perda_principal || ""} onValueChange={(v) => set("motivo_perda_principal", v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {motivosOpts.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <Label className="text-xs mb-1 block">Observações do dia (comercial)</Label>
            <Textarea
              rows={3}
              value={lancamento.observacoes || ""}
              onChange={(e) => set("observacoes", e.target.value || null)}
              placeholder="Reuniões importantes, objeções recorrentes, contexto..."
            />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t -mx-4 md:-mx-6 px-4 md:px-6">
          <Button size="lg" onClick={handleSave} disabled={saving} className="ml-auto block">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar lançamento {role === "sdr" ? "do SDR" : "do Closer"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}