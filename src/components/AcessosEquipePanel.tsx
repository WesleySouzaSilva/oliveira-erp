import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Clock, Trophy, TrendingUp } from "lucide-react";

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

interface UserStat {
  userId: string;
  nome: string;
  papel: string;
  ultimoAcesso: string | null;
  tempoTotalMin: number;
  sessoes: SessionRow[];
}

function fmtDuration(min: number) {
  if (min <= 0) return "—";
  if (min < 1) return `${Math.max(1, Math.round(min * 60))}s`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function sessionDurationMs(s: SessionRow) {
  const end = new Date(s.ended_at || s.last_seen_at).getTime();
  const start = new Date(s.started_at).getTime();
  return Math.max(0, end - start);
}

type Period = "dia" | "semana" | "mes";

function periodStart(p: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "semana") {
    const day = d.getDay(); // 0=dom
    d.setDate(d.getDate() - day);
  } else if (p === "mes") {
    d.setDate(1);
  }
  return d;
}

export function AcessosEquipePanel() {
  const { members, orgId, loading: mLoading } = useOrgMembers();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (mLoading || !orgId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_sessions")
        .select("id,user_id,started_at,last_seen_at,ended_at")
        .eq("organizacao_id", orgId)
        .order("started_at", { ascending: false })
        .limit(5000);
      // Filtra sessões "fantasma": sem ended_at e last_seen igual ao started (heartbeat nunca rodou)
      const filtered = ((data || []) as SessionRow[]).filter((s) => {
        const dur = sessionDurationMs(s);
        if (dur < 5_000 && !s.ended_at) return false; // < 5s e ainda aberta = órfã
        return true;
      });
      setSessions(filtered);
      setLoading(false);
    })();
  }, [orgId, mLoading]);

  const memberMap = useMemo(() => {
    const m = new Map<string, { nome: string; papel: string }>();
    members.forEach((x) => m.set(x.user_id, { nome: x.nome || "Sem nome", papel: x.papel }));
    return m;
  }, [members]);

  const allStats: UserStat[] = useMemo(() => {
    const byUser = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    }
    return members.map((m) => {
      const sess = byUser.get(m.user_id) || [];
      const totalMs = sess.reduce((acc, s) => acc + sessionDurationMs(s), 0);
      return {
        userId: m.user_id,
        nome: m.nome || "Sem nome",
        papel: m.papel,
        ultimoAcesso: sess[0]?.last_seen_at || null,
        tempoTotalMin: totalMs / 60_000,
        sessoes: sess,
      };
    }).sort((a, b) => (b.ultimoAcesso || "").localeCompare(a.ultimoAcesso || ""));
  }, [sessions, members]);

  function buildReport(p: Period) {
    const start = periodStart(p).getTime();
    const acc = new Map<string, { tempoMs: number; sessoes: number }>();
    for (const s of sessions) {
      const dur = sessionDurationMs(s);
      const sStart = new Date(s.started_at).getTime();
      if (sStart < start) continue;
      const cur = acc.get(s.user_id) || { tempoMs: 0, sessoes: 0 };
      cur.tempoMs += dur;
      cur.sessoes += 1;
      acc.set(s.user_id, cur);
    }
    const rows = Array.from(acc.entries()).map(([uid, v]) => ({
      userId: uid,
      nome: memberMap.get(uid)?.nome || "Sem nome",
      papel: memberMap.get(uid)?.papel || "—",
      tempoMin: v.tempoMs / 60_000,
      sessoes: v.sessoes,
    })).sort((a, b) => b.tempoMin - a.tempoMin);
    const totalMin = rows.reduce((a, r) => a + r.tempoMin, 0);
    return { rows, totalMin };
  }

  if (loading || mLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const ReportTable = ({ p, icon: Icon, label }: { p: Period; icon: any; label: string }) => {
    const { rows, totalMin } = buildReport(p);
    const top = rows[0];
    const periodStartMs = periodStart(p).getTime();
    const sessionsByUser = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      if (new Date(s.started_at).getTime() < periodStartMs) continue;
      if (!sessionsByUser.has(s.user_id)) sessionsByUser.set(s.user_id, []);
      sessionsByUser.get(s.user_id)!.push(s);
    }
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" /> Tempo total da equipe</div>
            <p className="text-xl font-semibold mt-1">{fmtDuration(totalMin)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="w-3.5 h-3.5" /> Mais ativo ({label})</div>
            <p className="text-sm font-semibold mt-1">{top?.nome || "—"}</p>
            <p className="text-xs text-muted-foreground">{top ? fmtDuration(top.tempoMin) : ""}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="w-3.5 h-3.5" /> Usuários ativos</div>
            <p className="text-xl font-semibold mt-1">{rows.length}</p>
          </Card>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem registros neste período.</p>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Usuário</th>
                  <th className="px-4 py-2 font-medium">Papel</th>
                  <th className="px-4 py-2 font-medium">Tempo</th>
                  <th className="px-4 py-2 font-medium">Sessões</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <Fragment key={r.userId}>
                    <tr className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">{r.nome}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.papel}</td>
                      <td className="px-4 py-2">{fmtDuration(r.tempoMin)}</td>
                      <td className="px-4 py-2">
                        <button
                          className="text-primary underline"
                          onClick={() => setExpanded(expanded === `${p}:${r.userId}` ? null : `${p}:${r.userId}`)}
                        >
                          {r.sessoes} {expanded === `${p}:${r.userId}` ? "▴" : "▾"}
                        </button>
                      </td>
                    </tr>
                    {expanded === `${p}:${r.userId}` && (
                      <tr className="bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="space-y-1 text-xs">
                            {(sessionsByUser.get(r.userId) || [])
                              .sort((a, b) => b.started_at.localeCompare(a.started_at))
                              .map((s) => {
                                const dur = sessionDurationMs(s) / 60_000;
                                return (
                                  <div key={s.id} className="flex justify-between border-b border-border/40 py-1">
                                    <span>{fmtDate(s.started_at)} → {fmtDate(s.ended_at || s.last_seen_at)}</span>
                                    <span className="text-muted-foreground">{fmtDuration(dur)} {!s.ended_at && "(ativo)"}</span>
                                  </div>
                                );
                              })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">Acessos da Equipe</h2>
          <p className="text-xs text-muted-foreground">Tempo de uso por usuário (somente Administradores)</p>
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="dia">Diário</TabsTrigger>
          <TabsTrigger value="semana">Semanal</TabsTrigger>
          <TabsTrigger value="mes">Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          {allStats.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">Nenhum acesso registrado ainda.</p>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Usuário</th>
                      <th className="px-4 py-3 font-medium">Papel</th>
                      <th className="px-4 py-3 font-medium">Último acesso</th>
                      <th className="px-4 py-3 font-medium">Tempo total</th>
                      <th className="px-4 py-3 font-medium">Sessões</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {allStats.map((u) => (
                      <Fragment key={u.userId}>
                        <tr className="border-t hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{u.nome}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.papel}</td>
                          <td className="px-4 py-3">{fmtDate(u.ultimoAcesso)}</td>
                          <td className="px-4 py-3">{fmtDuration(u.tempoTotalMin)}</td>
                          <td className="px-4 py-3">{u.sessoes.length}</td>
                          <td className="px-4 py-3 text-right">
                            {u.sessoes.length > 0 && (
                              <button
                                className="text-primary text-xs underline"
                                onClick={() => setExpanded(expanded === u.userId ? null : u.userId)}
                              >
                                {expanded === u.userId ? "Ocultar" : "Ver detalhes"}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded === u.userId && (
                          <tr className="bg-muted/20">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="space-y-1 text-xs">
                                {u.sessoes.slice(0, 30).map((s) => {
                                  const dur = sessionDurationMs(s) / 60_000;
                                  return (
                                    <div key={s.id} className="flex justify-between border-b border-border/40 py-1">
                                      <span>{fmtDate(s.started_at)} → {fmtDate(s.ended_at || s.last_seen_at)}</span>
                                      <span className="text-muted-foreground">{fmtDuration(dur)} {!s.ended_at && "(ativo)"}</span>
                                    </div>
                                  );
                                })}
                                {u.sessoes.length > 30 && (
                                  <p className="text-muted-foreground pt-1">+ {u.sessoes.length - 30} sessões anteriores</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dia" className="mt-4"><ReportTable p="dia" icon={Clock} label="hoje" /></TabsContent>
        <TabsContent value="semana" className="mt-4"><ReportTable p="semana" icon={Clock} label="semana" /></TabsContent>
        <TabsContent value="mes" className="mt-4"><ReportTable p="mes" icon={Clock} label="mês" /></TabsContent>
      </Tabs>
    </div>
  );
}