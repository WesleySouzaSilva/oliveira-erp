import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, Download, ExternalLink } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface Props {
  /** Dados binários do PDF (evita problemas de CORS/iframe) */
  data: Uint8Array | null;
  /** URL assinada, usada para abrir/baixar em nova aba */
  href?: string | null;
  nome?: string;
  onDownload?: () => void;
}

export default function PdfViewer({ data, href, nome, onDownload }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [fullscreen, setFullscreen] = useState(false);
  const [width, setWidth] = useState(800);
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<{ data: Uint8Array } | null>(null);

  useEffect(() => {
    setFile(data ? { data: new Uint8Array(data) } : null);
    setPage(1);
  }, [data]);

  useEffect(() => {
    const measure = () => {
      const w = containerRef.current?.clientWidth;
      if (w) setWidth(Math.min(w - 32, 1100));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [fullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreen((f) => !f); // fallback: modo "tela cheia" via CSS
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!fullscreen) return;
      if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, numPages));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 1));
      if (e.key === "Escape" && !document.fullscreenElement) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, numPages]);

  const btn =
    "p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors";

  return (
    <div
      ref={wrapRef}
      className={
        fullscreen
          ? "fixed inset-0 z-[100] bg-background flex flex-col"
          : "rounded-lg border border-border overflow-hidden bg-background flex flex-col"
      }
    >
      <div className="px-3 py-2 bg-secondary border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-muted-foreground truncate flex-1 min-w-0">{nome}</span>

        <div className="flex items-center gap-0.5">
          <button className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Página anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-muted-foreground tabular-nums px-1">
            {numPages ? `${page}/${numPages}` : "—"}
          </span>
          <button className={btn} onClick={() => setPage((p) => Math.min(numPages, p + 1))} disabled={page >= numPages} aria-label="Próxima página">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button className={btn} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))} aria-label="Diminuir zoom">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            className="text-[11px] text-muted-foreground tabular-nums px-1 hover:text-primary"
            onClick={() => setScale(1.2)}
            aria-label="Restaurar zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button className={btn} onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))} aria-label="Aumentar zoom">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {onDownload && (
          <button className={btn} onClick={onDownload} aria-label="Baixar">
            <Download className="w-4 h-4" />
          </button>
        )}
        {href && (
          <a className={btn} href={href} target="_blank" rel="noreferrer" aria-label="Abrir em nova aba">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button className={btn} onClick={toggleFullscreen} aria-label="Tela cheia">
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      <div
        ref={containerRef}
        className={`overflow-auto bg-muted/40 flex justify-center p-4 ${fullscreen ? "flex-1" : "h-[70vh]"}`}
      >
        {file ? (
          <Document
            file={file}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<p className="text-sm text-muted-foreground py-10">Carregando PDF…</p>}
            error={<p className="text-sm text-muted-foreground py-10">Não foi possível renderizar este PDF.</p>}
          >
            <Page
              pageNumber={page}
              width={width}
              scale={scale}
              renderAnnotationLayer
              renderTextLayer
              className="shadow-card"
            />
          </Document>
        ) : (
          <p className="text-sm text-muted-foreground py-10">Carregando PDF…</p>
        )}
      </div>
    </div>
  );
}
