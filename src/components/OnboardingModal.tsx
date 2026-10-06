import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, MapPin, Award, Upload, ArrowRight, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Props {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    nome: "",
    crea_numero: "",
    crea_uf: "",
    especialidade: "",
    cidade: "",
    uf: "",
    telefone: "",
  });

  const update = (field: string, value: string) => setData((prev) => ({ ...prev, [field]: value }));

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...data,
        onboarding_completo: true,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      toast.success("Perfil configurado com sucesso!");
      onComplete();
    }
    setSaving(false);
  };

  const steps = [
    {
      icon: User,
      title: "Bem-vindo à Oliveira Agro! 🌱",
      subtitle: "Vamos configurar seu perfil profissional em poucos passos.",
      content: (
        <div className="space-y-4">
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={data.nome} onChange={(e) => update("nome", e.target.value)} />
            <label>Nome completo <span className="text-destructive">*</span></label>
          </div>
          <div className="floating-label-group">
            <input type="tel" placeholder=" " value={data.telefone} onChange={(e) => update("telefone", e.target.value)} />
            <label>Telefone</label>
          </div>
        </div>
      ),
    },
    {
      icon: Award,
      title: "Dados profissionais",
      subtitle: "Informe seu registro no CREA para emissão dos laudos.",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 floating-label-group">
              <input type="text" placeholder=" " value={data.crea_numero} onChange={(e) => update("crea_numero", e.target.value)} />
              <label>Nº CREA <span className="text-destructive">*</span></label>
            </div>
            <div className="floating-label-group">
              <select value={data.crea_uf} onChange={(e) => update("crea_uf", e.target.value)}>
                <option value="" disabled hidden> </option>
                {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <label>UF</label>
            </div>
          </div>
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={data.especialidade} onChange={(e) => update("especialidade", e.target.value)} />
            <label>Especialidade (ex: Agronomia)</label>
          </div>
        </div>
      ),
    },
    {
      icon: MapPin,
      title: "Localização",
      subtitle: "Onde você atua profissionalmente?",
      content: (
        <div className="space-y-4">
          <div className="floating-label-group">
            <input type="text" placeholder=" " value={data.cidade} onChange={(e) => update("cidade", e.target.value)} />
            <label>Cidade <span className="text-destructive">*</span></label>
          </div>
          <div className="floating-label-group">
            <select value={data.uf} onChange={(e) => update("uf", e.target.value)}>
              <option value="" disabled hidden> </option>
              {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <label>UF <span className="text-destructive">*</span></label>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-xl border border-border w-full max-w-lg mx-4 overflow-hidden"
      >
        {/* Progress */}
        <div className="flex gap-1.5 p-4 pb-0">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-accent" : "bg-muted"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
                <currentStep.icon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-foreground">{currentStep.title}</h2>
                <p className="text-xs text-muted-foreground">{currentStep.subtitle}</p>
              </div>
            </div>

            <div className="mt-6">{currentStep.content}</div>

            <div className="flex justify-between mt-8">
              {step > 0 ? (
                <button onClick={() => setStep(step - 1)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all">
                  Voltar
                </button>
              ) : (
                <div />
              )}

              {step < steps.length - 1 ? (
                <button onClick={() => setStep(step + 1)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all">
                  Próximo <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleFinish} disabled={saving || !data.nome || !data.cidade || !data.uf} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-40 transition-all">
                  <CheckCircle className="w-4 h-4" /> {saving ? "Salvando..." : "Concluir"}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
