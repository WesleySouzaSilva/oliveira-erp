import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, MessageSquare, Paperclip, Activity } from "lucide-react";
import { useAtividades, type Atividade } from "./hooks/useCardSocial";

function initials(nome: string | null | undefined): string {
  if (!nome) return "•";
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
function fmt(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function descreverAtividade(a: Atividade): { icon: JSX.Element; texto: JSX.Element } {
  const autor = a.autor_nome ?? (a.autor_id ? "Usuário" : "Sistema");
  switch (a.tipo) {
    case "moveu_coluna":
      return {
        icon: <ArrowRight className="w-3.5 h-3.5 text-info" />,
        texto: (
          <>
            <strong>{autor}</strong> moveu o card de{" "}
            <em>{a.dados?.de_titulo ?? "—"}</em> para <em>{a.dados?.para_titulo ?? "—"}</em>
          </>
        ),
      };
    case "comentou":
      return {
        icon: <MessageSquare className="w-3.5 h-3.5 text-primary" />,
        texto: (
          <>
            <strong>{autor}</strong> comentou{a.dados?.preview ? `: "${a.dados.preview}"` : ""}
          </>
        ),
      };
    case "anexou":
      return {
        icon: <Paperclip className="w-3.5 h-3.5 text-accent" />,
        texto: (
          <>
            <strong>{autor}</strong> anexou <em>{a.dados?.nome ?? "arquivo"}</em>
          </>
        ),
      };
    case "adicionou_etiqueta":
    case "removeu_etiqueta":
      return {
        icon: <Activity className="w-3.5 h-3.5 text-warning" />,
        texto: (
          <>
            <strong>{autor}</strong>{" "}
            {a.tipo === "adicionou_etiqueta" ? "adicionou" : "removeu"} a etiqueta{" "}
            <em>{a.dados?.nome ?? ""}</em>
          </>
        ),
      };
    case "adicionou_membro":
    case "removeu_membro":
      return {
        icon: <Activity className="w-3.5 h-3.5 text-warning" />,
        texto: (
          <>
            <strong>{autor}</strong>{" "}
            {a.tipo === "adicionou_membro" ? "adicionou" : "removeu"} o membro{" "}
            <em>{a.dados?.nome ?? ""}</em>
          </>
        ),
      };
    case "alterou_prazo":
      return {
        icon: <Activity className="w-3.5 h-3.5 text-warning" />,
        texto: (
          <>
            <strong>{autor}</strong> alterou o prazo para{" "}
            <em>{a.dados?.due_date ? new Date(a.dados.due_date).toLocaleDateString("pt-BR") : "—"}</em>
          </>
        ),
      };
    default:
      return {
        icon: <Activity className="w-3.5 h-3.5 text-muted-foreground" />,
        texto: (
          <>
            <strong>{autor}</strong> {a.tipo}
          </>
        ),
      };
  }
}

interface Props {
  processoId: string;
}

export function CardAtividadeSection({ processoId }: Props) {
  const q = useAtividades(processoId);

  if (q.data?.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem atividade registrada.</p>;
  }

  return (
    <ol className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {q.data?.map((a) => {
        const { icon, texto } = descreverAtividade(a);
        return (
          <li key={a.id} className="flex items-start gap-2 text-xs">
            <Avatar className="w-6 h-6 mt-0.5 shrink-0">
              <AvatarFallback className="text-[9px] bg-muted text-muted-foreground font-semibold">
                {initials(a.autor_nome)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-foreground/90 leading-snug flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">{icon}</span>
                <span className="break-words">{texto}</span>
              </p>
              <span className="text-[10px] text-muted-foreground">{fmt(a.created_at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}