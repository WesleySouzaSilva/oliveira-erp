import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MODALIDADES, notifyRadarChanged, dataPlausivel, type EscopoBanco, type OperacaoCredito } from "@/hooks/useOperacoesCredito";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Textarea } from "@/components/ui/textarea";
import { HistoricoOperacao } from "@/components/radar/HistoricoOperacao";
import { MSG_NUMERO_E_CPF, numeroEhDocumento } from "@/lib/numeroOperacao";
import { bancoGenerico, MSG_BANCO_GENERICO } from "@/lib/bancoGenerico";
import { dispararAdvbox } from "@/lib/advboxDisparo";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string;
  operacao?: OperacaoCredito | null;
  onSaved?: () => void;
}

const emptyForm = {
  banco: "",
  numero: "",
  modalidade: "",
  vence_em: "",
  saldo_devedor: null as number | null,
  responsavel: "",
  grupo: "",
};

const normBanco = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function OperacaoFormDialog({ open, onOpenChange, clienteId, operacao, onSaved }: Props) {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aba, setAba] = useState<"dados" | "historico">("dados");
  const [bancosCliente, setBancosCliente] = useState<string[]>([]);
  // Documentos das pessoas do grupo: o número da operação nunca pode ser um deles.
  const [docsGrupo, setDocsGrupo] = useState<string[]>([]);

  // Mudar o vencimento de uma operação já conferida exige motivo escrito.
  const mudouVencimento = !!operacao && (operacao.vence_em || "") !== form.vence_em;
  const exigeMotivo = !!operacao && operacao.data_conferida === true && mudouVencimento;

  useEffect(() => {
    if (!open || !clienteId) return;
    let ativo = true;
    supabase
      .from("clientes")
      .select("grupo")
      .eq("id", clienteId)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo && data?.grupo) setForm((f) => (f.grupo ? f : { ...f, grupo: data.grupo as string }));
      });
    return () => {
      ativo = false;
    };
  }, [open, clienteId]);

  useEffect(() => {
    if (!open || !clienteId) return;
    let ativo = true;
    (async () => {
      const { data: ops } = await supabase.from("operacoes_credito").select("banco").eq("cliente_id", clienteId).is("deleted_at", null);
      if (!ativo) return;
      setBancosCliente(Array.from(new Set(((ops as any[]) || []).map((o) => String(o.banco || "").trim()).filter(Boolean))));
    })();
    return () => {
      ativo = false;
    };
  }, [open, clienteId]);

  useEffect(() => {
    if (!open) {
      setDocsGrupo([]);
      return;
    }
    let ativo = true;
    const carregar = async () => {
      const docs: string[] = [];
      if (clienteId) {
        const { data } = await supabase.from("clientes").select("cpf_cnpj").eq("id", clienteId).maybeSingle();
        if ((data as any)?.cpf_cnpj) docs.push((data as any).cpf_cnpj as string);
      }
      if (form.grupo.trim()) {
        const { data } = await supabase
          .from("clientes")
          .select("cpf_cnpj")
          .eq("grupo", form.grupo.trim())
          .is("deleted_at", null);
        ((data as any[]) || []).forEach((c) => c.cpf_cnpj && docs.push(c.cpf_cnpj as string));
      }
      if (ativo) setDocsGrupo(docs);
    };
    carregar();
    return () => {
      ativo = false;
    };
  }, [open, clienteId, form.grupo]);


  useEffect(() => {
    if (!open) return;
    if (operacao) {
      setForm({
        banco: operacao.banco || "",
        // Número marcado como inválido volta em branco: tem que vir da cédula.
        numero: operacao.numero_invalido ? "" : operacao.numero || "",
        modalidade: operacao.modalidade || "",
        vence_em: operacao.vence_em || "",
        saldo_devedor: operacao.saldo_devedor,
        responsavel: operacao.responsavel || "",
        grupo: operacao.grupo || "",
      });
    } else {
      setForm(emptyForm);
    }
    setMotivo("");
    setAba("dados");
  }, [open, operacao]);

  const bancoKey = normBanco(form.banco);
  const bancoJaExiste = useMemo(
    () => !!bancoKey && bancosCliente.some((b) => normBanco(b) === bancoKey),
    [bancosCliente, bancoKey],
  );
  const precisaEscopoNovoBanco = !operacao && !!bancoKey && !bancoJaExiste;

  const numeroEhCpf = numeroEhDocumento(form.numero, docsGrupo);

  const valido =
    form.banco.trim() && form.numero.trim() && form.modalidade && form.responsavel.trim() &&
    !numeroEhCpf &&
    (!exigeMotivo || motivo.trim().length >= 5);

  const salvar = async (continuar: boolean) => {
    if (!valido || saving) return;
    if (numeroEhCpf) {
      toast.error(MSG_NUMERO_E_CPF);
      return;
    }
    if (form.vence_em && !dataPlausivel(form.vence_em)) {
      toast.error("Data de vencimento improvável — confira o ano");
      return;
    }
    setSaving(true);
    // Só a digitação da data conta como conferência: editar banco, número ou saldo não confere prazo.
    const dataInformada = !operacao || mudouVencimento;
    const payload = {
      alteracao_motivo: motivo.trim() || null,
      cliente_id: clienteId,
      banco: form.banco.trim(),
      numero: form.numero.trim(),
      numero_invalido: false,
      modalidade: form.modalidade,
      vence_em: form.vence_em || null,
      saldo_devedor: form.saldo_devedor,
      responsavel: form.responsavel.trim(),
      grupo: form.grupo.trim() || null,
      // Sem data não existe prazo para acompanhar: fica na lista a conferir, nunca no radar.
      ...(dataInformada
        ? {
            status_conferencia: form.vence_em ? "radar" : "sem_vencimento",
            data_conferida: true,
          }
        : {}),
    };

    let escopoGravado: EscopoBanco | null = null;
    const { error } = operacao
      ? await supabase.from("operacoes_credito").update(payload).eq("id", operacao.id)
      : await supabase.from("operacoes_credito").insert(payload as any);

    if (error) {
      setSaving(false);
      toast.error("Não foi possível salvar a operação", { description: error.message });
      return;
    }
    if (!operacao && precisaEscopoNovoBanco) {
      escopoGravado = "fora_escopo";
      const payloadEscopo = {
        cliente_id: clienteId,
        banco: form.banco.trim(),
        escopo: escopoGravado,
        origem: "nova operação",
        pendencia_comercial: true,
        pendencia_texto: `Cliente tem dívida em ${form.banco.trim()} fora do contrato — avaliar ampliação`,
        definido_em: new Date().toISOString(),
      };
      const { error: escopoError } = await supabase.from("cliente_banco_escopo").insert(payloadEscopo as any);
      if (escopoError) {
        setSaving(false);
        toast.error("Operação salva, mas não foi possível gravar a situação do banco", { description: escopoError.message });
        return;
      }
      await supabase.from("cliente_banco_escopo_historico").insert({
        cliente_id: clienteId,
        banco: form.banco.trim(),
        escopo_anterior: null,
        escopo_novo: escopoGravado,
        origem: payloadEscopo.origem,
        alterado_por: user?.id ?? null,
        alterado_nome: (user as any)?.user_metadata?.nome ?? user?.email ?? null,
      } as any);
    }
    setSaving(false);
    if (exigeMotivo) {
      toast.info("A data voltou para \"não conferida\" e o responsável foi avisado.");
    }
    toast.success(operacao ? "Operação atualizada" : "Operação cadastrada");
    notifyRadarChanged();
    onSaved?.();

    // Operação nova em banco contratado, ou data de vencimento conferida/corrigida:
    // envia na hora para o ADVBOX (o que ainda está fora da janela nasce na rotina).
    if (!operacao || dataInformada) {
      const { data: esc } = await supabase
        .from("cliente_banco_escopo")
        .select("escopo, banco")
        .eq("cliente_id", clienteId);
      const chave = form.banco.trim().toLowerCase();
      const linha = ((esc as any[]) || []).find((e) => String(e.banco || "").trim().toLowerCase() === chave);
      const escopoParaEnvio = (linha?.escopo ?? escopoGravado ?? null) as EscopoBanco | null;
      if (escopoParaEnvio === "contratado") {
        const r = await dispararAdvbox(
          clienteId,
          operacao ? `vencimento conferido: ${form.banco.trim()}` : `operação nova: ${form.banco.trim()}`,
        );
        toast[r.ok ? "success" : "warning"](r.texto);
      }
    }
    if (continuar && !operacao) {
      setForm({ ...emptyForm, banco: form.banco, responsavel: form.responsavel, grupo: form.grupo });
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{operacao ? "Editar operação de crédito" : "Nova operação de crédito"}</DialogTitle>
        </DialogHeader>

        {operacao && (
          <div className="flex gap-1 border-b -mt-2">
            {(["dados", "historico"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAba(t)}
                className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                  aba === t ? "border-primary font-medium" : "border-transparent text-muted-foreground"
                }`}
              >
                {t === "dados" ? "Dados" : "Histórico"}
              </button>
            ))}
          </div>
        )}

        {operacao && aba === "historico" && <HistoricoOperacao operacaoId={operacao.id} />}

        <div className={`grid grid-cols-2 gap-3 ${operacao && aba !== "dados" ? "hidden" : ""}`}>
          <div className="space-y-1.5">
            <Label htmlFor="op-banco">Banco *</Label>
            <Input id="op-banco" autoFocus value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
            {bancoGenerico(form.banco) && (
              <p className="text-xs text-amber-600">{MSG_BANCO_GENERICO}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-numero">Nº da operação / cédula *</Label>
            <Input
              id="op-numero"
              value={form.numero}
              aria-invalid={numeroEhCpf}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
            />
            {numeroEhCpf && <p className="text-xs text-destructive">{MSG_NUMERO_E_CPF}</p>}
            {operacao?.numero_invalido && (
              <p className="text-xs text-muted-foreground">
                Número anterior ({operacao.numero_anterior}) era o CPF do titular — lance o número da cédula.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-modalidade">Modalidade *</Label>
            <select
              id="op-modalidade"
              value={form.modalidade}
              onChange={(e) => setForm({ ...form, modalidade: e.target.value })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-vence">Vencimento</Label>
            <Input
              id="op-vence"
              type="date"
              min="2015-01-01"
              max="2045-12-31"
              value={form.vence_em}
              onChange={(e) => setForm({ ...form, vence_em: e.target.value })}
            />
            {!form.vence_em && (
              <p className="text-xs text-muted-foreground">
                Sem data, a operação vai para "Contratos a conferir" e não entra no radar.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-grupo">Grupo / família</Label>
            <Input id="op-grupo" value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-saldo">Saldo devedor</Label>
            <CurrencyInput value={form.saldo_devedor} onChange={(v) => setForm({ ...form, saldo_devedor: v })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-resp">Responsável *</Label>
            <select
              id="op-resp"
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {form.responsavel && !members.some((m) => (m.nome || "") === form.responsavel) && (
                <option value={form.responsavel}>{form.responsavel}</option>
              )}
              {members
                .filter((m) => m.nome)
                .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                .map((m) => (
                  <option key={m.id} value={m.nome as string}>{m.nome}</option>
                ))}
            </select>
          </div>
        </div>

        {exigeMotivo && aba === "dados" && (
          <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <Label htmlFor="op-motivo">Motivo da mudança de vencimento *</Label>
            <Textarea
              id="op-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: prorrogação confirmada pelo banco em 10/09/2026"
            />
            <p className="text-xs text-muted-foreground">
              Esta data já estava conferida. Ao salvar, ela volta para "não conferida" e o responsável recebe um aviso.
            </p>
          </div>
        )}

        {aba === "dados" && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {!operacao && (
              <Button variant="secondary" onClick={() => salvar(true)} disabled={!valido || saving}>
                Salvar e lançar outra
              </Button>
            )}
            <Button onClick={() => salvar(false)} disabled={!valido || saving}>Salvar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
