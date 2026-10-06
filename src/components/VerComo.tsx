import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useIsCeoReal } from "@/hooks/useIsCeo";
import { setVerComo, useVerComo } from "@/lib/verComo";

/** Só admin e CEO REAIS (ignora o próprio modo) podem usar o "ver como". */
export function usePodeVerComo() {
  const { isAdmin } = useOrgMembers();
  const { isCeo } = useIsCeoReal();
  return isAdmin || isCeo;
}

/** Entra no modo: registra na auditoria ANTES de ativar (depois nada mais grava). */
export async function entrarVerComo(user_id: string, nome: string) {
  const { data, error } = await (supabase as any).rpc("ver_como_registrar", { _alvo: user_id });
  if (error || data !== true) { toast.error("Não foi possível entrar no modo ver como."); return false; }
  setVerComo({ user_id, nome });
  return true;
}

/** Controle discreto no cabeçalho. */
export function VerComoControle() {
  const pode = usePodeVerComo();
  const { user } = useAuth();
  const { members } = useOrgMembers();
  const alvo = useVerComo();
  const [aberto, setAberto] = useState(false);
  if (!pode || alvo) return null;
  const lista = members.filter((m) => m.user_id !== user?.id).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label="Ver o app como outra pessoa">
          <Eye className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Ver como</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-64">
        <Command>
          <CommandInput placeholder="Buscar pessoa" />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup heading="Somente leitura">
              {lista.map((m) => (
                <CommandItem key={m.user_id} value={`${m.nome || ""} ${m.user_id}`}
                  onSelect={async () => { setAberto(false); await entrarVerComo(m.user_id, m.nome || "Membro"); }}>
                  {m.nome || "Membro"}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Tarja fixa no topo enquanto o modo está ativo. */
export function VerComoTarja() {
  const alvo = useVerComo();
  if (!alvo) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-3 bg-accent text-accent-foreground px-4 py-2 text-sm font-medium">
      <Eye className="w-4 h-4" />
      <span>Vendo como {alvo.nome}. Somente leitura.</span>
      <Button size="sm" variant="outline" className="h-7" onClick={() => setVerComo(null)}>
        <EyeOff className="w-3.5 h-3.5 mr-1" />Sair desse modo
      </Button>
    </div>
  );
}
