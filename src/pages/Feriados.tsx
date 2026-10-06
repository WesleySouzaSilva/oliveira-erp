import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/loaders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2, RotateCcw } from "lucide-react";
import { feriadosNacionais, dataBR, diaSemanaBR } from "@/lib/diasUteis";

interface FeriadoRow {
  id: string;
  data: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

const TIPOS = [
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal (Castro/PR)" },
  { value: "recesso", label: "Recesso" },
];

export default function Feriados() {
  const anoAtual = new Date().getUTCFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [linhas, setLinhas] = useState<FeriadoRow[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [novo, setNovo] = useState({ data: "", nome: "", tipo: "municipal" });
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    const { data: membro } = await supabase.from("membros").select("organizacao_id").limit(1).maybeSingle();
    setOrgId((membro as any)?.organizacao_id ?? null);
    const { data, error } = await supabase.from("feriados").select("id, data, nome, tipo, ativo").order("data");
    if (error) {
      toast.error("Não foi possível carregar o calendário");
      setLinhas([]);
      return;
    }
    setLinhas(((data as any[]) || []).map((r) => ({ ...r, data: String(r.data).slice(0, 10) })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const desligados = useMemo(
    () => new Set((linhas ?? []).filter((l) => !l.ativo).map((l) => l.data)),
    [linhas],
  );

  const nacionais = useMemo(
    () => feriadosNacionais(ano).map((f) => ({ ...f, desligado: desligados.has(f.data) })),
    [ano, desligados],
  );

  const proprios = useMemo(
    () => (linhas ?? []).filter((l) => l.ativo && l.data.startsWith(String(ano))),
    [linhas, ano],
  );

  const adicionar = async () => {
    if (!novo.data || !novo.nome.trim()) {
      toast.error("Informe a data e o nome");
      return;
    }
    if (!orgId) {
      toast.error("Organização não identificada");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("feriados")
      .insert({ organizacao_id: orgId, data: novo.data, nome: novo.nome.trim(), tipo: novo.tipo, ativo: true });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível gravar");
      return;
    }
    toast.success("Data incluída no calendário");
    setNovo({ data: "", nome: "", tipo: "municipal" });
    load();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("feriados").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover");
      return;
    }
    load();
  };

  const alternarNacional = async (data: string, nome: string, desligar: boolean) => {
    if (!orgId) return;
    if (desligar) {
      const { error } = await supabase
        .from("feriados")
        .insert({ organizacao_id: orgId, data, nome, tipo: "nacional", ativo: false });
      if (error) {
        toast.error("Não foi possível desativar");
        return;
      }
    } else {
      const alvo = (linhas ?? []).find((l) => l.data === data && !l.ativo);
      if (alvo) await supabase.from("feriados").delete().eq("id", alvo.id);
    }
    load();
  };

  return (
    <AppLayout>
      <PageHeader
        icon={CalendarClock}
        title="Feriados e recesso"
        subtitle="Calendário usado para calcular os prazos e as datas das tarefas"
        breadcrumb={[{ label: "Ferramentas" }, { label: "Feriados" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAno(ano - 1)}>◀</Button>
            <span className="font-semibold">{ano}</span>
            <Button variant="outline" size="sm" onClick={() => setAno(ano + 1)}>▶</Button>
          </div>
        }
      />

      {linhas === null ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="font-serif font-bold mb-3">Acrescentar data</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="feriado-data">Data</Label>
                <Input
                  id="feriado-data"
                  type="date"
                  value={novo.data}
                  onChange={(e) => setNovo((n) => ({ ...n, data: e.target.value }))}
                />
              </div>
              <div className="min-w-[16rem] flex-1">
                <Label htmlFor="feriado-nome">Nome</Label>
                <Input
                  id="feriado-nome"
                  value={novo.nome}
                  placeholder="Ex.: Aniversário de Castro"
                  onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="feriado-tipo">Tipo</Label>
                <select
                  id="feriado-tipo"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm block"
                  value={novo.tipo}
                  onChange={(e) => setNovo((n) => ({ ...n, tipo: e.target.value }))}
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <Button onClick={adicionar} disabled={salvando}>
                <Plus className="w-4 h-4 mr-1" /> Incluir
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-serif font-bold mb-3">Datas próprias de {ano}</h2>
            {proprios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma data cadastrada para este ano.</p>
            ) : (
              <ul className="divide-y divide-border">
                {proprios.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-semibold text-sm">{dataBR(f.data)}</span>{" "}
                      <span className="text-xs text-muted-foreground">({diaSemanaBR(f.data)})</span>
                      <p className="text-sm">{f.nome} <span className="text-xs text-muted-foreground">— {f.tipo}</span></p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remover(f.id)} aria-label={`Remover ${f.nome}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-serif font-bold mb-1">Feriados nacionais de {ano}</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Calculados automaticamente, inclusive os que mudam de data todo ano (Carnaval, Sexta-feira Santa e
              Corpus Christi). Pode desativar o que não valer aqui.
            </p>
            <ul className="divide-y divide-border">
              {nacionais.map((f) => (
                <li key={f.data} className="flex items-center justify-between py-2">
                  <div className={f.desligado ? "opacity-50 line-through" : ""}>
                    <span className="font-semibold text-sm">{dataBR(f.data)}</span>{" "}
                    <span className="text-xs text-muted-foreground">({diaSemanaBR(f.data)})</span>
                    <p className="text-sm">{f.nome}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => alternarNacional(f.data, f.nome, !f.desligado)}
                  >
                    {f.desligado ? (<><RotateCcw className="w-4 h-4 mr-1" /> Reativar</>) : "Desativar"}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
