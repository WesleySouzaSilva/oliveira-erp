import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CANAIS,
  CANAIS_CONTATO,
  RESULTADOS,
  PRAZOS_PADRAO,
  hojeISO,
  formatDataBR,
  type PrazosConfig,
} from "@/lib/notificacoesBanco";
import type { ItemNotificacao } from "@/hooks/useNotificacoesBanco";

interface BaseProps {
  item: ItemNotificacao | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ProtocolarDialog({
  item,
  open,
  onOpenChange,
  onSalvar,
}: BaseProps & {
  onSalvar: (d: { data: string; canal: string; referencia: string }) => Promise<boolean>;
}) {
  const [data, setData] = useState(hojeISO());
  const [canal, setCanal] = useState("");
  const [referencia, setReferencia] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setData(hojeISO());
      setCanal("");
      setReferencia("");
    }
  }, [open]);

  const valido = !!data && !!canal && referencia.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Registrar protocolo</DialogTitle>
          <DialogDescription>
            {item?.titular_nome} — {item?.banco}. Data, canal e referência são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="prot-data">Data do protocolo</Label>
            <Input id="prot-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="prot-canal">Canal</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger id="prot-canal">
                <SelectValue placeholder="Escolha o canal" />
              </SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="prot-ref">Referência (número do protocolo, e-mail, AR…)</Label>
            <Input id="prot-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Ao salvar, as operações deste titular neste banco saem do radar e o acompanhamento começa a contar.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || salvando}
            onClick={async () => {
              setSalvando(true);
              const ok = await onSalvar({ data, canal, referencia: referencia.trim() });
              setSalvando(false);
              if (ok) onOpenChange(false);
            }}
          >
            Salvar protocolo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Complementação de um pedido já protocolado: mesma notificação, evento novo. */
