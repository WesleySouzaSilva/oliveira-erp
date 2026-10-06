import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Archive, Search, FileWarning, Loader2, Download, Eye, Filter, User as UserIcon, Calendar,
} from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type Peticao = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  user_id: string;
  processo_id: string | null;
  laudo_id: string | null;
  created_at: string;
  updated_at: string;
  secoes: any;
  metadata: any;
};

const STATUS_COR: Record<string, string> = {
  rascunho: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  finalizada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  arquivada: "bg-muted text-muted-foreground",
};

const TIPO_LABEL: Record<string, string> = {
  pedido_administrativo: "Notificação Administrativa",
  cautelar_antecedente: "Cautelar Antecedente",
  mandamental_alongamento: "Ação Mandamental",
  embargos_execucao: "Embargos à Execução",
  peticao_inicial: "Petição Inicial",
  contestacao: "Contestação",
  recurso: "Recurso",
};

export default function HistoricoPeticoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [peticoes, setPeticoes] = useState<Peticao[]>([]);
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroAutor, setFiltroAutor] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("peticoes")
          .select("id, titulo, tipo, status, user_id, processo_id, laudo_id, created_at, updated_at, secoes, metadata")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const lista = (data ?? []) as Peticao[];
        setPeticoes(lista);
        const userIds = Array.from(new Set(lista.map((p) => p.user_id)));
        if (userIds.length) {
          const { data: perfis } = await supabase
            .from("profiles_publico")
            .select("id, nome")
            .in("id", userIds);
          const map: Record<string, string> = {};
          (perfis ?? []).forEach((p: any) => { map[p.id] = p.nome || "Sem nome"; });
          setAutores(map);
        }
      } catch (e: any) {
        toast.error("Erro ao carregar histórico: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return peticoes.filter((p) => {
      if (filtroTipo !== "all" && p.tipo !== filtroTipo) return false;
      if (filtroAutor !== "all" && p.user_id !== filtroAutor) return false;
      if (filtroStatus !== "all" && p.status !== filtroStatus) return false;
      if (!b) return true;
      return (
        p.titulo.toLowerCase().includes(b) ||
        (autores[p.user_id] || "").toLowerCase().includes(b)
      );
    });
  }, [peticoes, busca, filtroTipo, filtroAutor, filtroStatus, autores]);

  const tiposUnicos = useMemo(() => Array.from(new Set(peticoes.map((p) => p.tipo))), [peticoes]);
  const autoresUnicos = useMemo(
    () => Array.from(new Set(peticoes.map((p) => p.user_id))).map((id) => ({ id, nome: autores[id] || "—" })),
    [peticoes, autores]
  );

  const baixarTexto = (p: Peticao) => {
    const secoes = Array.isArray(p.secoes) ? p.secoes : [];
    const corpo = secoes
      .map((s: any) => `\n\n=== ${s.titulo || "Seção"} ===\n\n${s.conteudo || ""}`)
      .join("");
    const txt = `${p.titulo}\n\nTipo: ${TIPO_LABEL[p.tipo] || p.tipo}\nAutor: ${autores[p.user_id] || ""}\nGerada em: ${formatDateBR(p.created_at)}\n${corpo}`;
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.titulo.replace(/[^a-z0-9]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Archive className="w-8 h-8 text-accent" />
            Histórico de Petições
          </h1>
          <p className="text-muted-foreground mt-1">
            Backup completo de todas as peças geradas pelo sistema. Acesso somente para gestão e equipe jurídica.
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" /> Filtros
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por título ou autor…"
                  className="pl-9"
                />
              </div>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">Todos os tipos</option>
                {tiposUnicos.map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t] || t}</option>
                ))}
              </select>
              <select
                value={filtroAutor}
                onChange={(e) => setFiltroAutor(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">Todos os autores</option>
                {autoresUnicos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="rascunho">Rascunho</option>
                <option value="finalizada">Finalizada</option>
                <option value="enviada">Enviada</option>
                <option value="arquivada">Arquivada</option>
              </select>
            </div>
            <div className="text-xs text-muted-foreground">
              {filtradas.length} de {peticoes.length} peça(s)
            </div>
          </CardContent>
        </Card>

        <DataTable<Peticao>
          data={filtradas}
          loading={loading}
          getRowId={(p) => p.id}
          onRowClick={(p) => navigate(`/peticoes?id=${p.id}`)}
          defaultSort={{ key: "created_at", dir: "desc" }}
          tableId="historico-peticoes"
          columnsToggle
          emptyState={{
            icon: FileWarning,
            title: "Nenhuma petição encontrada",
            description: "Ajuste os filtros ou gere uma nova petição.",
          }}
          columns={[
            {
              key: "titulo",
              header: "Título",
              sortAccessor: (p) => p.titulo,
              alwaysVisible: true,
              render: (p) => <span className="font-semibold text-foreground">{p.titulo}</span>,
            },
            {
              key: "tipo",
              header: "Tipo",
              sortAccessor: (p) => TIPO_LABEL[p.tipo] || p.tipo,
              render: (p) => <Badge variant="outline">{TIPO_LABEL[p.tipo] || p.tipo}</Badge>,
            },
            {
              key: "status",
              header: "Status",
              sortAccessor: (p) => p.status,
              alwaysVisible: true,
              render: (p) => (
                <Badge className={STATUS_COR[p.status] || STATUS_COR.rascunho}>{p.status}</Badge>
              ),
            },
            {
              key: "autor",
              header: "Autor",
              sortAccessor: (p) => autores[p.user_id] || null,
              render: (p) => (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <UserIcon className="w-3.5 h-3.5" />
                  {autores[p.user_id] || "—"}
                </span>
              ),
            },
            {
              key: "secoes",
              header: "Seções",
              align: "right",
              sortAccessor: (p) => (Array.isArray(p.secoes) ? p.secoes.length : 0),
              render: (p) => (Array.isArray(p.secoes) ? p.secoes.length : 0),
            },
            {
              key: "created_at",
              header: "Gerada em",
              sortAccessor: (p) => new Date(p.created_at),
              render: (p) => (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateBR(p.created_at)}
                </span>
              ),
            },
            {
              key: "processo",
              header: "Processo",
              sortable: false,
              render: (p) =>
                p.processo_id ? (
                  <Link to={`/processos/${p.processo_id}`} className="text-xs text-accent hover:underline">
                    Ver processo →
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                ),
            },
            {
              key: "acoes",
              header: "",
              sortable: false,
              align: "right",
              width: "w-44",
              alwaysVisible: true,
              render: (p) => (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => baixarTexto(p)}>
                    <Download className="w-4 h-4 mr-1" /> Backup
                  </Button>
                  <Link to={`/peticoes?id=${p.id}`}>
                    <Button variant="default" size="sm">
                      <Eye className="w-4 h-4 mr-1" /> Abrir
                    </Button>
                  </Link>
                </div>
              ),
            },
          ] as DataTableColumn<Peticao>[]}
        />
      </div>
    </AppLayout>
  );
}