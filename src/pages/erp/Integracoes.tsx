import { Plug } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { IntegracoesPanel } from "@/components/IntegracoesPanel";

/**
 * Integrações — destino do menu Administração > Integrações (correção do titular
 * 26/10/2026). Reusa o MESMO painel que já existia em `/configuracoes?tab=integracoes`
 * (cards de status + o card Invertexto de CEP/CNPJ), só que agora como tela do shell ERP
 * — fica dentro do LayoutErp, junto de Usuários/Permissões/Auditoria.
 */
export default function Integracoes() {
  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={Plug}
        title="Integrações"
        subtitle="Configure as integrações externas (Invertexto para CEP/CNPJ) e acompanhe o consumo mensal."
        breadcrumb={[{ label: "Administração" }, { label: "Integrações" }]}
      />
      <IntegracoesPanel />
    </div>
  );
}