export function ComplementacaoDialog({
  item,
  open,
  onOpenChange,
  meuNome,
  onSalvar,
}: BaseProps & {
  meuNome: string;
  onSalvar: (d: {
    data: string;
    canal: string;
    referencia: string;
    arquivo?: string | null;
    operacoes: string[];
    observacao?: string | null;
    nome?: string | null;
  }) => Promise<boolean>;
}) {
  const [data, setData] = useState(hojeISO());
  const [canal, setCanal] = useState("email");
  const [referencia, setReferencia] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setData(hojeISO());
      setCanal("email");
      setReferencia("");
      setArquivo("");
      setMarcadas([]);
    }
  }, [open]);

  const ops = item?.operacoes ?? [];
  const valido = !!data && !!canal && referencia.trim().length > 0 && marcadas.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Registrar complementação do pedido</DialogTitle>
          <DialogDescription>
            {item?.titular_nome} — {item?.banco}
            {item?.ficha?.protocolo_data
              ? ` · pedido original protocolado em ${formatDataBR(item.ficha.protocolo_data)}`
              : " · data do original a confirmar"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="comp-data">Data da complementação</Label>
            <Input id="comp-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="comp-canal">Canal</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger id="comp-canal">
                <SelectValue placeholder="Escolha o canal" />
              </SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="comp-ref">Referência</Label>
            <Input id="comp-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="comp-arq">Arquivo (nome ou link)</Label>
            <Input id="comp-arq" value={arquivo} onChange={(e) => setArquivo(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Operações cobertas</Label>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {ops.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma operação vinculada a este titular e banco.</p>
              )}
              {ops.map((o) => {
                const chave = o.numero || o.id;
                return (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={marcadas.includes(chave)}
                      onChange={(e) =>
                        setMarcadas((m) => (e.target.checked ? [...m, chave] : m.filter((v) => v !== chave)))
                      }
                    />
                    <span>
                      {o.numero || "número a conferir"}
                      {o.vence_em ? ` · vence ${formatDataBR(o.vence_em)}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A notificação continua a mesma. As operações marcadas saem da fila de peticionamento e o contador de
            resposta do banco recomeça nesta data.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || salvando}
            onClick={async () => {
              setSalvando(true);
              const ok = await onSalvar({
                data,
                canal,
                referencia: referencia.trim(),
                arquivo: arquivo.trim() || null,
                operacoes: marcadas,
                nome: meuNome,
              });
              setSalvando(false);
              if (ok) onOpenChange(false);
            }}
          >
            Salvar complementação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



export function RespostaDialog({
  item,
  open,
  onOpenChange,
  onSalvar,
}: BaseProps & {
  onSalvar: (d: { data: string; resultado: string; anexo?: string | null }) => Promise<boolean>;
}) {
  const [data, setData] = useState(hojeISO());
  const [resultado, setResultado] = useState("");
  const [anexo, setAnexo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setData(hojeISO());
      setResultado("");
      setAnexo("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Registrar resposta do banco</DialogTitle>
          <DialogDescription>
            {item?.titular_nome} — {item?.banco}. Resposta evasiva ou pedindo documento reinicia o contador.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="resp-data">Data da resposta</Label>
            <Input id="resp-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="resp-res">Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger id="resp-res">
                <SelectValue placeholder="Escolha o resultado" />
              </SelectTrigger>
              <SelectContent>
                {RESULTADOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="resp-anexo">Anexo da resposta (link ou nome do arquivo)</Label>
            <Input id="resp-anexo" value={anexo} onChange={(e) => setAnexo(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!data || !resultado || salvando}
            onClick={async () => {
              setSalvando(true);
              const ok = await onSalvar({ data, resultado, anexo: anexo.trim() || null });
              setSalvando(false);
              if (ok) onOpenChange(false);
            }}
          >
            Salvar resposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContatoDialog({
  item,
  open,
  onOpenChange,
  meuNome,
  onSalvar,
}: BaseProps & {
  meuNome: string;
  onSalvar: (d: { data: string; canal: string; resumo: string; nome: string }) => Promise<boolean>;
}) {
  const [data, setData] = useState(hojeISO());
  const [canal, setCanal] = useState("whatsapp");
  const [resumo, setResumo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setData(hojeISO());
      setCanal("whatsapp");
      setResumo("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Registrar contato com o produtor</DialogTitle>
          <DialogDescription>
            {item?.titular_nome} — {item?.banco}
            {item?.ultimo_contato ? ` · último contato em ${formatDataBR(item.ultimo_contato)}` : " · sem contato registrado"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cont-data">Data</Label>
            <Input id="cont-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cont-canal">Canal</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger id="cont-canal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANAIS_CONTATO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cont-resumo">O que foi dito</Label>
            <Textarea id="cont-resumo" rows={4} value={resumo} onChange={(e) => setResumo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!resumo.trim() || salvando}
            onClick={async () => {
              setSalvando(true);
              const ok = await onSalvar({ data, canal, resumo: resumo.trim(), nome: meuNome });
              setSalvando(false);
              if (ok) onOpenChange(false);
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PrazosConfigDialog({
  open,
  onOpenChange,
  config,
  onSalvar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: PrazosConfig;
  onSalvar: (c: PrazosConfig) => Promise<boolean>;
}) {
  const [valores, setValores] = useState<PrazosConfig>(config ?? PRAZOS_PADRAO);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (open) setValores(config ?? PRAZOS_PADRAO);
  }, [open, config]);

  const campos: { key: keyof PrazosConfig; label: string }[] = [
    { key: "prazo_consumidor_gov", label: "Cobrar retorno — consumidor.gov (dias)" },
    { key: "prazo_outros_canais", label: "Cobrar retorno — demais canais (dias)" },
    { key: "dias_sem_resposta", label: "Entrar em “Sem resposta do banco” (dias)" },
    { key: "dias_silencio", label: "Marcar silêncio do banco (dias)" },
    { key: "dias_contato_cliente", label: "Dar satisfação ao cliente (dias sem contato)" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Prazos do acompanhamento</DialogTitle>
          <DialogDescription>Contados da data do protocolo. Só administradores salvam.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {campos.map((c) => (
            <div key={c.key}>
              <Label htmlFor={`cfg-${c.key}`}>{c.label}</Label>
              <Input
                id={`cfg-${c.key}`}
                type="number"
                min={1}
                value={valores[c.key]}
                onChange={(e) => setValores({ ...valores, [c.key]: Number(e.target.value) || 1 })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={salvando}
            onClick={async () => {
              setSalvando(true);
              const ok = await onSalvar(valores);
              setSalvando(false);
              if (ok) onOpenChange(false);
            }}
          >
            Salvar prazos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
