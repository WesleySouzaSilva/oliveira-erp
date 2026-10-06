import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Campo de texto em markdown com prévia lado a lado. */
export default function EditorMarkdown({
  valor, onChange, rows = 10, ariaLabel = "Conteúdo em markdown",
}: { valor: string; onChange: (v: string) => void; rows?: number; ariaLabel?: string }) {
  const [previa, setPrevia] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={previa ? "outline" : "secondary"} onClick={() => setPrevia(false)}>Escrever</Button>
        <Button type="button" size="sm" variant={previa ? "secondary" : "outline"} onClick={() => setPrevia(true)}>Prévia</Button>
      </div>
      {previa ? (
        <div className="prose prose-sm max-w-none rounded-md border border-input p-3 min-h-[180px]">
          {valor.trim() ? <ReactMarkdown>{valor}</ReactMarkdown> : <p className="text-muted-foreground">Nada escrito ainda.</p>}
        </div>
      ) : (
        <Textarea aria-label={ariaLabel} rows={rows} value={valor} onChange={(e) => onChange(e.target.value)}
          placeholder={"Use markdown: **negrito**, *itálico*, listas com - e títulos com ##."} />
      )}
    </div>
  );
}
