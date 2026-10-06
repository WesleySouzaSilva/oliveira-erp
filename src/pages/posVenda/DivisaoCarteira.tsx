import { AppLayout } from "@/components/AppLayout";
import DivisaoCarteiraPanel from "@/components/posVenda/DivisaoCarteiraPanel";

/** Mantida por compatibilidade: a divisão agora também vive dentro da Carteira de Clientes. */
export default function DivisaoCarteira() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <h1 className="font-serif text-2xl font-bold text-foreground">Divisão de carteira</h1>
        </header>
        <DivisaoCarteiraPanel />
      </div>
    </AppLayout>
  );
}
