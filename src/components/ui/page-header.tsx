import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PageHeaderCrumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  breadcrumb?: PageHeaderCrumb[];
  actions?: React.ReactNode;
  backTo?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  breadcrumb,
  actions,
  backTo,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 pb-4 border-b border-border/60",
        className,
      )}
    >
      {(breadcrumb && breadcrumb.length > 0) || backTo ? (
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          {backTo && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 -ml-2 px-2 text-muted-foreground hover:text-foreground"
            >
              <Link to={backTo} aria-label="Voltar">
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </Button>
          )}
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="breadcrumb">
              <ol className="flex flex-wrap items-center gap-1">
                {breadcrumb.map((c, i) => {
                  const isLast = i === breadcrumb.length - 1;
                  return (
                    <li key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="w-3 h-3 opacity-50" />}
                      {c.to && !isLast ? (
                        <Link
                          to={c.to}
                          className="hover:text-foreground transition-colors truncate max-w-[180px]"
                        >
                          {c.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "truncate max-w-[420px] sm:max-w-[560px]",
                            isLast && "text-foreground font-medium",
                          )}
                          aria-current={isLast ? "page" : undefined}
                        >
                          {c.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {Icon && (
            <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-lg bg-accent/15 text-accent items-center justify-center mt-0.5">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-foreground leading-tight tracking-tight break-words">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
}

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Optional container that applies a consistent rhythm/spacing.
 * Use inside <AppLayout> when you want extra vertical rhythm between sections.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}