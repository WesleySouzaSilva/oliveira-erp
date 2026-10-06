import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { normNome } from "@/lib/situacaoCliente";
import { LISTA_DIVISAO, RESPONSAVEIS_CARTEIRA } from "@/data/divisaoCarteira";
import { CheckCircle2, Copy, HelpCircle, UserPlus, Users } from "lucide-react";
import { toTitleCaseNome } from "@/components/EditClientePerfilDialog";

interface ClienteRow {
  id: string;
  nome: string;
  responsavel_pos_venda: string | null;
}

/** Chave de comparação: sem acento, sem maiúsculas, sem anotações após " - " ou entre parênteses. */
const chave = (nome: string) => normNome(nome.split(" - ")[0].split(" (")[0]);

/**
 * Titulares de uma entrada da lista. Grupos familiares viram uma ficha por pessoa:
 * "Fulano e Beltrano" → dois; "Fulano - Beltrano" → dois; "Fulano (Beltrano)" → dois.
 */
export function titularesDe(entrada: string): string[] {
  const partes = entrada
    .replace(/[()]/g, " - ")
    .split(/\s+-\s+|\s+e\s+/i)
    .map((p) => toTitleCaseNome(p.trim()))
    .filter((p) => p.length >= 2 && p.toLowerCase() !== "ok");
  const unicos: string[] = [];
  partes.forEach((p) => {
    if (!unicos.some((u) => normNome(u) === normNome(p))) unicos.push(p);
  });
  return unicos.length ? unicos : [toTitleCaseNome(entrada)];
}

type Item = {
  dono: string;
  nomeLista: string;
  responsavelNome: string;
  userId: string;
  candidatos: ClienteRow[];
};

