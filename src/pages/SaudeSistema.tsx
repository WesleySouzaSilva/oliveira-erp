import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  BookOpen,
  ArrowRight,
  Lightbulb,
} from "lucide-react";

type Verificacao = {
  chave: string;
  titulo: string;
  total: number;
  detalhes: { item: string | null; obs: string | null }[];
};

type Guia = {
  causa: string;
  quem: string;
  acao: string[];
  atalho?: { label: string; to: string };
};

const GUIAS: Record<string, Guia> = {
  radar_sem_data: {
    causa: "Contratos importados sem data de vencimento no documento (aditivos, comprovantes antigos ou cópias incompletas).",
    quem: "Responsável da carteira do cliente",
    acao: [
      "Abrir a aba \"Datas a conferir\" em Vencimentos & Notificações.",
      "Se o contrato estiver ativo: conferir a CCB ou pedir o extrato DAD ao produtor e registrar a data.",
      "Se for aditivo acessório ou contrato liquidado: arquivar a operação informando o motivo.",
    ],
    atalho: { label: "Abrir Datas a conferir", to: "/vencimentos#radar" },
  },
  a_digitar: {
    causa: "Arquivos escaneados (foto ou cópia sem texto) trazidos na importação das pastas — o sistema não preencheu os dados sozinho.",
    quem: "Responsável da carteira do cliente",
    acao: [
      "Abrir a aba \"Contratos a digitar\" em Vencimentos & Notificações.",
      "Clicar na operação e abrir o arquivo anexado.",
      "Digitar banco, número e vencimento e salvar — a operação sai da lista.",
    ],
    atalho: { label: "Abrir Contratos a digitar", to: "/vencimentos#radar" },
  },
  sem_responsavel: {
    causa: "Cliente ativo que ainda não recebeu responsável de carteira.",
    quem: "Willian (gestor)",
    acao: [
      "Abrir a Carteira de Clientes e usar o painel \"Clientes a distribuir\".",
      "Escolher o responsável — os contratos dele entram na fila dessa pessoa.",
    ],
    atalho: { label: "Abrir Carteira de Clientes", to: "/pos-venda/carteira" },
  },
  responsavel_invalido: {
    causa: "Cliente com responsável que não está mais na equipe de carteira.",
    quem: "Willian (gestor)",
    acao: ["Abrir a Carteira de Clientes e trocar o responsável por alguém da equipe atual."],
    atalho: { label: "Abrir Carteira de Clientes", to: "/pos-venda/carteira" },
  },
  cpf_invalido: {
    causa: "CPF ou CNPJ digitado com erro (dígito verificador não confere).",
    quem: "Responsável da carteira",
    acao: [
      "Abrir a ficha do cliente e conferir o documento na procuração ou na CCB.",
      "Corrigir o número na ficha — a correção fica registrada no histórico.",
    ],
    atalho: { label: "Abrir Clientes", to: "/clientes" },
  },
  cpf_duplicado: {
    causa: "Duas fichas diferentes com o mesmo CPF — normalmente cadastro repetido.",
    quem: "Willian (gestor)",
    acao: [
      "Conferir qual ficha está mais completa.",
      "Juntar as fichas informando o motivo — contratos, arquivos e histórico passam para a ficha que fica.",
    ],
    atalho: { label: "Abrir Clientes", to: "/clientes" },
  },
  sem_grupo: {
    causa: "Cliente ativo sem o grupo (família ou núcleo) preenchido.",
    quem: "Responsável da carteira",
    acao: [
      "Abrir a ficha do cliente e preencher o campo Grupo (ex.: Família Marcondes).",
      "Se for cadastro de teste, arquivar a ficha informando o motivo.",
    ],
    atalho: { label: "Abrir Clientes", to: "/clientes" },
  },
  data_fora_faixa: {
    causa: "Vencimento digitado fora da faixa esperada (antes de 2015 ou depois de 2045) — quase sempre erro de digitação do ano.",
    quem: "Responsável da carteira",
    acao: ["Abrir a operação, conferir a data no contrato e corrigir com o motivo da alteração."],
    atalho: { label: "Abrir Vencimentos", to: "/vencimentos#radar" },
  },
  protocolo_sem_ref: {
    causa: "Operação marcada como protocolada sem o número ou comprovante do envio.",
    quem: "Willian ou Vitoria (protocolo)",
    acao: ["Abrir a operação e registrar a referência do protocolo (número, AR ou comprovante)."],
    atalho: { label: "Abrir Vencimentos", to: "/vencimentos#radar" },
  },
};

