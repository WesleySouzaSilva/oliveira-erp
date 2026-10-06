import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Upload,
  Trash2,
  FileKey,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { format, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Certificado {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  titular_nome: string | null;
  titular_cpf: string | null;
  validade_inicio: string | null;
  validade_fim: string | null;
  emissor: string | null;
  ativo: boolean;
  created_at: string;
}

export function CertificadoDigital() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [senha, setSenha] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  useEffect(() => {
    if (user) fetchCertificados();
  }, [user]);

  const fetchCertificados = async () => {
    const { data, error } = await supabase
      .from("certificados_digitais")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (!error && data) setCertificados(data);
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pfx") && !file.name.endsWith(".p12")) {
      toast({
        title: "Formato inválido",
        description: "Envie um arquivo .pfx ou .p12",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O certificado deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setShowUploadForm(true);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !senha.trim()) return;
    setUploading(true);

    try {
      const path = `${user.id}/${Date.now()}_${selectedFile.name}`;

      // Upload do arquivo .pfx para o bucket privado
      const { error: uploadError } = await supabase.storage
        .from("certificados")
        .upload(path, selectedFile);

      if (uploadError) throw uploadError;

      // Chamar edge function para validar e extrair metadados do certificado
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("senha", senha);
      formData.append("storage_path", path);

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "assinar-laudo",
        {
          body: formData,
          headers: { "x-action": "validar-certificado" },
        }
      );

      if (fnError) {
        // Se falhou a validação, remover o arquivo do storage
        await supabase.storage.from("certificados").remove([path]);
        throw new Error(fnError.message || "Erro ao validar certificado");
      }

      // Salvar metadados no banco
      const { error: dbError } = await supabase
        .from("certificados_digitais")
        .insert({
          user_id: user.id,
          nome_arquivo: selectedFile.name,
          storage_path: path,
          titular_nome: fnData?.titular_nome || null,
          titular_cpf: fnData?.titular_cpf || null,
          validade_inicio: fnData?.validade_inicio || null,
          validade_fim: fnData?.validade_fim || null,
          emissor: fnData?.emissor || null,
        });

      if (dbError) throw dbError;

      toast({ title: "Certificado A1 cadastrado com sucesso!" });
      setShowUploadForm(false);
      setSelectedFile(null);
      setSenha("");
      fetchCertificados();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar certificado",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const askConfirm = useConfirm();
  const handleDelete = async (cert: Certificado) => {
    if (!(await askConfirm({ title: "Remover certificado", description: "Deseja remover este certificado digital?", destructive: true, confirmText: "Remover" }))) return;

    await supabase.storage.from("certificados").remove([cert.storage_path]);
    await supabase.from("certificados_digitais").delete().eq("id", cert.id);

    setCertificados((prev) => prev.filter((c) => c.id !== cert.id));
    toast({ title: "Certificado removido." });
  };

  const handleToggleAtivo = async (cert: Certificado) => {
    // Desativar todos os outros e ativar este
    if (!cert.ativo) {
      await supabase
        .from("certificados_digitais")
        .update({ ativo: false })
        .eq("user_id", user!.id);
    }

    await supabase
      .from("certificados_digitais")
      .update({ ativo: !cert.ativo })
      .eq("id", cert.id);

    fetchCertificados();
  };

  const getValidadeStatus = (cert: Certificado) => {
    if (!cert.validade_fim) return null;
    const fim = new Date(cert.validade_fim);
    if (isPast(fim))
      return { label: "Expirado", color: "text-destructive", icon: AlertTriangle };
    const dias = differenceInDays(fim, new Date());
    if (dias <= 30)
      return { label: `Expira em ${dias} dias`, color: "text-warning", icon: AlertTriangle };
    return { label: "Válido", color: "text-success", icon: CheckCircle2 };
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border shadow-card p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="bg-card rounded-lg border border-border shadow-card p-5"
    >
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          Certificado Digital A1
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Conecte seu certificado digital A1 (.pfx) para assinar laudos
        digitalmente com validade jurídica.
      </p>

      {/* Lista de certificados */}
      {certificados.length > 0 && (
        <div className="space-y-3 mb-4">
          {certificados.map((cert) => {
            const status = getValidadeStatus(cert);
            return (
              <div
                key={cert.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  cert.ativo
                    ? "border-accent/40 bg-accent/5"
                    : "border-border bg-secondary/20"
                }`}
              >
                <FileKey
                  className={`w-8 h-8 shrink-0 ${
                    cert.ativo ? "text-accent" : "text-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {cert.titular_nome || cert.nome_arquivo}
                    </p>
                    {cert.ativo && (
                      <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                        ATIVO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {cert.titular_cpf && <span>CPF: {cert.titular_cpf}</span>}
                    {cert.emissor && <span>{cert.emissor}</span>}
                  </div>
                  {status && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${status.color}`}>
                      <status.icon className="w-3 h-3" />
                      <span>{status.label}</span>
                      {cert.validade_fim && (
                        <span className="text-muted-foreground ml-1">
                          (até{" "}
                          {format(new Date(cert.validade_fim), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                          )
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleAtivo(cert)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      cert.ativo
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-accent hover:bg-accent/10"
                    }`}
                  >
                    {cert.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => handleDelete(cert)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload form */}
      {showUploadForm ? (
        <div className="border border-border rounded-lg p-4 bg-secondary/20 space-y-3">
          <div className="flex items-center gap-2">
            <FileKey className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {selectedFile?.name}
            </span>
          </div>

          <div className="floating-label-group">
            <input
              type="password"
              placeholder=" "
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
            />
            <label>Senha do certificado</label>
          </div>

          <p className="text-[11px] text-muted-foreground">
            🔒 A senha é usada apenas para validar o certificado e <strong>não será armazenada</strong>.
            O arquivo é guardado em armazenamento seguro e criptografado.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading || !senha.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {uploading ? "Validando..." : "Cadastrar certificado"}
            </button>
            <button
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFile(null);
                setSenha("");
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          {certificados.length > 0
            ? "Adicionar outro certificado"
            : "Enviar certificado A1 (.pfx)"}
          <input
            type="file"
            accept=".pfx,.p12"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      )}
    </motion.div>
  );
}
