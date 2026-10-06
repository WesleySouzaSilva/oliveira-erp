import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface LoadMoreButtonProps {
  shownCount: number;
  totalCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
  label?: string;
}

export function LoadMoreButton({
  shownCount,
  totalCount,
  hasMore,
  onLoadMore,
  label = "registros",
}: LoadMoreButtonProps) {
  if (!hasMore) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-6 pb-2">
      <p className="text-xs text-muted-foreground">
        Exibindo {shownCount} de {totalCount} {label}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        className="gap-2"
      >
        <ChevronDown className="w-4 h-4" />
        Carregar mais
      </Button>
    </div>
  );
}
