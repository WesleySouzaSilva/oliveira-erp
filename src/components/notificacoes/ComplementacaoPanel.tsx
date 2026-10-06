import { useEffect, useMemo, useState } from "react";
import { Copy, FileUp, AlertTriangle, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDataBR, hojeISO, labelCanal } from "@/lib/notificacoesBanco";
import { montarCalendario } from "@/lib/diasUteis";
import {
  CANAIS_COMPLEMENTACAO,
  exigeNovoProtocolo,
  operacaoCoberta,
  pesoNoBanco,
  percentBR,
  moedaBR,
  prazosComplementacao,
  prazoRetificacaoLaudo,
  quemMapeia,
  quemProtocola,
  textoComplementacao,
  PESO_TRAVA_LAUDO,
} from "@/lib/complementacao";
import type { ItemNotificacao } from "@/hooks/useNotificacoesBanco";

const LAUDO_OK = ["entregue", "concluido", "finalizado", "pronto", "laudo_completo_entregue"];

export interface DadosComplementacao {
  data: string;
  canal: string;
  referencia: string;
  arquivo: string | null;
  operacoes: string[];
  novo_protocolo?: string | null;
  prazo_tarefa: string;
  prazo_fatal: string;
  responsavel_protocolo: string;
  participante: string;
  nome?: string | null;
}

