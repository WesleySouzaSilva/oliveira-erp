import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Botão de tema (claro/escuro). O estado mora no `next-themes` (classe `dark` no
 * `<html>`), então o mesmo botão serve a qualquer tela — só o lugar onde ele aparece
 * é definido por cada layout.
 *
 * `pronto` evita o "flash" de ícone trocando no primeiro render: antes da montagem o
 * tema ainda não é confiável, então pintamos o Sol e só depois respondemos ao tema.
 */
export function TemaToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setPronto(true);
  }, []);

  const escuro = pronto && resolvedTheme === "dark";
  const rotulo = escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro";

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={rotulo}
      title={rotulo}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ${className}`}
    >
      {escuro ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