export default function DivisaoCarteiraPanel() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [escolhas, setEscolhas] = useState<Record<string, string[]>>({});
  const [gravado, setGravado] = useState(0);
  const [novos, setNovos] = useState<Record<string, boolean>>({});
  const [criados, setCriados] = useState(0);

  const marcarTodos = (itens: Item[], valor: boolean) =>
    setNovos(() => {
      const next: Record<string, boolean> = {};
      itens.forEach((i) => titularesDe(i.nomeLista).forEach((t) => (next[`${i.nomeLista}|${t}`] = valor)));
      return next;
    });

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome, responsavel_pos_venda")
      .is("deleted_at", null);
    if (error) toast.error("Não foi possível carregar os clientes");
    setClientes((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) carregar();
  }, [user]);

  const { exatos, duplicados, semMatch } = useMemo(() => {
    const porChave = new Map<string, ClienteRow[]>();
    clientes.forEach((c) => {
      const k = chave(c.nome || "");
      if (!k) return;
      porChave.set(k, [...(porChave.get(k) || []), c]);
    });

    const itens: Item[] = LISTA_DIVISAO.map((l) => {
      const resp = RESPONSAVEIS_CARTEIRA.find((r) => r.chave === l.dono)!;
      return {
        dono: l.dono,
        nomeLista: l.nome,
        responsavelNome: resp.nome,
        userId: resp.userId,
        candidatos: porChave.get(chave(l.nome)) || [],
      };
    });

    return {
      exatos: itens.filter((i) => i.candidatos.length === 1),
      duplicados: itens.filter((i) => i.candidatos.length > 1),
      semMatch: itens.filter((i) => i.candidatos.length === 0),
    };
  }, [clientes]);

  const sugestoes = (nome: string) => {
    const k = chave(nome);
    const primeiro = k.split(" ")[0];
    const ultimo = k.split(" ").slice(-1)[0];
    return clientes
      .filter((c) => {
        const ck = chave(c.nome || "");
        return ck.includes(primeiro) || (ultimo.length > 3 && ck.includes(ultimo));
      })
      .slice(0, 3);
  };

  const selecionadosDup = (nomeLista: string, item: Item) =>
    escolhas[nomeLista] ?? (item.candidatos.length ? [item.candidatos[0].id] : []);

  const toggleDup = (nomeLista: string, item: Item, id: string) =>
    setEscolhas((prev) => {
      const atual = prev[nomeLista] ?? (item.candidatos.length ? [item.candidatos[0].id] : []);
      return {
        ...prev,
        [nomeLista]: atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
      };
    });

  const totalGravar =
    exatos.length + duplicados.reduce((acc, i) => acc + selecionadosDup(i.nomeLista, i).length, 0);

  const gravar = async () => {
    setSaving(true);
    try {
      const alvos: { id: string; userId: string }[] = [
        ...exatos.map((i) => ({ id: i.candidatos[0].id, userId: i.userId })),
        ...duplicados.flatMap((i) => selecionadosDup(i.nomeLista, i).map((id) => ({ id, userId: i.userId }))),
      ];
      // Agrupa por responsável para gravar em lote.
      const porResp = new Map<string, string[]>();
      alvos.forEach((a) => porResp.set(a.userId, [...(porResp.get(a.userId) || []), a.id]));

      for (const [userId, ids] of porResp) {
        const { error } = await supabase
          .from("clientes")
          .update({ responsavel_pos_venda: userId, updated_at: new Date().toISOString() } as never)
          .in("id", ids);
        if (error) throw error;
      }
      setGravado(alvos.length);
      toast.success(`${alvos.length} clientes com responsável gravado`);
      await carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gravar a divisão de carteira");
    } finally {
      setSaving(false);
    }
  };

  const totalCadastrar = Object.values(novos).filter(Boolean).length;

  /** Cria uma ficha por titular marcado, já com o responsável da lista. */
  const cadastrarSelecionados = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: membro } = await supabase
        .from("membros")
        .select("organizacao_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const linhas = semMatch.flatMap((i) =>
        titularesDe(i.nomeLista)
          .filter((t) => novos[`${i.nomeLista}|${t}`])
          .map((t) => ({
            user_id: user.id,
            organizacao_id: (membro as any)?.organizacao_id ?? null,
            nome: t,
            responsavel_pos_venda: i.userId,
            situacao: "ativo",
            observacoes: `Cadastrado pela divisão de carteira — entrada original: "${i.nomeLista}".`,
          })),
      );
      if (!linhas.length) return;

      const { error } = await supabase.from("clientes").upsert(linhas as never, { onConflict: "user_id,nome" });
      if (error) throw error;

      setCriados(linhas.length);
      setNovos({});
      toast.success(`${linhas.length} fichas de cliente criadas`);
      await carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar os clientes");
    } finally {
      setSaving(false);
    }
  };


  const Card = ({
    icon,
    titulo,
    cor,
    children,
  }: {
    icon: React.ReactNode;
    titulo: string;
    cor: string;
    children: React.ReactNode;
  }) => (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className={`flex items-center gap-2 font-serif text-lg font-bold mb-3 ${cor}`}>
        {icon}
        {titulo}
      </h2>
      {children}
    </section>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Confira antes de gravar. Nomes não encontrados ficam na lista à parte para você vincular à mão ou
        cadastrar.
      </p>


      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-2xl font-bold text-emerald-700">{exatos.length}</p>
              <p className="text-xs text-muted-foreground">Prontos para gravar</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-2xl font-bold text-amber-600">{duplicados.length}</p>
              <p className="text-xs text-muted-foreground">Cadastros duplicados</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-2xl font-bold text-destructive">{semMatch.length}</p>
              <p className="text-xs text-muted-foreground">Não encontrados</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={gravar} disabled={saving || totalGravar === 0}>
              {saving ? "Gravando…" : `Confirmar e gravar (${totalGravar})`}
            </Button>
            {gravado > 0 && (
              <span className="text-sm text-emerald-700 font-semibold">
                {gravado} clientes atualizados na última gravação.
              </span>
            )}
            {criados > 0 && (
              <span className="text-sm text-emerald-700 font-semibold">
                {criados} fichas novas criadas.
              </span>
            )}
          </div>

          <Card icon={<CheckCircle2 className="w-5 h-5" />} titulo={`Vão ser gravados (${exatos.length})`} cor="text-emerald-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Nome na lista</th>
                    <th className="text-left px-3 py-2">Cliente no cadastro</th>
                    <th className="text-left px-3 py-2">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {exatos.map((i) => (
                    <tr key={i.nomeLista} className="border-t border-border">
                      <td className="px-3 py-2">{i.nomeLista}</td>
                      <td className="px-3 py-2 font-semibold">{i.candidatos[0].nome}</td>
                      <td className="px-3 py-2">{i.responsavelNome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {duplicados.length > 0 && (
            <Card icon={<Copy className="w-5 h-5" />} titulo={`Duplicados na base (${duplicados.length})`} cor="text-amber-600">
              <p className="text-xs text-muted-foreground mb-3">
                O mesmo cliente aparece mais de uma vez. Marque qual cadastro recebe o responsável (pode marcar
                os dois).
              </p>
              <div className="space-y-4">
                {duplicados.map((i) => (
                  <div key={i.nomeLista} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">
                      {i.nomeLista} <span className="font-normal text-muted-foreground">→ {i.responsavelNome}</span>
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {i.candidatos.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selecionadosDup(i.nomeLista, i).includes(c.id)}
                            onCheckedChange={() => toggleDup(i.nomeLista, i, c.id)}
                          />
                          {c.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card icon={<HelpCircle className="w-5 h-5" />} titulo={`Não encontrados (${semMatch.length})`} cor="text-destructive">
            <p className="text-xs text-muted-foreground mb-3">
              Pode ser o mesmo cliente com o nome grafado diferente — nesse caso vincule na ficha existente.
              Se for cliente novo, marque os titulares e cadastre: cada pessoa vira uma ficha própria, já com o
              responsável.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Button size="sm" variant="secondary" onClick={cadastrarSelecionados} disabled={saving || totalCadastrar === 0}>
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Cadastrar selecionados ({totalCadastrar})
              </Button>
              <Button size="sm" variant="outline" onClick={() => marcarTodos(semMatch, true)} disabled={saving}>
                Marcar todos
              </Button>
              <Button size="sm" variant="ghost" onClick={() => marcarTodos(semMatch, false)} disabled={saving}>
                Desmarcar todos
              </Button>
            </div>
            <div className="space-y-3">
              {semMatch.map((i) => (
                <div key={i.nomeLista} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">
                    {i.nomeLista} <span className="font-normal text-muted-foreground">→ {i.responsavelNome}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                    {titularesDe(i.nomeLista).map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={!!novos[`${i.nomeLista}|${t}`]}
                          onCheckedChange={() =>
                            setNovos((p) => ({ ...p, [`${i.nomeLista}|${t}`]: !p[`${i.nomeLista}|${t}`] }))
                          }
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Parecidos no cadastro: {sugestoes(i.nomeLista).map((c) => c.nome).join(" · ") || "—"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> Depois de gravar, cada operação do radar passa a mostrar o
            responsável do cliente.
          </p>
        </>
      )}
    </div>
  );
}
