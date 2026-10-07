import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usuarioApi } from "@/lib/api/http";

/**
 * Home dos módulos já migrados (`/erp`): o login manda para cá e o menu lateral
 * (montado no `LayoutErp`) mostra só o que já fala com a nossa API. Por enquanto
 * isso é Clientes — cada módulo migrado vira um atalho aqui.
 */
export default function HomeErp() {
  const usuario = usuarioApi();
  const primeiroNome = (usuario?.nome || usuario?.email || "").split(" ")[0].split("@")[0];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold">Olá, {primeiroNome || "usuário"}</h1>
        <p className="text-sm text-muted-foreground">
          Módulos na API própria — o restante do sistema continua no legado.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/erp/clientes" className="group">
          <Card className="p-4 transition-colors group-hover:border-primary">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-medium">Clientes</p>
                  <p className="text-xs text-muted-foreground">Listagem e cadastro</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
