import { InlineLoader } from "@/components/ui/loaders";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";

interface Tentativa {
  id: string;
  user_id: string;
  data_tentada: string;
  contexto: string;
  pagina: string | null;
  created_at: string;
}

export default function TentativasFuturas() {
  const { isAdmin, loading: permLoading } = usePermissions();
  const [rows, setRows] = useState<Tentativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroUser, setFiltroUser] = useState<string>("all");
  const [filtroPagina, setFiltroPagina] = useState<string>("all");
  const [desde, setDesde] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const { members } = useOrgMembers();
  const nameOf = (uid: string) =>
    members.find((m) => m.user_id === uid)?.nome || uid.slice(0, 8);

  useEffect(() => {
    if (permLoading || !isAdmin) return;
    (async () => {
      const { data, error } = await supabase
        .from("mkt_tentativas_data_futura")
        .select("id,user_id,data_tentada,contexto,pagina,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error) setRows((data || []) as Tentativa[]);
      setLoading(false);
    })();
  }, [isAdmin, permLoading]);

  if (!permLoading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    const hojeYmd = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => {
      if (filtroUser !== "all" && r.user_id !== filtroUser) return false;
      if (filtroPagina !== "all" && (r.pagina || "—") !== filtroPagina) return false;
      const d = r.created_at.slice(0, 10);
      if (desde && d < desde) return false;
      if (ate && d > ate) return false;
      return true;
      void hojeYmd;
    });
  }, [rows, filtroUser, filtroPagina, desde, ate]);

  const porUsuario = filtered.reduce<Record<string, number>>((acc, r) => {
    acc[r.user_id] = (acc[r.user_id] || 0) + 1;
    return acc;
  }, {});

  const novasHoje = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => r.created_at.slice(0, 10) === hoje).length;
  }, [rows]);

  const paginas = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.pagina || "—"));
    return Array.from(set);
  }, [rows]);

  const chartData = useMemo(() => {
    return Object.entries(porUsuario)
      .map(([uid, qtd]) => ({ nome: nameOf(uid), qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [porUsuario, members]);

  const exportCSV = () => {
    const lines = [
      ["Quando", "Usuário", "Data tentada", "Contexto", "Página"].join(";"),
      ...filtered.map((r) =>
        [
          format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
          nameOf(r.user_id),
          format(parseISO(r.data_tentada), "dd/MM/yyyy", { locale: ptBR }),
          r.contexto,
          r.pagina || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tentativas-data-futura-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-destructive" />
              Tentativas em data futura
            </h1>
            <p className="text-sm text-muted-foreground">
              Auditoria das vezes em que alguém da equipe tentou lançar dados em uma
              data ainda não atingida. Útil para identificar mau-uso ou falhas de processo.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tentativas totais</p>
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-[11px] text-muted-foreground">de {rows.length} registradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Usuários distintos</p>
              <p className="text-2xl font-bold">{Object.keys(porUsuario).length}</p>
            </CardContent>
          </Card>
          <Card className={novasHoje > 0 ? "border-amber-300" : ""}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Novas hoje</p>
              <p className="text-2xl font-bold">{novasHoje}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Última tentativa</p>
              <p className="text-lg font-semibold">
                {rows[0]
                  ? format(new Date(rows[0].created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Usuário</p>
              <Select value={filtroUser} onValueChange={setFiltroUser}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Array.from(new Set(rows.map((r) => r.user_id))).map((uid) => (
                    <SelectItem key={uid} value={uid}>{nameOf(uid)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Página</p>
              <Select value={filtroPagina} onValueChange={setFiltroPagina}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {paginas.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">De</p>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Até</p>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Top usuários com tentativas</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="nome" width={140} fontSize={11} />
                  <ReTooltip />
                  <Bar dataKey="qtd" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico (últimas 500)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <InlineLoader />
            ) : filtered.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma tentativa para os filtros selecionados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead>Data tentada</TableHead>
                    <TableHead>Contexto</TableHead>
                    <TableHead>Página</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{nameOf(r.user_id)}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">
                          {format(parseISO(r.data_tentada), "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.contexto}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.pagina || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}