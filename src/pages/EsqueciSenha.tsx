import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-light.png";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logo} alt="Oliveira Agro" className="h-16 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-display font-bold text-foreground">Recuperar senha</h1>
        </div>
        <div className="bg-card rounded-lg border border-border shadow-card p-6">
          {sent ? (
            <div className="text-center">
              <p className="text-sm text-foreground mb-4">E-mail enviado! Verifique sua caixa de entrada.</p>
              <Link to="/auth" className="text-sm text-accent hover:underline">Voltar ao login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="floating-label-group">
                <input type="email" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} required />
                <label>E-mail</label>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground disabled:opacity-50">
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </button>
              <div className="text-center">
                <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao login</Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
