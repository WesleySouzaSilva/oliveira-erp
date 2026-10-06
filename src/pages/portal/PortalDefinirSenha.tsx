import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logoLight from "@/assets/logo-light.png";
import heroField from "@/assets/auth-hero-field.jpg";

/**
 * Primeiro acesso / nova senha do PORTAL DO CLIENTE.
 *
 * Dois modos:
 *  - com hash `type=recovery` na URL (veio do e-mail): define a senha e entra no portal;
 *  - com `?solicitar=1`: pede o e-mail e dispara o link (primeiro acesso ou senha esquecida).
 *
 * O e-mail de convite (função portal-cliente-convidar) aponta para cá.
 */
export default function PortalDefinirSenha() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const solicitar = params.get("solicitar") === "1";
  const primeiro = params.get("primeiro") === "1";
  const [temRecovery, setTemRecovery] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // O Supabase coloca os tokens no hash e a sessão fica ativa; o hash pode
    // já ter sido consumido pelo AuthProvider, então também aceitamos sessão viva.
    const hash = window.location.hash || "";
    let marca = false;
    try { marca = sessionStorage.getItem("oa_recovery") === "1"; } catch { /* noop */ }
    if (hash.includes("type=recovery") || marca) { setTemRecovery(true); return; }
    if (solicitar) { setTemRecovery(false); return; }
    supabase.auth.getSession().then(({ data }) => setTemRecovery(!!data.session));
  }, [solicitar]);

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/portal/definir-senha`,
      });
      if (error) throw error;
      setEnviado(true);
    } catch (err: any) {
      toast({ title: "Não foi possível enviar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) { toast({ title: "Use pelo menos 8 caracteres", variant: "destructive" }); return; }
    if (senha !== senha2) { toast({ title: "As senhas não conferem", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      try { sessionStorage.removeItem("oa_recovery"); } catch { /* noop */ }
      setOk(true);
      setTimeout(() => navigate("/portal", { replace: true }), 1200);
    } catch (err: any) {
      toast({ title: "Erro ao salvar a senha", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full px-4 py-3.5 bg-white border border-[#064E3B]/10 rounded-xl text-[#064E3B] focus:ring-2 focus:ring-[#B8851F] focus:border-transparent outline-none transition-all placeholder:text-[#064E3B]/30";
  const label = "text-[11px] font-semibold text-[#064E3B]/70 uppercase tracking-wider";
  const botao =
    "w-full py-4 bg-[#B8851F] text-white font-semibold rounded-xl hover:bg-[#a1741a] transition-all shadow-lg shadow-[#B8851F]/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";

  return (
    <main className="min-h-dvh w-full relative flex items-center justify-center bg-[#F5F2EA] font-body overflow-hidden px-6 py-12">
      <img src={heroField} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#F5F2EA] via-[#F5F2EA]/85 to-[#064E3B]/20" aria-hidden />

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-[440px] bg-white/80 backdrop-blur-md border border-[#064E3B]/10 rounded-2xl shadow-[0_20px_60px_-20px_rgba(6,78,59,0.25)] p-8 md:p-10"
      >
        <header className="mb-7 text-center">
          <img src={logoLight} alt="Oliveira Agro" className="h-24 w-auto mx-auto mb-5 drop-shadow-sm" />
          <div className="flex items-center gap-3 mb-3 justify-center">
            <span className="h-px w-8 bg-[#B8851F]/60" />
            <p className="text-[#B8851F] text-[10px] font-semibold tracking-[0.24em] uppercase">Portal do Cliente</p>
            <span className="h-px w-8 bg-[#B8851F]/60" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#064E3B] tracking-tight">
            {temRecovery ? "Crie sua senha" : primeiro ? "Primeiro acesso" : "Recuperar acesso"}
          </h1>
          <p className="text-[#064E3B]/60 text-sm mt-1.5">
            {temRecovery
              ? "Escolha uma senha para entrar no portal."
              : primeiro
              ? "Informe o e-mail que o escritório cadastrou. Você recebe um link para criar a senha."
              : "Informe seu e-mail e enviamos um link para definir uma nova senha."}
          </p>
        </header>

        {temRecovery === null ? (
          <div className="py-8 text-center text-[#064E3B]/60"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : temRecovery ? (
          ok ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-[#064E3B] mx-auto" />
              <p className="text-sm text-[#064E3B]">Senha criada. Entrando no portal…</p>
            </div>
          ) : (
            <form onSubmit={salvarSenha} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="senha" className={label}>Nova senha</label>
                <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} placeholder="mínimo 8 caracteres" className={input} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="senha2" className={label}>Repita a senha</label>
                <input id="senha2" type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} required minLength={8} placeholder="••••••••" className={input} autoComplete="new-password" />
              </div>
              <button type="submit" disabled={loading} className={botao}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar e entrar
              </button>
            </form>
          )
        ) : enviado ? (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-[#064E3B] mx-auto" />
            <p className="text-sm text-[#064E3B]">
              Se este e-mail estiver cadastrado no escritório, você recebe o link em instantes. Confira também a caixa de spam.
            </p>
            <Link to="/portal/login" className="inline-block text-sm text-[#B8851F] font-medium hover:underline underline-offset-4">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={pedirLink} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className={label}>E-mail</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" className={input} autoComplete="email" />
            </div>
            <button type="submit" disabled={loading} className={botao}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar link
            </button>
            <p className="text-center text-xs text-[#064E3B]/50 pt-2">
              Não recebeu convite? Fale com a equipe do escritório para liberar o seu acesso.
            </p>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-[#064E3B]/50">
          <Link to="/portal/login" className="text-[#B8851F] hover:underline underline-offset-4 font-medium">Voltar ao login do portal</Link>
        </p>
      </motion.section>
    </main>
  );
}
