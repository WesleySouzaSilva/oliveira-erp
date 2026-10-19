import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, History, Loader2, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mensagemDeErro } from "@/lib/api/http";
import { listarAuditoria, type LinhaAuditoria } from "@/lib/api/auditoria";

/**
 * Auditoria — trilha de TODO movimento do sistema (admin/ceo), pedido do titular em
 * 16/10/2026: quem criou/editou/excluiu o quê, em qual tabela, quando e de QUAL PC
 * (coluna IP — que é só aqui: o histórico da tarefa não mostra IP ao usuário).
 * Senhas e tokens nunca aparecem: a API sanitiza antes de gravar.
 */
const TABELAS = [
  { valor: "usuarios", rotulo: "Usuários" },
  { valor: "funcoes", rotulo: "Funções" },
  { valor: "setores", rotulo: "Setores" },
  { valor: "permission_groups", rotulo: "Permissões" },
  { valor: "contratos_cliente", rotulo: "Contratos" },
  { valor: "tarefas", rotulo: "Tarefas" },
];

const rotuloTabela = (valor: string) =>
  TABELAS.find((tabela) => tabela.valor === valor)?.rotulo ?? valor;

const dataHora = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

const corDaAcao = (acao: string) => {
  if (acao.includes("EXCLUIR")) return "destructive" as const;
  if (acao.includes("CRIAR")) return "default" as const;
  return "secondary" as const;
};

export default function Auditoria() {
  const [linhas, setLinhas] = useState<LinhaAuditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  const [tabela, setTabela] = useState("");
  const [acao, setAcao] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const carregar = useCallback(async (paginaAtual: number) => {
    setCarregando(true);
    try {
      const resultado = await listarAuditoria({
        tabela: tabela || undefined,
        acao: acao || undefined,
        de: de || undefined,
        ate: ate || undefined,
        page: paginaAtual,
        size: 50,
      });
      setLinhas(resultado.content);
      setTotal(resultado.page.totalElements);
      setTotalPaginas(resultado.page.totalPages);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setCarregando(false);
    }
  }, [tabela, acao, de, ate]);

  useEffect(() => {
    setPagina(0);
    void carregar(0);
  }, [carregar]);

  const alternarDados = (id: string) =>
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const deAte = pagina * 50 + 1;
  const ateAte = Math.min((pagina + 1) * 50, total);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        icon={ScrollText}
        title="Auditoria"
        subtitle={`${total} registro${total === 1 ? "" : "s"} — quem fez o quê, quando e de qual PC (IP)`}
        breadcrumb={[{ label: "Módulos na API" }, { label: "Auditoria" }]}
      />

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="aud-tabela">Tabela</Label>
            <select
              id="aud-tabela"
              value={tabela}
              onChange={(evento) => setTabela(evento.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {TABELAS.map((item) => (
                <option key={item.valor} value={item.valor}>{item.rotulo}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="aud-acao">Ação</Label>
            <select
              id="aud-acao"
              value={acao}
              onChange={(evento) => setAcao(evento.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              <option value="CRIAR">Criação</option>
              <option value="EDITAR">Edição</option>
              <option value="EXCLUIR">Exclusão</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="aud-de">De</Label>
            <Input id="aud-de" type="date" value={de} onChange={(evento) => setDe(evento.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="aud-ate">Até</Label>
            <Input id="aud-ate" type="date" value={ate} onChange={(evento) => setAte(evento.target.value)} />
          </div>
        </div>
      </Card>

      {carregando ? (
        <ListSkeleton rows={8} />
      ) : linhas.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum movimento"
          description="Nada registrado com estes filtros. Movimentações de cadastros, contratos e tarefas aparecem aqui."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>O quê</TableHead>
                  <TableHead>PC (IP)</TableHead>
                  <TableHead className="w-24 text-right">Dados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha) => (
                  <TableRow key={linha.id}>
                    <TableCell className="whitespace-nowrap text-xs">{dataHora(linha.quando)}</TableCell>
                    <TableCell className="text-sm">{linha.usuarioNome ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={corDaAcao(linha.acao)}>{linha.acao}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {rotuloTabela(linha.tabela)}
                      <span className="text-[11px] text-muted-foreground block truncate max-w-[18rem]">
                        {linha.registroId ?? ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{linha.ip ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => alternarDados(linha.id)}
                      >
                        {abertas.has(linha.id) ? "Ocultar" : "Ver"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {linhas.map((linha) =>
                  abertas.has(linha.id) ? (
                    <TableRow key={`${linha.id}-dados`} className="bg-secondary/30">
                      <TableCell colSpan={6} className="font-mono text-[11px] whitespace-pre-wrap">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="font-sans text-xs font-semibold mb-1">Dados gravados</p>
                            <pre className="max-h-64 overflow-y-auto">
                              {JSON.stringify(linha.dadosNovos ?? {}, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="font-sans text-xs font-semibold mb-1">Antes da mudança</p>
                            <pre className="max-h-64 overflow-y-auto">
                              {JSON.stringify(linha.dadosAntigos ?? {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null,
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Paginação */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{total === 0 ? 0 : deAte}–{ateAte} de {total}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPagina(Math.max(0, pagina - 1))}
              disabled={pagina === 0}
              aria-label="Página anterior"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-input disabled:opacity-40 hover:bg-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            <button
              type="button"
              onClick={() => setPagina(Math.min(totalPaginas - 1, pagina + 1))}
              disabled={pagina >= totalPaginas - 1}
              aria-label="Próxima página"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-input disabled:opacity-40 hover:bg-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
