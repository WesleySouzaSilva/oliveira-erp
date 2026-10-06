import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IntimacoesTab from "./IntimacoesTab";
import PrazosD5Tab from "./PrazosD5Tab";
import ConfiguracaoTab from "./ConfiguracaoTab";
import MovimentacoesNovasTab from "./MovimentacoesNovasTab";
import RadarClientesTab from "./RadarClientesTab";
import ConferenciaAdvboxTab from "./ConferenciaAdvboxTab";

export default function Controladoria() {
  const [sp, setSp] = useSearchParams();
  const aba = sp.get("aba") || "intimacoes";
  return (
    <AppLayout>
      <PageHeader
        icon={ShieldCheck}
        title="Controladoria"
        subtitle="Intimações do DJEN e prazos dos próximos 5 dias úteis"
        backTo="/"
      />
      <Tabs value={aba} onValueChange={(v) => setSp({ aba: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="intimacoes">Intimações</TabsTrigger>
          <TabsTrigger value="d5">Prazos D-5</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações novas</TabsTrigger>
          <TabsTrigger value="radar">Radar de clientes</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência ADVBOX</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>
        <TabsContent value="intimacoes" className="mt-4"><IntimacoesTab /></TabsContent>
        <TabsContent value="d5" className="mt-4"><PrazosD5Tab /></TabsContent>
        <TabsContent value="movimentacoes" className="mt-4"><MovimentacoesNovasTab /></TabsContent>
        <TabsContent value="radar" className="mt-4"><RadarClientesTab /></TabsContent>
        <TabsContent value="conferencia" className="mt-4"><ConferenciaAdvboxTab /></TabsContent>
        <TabsContent value="config" className="mt-4"><ConfiguracaoTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
