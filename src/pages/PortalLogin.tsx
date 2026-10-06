import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logoLight from "@/assets/logo-light.png";
import heroField from "@/assets/auth-hero-field.jpg";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/portal");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh w-full relative flex items-center justify-center bg-[#F5F2EA] font-body overflow-hidden px-6 py-12">
      <img
        src={heroField}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#F5F2EA] via-[#F5F2EA]/85 to-[#064E3B]/20" aria-hidden />

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative z-10 w-full max-w-[440px] bg-white/80 backdrop-blur-md border border-[#064E3B]/10 rounded-2xl shadow-[0_20px_60px_-20px_rgba(6,78,59,0.25)] p-8 md:p-10"
      >
        <header className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-6 flex justify-center"
          >
            <img src={logoLight} alt="Oliveira Agro" className="h-28 md:h-32 w-auto drop-shadow-sm" />
          </motion.div>
          <div className="flex items-center gap-3 mb-3 justify-center">
            <span className="h-px w-8 bg-[#B8851F]/60" />
            <p className="text-[#B8851F] text-[10px] font-semibold tracking-[0.24em] uppercase">
              Portal do Cliente
            </p>
            <span className="h-px w-8 bg-[#B8851F]/60" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#064E3B] tracking-tight">
            Bem-vindo(a)
          </h1>
          <p className="text-[#064E3B]/60 text-sm mt-1.5">
            Acompanhe seus processos, pedidos e o seu plano.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[11px] font-semibold text-[#064E3B]/70 uppercase tracking-wider">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full px-4 py-3.5 bg-white border border-[#064E3B]/10 rounded-xl text-[#064E3B] focus:ring-2 focus:ring-[#B8851F] focus:border-transparent outline-none transition-all placeholder:text-[#064E3B]/30"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[11px] font-semibold text-[#064E3B]/70 uppercase tracking-wider">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full px-4 py-3.5 bg-white border border-[#064E3B]/10 rounded-xl text-[#064E3B] focus:ring-2 focus:ring-[#B8851F] focus:border-transparent outline-none transition-all placeholder:text-[#064E3B]/30"
            />
          </div>

          <div className="flex justify-between items-center text-sm pt-1">
            <Link to="/portal/definir-senha?solicitar=1&primeiro=1" className="text-[#B8851F] font-medium hover:underline underline-offset-4">
              Primeiro acesso
            </Link>
            <Link to="/portal/definir-senha?solicitar=1" className="text-[#B8851F] font-medium hover:underline underline-offset-4">
              Esqueci minha senha
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#B8851F] text-white font-semibold rounded-xl hover:bg-[#a1741a] transition-all shadow-lg shadow-[#B8851F]/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Aguarde..." : "Entrar no portal"}
          </button>
        </form>

        <p className="mt-10 text-center text-xs leading-relaxed text-[#064E3B]/50">
          É da equipe do escritório?{" "}
          <Link to="/auth" className="text-[#B8851F] hover:underline underline-offset-4 font-medium">
            Entrar aqui
          </Link>
        </p>
      </motion.section>
    </main>
  );
}