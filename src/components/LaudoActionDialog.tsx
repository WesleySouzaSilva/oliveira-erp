import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FilePlus, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface LaudoActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeCliente: string;
}

interface OrgMember {
  user_id: string;
  papel: string;
  nome: string | null;
}

interface LaudoExistente {
  id: string;
  numero_laudo: string;
  status: string;
  dados_etapa1: any;
}

export function LaudoActionDialog({ open, onOpenChange, nomeCliente }: LaudoActionDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modo, setModo] = useState<"novo" | "retificar" | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [laudosCliente, setLaudosCliente] = useState<LaudoExistente[]>([]);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>("");
  const [selectedLaudo, setSelectedLaudo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      // Get org members
      const { data: membro } = await supabase
        .from("membros")
        .select("organizacao_id, papel")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membro) return;
      setOrgId(membro.organizacao_id);

      const { data: membros } = await supabase
        .from("membros")
        .select("user_id, papel")
        .eq("organizacao_id", membro.organizacao_id);

      if (membros) {
        const enriched = await Promise.all(
          membros.map(async (m) => {
            const { data: profile } = await supabase
              .from("profiles_publico")
              .select("nome")
              .eq("id", m.user_id)
              .maybeSingle();
            return { ...m, nome: profile?.nome || null } as OrgMember;
          })
        );
        setMembers(enriched);

        // Pre-select first engenheiro_agronomo or agronomo
        const agronomo = enriched.find(
          (m) => m.papel === "engenheiro_agronomo" || m.papel === "agronomo"
        );
        if (agronomo) setSelectedResponsavel(agronomo.user_id);
      }

      // Get laudos for this client
      const { data: laudos } = await supabase
        .from("laudos")
        .select("id, numero_laudo, status, dados_etapa1")
        .order("created_at", { ascending: false });

      if (laudos) {
        const filtered = laudos.filter((l) => {
          const d1 = (l.dados_etapa1 || {}) as Record<string, any>;
          const nome = (d1.nome || "").toLowerCase();
          return nome.includes(nomeCliente.toLowerCase());
        });
        setLaudosCliente(filtered);
      }
    })();
  }, [open, user, nomeCliente]);

  const handleConfirm = async () => {
    if (!modo) {
      toast.error("Selecione uma ação");
      return;
    }
    if (!selectedResponsavel) {
      toast.error("Selecione o responsável pela tarefa");
      return;
    }
    if (modo === "retificar" && !selectedLaudo) {
      toast.error("Selecione o laudo a ser retificado");
      return;
    }

    setLoading(true);
    try {
      const tituloTarefa =
        modo === "novo"
          ? `GERAR LAUDO — ${nomeCliente}`
          : `RETIFICAR LAUDO — ${nomeCliente}`;

      const descricaoTarefa =
        modo === "novo"
          ? `Elaborar laudo técnico de abusividade para o cliente ${nomeCliente}.`
          : `Retificar/atualizar o laudo existente do cliente ${nomeCliente}. Laudo: ${laudosCliente.find((l) => l.id === selectedLaudo)?.numero_laudo || ""}`;

      if (orgId) {
        await supabase.from("tarefas" as any).insert({
          organizacao_id: orgId,
          responsavel_id: selectedResponsavel,
          titulo: tituloTarefa,
          descricao: descricaoTarefa,
          data_vencimento: format(new Date(), "yyyy-MM-dd"),
          created_by: user!.id,
          prioridade: "normal",
          nome_cliente: nomeCliente,
        } as any);

        const responsavelNome = members.find((m) => m.user_id === selectedResponsavel)?.nome || "Responsável";
        toast.success(`Tarefa criada para ${responsavelNome}`);

        // Notify the assigned member
        if (selectedResponsavel !== user!.id) {
          await supabase.from("notificacoes_sistema").insert({
            user_id: selectedResponsavel,
            mensagem: `📋 Nova tarefa: ${tituloTarefa}`,
            tipo: "info",
          });
        }
      }

      onOpenChange(false);

      // Navigate to novo-laudo with client pre-filled
      if (modo === "novo") {
        navigate(`/novo-laudo?cliente=${encodeURIComponent(nomeCliente)}`);
      } else if (modo === "retificar" && selectedLaudo) {
        navigate(`/novo-laudo?laudo=${selectedLaudo}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  const papelLabel = (papel: string) => {
    const map: Record<string, string> = {
      admin: "Admin",
      agronomo: "Agrônomo",
      engenheiro_agronomo: "Eng. Agrônomo",
      advogado: "Advogado",
      estagiario_direito: "Estagiário",
      assessor_juridico: "Assessor Jurídico",
      pos_venda: "Pós-Venda",
      coordenador: "Coordenador",
    };
    return map[papel] || papel;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Gerar ou Retificar Laudo</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{nomeCliente}</span>
          </p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Action selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setModo("novo"); setSelectedLaudo(""); }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                modo === "novo"
                  ? "border-accent bg-accent/5 text-accent"
                  : "border-border hover:border-accent/30 text-muted-foreground"
              }`}
            >
              <FilePlus className="w-6 h-6" />
              <span className="text-sm font-semibold">Novo Laudo</span>
              <span className="text-[11px] text-center leading-tight">Criar laudo do zero</span>
            </button>
            <button
              onClick={() => setModo("retificar")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                modo === "retificar"
                  ? "border-accent bg-accent/5 text-accent"
                  : "border-border hover:border-accent/30 text-muted-foreground"
              }`}
            >
              <RefreshCw className="w-6 h-6" />
              <span className="text-sm font-semibold">Retificar</span>
              <span className="text-[11px] text-center leading-tight">Atualizar laudo existente</span>
            </button>
          </div>

          {/* Select existing laudo for retification */}
          {modo === "retificar" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Laudo a retificar</Label>
              {laudosCliente.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                  Nenhum laudo encontrado para este cliente. Crie um novo primeiro.
                </p>
              ) : (
                <Select value={selectedLaudo} onValueChange={setSelectedLaudo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o laudo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {laudosCliente.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.numero_laudo} — {l.status === "finalizado" ? "✅ Finalizado" : l.status === "rascunho" ? "📝 Rascunho" : l.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Responsável selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Responsável pela tarefa
            </Label>
            <Select value={selectedResponsavel} onValueChange={setSelectedResponsavel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável..." />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.nome || "Sem nome"} — {papelLabel(m.papel)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={loading || !modo || !selectedResponsavel || (modo === "retificar" && !selectedLaudo)}
            className="w-full"
          >
            {loading ? "Criando tarefa..." : "Confirmar e Criar Tarefa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}