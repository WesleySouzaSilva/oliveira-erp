import { useSearchParams } from "react-router-dom";
import { PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentosTab from "./DocumentosTab";
import NovoEnvioTab from "./NovoEnvioTab";
import ConfigTab from "./ConfigTab";

export default function Assinaturas() {
  const [sp, setSp] = useSearchParams();
  const aba = sp.get("aba") || "documentos";
  const cliente = sp.get("cliente");
  return (
    <AppLayout>
      <PageHeader
        icon={PenLine}
        title="Assinaturas"
        subtitle="Envio de documentos para assinatura no ZapSign e acompanhamento do status"
        backTo="/"
        actions={
          <Button onClick={() => setSp(cliente ? { aba: "novo", cliente } : { aba: "novo" }, { replace: true })}>
            <Plus className="w-4 h-4 mr-1" /> Novo documento para assinatura
          </Button>
        }
      />
      <Tabs value={aba} onValueChange={(v) => setSp(cliente ? { aba: v, cliente } : { aba: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="novo">Novo envio</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>
        <TabsContent value="documentos" className="mt-4"><DocumentosTab /></TabsContent>
        <TabsContent value="novo" className="mt-4"><NovoEnvioTab key={cliente || ""} /></TabsContent>
        <TabsContent value="config" className="mt-4"><ConfigTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
