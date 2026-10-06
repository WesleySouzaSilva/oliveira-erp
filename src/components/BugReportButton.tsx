import { useState } from "react";
import { Bug, Send, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const categorias = [
  { value: "bug", label: "Bug / Erro" },
  { value: "melhoria", label: "Sugestão de melhoria" },
  { value: "duvida", label: "Dúvida" },
  { value: "outro", label: "Outro" },
];

const prioridades = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

interface BugReportButtonProps {
  variant?: "floating" | "sidebar";
}

export function BugReportButton({ variant = "floating" }: BugReportButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("bug");
  const [prioridade, setPrioridade] = useState("media");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!user || !titulo.trim() || !descricao.trim()) {
      toast.error("Preencha título e descrição");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("bug_reports" as any).insert({
      user_id: user.id,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      categoria,
      prioridade,
      pagina_url: window.location.pathname,
    } as any);

    if (error) {
      toast.error("Erro ao enviar report");
    } else {
      toast.success("Report enviado com sucesso! Obrigado pelo feedback.");
      setTitulo("");
      setDescricao("");
      setCategoria("bug");
      setPrioridade("media");
      setOpen(false);
    }
    setSending(false);
  };

  if (variant === "sidebar") {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground w-full"
      >
        <Bug className="w-5 h-5 shrink-0" />
        <span>Reportar Problema</span>
      </button>
    );
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-accent text-accent-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        title="Reportar problema"
      >
        <Bug className="w-5 h-5" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/40 z-[60]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-20 right-6 z-[61] w-[90vw] max-w-md bg-card border border-border rounded-xl shadow-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-display font-bold text-foreground">Reportar Problema</h3>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="Título do problema"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={prioridade} onValueChange={setPrioridade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {prioridades.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Descreva o problema em detalhes. O que aconteceu? O que era esperado?"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Página atual: <code className="bg-muted px-1 rounded">{window.location.pathname}</code>
                </p>
                <Button onClick={handleSubmit} disabled={sending || !titulo.trim() || !descricao.trim()} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Enviando..." : "Enviar Report"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
