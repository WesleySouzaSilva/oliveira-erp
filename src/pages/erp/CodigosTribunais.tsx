import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Copy, Eye, History, KeyRound, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { mensagemDeErro, usuarioApi } from "@/lib/api/http";
import {
  criarCredencialTribunal,
  gerarCodigoTribunal,
  historicoTribunal,
  listarCredenciaisTribunal,
  renomearCredencialTribunal,
  removerCredencialTribunal,
  type CodigoTribunal,
  type ConsultaTribunal,
  type CredencialTribunal,
} from "@/lib/api/tribunais";
import { TutorialCodigos } from "@/components/erp/TutorialCodigosTribunais";

/**
 * Códigos dos tribunais (menu Ferramentas) — port da tela legada
 * (`pages/CodigosTribunais.tsx`) para a API própria, com a regra nova do
 * titular (19/10/2026):
 *
 * - Ver a lista e GERAR o codigo: TODOS os usuarios (a API nao recusa);
 * - Cadastrar, renomear, remover e ver o historico: SO admin (a API devolve
 *   403 — o front so esconde os botoes).
 *
 * O segredo nunca desce (nem para admin): cada "Ver codigo" pede o codigo
 * ao vivo para `/tribunais/{id}/codigo`, com trilha registrada no servidor.
 */

// Depois de ~5 minutos com o codigo na tela, para de renovar sozinho — evita
// que uma aba esquecida aberta fique consultando indefinidamente.
const MAX_RENOVACOES = 10;

