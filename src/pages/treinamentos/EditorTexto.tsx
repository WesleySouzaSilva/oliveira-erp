import { useEffect, useRef } from "react";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/treinamentos";

/** Editor de texto formatado simples (negrito, itálico, listas, títulos e links). */
export default function EditorTexto({ valor, onChange }: { valor: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== valor) ref.current.innerHTML = sanitizeHtml(valor); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); ref.current?.focus(); onChange(sanitizeHtml(ref.current?.innerHTML || "")); };
  const botoes = [
    { i: Bold, l: "Negrito", f: () => cmd("bold") },
    { i: Italic, l: "Itálico", f: () => cmd("italic") },
    { i: Underline, l: "Sublinhado", f: () => cmd("underline") },
    { i: Heading2, l: "Título", f: () => cmd("formatBlock", "h3") },
    { i: List, l: "Lista", f: () => cmd("insertUnorderedList") },
    { i: ListOrdered, l: "Lista numerada", f: () => cmd("insertOrderedList") },
    { i: Link2, l: "Link", f: () => { const u = prompt("Endereço do link (https://...)"); if (u && /^https?:\/\//.test(u)) cmd("createLink", u); } },
  ];
  return (
    <div className="rounded-md border border-input">
      <div className="flex gap-1 border-b border-input p-1">
        {botoes.map(({ i: I, l, f }) => (
          <Button key={l} type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={l} title={l} onMouseDown={(e) => { e.preventDefault(); f(); }}>
            <I className="w-4 h-4" />
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Conteúdo da aula"
        className="prose prose-sm max-w-none min-h-[180px] p-3 focus:outline-none"
        onInput={() => onChange(sanitizeHtml(ref.current?.innerHTML || ""))}
      />
    </div>
  );
}
