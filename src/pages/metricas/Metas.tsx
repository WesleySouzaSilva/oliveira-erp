import { InlineLoader } from "@/components/ui/loaders";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useMetas,
  useMetasHistorico,
  useLancamentosPeriodo,
  useMetasIndividuais,
} from "@/hooks/useMetricas";
import { NICHOS, type Nicho, fmt } from "@/hooks/useMetricasCalc";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Trophy, Target, Users, DollarSign, Handshake } from "lucide-react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MetaIndividualCard } from "@/components/metricas/MetaIndividualCard";
import { DivergenciaMetasBanner } from "@/components/metricas/DivergenciaMetasBanner";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function defaultMeta(nicho: Nicho, mes: number, ano: number) {
  return {
    nicho,
    mes,
    ano,
    meta_investimento: 0,
    meta_leads_pagos: 0,
    meta_leads_organicos: 0,
    meta_contratos: 0,
    meta_receita: 0,
  };
}

export default function MetricasMetas() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);

  const { metas, loading, saveMeta, reload } = useMetas(mes, ano);
  const { rows: historico } = useMetasHistorico(12);
  const { rows: metasInd, saveMetaInd, removeMetaInd } = useMetasIndividuais(mes, ano);
  const { members } = useOrgMembers();

  // Realizado por pessoa no mês
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimMes = (() => {
    const d = new Date(ano, mes, 0);
    return d.toISOString().slice(0, 10);
  })();
  const { rows: lancsMes } = useLancamentosPeriodo(inicioMes, fimMes);

  const realizadoPorPessoa = useMemo(() => {
    const map = new Map<string, { receita: number; contratos: number; qualif: number; reunioes: number }>();
    lancsMes.forEach((l: any) => {
      if (l.closer_id) {
        const cur = map.get(l.closer_id) || { receita: 0, contratos: 0, qualif: 0, reunioes: 0 };
        cur.receita += Number(l.receita_fechada || 0);
        cur.contratos += l.contratos_fechados || 0;
        cur.reunioes += l.reunioes_realizadas || 0;
        map.set(l.closer_id, cur);
      }
      if (l.sdr_id) {
        const cur = map.get(l.sdr_id) || { receita: 0, contratos: 0, qualif: 0, reunioes: 0 };
        cur.qualif += l.leads_qualificados_sdr || 0;
        map.set(l.sdr_id, cur);
      }
    });
    return map;
  }, [lancsMes]);

  const [novoMembroId, setNovoMembroId] = useState<string>("");

  const adicionarMembro = async () => {
    if (!novoMembroId) return;
    if (metasInd.some((m) => m.membro_user_id === novoMembroId)) {
      toast.error("Este membro já tem meta cadastrada neste mês");
      return;
    }
    try {
      await saveMetaInd({
        membro_user_id: novoMembroId,
        mes,
        ano,
        meta_receita: 0,
        meta_contratos: 0,
        meta_leads_qualificados: 0,
        meta_reunioes_realizadas: 0,
        meta_valor_total_contratos: 0,
        meta_supermeta_valor_total: 0,
        pct_entrada: 30,
        comissao_nao_bateu: 1,
        comissao_bateu: 2,
        comissao_supermeta: 4,
        meta_credenciados: 0,
      });
      setNovoMembroId("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    }
  };

  const atualizarMetaInd = async (id: string, patch: Partial<any>) => {
    const atual = metasInd.find((m) => m.id === id);
    if (!atual) return;
    try {
      await saveMetaInd({ ...atual, ...patch });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const memberName = (uid: string) =>
    members.find((m) => m.user_id === uid)?.nome || uid.slice(0, 8);

  // === Sincronização Global ↔ Individual ===
  // Ajusta a meta global (distribui o total proporcionalmente entre os nichos existentes)
  const ajustarGlobalParaSomaIndividual = async (totais: { receita: number; contratos: number }) => {
    const nichosAtuais = NICHOS.map((n) => n.value);
    const totReceitaAtual = nichosAtuais.reduce(
      (s, nv) => s + Number(forms[nv].meta_receita || 0),
      0,
    );
    const totContratosAtual = nichosAtuais.reduce(
      (s, nv) => s + Number(forms[nv].meta_contratos || 0),
      0,
    );
    // Se não houver base, distribui igualmente
    for (const nv of nichosAtuais) {
      const f = forms[nv];
      const peso = totReceitaAtual > 0 ? Number(f.meta_receita || 0) / totReceitaAtual : 1 / nichosAtuais.length;
      const pesoC = totContratosAtual > 0 ? Number(f.meta_contratos || 0) / totContratosAtual : 1 / nichosAtuais.length;
      const novaReceita = Math.round(totais.receita * peso * 100) / 100;
      const novosContratos = Math.round(totais.contratos * pesoC);
      await saveMeta({ ...f, meta_receita: novaReceita, meta_contratos: novosContratos, nicho: nv, mes, ano });
    }
    await reload();
  };

  // Distribui a diferença entre as metas individuais (proporcional ao peso atual de cada uma)
  const rebalancearIndividuais = async (diff: { receita: number; contratos: number }) => {
    if (metasInd.length === 0) return;
    const totRec = metasInd.reduce((s, m) => s + Number(m.meta_receita || 0), 0);
    const totCon = metasInd.reduce((s, m) => s + (m.meta_contratos || 0), 0);
    for (const m of metasInd) {
      const pesoR = totRec > 0 ? Number(m.meta_receita || 0) / totRec : 1 / metasInd.length;
      const pesoC = totCon > 0 ? (m.meta_contratos || 0) / totCon : 1 / metasInd.length;
      const novaReceita = Math.max(0, Number(m.meta_receita || 0) + diff.receita * pesoR);
      const pct = Number(m.pct_entrada || 30);
      const novoValorTotal = pct > 0 ? (novaReceita * 100) / pct : Number(m.meta_valor_total_contratos || 0);
      const novosContratos = Math.max(0, Math.round((m.meta_contratos || 0) + diff.contratos * pesoC));
      await saveMetaInd({
        ...m,
        meta_receita: Math.round(novaReceita * 100) / 100,
        meta_valor_total_contratos: Math.round(novoValorTotal * 100) / 100,
        meta_contratos: novosContratos,
      });
    }
  };

  const [forms, setForms] = useState<Record<Nicho, any>>({
    agro: defaultMeta("agro", mes, ano),
    empresarial: defaultMeta("empresarial", mes, ano),
    bpc: defaultMeta("bpc", mes, ano),
    outros: defaultMeta("outros", mes, ano),
  });

  useEffect(() => {
    setForms({
      agro: metas.find((m) => m.nicho === "agro") || defaultMeta("agro", mes, ano),
      empresarial: metas.find((m) => m.nicho === "empresarial") || defaultMeta("empresarial", mes, ano),
      bpc: metas.find((m) => m.nicho === "bpc") || defaultMeta("bpc", mes, ano),
      outros: metas.find((m) => m.nicho === "outros") || defaultMeta("outros", mes, ano),
    });
  }, [metas, mes, ano]);

  const save = async (nicho: Nicho) => {
    setSaving(true);
    try {
      await saveMeta({ ...forms[nicho], mes, ano, nicho });
      toast.success("Meta salva com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // Histórico — para % atingido, buscamos lançamentos do período coberto
  const minHist = historico.length
    ? `${Math.min(...historico.map((h) => h.ano))}-01-01`
    : `${ano}-01-01`;
  const maxHist = `${ano}-12-31`;
  const { rows: lancHist } = useLancamentosPeriodo(minHist, maxHist);

  const historicoAgregado = useMemo(() => {
    return historico.map((meta) => {
      const lancs = lancHist.filter((l) => {
        const d = new Date(l.data + "T00:00:00");
        return d.getMonth() + 1 === meta.mes && d.getFullYear() === meta.ano && l.nicho === meta.nicho;
      });
      const receita = lancs.reduce((s, l) => s + Number(l.receita_fechada || 0), 0);
      const contratos = lancs.reduce((s, l) => s + (l.contratos_fechados || 0), 0);
      const investimento = lancs.reduce((s, l) => s + Number(l.investimento || 0), 0);
      const isFechado =
        meta.ano < now.getFullYear() || (meta.ano === now.getFullYear() && meta.mes < now.getMonth() + 1);
      return { meta, receita, contratos, investimento, isFechado };
    });
  }, [historico, lancHist]);

  const updateForm = (nicho: Nicho, k: string, v: any) => {
    setForms((prev) => ({ ...prev, [nicho]: { ...prev[nicho], [k]: v } }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Metas Mensais</h1>
          <p className="text-sm text-muted-foreground">Defina as metas por nicho e acompanhe o histórico.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value))}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(parseInt(e.target.value))} className="w-28" />
          </div>
        </div>

        {loading ? (
          <InlineLoader />
        ) : (
          <Tabs defaultValue="agro">
            <TabsList>
              {NICHOS.map((n) => (
                <TabsTrigger key={n.value} value={n.value}>
                  {n.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {NICHOS.map((n) => {
              const f = forms[n.value];
              return (
                <TabsContent key={n.value} value={n.value}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Metas de {MESES[mes - 1]}/{ano} — {n.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Meta de investimento</Label>
                        <CurrencyInput
                          value={f.meta_investimento}
                          onChange={(v) => updateForm(n.value, "meta_investimento", v || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Meta de receita</Label>
                        <CurrencyInput
                          value={f.meta_receita}
                          onChange={(v) => updateForm(n.value, "meta_receita", v || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Meta de leads pagos</Label>
                        <Input
                          type="number"
                          min={0}
                          value={f.meta_leads_pagos || ""}
                          onChange={(e) => updateForm(n.value, "meta_leads_pagos", parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Meta de leads orgânicos</Label>
                        <Input
                          type="number"
                          min={0}
                          value={f.meta_leads_organicos || ""}
                          onChange={(e) => updateForm(n.value, "meta_leads_organicos", parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Meta de contratos</Label>
                        <Input
                          type="number"
                          min={0}
                          value={f.meta_contratos || ""}
                          onChange={(e) => updateForm(n.value, "meta_contratos", parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex items-end justify-end md:col-span-2">
                        <Button onClick={() => save(n.value)} disabled={saving}>
                          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Salvar metas do mês
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* METAS INDIVIDUAIS POR CLOSER / SDR */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Metas individuais — {MESES[mes - 1]}/{ano}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DivergenciaMetasBanner
              metasGlobais={Object.values(forms)}
              metasIndividuais={metasInd}
              onAjustarGlobal={ajustarGlobalParaSomaIndividual}
              onRebalancearIndividuais={rebalancearIndividuais}
            />
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Adicionar pessoa</Label>
                <Select value={novoMembroId} onValueChange={setNovoMembroId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecione um membro" />
                  </SelectTrigger>
                  <SelectContent>
                    {members
                      .filter((m) => !metasInd.some((mi) => mi.membro_user_id === m.user_id))
                      .map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.nome || m.user_id.slice(0, 8)} · {m.papel}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={adicionarMembro} disabled={!novoMembroId}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>

            {metasInd.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma meta individual cadastrada. Adicione um closer ou SDR acima.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {metasInd.map((m) => (
                  <MetaIndividualCard
                    key={m.id}
                    m={m}
                    nome={memberName(m.membro_user_id)}
                    real={realizadoPorPessoa.get(m.membro_user_id)}
                    onSave={atualizarMetaInd}
                    onRemove={(id) => removeMetaInd(id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de metas</CardTitle>
          </CardHeader>
          <CardContent>
            {historicoAgregado.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Nicho</TableHead>
                      <TableHead>Receita</TableHead>
                      <TableHead>Contratos</TableHead>
                      <TableHead>Investimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoAgregado.map(({ meta, receita, contratos, investimento, isFechado }) => {
                      const pct = (a: number, m: number) => (m ? Math.round((a / m) * 100) : 0);
                      return (
                        <TableRow key={`${meta.id}`}>
                          <TableCell>
                            {MESES[meta.mes - 1].slice(0, 3)}/{meta.ano}
                          </TableCell>
                          <TableCell className="capitalize">{meta.nicho}</TableCell>
                          <TableCell>
                            {fmt.brl(receita)} {isFechado && <span className="text-xs text-muted-foreground">({pct(receita, Number(meta.meta_receita))}%)</span>}
                          </TableCell>
                          <TableCell>
                            {contratos} {isFechado && <span className="text-xs text-muted-foreground">({pct(contratos, meta.meta_contratos)}%)</span>}
                          </TableCell>
                          <TableCell>
                            {fmt.brl(investimento)} {isFechado && <span className="text-xs text-muted-foreground">({pct(investimento, Number(meta.meta_investimento))}%)</span>}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isFechado ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                              {isFechado ? "Fechado" : "Em curso"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}