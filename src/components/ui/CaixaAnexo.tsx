import { useRef, useState, type ReactNode } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarTamanho } from "@/lib/formatarTamanho";

/**
 * Caixa de anexo única do ERP: aceita CLIQUE (abre o seletor de arquivos) OU
 * ARRASTAR o arquivo até aqui — as duas opções em todo lugar que chama anexo.
 *
 * Só cuida da captura (clique/arrastar) e da fila de selecionados; o envio
 * continua sendo da tela (endpoint, estado e botão de salvar não mudam).
 * O bloco onDragOver/onDragLeave/onDrop é o mesmo que já existia em
 * FaseContent e ClienteDrive, agora em um lugar só.
 *
 * Três formas de usar:
 * - só captura (`onAdicionar`): a tela envia na hora e não guarda fila;
 * - fila controlada (`arquivos` + `onAdicionar`/`onRemover`): a tela decide o envio;
 * - só controlada (`arquivos` + `onArquivosChange`): adicionar/remover devolve a fila.
 *
 * Telas de arquivo único passam `multiple={false}` e leem o resultado em
 * `onArquivosChange` (a fila vem com no máximo 1 item).
 */
export interface CaixaAnexoProps {
  /** Fila de arquivos já escolhidos — guardada pela tela, só desenhada aqui. */
  arquivos?: File[];
  /** Chamado com os arquivos novos, vindos do clique ou do arrastar. */
  onAdicionar?: (novos: File[]) => void;
  /** Remove pelo índice da fila (habilita o X de cada item da lista). */
  onRemover?: (indice: number) => void;
  /** Atalho: devolve a fila inteira depois de adicionar/remover. */
  onArquivosChange?: (arquivos: File[]) => void;
  /** Atributo `accept` do input (clique); o arrastar deixa a tela validar. */
  accept?: string;
  /** Padrão true. Com false, só o primeiro arquivo escolhido é entregue. */
  multiple?: boolean;
  /** Conteúdo custom do corpo da área (título, texto, botões). */
  rotulo?: ReactNode;
  /** Sinônimo de `rotulo`, para quem prefere children. */
  children?: ReactNode;
  /** Desliga clique e arrastar (durante envio, por exemplo). */
  desabilitado?: boolean;
  /** Versão de rodapé de conversa: área mais baixa e itens em linha (chips). */
  compacta?: boolean;
  /** Some com o ícone de upload padrão quando a tela desenha o seu (ex.: câmera). */
  icone?: boolean;
  /** `id` do input interno — permite um `<label htmlFor>` da tela apontar para ele. */
  id?: string;
  className?: string;
}

export function CaixaAnexo({
  arquivos = [],
  onAdicionar,
  onRemover,
  onArquivosChange,
  accept,
  multiple = true,
  rotulo,
  children,
  desabilitado = false,
  compacta = false,
  icone = true,
  id,
  className,
}: CaixaAnexoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  const entregar = (selecionados: Array<File | null | undefined>) => {
    if (desabilitado) return;
    const novos = selecionados.filter((f): f is File => !!f);
    const entrega = multiple ? novos : novos.slice(0, 1);
    if (!entrega.length) return;
    // sem callback de captura, a fila controlada recebe os novos direto
    if (onAdicionar) onAdicionar(entrega);
    else if (onArquivosChange) onArquivosChange([...arquivos, ...entrega]);
  };

  const abrir = () => {
    if (!desabilitado) inputRef.current?.click();
  };

  const remover = (indice: number) => {
    onRemover?.(indice);
    if (onArquivosChange) onArquivosChange(arquivos.filter((_, pos) => pos !== indice));
  };

  const podeRemover = !!onRemover || !!onArquivosChange;

  return (
    <div className={className}>
      <div
        data-caixa-anexo=""
        onClick={abrir}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            abrir();
          }
        }}
        onDragOver={(evento) => {
          if (desabilitado) return;
          evento.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setArrastando(false);
          entregar(Array.from(evento.dataTransfer?.files ?? []));
        }}
        role="button"
        tabIndex={desabilitado ? -1 : 0}
        aria-disabled={desabilitado || undefined}
        className={cn(
          "border-2 border-dashed rounded-xl text-center transition-all cursor-pointer",
          compacta ? "p-3" : "p-6",
          arrastando ? "border-accent bg-accent/5" : "border-border hover:border-accent/50",
          desabilitado && "opacity-50 cursor-not-allowed",
        )}
      >
        {icone && (
          <Upload
            className={cn(
              "w-8 h-8 mx-auto mb-2",
              arrastando ? "text-accent" : "text-muted-foreground",
            )}
          />
        )}
        {rotulo ?? children ?? (
          <p className="text-sm font-medium text-foreground">
            Arraste os arquivos aqui ou clique para selecionar
          </p>
        )}
      </div>

      {arquivos.length > 0 && (
        <ul className={compacta ? "mt-2 flex flex-wrap gap-1.5" : "mt-2 space-y-1"}>
          {arquivos.map((arquivo, indice) => (
            <li
              key={`${arquivo.name}-${indice}`}
              className={
                compacta
                  ? "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px]"
                  : "flex items-center justify-between gap-2 rounded-md bg-secondary/60 px-2 py-1 text-xs"
              }
            >
              <span className="truncate inline-flex items-center gap-1.5">
                <Paperclip className="w-3 h-3 shrink-0" />
                {arquivo.name}
                <span className="text-muted-foreground">({formatarTamanho(arquivo.size)})</span>
              </span>
              {podeRemover && (
                <button
                  type="button"
                  aria-label={`Remover ${arquivo.name}`}
                  onClick={() => remover(indice)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(evento) => {
          entregar(Array.from(evento.target.files ?? []));
          evento.target.value = "";
        }}
      />
    </div>
  );
}
