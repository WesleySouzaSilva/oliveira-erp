import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/config/api";
import { autenticadoApi, loginApi, mensagemDeErro } from "@/lib/api/http";

/**
 * Entrada dos módulos já migrados (`/erp/entrar`). Autentica na **nossa API**
 * (`POST /api/v1/auth/login`) — a sessão do Supabase não vale aqui.
 * Os hashes de senha foram preservados na migração, então é o mesmo e-mail/senha de sempre.
 */
export default function Entrar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);

  // Sessão da API já válida (guarda mandou para cá sem token vencido?): segue direto
  // para a home dos módulos, em vez de pedir a mesma credencial de novo.
  useEffect(() => {
    if (autenticadoApi()) navigate("/erp", { replace: true });
  }, [navigate]);

  const entrar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!email.trim() || !senha) {
      toast.error("Informe e-mail e senha");
      return;
    }
    setEntrando(true);
    try {
      await loginApi(email.trim(), senha);
      toast.success("Bem-vindo de volta");
      navigate("/erp", { replace: true });
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-9 h-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-serif font-bold">
            O
          </span>
          <div className="leading-tight">
            <h1 className="font-serif font-bold">Oliveira</h1>
            <p className="text-xs text-muted-foreground">módulos na API própria</p>
          </div>
        </div>

        <form onSubmit={entrar} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api-email">E-mail</Label>
            <Input
              id="api-email"
              type="email"
              autoComplete="username"
              placeholder="voce@oliveira.adv.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-senha">Senha</Label>
            <Input
              id="api-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={entrando}>
            <LogIn className="w-4 h-4 mr-2" />
            {entrando ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-4 text-[11px] text-muted-foreground break-all">
          API: {API_BASE_URL}
        </p>
      </Card>
    </div>
  );
}
