import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ClientSuggestion {
  nome_cliente: string;
  banco: string | null;
  numero_contrato: string | null;
}

interface ClientSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectClient?: (client: ClientSuggestion) => void;
  placeholder?: string;
}

export function ClientSearchInput({ value, onChange, onSelectClient, placeholder = "Buscar cliente..." }: ClientSearchInputProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (!query || query.length < 2 || !user) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.rpc("search_contratos_clientes_norm" as any, { q: query });

      if (data) {
        // Deduplicate by nome_cliente
        const seen = new Set<string>();
        const unique: ClientSuggestion[] = [];
        for (const row of data as ClientSuggestion[]) {
          const key = row.nome_cliente.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(row);
          }
        }
        setSuggestions(unique);
        setShowSuggestions(unique.length > 0);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [value, user]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {showSuggestions && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={`${s.nome_cliente}-${i}`}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 transition-colors flex justify-between items-center"
              onClick={() => {
                onChange(s.nome_cliente);
                onSelectClient?.(s);
                setShowSuggestions(false);
              }}
            >
              <span className="font-medium text-foreground">{s.nome_cliente}</span>
              {s.banco && <span className="text-xs text-muted-foreground ml-2">{s.banco}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
