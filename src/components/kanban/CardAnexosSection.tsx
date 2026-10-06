import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAnexos, useAnexoMutations } from "./hooks/useCardSocial";
import { useConfirm } from "@/components/ui/confirm-dialog";

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  processoId: string;
  orgId: string | null;
}

export function CardAnexosSection({ processoId, orgId }: Props) {
  const { user } = useAuth();
  const askConfirm = useConfirm();
  const q = useAnexos(processoId);
  const m = useAnexoMutations(processoId, orgId);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = () => inputRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await m.upload.mutateAsync(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" className="hidden" onChange={onFile} />
      <ul className="space-y-1.5">
        {q.data?.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
        )}
        {q.data?.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background"
          >
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{a.nome_arquivo}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatSize(a.tamanho_bytes)} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <button
              onClick={() => m.download(a)}
              className="text-muted-foreground hover:text-primary"
              aria-label="Baixar"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                if (await askConfirm({ title: "Excluir anexo", description: "Excluir este anexo?", destructive: true, confirmText: "Excluir" })) {
                  m.remove.mutate(a);
                }
              }}
              className="text-muted-foreground/60 hover:text-destructive"
              aria-label="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="outline"
        onClick={onPick}
        disabled={m.upload.isPending}
        className="h-7 text-[11px]"
      >
        <Upload className="w-3 h-3 mr-1" />
        {m.upload.isPending ? "Enviando..." : "Adicionar anexo"}
      </Button>
    </div>
  );
}