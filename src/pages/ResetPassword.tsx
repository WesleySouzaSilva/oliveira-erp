import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-light.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      navigate("/auth");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha atualizada com sucesso!" });
      navigate("/");
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
          <h1 className="text-2xl font-display font-bold text-foreground">Nova senha</h1>
        </div>
        <div className="bg-card rounded-lg border border-border shadow-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="floating-label-group">
              <input type="password" placeholder=" " value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <label>Nova senha (mín. 6 caracteres)</label>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground disabled:opacity-50">
              {loading ? "Atualizando..." : "Atualizar senha"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
