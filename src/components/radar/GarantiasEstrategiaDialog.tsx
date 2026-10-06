import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { useGarantiasOperacao, useEstrategiaHistorico, mudarEstrategia } from "@/hooks/useGarantias";
import {
  CONJUGE_ANUIU,
  ESTRATEGIAS,
  GRAUS_HIPOTECA,
  SITUACOES_GARANTIA,
  TIPOS_GARANTIA,
  labelEstrategia,
  labelSituacaoGarantia,
  labelTipoGarantia,
} from "@/lib/garantias";

const formatBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  operacao: { id: string; banco?: string; numero?: string; estrategia?: string | null } | null;
  onSaved?: () => void;
}

export function GarantiasEstrategiaDialog({ open, onOpenChange, operacao, onSaved }: Props) {
  const opId = operacao?.id || null;
  const { isAdmin } = usePapelRadar();
  const {
    garantias,
    avalistas,
    salvarGarantia,
    removerGarantia,
    salvarAvalista,
    removerAvalista,
  } = useGarantiasOperacao(open ? opId : null);
  const historico = useEstrategiaHistorico(open ? opId : null);

  // ---- nova garantia
  const [tipo, setTipo] = useState("alienacao_fiduciaria");
  const [grau, setGrau] = useState("1ª");
  const [descricao, setDescricao] = useState("");
  const [identificacao, setIdentificacao] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [ondeRegistrada, setOndeRegistrada] = useState("");
  const [situacao, setSituacao] = useState("gravado");

  // ---- novo avalista
  const [avNome, setAvNome] = useState("");
  const [avCpf, setAvCpf] = useState("");
  const [avConjuge, setAvConjuge] = useState("nao_se_aplica");
  const [pessoas, setPessoas] = useState<{ id: string; nome: string; cpf_cnpj: string | null }[]>([]);
  const [avPessoaId, setAvPessoaId] = useState<string>("");

  // ---- estratégia
  const [novaEstrategia, setNovaEstrategia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNovaEstrategia(operacao?.estrategia || "");
    setMotivo("");
    supabase
      .from("clientes")
      .select("id, nome, cpf_cnpj")
      .is("deleted_at", null)
      .order("nome")
      .limit(1000)
      .then(({ data }) => setPessoas((data as any[]) || []));
  }, [open, operacao?.estrategia]);

  const tipoInfo = TIPOS_GARANTIA.find((t) => t.value === tipo);

  const addGarantia = async () => {
    if (!opId) return;
    setSalvando(true);
    const ok = await salvarGarantia({
      operacao_id: opId,
      tipo,
      grau: tipo === "hipoteca" ? grau : null,
      descricao,
      identificacao,
      valor_avaliacao: valor,
      onde_registrada: ondeRegistrada,
      situacao,
    });
    setSalvando(false);
    if (ok) {
      setDescricao("");
      setIdentificacao("");
      setValor(null);
      setOndeRegistrada("");
      onSaved?.();
    }
  };

  const addAvalista = async () => {
    if (!opId) return;
    const pessoa = pessoas.find((p) => p.id === avPessoaId);
    setSalvando(true);
    const ok = await salvarAvalista({
      operacao_id: opId,
      pessoa_id: pessoa?.id || null,
      nome: pessoa?.nome || avNome,
      cpf: avCpf || pessoa?.cpf_cnpj || null,
      conjuge_anuiu: avConjuge,
    });
    setSalvando(false);
    if (ok) {
      setAvNome("");
      setAvCpf("");
      setAvPessoaId("");
      onSaved?.();
    }
  };

  const aplicarEstrategia = async () => {
    if (!opId || !novaEstrategia) return;
    setSalvando(true);
    const ok = await mudarEstrategia({
      operacaoId: opId,
      de: operacao?.estrategia || null,
      para: novaEstrategia,
      motivo,
    });
    setSalvando(false);
    if (ok) {
      setMotivo("");
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Garantias e estratégia
          </DialogTitle>
          <DialogDescription>
            {operacao?.banco} · operação {operacao?.numero}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="garantias">
          <TabsList>
            <TabsTrigger value="garantias">Garantias ({garantias.length})</TabsTrigger>
            <TabsTrigger value="avalistas">Avalistas ({avalistas.length})</TabsTrigger>
            <TabsTrigger value="estrategia">Estratégia</TabsTrigger>
          </TabsList>

          {/* ---------------- Garantias ---------------- */}
          <TabsContent value="garantias" className="space-y-4">
            {garantias.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border">
                {garantias.map((g) => (
                  <div key={g.id} className="p-3 flex items-start justify-between gap-3">
                    <div className="text-sm">
                      <p className="font-medium">
                        {labelTipoGarantia(g.tipo)}
                        {g.grau ? ` — ${g.grau}` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {[g.descricao, g.identificacao].filter(Boolean).join(" · ") || "Sem descrição"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatBRL(g.valor_avaliacao)} · {g.onde_registrada || "registro não informado"} ·{" "}
                        {labelSituacaoGarantia(g.situacao)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removerGarantia(g.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Nova garantia</p>
              <p className="text-xs text-muted-foreground">
                A cláusula de garantia é onde o texto mais varia — preencha lendo a cédula, sem leitura automática.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_GARANTIA.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {tipo === "hipoteca" && (
                  <div>
                    <Label>Grau</Label>
                    <Select value={grau} onValueChange={setGrau}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GRAUS_HIPOTECA.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Label>Descrição do bem</Label>
                  <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: trator John Deere 6110J" />
                </div>
                <div>
                  <Label>Identificação</Label>
                  <Input
                    value={identificacao}
                    onChange={(e) => setIdentificacao(e.target.value)}
                    placeholder={tipoInfo?.identificacao || "Identificação"}
                  />
                </div>
                <div>
                  <Label>Valor de avaliação</Label>
                  <CurrencyInput value={valor} onChange={setValor} />
                </div>
                <div>
                  <Label>Onde está registrada</Label>
                  <Input value={ondeRegistrada} onChange={(e) => setOndeRegistrada(e.target.value)} placeholder="Cartório, Detran, cédula…" />
                </div>
                <div>
                  <Label>Situação</Label>
                  <Select value={situacao} onValueChange={setSituacao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SITUACOES_GARANTIA.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={addGarantia} disabled={salvando}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar garantia
              </Button>
            </div>
          </TabsContent>

          {/* ---------------- Avalistas ---------------- */}
          <TabsContent value="avalistas" className="space-y-4">
            {avalistas.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border">
                {avalistas.map((a) => (
                  <div key={a.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{a.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.cpf || "sem CPF"} ·{" "}
                        {CONJUGE_ANUIU.find((c) => c.value === a.conjuge_anuiu)?.label}
                        {a.pessoa_id ? " · ficha vinculada" : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removerAvalista(a.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Novo avalista</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Pessoa já cadastrada (opcional)</Label>
                  <Select value={avPessoaId} onValueChange={setAvPessoaId}>
                    <SelectTrigger><SelectValue placeholder="Buscar na lista de pessoas" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {pessoas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome (se não estiver na lista)</Label>
                  <Input value={avNome} onChange={(e) => setAvNome(e.target.value)} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={avCpf} onChange={(e) => setAvCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Cônjuge anuiu</Label>
                  <Select value={avConjuge} onValueChange={setAvConjuge}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONJUGE_ANUIU.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={addAvalista} disabled={salvando}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar avalista
              </Button>
            </div>
          </TabsContent>

          {/* ---------------- Estratégia ---------------- */}
          <TabsContent value="estrategia" className="space-y-4">
            <p className="text-sm">
              Estratégia atual:{" "}
              <span className="font-medium">{labelEstrategia(operacao?.estrategia) || "não definida"}</span>
            </p>

            {isAdmin ? (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div>
                  <Label>Nova estratégia</Label>
                  <Select value={novaEstrategia} onValueChange={setNovaEstrategia}>
                    <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                    <SelectContent>
                      {ESTRATEGIAS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Motivo da mudança</Label>
                  <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
                </div>
                <Button size="sm" onClick={aplicarEstrategia} disabled={salvando || !novaEstrategia}>
                  Salvar estratégia
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Só o Willian define ou muda a estratégia da operação.
              </p>
            )}

            {historico.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border text-sm">
                {historico.map((h) => (
                  <div key={h.id} className="p-3">
                    <p className="font-medium">
                      {labelEstrategia(h.de) ? `${labelEstrategia(h.de)} → ` : ""}
                      {labelEstrategia(h.para)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dataBR(h.created_at)} · {h.alterado_por_nome || "equipe"} · {h.motivo}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
