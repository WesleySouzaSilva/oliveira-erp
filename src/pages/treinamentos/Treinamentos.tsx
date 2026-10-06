import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, GraduationCap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSomenteLeitura } from "@/lib/verComo";
import { usePapelTrein, useSetores } from "@/lib/treinamentos";
import MeusTab from "./MeusTab";
import CatalogoTab from "./CatalogoTab";
import PainelTab from "./PainelTab";
import ConfigTab from "./ConfigTab";

export default function Treinamentos() {
  const [sp, setSp] = useSearchParams();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const aba = sp.get("aba") || (pathname.endsWith("/painel") ? "painel" : "meus");
  const papel = usePapelTrein();
  const somenteLeitura = useSomenteLeitura();
  const { setores, recarregar } = useSetores();
  const gestor = papel.admin || papel.gestor || papel.lider_setores.length > 0;

  return (
    <AppLayout>
      <PageHeader
        icon={GraduationCap}
        title="Treinamentos"
        subtitle="Trilhas por setor, progresso e certificados"
        backTo="/"
        actions={papel.lider_provas && !somenteLeitura ? (
          <Button variant="outline" onClick={() => nav("/treinamentos/provas")}><ClipboardList className="w-4 h-4 mr-1" />Provas</Button>
        ) : undefined}
      />
      {papel.carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !papel.ve_menu && !gestor && !papel.lider_provas ? (
        <div className="rounded-lg border bg-card p-8 text-center space-y-2">
          <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="font-medium">Nenhum treinamento atribuído a você por enquanto</p>
          <p className="text-sm text-muted-foreground">Quando uma trilha for publicada para o seu setor ou atribuída a você, ela aparece aqui e no menu.</p>
        </div>
      ) : (
      <Tabs value={aba} onValueChange={(v) => setSp({ aba: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="meus">Meus treinamentos</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          {gestor && <TabsTrigger value="painel">Acompanhamento</TabsTrigger>}
          {papel.admin && !somenteLeitura && <TabsTrigger value="config">Configuração</TabsTrigger>}
        </TabsList>
        <TabsContent value="meus" className="mt-4"><MeusTab setores={setores} /></TabsContent>
        <TabsContent value="catalogo" className="mt-4"><CatalogoTab setores={setores} papel={papel} /></TabsContent>
        {gestor && <TabsContent value="painel" className="mt-4"><PainelTab setores={setores} papel={papel} /></TabsContent>}
        {papel.admin && !somenteLeitura && <TabsContent value="config" className="mt-4"><ConfigTab setores={setores} recarregar={recarregar} /></TabsContent>}
      </Tabs>
      )}
    </AppLayout>
  );
}
