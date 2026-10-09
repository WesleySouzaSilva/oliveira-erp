import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listarClientes, type Cliente } from "@/lib/api/clientes";

/** Cliente escolhido na busca: com id quando veio da base, so o nome se for digitado. */
export interface ClienteEscolhido {
  id?: string;
  nome: string;
}

/**
 * Busca de cliente para o form de nova tarefa — no lugar do "txt cliente" livre.
 *
 * O que a pessoa digita dispara uma consulta em `GET /clientes?nome=` (com debounce de
 * 300 ms, mesmo padrao da lista de Clientes); escolher na lista traz o cliente da base
 * com o id. Continua opcional: tecla Enter sem escolher (ou limpar) grava o nome como
 * texto puro — ai a tarefa nao fica vinculada a nenhum cadastro.
 *
 * O componente guarda o proprio texto; o pai so recebe o resultado. `key` no chamador
 * faz ele renascer a cada abertura do dialog, assim o prefill (vindo da lista de
 * Clientes) tem onde ser aplicado.
 */
export function ClienteBusca({
  id, inicial, onChange,
}: {
  id: string;
  /** Prefill quando a tarefa nasce ja com um cliente (botao "Nova tarefa" do cliente). */
  inicial?: ClienteEscolhido | null;
  onChange: (cliente: ClienteEscolhido | null) => void;
}) {
  const [texto, setTexto] = useState(inicial?.nome ?? "");
  const [opcoes, setOpcoes] = useState<Cliente[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const busca = useRef<number | null>(null);

  useEffect(() => {
    if (busca.current) window.clearTimeout(busca.current);
    const termo = texto.trim();
    if (termo.length < 1) {
      setOpcoes([]);
      return;
    }
    busca.current = window.setTimeout(() => {
      setCarregando(true);
      listarClientes({ nome: termo, size: 8 })
        .then((pagina) => setOpcoes(pagina.content))
        .catch(() => setOpcoes([]))
        .finally(() => setCarregando(false));
    }, 300);
    return () => {
      if (busca.current) window.clearTimeout(busca.current);
    };
  }, [texto]);

  const escolher = (cliente: Cliente) => {
    setTexto(cliente.nome);
    setAberto(false);
    setOpcoes([]);
    onChange({ id: cliente.id, nome: cliente.nome });
  };

  const limpar = () => {
    setTexto("");
    setOpcoes([]);
    setAberto(false);
    onChange(null);
  };

  /** Enter: se achar igualzinho na base, usa o cliente dela; senao, nome digitado. */
  const confirmarDigitado = () => {
    const termo = texto.trim();
    if (!termo) {
      limpar();
      return;
    }
    const igual = opcoes.find((cliente) => cliente.nome.toLowerCase() === termo.toLowerCase());
    if (igual) escolher(igual);
    else onChange({ nome: termo });
    setAberto(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          value={texto}
          autoComplete="off"
          placeholder="Buscar cliente pelo nome ou CPF/CNPJ..."
          className="pl-9 pr-9"
          onFocus={() => setAberto(true)}
          onBlur={() => window.setTimeout(() => setAberto(false), 150)}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setAberto(true);
          }}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              confirmarDigitado();
            }
            if (evento.key === "Escape") setAberto(false);
          }}
        />
        {texto && (
          <button
            type="button"
            onClick={limpar}
            aria-label="Limpar cliente"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-secondary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {aberto && texto.trim().length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-y-auto">
          {carregando && <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>}
          {!carregando && opcoes.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum cliente com esse nome. Enter grava como texto.
            </p>
          )}
          {opcoes.map((cliente) => (
            <button
              key={cliente.id}
              type="button"
              // mousedown antes do blur: o clique chega antes da lista fechar
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => escolher(cliente)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span className="font-medium block truncate">{cliente.nome}</span>
              {(cliente.cpfCnpj || cliente.municipio) && (
                <span className="text-xs text-muted-foreground">
                  {cliente.cpfCnpj}
                  {cliente.cpfCnpj && cliente.municipio ? " · " : ""}
                  {cliente.municipio}
                  {cliente.uf ? `/${cliente.uf}` : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-1">
        Escolha da base de clientes para vincular (opcional — Enter sem escolher grava só o texto).
      </p>
    </div>
  );
}
