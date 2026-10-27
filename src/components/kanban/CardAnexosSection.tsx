import { CaixaAnexo } from "@/components/ui/CaixaAnexo";
import { FileText, Download, Trash2 } from "lucide-react";
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

  return (
    <div className="space-y-2">
      {/* Anexar por clique OU arrastar (OE-13); o envio já era um por vez. */}
      <CaixaAnexo
        arquivos={[]}
        desabilitado={m.upload.isPending}
        onAdicionar={(novos) => novos.forEach((arquivo) => m.upload.mutate(arquivo))}
        rotulo={
          <p className="text-sm font-medium text-foreground">
            {m.upload.isPending
              ? "Enviando..."
              : "Arraste os arquivos aqui ou clique para selecionar"}
          </p>
        }
      />
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

    </div>
  );
}