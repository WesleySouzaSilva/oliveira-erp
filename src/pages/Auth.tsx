import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";
import logoLight from "@/assets/logo-light.png";
import heroField from "@/assets/auth-hero-field.jpg";

export default function Auth() {
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
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh w-full relative flex items-center justify-center bg-[#F5F2EA] font-body overflow-hidden px-6 py-12">
      {/* Fundo editorial */}
      <img
        src={heroField}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#F5F2EA] via-[#F5F2EA]/85 to-[#064E3B]/20" aria-hidden />

      {/* Formulário centralizado */}
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
            <img
              src={logoLight}
              alt="Oliveira Agro"
              className="h-28 md:h-32 w-auto drop-shadow-sm"
            />
          </motion.div>
          <div className="flex items-center gap-3 mb-3 justify-center">
            <span className="h-px w-8 bg-[#B8851F]/60" />
            <p className="text-[#B8851F] text-[10px] font-semibold tracking-[0.24em] uppercase">
              Se é Agro, começa aqui
            </p>
            <span className="h-px w-8 bg-[#B8851F]/60" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#064E3B] tracking-tight">
            Bem-vindo(a)
          </h1>
          <p className="text-[#064E3B]/60 text-sm mt-1.5">Acesse sua plataforma de reestruturação rural.</p>
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
              <Link to="/primeiro-acesso" className="text-[#B8851F] font-medium hover:underline underline-offset-4">
                Primeiro acesso
              </Link>
              <Link to="/esqueci-senha" className="text-[#B8851F] font-medium hover:underline underline-offset-4">
                Esqueci minha senha
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#B8851F] text-white font-semibold rounded-xl hover:bg-[#a1741a] transition-all shadow-lg shadow-[#B8851F]/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Aguarde..." : "Entrar na plataforma"}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-[#064E3B]/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em]">
              <span className="bg-[#F5F2EA] px-4 text-[#064E3B]/40 font-medium">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
            }}
            className="w-full flex items-center justify-center gap-3 py-3.5 border border-[#064E3B]/10 rounded-xl bg-white hover:bg-white/60 transition-colors font-medium text-[#064E3B]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </button>

          <p className="mt-10 text-center text-xs leading-relaxed text-[#064E3B]/50">
            Acesso restrito. Novos usuários devem ser convidados por um administrador na aba Equipe.
          </p>
          <p className="mt-3 text-center text-xs text-[#064E3B]/50">
            É cliente?{" "}
            <Link to="/portal/login" className="text-[#B8851F] hover:underline underline-offset-4 font-medium">
              Acesse o portal
            </Link>
          </p>
      </motion.section>
    </main>
  );
}
