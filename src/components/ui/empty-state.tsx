import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Inbox, type LucideIcon } from "lucide-react";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary";
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: EmptyStateAction;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center mx-auto max-w-md",
        compact ? "py-8 px-4 gap-2" : "py-14 px-6 gap-3",
        className,
      )}
      role="status"
    >
      <div
        className={cn(
          "rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground",
          compact ? "w-10 h-10" : "w-14 h-14",
        )}
      >
        <Icon className={compact ? "w-5 h-5" : "w-7 h-7"} />
      </div>
      <h3
        className={cn(
          "font-serif font-semibold text-foreground",
          compact ? "text-base" : "text-lg",
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && (
        action.href ? (
          <Button asChild variant={action.variant ?? "default"} className="mt-2">
            <a href={action.href}>
              {ActionIcon && <ActionIcon className="w-4 h-4 mr-2" />}
              {action.label}
            </a>
          </Button>
        ) : (
          <Button
            variant={action.variant ?? "default"}
            onClick={action.onClick}
            className="mt-2"
          >
            {ActionIcon && <ActionIcon className="w-4 h-4 mr-2" />}
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}