import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // PRIMÁRIO: dourado/accent (identidade Oliveira) — texto verde profundo p/ contraste forte
        default:
          "bg-accent text-primary shadow-sm hover:bg-accent/90 hover:shadow-md disabled:shadow-none",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        // SECUNDÁRIO: verde-floresta contornado (ação de apoio)
        secondary:
          "border border-primary/40 text-primary bg-background hover:bg-primary/5 hover:border-primary",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Alias retrocompatível — mesmo estilo do default dourado
        premium:
          "bg-accent text-primary shadow-sm hover:bg-accent/90 hover:shadow-md disabled:shadow-none",
        // Alias retrocompatível — mesmo estilo do secondary verde contornado
        "outline-green":
          "border border-primary/40 text-primary bg-background hover:bg-primary/5 hover:border-primary",
        // Verde sólido (antigo default) — usar quando precisar de CTA em verde
        "solid-green":
          "bg-primary text-primary-foreground hover:bg-primary/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-md px-10 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
