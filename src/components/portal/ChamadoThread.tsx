import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Paperclip, Send, Sparkles, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useChamado,
  uploadAnexosChamado,
  urlAnexo,
  type ChamadoAnexo,
  type PortalChamadoMensagem,
} from "@/hooks/usePortalCliente";
import { cn } from "@/lib/utils";
import { fmtData } from "./portalUi";

/**
 * Thread de um chamado. Usado pelo PORTAL (modo "cliente") e pela caixa de
 * entrada interna (modo "equipe"). A RLS decide o que cada lado enxerga e
 * quem pode escrever; aqui só muda o rótulo e o lado da bolha.
 */
export function ChamadoThread({
  chamadoId,
  clienteId,
  modo,
  nomesEquipe,
  fechado,
}: {
  chamadoId: string;
  clienteId: string;
  modo: "cliente" | "equipe";
  /** user_id → nome, para rotular mensagens da equipe no modo interno. */
  nomesEquipe?: Record<string, string>;
  /** Chamado resolvido: o cliente ainda pode responder (reabre); a equipe também. */
  fechado?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { mensagens } = useChamado(chamadoId);
  const [texto, setTexto] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.data?.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const t = texto.trim();
    if (!t && arquivos.length === 0) return;
    setEnviando(true);
    try {
      let anexos: ChamadoAnexo[] = [];
      if (arquivos.length) anexos = await uploadAnexosChamado(clienteId, chamadoId, arquivos);
      const { error } = await (supabase as any).from("portal_chamado_mensagens").insert({
        chamado_id: chamadoId,
        autor_id: user.id,
        autor_tipo: modo,
        conteudo: t || (anexos.length ? `Enviou ${anexos.length} anexo(s).` : ""),
        anexos,
      });
      if (error) throw error;
      setTexto("");
      setArquivos([]);
      await qc.invalidateQueries({ queryKey: ["portal", "chamado-mensagens", chamadoId] });
      await qc.invalidateQueries({ queryKey: ["portal", "chamado", chamadoId] });
      await qc.invalidateQueries({ queryKey: ["portal", "chamados"] });
      await qc.invalidateQueries({ queryKey: ["chamados-internos"] });
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  const lista = mensagens.data || [];

  return (
    <div className="flex flex-col">
      <div className="space-y-3 px-1 py-2">
        {mensagens.isLoading && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando conversa…</p>
        )}
        {lista.map((m) => (
          <Bolha key={m.id} m={m} modo={modo} nome={nomesEquipe?.[m.autor_id]} />
        ))}
        <div ref={fimRef} />
      </div>

      <form onSubmit={enviar} className="mt-2 rounded-2xl border border-border bg-card p-3 space-y-2">
        {fechado && (
          <p className="text-[11px] text-muted-foreground">
            {modo === "cliente" ? "Este chamado foi resolvido. Se precisar, responda aqui e ele volta para a equipe." : "Chamado resolvido. Responder aqui mantém o histórico; o status não muda automaticamente."}
          </p>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder={modo === "cliente" ? "Escreva sua mensagem para a equipe…" : "Responder ao cliente…"}
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {arquivos.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {arquivos.map((f, i) => (
              <li key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px]">
                <Paperclip className="h-3 w-3" /> {f.name}
                <button type="button" onClick={() => setArquivos((p) => p.filter((_, j) => j !== i))} className="ml-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" /> Anexar
            <input
              type="file"
              multiple
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => { setArquivos((p) => [...p, ...Array.from(e.target.files || [])].slice(0, 5)); e.currentTarget.value = ""; }}
            />
          </label>
          <Button type="submit" size="sm" disabled={enviando || (!texto.trim() && arquivos.length === 0)} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}

function Bolha({ m, modo, nome }: { m: PortalChamadoMensagem; modo: "cliente" | "equipe"; nome?: string }) {
  // "meu lado" = quem está olhando
  const meu = modo === "cliente" ? m.autor_tipo === "cliente" : m.autor_tipo !== "cliente";
  const rotulo =
    m.autor_tipo === "cliente" ? (modo === "cliente" ? "Você" : "Cliente")
    : m.autor_tipo === "olivia" ? "OlivIA"
    : nome || (modo === "equipe" ? "Equipe" : "Equipe Oliveira Agro");
  const hora = new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("flex gap-2", meu ? "justify-end" : "justify-start")}>
      {!meu && (
        <span className={cn("mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.autor_tipo === "olivia" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground")}>
          {m.autor_tipo === "olivia" ? <Sparkles className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        </span>
      )}
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5", meu ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border text-foreground rounded-tl-sm")}>
        <p className={cn("text-[10px] mb-1", meu ? "text-primary-foreground/70" : "text-muted-foreground")}>{rotulo} · {hora}</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.conteudo}</p>
        {m.anexos?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {m.anexos.map((a) => <Anexo key={a.path} a={a} escuro={meu} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function Anexo({ a, escuro }: { a: ChamadoAnexo; escuro: boolean }) {
  const [abrindo, setAbrindo] = useState(false);
  async function abrir() {
    setAbrindo(true);
    const url = await urlAnexo(a.path);
    setAbrindo(false);
    if (!url) { toast.error("Não foi possível abrir o anexo."); return; }
    window.open(url, "_blank", "noopener");
  }
  return (
    <li>
      <button
        type="button"
        onClick={abrir}
        className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] underline-offset-2 hover:underline", escuro ? "bg-primary-foreground/10" : "bg-muted")}
      >
        {abrindo ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
        <span className="truncate">{a.nome}</span>
        <span className={cn("shrink-0", escuro ? "text-primary-foreground/60" : "text-muted-foreground")}>{(a.tamanho / 1024 / 1024).toFixed(1)} MB</span>
      </button>
    </li>
  );
}

export function ResumoChamadoLinha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right text-foreground">{valor}</span>
    </div>
  );
}

export { fmtData };
