import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ListChecks, Loader2, Plug, RefreshCw, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { mensagemDeErro } from "@/lib/api/http";
import { listarIntegracoes, testarIntegracao, type Integracao, type Teste } from "@/lib/api/integracoes";

/**
 * Lista das integrações CADASTRADAS (da nossa API) — descrição, url base, apikey
 * (mascarada, nunca a chave inteira), limite e situação. Cada linha tem um botão
 * "Testar" e o topo tem "Testar todas": a chamada leve valida a conexão sem gastar o
 * contador do mês. `versao` é incrementada pelo editor quando salva, para recarregar.
 */
export function IntegracoesLista({ versao = 0 }: { versao?: number }) {
  const { toast } = useToast();
  const [lista, setLista] = useState<Integracao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [testes, setTestes] = useState<Record<string, Teste>>({});
  const [testandoChave, setTestandoChave] = useState<string | null>(null);
  const [testandoTodas, setTestandoTodas] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await listarIntegracoes());
    } catch (erro) {
      toast({ title: "Erro ao carregar integrações", description: mensagemDeErro(erro), variant: "destructive" });
      setLista([]);
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    void carregar();
  }, [carregar, versao]);

  const registrarTeste = (resultado: Teste) =>
    setTestes((atual) => ({ ...atual, [resultado.chave]: resultado }));

  const testarUma = async (chave: string) => {
    setTestandoChave(chave);
    try {
      registrarTeste(await testarIntegracao(chave));
    } catch (erro) {
      registrarTeste({ chave, ok: false, mensagem: mensagemDeErro(erro), latenciaMs: null });
    } finally {
      setTestandoChave(null);
    }
  };

  const testarTodas = async () => {
    setTestandoTodas(true);
    for (const integ of lista) {
      setTestandoChave(integ.chave);
      try {
        registrarTeste(await testarIntegracao(integ.chave));
      } catch (erro) {
        registrarTeste({ chave: integ.chave, ok: false, mensagem: mensagemDeErro(erro), latenciaMs: null });
      }
    }
    setTestandoChave(null);
    setTestandoTodas(false);
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" /> Integrações cadastradas
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            A apikey não aparece na listagem (só os últimos caracteres). "Testar" valida a
            conexão sem gastar o contador do mês.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={testarTodas} disabled={testandoTodas || lista.length === 0}>
          {testandoTodas || carregando ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5 mr-1" />
          )}
          Testar todas
        </Button>
      </div>

      {carregando ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando integrações...
        </p>
      ) : lista.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <Plug className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Preencha url, apikey e limite no formulário abaixo e salve.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>URL base</TableHead>
                <TableHead>Apikey</TableHead>
                <TableHead className="text-center">Limite/mês</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Teste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((integ) => {
                const teste = testes[integ.chave];
                const testando = testandoChave === integ.chave && testandoChave !== null;
                return (
                  <TableRow key={integ.id ?? integ.chave}>
                    <TableCell className="font-medium">{integ.descricao}</TableCell>
                    <TableCell className="max-w-[16rem]">
                      <span className="block truncate text-xs" title={integ.urlBase}>
                        {integ.urlBase || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {integ.temApikey ? integ.apikeyMascarada : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">{integ.limiteMes ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={integ.ativa && integ.temApikey ? "default" : "outline"}>
                        {integ.ativa ? (integ.temApikey ? "Conectado" : "Sem chave") : "Desativada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {teste && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] ${
                              teste.ok ? "text-green-600 dark:text-green-400" : "text-destructive"
                            }`}
                          >
                            {teste.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {teste.ok
                              ? `OK${teste.latenciaMs !== null ? ` ${teste.latenciaMs}ms` : ""}`
                              : teste.mensagem}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void testarUma(integ.chave)}
                          disabled={testando || testandoTodas}
                        >
                          {testando ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Testar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