export default function CodigosTribunais() {
  const admin = usuarioApi()?.admin === true;
  const [credenciais, setCredenciais] = useState<CredencialTribunal[] | null>(null);
  /** Codigo na tela de um acesso: o payload da API + quando expira (epoch ms). */
  interface CodigoAtivo extends CodigoTribunal {
    ate: number;
    renovacoes: number;
  }
  const [codigos, setCodigos] = useState<Record<string, CodigoAtivo>>({});
  const [, forcarRender] = useState(0);
  const buscando = useRef<Set<string>>(new Set());
  const confirmar = useConfirm();

  // dialogs
  const [novoAberto, setNovoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", segredo: "" });
  const [conferencia, setConferencia] = useState<{ id: string; nome: string } | null>(null);
  const [renomeando, setRenomeando] = useState<CredencialTribunal | null>(null);
  const [novoNome, setNovoNome] = useState({ nome: "", descricao: "" });
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historico, setHistorico] = useState<ConsultaTribunal[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [mostrarRenovacoes, setMostrarRenovacoes] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCredenciais(await listarCredenciaisTribunal());
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
      setCredenciais([]);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const buscarCodigo = useCallback(async (cred: { id: string }, renovacoes = 0) => {
    if (buscando.current.has(cred.id)) return;
    buscando.current.add(cred.id);
    try {
      const codigo = await gerarCodigoTribunal(cred.id);
      setCodigos((atual) => ({
        ...atual,
        [cred.id]: { ...codigo, ate: Date.now() + codigo.expiraEm * 1000, renovacoes },
      }));
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
      setCodigos((atual) => { const n = { ...atual }; delete n[cred.id]; return n; });
    } finally {
      buscando.current.delete(cred.id);
    }
  }, []);

  // Relogio: redesenha o contador e renova o codigo quando expira.
  useEffect(() => {
    const t = window.setInterval(() => {
      forcarRender((n) => n + 1);
      const agora = Date.now();
      for (const cred of credenciais ?? []) {
        const ativo = codigos[cred.id];
        if (!ativo || agora < ativo.ate) continue;
        if (ativo.renovacoes >= MAX_RENOVACOES) continue;
        buscarCodigo(cred, ativo.renovacoes + 1);
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [credenciais, codigos, buscarCodigo]);

  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const criar = async () => {
    if (!form.nome.trim() || !form.segredo.trim()) {
      toast.error("Informe o nome e a chave");
      return;
    }
    setSalvando(true);
    try {
      const criada = await criarCredencialTribunal({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || undefined,
        segredo: form.segredo.replace(/\s+/g, ""),
      });
      setNovoAberto(false);
      setForm({ nome: "", descricao: "", segredo: "" });
      await carregar();
      // Conferencia com o codigo AO VIVO (o congelado do cadastro vencia antes
      // de o admin terminar de configurar o celular — mesma licao do legado).
      setConferencia({ id: criada.id, nome: criada.nome });
      buscarCodigo({ id: criada.id });
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (cred: CredencialTribunal) => {
    const confirmado = await confirmar({
      title: "Remover acesso",
      description: `"${cred.nome}" é apagado e deixa de aparecer para todos, e o nome fica livre para ser usado de novo. O histórico de consultas é preservado. Guarde a chave original antes, se ainda precisar dela — ela não é recuperável.`,
      destructive: true,
      confirmText: "Remover",
    });
    if (!confirmado) return;
    try {
      await removerCredencialTribunal(cred.id);
      toast.success("Acesso removido");
      void carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  };

  const renomear = async () => {
    if (!renomeando || !novoNome.nome.trim()) return;
    setSalvando(true);
    try {
      await renomearCredencialTribunal(renomeando.id, {
        nome: novoNome.nome.trim(),
        descricao: novoNome.descricao.trim() || undefined,
      });
      toast.success("Nome atualizado");
      setRenomeando(null);
      void carregar();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const abrirHistorico = async () => {
    setHistoricoAberto(true);
    setCarregandoHistorico(true);
    try {
      setHistorico(await historicoTribunal());
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
      setHistorico([]);
    } finally {
      setCarregandoHistorico(false);
    }
  };

  if (!credenciais) {
    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <ListSkeleton rows={3} />
      </div>
    );
  }

  // Renovacoes automaticas ficam escondidas por padrao: sao a maioria absoluta
  // das linhas e enterram o que importa — quem abriu o que, e quando.
  const renovacoes = historico.filter((r) => r.renovacao).length;
  const historicoVisivel = mostrarRenovacoes ? historico : historico.filter((r) => !r.renovacao);

  return (
    <div className="p-4 sm:p-6 lg:p-10 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Códigos dos tribunais"
        subtitle="Verificação em duas etapas sem depender do celular — toda consulta fica registrada"
        breadcrumb={[{ label: "Ferramentas" }, { label: "Códigos dos tribunais" }]}
        actions={
          <div className="flex items-center gap-2">
            <TutorialCodigos admin={admin} />
            {admin && (
              <>
                <Button variant="outline" size="sm" onClick={abrirHistorico}>
                  <History className="w-4 h-4" /> Histórico
                </Button>
                <Button size="sm" onClick={() => setNovoAberto(true)}>
                  <Plus className="w-4 h-4" /> Novo acesso
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={carregar} aria-label="Atualizar lista">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {credenciais.length === 0 && (
        <EmptyState
          icon={KeyRound}
          title="Nenhum acesso cadastrado"
          description={
            admin
              ? "Use \"Novo acesso\" para cadastrar o primeiro tribunal ou sistema."
              : "Nenhum acesso cadastrado ainda. Fale com o administrador."
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {credenciais.map((cred) => {
          const ativo = codigos[cred.id];
          const ate = ativo?.ate ?? 0;
          const restante = ativo ? Math.max(0, Math.ceil((ate - Date.now()) / 1000)) : 0;
          const proporcao = ativo ? Math.max(0, Math.min(1, restante / ativo.periodo)) : 0;
          const esgotando = restante <= 5;

          return (
            <Card key={cred.id} className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold tracking-tight truncate" title={cred.nome}>{cred.nome}</h2>
                  {cred.descricao && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cred.descricao}</p>
                  )}
                </div>
                {admin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Renomear"
                      onClick={() => {
                        setRenomeando(cred);
                        setNovoNome({ nome: cred.nome, descricao: cred.descricao ?? "" });
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => remover(cred)}
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {!ativo ? (
                <Button variant="outline" onClick={() => buscarCodigo(cred)}>
                  <Eye className="w-4 h-4" /> Ver código
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`font-mono text-3xl tracking-[0.2em] tabular-nums ${esgotando ? "text-destructive" : "text-foreground"}`}
                    >
                      {ativo.codigo}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => copiar(ativo.codigo)}>
                      <Copy className="w-4 h-4" /> Copiar
                    </Button>
                  </div>
                  <div className="h-1 w-full rounded bg-secondary overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-500 ease-linear ${esgotando ? "bg-destructive" : "bg-accent"}`}
                      style={{ width: `${proporcao * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ativo.renovacoes >= MAX_RENOVACOES
                      ? "Renovação automática pausada — clique em atualizar para continuar."
                      : `Expira em ${restante}s`}
                  </p>
                  {ativo.renovacoes >= MAX_RENOVACOES && (
                    <Button variant="outline" size="sm" onClick={() => buscarCodigo(cred)}>
                      <RefreshCw className="w-4 h-4" /> Gerar novo
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Cadastro — so admin (o botao so existe para admin; a API tambem barra) */}
      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar acesso de tribunal</DialogTitle>
            <DialogDescription>
              A chave é gravada cifrada e nunca mais é exibida. Guarde uma cópia no
              cofre físico antes de continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do acesso</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Projudi TJ-PR"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: login do escritório, certificado do Dr. Crystian"
              />
            </div>
            <div className="space-y-2">
              <Label>Chave de configuração</Label>
              <Input
                value={form.segredo}
                onChange={(e) => setForm({ ...form, segredo: e.target.value })}
                placeholder="JBSWY3DPEHPK3PXP..."
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                É o texto que aparece em "não consegue escanear o código?" na tela de
                configuração do autenticador. Só letras de A a Z e números de 2 a 7.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={salvando}>
              {salvando ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conferência pós-cadastro: comparar com o celular antes de confiar */}
      <Dialog open={!!conferencia} onOpenChange={(o) => !o && setConferencia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confira antes de confiar</DialogTitle>
            <DialogDescription>
              "{conferencia?.nome}" foi cadastrado. Abra o autenticador no celular e veja
              se ele mostra o mesmo número. O código abaixo gira sozinho, então leve o
              tempo que precisar.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const c = conferencia ? codigos[conferencia.id] : undefined;
            if (!c) return <p className="py-8 text-center text-muted-foreground">Gerando código...</p>;
            const ate = c.ate;
            const restante = Math.max(0, Math.ceil((ate - Date.now()) / 1000));
            return (
              <div className="space-y-2 py-2">
                <p className="font-mono text-4xl tracking-[0.2em] text-center tabular-nums">{c.codigo}</p>
                <div className="h-1 w-full rounded bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-accent transition-[width] duration-500 ease-linear"
                    style={{ width: `${Math.max(0, Math.min(1, restante / c.periodo)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">Muda em {restante}s</p>
              </div>
            );
          })()}
          <p className="text-xs text-muted-foreground text-center">
            Se o celular mostrar outro número, a chave foi digitada errada: remova o
            acesso e cadastre de novo.
          </p>
          <DialogFooter>
            <Button onClick={() => setConferencia(null)}>Confere</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear — não toca no segredo */}
      <Dialog open={!!renomeando} onOpenChange={(o) => !o && setRenomeando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear acesso</DialogTitle>
            <DialogDescription>
              Muda só o rótulo. A chave e o histórico continuam como estão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do acesso</Label>
              <Input
                value={novoNome.nome}
                onChange={(e) => setNovoNome({ ...novoNome, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={novoNome.descricao}
                onChange={(e) => setNovoNome({ ...novoNome, descricao: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomeando(null)}>Cancelar</Button>
            <Button onClick={renomear} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico — so admin */}
      <Dialog open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de acesso aos códigos</DialogTitle>
            <DialogDescription>
              Últimos 200 registros.
              {renovacoes > 0 && (
                <>
                  {" "}
                  {mostrarRenovacoes ? "Mostrando" : "Ocultando"} {renovacoes} renovação(ões)
                  automática(s).{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => setMostrarRenovacoes((v) => !v)}
                  >
                    {mostrarRenovacoes ? "ocultar" : "mostrar"}
                  </button>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto divide-y divide-border/50 text-sm">
            {carregandoHistorico ? (
              <ListSkeleton rows={4} />
            ) : historicoVisivel.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Nenhum registro ainda.</p>
            ) : (
              historicoVisivel.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate">
                      {r.nome || "—"}
                      <span className="text-muted-foreground"> · {r.acao}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.credencialNome || "—"} ·{" "}
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : "—"}
                    </p>
                  </div>
                  {!r.sucesso && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">negado</Badge>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
