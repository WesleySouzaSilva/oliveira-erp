import { useEffect, useState } from "react";
import { Save, Loader2, MapPin, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { mensagemDeErro } from "@/lib/api/http";
import {
  buscarIntegracao,
  consumoIntegracao,
  salvarIntegracao,
  INVERTEXO,
  type Consumo,
  type Integracao,
} from "@/lib/api/integracoes";

/**
 * Card da integração INVERTEXO (CEP + CNPJ) dentro do painel de Integrações
 * (`/configuracoes`). O admin cadastra a url base, a apikey e o limite de requisições/mês
 * do plano; o mostrador de consumo lê o contador do mês na API. A apikey é gravada no
 * servidor e volta só mascarada — digitar em branco na edição mantém a chave atual.
 */
export function IntegracaoInvertextoCard({ aoSalvar }: { aoSalvar?: () => void }) {
  const { toast } = useToast();
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [consumo, setConsumo] = useState<Consumo | null>(null);
  const [urlBase, setUrlBase] = useState("");
  const [apikey, setApikey] = useState("");
  const [limiteMes, setLimiteMes] = useState("");
  const [ativa, setAtiva] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const cfg = await buscarIntegracao(INVERTEXO);
      setIntegracao(cfg);
      setUrlBase(cfg.urlBase ?? "");
      setLimiteMes(cfg.limiteMes === null || cfg.limiteMes === undefined ? "" : String(cfg.limiteMes));
      setAtiva(cfg.ativa);
      setApikey("");
    } catch (erro) {
      toast({ title: "Erro ao ler a integração", description: mensagemDeErro(erro), variant: "destructive" });
    } finally {
      setCarregando(false);
    }
    // consumo pode falhar se ainda não configurou — não derruba o form
    try {
      setConsumo(await consumoIntegracao(INVERTEXO));
    } catch {
      setConsumo(null);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarIntegracao({
        urlBase: urlBase.trim(),
        // em branco = mantém a chave já gravada
        apikey: apikey.trim() ? apikey.trim() : undefined,
        limiteMes: limiteMes.trim() ? Number(limiteMes) : null,
        ativa,
      });
      toast({ title: "Integração Invertexto salva." });
      setApikey("");
      await carregar();
      aoSalvar?.(); // a lista de integrações recarrega
    } catch (erro) {
      toast({ title: "Erro ao salvar", description: mensagemDeErro(erro), variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const mostraConsumo =
    consumo && (consumo.usados > 0 || consumo.limite !== null);

  return (
    <div className="bg-card rounded-lg border border-border shadow-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-foreground">Invertexto (CEP + CNPJ)</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          Cadastro de cliente
        </span>
        {integracao && (
          <span
            className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${
              integracao.ativa && integracao.temApikey
                ? "bg-success/10 text-success border-success/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {integracao.ativa && integracao.temApikey ? "Conectado" : "Não conectado"}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Preenche endereço por CEP e dados da empresa por CNPJ no cadastro de cliente. A chave
        fica no servidor e não aparece no navegador.
      </p>

      {carregando ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="invertexto-url">
              URL base
            </Label>
            <Input
              id="invertexto-url"
              value={urlBase}
              onChange={(e) => setUrlBase(e.target.value)}
              placeholder="https://api.invertexto.com/v1"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="invertexto-apikey">
              Apikey (token)
            </Label>
            <Input
              id="invertexto-apikey"
              type="password"
              value={apikey}
              onChange={(e) => setApikey(e.target.value)}
              placeholder={
                integracao?.temApikey
                  ? `${integracao.apikeyMascarada} — deixe em branco para manter`
                  : "Cole o token da Invertexto"
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="invertexto-limite">
              Limite de requisições / mês
            </Label>
            <Input
              id="invertexto-limite"
              type="number"
              min={0}
              value={limiteMes}
              onChange={(e) => setLimiteMes(e.target.value)}
              placeholder="Ex.: 3000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Situação</Label>
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={ativa}
                onChange={(e) => setAtiva(e.target.checked)}
                aria-label="Integração ativa"
              />
              Ativa
            </label>
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-3 flex-wrap">
            {mostraConsumo ? (
              <p className="text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> CEP
                </span>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> CNPJ
                </span>
                {" — "}
                mês {consumo.mes}: <strong>{consumo.usados}</strong>
                {consumo.limite !== null ? ` de ${consumo.limite} usados` : " usados"}
                {consumo.limite !== null ? (
                  <>
                    {" · "}
                    <strong>{consumo.restantes}</strong> restantes
                  </>
                ) : (
                  " (sem limite)"
                )}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Configure url, apikey e limite para acompanhar o consumo.
              </p>
            )}
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
