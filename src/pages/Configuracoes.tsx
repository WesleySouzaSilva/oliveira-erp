import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Upload,
  Save,
  CheckCircle2,
  Crown,
  X,
  Plug,
  Activity,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CertificadoDigital } from "@/components/CertificadoDigital";
import { IntegracoesPanel } from "@/components/IntegracoesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AcessosEquipePanel } from "@/components/AcessosEquipePanel";
import { usePermissions } from "@/hooks/usePermissions";

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface Profile {
  nome: string;
  crea_numero: string;
  crea_uf: string;
  especialidade: string;
  cidade: string;
  uf: string;
  telefone: string;
  plano: string;
  assinatura_url: string | null;
}

export default function Configuracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "integracoes" || (tabParam === "acessos" && isAdmin) ? tabParam : "perfil";
  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "perfil") next.delete("tab"); else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };
  const [profile, setProfile] = useState<Profile>({
    nome: "",
    crea_numero: "",
    crea_uf: "",
    especialidade: "",
    cidade: "",
    uf: "",
    telefone: "",
    plano: "gratuito",
    assinatura_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();

    if (!error && data) {
      setProfile({
        nome: data.nome || "",
        crea_numero: data.crea_numero || "",
        crea_uf: data.crea_uf || "",
        especialidade: data.especialidade || "",
        cidade: data.cidade || "",
        uf: data.uf || "",
        telefone: data.telefone || "",
        plano: data.plano || "gratuito",
        assinatura_url: data.assinatura_url,
      });
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: profile.nome,
        crea_numero: profile.crea_numero,
        crea_uf: profile.crea_uf,
        especialidade: profile.especialidade,
        cidade: profile.cidade,
        uf: profile.uf,
        telefone: profile.telefone,
        onboarding_completo: true,
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil salvo com sucesso!" });
    }
    setSaving(false);
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/assinatura.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("assinaturas")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("assinaturas")
      .getPublicUrl(path);

    await supabase
      .from("profiles")
      .update({ assinatura_url: urlData.publicUrl })
      .eq("id", user.id);

    setProfile((p) => ({ ...p, assinatura_url: urlData.publicUrl }));
    toast({ title: "Assinatura enviada!" });
  };

  const update = (field: keyof Profile, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">
        Configurações
      </h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="perfil" className="gap-1.5">
            <User className="w-3.5 h-3.5" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-1.5">
            <Plug className="w-3.5 h-3.5" /> Integrações
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="acessos" className="gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Acessos da Equipe
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="perfil">
        <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg border border-border shadow-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Dados Pessoais</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="floating-label-group">
              <input
                type="text"
                placeholder=" "
                value={profile.nome}
                onChange={(e) => update("nome", e.target.value)}
              />
              <label>Nome completo</label>
            </div>
            <div className="floating-label-group">
              <input
                type="email"
                placeholder=" "
                value={user?.email || ""}
                disabled
                className="opacity-60"
              />
              <label>E-mail</label>
            </div>
            <div className="floating-label-group">
              <input
                type="tel"
                placeholder=" "
                value={profile.telefone}
                onChange={(e) => update("telefone", e.target.value)}
              />
              <label>Telefone</label>
            </div>
            <div className="floating-label-group">
              <input
                type="text"
                placeholder=" "
                value={profile.cidade}
                onChange={(e) => update("cidade", e.target.value)}
              />
              <label>Cidade</label>
            </div>
            <div className="floating-label-group">
              <select
                value={profile.uf}
                onChange={(e) => update("uf", e.target.value)}
              >
                <option value="" disabled hidden> </option>
                {ufs.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <label>UF</label>
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </motion.div>

        {/* Assinatura */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-lg border border-border shadow-card p-5"
        >
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Assinatura Padrão
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Esta assinatura será usada em todos os seus laudos. Formatos aceitos: PNG, JPG.
          </p>

          {profile.assinatura_url ? (
            <div className="border border-border rounded-lg p-4 bg-secondary/30 mb-3">
              <img
                src={profile.assinatura_url}
                alt="Assinatura"
                className="max-h-20 mx-auto"
              />
            </div>
          ) : null}

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            {profile.assinatura_url ? "Trocar assinatura" : "Enviar assinatura"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleSignatureUpload}
              className="hidden"
            />
          </label>
        </motion.div>

        {/* Certificado Digital A1 */}
        <CertificadoDigital />

        {/* Plano */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg border border-border shadow-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Seu Plano</h2>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                profile.plano === "pro"
                  ? "bg-accent/15 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {profile.plano === "pro" ? "Pro" : "Gratuito"}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Gratuito */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Gratuito</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> 3 laudos/mês</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> 3 análises de IA/mês</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> 2 templates fixos</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Exportação PDF</li>
                <li className="flex items-center gap-2"><X className="w-3.5 h-3.5 text-muted-foreground/40" /> Busca INMET</li>
                <li className="flex items-center gap-2"><X className="w-3.5 h-3.5 text-muted-foreground/40" /> Histórico ilimitado</li>
              </ul>
            </div>

            {/* Pro */}
            <div className="border-2 border-accent rounded-lg p-4 relative">
              <div className="absolute -top-2.5 left-4 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                RECOMENDADO
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <h3 className="text-sm font-semibold text-foreground">Pro</h3>
                <span className="text-lg font-display font-bold text-foreground ml-auto">R$ 97</span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-2 text-xs text-foreground">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Laudos ilimitados</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> IA ilimitada</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Busca climática INMET</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Biblioteca completa + criar</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Exportação PDF</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Histórico ilimitado</li>
              </ul>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" /> Fazer upgrade
              </button>
            </div>
          </div>
        </motion.div>
      </div>
        </TabsContent>

        <TabsContent value="integracoes">
          <IntegracoesPanel />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="acessos">
            <AcessosEquipePanel />
          </TabsContent>
        )}
      </Tabs>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setShowUpgradeModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-card rounded-lg border border-border shadow-card-hover p-6 max-w-sm w-full"
          >
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <Crown className="w-10 h-10 text-accent mx-auto mb-3" />
              <h2 className="text-lg font-display font-bold text-foreground mb-2">
                Upgrade para Pro
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Laudos ilimitados, IA sem limites, dados INMET e templates completos
                por apenas R$ 97/mês.
              </p>
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-4">
                <p className="text-3xl font-display font-bold text-foreground">
                  R$ 97<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
              </div>
              <button className="w-full py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all">
                Assinar agora
              </button>
              <p className="text-xs text-muted-foreground mt-3">
                Cancele a qualquer momento. Sem fidelidade.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
