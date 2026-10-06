import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, CheckCircle2, Loader2, Send } from "lucide-react";

interface Props {
  clienteId: string | null | undefined;
  email: string | null | undefined;
  nome: string | null | undefined;
}

/**
 * Convite do cliente para o portal.
 * - Sem convite: "Convidar para o portal" (cria o usuário e manda o e-mail
 *   de primeiro acesso, que cai em /portal/definir-senha).
 * - Já convidado: badge "Portal ativo" + "Reenviar convite" (manda o link
 *   de novo; útil quando o cliente não achou o e-mail).
 * Chama a edge function `portal-cliente-convidar` (requer admin/coordenador).
 */
export function PortalClienteConviteButton({ clienteId, email, nome }: Props) {
  const [status, setStatus] = useState<"loading" | "none" | "ativo" | "inativo">("loading");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!clienteId) { setStatus("none"); return; }
    (async () => {
      const { data } = await supabase
        .from("cliente_portal_usuarios")
        .select("ativo")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (!data) setStatus("none");
      else setStatus(data.ativo ? "ativo" : "inativo");
    })();
  }, [clienteId]);

  const handleInvite = async (reenvio = false) => {
    if (!clienteId || !email) {
      toast.error("Cliente sem e-mail cadastrado");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-cliente-convidar", {
        body: { cliente_id: clienteId, email, nome: nome || undefined, origin: window.location.origin },
      });
      const d = data as any;
      if (error || (d && d.error)) {
        toast.error(d?.error || error?.message || "Falha ao convidar");
        return;
      }
      if (d?.email_enviado === false) {
        toast.warning(
          reenvio
            ? "Acesso ativo, mas o e-mail não saiu. Peça ao cliente para usar 'Primeiro acesso' na tela do portal."
            : "Acesso criado, mas o e-mail não saiu. O cliente pode usar 'Primeiro acesso' na tela do portal.",
        );
      } else {
        toast.success(
          reenvio
            ? `Link reenviado para ${email}.`
            : `Convite enviado para ${email}. O cliente recebe um link para criar a senha.`,
        );
      }
      setStatus("ativo");
    } finally {
      setSending(false);
    }
  };

  if (!clienteId) return null;
  if (status === "loading") return null;

  if (status === "ativo") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> Portal ativo
        </span>
        <button
          type="button"
          onClick={() => handleInvite(true)}
          disabled={sending || !email}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          title={!email ? "Cadastre o e-mail do cliente" : "Reenviar o link de acesso ao portal"}
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Reenviar convite
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => handleInvite(false)}
      disabled={sending || !email}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
      title={!email ? "Cadastre o e-mail do cliente para convidar" : "Enviar convite para o portal"}
    >
      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
      {status === "inativo" ? "Reativar portal" : "Convidar para o portal"}
    </button>
  );
}
