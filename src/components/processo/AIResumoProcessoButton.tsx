import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Botão que pede à Olívia um resumo executivo do processo:
 * onde está, o que falta, próximo passo. Reutiliza a edge `assistente-ia`.
 */
export function AIResumoProcessoButton({
  processoId, contextoTexto,
}: { processoId: string; contextoTexto: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<string>("");

  async function gerar() {
    setLoading(true);
    setResumo("");
    try {
      const prompt = `Você é a Olívia, assistente do escritório. Gere um RESUMO EXECUTIVO (5–8 bullets) do processo abaixo, em português, cobrindo:
1) Onde o processo está agora (fase + última movimentação)
2) O que já foi feito
3) O que falta / próximo passo concreto
4) Riscos ou prazos críticos visíveis

Seja direto, sem floreios. Use bullets curtos.

CONTEXTO:
${contextoTexto.slice(0, 6000)}`;

      const { data, error } = await supabase.functions.invoke("assistente-ia", {
        body: { mensagem: prompt, contexto: { processoId } },
      });
      if (error) throw error;
      setResumo(data?.resposta || data?.message || "Sem resposta.");
    } catch (e: any) {
      toast.error("Não foi possível gerar o resumo", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => { setOpen(true); if (!resumo) gerar(); }}
        className="gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Resumir com Olívia
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Resumo executivo do processo
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> A Olívia está analisando…
            </div>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
              {resumo || "—"}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={gerar} disabled={loading}>
              Regerar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AIResumoProcessoButton;