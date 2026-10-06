import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Webhook } from "lucide-react";

export default function ConfigTab() {
  const { orgId } = useOrgMembers();
  const { isAdmin } = usePermissions();
  const [config, setConfig] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const carregar = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("assinatura_config").select("*").eq("organizacao_id", orgId).maybeSingle();
    setConfig(data);
    setNome(data?.escritorio_nome || "");
    setEmail(data?.escritorio_email || "");
    setCpf(data?.escritorio_cpf || "");
  }, [orgId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Somente administradores acessam a configuração das Assinaturas.</p>;
  }

  const salvar = async () => {
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("zapsign-webhook-registrar", {
      body: { acao: "salvar_config", organizacao_id: orgId, escritorio_nome: nome, escritorio_email: email, escritorio_cpf: cpf },
    });
    setSalvando(false);
    if (error || data?.error) toast.error(data?.error || "Falha ao salvar");
    else { toast.success("Configuração salva"); carregar(); }
  };

  const registrarWebhook = async () => {
    setRegistrando(true);
    const { data, error } = await supabase.functions.invoke("zapsign-webhook-registrar", { body: { organizacao_id: orgId } });
    setRegistrando(false);
    if (error || data?.error) toast.error(data?.error || "Falha ao registrar o webhook");
    else {
      toast.success(data?.ja_existia ? "Webhook já estava registrado" : "Webhook registrado no ZapSign");
      carregar();
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="font-medium">Signatário do escritório</h3>
        <p className="text-xs text-muted-foreground">
          Usado quando a pessoa marca "incluir o escritório" no envio. Vazio por padrão — a opção fica desabilitada até configurar.
        </p>
        <div className="space-y-2">
          <div className="space-y-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="space-y-1"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
        </div>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="font-medium">Webhook do ZapSign</h3>
        <p className="text-xs text-muted-foreground">
          Um webhook vale para todos os documentos da conta. O registro inclui o cabeçalho secreto que protege o endpoint.
        </p>
        {config?.webhook_id ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Webhook registrado (id {config.webhook_id}).</p>
        ) : (
          <Button variant="outline" onClick={registrarWebhook} disabled={registrando}>
            <Webhook className="w-4 h-4 mr-1" /> {registrando ? "Registrando…" : "Registrar webhook no ZapSign"}
          </Button>
        )}
      </div>
    </div>
  );
}
