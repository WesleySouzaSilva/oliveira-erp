import { AppLayout } from "@/components/AppLayout";
import { PainelMensageria } from "@/components/mensagens/PainelMensageria";
import { MessageSquare } from "lucide-react";

export default function Mensagens() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-semibold">Mensagens</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Converse com a equipe em tempo real. Use @ para mencionar e dispare uma notificação.
        </p>
        <PainelMensageria />
      </div>
    </AppLayout>
  );
}