export default function SaudeSistema() {
  const { isAdmin, loading: loadingPapel } = usePapelRadar();
  const [dados, setDados] = useState<Verificacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rodadoEm, setRodadoEm] = useState<Date | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [guiaAberto, setGuiaAberto] = useState<string | null>(null);
  const [manualAberto, setManualAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await (supabase as any).rpc("saude_sistema");
    if (error) setErro(error.message);
    else {
      setDados(
        (data || []).map((d: any) => ({
          chave: d.chave,
          titulo: d.titulo,
          total: Number(d.total || 0),
          detalhes: Array.isArray(d.detalhes) ? d.detalhes : [],
        })),
      );
      setRodadoEm(new Date());
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (isAdmin) carregar();
  }, [isAdmin, carregar]);

  if (loadingPapel) {
    return (
      <AppLayout>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <ShieldAlert className="h-5 w-5" />
            Esta página é restrita ao administrador.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const comProblema = (dados || []).filter((d) => d.total > 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Saúde do sistema</h1>
            <p className="text-sm text-muted-foreground">
              Verificações de integridade da base de clientes e contratos.
              {rodadoEm && ` Última verificação: ${rodadoEm.toLocaleString("pt-BR")}`}
            </p>
          </div>
          <Button variant="outline" onClick={carregar} disabled={carregando}>
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Verificar agora
          </Button>
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Manual de rotinas e saúde da base
              </span>
              <Button variant="ghost" size="sm" onClick={() => setManualAberto((v) => !v)}>
                {manualAberto ? "Ocultar" : "Ler"}
              </Button>
            </CardTitle>
          </CardHeader>
          {manualAberto && (
            <CardContent className="space-y-3 pt-0 text-sm text-muted-foreground">
              <p>
                Esta tela confere todos os dias se algo ficou solto na base de clientes e contratos. Cartão verde
                significa que está tudo certo; cartão vermelho mostra quantos registros precisam de atenção e quem deve
                agir.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-foreground">Comercial</strong> cadastra o cliente no fechamento; o sistema já
                  define o responsável de carteira automaticamente.
                </li>
                <li>
                  <strong className="text-foreground">Responsável da carteira</strong> confere as datas dos contratos,
                  digita os que vieram escaneados e marca quando precisa de laudo.
                </li>
                <li>
                  <strong className="text-foreground">Willian e Vitoria</strong> registram o protocolo no banco, o que
                  inicia a contagem dos 15 dias.
                </li>
                <li>
                  <strong className="text-foreground">Willian</strong> distribui carteiras, encerra clientes, desmarca
                  protocolo e dispensa alertas do radar — sempre com motivo escrito.
                </li>
                <li>
                  Contratos vencidos há mais de 90 dias sem protocolo e sem dispensa saem do radar automaticamente e vão
                  para o histórico.
                </li>
              </ul>
              <p>
                Toda alteração de data, responsável, situação e protocolo fica registrada na aba Histórico da operação e
                não pode ser apagada.
              </p>
            </CardContent>
          )}
        </Card>

        {erro && (
          <Card className="border-destructive/40">
            <CardContent className="py-4 text-sm text-destructive">{erro}</CardContent>
          </Card>
        )}

        {dados && (
          <Card className={comProblema.length ? "border-destructive/40" : "border-emerald-600/40"}>
            <CardContent className="flex items-center gap-3 py-4">
              {comProblema.length ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="text-sm">
                    {comProblema.length} verificação(ões) com pendências — abra cada cartão vermelho para ver a lista.
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm">Tudo certo: nenhuma inconsistência encontrada.</span>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {(dados || []).map((v) => {
            const ok = v.total === 0;
            const guia = GUIAS[v.chave];
            return (
              <Card key={v.chave} className={ok ? "border-emerald-600/30" : "border-destructive/50"}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      {v.titulo}
                    </span>
                    <Badge variant={ok ? "secondary" : "destructive"}>{ok ? "OK" : v.total}</Badge>
                  </CardTitle>
                </CardHeader>
                {!ok && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-0"
                        onClick={() => setAberto(aberto === v.chave ? null : v.chave)}
                      >
                        {aberto === v.chave ? "Ocultar lista" : "Ver o que falhou"}
                      </Button>
                      {guia && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-0 text-primary"
                          onClick={() => setGuiaAberto(guiaAberto === v.chave ? null : v.chave)}
                        >
                          <Lightbulb className="mr-1 h-4 w-4" />
                          {guiaAberto === v.chave ? "Ocultar orientação" : "Como resolver"}
                        </Button>
                      )}
                    </div>

                    {guia && guiaAberto === v.chave && (
                      <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
                        <p>
                          <span className="font-medium text-foreground">Por que aparece: </span>
                          <span className="text-muted-foreground">{guia.causa}</span>
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Quem resolve: </span>
                          <span className="text-muted-foreground">{guia.quem}</span>
                        </p>
                        <div>
                          <span className="font-medium text-foreground">O que fazer:</span>
                          <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                            {guia.acao.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ol>
                        </div>
                        {guia.atalho && (
                          <Button asChild size="sm" variant="outline">
                            <Link to={guia.atalho.to}>
                              {guia.atalho.label}
                              <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}

                    {aberto === v.chave && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {v.detalhes.slice(0, 50).map((d, i) => (
                          <li key={i} className="flex justify-between gap-3 border-b border-border/50 py-1">
                            <span data-private>{d.item || "—"}</span>
                            <span className="text-muted-foreground" data-private>
                              {d.obs || ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
