import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UserPlus, MapPin, Sprout, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CLIENTE_SELECT, type ClienteLaudo } from "@/lib/mapClienteParaEtapa1";

interface Props {
  onSelect: (cliente: ClienteLaudo) => void;
}

export function SelecionarClienteLaudo({ onSelect }: Props) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClienteLaudo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from("clientes")
        .select(CLIENTE_SELECT)
        .is("deleted_at", null)
        .order("nome", { ascending: true })
        .limit(50);
      const termo = q.trim();
      if (termo.length >= 2) {
        query = query.or(
          `nome.ilike.%${termo.replace(/[%,]/g, "")}%,cpf_cnpj.ilike.%${termo.replace(/[%,]/g, "")}%,municipio.ilike.%${termo.replace(/[%,]/g, "")}%`,
        );
      }
      const { data } = await query;
      if (!active) return;
      setRows((data as any as ClienteLaudo[]) || []);
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-foreground">Novo laudo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comece escolhendo o produtor. Os dados do cadastro são carregados automaticamente.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CPF/CNPJ ou município..."
          className="pl-9 h-11"
        />
      </div>

      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando clientes...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Nenhum cliente encontrado{q ? ` para "${q}"` : ""}.
          </div>
        ) : (
          rows.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.cpf_cnpj || "sem documento"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                {(c.municipio || c.uf) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[c.municipio, c.uf].filter(Boolean).join("/")}
                  </span>
                )}
                {c.cultura_principal && (
                  <span className="flex items-center gap-1">
                    <Sprout className="w-3 h-3" />
                    {c.cultura_principal}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <Link
        to="/novo-cliente"
        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-all"
      >
        <UserPlus className="w-4 h-4" /> Cadastrar novo cliente
      </Link>
    </div>
  );
}