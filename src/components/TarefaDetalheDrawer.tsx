import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  X, Send, CheckCircle2, Circle, Clock, AlertTriangle,
  User, MessageSquare, Calendar, Tag, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface Comentario {
  id: string;
  tarefa_id: string;
  user_id: string;
  texto: string;
  created_at: string;
}

interface TarefaDetalheDrawerProps {
  tarefa: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleConcluida: (id: string, concluida: boolean) => void;
}

export function TarefaDetalheDrawer({ tarefa, open, onOpenChange, onToggleConcluida }: TarefaDetalheDrawerProps) {
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hoje = new Date().toISOString().split("T")[0];

  const getMemberName = (userId: string) => {
    const m = members.find((mb) => mb.user_id === userId);
    return m?.nome || "Usuário";
  };

  const getMemberInitials = (userId: string) => {
    const name = getMemberName(userId);
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  useEffect(() => {
    if (!tarefa || !open) return;
    setLoadingComentarios(true);
    supabase
      .from("tarefa_comentarios" as any)
      .select("*")
      .eq("tarefa_id", tarefa.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setComentarios((data as unknown as Comentario[]) || []);
        setLoadingComentarios(false);
        setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 100);
      });
  }, [tarefa, open]);

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !tarefa || !user || enviando) return;
    setEnviando(true);
    const { data, error } = await supabase
      .from("tarefa_comentarios" as any)
      .insert({ tarefa_id: tarefa.id, user_id: user.id, texto: novoComentario.trim() } as any)
      .select()
      .single();

    if (!error && data) {
      setComentarios((prev) => [...prev, data as unknown as Comentario]);
      setNovoComentario("");
      setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 100);
    } else {
      toast.error("Erro ao enviar comentário");
    }
    setEnviando(false);
  };

  const deletarComentario = async (id: string) => {
    await supabase.from("tarefa_comentarios" as any).delete().eq("id", id);
    setComentarios((prev) => prev.filter((c) => c.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarComentario();
    }
  };

  if (!tarefa) return null;

  const isAtrasada = !tarefa.concluida && tarefa.data_vencimento < hoje;
  const isHoje = !tarefa.concluida && tarefa.data_vencimento === hoje;

  const statusLabel = tarefa.concluida
    ? "Concluída"
    : isAtrasada
    ? "Atrasada"
    : isHoje
    ? "Vence hoje"
    : "Pendente";

  const statusColor = tarefa.concluida
    ? "text-primary bg-primary/10"
    : isAtrasada
    ? "text-destructive bg-destructive/10"
    : isHoje
    ? "text-accent bg-accent/10"
    : "text-foreground bg-secondary";

  const prioridadeLabel: Record<string, string> = {
    urgente: "Urgente",
    alta: "Alta",
    normal: "Normal",
    baixa: "Baixa",
  };

  const prioridadeColor: Record<string, string> = {
    urgente: "text-destructive bg-destructive/10",
    alta: "text-accent bg-accent/10",
    normal: "text-foreground bg-secondary",
    baixa: "text-muted-foreground bg-muted",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start gap-3">
            <button
              onClick={() => onToggleConcluida(tarefa.id, !tarefa.concluida)}
              className="mt-0.5 shrink-0"
            >
              {tarefa.concluida ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground hover:text-accent transition-colors" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <SheetTitle className={`text-base font-semibold leading-tight ${tarefa.concluida ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {tarefa.titulo}
              </SheetTitle>
              {tarefa.nome_cliente && (
                <p className="text-xs text-accent font-medium mt-1">Cliente: {tarefa.nome_cliente}</p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Details */}
        <div className="px-5 py-4 border-b border-border space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Vencimento:</span>
              <span className="font-medium text-foreground">
                {new Date(tarefa.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Responsável:</span>
              <span className="font-medium text-foreground truncate">{getMemberName(tarefa.responsavel_id)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Prioridade:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${prioridadeColor[tarefa.prioridade] || prioridadeColor.normal}`}>
                {prioridadeLabel[tarefa.prioridade] || "Normal"}
              </span>
            </div>
          </div>

          {tarefa.descricao && (
            <div className="bg-secondary/50 rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Descrição</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{tarefa.descricao}</p>
            </div>
          )}
        </div>

        {/* Comments section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-border shrink-0">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-accent" />
              Comentários ({comentarios.length})
            </h3>
          </div>

          <ScrollArea className="flex-1 px-5" ref={scrollRef as any}>
            <div className="py-3 space-y-3">
              {loadingComentarios ? (
                <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
              ) : comentarios.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Nenhum comentário ainda. Seja o primeiro!
                </p>
              ) : (
                comentarios.map((c) => {
                  const isOwn = c.user_id === user?.id;
                  return (
                    <div key={c.id} className={`flex gap-2.5 group ${isOwn ? "" : ""}`}>
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">
                        {getMemberInitials(c.user_id)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {getMemberName(c.user_id)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "dd/MM HH:mm")}
                          </span>
                          {isOwn && (
                            <button
                              onClick={() => deletarComentario(c.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
                          {c.texto}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Comment input */}
          <div className="px-5 py-3 border-t border-border shrink-0">
            <div className="flex gap-2">
              <Textarea
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva um comentário..."
                className="min-h-[40px] max-h-[100px] text-sm resize-none"
                rows={1}
              />
              <Button
                size="icon"
                onClick={enviarComentario}
                disabled={!novoComentario.trim() || enviando}
                className="shrink-0 h-10 w-10"
                aria-label="Enviar comentário"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Enter para enviar, Shift+Enter para nova linha</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
