import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";
import { instalarGuardaVerComo } from "@/lib/verComo";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

// Modo "ver como": barra qualquer escrita antes da chamada enquanto estiver ativo.
instalarGuardaVerComo(supabase);

// O tema fica na raiz para valer em TODA a aplicação (rotas novas e legadas).
createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
