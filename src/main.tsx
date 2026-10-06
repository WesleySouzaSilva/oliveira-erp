import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";
import { instalarGuardaVerComo } from "@/lib/verComo";

// Modo "ver como": barra qualquer escrita antes da chamada enquanto estiver ativo.
instalarGuardaVerComo(supabase);

createRoot(document.getElementById("root")!).render(<App />);
