import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, FileWarning, Clock } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Operacao {
  id: string;
  grupo: string | null;
  banco: string | null;
  numero: string | null;
  vence_em: string | null;
  saldo_devedor: number | null;
  origem_arquivo: string | null;
  responsavel: string | null;
  vinculo_adiado_em: string | null;
}

interface Membro {
  id: string;
  nome: string;
  grupo: string | null;
}

const dataBr = (iso?: string | null) =>
  iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "sem data";

const moeda = (v: number | null) =>
  v == null
    ? "saldo não informado"
    : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function VincularOperacoes() {
  const [carregando, setCarregando] = useState(true);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [mostrarAdiadas, setMostrarAdiadas] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const { data: ops } = await supabase
      .from("operacoes_credito")
      .select("id, grupo, banco, numero, vence_em, saldo_devedor, origem_arquivo, responsavel, vinculo_adiado_em")
      .is("cliente_id", null)
      .is("deleted_at", null)
      .order("vence_em", { ascending: true, nullsFirst: false });
    const lista = (ops ?? []) as Operacao[];
    setOperacoes(lista);

    const grupos = [...new Set(lista.map((o) => o.grupo).filter(Boolean))] as string[];
    if (grupos.length) {
      const { data: cls } = await supabase
        .from("clientes")
        .select("id, nome, grupo")
        .in("grupo", grupos);
      setMembros((cls ?? []) as Membro[]);
    } else {
      setMembros([]);
    }
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const visiveis = useMemo(
    () => operacoes.filter((o) => (mostrarAdiadas ? true : !o.vinculo_adiado_em)),
    [operacoes, mostrarAdiadas],
  );

  const porGrupo = useMemo(() => {
    const m = new Map<string, Operacao[]>();
    for (const o of visiveis) {
      const g = o.grupo || "Sem grupo identificado";
      m.set(g, [...(m.get(g) ?? []), o]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visiveis]);

  const vincular = async (op: Operacao) => {
    const clienteId = escolha[op.id];
    if (!clienteId) {
      toast.error("Escolha a pessoa do grupo antes de vincular.");
      return;
    }
    const pessoa = membros.find((m) => m.id === clienteId);
    setSalvando(op.id);
    const { error } = await supabase
      .from("operacoes_credito")
      .update({
        cliente_id: clienteId,
        titular_nome: pessoa?.nome ?? null,
        titular_a_definir: false,
        vinculo_adiado_em: null,
      })
      .eq("id", op.id);
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível vincular", { description: error.message });
      return;
    }
    toast.success(`Operação ligada a ${pessoa?.nome ?? "a pessoa escolhida"}.`);
    setOperacoes((prev) => prev.filter((o) => o.id !== op.id));
  };

  const arquivar = async (op: Operacao) => {
    setSalvando(op.id);
    const { error } = await supabase
      .from("operacoes_credito")
      .update({
        nao_bancaria: true,
        dispensar_alerta: true,
        dispensa_motivo: "não é operação bancária",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", op.id);
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível arquivar", { description: error.message });
      return;
    }
    toast.success("Arquivada como documento que não é operação bancária. Saiu do radar.");
    setOperacoes((prev) => prev.filter((o) => o.id !== op.id));
  };

  const adiar = async (op: Operacao) => {
    setSalvando(op.id);
    const { error } = await supabase
      .from("operacoes_credito")
      .update({ vinculo_adiado_em: new Date().toISOString() })
      .eq("id", op.id);
    setSalvando(null);
    if (error) {
      toast.error("Não foi possível adiar", { description: error.message });
      return;
    }
    setOperacoes((prev) =>
      prev.map((o) => (o.id === op.id ? { ...o, vinculo_adiado_em: new Date().toISOString() } : o)),
    );
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando operações sem titular...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-2xl text-foreground">Operações sem titular</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cada operação precisa de uma pessoa do grupo. Enquanto não tiver, ela aparece no radar
          sem dono e nenhuma tarefa consegue ser criada com o nome certo.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          <strong>{visiveis.length}</strong> operação(ões) na lista
          {operacoes.some((o) => o.vinculo_adiado_em) && !mostrarAdiadas && (
            <span className="text-muted-foreground">
              {" "}
              — {operacoes.filter((o) => o.vinculo_adiado_em).length} marcada(s) para conferir depois
            </span>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={() => setMostrarAdiadas((v) => !v)}>
          {mostrarAdiadas ? "Esconder as de conferir depois" : "Mostrar as de conferir depois"}
        </Button>
      </div>

      {visiveis.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma operação sem titular. <Link to="/radar" className="text-accent underline">Voltar ao radar</Link>.
        </div>
      )}

      {porGrupo.map(([grupo, ops]) => {
        const doGrupo = membros.filter((m) => m.grupo === grupo);
        return (
          <div key={grupo} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{grupo}</h2>
              <span className="text-xs text-muted-foreground">
                {ops.length} operação(ões) · carteira de {ops[0]?.responsavel || "não definida"}
              </span>
            </div>
            <div className="divide-y divide-border">
              {ops.map((op) => (
                <div key={op.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span className="font-medium text-foreground">
                      {op.numero || "número a conferir"}
                    </span>
                    <span className="text-muted-foreground">{op.banco || "banco não informado"}</span>
                    <span className="text-muted-foreground">vence {dataBr(op.vence_em)}</span>
                    <span className="text-muted-foreground">{moeda(op.saldo_devedor)}</span>
                    {op.vinculo_adiado_em && (
                      <span className="text-xs flex items-center gap-1 text-warning">
                        <Clock className="w-3 h-3" /> conferir depois
                      </span>
                    )}
                  </div>
                  {op.origem_arquivo && (
                    <p className="text-xs text-muted-foreground break-all">
                      Arquivo de origem: {op.origem_arquivo}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={escolha[op.id] ?? ""}
                      onValueChange={(v) => setEscolha((p) => ({ ...p, [op.id]: v }))}
                    >
                      <SelectTrigger className="w-[260px] h-9 text-sm">
                        <SelectValue placeholder="Escolher a pessoa do grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {doGrupo.length === 0 && (
                          <SelectItem value="__vazio" disabled>
                            Nenhuma pessoa cadastrada neste grupo
                          </SelectItem>
                        )}
                        {doGrupo.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={salvando === op.id || !escolha[op.id]}
                      onClick={() => vincular(op)}
                    >
                      {salvando === op.id ? "Salvando..." : "Vincular"}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={salvando === op.id}>
                          <FileWarning className="w-3.5 h-3.5 mr-1.5" />
                          Não é operação bancária
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Arquivar este documento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Contrato de prestação de serviço, aditivo de fornecedor ou documento da
                            fazenda. O registro sai do radar com esse motivo e pode ser recuperado
                            depois.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => arquivar(op)}>
                            Arquivar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={salvando === op.id || !!op.vinculo_adiado_em}
                      onClick={() => adiar(op)}
                    >
                      Conferir depois
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
