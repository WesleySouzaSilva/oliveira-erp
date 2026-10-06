import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, CalendarClock, ClipboardList, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUsuarioEfetivo } from "@/lib/verComo";
import { toast } from "sonner";
import { atrasada, db, fmtData, gerarCertificado, nomeSetor, Setor, STATUS_ATRIB, Trilha, Atribuicao } from "@/lib/treinamentos";

export default function MeusTab({ setores }: { setores: Setor[] }) {
  const { user, somenteLeitura } = useUsuarioEfetivo();
  const nav = useNavigate();
  const [itens, setItens] = useState<{ a: Atribuicao; t: Trilha; pct: number }[]>([]);
  const [provas, setProvas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: aps } = await db.from("prova_aplicacoes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      const lista = aps || [];
      const ids = [...new Set(lista.map((a: any) => a.prova_id))];
      if (!ids.length) { setProvas([]); return; }
      const { data: ps } = await db.from("provas").select("id,titulo,nota_minima").in("id", ids);
      setProvas(lista.map((a: any) => ({ ...a, prova: (ps || []).find((p: any) => p.id === a.prova_id) })).filter((x: any) => x.prova));
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: atribs } = await db.from("trein_atribuicoes").select("*").eq("user_id", user.id);
      const ids = (atribs || []).map((a: any) => a.trilha_id);
      if (!ids.length) { setItens([]); setCarregando(false); return; }
      const [{ data: trilhas }, { data: aulas }, { data: prog }] = await Promise.all([
        db.from("trein_trilhas").select("*").in("id", ids),
        db.from("trein_aulas").select("id,trilha_id").in("trilha_id", ids),
        db.from("trein_aula_progresso").select("aula_id,trilha_id,concluida_em").eq("user_id", user.id).in("trilha_id", ids),
      ]);
      const lista = (atribs || []).map((a: Atribuicao) => {
        const t = (trilhas || []).find((x: any) => x.id === a.trilha_id);
        const tot = (aulas || []).filter((x: any) => x.trilha_id === a.trilha_id).length;
        const feitas = (prog || []).filter((x: any) => x.trilha_id === a.trilha_id && x.concluida_em).length;
        return { a, t, pct: a.status === "concluida" ? 100 : tot ? Math.round((feitas / tot) * 100) : 0 };
      }).filter((x: any) => x.t);
      lista.sort((x: any, y: any) => Number(x.a.status === "concluida") - Number(y.a.status === "concluida")
        || (x.a.prazo_em || "9999").localeCompare(y.a.prazo_em || "9999"));
      setItens(lista);
      setCarregando(false);
    })();
  }, [user?.id]);

  const certificado = async (a: Atribuicao, t: Trilha) => {
    const { data: perfil } = await db.from("profiles").select("nome").eq("id", user!.id).maybeSingle();
    try {
      await gerarCertificado({ nome: perfil?.nome || user?.email || "", trilha: t.titulo, setor: nomeSetor(setores, t.setor_id), data: fmtData(a.concluida_em), nota: a.nota_final });
    } catch { toast.error("Não foi possível gerar o certificado."); }
  };

  const blocoProvas = provas.length ? (
    <section className="space-y-2">
      <h3 className="font-serif text-lg">Provas para você</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {provas.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-start gap-2">
              <ClipboardList className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium leading-tight">{p.prova.titulo}</h4>
                <p className="text-xs text-muted-foreground">Nota mínima {String(p.prova.nota_minima).replace(".", ",")}%</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {p.status === "corrigida" && p.nota != null
                  ? `${p.aprovado ? "Aprovado" : "Não aprovado"}, nota ${String(p.nota).replace(".", ",")}%`
                  : p.status === "respondida" ? "Enviada, aguardando correção" : "Disponível"}
              </span>
              {(p.status === "pendente" || p.status === "em_andamento") && (
                <Button size="sm" disabled={somenteLeitura} onClick={() => nav(`/treinamentos/prova/${p.id}`)}>{p.status === "em_andamento" ? "Continuar" : "Fazer prova"}</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  ) : null;

  if (carregando) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!itens.length) return (
    <div className="space-y-6">
      {blocoProvas}
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nenhum treinamento atribuído a você por enquanto. Veja o Catálogo para começar uma trilha.
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
    {blocoProvas}
    <div className="grid gap-3 md:grid-cols-2">
      {itens.map(({ a, t, pct }) => {
        const st = STATUS_ATRIB[a.status];
        const atr = atrasada(a);
        return (
          <div key={a.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{nomeSetor(setores, t.setor_id)}</p>
                <h3 className="font-serif text-lg leading-tight">{t.titulo}</h3>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                {a.obrigatoria && <Badge variant="outline">Obrigatória</Badge>}
              </div>
            </div>
            <Progress value={pct} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className={`flex items-center gap-1 ${atr ? "text-destructive font-medium" : ""}`}>
                <CalendarClock className="w-3.5 h-3.5" />
                {a.status === "concluida" ? `Concluída em ${fmtData(a.concluida_em)}` : a.prazo_em ? `${atr ? "Atrasada, prazo era" : "Prazo:"} ${fmtData(a.prazo_em)}` : "Sem prazo"}
                {a.nota_final != null && ` (nota ${String(a.nota_final).replace(".", ",")}%)`}
              </span>
              <div className="flex gap-2">
                {a.status === "concluida" && (
                  <Button size="sm" variant="outline" onClick={() => certificado(a, t)}><Award className="w-4 h-4 mr-1" />Certificado</Button>
                )}
                <Button size="sm" onClick={() => nav(`/treinamentos/trilha/${t.id}`)}>
                  <PlayCircle className="w-4 h-4 mr-1" />{a.status === "concluida" ? "Rever" : pct ? "Continuar" : "Começar"}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
