import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRadarEtapas } from "@/lib/radarEtapas";
import { useNotificacoesBanco, type ItemNotificacao } from "@/hooks/useNotificacoesBanco";
import { useVarreduraSugestoes, type SugestaoVarredura } from "@/hooks/useVarreduraSugestoes";
import { normTexto } from "@/lib/varredura";
import { formatDataBR } from "@/lib/notificacoesBanco";
import { bancoGenerico, quemProtocola } from "@/lib/complementacao";
import { diasRestantes, dataPlausivel, type OperacaoCredito } from "@/hooks/useOperacoesCredito";

const CHAVE_ADIADOS = "triagem-protocolos-adiados";

const lerAdiados = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_ADIADOS) || "[]");
  } catch {
    return [];
  }
};

/** Consumidor.gov tem referência no formato 2026.09/00012345678. */
const canalDaReferencia = (ref: string) => (/^\d{4}\.\d{2}\//.test(ref.trim()) ? "consumidor_gov" : "outro");

const semCobertura = (o: OperacaoCredito) => !o.notificado_em && !o.protocolo_ref;

interface Par {
  chave: string;
  item: ItemNotificacao;
  pendentes: OperacaoCredito[];
  sugestoes: SugestaoVarredura[];
  vencimento: string | null;
  dias: number | null;
}

export default function TriagemProtocolos() {
  const { meuNome } = useRadarEtapas();
  const { itens, loading, registrarProtocolo } = useNotificacoesBanco();
  const { sugestoes, loading: loadingSug, confirmarNoPar, descartar } = useVarreduraSugestoes("protocolo");

  const [filtroResp, setFiltroResp] = useState("todos");
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [adiados, setAdiados] = useState<string[]>(lerAdiados);
  const [confirmados, setConfirmados] = useState<string[]>([]);
  const [descartados, setDescartados] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState<Par | null>(null);
  const [descartarPar, setDescartarPar] = useState<Par | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const pares = useMemo<Par[]>(() => {
    const pendentes = sugestoes.filter((s) => s.status === "pendente");
    const porCliente = new Map<string, SugestaoVarredura[]>();
    pendentes.forEach((s) => {
      const k = s.cliente_id || normTexto(s.cliente_nome);
      porCliente.set(k, [...(porCliente.get(k) ?? []), s]);
    });

    return itens
      .filter((i) => i.estado !== "protocolada" && i.estado !== "encerrada")
      .map((i) => {
        const ops = i.operacoes.filter(semCobertura);
        const doCliente =
          (i.cliente_id && porCliente.get(i.cliente_id)) ||
          porCliente.get(normTexto(i.titular_nome)) ||
          [];
        // O arquivo de origem costuma nomear o banco: sugestão que bate vem primeiro.
        const marca = normTexto(i.banco).split(" ")[0] || "";
        const ordenadas = [...doCliente].sort((a, b) => {
          const bateA = marca && normTexto(a.arquivo || "").includes(marca) ? 0 : 1;
          const bateB = marca && normTexto(b.arquivo || "").includes(marca) ? 0 : 1;
          return bateA - bateB || (b.data || "").localeCompare(a.data || "");
        });
        const datas = ops
          .map((o) => o.vence_em)
          .filter((d): d is string => !!d && dataPlausivel(d))
          .sort();
        const venc = datas[0] ?? null;
        return {
          chave: `${normTexto(i.titular_nome)}|${normTexto(i.banco)}`,
          item: i,
          pendentes: ops,
          sugestoes: ordenadas,
          vencimento: venc,
          dias: venc ? diasRestantes(venc) : null,
        };
      })
      .filter((p) => p.pendentes.length > 0 && p.sugestoes.length > 0)
      .sort((a, b) => (a.vencimento || "9999").localeCompare(b.vencimento || "9999"));
  }, [itens, sugestoes]);

  const responsaveis = useMemo(
    () => Array.from(new Set(pares.map((p) => p.item.responsavel).filter(Boolean))).sort() as string[],
    [pares],
  );

  const visiveis = useMemo(
    () => pares.filter((p) => filtroResp === "todos" || p.item.responsavel === filtroResp),
    [pares, filtroResp],
  );

  const emAberto = visiveis.filter((p) => !adiados.includes(p.chave));
  const adiadosVisiveis = visiveis.filter((p) => adiados.includes(p.chave));

  const adiar = (p: Par) => {
    const novo = Array.from(new Set([...adiados, p.chave]));
    setAdiados(novo);
    localStorage.setItem(CHAVE_ADIADOS, JSON.stringify(novo));
    toast.success("Par mantido na fila para conferir depois — nada foi alterado");
  };

  const voltarParaFila = (p: Par) => {
    const novo = adiados.filter((c) => c !== p.chave);
    setAdiados(novo);
    localStorage.setItem(CHAVE_ADIADOS, JSON.stringify(novo));
  };

  const sugestaoEscolhida = (p: Par) =>
    p.sugestoes.find((s) => s.id === escolha[p.chave]) ?? p.sugestoes[0];

  const aplicarConfirmacao = async () => {
    if (!confirmar) return;
    const s = sugestaoEscolhida(confirmar);
    if (!s?.data) {
      toast.error("Sugestão sem data de protocolo — confira o arquivo de origem");
      return;
    }
    setSalvando(true);
    const ok = await registrarProtocolo(confirmar.item, {
      data: s.data,
      canal: canalDaReferencia(s.valor || ""),
      referencia: s.valor || "",
    });
    if (ok) {
      await confirmarNoPar(
        s,
        confirmar.item.banco,
        confirmar.pendentes.map((o) => o.id),
        meuNome || "equipe",
      );
      // Peticionamento pendente daquele par deixa de fazer sentido.
      await supabase
        .from("advbox_pendencias")
        .update({ status: "resolvida", resolvido_em: new Date().toISOString() } as any)
        .eq("status", "aberta")
        .ilike("titulo", `%${confirmar.item.titular_nome}%`)
        .ilike("titulo", "%eticionamento%");
      setConfirmados((c) => Array.from(new Set([...c, confirmar.chave])));
      const vencs = Array.from(
        new Set(confirmar.pendentes.map((o) => formatDataBR(o.vence_em) || "sem data")),
      );
      if (vencs.length > 1)
        toast.info(
          `Ficaram cobertas ${confirmar.pendentes.length} operações com vencimentos diferentes: ${vencs.join(", ")}.`,
        );
    }
    setSalvando(false);
    setConfirmar(null);
  };

  const aplicarDescarte = async () => {
    if (!descartarPar) return;
    const s = sugestaoEscolhida(descartarPar);
    if (!s) return;
    if (!motivo.trim()) {
      toast.error("Escreva o motivo do descarte");
      return;
    }
    setSalvando(true);
    await descartar(s.id, `Não é deste par (${descartarPar.item.banco}) — ${motivo.trim()} · ${meuNome || "equipe"}`);
    setDescartados((d) => Array.from(new Set([...d, `${descartarPar.chave}|${s.id}`])));
    setSalvando(false);
    setDescartarPar(null);
    setMotivo("");
    toast.success("Sugestão descartada com o motivo registrado");
  };

  const linha = (p: Par, adiado: boolean) => {
    const s = sugestaoEscolhida(p);
    const generico = bancoGenerico(p.item.banco);
    const urgente = p.dias != null && p.dias <= 60;
    return (
      <div
        key={p.chave}
        className={`rounded-lg border p-4 ${
          urgente && !adiado ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-serif text-base font-bold">{p.item.titular_nome}</p>
          <span className="text-sm text-muted-foreground">— {p.item.banco}</span>
          <Badge variant="outline" className="font-normal">
            carteira: {p.item.responsavel || "a definir"}
          </Badge>
          <Badge variant="outline" className="font-normal">
            protocola: {quemProtocola(p.item.responsavel)}
          </Badge>
          {urgente && (
            <Badge className="bg-destructive font-normal text-destructive-foreground">
              vence em {p.dias} dia(s)
            </Badge>
          )}
          {generico && (
            <Badge variant="outline" className="border-destructive/50 font-normal text-destructive">
              instituição genérica — identificar na cédula
            </Badge>
          )}
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {p.pendentes.length} operação(ões) hoje sem protocolo · vencimento mais próximo{" "}
          {formatDataBR(p.vencimento) || "sem data"}
        </p>

        <div className="mt-3 space-y-2">
          {p.sugestoes.map((sg) => (
            <label
              key={sg.id}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${
                sg.id === s?.id ? "border-accent bg-accent/10" : "border-border"
              }`}
            >
              <input
                type="radio"
                className="mt-1"
                name={`sug-${p.chave}`}
                checked={sg.id === s?.id}
                onChange={() => setEscolha((e) => ({ ...e, [p.chave]: sg.id }))}
                aria-label={`Usar o protocolo ${sg.valor}`}
              />
              <span>
                <span className="font-semibold">{sg.valor}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatDataBR(sg.data) || "sem data"} ·{" "}
                  {canalDaReferencia(sg.valor || "") === "consumidor_gov" ? "Consumidor.gov" : "outro canal"}
                </span>
                <span className="block text-xs text-muted-foreground">arquivo: {sg.arquivo || "—"}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {adiado ? (
            <Button size="sm" variant="outline" onClick={() => voltarParaFila(p)}>
              Voltar para a fila
            </Button>
          ) : (
            <>
              <Button size="sm" disabled={generico || !s?.data} onClick={() => setConfirmar(p)}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDescartarPar(p)}>
                <XCircle className="mr-1 h-4 w-4" /> Não é deste par
              </Button>
              <Button size="sm" variant="ghost" onClick={() => adiar(p)}>
                <Clock className="mr-1 h-4 w-4" /> Conferir depois
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Confirmar protocolos encontrados</h1>
          <p className="text-sm text-muted-foreground">
            Um par cliente + banco por linha. Nada é aplicado em lote: cada par precisa da sua confirmação.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/notificacoes">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pares em aberto</p>
          <p className="font-serif text-xl font-bold">{emAberto.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Confirmados agora</p>
          <p className="font-serif text-xl font-bold">{confirmados.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Descartados agora</p>
          <p className="font-serif text-xl font-bold">{descartados.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Peticionamentos que deixaram de nascer</p>
          <p className="font-serif text-xl font-bold">{confirmados.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={filtroResp} onValueChange={setFiltroResp}>
          <SelectTrigger className="w-56" aria-label="Responsável da carteira">
            <SelectValue placeholder="Todos os responsáveis" />
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
        {meuNome && (
          <Button size="sm" variant="outline" onClick={() => setFiltroResp(meuNome)}>
            Minhas
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          Falta conferir {emAberto.length} par(es) · {adiadosVisiveis.length} deixado(s) para depois
        </span>
      </div>

      {(loading || loadingSug) && <p className="text-sm text-muted-foreground">Carregando a fila…</p>}
      {!loading && !loadingSug && emAberto.length === 0 && adiadosVisiveis.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum par com protocolo encontrado esperando conferência.
        </p>
      )}

      <div className="space-y-3">{emAberto.map((p) => linha(p, false))}</div>

      {adiadosVisiveis.length > 0 && (
        <>
          <p className="mb-2 mt-6 font-serif text-base font-bold">Deixados para conferir depois</p>
          <div className="space-y-3">{adiadosVisiveis.map((p) => linha(p, true))}</div>
        </>
      )}

      <AlertDialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Confirmar o protocolo deste par</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar && (
                <>
                  {confirmar.item.titular_nome} — {confirmar.item.banco}. Protocolo{" "}
                  {sugestaoEscolhida(confirmar)?.valor} de {formatDataBR(sugestaoEscolhida(confirmar)?.data)}.
                  Vão ficar cobertas {confirmar.pendentes.length} operação(ões):{" "}
                  {confirmar.pendentes.map((o) => `${o.numero} (${formatDataBR(o.vence_em) || "sem data"})`).join(", ")}.
                  O peticionamento pendente deste par é cancelado.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={salvando} onClick={aplicarConfirmacao}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!descartarPar}
        onOpenChange={(v) => {
          if (!v) {
            setDescartarPar(null);
            setMotivo("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Não é deste par</AlertDialogTitle>
            <AlertDialogDescription>
              A sugestão sai da fila deste par e o motivo fica registrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: o protocolo é do Banco do Brasil, não do Sicoob."
            aria-label="Motivo do descarte"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={salvando} onClick={aplicarDescarte}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
