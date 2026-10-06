import { Link, useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AcessoNegado() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Acesso negado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
            {from && (
              <>
                {" "}
                <span className="block mt-2 text-xs text-muted-foreground/70">
                  Rota solicitada: <code className="font-mono">{from}</code>
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to="/">Ir para o Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}