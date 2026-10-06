import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Link2, Search, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Cliente = { id: string; nome: string; cpf_cnpj?: string | null; organizacao_id?: string | null };

interface Props {
  processoId: string;
  organizacaoId: string | null | undefined;
  clienteIdAtual: string | null;
  sugestaoNome?: string | null;
  onChanged: () => void;
}

/**
 * Card para vincular/trocar/desvincular o cliente de um processo.
 * Vínculo é sempre HUMANO — sugestões por nome são apenas visuais.
 */
export function ClienteVinculoCard({ processoId, organizacaoId, clienteIdAtual, sugestaoNome, onChanged }: Props) {
  const [clienteAtual, setClienteAtual] = useState<Cliente | null>(null);
  const [modo, setModo] = useState<"view" | "picker">("view");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [sugestoes, setSugestoes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [pendingSelect, setPendingSelect] = useState<Cliente | null>(null);

  // Carrega o cliente já vinculado
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!clienteIdAtual) { setClienteAtual(null); return; }
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, cpf_cnpj, organizacao_id")
        .eq("id", clienteIdAtual)
        .maybeSingle();
      if (ativo) setClienteAtual(data as Cliente | null);
    })();
    return () => { ativo = false; };
  }, [clienteIdAtual]);

  // Carrega sugestões por nome (só visual)
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!sugestaoNome || sugestaoNome.trim().length < 2) { setSugestoes([]); return; }
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, cpf_cnpj, organizacao_id")
        .ilike("nome", `%${sugestaoNome.trim()}%`)
        .is("deleted_at", null)
        .limit(3);
      if (ativo) setSugestoes((data || []) as Cliente[]);
    })();
    return () => { ativo = false; };
  }, [sugestaoNome]);

  // Busca com debounce
  useEffect(() => {
    if (modo !== "picker") return;
    const q = busca.trim();
    if (q.length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const digits = q.replace(/\D/g, "");
      let query = supabase
        .from("clientes")
        .select("id, nome, cpf_cnpj, organizacao_id")
        .is("deleted_at", null)
        .limit(15);
      if (digits.length >= 4) {
        query = query.or(`nome.ilike.%${q}%,cpf_cnpj.ilike.%${digits}%`);
      } else {
        query = query.ilike("nome", `%${q}%`);
      }
      const { data } = await query;
      setResultados((data || []) as Cliente[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [busca, modo]);

  const sugeridosIds = useMemo(() => new Set(sugestoes.map(s => s.id)), [sugestoes]);

  const vincular = async (c: Cliente) => {
    if (!processoId) return;
    if (organizacaoId && c.organizacao_id && c.organizacao_id !== organizacaoId) {
      toast.error("Cliente pertence a outra organização.");
      return;
    }
    const { error } = await supabase
      .from("processos")
      .update({ cliente_id: c.id })
      .eq("id", processoId);
    if (error) { toast.error("Erro ao vincular cliente"); return; }
    toast.success(`Vinculado a ${c.nome}. Se o cliente tiver acesso ao Portal, esse processo aparecerá lá.`);
    setModo("view");
    setBusca("");
    setPendingSelect(null);
    onChanged();
  };

  const desvincular = async () => {
    const { error } = await supabase
      .from("processos")
      .update({ cliente_id: null })
      .eq("id", processoId);
    if (error) { toast.error("Erro ao desvincular"); return; }
    toast.success("Cliente desvinculado. Portal deixará de mostrar este processo.");
    setConfirmUnlink(false);
    onChanged();
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-accent" /> Cliente do processo
        </h3>
        {clienteAtual && modo === "view" && (
          <Badge variant="outline" className="text-[10px]">Vinculado</Badge>
        )}
      </div>

      {clienteAtual && modo === "view" ? (
        <div className="space-y-3">
          <div>
            <Link
              to={`/clientes/${encodeURIComponent(clienteAtual.nome)}`}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {clienteAtual.nome}
            </Link>
            {clienteAtual.cpf_cnpj && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{clienteAtual.cpf_cnpj}</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Esse vínculo libera o processo no Portal do cliente (se ele tiver acesso).
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setModo("picker")}>Trocar</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
              onClick={() => setConfirmUnlink(true)}>Desvincular</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {!clienteAtual && (
            <p className="text-xs text-muted-foreground">
              Nenhum cliente vinculado. Ao vincular, o processo passa a aparecer no Portal daquele cliente (se tiver acesso).
            </p>
          )}

          {sugestoes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Sugestões pelo nome do processo
              </p>
              {sugestoes.map(s => (
                <button
                  key={s.id}
                  onClick={() => setPendingSelect(s)}
                  className="w-full text-left px-2.5 py-2 rounded-md border border-border hover:border-accent hover:bg-accent/5 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{s.nome}</p>
                    {s.cpf_cnpj && <p className="text-[10px] text-muted-foreground truncate">{s.cpf_cnpj}</p>}
                  </div>
                  <Badge variant="secondary" className="text-[9px] shrink-0">provável</Badge>
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar cliente por nome ou CPF/CNPJ…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {loading && <p className="text-xs text-muted-foreground">Buscando…</p>}
          {!loading && busca.trim().length >= 2 && resultados.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
          {resultados.length > 0 && (
            <div className="max-h-56 overflow-auto space-y-1">
              {resultados.map(c => (
                <button
                  key={c.id}
                  onClick={() => setPendingSelect(c)}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-muted transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{c.nome}</p>
                    {c.cpf_cnpj && <p className="text-[10px] text-muted-foreground truncate">{c.cpf_cnpj}</p>}
                  </div>
                  {sugeridosIds.has(c.id) && <Badge variant="secondary" className="text-[9px] shrink-0">provável</Badge>}
                </button>
              ))}
            </div>
          )}

          {clienteAtual && (
            <Button size="sm" variant="ghost" onClick={() => { setModo("view"); setBusca(""); }}>
              <X className="w-3.5 h-3.5 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      )}

      {/* Confirmação de vínculo (nada é gravado sem o clique aqui) */}
      <AlertDialog open={!!pendingSelect} onOpenChange={(o) => !o && setPendingSelect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Confirmar vínculo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vincular este processo a <strong>{pendingSelect?.nome}</strong>?
              {pendingSelect?.cpf_cnpj && <> ({pendingSelect.cpf_cnpj})</>}
              <br />
              Isso libera o processo no Portal desse cliente (se ele tiver acesso).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingSelect && vincular(pendingSelect)}>
              <Check className="w-4 h-4 mr-1" /> Confirmar vínculo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de desvínculo */}
      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O processo deixará de aparecer no Portal deste cliente. Você poderá vincular outro cliente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={desvincular} className="bg-destructive text-destructive-foreground">
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}