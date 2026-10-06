import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useComentarios, useComentarioMutations } from "./hooks/useCardSocial";

function initials(nome: string | null | undefined): string {
  if (!nome) return "?";
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
function fmt(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  processoId: string;
  orgId: string | null;
}

export function CardComentariosSection({ processoId, orgId }: Props) {
  const { user } = useAuth();
  const q = useComentarios(processoId);
  const m = useComentarioMutations(processoId, orgId);
  const [texto, setTexto] = useState("");

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    m.add.mutate(t, { onSuccess: () => setTexto("") });
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {q.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
        )}
        {q.data?.map((c) => (
          <li key={c.id} className="flex items-start gap-2 border border-border rounded-lg p-2 bg-background">
            <Avatar className="w-7 h-7 mt-0.5 shrink-0">
              <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-semibold">
                {initials(c.autor_nome)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground truncate">{c.autor_nome ?? "Usuário"}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">{fmt(c.created_at)}</span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{c.conteudo}</p>
            </div>
            {c.autor_id === user?.id && (
              <button
                onClick={() => m.remove.mutate(c.id)}
                className="text-muted-foreground/60 hover:text-destructive shrink-0"
                aria-label="Excluir comentário"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escrever comentário..."
          rows={2}
          className="flex-1 text-sm"
        />
        <Button size="sm" onClick={enviar} disabled={!texto.trim() || m.add.isPending} className="self-end">
          <Send className="w-3.5 h-3.5 mr-1" /> Enviar
        </Button>
      </div>
    </div>
  );
}