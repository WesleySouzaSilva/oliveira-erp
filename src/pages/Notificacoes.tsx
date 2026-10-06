import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Search, Copy, Settings, Upload, MessageSquare, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { useRadarEtapas, mesmaPessoa } from "@/lib/radarEtapas";
import { useNotificacoesBanco, type ItemNotificacao } from "@/hooks/useNotificacoesBanco";
import {
  ESTADOS,
  labelEstado,
  labelCanal,
  labelResultado,
  formatDataBR,
  textoParaCliente,
  type EstadoNotificacao,
} from "@/lib/notificacoesBanco";
import {
  ProtocolarDialog,
  RespostaDialog,
  ContatoDialog,
  PrazosConfigDialog,
} from "@/components/notificacoes/NotificacaoDialogs";
import { ComplementacaoPanel } from "@/components/notificacoes/ComplementacaoPanel";
import { cabeComplementacao } from "@/lib/complementacao";
import { ProximoPassoBloco } from "@/components/notificacoes/ProximoPassoBloco";

export default function Notificacoes() {
  const { user } = useAuth();
  const { isAdmin } = usePapelRadar();
  const { meuNome } = useRadarEtapas();
  const {
    itens,
    config,
    loading,
    registrarProtocolo,
    registrarComplementacao,
    pedirRetificacaoLaudo,
    registrarResposta,
    registrarContato,
    registrarDecisao,
    salvarConfig,
    contextoDe,
  } = useNotificacoesBanco();

  const [busca, setBusca] = useState("");
  const [filtroResp, setFiltroResp] = useState("todos");
  const [filtroBanco, setFiltroBanco] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoNotificacao>("todos");
  const [protocolarItem, setProtocolarItem] = useState<ItemNotificacao | null>(null);
  const [respostaItem, setRespostaItem] = useState<ItemNotificacao | null>(null);
  const [contatoItem, setContatoItem] = useState<ItemNotificacao | null>(null);
  const [complItem, setComplItem] = useState<ItemNotificacao | null>(null);
  const [cfgAberta, setCfgAberta] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("membros")
      .select("organizacao_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setOrgId((data as any)?.organizacao_id ?? null));
  }, [user]);

  const podeDecidir = isAdmin || mesmaPessoa(meuNome, "Willian");

  const responsaveis = useMemo(
    () => Array.from(new Set(itens.map((i) => i.responsavel).filter(Boolean))).sort() as string[],
    [itens],
  );
  const bancos = useMemo(() => Array.from(new Set(itens.map((i) => i.banco))).sort(), [itens]);

  const filtrados = useMemo(
    () =>
      itens.filter((i) => {
        if (filtroResp !== "todos" && i.responsavel !== filtroResp) return false;
        if (filtroBanco !== "todos" && i.banco !== filtroBanco) return false;
        if (filtroEstado !== "todos" && i.estado !== filtroEstado) return false;
        if (busca) {
          const s = busca.toLowerCase();
          if (!i.titular_nome.toLowerCase().includes(s) && !i.banco.toLowerCase().includes(s)) return false;
        }
        return true;
      }),
    [itens, filtroResp, filtroBanco, filtroEstado, busca],
  );

  const porEstado = useMemo(() => {
    const c: Record<string, number> = {};
    ESTADOS.forEach((e) => (c[e.value] = 0));
    itens.forEach((i) => (c[i.estado] = (c[i.estado] || 0) + 1));
    return c;
  }, [itens]);

  /** 15 dias sem resposta: aparece em vermelho para o Willian. */
  const semResposta = useMemo(
    () =>
      itens.filter(
        (i) =>
          !!i.ficha?.protocolo_data &&
          i.estado !== "respondida" &&
          i.estado !== "decidida" &&
          i.estado !== "encerrada" &&
          i.dias_parados >= config.dias_sem_resposta,
      ),
    [itens, config],
  );

  const copiarTexto = (i: ItemNotificacao) => {
    const texto = textoParaCliente(
      i.ficha ?? ({ titular_nome: i.titular_nome, banco: i.banco, estado: "em_preparo" } as any),
    );
    navigator.clipboard.writeText(texto).then(
      () => toast.success("Texto copiado para mandar ao cliente"),
      () => toast.error("Não foi possível copiar"),
    );
  };

  return (
    <AppLayout>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Notificações extrajudiciais</h1>
          <p className="text-sm text-muted-foreground">
            Uma ficha por titular + banco. O dono é o responsável da carteira do cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/notificacoes/varredura">
              <Upload className="mr-1 h-4 w-4" /> Importar varredura
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/notificacoes/protocolos">Confirmar protocolos encontrados</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/notificacoes/complementacoes">Conferir complementações pendentes</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCfgAberta(true)}>
            <Settings className="mr-1 h-4 w-4" /> Prazos
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            type="button"
            onClick={() => setFiltroEstado(filtroEstado === e.value ? "todos" : e.value)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              filtroEstado === e.value ? "border-accent bg-accent/10" : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <p className="text-xs text-muted-foreground">{e.label}</p>
            <p className="font-serif text-xl font-bold">{porEstado[e.value] || 0}</p>
          </button>
        ))}
      </div>

      {semResposta.length > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-serif text-base font-bold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Sem resposta do banco ({semResposta.length})
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {semResposta.map((i) => (
              <li key={`${i.titular_nome}-${i.banco}`} className="text-destructive">
                {i.titular_nome} — {i.banco} · {i.dias_parados} dias parados
                {i.dias_parados >= config.dias_silencio && (
                  <Badge className="ml-2 bg-destructive font-normal text-destructive-foreground">
                    silêncio do banco — decisão do Willian
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="Buscar por titular ou banco"
            placeholder="Buscar por titular ou banco…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <Select value={filtroResp} onValueChange={setFiltroResp}>
          <SelectTrigger className="sm:w-48" aria-label="Responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroBanco} onValueChange={setFiltroBanco}>
          <SelectTrigger className="sm:w-48" aria-label="Banco">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os bancos</SelectItem>
            {bancos.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Carregando o acompanhamento…</p>
      ) : filtrados.length === 0 ? (
        <div className="py-16 text-center">
          <ScrollText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhuma notificação com esses filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((i) => {
            const semContato =
              i.ultimo_contato == null ||
              (i.ultimo_contato &&
                (Date.now() - new Date(i.ultimo_contato).getTime()) / 86_400_000 >= config.dias_contato_cliente);
            return (
              <div key={`${i.titular_nome}|${i.banco}`} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-base font-bold">
                      {i.titular_nome} <span className="font-sans text-sm font-normal text-muted-foreground">— {i.banco}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        {labelEstado(i.estado)}
                      </Badge>
                      <span>Carteira: {i.responsavel || "a definir"}</span>
                      <span>{i.operacoes.length} operação(ões)</span>
                      {i.vencimentoMaisProximo && <span>vencimento mais próximo {formatDataBR(i.vencimentoMaisProximo)}</span>}
                      {i.ficha?.protocolo_data && (
                        <span>
                          protocolada {formatDataBR(i.ficha.protocolo_data)} · {labelCanal(i.ficha.protocolo_canal)} ·{" "}
                          {i.ficha.protocolo_ref}
                        </span>
                      )}
                      {i.ficha?.resposta_resultado && (
                        <span>
                          resposta {labelResultado(i.ficha.resposta_resultado)} em {formatDataBR(i.ficha.resposta_data)}
                        </span>
                      )}
                      {i.ficha && <span className={i.dias_parados >= config.dias_sem_resposta ? "font-bold text-destructive" : ""}>{i.dias_parados} dias parados</span>}
                    </div>
                    {semContato && i.ficha && (
                      <p className="mt-1 text-xs text-warning">
                        Dar satisfação ao cliente — {i.ultimo_contato ? `último contato ${formatDataBR(i.ultimo_contato)}` : "nenhum contato registrado"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {i.estado === "em_preparo" && (
                      <Button size="sm" onClick={() => setProtocolarItem(i)}>
                        Registrar protocolo
                      </Button>
                    )}
                    {(i.estado === "protocolada" || i.estado === "aguardando_resposta") && (
                      <Button size="sm" onClick={() => setRespostaItem(i)}>
                        Registrar resposta
                      </Button>
                    )}
                    {cabeComplementacao(
                      i.ficha,
                      i.banco,
                      i.complementacoes.map((c) => c.data).sort().pop() ?? null,
                    ) && (
                      <Button size="sm" variant="outline" onClick={() => setComplItem(i)}>
                        Complementar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setContatoItem(i)}>
                      <MessageSquare className="mr-1 h-4 w-4" /> Contato ({i.contatos})
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copiarTexto(i)}>
                      <Copy className="mr-1 h-4 w-4" /> Copiar texto para o cliente
                    </Button>
                  </div>
                </div>

                {(i.complementacoes.length > 0 || !!i.ficha?.protocolo_data) && (
                  <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-foreground">Histórico do pedido</p>
                    <ol className="mt-1 space-y-1 text-xs text-muted-foreground">
                      <li>
                        Pedido original —{" "}
                        {i.ficha?.protocolo_data ? formatDataBR(i.ficha.protocolo_data) : "data a confirmar"} ·{" "}
                        {labelCanal(i.ficha?.protocolo_canal)}
                        {i.ficha?.protocolo_ref ? ` · ${i.ficha.protocolo_ref}` : ""}
                      </li>
                      {i.complementacoes.map((c) => (
                        <li key={c.id}>
                          Complementação — {formatDataBR(c.data)} · {labelCanal(c.canal)}
                          {c.referencia ? ` · ${c.referencia}` : ""}
                          {c.operacoes?.length ? ` · operações ${c.operacoes.join(", ")}` : ""}
                          {c.arquivo ? ` · ${c.arquivo}` : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <ProximoPassoBloco
                  item={i}
                  contexto={contextoDe(i)}
                  config={config}
                  podeDecidir={podeDecidir}
                  meuNome={meuNome}
                  onDecidir={(d) => registrarDecisao(i, d)}
                />
              </div>
            );
          })}
        </div>
      )}

      <ProtocolarDialog
        item={protocolarItem}
        open={!!protocolarItem}
        onOpenChange={(v) => !v && setProtocolarItem(null)}
        onSalvar={(d) => registrarProtocolo(protocolarItem as ItemNotificacao, d)}
      />
      <RespostaDialog
        item={respostaItem}
        open={!!respostaItem}
        onOpenChange={(v) => !v && setRespostaItem(null)}
        onSalvar={(d) => registrarResposta(respostaItem as ItemNotificacao, d)}
      />
      <ContatoDialog
        item={contatoItem}
        open={!!contatoItem}
        onOpenChange={(v) => !v && setContatoItem(null)}
        meuNome={meuNome}
        onSalvar={(d) => registrarContato(contatoItem as ItemNotificacao, d)}
      />
      <ComplementacaoPanel
        item={complItem}
        open={!!complItem}
        onOpenChange={(v) => !v && setComplItem(null)}
        meuNome={meuNome}
        onConfirmar={(d) => registrarComplementacao(complItem as ItemNotificacao, d)}
        onPedirRetificacao={pedirRetificacaoLaudo}
      />
      <PrazosConfigDialog
        open={cfgAberta}
        onOpenChange={setCfgAberta}
        config={config}
        onSalvar={async (c) => (orgId ? salvarConfig(c, orgId) : false)}
      />
    </AppLayout>
  );
}
