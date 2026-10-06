import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { db, Setor } from "@/lib/treinamentos";
import { useOrgMembers } from "@/hooks/useOrgMembers";

export default function ConfigTab({ setores, recarregar }: { setores: Setor[]; recarregar: () => void }) {
  const { members, orgId } = useOrgMembers();
  const [ms, setMs] = useState<any[]>([]);
  const carregarMs = () => db.from("membro_setores").select("*").then(({ data }: any) => setMs(data || []));
  useEffect(() => { carregarMs(); }, []);

  const ativos = setores.filter((s) => s.ativo !== false);
  const vinculo = (uid: string, sid: string) => ms.find((m) => m.user_id === uid && m.setor_id === sid);

  const alternar = async (uid: string, sid: string) => {
    const v = vinculo(uid, sid);
    const { error } = v ? await db.from("membro_setores").delete().eq("id", v.id)
      : await db.from("membro_setores").insert({ user_id: uid, setor_id: sid, organizacao_id: orgId });
    if (error) toast.error("Não foi possível salvar."); carregarMs();
  };
  const alternarLider = async (uid: string, sid: string) => {
    const v = vinculo(uid, sid); if (!v) return;
    const { error } = await db.from("membro_setores").update({ lider: !v.lider }).eq("id", v.id);
    if (error) toast.error("Não foi possível salvar."); carregarMs();
  };

  const novoSetor = async (pai: Setor | null) => {
    const nome = prompt(pai ? `Nome do subgrupo de ${pai.nome}` : "Nome do setor");
    if (!nome?.trim()) return;
    const irmaos = setores.filter((s) => s.pai_id === (pai?.id ?? null));
    const { error } = await db.from("setores").insert({ nome: nome.trim(), pai_id: pai?.id ?? null, ordem: irmaos.length, organizacao_id: orgId });
    if (error) toast.error("Não foi possível criar (o nome já existe?)."); recarregar();
  };
  const renomear = async (s: Setor) => {
    const nome = prompt("Novo nome", s.nome); if (!nome?.trim()) return;
    const { error } = await db.from("setores").update({ nome: nome.trim() }).eq("id", s.id);
    if (error) toast.error("Não foi possível renomear."); recarregar();
  };
  const mover = async (s: Setor, dir: -1 | 1) => {
    const irmaos = setores.filter((x) => x.pai_id === s.pai_id);
    const i = irmaos.findIndex((x) => x.id === s.id), j = i + dir;
    if (j < 0 || j >= irmaos.length) return;
    await Promise.all(irmaos.map((x, k) => db.from("setores").update({ ordem: k === i ? j : k === j ? i : k }).eq("id", x.id)));
    recarregar();
  };
  const ativar = async (s: Setor, v: boolean) => { await db.from("setores").update({ ativo: v }).eq("id", s.id); recarregar(); };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center"><h3 className="font-serif text-lg flex-1">Setores</h3>
          <Button size="sm" variant="outline" onClick={() => novoSetor(null)}><Plus className="w-4 h-4 mr-1" />Setor</Button></div>
        <ul className="divide-y divide-border">
          {setores.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 py-1.5 text-sm ${s.pai_id ? "pl-6" : "font-medium"} ${s.ativo === false ? "opacity-50" : ""}`}>
              <span className="flex-1">{s.nome}{s.institucional && <span className="ml-2 text-xs text-muted-foreground">(visível para todos)</span>}</span>
              {!s.pai_id && !s.institucional && <Button size="sm" variant="ghost" onClick={() => novoSetor(s)}><Plus className="w-3.5 h-3.5 mr-1" />Subgrupo</Button>}
              <Button size="icon" variant="ghost" aria-label="Subir" onClick={() => mover(s, -1)}><ArrowUp className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Descer" onClick={() => mover(s, 1)}><ArrowDown className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Renomear" onClick={() => renomear(s)}><Pencil className="w-4 h-4" /></Button>
              {!s.institucional && <Switch aria-label="Ativo" checked={s.ativo !== false} onCheckedChange={(v) => ativar(s, v)} />}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="font-serif text-lg">Membros e setores</h3>
        <p className="text-sm text-muted-foreground">Marque os setores de cada pessoa (pode ser mais de um). A estrela torna a pessoa líder daquele setor: ela passa a criar e editar trilhas do setor (e dos subgrupos, se for um grupo) e a acompanhar a equipe no Painel. O Institucional vale para todos, sem precisar marcar.</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Pessoa</TableHead>
              {ativos.filter((s) => !s.institucional).map((s) => <TableHead key={s.id} className="text-center whitespace-nowrap">{s.pai_id ? `↳ ${s.nome}` : s.nome}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {[...members].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="whitespace-nowrap">{m.nome || "Sem nome"}</TableCell>
                  {ativos.filter((s) => !s.institucional).map((s) => {
                    const v = vinculo(m.user_id, s.id);
                    return (
                      <TableCell key={s.id} className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Checkbox aria-label={`${m.nome} em ${s.nome}`} checked={!!v} onCheckedChange={() => alternar(m.user_id, s.id)} />
                          {v && <button type="button" aria-label={v.lider ? "Remover liderança" : "Tornar líder"} title={v.lider ? "Líder (clique para remover)" : "Tornar líder"} onClick={() => alternarLider(m.user_id, s.id)}>
                            <Star className={`w-4 h-4 ${v.lider ? "fill-accent text-accent" : "text-muted-foreground"}`} /></button>}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
