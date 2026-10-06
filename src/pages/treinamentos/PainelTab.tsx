import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atrasada, db, fmtData, nomeSetor, PapelTrein, Setor, setoresEditaveis, STATUS_ATRIB } from "@/lib/treinamentos";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entrarVerComo, usePodeVerComo } from "@/components/VerComo";
import { useAuth } from "@/contexts/AuthContext";
import { useSomenteLeitura } from "@/lib/verComo";

/** Atalho "ver como" ao lado da pessoa (só admin/CEO reais, fora do modo). */
function BotaoVerComo({ uid, nome }: { uid: string; nome: string }) {
  const pode = usePodeVerComo();
  const leitura = useSomenteLeitura();
  const { user } = useAuth();
  const nav = useNavigate();
  if (!pode || leitura || uid === user?.id) return null;
  return (
    <Button size="sm" variant="ghost" className="h-6 px-1.5 ml-1 text-muted-foreground" aria-label={`Ver como ${nome}`} title={`Ver como ${nome}`}
      onClick={async () => { if (await entrarVerComo(uid, nome)) nav("/treinamentos?aba=meus"); }}>
      <Eye className="w-3.5 h-3.5" />
    </Button>
  );
}

export default function PainelTab({ setores, papel }: { setores: Setor[]; papel: PapelTrein }) {
  const { members } = useOrgMembers();
  const [atribs, setAtribs] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [ms, setMs] = useState<any[]>([]);
  const [fSetor, setFSetor] = useState("todos");
  const [fPessoa, setFPessoa] = useState("todas");
  const [passagem, setPassagem] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      db.from("trein_atribuicoes").select("*"),
      db.from("trein_trilhas").select("id,titulo,setor_id,obrigatoria,publicada,arquivada"),
      db.from("membro_setores").select("user_id,setor_id"),
    ]).then(([a, t, m]: any) => { setAtribs(a.data || []); setTrilhas(t.data || []); setMs(m.data || []); });
    (async () => {
      const { data: ps } = await db.from("provas").select("id,titulo").eq("finalidade", "passagem_de_cargo").is("deleted_at", null);
      const ids = (ps || []).map((p: any) => p.id);
      if (!ids.length) { setPassagem([]); return; }
      const { data: aps } = await db.from("prova_aplicacoes")
        .select("id,prova_id,user_id,nota,aprovado,status,enviada_em").in("prova_id", ids).eq("status", "corrigida");
      setPassagem((aps || []).map((a: any) => ({ ...a, prova: (ps || []).find((p: any) => p.id === a.prova_id) })));
    })();
  }, []);

  const escopo = useMemo(() => setoresEditaveis(setores, papel), [setores, papel]);
  const nome = (uid: string) => members.find((m) => m.user_id === uid)?.nome || "Membro";
  const trilha = (id: string) => trilhas.find((t) => t.id === id);

  const linhas = atribs.filter((a) => {
    if (fPessoa !== "todas" && a.user_id !== fPessoa) return false;
    if (fSetor === "todos") return true;
    const s = trilha(a.trilha_id)?.setor_id;
    return s === fSetor || setores.find((x) => x.id === s)?.pai_id === fSetor;
  });

  const pessoas = Array.from(new Set(atribs.map((a) => a.user_id)))
    .sort((a, b) => nome(a).localeCompare(nome(b)));
  const trilhasMatriz = trilhas
    .filter((t) => !t.arquivada && atribs.some((a) => a.trilha_id === t.id))
    .sort((a, b) => Number(!!b.obrigatoria) - Number(!!a.obrigatoria) || a.titulo.localeCompare(b.titulo));
  const resumo = (lista: any[]) => ({
    concl: lista.filter((a) => a.status === "concluida").length,
    and: lista.filter((a) => a.status !== "concluida" && !atrasada(a)).length,
    atr: lista.filter(atrasada).length,
    media: (() => { const n = lista.filter((a) => a.nota_final != null).map((a) => Number(a.nota_final)); return n.length ? (n.reduce((x, y) => x + y, 0) / n.length).toFixed(1).replace(".", ",") : ""; })(),
  });
  const total = resumo(linhas);

  const porSetor = escopo.map((s) => {
    const membrosSetor = new Set(ms.filter((m) => m.setor_id === s.id).map((m) => m.user_id));
    return { s, n: membrosSetor.size, ...resumo(atribs.filter((a) => membrosSetor.has(a.user_id) && (trilha(a.trilha_id)?.setor_id === s.id || trilha(a.trilha_id)?.setor_id === s.pai_id || setores.find((x) => x.id === trilha(a.trilha_id)?.setor_id)?.institucional))) };
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Concluídos", total.concl], ["Em andamento ou não iniciados", total.and], ["Atrasados", total.atr], ["Nota média", total.media ? `${total.media}%` : "sem notas"]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-serif">{v}</p></div>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="font-serif text-lg">Por setor</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Setor</TableHead><TableHead>Pessoas</TableHead><TableHead>Concluídos</TableHead><TableHead>Em andamento</TableHead><TableHead>Atrasados</TableHead><TableHead>Nota média</TableHead></TableRow></TableHeader>
          <TableBody>{porSetor.map(({ s, n, concl, and, atr, media }) => (
            <TableRow key={s.id}><TableCell>{nomeSetor(setores, s.id)}</TableCell><TableCell>{n}</TableCell><TableCell>{concl}</TableCell><TableCell>{and}</TableCell>
              <TableCell className={atr ? "text-destructive font-medium" : ""}>{atr}</TableCell><TableCell>{media ? `${media}%` : ""}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </section>

      <section className="space-y-2">
        <h3 className="font-serif text-lg">Pessoa por trilha</h3>
        <p className="text-xs text-muted-foreground">Trilha obrigatória sem nenhum progresso aparece em vermelho.</p>
        {!trilhasMatriz.length || !pessoas.length ? (
          <p className="text-sm text-muted-foreground">Ainda não há atribuições para montar o quadro.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Pessoa</TableHead>
                {trilhasMatriz.map((t) => <TableHead key={t.id} className="whitespace-nowrap">{t.titulo}{t.obrigatoria ? " (obrigatória)" : ""}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {pessoas.map((uid) => (
                  <TableRow key={uid}>
                    <TableCell className="whitespace-nowrap">{nome(uid)}<BotaoVerComo uid={uid} nome={nome(uid)} /></TableCell>
                    {trilhasMatriz.map((t) => {
                      const a = atribs.find((x) => x.user_id === uid && x.trilha_id === t.id);
                      if (!a) return <TableCell key={t.id} className="text-muted-foreground">—</TableCell>;
                      const zerado = t.obrigatoria && a.status === "pendente";
                      return (
                        <TableCell key={t.id} className={zerado ? "text-destructive font-medium" : atrasada(a) ? "text-destructive" : ""}>
                          {a.status === "concluida" ? "Concluída" : zerado ? "Não começou" : STATUS_ATRIB[a.status].label}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {!!passagem.length && (
        <section className="space-y-2">
          <h3 className="font-serif text-lg">Provas de passagem de cargo</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Prova</TableHead><TableHead>Data</TableHead><TableHead>Nota</TableHead><TableHead>Resultado</TableHead></TableRow></TableHeader>
            <TableBody>{passagem.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.user_id ? nome(p.user_id) : ""}</TableCell>
                <TableCell>{p.prova?.titulo}</TableCell>
                <TableCell>{fmtData(p.enviada_em)}</TableCell>
                <TableCell>{p.nota == null ? "" : `${String(p.nota).replace(".", ",")}%`}</TableCell>
                <TableCell className={p.aprovado ? "" : "text-destructive"}>{p.aprovado ? "Aprovado" : "Não aprovado"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-lg flex-1">Por pessoa</h3>
          <Select value={fSetor} onValueChange={setFSetor}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos os setores</SelectItem>{escopo.map((s) => <SelectItem key={s.id} value={s.id}>{nomeSetor(setores, s.id)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={fPessoa} onValueChange={setFPessoa}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas as pessoas</SelectItem>{pessoas.map((u) => <SelectItem key={u} value={u}>{nome(u)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {!linhas.length ? <p className="text-sm text-muted-foreground">Nenhuma atribuição no seu escopo ainda.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Trilha</TableHead><TableHead>Situação</TableHead><TableHead>Prazo</TableHead><TableHead>Nota</TableHead></TableRow></TableHeader>
            <TableBody>{linhas.sort((a, b) => nome(a.user_id).localeCompare(nome(b.user_id))).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap">{nome(a.user_id)}<BotaoVerComo uid={a.user_id} nome={nome(a.user_id)} /></TableCell>
                <TableCell>{trilha(a.trilha_id)?.titulo}</TableCell>
                <TableCell>{atrasada(a) ? <span className="text-destructive font-medium">Atrasado</span> : STATUS_ATRIB[a.status].label}</TableCell>
                <TableCell>{a.status === "concluida" ? `Concluído em ${fmtData(a.concluida_em)}` : fmtData(a.prazo_em) || "Sem prazo"}</TableCell>
                <TableCell>{a.nota_final != null ? `${String(a.nota_final).replace(".", ",")}%` : ""}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
