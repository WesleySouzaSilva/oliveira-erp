import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lerTudo } from "@/lib/lerTudo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MovimentosDataJud } from "@/components/processo/MovimentosDataJud";

const dig = (s: string) => (s || "").replace(/\D/g, "");
function docValido(d: string) {
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return calc(9) === +d[9] && calc(10) === +d[10];
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => { const p = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * p[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +d[12] && calc(13) === +d[13];
  }
  return false;
}
const fmt = (d: string) => d.length === 11
  ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  : d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

function ListaProcessos() {
  const nav = useNavigate();
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("todos");
  const [resp, setResp] = useState("todos");
  const { data = [], isLoading } = useQuery({
    queryKey: ["processos-judiciais-lista"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await lerTudo(() => supabase.from("processos_judiciais")
        .select("id, numero_cnj, numero_cnj_formatado, grupo, fase, etapa, advbox_responsavel_nome, status_closure_bruto, processo_judicial_clientes(clientes(nome))"));
      if (error) throw error;
      return data ?? [];
    },
  });
  const grupos = useMemo(() => [...new Set(data.map((p: any) => p.grupo).filter(Boolean))].sort(), [data]);
  const resps = useMemo(() => [...new Set(data.map((p: any) => p.advbox_responsavel_nome).filter(Boolean))].sort(), [data]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase(); const qd = dig(busca);
    return data.filter((p: any) => {
      if (grupo !== "todos" && p.grupo !== grupo) return false;
      if (resp !== "todos" && p.advbox_responsavel_nome !== resp) return false;
      if (!q) return true;
      const nomes = (p.processo_judicial_clientes ?? []).map((r: any) => r.clientes?.nome ?? "").join(" ").toLowerCase();
      return nomes.includes(q) || (qd.length >= 4 && (p.numero_cnj ?? "").includes(qd));
    });
  }, [data, busca, grupo, resp]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por número ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" aria-label="Buscar processos" />
        <Select value={grupo} onValueChange={setGrupo}>
          <SelectTrigger className="w-48" aria-label="Grupo"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os grupos</SelectItem>{grupos.map((g: any) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={resp} onValueChange={setResp}>
          <SelectTrigger className="w-56" aria-label="Responsável"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os responsáveis</SelectItem>{resps.map((g: any) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{lista.length} de {data.length}</span>
      </div>
      <p className="text-xs text-muted-foreground">"Fechamento ADVBOX" é a data gravada no ADVBOX e não significa processo encerrado.</p>
      <Table>
        <TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Clientes</TableHead><TableHead>Grupo</TableHead><TableHead>Fase / etapa</TableHead><TableHead>Responsável</TableHead><TableHead>Fechamento ADVBOX</TableHead></TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={6}>Carregando…</TableCell></TableRow>}
          {lista.slice(0, 500).map((p: any) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">
                {p.numero_cnj ? (
                  <MovimentosDataJud numeroCnj={p.numero_cnj} titulo={p.numero_cnj_formatado}>
                    <button className="underline-offset-2 hover:underline" title="Ver andamentos (DataJud)">{p.numero_cnj_formatado || p.numero_cnj}</button>
                  </MovimentosDataJud>
                ) : "Sem número"}
              </TableCell>
              <TableCell className="text-sm">
                {(p.processo_judicial_clientes ?? []).map((r: any, i: number) => r.clientes?.nome && (
                  <button key={i} className="underline-offset-2 hover:underline mr-2" onClick={() => nav(`/clientes/${encodeURIComponent(r.clientes.nome)}`)}>{r.clientes.nome}</button>
                ))}
              </TableCell>
              <TableCell>{p.grupo && <Badge variant="outline">{p.grupo}</Badge>}</TableCell>
              <TableCell className="text-sm">{[p.fase, p.etapa].filter(Boolean).join(" · ")}</TableCell>
              <TableCell className="text-sm">{p.advbox_responsavel_nome}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.status_closure_bruto}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {lista.length > 500 && <p className="text-xs text-muted-foreground">Mostrando 500; refine a busca para ver os demais.</p>}
    </div>
  );
}

function CpfPendente() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const { data = [], isLoading } = useQuery({
    queryKey: ["clientes-cpf-pendente"],
    queryFn: async () => {
      const { data, error } = await lerTudo(() => supabase.from("clientes")
        .select("id, nome, municipio, uf, telefone").eq("cpf_origem", "pendente_advbox").is("deleted_at", null));
      if (error) throw error;
      return (data ?? []).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
    },
  });
  const lista = data.filter((c: any) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()));
  const salvar = async (id: string) => {
    const d = dig(valores[id] ?? "");
    if (!docValido(d)) { toast.error("CPF ou CNPJ inválido"); return; }
    const { error } = await supabase.from("clientes").update({ cpf_cnpj: fmt(d), cpf_origem: "manual", cpf_origem_em: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return; }
    toast.success("Documento salvo");
    qc.invalidateQueries({ queryKey: ["clientes-cpf-pendente"] });
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Input placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" aria-label="Buscar cliente" />
        <span className="text-sm text-muted-foreground">{data.length} pendentes</span>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Cidade</TableHead><TableHead>Telefone</TableHead><TableHead>CPF/CNPJ</TableHead></TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={4}>Carregando…</TableCell></TableRow>}
          {lista.slice(0, 300).map((c: any) => (
            <TableRow key={c.id}>
              <TableCell>{c.nome}</TableCell>
              <TableCell className="text-sm">{[c.municipio, c.uf].filter(Boolean).join("/")}</TableCell>
              <TableCell className="text-sm">{c.telefone}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Input className="w-44" aria-label={`Documento de ${c.nome}`} value={valores[c.id] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))} placeholder="Somente números" />
                  <Button size="sm" variant="outline" onClick={() => salvar(c.id)}>Salvar</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Duplicados() {
  const { data = [] } = useQuery({
    queryKey: ["advbox-duplicados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("advbox_clientes_alias").select("advbox_customers_id, motivo, created_at, clientes(nome, cpf_cnpj, advbox_customers_id)");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Cadastros repetidos no ADVBOX (mesmo CPF/CNPJ) unificados num cliente só. Confira se é mesmo a mesma pessoa.</p>
      <Table>
        <TableHeader><TableRow><TableHead>Cliente no app</TableHead><TableHead>Documento</TableHead><TableHead>ID principal ADVBOX</TableHead><TableHead>ID repetido (apelido)</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((a: any) => (
            <TableRow key={a.advbox_customers_id}>
              <TableCell>{a.clientes?.nome}</TableCell><TableCell>{a.clientes?.cpf_cnpj}</TableCell>
              <TableCell className="font-mono text-xs">{a.clientes?.advbox_customers_id}</TableCell><TableCell className="font-mono text-xs">{a.advbox_customers_id}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ProcessosJudiciais() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-serif">Processos judiciais</h1>
        <p className="text-sm text-muted-foreground">Base importada do ADVBOX, atualizada todo dia às 06:00. Somente leitura.</p>
      </div>
      <Tabs defaultValue="processos">
        <TabsList>
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="cpf">CPF pendente</TabsTrigger>
          <TabsTrigger value="duplicados">Duplicados do ADVBOX</TabsTrigger>
        </TabsList>
        <TabsContent value="processos"><ListaProcessos /></TabsContent>
        <TabsContent value="cpf"><CpfPendente /></TabsContent>
        <TabsContent value="duplicados"><Duplicados /></TabsContent>
      </Tabs>
    </div>
  );
}