export function ComplementacaoPanel({
  item,
  open,
  onOpenChange,
  meuNome,
  onConfirmar,
  onPedirRetificacao,
}: {
  item: ItemNotificacao | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meuNome: string;
  onConfirmar: (d: DadosComplementacao) => Promise<boolean>;
  onPedirRetificacao: (d: {
    item: ItemNotificacao;
    peso: number;
    prazo: string;
    operacoes: string[];
  }) => Promise<boolean>;
}) {
  const hoje = hojeISO();
  const [feriados, setFeriados] = useState<{ data: string; ativo?: boolean | null }[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [propostos, setPropostos] = useState<Record<string, string>>({});
  const [canal, setCanal] = useState("email_mesmo_fio");
  const [novoProtocolo, setNovoProtocolo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelecionadas([]);
    setPropostos({});
    setCanal("email_mesmo_fio");
    setNovoProtocolo("");
    setReferencia("");
    setArquivo(null);
    setTexto("");
    supabase
      .from("feriados")
      .select("data, ativo")
      .then(({ data }) => setFeriados(((data as any[]) || []) as any));
  }, [open]);

  const cal = useMemo(() => montarCalendario(new Date().getFullYear(), feriados), [feriados]);

  /** Operações do titular naquele banco ainda sem cobertura de protocolo. */
  const cobertasHist = useMemo(() => {
    const s = new Set<string>();
    (item?.complementacoes ?? []).forEach((c) => (c.operacoes ?? []).forEach((n) => s.add(n)));
    return s;
  }, [item]);

  const disponiveis = useMemo(
    () => (item?.operacoes ?? []).filter((o) => !operacaoCoberta(o, cobertasHist)),
    [item, cobertasHist],
  );

  const novas = useMemo(
    () => disponiveis.filter((o) => selecionadas.includes(o.id)),
    [disponiveis, selecionadas],
  );

  const peso = useMemo(() => pesoNoBanco(novas, item?.operacoes ?? []), [novas, item]);
  const exigeLaudo = peso >= PESO_TRAVA_LAUDO;
  const laudoEntregue = (item?.operacoes ?? []).some((o) => LAUDO_OK.includes(o.laudo_status || ""));

  const vencMin = useMemo(
    () => novas.map((o) => o.vence_em).filter(Boolean).sort()[0] ?? null,
    [novas],
  );
  const prazos = useMemo(() => prazosComplementacao(vencMin ?? null, hoje, cal), [vencMin, hoje, cal]);
  const responsavel = quemProtocola(item?.responsavel);
  const participante = quemMapeia(item?.responsavel);

  const upload = async (file: File) => {
    if (!item) return;
    setEnviando(true);
    const path = `${item.cliente_id ?? "sem-cliente"}/complementacoes/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cliente-drive").upload(path, file);
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar o arquivo");
      return;
    }
    setArquivo(path);
    toast.success("Arquivo protocolado anexado");
  };

  const gerarTexto = () => {
    if (!item) return;
    setTexto(
      textoComplementacao({
        titular: item.titular_nome,
        banco: item.banco,
        protocoloData: item.ficha?.protocolo_data ?? null,
        protocoloRef: item.ficha?.protocolo_ref ?? null,
        protocoloCanal: item.ficha?.protocolo_canal ?? null,
        operacoes: novas,
        vencimentoProposto: propostos,
      }),
    );
  };

  const faltaProtocolo = exigeNovoProtocolo(canal) && !novoProtocolo.trim();
  const travadoPeloLaudo = exigeLaudo && !laudoEntregue;
  const valido =
    !!item && novas.length > 0 && !!referencia.trim() && !faltaProtocolo && !travadoPeloLaudo && !salvando;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Complementação do pedido — {item?.titular_nome} / {item?.banco}
          </DialogTitle>
          <DialogDescription>
            O pedido continua o mesmo. Só entram operações deste titular neste banco, ainda sem cobertura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Protocolo original — somente leitura */}
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">Pedido original</p>
            <p className="text-muted-foreground">
              {item?.ficha?.protocolo_data ? formatDataBR(item.ficha.protocolo_data) : "data a confirmar"} ·{" "}
              {labelCanal(item?.ficha?.protocolo_canal)} ·{" "}
              {item?.ficha?.protocolo_ref || "sem referência registrada"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Protocola: <strong>{responsavel}</strong> · monta os dados: {participante} · carteira:{" "}
              {item?.responsavel || "a definir"}
            </p>
          </div>

          {/* Operações sem cobertura */}
          <div>
            <Label>Operações ainda não cobertas por nenhum protocolo</Label>
            <div className="mt-1 max-h-60 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {disponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todas as operações deste titular neste banco já estão cobertas.
                </p>
              )}
              {disponiveis.map((o) => {
                const marcada = selecionadas.includes(o.id);
                return (
                  <div key={o.id} className="rounded border border-border/60 p-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={marcada}
                        onChange={(e) =>
                          setSelecionadas((s) => (e.target.checked ? [...s, o.id] : s.filter((v) => v !== o.id)))
                        }
                      />
                      <span>
                        <strong>{o.numero}</strong> · {o.modalidade} · {moedaBR(o.saldo_devedor)} · vence{" "}
                        {formatDataBR(o.vence_em)}
                      </span>
                    </label>
                    {marcada && (
                      <div className="ml-6 mt-2 flex items-center gap-2">
                        <Label htmlFor={`prop-${o.id}`} className="text-xs text-muted-foreground">
                          Vencimento proposto
                        </Label>
                        <Input
                          id={`prop-${o.id}`}
                          type="date"
                          className="h-8 w-44"
                          value={propostos[o.id] ?? ""}
                          onChange={(e) => setPropostos((p) => ({ ...p, [o.id]: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Peso e trava do laudo */}
          {novas.length > 0 && (
            <div
              className={`rounded-md border p-3 text-sm ${
                exigeLaudo ? "border-warning/50 bg-warning/10" : "border-border bg-muted/30"
              }`}
            >
              <p>
                As operações novas representam <strong>{percentBR(peso)}</strong> da dívida deste titular no banco.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Prazo da tarefa {formatDataBR(prazos.prazoTarefa)} · prazo fatal {formatDataBR(prazos.prazoFatal)}
                {prazos.vencida ? " (operação já vencida: 2 dias úteis)" : ""}
              </p>
              {exigeLaudo && (
                <div className="mt-2">
                  <p className="flex items-center gap-2 font-semibold text-warning">
                    <AlertTriangle className="h-4 w-4" /> 10% ou mais: o laudo de capacidade precisa ser retificado
                    antes.
                  </p>
                  {laudoEntregue ? (
                    <Badge variant="outline" className="mt-1 font-normal">
                      Laudo entregue — liberado
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={async () => {
                        if (!item) return;
                        await onPedirRetificacao({
                          item,
                          peso,
                          prazo: prazoRetificacaoLaudo(prazos.prazoTarefa, hoje, cal),
                          operacoes: novas.map((o) => o.numero),
                        });
                      }}
                    >
                      Criar tarefa “Retificar laudo de capacidade” para o Lucas Zimmermann
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Canal */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="compl-canal">Canal da complementação</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger id="compl-canal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS_COMPLEMENTACAO.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {exigeNovoProtocolo(canal) && (
              <div>
                <Label htmlFor="compl-novo">Número da nova reclamação</Label>
                <Input id="compl-novo" value={novoProtocolo} onChange={(e) => setNovoProtocolo(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="compl-ref">Referência do protocolo (obrigatória)</Label>
              <Input id="compl-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="compl-arq">Arquivo protocolado</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="compl-arq"
                  type="file"
                  className="text-xs"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                {enviando && <span className="text-xs text-muted-foreground">enviando…</span>}
              </div>
              {arquivo && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <FileUp className="h-3 w-3" /> anexado
                </p>
              )}
            </div>
          </div>

          {/* Texto */}
          <div>
            <Button size="sm" variant="outline" onClick={gerarTexto} disabled={novas.length === 0}>
              Gerar texto da complementação
            </Button>
            {texto && (
              <div className="mt-2">
                <textarea
                  readOnly
                  value={texto}
                  rows={14}
                  className="w-full rounded-md border border-border bg-card p-3 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1"
                  onClick={() =>
                    navigator.clipboard.writeText(texto).then(
                      () => toast.success("Texto copiado"),
                      () => toast.error("Não foi possível copiar"),
                    )
                  }
                >
                  <Copy className="mr-1 h-4 w-4" /> Copiar texto
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido}
            onClick={async () => {
              if (!item) return;
              setSalvando(true);
              const ok = await onConfirmar({
                data: hoje,
                canal,
                referencia: referencia.trim(),
                arquivo,
                operacoes: novas.map((o) => o.id),
                novo_protocolo: novoProtocolo.trim() || null,
                prazo_tarefa: prazos.prazoTarefa,
                prazo_fatal: prazos.prazoFatal,
                responsavel_protocolo: responsavel,
                participante,
                nome: meuNome,
              });
              setSalvando(false);
              if (ok) onOpenChange(false);
            }}
          >
            {travadoPeloLaudo && <Lock className="mr-1 h-4 w-4" />} Complementação protocolada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
