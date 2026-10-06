import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalUser } from "@/hooks/usePortalUser";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { Input } from "@/components/ui/input";

type Oferta = {
  id: string;
  marca: "agro" | "juridico";
  modo: string | null;
  titulo: string;
  descricao: string | null;
  modo_contratacao: string | null;
  preco_exibido: number | null;
};

function formatBRL(v: number | null | undefined) {
  if (v === null || v === undefined) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PortalServicos() {
  const { user } = useAuth();
  const portal = usePortalUser();
  const [loading, setLoading] = useState(true);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [selected, setSelected] = useState<Oferta | null>(null);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Solicitação livre (sem oferta)
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeAssunto, setFreeAssunto] = useState("");
  const [freeDesc, setFreeDesc] = useState("");
  const [enviandoFree, setEnviandoFree] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("portal_ofertas_view")
      .select("*")
      .order("marca")
      .order("titulo");
    setOfertas((data as Oferta[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const solicitar = async () => {
    if (!selected || !portal.empresaId || !user) return;
    setEnviando(true);
    const { error } = await (supabase as any).from("pedidos_servico").insert({
      empresa_id: portal.empresaId,
      oferta_id: selected.id,
      marca: selected.marca,
      titulo: selected.titulo,
      origem: "portal",
      status: "solicitado",
      solicitado_por: user.id,
      observacao: obs.trim() || null,
    });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar o pedido", { description: error.message });
      return;
    }
    toast.success("Pedido enviado! Nossa equipe vai retornar.");
    setSelected(null);
    setObs("");
  };

  const solicitarLivre = async () => {
    if (!portal.empresaId || !user) return;
    const assunto = freeAssunto.trim();
    if (!assunto) {
      toast.error("Informe o assunto da solicitação.");
      return;
    }
    setEnviandoFree(true);
    const { error } = await (supabase as any).from("pedidos_servico").insert({
      empresa_id: portal.empresaId,
      oferta_id: null,
      marca: "geral",
      titulo: assunto,
      origem: "portal",
      status: "solicitado",
      solicitado_por: user.id,
      observacao: freeDesc.trim() || null,
    });
    setEnviandoFree(false);
    if (error) {
      toast.error("Não foi possível enviar a solicitação", { description: error.message });
      return;
    }
    toast.success("Solicitação enviada! Nossa equipe vai retornar.");
    setFreeOpen(false);
    setFreeAssunto("");
    setFreeDesc("");
  };

  return (
    <PortalLayout>
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-foreground">Serviços</h1>
        <p className="text-sm text-muted-foreground">Conheça o que oferecemos e solicite quando quiser.</p>
      </div>

      <Card className="p-4 mb-4 flex items-start justify-between gap-3 border-primary/30 bg-primary/5">
        <div className="min-w-0 flex gap-3">
          <MessageSquarePlus className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-foreground">Fazer uma solicitação</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Precisa de algo que não está no catálogo? Fale com a equipe.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setFreeOpen(true)} className="shrink-0">
          Solicitar
        </Button>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : ofertas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Em breve, mais serviços por aqui.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ofertas.map((o) => {
            const preco = o.marca === "agro" ? formatBRL(o.preco_exibido) : null;
            return (
              <Card key={o.id} className="p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{o.titulo}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[11px] capitalize">{o.marca}</Badge>
                      {o.modo && <Badge variant="outline" className="text-[11px]">{o.modo}</Badge>}
                      {o.modo_contratacao && (
                        <Badge variant="outline" className="text-[11px]">{o.modo_contratacao}</Badge>
                      )}
                    </div>
                  </div>
                  {preco && (
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">A partir de</div>
                      <div className="font-semibold text-foreground">{preco}</div>
                    </div>
                  )}
                </div>
                {o.descricao && (
                  <p className="text-sm text-muted-foreground mt-3 flex-1">{o.descricao}</p>
                )}
                <div className="mt-4">
                  <Button size="sm" className="w-full" onClick={() => setSelected(o)}>
                    {o.marca === "juridico" ? "Falar com a equipe" : "Solicitar"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) { setSelected(null); setObs(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.titulo}</DialogTitle>
            <DialogDescription>
              Envie o pedido para nossa equipe. Vamos retornar em breve para conversar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-foreground">Observação (opcional)</label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Conte um pouco do contexto ou dúvida..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={enviando}>Cancelar</Button>
            <Button onClick={solicitar} disabled={enviando}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={freeOpen} onOpenChange={(v) => { if (!v) { setFreeOpen(false); setFreeAssunto(""); setFreeDesc(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fazer uma solicitação</DialogTitle>
            <DialogDescription>
              Conte pra gente o que você precisa. Nossa equipe vai retornar em breve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground">Assunto</label>
              <Input
                value={freeAssunto}
                onChange={(e) => setFreeAssunto(e.target.value)}
                placeholder="Ex.: Solicitar informações sobre..."
                maxLength={140}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground">Descrição (opcional)</label>
              <Textarea
                value={freeDesc}
                onChange={(e) => setFreeDesc(e.target.value)}
                placeholder="Detalhe o contexto ou a dúvida..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFreeOpen(false)} disabled={enviandoFree}>Cancelar</Button>
            <Button onClick={solicitarLivre} disabled={enviandoFree || !freeAssunto.trim()}>
              {enviandoFree && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}