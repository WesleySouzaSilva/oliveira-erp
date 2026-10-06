import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNotificacoesBanco, type ItemNotificacao } from "@/hooks/useNotificacoesBanco";
import { formatDataBR } from "@/lib/notificacoesBanco";
import {
  bancoGenerico,
  cabeComplementacao,
  moedaBR,
  operacaoCoberta,
  pesoNoBanco,
  percentBR,
  quemMapeia,
  quemProtocola,
} from "@/lib/complementacao";

/** Conferência retroativa: onde há protocolo vivo e operação sem cobertura. */
export default function ComplementacoesPendentes() {
  const { itens, loading } = useNotificacoesBanco();
  const [confirmar, setConfirmar] = useState(false);
  const [criando, setCriando] = useState(false);
  const [criadas, setCriadas] = useState(0);

  // Diagnóstico da base: mostra de onde vem o resultado da conferência.
  const [diag, setDiag] = useState<{
    protocoladas: { titular: string; banco: string; data: string | null; ref: string | null }[];
    opsVinculadas: number;
    opsSingulares: number;
    opsEmParProtocolado: number;
    carregando: boolean;
  }>({ protocoladas: [], opsVinculadas: 0, opsSingulares: 0, opsEmParProtocolado: 0, carregando: true });

  useEffect(() => {
    (async () => {
      const [{ data: notifs }, { data: ops }] = await Promise.all([
        supabase
          .from("notificacoes_banco")
          .select("cliente_id, titular_nome, banco, protocolo_data, protocolo_ref, estado")
          .eq("estado", "protocolada"),
        supabase
          .from("operacoes_credito")
          .select("id, cliente_id, banco, notificado_em, protocolo_ref")
          .is("deleted_at", null),
      ]);
      const listaNotifs = (notifs ?? []) as any[];
      const listaOps = (ops ?? []) as any[];
      const pares = new Set(
        listaNotifs.map((n) => `${n.cliente_id}|${String(n.banco || "").trim().toLowerCase()}`),
      );
      setDiag({
        carregando: false,
        protocoladas: listaNotifs.map((n) => ({
          titular: n.titular_nome,
          banco: n.banco,
          data: n.protocolo_data,
          ref: n.protocolo_ref,
        })),
        opsVinculadas: listaOps.filter((o) => o.notificado_em || o.protocolo_ref).length,
        opsSingulares: listaOps.filter((o) => o.banco && !bancoGenerico(o.banco)).length,
        opsEmParProtocolado: listaOps.filter((o) =>
          pares.has(`${o.cliente_id}|${String(o.banco || "").trim().toLowerCase()}`),
        ).length,
      });
    })();
  }, []);

  const pendentes = useMemo(
    () =>
      itens
        .filter((i) =>
          cabeComplementacao(i.ficha, i.banco, i.complementacoes.map((c) => c.data).sort().pop() ?? null),
        )
        .map((i) => {
          const cobertas = new Set<string>();
          i.complementacoes.forEach((c) => (c.operacoes ?? []).forEach((n) => cobertas.add(n)));
          const semCobertura = i.operacoes.filter((o) => !operacaoCoberta(o, cobertas));
          return { item: i, semCobertura, peso: pesoNoBanco(semCobertura, i.operacoes) };
        })
        .filter((l) => l.semCobertura.length > 0)
        .sort((a, b) => b.semCobertura.length - a.semCobertura.length),
    [itens],
  );

  const totalOps = pendentes.reduce((s, p) => s + p.semCobertura.length, 0);

  const criarTarefas = async () => {
    setCriando(true);
    const linhas = pendentes.map((p) => ({
      tipo: "notificacao",
      titulo: `Complementação do pedido — ${p.item.titular_nome} / ${p.item.banco}`,
      descricao:
        `${p.semCobertura.length} operação(ões) sem cobertura: ` +
        `${p.semCobertura.map((o) => o.numero).join(", ")}. ` +
        `Protocola: ${quemProtocola(p.item.responsavel)} · monta os dados: ${quemMapeia(p.item.responsavel)}. ` +
        `Peso no banco: ${percentBR(p.peso)}.`,
      status: "pendente",
    }));
    const { error } = await supabase.from("advbox_pendencias").insert(linhas as any);
    setCriando(false);
    setConfirmar(false);
    if (error) {
      toast.error("Não foi possível criar as tarefas");
      return;
    }
    setCriadas(linhas.length);
    toast.success(`${linhas.length} tarefa(s) de complementação criadas`);
  };

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Complementações pendentes</h1>
          <p className="text-sm text-muted-foreground">
            Titular + banco com protocolo vivo e operação ainda sem cobertura. Nada vira tarefa sem sua confirmação.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/notificacoes">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      {/* Diagnóstico da base: explica de onde vem o número da conferência. */}
      <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
        <p className="font-serif text-base font-bold">Diagnóstico da base</p>
        {diag.carregando ? (
          <p className="mt-1 text-sm text-muted-foreground">Conferindo…</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Pedidos marcados como protocolados</p>
                <p className="font-serif text-xl font-bold">{diag.protocoladas.length}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Operações ligadas a um protocolo</p>
                <p className="font-serif text-xl font-bold">{diag.opsVinculadas}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Operações com instituição identificada</p>
                <p className="font-serif text-xl font-bold">{diag.opsSingulares}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Operações em titular + banco com protocolo</p>
                <p className="font-serif text-xl font-bold">{diag.opsEmParProtocolado}</p>
              </div>
            </div>
            {diag.protocoladas.length === 0 ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Não há nenhum pedido marcado como protocolado no sistema. A conferência não tinha o que encontrar:
                o problema não é ausência de pendência, e sim que os protocolos já feitos nunca foram registrados
                aqui. Marque-os na tela Notificações para o acompanhamento passar a funcionar.
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {diag.protocoladas.map((n, idx) => (
                  <li key={idx}>
                    {n.titular} — {n.banco} · protocolo {formatDataBR(n.data)} · {n.ref || "sem referência"}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pares titular + banco</p>
          <p className="font-serif text-xl font-bold">{pendentes.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Operações sem cobertura</p>
          <p className="font-serif text-xl font-bold">{totalOps}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Tarefas criadas agora</p>
          <p className="font-serif text-xl font-bold">{criadas}</p>
        </div>
      </div>

      <Button disabled={loading || pendentes.length === 0 || criando} onClick={() => setConfirmar(true)}>
        <ClipboardList className="mr-1 h-4 w-4" /> Criar as tarefas de complementação
      </Button>

      <div className="mt-4 space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Carregando a base…</p>}
        {!loading && pendentes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {diag.protocoladas.length === 0
              ? "Sem pedido protocolado registrado, não há como haver complementação pendente — veja o diagnóstico acima."
              : "Todas as operações dos pedidos protocolados já estão cobertas. Nenhuma complementação pendente hoje."}
          </p>
        )}
        {pendentes.map(({ item, semCobertura, peso }: { item: ItemNotificacao; semCobertura: any[]; peso: number }) => (
          <div key={`${item.titular_nome}|${item.banco}`} className="rounded-lg border border-border bg-card p-4">
            <p className="font-serif text-base font-bold">
              {item.titular_nome}{" "}
              <span className="font-sans text-sm font-normal text-muted-foreground">— {item.banco}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-normal">
                protocolo {formatDataBR(item.ficha?.protocolo_data)} · {item.ficha?.protocolo_ref || "sem referência"}
              </Badge>
              <span>protocola: {quemProtocola(item.responsavel)}</span>
              <span>monta os dados: {quemMapeia(item.responsavel)}</span>
              <span>peso no banco: {percentBR(peso)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {semCobertura.map((o) => (
                <li key={o.id}>
                  {o.numero} · {o.modalidade} · {moedaBR(o.saldo_devedor)} · vence {formatDataBR(o.vence_em)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Criar as tarefas de complementação?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão criadas {pendentes.length} tarefa(s), cobrindo {totalOps} operação(ões), para quem protocola cada
              carteira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={criarTarefas}>Criar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
