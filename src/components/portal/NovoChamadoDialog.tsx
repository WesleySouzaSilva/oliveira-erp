import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Landmark, LifeBuoy, Loader2, MessageCircleQuestion, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePortalCliente,
  uploadAnexosChamado,
  type ChamadoTipo,
  type PortalContrato,
} from "@/hooks/usePortalCliente";
import { cn } from "@/lib/utils";

const TIPOS: { value: ChamadoTipo; label: string; desc: string; icon: typeof LifeBuoy }[] = [
  { value: "banco", label: "Atualização do banco", desc: "Carta, ligação do gerente, proposta ou cobrança que você recebeu.", icon: Landmark },
  { value: "pos_venda", label: "Pós-venda", desc: "Pedido para a equipe: reunião, andamento, orientação.", icon: LifeBuoy },
  { value: "documento", label: "Enviar documento", desc: "Mandar um documento que a equipe pediu.", icon: FileUp },
  { value: "duvida", label: "Dúvida", desc: "Qualquer pergunta sobre o seu caso.", icon: MessageCircleQuestion },
];

const MAX_ANEXOS = 5;
const MAX_MB = 20;

export function NovoChamadoDialog({
  aberto,
  onFechar,
  tipoInicial,
  contratoInicial,
  processoInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  tipoInicial?: ChamadoTipo;
  contratoInicial?: PortalContrato | null;
  processoInicial?: string | null;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clienteId, contratos, processos, invalidar } = usePortalCliente();

  const [tipo, setTipo] = useState<ChamadoTipo>(tipoInicial || "pos_venda");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [banco, setBanco] = useState("");
  const [bancoOutro, setBancoOutro] = useState(false);
  const [contratoId, setContratoId] = useState<string>("");
  const [processoId, setProcessoId] = useState<string>("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTipo(tipoInicial || "pos_venda");
    setTitulo("");
    setDescricao("");
    setBanco(contratoInicial?.banco || "");
    setBancoOutro(false);
    setContratoId(contratoInicial?.id || "");
    setProcessoId(processoInicial || "");
    setArquivos([]);
  }, [aberto, tipoInicial, contratoInicial, processoInicial]);

  const bancos = useMemo(() => {
    const set = new Set<string>();
    (contratos.data || []).forEach((c) => c.banco && set.add(c.banco));
    return Array.from(set).sort();
  }, [contratos.data]);

  const contratosDoBanco = useMemo(
    () => (contratos.data || []).filter((c) => !banco || c.banco === banco),
    [contratos.data, banco],
  );

  function addArquivos(list: FileList | null) {
    if (!list) return;
    const novos = Array.from(list);
    const grandes = novos.filter((f) => f.size > MAX_MB * 1024 * 1024);
    if (grandes.length) toast.error(`Arquivo acima de ${MAX_MB} MB: ${grandes.map((f) => f.name).join(", ")}`);
    const ok = novos.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    setArquivos((prev) => [...prev, ...ok].slice(0, MAX_ANEXOS));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !clienteId) return;
    if (!titulo.trim()) { toast.error("Dê um título curto ao chamado."); return; }
    if (tipo === "banco" && !banco.trim()) { toast.error("Informe qual banco entrou em contato."); return; }
    if (tipo === "documento" && arquivos.length === 0) { toast.error("Anexe o documento."); return; }

    setEnviando(true);
    try {
      const db = supabase as any;
      const { data: ch, error } = await db
        .from("portal_chamados")
        .insert({
          cliente_id: clienteId,
          aberto_por: user.id,
          aberto_por_tipo: "cliente",
          tipo,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          banco: tipo === "banco" ? banco.trim() : null,
          contrato_id: contratoId || null,
          processo_id: processoId || null,
          status: "aberto",
          prioridade: tipo === "banco" ? "alta" : "normal",
        })
        .select("id")
        .single();
      if (error) throw error;

      let anexos: any[] = [];
      if (arquivos.length) {
        anexos = await uploadAnexosChamado(clienteId, ch.id, arquivos);
      }
      // Primeira mensagem = a descrição (com anexos), para a conversa começar no thread.
      const { error: mErr } = await db.from("portal_chamado_mensagens").insert({
        chamado_id: ch.id,
        autor_id: user.id,
        autor_tipo: "cliente",
        conteudo: descricao.trim() || titulo.trim(),
        anexos,
      });
      if (mErr) throw mErr;

      toast.success("Chamado enviado. A equipe foi avisada.");
      invalidar("chamados");
      onFechar();
      navigate(`/portal/chamados/${ch.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível abrir o chamado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !enviando) onFechar(); }}>
      <DialogContent className="sm:max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Abrir chamado</DialogTitle>
          <DialogDescription>Conte o que aconteceu. A equipe responde por aqui e você recebe aviso.</DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={cn(
                  "text-left rounded-xl border p-3 transition-colors",
                  tipo === t.value ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent/50",
                )}
              >
                <t.icon className={cn("h-4 w-4 mb-1.5", tipo === t.value ? "text-accent" : "text-muted-foreground")} />
                <p className="text-sm font-medium text-foreground leading-tight">{t.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>

          {tipo === "banco" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Banco</label>
                {bancos.length > 0 && (
                  <Select
                    value={bancoOutro ? "__outro" : banco || undefined}
                    onValueChange={(v) => {
                      if (v === "__outro") { setBancoOutro(true); setBanco(""); }
                      else { setBancoOutro(false); setBanco(v); }
                      setContratoId("");
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Escolha o banco" /></SelectTrigger>
                    <SelectContent>
                      {bancos.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      <SelectItem value="__outro">Outro banco</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {(bancos.length === 0 || bancoOutro) && (
                  <Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Nome do banco" />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Contrato (se souber)</label>
                <Select value={contratoId || "__nenhum"} onValueChange={(v) => setContratoId(v === "__nenhum" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__nenhum">Não sei / não se aplica</SelectItem>
                    {contratosDoBanco.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.banco} · {c.numero_contrato || "sem número"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(tipo === "pos_venda" || tipo === "duvida") && (processos.data || []).length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Sobre qual processo? (opcional)</label>
              <Select value={processoId || "__nenhum"} onValueChange={(v) => setProcessoId(v === "__nenhum" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__nenhum">Assunto geral</SelectItem>
                  {(processos.data || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.numero_processo || "Processo sem número"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Título</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              placeholder={
                tipo === "banco" ? "Ex.: Gerente ligou propondo renegociação"
                : tipo === "documento" ? "Ex.: Matrícula atualizada da fazenda"
                : "Ex.: Quero entender o próximo passo"
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {tipo === "banco" ? "O que o banco disse ou enviou?" : "Detalhes"}
            </label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder={
                tipo === "banco"
                  ? "Data do contato, quem falou, o que foi proposto ou cobrado, prazo dado…"
                  : "Explique com suas palavras. Quanto mais detalhe, mais rápido a equipe resolve."
              }
            />
          </div>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-accent hover:text-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              Anexar foto ou PDF (até {MAX_ANEXOS} arquivos, {MAX_MB} MB cada)
              <input
                type="file"
                multiple
                accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => { addArquivos(e.target.files); e.currentTarget.value = ""; }}
              />
            </label>
            {arquivos.length > 0 && (
              <ul className="space-y-1">
                {arquivos.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                    <span className="truncate">{f.name} <span className="text-muted-foreground">({(f.size / 1024 / 1024).toFixed(1)} MB)</span></span>
                    <button type="button" onClick={() => setArquivos((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={enviando}>Cancelar</Button>
            <Button type="submit" disabled={enviando} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar chamado
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
