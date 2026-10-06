import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified page-level loader. Use instead of ad-hoc spinners.
 */
export function PageLoader({ label = "Carregando...", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-20", className)}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl animate-pulse" />
        <Loader2 className="relative w-8 h-8 text-accent animate-spin" />
      </div>
      {label && <p className="text-xs text-muted-foreground tracking-wide uppercase">{label}</p>}
    </div>
  );
}

/**
 * Inline loader for sections/cards.
 */
export function InlineLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <Loader2 className="w-5 h-5 text-accent animate-spin" />
    </div>
  );
}

/**
 * Skeleton row for list pages (mimics card layout).
 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-lg border border-border p-5 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted/70 rounded w-1/2" />
            </div>
            <div className="h-6 w-20 bg-muted rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}