import { ThemeProvider as Temas } from "next-themes";
import type { ReactNode } from "react";

/**
 * Tema claro/escuro de TODO o front.
 *
 * O `next-themes` escreve a classe `dark` no `<html>` (o tailwind já está em
 * `darkMode: ["class"]`), então vale para qualquer rota — as telas novas usam as
 * variáveis (`--background`, `--card`...) e as legadas acompanham pelos `dark:`.
 * A escolha fica no `localStorage` (sobrevive ao reload) e, por padrão, acompanha o
 * sistema (`system`) até o usuário trocar.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <Temas
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="oliveira:tema"
    >
      {children}
    </Temas>
  );
}
