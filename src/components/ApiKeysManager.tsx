import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ApiKey {
  id: string;
  nome: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("api-keys", {
      method: "GET",
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar chaves", description: error.message, variant: "destructive" });
      return;
    }
    setKeys(data?.keys || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!nome.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("api-keys", {
      method: "POST",
      body: { nome: nome.trim(), scopes: ["read"] },
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro ao criar chave", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.error) {
      toast({ title: "Erro", description: data.error, variant: "destructive" });
      return;
    }
    setNewKey(data.key);
    setShowNewKey(false);
    setNome("");
    setOpenCreate(false);
    setKeys((current) => (data.record ? [data.record, ...current] : current));
    void load();
  };

  const askConfirm = useConfirm();
  const revoke = async (id: string) => {
    if (!(await askConfirm({ title: "Revogar chave de API", description: "Aplicações que usam esta chave pararão de funcionar.", destructive: true, confirmText: "Revogar" }))) return;
    const { error } = await supabase.functions.invoke("api-keys", {
      method: "DELETE",
      body: { id },
    });
    if (error) {
      toast({ title: "Erro ao revogar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Chave revogada com sucesso." });
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyField = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copiado para a área de transferência" });
    setTimeout(() => setCopiedField((c) => (c === field ? null : c)), 2000);
  };

  const curlExample = (key: string | null) =>
    `curl -H "x-api-key: ${key || "oa_live_xxxx"}" \\\n  ${(import.meta.env.VITE_SUPABASE_URL || "https://sua-url.supabase.co").replace(/\/$/, "")}/functions/v1/api-gateway/clientes`;

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> Chaves de API
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gerencie chaves para integrações externas. Cada chave só é exibida uma vez no momento da criação.
          </p>
        </div>
        <button
          onClick={() => setOpenCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nova chave
        </button>
      </div>

      <div className="space-y-2">
        {loading && keys.length === 0 ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))
        ) : keys.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <Key className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhuma chave de API ativa.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Nova chave" para começar.</p>
          </div>
        ) : (
          keys.map((k) => (
            <motion.div
              key={k.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:shadow-card-hover transition-shadow"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{k.nome}</span>
                  <button
                    onClick={() => copyField(k.key_prefix, `prefix-${k.id}`)}
                    className="group text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono inline-flex items-center gap-1 hover:bg-secondary/80 transition-colors"
                    title="Copiar prefixo (identificador) da chave"
                  >
                    {k.key_prefix}••••••••
                    {copiedField === `prefix-${k.id}` ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 text-accent-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {k.scopes.join(", ")}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                  <span>Criada em {formatDate(k.created_at)}</span>
                  {k.expires_at && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <CalendarClock className="w-3 h-3" />
                      Expira em {formatDate(k.expires_at)}
                    </span>
                  )}
                  {k.last_used_at && <span>· Usada em {formatDate(k.last_used_at)}</span>}
                </div>
              </div>
              <button
                onClick={() => revoke(k.id)}
                className="shrink-0 ml-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Revogar chave"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal: Criar chave */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" /> Nova chave de API
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dê um nome para identificar a integração. A chave só será exibida uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Nome da integração</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Claude Code, Zapier, N8N..."
                maxLength={60}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setOpenCreate(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={create}
                disabled={creating || !nome.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Gerar chave
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Mostrar chave recém-criada */}
      <Dialog open={!!newKey} onOpenChange={(v) => { if (!v) { setNewKey(null); setShowNewKey(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-success">
              <Check className="w-4 h-4" /> Chave gerada com sucesso
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-600 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Copie agora — não será possível visualizar novamente. Se perder, será necessário gerar outra.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-3">
            <div className="relative">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border font-mono text-xs break-all select-all">
                {showNewKey ? newKey : "•".repeat(newKey?.length || 40)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setShowNewKey((s) => !s)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showNewKey ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  onClick={() => copy(newKey!)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
            <div className="bg-accent/30 rounded-lg p-3 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-foreground">Como usar:</p>
                <button
                  onClick={() => copyField(curlExample(newKey), "curl-example")}
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                >
                  {copiedField === "curl-example" ? (
                    <><Check className="w-3 h-3" /> Copiado!</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copiar exemplo</>
                  )}
                </button>
              </div>
              <p>Envie a chave no header <code className="bg-muted px-1 rounded">x-api-key</code> nas requisições:</p>
              <pre className="bg-muted rounded p-2 mt-1 font-mono text-[10px] overflow-x-auto select-all">
{curlExample(newKey)}
              </pre>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { setNewKey(null); setShowNewKey(false); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Concluído
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
