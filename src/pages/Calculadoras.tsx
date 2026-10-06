import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Calculator, Briefcase, ArrowRight } from "lucide-react";

const SERVICOS = [
  {
    id: "honorarios",
    titulo: "Honorários de Reestruturação",
    descricao: "Cálculo de honorários iniciais e de êxito sobre dívida em renegociação.",
    icon: Calculator,
    path: "/calculadora-honorarios",
  },
  {
    id: "consultoria",
    titulo: "Consultoria Empresarial",
    descricao: "Simulador de planos mensais (Agro, Essencial, Empresarial, Estratégico).",
    icon: Briefcase,
    path: "/consultoria-empresarial",
  },
];

export default function Calculadoras() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold">Calculadoras</h1>
          <p className="text-muted-foreground mt-1">Selecione o serviço para abrir a calculadora correspondente.</p>
        </header>
        <div className="grid md:grid-cols-2 gap-4">
          {SERVICOS.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.id} to={s.path} className="group">
                <Card className="p-6 h-full hover:border-primary transition-colors flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-semibold">{s.titulo}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">{s.descricao}</p>
                  <div className="flex items-center text-primary text-sm font-medium gap-1 group-hover:gap-2 transition-all">
                    Abrir calculadora <ArrowRight className="w-4 h-4" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}