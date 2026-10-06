import { forwardRef, useRef, useImperativeHandle, TextareaHTMLAttributes } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  onValueChange: (v: string) => void;
  toolbarClassName?: string;
};

export const RichTextarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ value, onValueChange, className, toolbarClassName, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const wrap = (left: string, right: string = left) => {
      const el = innerRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const selected = value.slice(start, end) || "texto";
      const next = value.slice(0, start) + left + selected + right + value.slice(end);
      onValueChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const newStart = start + left.length;
        const newEnd = newStart + selected.length;
        el.setSelectionRange(newStart, newEnd);
      });
    };

    const btn = "h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors";

    return (
      <div className="space-y-1">
        <div className={cn("flex items-center gap-0.5 px-1 py-1 border border-input border-b-0 rounded-t-md bg-muted/30", toolbarClassName)}>
          <button type="button" onClick={() => wrap("**")} className={btn} title="Negrito (Ctrl+B)">
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => wrap("*")} className={btn} title="Itálico (Ctrl+I)">
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => wrap("__")} className={btn} title="Sublinhado (Ctrl+U)">
            <Underline className="w-3.5 h-3.5" />
          </button>
        </div>
        <Textarea
          ref={innerRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
              const k = e.key.toLowerCase();
              if (k === "b") { e.preventDefault(); wrap("**"); return; }
              if (k === "i") { e.preventDefault(); wrap("*"); return; }
              if (k === "u") { e.preventDefault(); wrap("__"); return; }
            }
            rest.onKeyDown?.(e);
          }}
          className={cn("rounded-t-none -mt-1", className)}
          {...rest}
        />
      </div>
    );
  }
);
RichTextarea.displayName = "RichTextarea";

// Renderiza markdown simples: **negrito**, *itálico*, __sublinhado__
// Mantém quebras de linha e escapa HTML.
export function renderRichText(text: string): string {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<u>$1</u>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn("whitespace-pre-wrap", className)}
      dangerouslySetInnerHTML={{ __html: renderRichText(text) }}
    />
  );
}