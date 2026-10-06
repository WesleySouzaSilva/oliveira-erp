import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useCriarConversa } from "@/hooks/useConversas";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contexto?: { cliente_id?: string | null; laudo_id?: string | null; processo_id?: string | null; nomeCliente?: string };
  onCreated?: (conversaId: string) => void;
}

export function NovaConversaDialog({ open, onOpenChange, contexto, onCreated }: Props) {
  const { user } = useAuth();
  const { members, orgId } = useOrgMembers();
  const { criarConversa } = useCriarConversa();
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const outros = useMemo(
    () => (members || []).filter((m) => m.user_id !== user?.id),
    [members, user?.id]
  );
  const filtrados = outros.filter((m) =>
    (m.nome || "").toLowerCase().includes(busca.toLowerCase())
  );

  const toggle = (uid: string) => {
    setSelecionados((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));
  };

  const handleCriar = async () => {
    if (!orgId || selecionados.length === 0) return;
    setSalvando(true);
    try {
      const tipo = selecionados.length > 1 ? "grupo" : "direta";
      const tituloFinal = tipo === "grupo"
        ? (titulo.trim() || (contexto?.nomeCliente ? `Equipe — ${contexto.nomeCliente}` : "Conversa em grupo"))
        : null;
      const id = await criarConversa({
        organizacao_id: orgId,
        tipo,
        titulo: tituloFinal || undefined,
        membrosUserIds: selecionados,
        cliente_id: contexto?.cliente_id ?? null,
        laudo_id: contexto?.laudo_id ?? null,
        processo_id: contexto?.processo_id ?? null,
      });
      toast.success("Conversa criada");
      onCreated?.(id);
      onOpenChange(false);
      setSelecionados([]);
      setTitulo("");
      setBusca("");
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar conversa");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {contexto?.nomeCliente && (
            <p className="text-xs text-muted-foreground">Vinculada ao cliente: <span className="font-medium text-foreground">{contexto.nomeCliente}</span></p>
          )}
          {selecionados.length > 1 && (
            <Input
              placeholder="Nome do grupo (opcional)"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          )}
          <Input placeholder="Buscar membro..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
            {filtrados.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">Nenhum membro encontrado.</p>
            )}
            {filtrados.map((m) => (
              <label key={m.user_id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={selecionados.includes(m.user_id)}
                  onCheckedChange={() => toggle(m.user_id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.nome || "Membro"}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.papel}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleCriar} disabled={salvando || selecionados.length === 0}>
            {salvando ? "Criando..." : `Criar ${selecionados.length > 1 ? "grupo" : "conversa"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}