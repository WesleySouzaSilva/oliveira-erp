import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Plug,
  Plus,
  Trash2,
  ListChecks,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Nicho = "agro" | "empresarial" | "bpc";
const NICHOS: { key: Nicho; label: string }[] = [
  { key: "agro", label: "Agro" },
  { key: "empresarial", label: "Empresarial" },
  { key: "bpc", label: "BPC" },
];

interface Config {
  id?: string;
  organizacao_id?: string;
  nicho: Nicho;
  ad_account_id: string;
  ad_account_nome: string | null;
  ativo: boolean;
  ultima_sync_at: string | null;
  campaign_ids: string[];
  campaign_nomes: Record<string, string>;
}

interface SyncLog {
  id: string;
  nicho: string;
  ad_account_id: string;
  data_referencia: string;
  status: string;
  investimento: number | null;
  leads: number | null;
  erro_mensagem: string | null;
  trigger_tipo: string;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  effective_status?: string;
  objective?: string;
}

interface AdAccount {
  id: string; // "act_123"
  account_id: string; // "123"
  name: string;
  account_status?: number;
  currency?: string;
}

export default function MetaAdsIntegracao() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [connStatus, setConnStatus] = useState<null | "ok" | "fail">(null);

  // Dialog campanhas
  const [campDialogCfg, setCampDialogCfg] = useState<Config | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campLoading, setCampLoading] = useState(false);
  const [selectedCamps, setSelectedCamps] = useState<Set<string>>(new Set());

  // Contas de anúncio disponíveis no token Meta
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: membro } = await supabase
        .from("membros")
        .select("organizacao_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membro) return;
      setOrgId(membro.organizacao_id);

      const { data: rows } = await supabase
        .from("mkt_meta_ads_config")
        .select("*")
        .eq("organizacao_id", membro.organizacao_id)
        .order("nicho")
        .order("created_at");
      setConfigs((rows as any) ?? []);

      const { data: logRows } = await supabase
        .from("mkt_meta_ads_sync_log")
        .select("*")
        .eq("organizacao_id", membro.organizacao_id)
        .order("created_at", { ascending: false })
        .limit(30);
      setLogs((logRows as any) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAdAccounts = async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const data = await callFn("list_ad_accounts");
      setAdAccounts(((data as any)?.accounts as AdAccount[]) ?? []);
    } catch (e: any) {
      setAccountsError(e.message || "Falha ao listar contas");
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadAdAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addConta = (nicho: Nicho) => {
    setConfigs((prev) => [
      ...prev,
      {
        nicho,
        ad_account_id: "",
        ad_account_nome: "",
        ativo: true,
        ultima_sync_at: null,
        campaign_ids: [],
        campaign_nomes: {},
        organizacao_id: orgId || undefined,
      },
    ]);
  };

  const onPickAccount = (idx: number, accountId: string) => {
    const acc = adAccounts.find((a) => a.id === accountId);
    updateCfg(idx, {
      ad_account_id: accountId,
      ad_account_nome: acc?.name || configs[idx]?.ad_account_nome || "",
      // Limpa campanhas previamente selecionadas pois mudou a conta
      campaign_ids: [],
      campaign_nomes: {},
    });
  };

  const updateCfg = (idx: number, patch: Partial<Config>) => {
    setConfigs((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCfg = async (idx: number) => {
    const cfg = configs[idx];
    if (cfg.id) {
      const { error } = await supabase.from("mkt_meta_ads_config").delete().eq("id", cfg.id);
      if (error) return toast.error(error.message);
    }
    setConfigs((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Conta removida");
  };

  const saveCfg = async (idx: number) => {
    if (!orgId) return;
    const c = configs[idx];
    if (!c.ad_account_id) return toast.error("Informe o ID da conta");

    const payload = {
      organizacao_id: orgId,
      nicho: c.nicho,
      ad_account_id: c.ad_account_id.trim(),
      ad_account_nome: c.ad_account_nome || null,
      ativo: c.ativo,
      campaign_ids: c.campaign_ids,
      campaign_nomes: c.campaign_nomes,
    };

    if (c.id) {
      const { error } = await supabase.from("mkt_meta_ads_config").update(payload).eq("id", c.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("mkt_meta_ads_config")
        .insert(payload)
        .select()
        .single();
      if (error) return toast.error(error.message);
      updateCfg(idx, { id: (data as any).id });
    }
    toast.success("Conta salva");
  };

  const callFn = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
      body: { action, trigger_tipo: "manual", ...extra },
    });
    if (error) throw error;
    if (data && (data as any).ok === false) throw new Error((data as any).error);
    return data;
  };

  const testar = async () => {
    setLoading(true);
    try {
      await callFn("test_connection");
      setConnStatus("ok");
      toast.success("Conexão Meta Ads ativa!");
    } catch (e: any) {
      setConnStatus("fail");
      toast.error(e.message || "Falha na conexão");
    } finally {
      setLoading(false);
    }
  };

  const sincronizar = async () => {
    setLoading(true);
    try {
      const data = await callFn("sync_yesterday", orgId ? { organizacao_id: orgId } : {});
      toast.success(`Sincronizado ${(data as any)?.data_referencia ?? ""}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ============ Dialog Campanhas =============
  const openCampaignsDialog = async (cfg: Config) => {
    if (!cfg.ad_account_id) return toast.error("Salve a conta antes de escolher campanhas");
    setCampDialogCfg(cfg);
    setSelectedCamps(new Set(cfg.campaign_ids ?? []));
    setCampaigns([]);
    setCampLoading(true);
    try {
      const data = await callFn("list_campaigns", { ad_account_id: cfg.ad_account_id });
      setCampaigns(((data as any)?.campaigns as Campaign[]) ?? []);
    } catch (e: any) {
      toast.error(e.message);
      setCampDialogCfg(null);
    } finally {
      setCampLoading(false);
    }
  };

  const toggleCamp = (id: string) => {
    setSelectedCamps((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const allCampsSelected = campaigns.length > 0 && campaigns.every((c) => selectedCamps.has(c.id));
  const someCampsSelected = campaigns.some((c) => selectedCamps.has(c.id)) && !allCampsSelected;

  const toggleSelectAll = () => {
    if (allCampsSelected) {
      setSelectedCamps(new Set());
    } else {
      setSelectedCamps(new Set(campaigns.map((c) => c.id)));
    }
  };

  const saveCampaigns = async () => {
    if (!campDialogCfg) return;
    const idx = configs.findIndex((c) => c === campDialogCfg || (c.id && c.id === campDialogCfg.id));
    if (idx < 0) return;
    const ids = Array.from(selectedCamps);
    const nomes: Record<string, string> = {};
    for (const c of campaigns) if (selectedCamps.has(c.id)) nomes[c.id] = c.name;
    updateCfg(idx, { campaign_ids: ids, campaign_nomes: nomes });

    if (campDialogCfg.id) {
      const { error } = await supabase
        .from("mkt_meta_ads_config")
        .update({ campaign_ids: ids, campaign_nomes: nomes })
        .eq("id", campDialogCfg.id);
      if (error) return toast.error(error.message);
    }
    toast.success(ids.length ? `${ids.length} campanha(s) selecionadas` : "Todas as campanhas serão monitoradas");
    setCampDialogCfg(null);
  };

  // ============ Render =============
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Plug className="w-6 h-6 text-primary" /> Integração Meta Ads
            </h1>
            <p className="text-sm text-muted-foreground">
              Várias contas por nicho. Para cada conta, escolha as campanhas a monitorar (vazio = todas).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connStatus === "ok" && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="w-3 h-3 text-success" /> Conectado
              </Badge>
            )}
            {connStatus === "fail" && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" /> Falhou
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={testar} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Testar conexão
            </Button>
            <Button size="sm" onClick={sincronizar} disabled={loading}>
              Sincronizar ontem
            </Button>
          </div>
        </div>

        {accountsError && (
          <div className="text-xs text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-2">
            Falha ao listar contas Meta: {accountsError}
          </div>
        )}

        {NICHOS.map(({ key, label }) => {
          const contas = configs.map((c, i) => ({ c, i })).filter((x) => x.c.nicho === key);
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{label}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => addConta(key)}>
                  <Plus className="w-4 h-4" /> Adicionar conta
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {contas.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada para {label}.</p>
                )}
                {contas.map(({ c, i }) => (
                  <div key={c.id || `new-${i}`} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Conta de anúncio</Label>
                        <Select
                          value={c.ad_account_id || undefined}
                          onValueChange={(v) => onPickAccount(i, v)}
                          disabled={accountsLoading || adAccounts.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                accountsLoading
                                  ? "Carregando contas..."
                                  : adAccounts.length === 0
                                  ? "Nenhuma conta disponível"
                                  : "Selecione a conta"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {adAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}{" "}
                                <span className="text-muted-foreground">({a.id})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Apelido (opcional)</Label>
                        <Input
                          placeholder="Conta Agro Principal"
                          value={c.ad_account_nome || ""}
                          onChange={(e) => updateCfg(i, { ad_account_nome: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {c.campaign_ids.length === 0 ? (
                        <Badge variant="outline" className="text-[11px]">Todas as campanhas</Badge>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-[11px]">
                            {c.campaign_ids.length} campanha(s) selecionada(s)
                          </Badge>
                          {c.campaign_ids.slice(0, 3).map((id) => (
                            <span key={id} className="text-[11px] text-muted-foreground">
                              {c.campaign_nomes?.[id] || id}
                            </span>
                          ))}
                          {c.campaign_ids.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">+{c.campaign_ids.length - 3}</span>
                          )}
                        </>
                      )}
                      {c.ultima_sync_at && (
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          Última sync: {format(new Date(c.ultima_sync_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => saveCfg(i)}>
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCampaignsDialog(c)}
                        disabled={!c.ad_account_id}
                      >
                        <ListChecks className="w-4 h-4" /> Escolher campanhas
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeCfg(i)} className="ml-auto text-destructive">
                        <Trash2 className="w-4 h-4" /> Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem sincronizações ainda.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between border-b py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          l.status === "sucesso" ? "bg-success" : "bg-destructive"
                        }`}
                      />
                      <span className="font-medium uppercase text-xs">{l.nicho}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{l.ad_account_id}</span>
                      <span className="text-muted-foreground text-xs">{l.data_referencia}</span>
                      {l.status === "sucesso" ? (
                        <span className="text-xs text-muted-foreground">
                          R$ {Number(l.investimento || 0).toFixed(2)} · {l.leads ?? 0} leads
                        </span>
                      ) : (
                        <span className="text-xs text-destructive truncate">{l.erro_mensagem}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                      {format(new Date(l.created_at), "dd/MM HH:mm", { locale: ptBR })} · {l.trigger_tipo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!campDialogCfg} onOpenChange={(o) => !o && setCampDialogCfg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Campanhas — {campDialogCfg?.ad_account_nome || campDialogCfg?.ad_account_id}
            </DialogTitle>
          </DialogHeader>
          {campLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground">
                Deixe vazio para monitorar TODAS as campanhas da conta.
              </p>
              {campaigns.length > 0 && (
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer border-b">
                  <Checkbox
                    checked={someCampsSelected ? "indeterminate" : allCampsSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Selecionar todas</div>
                    <div className="text-[11px] text-muted-foreground">
                      {selectedCamps.size} de {campaigns.length} selecionada(s)
                    </div>
                  </div>
                </label>
              )}
              {campaigns.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>
              )}
              {campaigns.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCamps.has(c.id)}
                    onCheckedChange={() => toggleCamp(c.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.effective_status} {c.objective ? `· ${c.objective}` : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCamps(new Set())}>
              Limpar (todas)
            </Button>
            <Button onClick={saveCampaigns}>Salvar seleção</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}