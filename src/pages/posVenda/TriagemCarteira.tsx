import { lerTudo } from "@/lib/lerTudo";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { toast } from "sonner";
import {
  SITUACOES,
  labelSituacao,
  situacaoClasses,
  normNome,
  salvarSituacaoCliente,
  type SituacaoCliente,
} from "@/lib/situacaoCliente";
import { notifyRadarChanged } from "@/hooks/useOperacoesCredito";

interface Linha {
  id: string;
  nome: string;
  situacao: string;
  motivo: string | null;
  triado: boolean;
  vencimentos: number;
  proximo: string | null;
  ultimaMov: string | null;
}

const fmtData = (iso?: string | null) => {
  if (!iso) return "—";
  const d = iso.slice(0, 10).split("-");
  return `${d[2]}/${d[1]}/${d[0]}`;
};

export default function TriagemCarteira() {
  const { user } = useAuth();
  const { podeGerirCliente } = usePapelRadar();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroSit, setFiltroSit] = useState("todos");
  const [pendente, setPendente] = useState<{ linha: Linha; situacao: SituacaoCliente } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const hoje = new Date();
    const inicio = hoje.toISOString().slice(0, 10);
    const limite = new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate())
      .toISOString()
      .slice(0, 10);

    const [cls, ops, cts, ats, atv] = await Promise.all([
      lerTudo(() => supabase
        .from("clientes")
        .select("id, nome, situacao, situacao_motivo, situacao_alterada_em, updated_at")
        .is("deleted_at", null)),
      supabase.from("operacoes_credito").select("cliente_id, vence_em").is("deleted_at", null).gte("vence_em", inicio).lte("vence_em", limite),
      lerTudo(() => supabase
        .from("contratos_vencimentos")
        .select("nome_cliente, vencimento_proxima_parcela")
        .is("deleted_at", null)
        .gte("vencimento_proxima_parcela", inicio)
        .lte("vencimento_proxima_parcela", limite)),
      supabase.from("atendimentos_notas").select("cliente_nome, created_at"),
      supabase.from("atividades_clientes").select("nome_cliente, created_at").is("deleted_at", null),
    ]);

    const clientes = (cls.data ?? []) as any[];
    const porNome = new Map<string, any>();
    for (const c of clientes) porNome.set(normNome(c.nome || ""), c);

    const contagem = new Map<string, { qtd: number; proximo: string | null }>();
    const soma = (key: string, data: string) => {
      if (!key) return;
      const cur = contagem.get(key) ?? { qtd: 0, proximo: null as string | null };
      cur.qtd += 1;
      if (!cur.proximo || data < cur.proximo) cur.proximo = data;
      contagem.set(key, cur);
    };
    for (const o of (ops.data ?? []) as any[]) {
      const c = clientes.find((x) => x.id === o.cliente_id);
      if (c) soma(normNome(c.nome || ""), o.vence_em);
    }
    for (const c of (cts.data ?? []) as any[]) soma(normNome(c.nome_cliente || ""), c.vencimento_proxima_parcela);

    const mov = new Map<string, string>();
    const registraMov = (nome: string, data: string) => {
      const key = normNome(nome || "");
      if (!key || !data) return;
      const cur = mov.get(key);
      if (!cur || data > cur) mov.set(key, data);
    };
    for (const a of (ats.data ?? []) as any[]) registraMov(a.cliente_nome, a.created_at);
    for (const a of (atv.data ?? []) as any[]) registraMov(a.nome_cliente, a.created_at);

    const out: Linha[] = [];
    for (const [key, info] of contagem) {
      const c = porNome.get(key);
      if (!c) continue;
      out.push({
        id: c.id,
        nome: c.nome,
        situacao: c.situacao || "ativo",
        motivo: c.situacao_motivo ?? null,
        triado: !!c.situacao_alterada_em,
        vencimentos: info.qtd,
        proximo: info.proximo,
        ultimaMov: mov.get(key) ?? null,
      });
    }
    out.sort((a, b) => (a.proximo || "").localeCompare(b.proximo || ""));
    setLinhas(out);
    setLoading(false);
  };

  useEffect(() => {
    if (user) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const visiveis = useMemo(
    () =>
      linhas
        .filter((l) => (busca ? normNome(l.nome).includes(normNome(busca)) : true))
        .filter((l) =>
          filtroSit === "todos"
            ? true
            : filtroSit === "nao_triados"
              ? !l.triado
              : l.situacao === filtroSit,
        ),
    [linhas, busca, filtroSit],
  );

  const naoTriados = linhas.filter((l) => !l.triado).length;

  const aplicar = async (linha: Linha, situacao: SituacaoCliente, motivoTexto: string | null) => {
    setSalvando(true);
    try {
      await salvarSituacaoCliente(linha.id, situacao, motivoTexto, user?.id ?? null);
      setLinhas((ls) =>
        ls.map((l) =>
          l.id === linha.id ? { ...l, situacao, motivo: motivoTexto, triado: true } : l,
        ),
      );
      notifyRadarChanged();
      toast.success(`Situação de ${linha.nome}: ${labelSituacao(situacao)}`);
      setPendente(null);
      setMotivo("");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível salvar a situação");
    } finally {
      setSalvando(false);
    }
  };

  const onSelecionar = (linha: Linha, valor: string) => {
    const situacao = valor as SituacaoCliente;
    if (situacao === linha.situacao) return;
    setMotivo(linha.motivo || "");
    setPendente({ linha, situacao });
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          icon={ListChecks}
          title="Triagem de carteira"
          subtitle="Clientes com operação vencendo nos próximos 12 meses — os únicos que geram trabalho agora."
          breadcrumb={[{ label: "Agro" }, { label: "Pós-Venda" }, { label: "Triagem de carteira" }]}
        />

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar por nome</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do cliente" className="pl-8" />
            </div>
          </div>
          <div className="min-w-[220px]">
            <label className="text-xs text-muted-foreground">Situação</label>
            <Select value={filtroSit} onValueChange={setFiltroSit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="nao_triados">Ainda não triados</SelectItem>
                {SITUACOES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {linhas.length} cliente(s) no período · <b>{naoTriados}</b> ainda não triados
          </p>
        </Card>

        <div className="rounded-lg border border-border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Vencimentos/ano</th>
                <th className="text-left px-3 py-2">Próximo</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-left px-3 py-2">Última movimentação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-muted-foreground">Carregando…</td></tr>
              ) : visiveis.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-muted-foreground">Nenhum cliente com vencimento nos próximos 12 meses.</td></tr>
              ) : (
                visiveis.map((l) => (
                  <tr key={l.id} className={`border-t border-border ${!l.triado ? "bg-amber-500/5" : ""}`}>
                    <td className="px-3 py-2 font-semibold">{l.nome}</td>
                    <td className="px-3 py-2">{l.vencimentos}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtData(l.proximo)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${situacaoClasses(l.situacao)}`}>
                          {labelSituacao(l.situacao)}
                        </span>
                        <Select value={l.situacao} onValueChange={(v) => onSelecionar(l, v)} disabled={!podeGerirCliente}>
                          <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SITUACOES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {l.motivo && l.situacao !== "ativo" && (
                        <p className="text-[11px] text-muted-foreground mt-1">{l.motivo}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtData(l.ultimaMov)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!pendente} onOpenChange={(v) => { if (!v) { setPendente(null); setMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendente ? `${pendente.linha.nome} — ${labelSituacao(pendente.situacao)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendente?.situacao === "ativo"
              ? "Escreva o motivo da reativação. O cliente volta ao radar de vencimentos."
              : "Escreva o motivo. O cliente sai do radar de vencimentos, mas as operações continuam na ficha dele."}
          </p>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ex.: contrato rescindido em 09/2026"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendente(null); setMotivo(""); }}>Cancelar</Button>
            <Button
              disabled={salvando || !motivo.trim()}
              onClick={() => pendente && aplicar(pendente.linha, pendente.situacao, motivo.trim())}
            >
              {salvando ? "Salvando…" : "Salvar situação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
