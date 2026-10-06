import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-card-hover group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-accent group-[.toast]:text-accent-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-success",
          error: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-destructive",
          warning: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-accent",
          info: "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
