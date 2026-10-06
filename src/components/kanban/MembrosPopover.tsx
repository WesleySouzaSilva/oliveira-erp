import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, X } from "lucide-react";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  useAllCardMembros,
  useCardMembroMutations,
} from "./hooks/useEtiquetasMembros";

function initials(nome: string | null | undefined): string {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

interface Props {
  processoId: string;
  orgId: string | null;
}

export function MembrosPopover({ processoId, orgId }: Props) {
  const { members } = useOrgMembers();
  const linksQ = useAllCardMembros(orgId);
  const mut = useCardMembroMutations(orgId);
  const [busca, setBusca] = useState("");

  const assigned = new Set(linksQ.data?.get(processoId) ?? []);
  const assignedMembers = members.filter((m) => assigned.has(m.user_id));
  const filtered = members.filter((m) =>
    (m.nome ?? "").toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex -space-x-2">
        {assignedMembers.map((m) => (
          <div
            key={m.user_id}
            className="relative group"
            title={m.nome ?? "Sem nome"}
          >
            <Avatar className="w-7 h-7 ring-2 ring-background">
              <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-semibold">
                {initials(m.nome)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => mut.remove.mutate({ processoId, userId: m.user_id })}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remover membro"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-[11px]">
            <UserPlus className="w-3 h-3 mr-1" /> Membros
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <Input
            placeholder="Buscar membro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 text-sm mb-2"
          />
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filtered.map((m) => {
              const checked = assigned.has(m.user_id);
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() =>
                    checked
                      ? mut.remove.mutate({ processoId, userId: m.user_id })
                      : mut.add.mutate({ processoId, userId: m.user_id })
                  }
                  className={`w-full text-left text-xs flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted ${
                    checked ? "bg-muted" : ""
                  }`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-semibold">
                      {initials(m.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{m.nome ?? "Sem nome"}</span>
                  <span className="text-[10px] text-muted-foreground">{m.papel}</span>
                  {checked && <span className="text-[10px] text-primary ml-1">✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2 py-1.5">
                Nenhum membro encontrado.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}