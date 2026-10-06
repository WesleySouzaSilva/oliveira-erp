import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus, X, Settings2 } from "lucide-react";
import {
  useEtiquetas,
  useEtiquetaMutations,
  useAllCardEtiquetas,
  useCardEtiquetaMutations,
} from "./hooks/useEtiquetasMembros";
import { ETIQUETA_CORES, LabelManagerDialog } from "./LabelManagerDialog";

interface Props {
  processoId: string;
  orgId: string | null;
}

export function EtiquetasPopover({ processoId, orgId }: Props) {
  const cat = useEtiquetas(orgId);
  const linksQ = useAllCardEtiquetas(orgId);
  const linkMut = useCardEtiquetaMutations(orgId);
  const etMut = useEtiquetaMutations(orgId);
  const [busca, setBusca] = useState("");
  const [openMgr, setOpenMgr] = useState(false);

  const aplicados = new Set(linksQ.data?.get(processoId) ?? []);
  const disponiveis = (cat.data ?? []).filter((e) =>
    e.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  const criarRapido = async () => {
    const nome = busca.trim();
    if (!nome) return;
    await etMut.create.mutateAsync({ nome, cor: ETIQUETA_CORES[0].value, categoria: "livre" });
    setBusca("");
  };

  const aplicadosArr = (cat.data ?? []).filter((e) => aplicados.has(e.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {aplicadosArr.map((et) => (
          <span
            key={et.id}
            className={`text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${et.cor}`}
          >
            {et.nome}
            <button
              onClick={() => linkMut.remove.mutate({ processoId, etiquetaId: et.id })}
              aria-label="Remover etiqueta"
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-[11px]">
              <Tag className="w-3 h-3 mr-1" /> Etiquetas
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2">
            <Input
              placeholder="Buscar ou criar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 text-sm mb-2"
            />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {disponiveis.map((et) => {
                const checked = aplicados.has(et.id);
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() =>
                      checked
                        ? linkMut.remove.mutate({ processoId, etiquetaId: et.id })
                        : linkMut.add.mutate({ processoId, etiquetaId: et.id })
                    }
                    className={`w-full text-left text-xs flex items-center gap-2 px-2 py-1 rounded hover:bg-muted ${
                      checked ? "bg-muted" : ""
                    }`}
                  >
                    <span className={`flex-1 px-2 py-0.5 rounded border ${et.cor}`}>
                      {et.nome}
                    </span>
                    {checked && <span className="text-[10px] text-primary">✓</span>}
                  </button>
                );
              })}
              {disponiveis.length === 0 && busca && (
                <button
                  onClick={criarRapido}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> Criar "{busca}"
                </button>
              )}
              {disponiveis.length === 0 && !busca && (
                <p className="text-[11px] text-muted-foreground px-2 py-1.5">
                  Nenhuma etiqueta criada ainda.
                </p>
              )}
            </div>
            <div className="border-t border-border mt-2 pt-2">
              <button
                onClick={() => setOpenMgr(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Settings2 className="w-3 h-3" /> Gerenciar etiquetas
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <LabelManagerDialog open={openMgr} onOpenChange={setOpenMgr} orgId={orgId} />
    </div>
  );
}