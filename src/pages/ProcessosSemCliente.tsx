import { useEffect, useMemo, useState } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Link2, ExternalLink, Users } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ProcessoLinha = {
  id: string;
  nomeInferido: string;
  cpfInferido: string | null;
  banco: string | null;
  faseAtual: string;
  sugestao: { id: string; nome: string; cpf_cnpj?: string | null } | null;
};

/**
 * Backlog para vincular processos sem cliente. NUNCA vincula em massa por nome —
 * o usuário sempre confirma cada linha antes do UPDATE.
 */
export default function ProcessosSemCliente() {
  const { orgId } = useOrgMembers();
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<ProcessoLinha[]>([]);
  const [pending, setPending] = useState<ProcessoLinha | null>(null);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data: procs } = await lerTudo(() => supabase
      .from("processos")
      .select("id, fase_atual, laudo_id, laudos(dados_etapa1)")
      .is("cliente_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }));

    const base: ProcessoLinha[] = (procs || []).map((p: any) => {
      const e1 = (p.laudos?.dados_etapa1 || {}) as Record<string, any>;
      const nome = e1.produtor || e1.nome || "Sem nome";
      const cpf = (e1.cpf || "").toString().replace(/\D/g, "") || null;
      return {
        id: p.id,
        nomeInferido: nome,
        cpfInferido: cpf,
        banco: e1.banco || null,
        faseAtual: String(p.fase_atual),
        sugestao: null,
      };
    });

    // Buscar sugestões em lote por nome (dica visual apenas)
    const nomesUnicos = Array.from(new Set(base.map(l => l.nomeInferido).filter(n => n && n !== "Sem nome")));
    if (nomesUnicos.length > 0) {
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, cpf_cnpj")
        .is("deleted_at", null)
        .in("nome", nomesUnicos);
      const map = new Map<string, { id: string; nome: string; cpf_cnpj: string | null }>();
      (clientes || []).forEach((c: any) => {
        if (!map.has(c.nome)) map.set(c.nome, c);
      });
      base.forEach(l => {
        const s = map.get(l.nomeInferido);
        if (s) l.sugestao = s;
      });
    }

    setLinhas(base);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const totalComSugestao = useMemo(() => linhas.filter(l => l.sugestao).length, [linhas]);

  const confirmarVinculo = async (linha: ProcessoLinha) => {
    if (!linha.sugestao) return;
    const { error } = await supabase
      .from("processos")
      .update({ cliente_id: linha.sugestao.id })
      .eq("id", linha.id);
    if (error) { toast.error("Erro ao vincular"); return; }
    toast.success(`Vinculado a ${linha.sugestao.nome}`);
    setPending(null);
    setLinhas(prev => prev.filter(l => l.id !== linha.id));
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-accent" /> Processos sem cliente vinculado
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vincule cada processo ao seu cliente para liberar o Portal. Sugestões por nome são apenas dicas —
          nada é vinculado sem confirmação humana.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Badge variant="outline">{linhas.length} pendente(s)</Badge>
        <Badge variant="secondary">{totalComSugestao} com sugestão</Badge>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Check className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">Tudo vinculado!</p>
          <p className="text-xs text-muted-foreground mt-1">Nenhum processo sem cliente por aqui.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Nome no processo</th>
                <th className="p-3">Banco</th>
                <th className="p-3">Fase</th>
                <th className="p-3">Sugestão de cliente</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map(l => (
                <tr key={l.id} className="hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-medium text-foreground">{l.nomeInferido}</p>
                    {l.cpfInferido && <p className="text-[11px] text-muted-foreground">{l.cpfInferido}</p>}
                  </td>
                  <td className="p-3 text-muted-foreground">{l.banco || "—"}</td>
                  <td className="p-3"><Badge variant="outline">Fase {l.faseAtual}</Badge></td>
                  <td className="p-3">
                    {l.sugestao ? (
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{l.sugestao.nome}</span>
                        <Badge variant="secondary" className="text-[9px]">provável</Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">— nenhuma —</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      {l.sugestao && (
                        <Button size="sm" variant="outline" onClick={() => setPending(l)}>
                          <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/processos/${l.id}`}>
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Confirmar vínculo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vincular o processo de <strong>{pending?.nomeInferido}</strong> ao cliente{" "}
              <strong>{pending?.sugestao?.nome}</strong>?
              <br />
              Isso libera o processo no Portal desse cliente (se ele tiver acesso).
              Se preferir escolher outro cliente, cancele e abra o processo para usar o seletor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && confirmarVinculo(pending)}>
              <Check className="w-4 h-4 mr-1" /> Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}