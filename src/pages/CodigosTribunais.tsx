import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListSkeleton } from "@/components/ui/loaders";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TutorialCodigos } from "@/components/tribunais/TutorialCodigos";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Copy, Eye, History, KeyRound, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users,
} from "lucide-react";

interface Credencial {
  id: string;
  nome: string;
  descricao: string | null;
  digitos: number;
  periodo: number;
}

interface CodigoAtivo {
  codigo: string;
  ate: number;      // epoch ms em que expira
  periodo: number;
  renovacoes: number;
}

// Depois de ~5 minutos com o código na tela, para de renovar sozinho.
// Evita que uma aba esquecida aberta fique consultando o segredo indefinidamente.
const MAX_RENOVACOES = 10;

const chamar = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("totp-tribunais", { body });
  if (error) {
    // Em resposta não-2xx o supabase-js não lê o corpo: devolve só
    // "Edge Function returned a non-2xx status code" e joga fora a explicação
    // que a função escreveu. Sem isto, todo erro chega ilegível ao usuário.
    let doServidor: string | null = null;
    try {
      doServidor = (await (error as any)?.context?.json())?.error ?? null;
    } catch {
      // corpo ausente ou não-JSON — fica com a mensagem genérica mesmo
    }
    throw new Error(doServidor || error.message || "Erro inesperado");
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

export default function CodigosTribunais() {
  const [credenciais, setCredenciais] = useState<Credencial[] | null>(null);
  const [custodiante, setCustodiante] = useState(false);
  const [codigos, setCodigos] = useState<Record<string, CodigoAtivo>>({});
  const [, forcarRender] = useState(0);
  const buscando = useRef<Set<string>>(new Set());
  const askConfirm = useConfirm();

  // dialogs
  const [novoAberto, setNovoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", segredo: "" });
  const [conferencia, setConferencia] = useState<{ id: string; nome: string } | null>(null);
  const [renomeando, setRenomeando] = useState<Credencial | null>(null);
  const [novoNome, setNovoNome] = useState({ nome: "", descricao: "" });
  const [acessosDe, setAcessosDe] = useState<Credencial | null>(null);
  const [acessos, setAcessos] = useState<{ user_id: string; nome: string | null }[]>([]);
  const [membros, setMembros] = useState<{ user_id: string; nome: string | null; papel: string }[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [mostrarRenovacoes, setMostrarRenovacoes] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await chamar({ action: "listar" });
      setCredenciais(d.credenciais ?? []);
      setCustodiante(!!d.custodiante);
    } catch (e) {
      toast.error((e as Error).message);
      setCredenciais([]);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const buscarCodigo = useCallback(async (cred: { id: string }, renovacoes = 0) => {
    if (buscando.current.has(cred.id)) return;
    buscando.current.add(cred.id);
    try {
      const d = await chamar({ action: "codigo", credencial_id: cred.id });
      setCodigos((c) => ({
        ...c,
        [cred.id]: {
          codigo: d.codigo,
          ate: Date.now() + d.expira_em * 1000,
          periodo: d.periodo,
          renovacoes,
        },
      }));
    } catch (e) {
      toast.error((e as Error).message);
      setCodigos((c) => { const n = { ...c }; delete n[cred.id]; return n; });
    } finally {
      buscando.current.delete(cred.id);
    }
  }, []);

  // Relógio: redesenha o contador e renova o código quando expira.
  useEffect(() => {
    const t = setInterval(() => {
      forcarRender((n) => n + 1);
      const agora = Date.now();
      for (const cred of credenciais ?? []) {
        const ativo = codigos[cred.id];
        if (!ativo || agora < ativo.ate) continue;
        if (ativo.renovacoes >= MAX_RENOVACOES) continue;
        buscarCodigo(cred, ativo.renovacoes + 1);
      }
    }, 500);
    return () => clearInterval(t);
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
      const d = await chamar({
        action: "criar",
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || undefined,
        segredo: form.segredo.replace(/\s+/g, ""),
      });
      setNovoAberto(false);
      setForm({ nome: "", descricao: "", segredo: "" });
      await carregar();
      // A conferência usa o mesmo código ao vivo dos cartões, girando a cada
      // período. A versão anterior mostrava um número congelado do instante do
      // cadastro, e como configurar o celular leva mais de 30 segundos, ele já
      // estava vencido na hora de comparar — a janela criada para evitar erro
      // era justamente a que induzia ao erro.
      setConferencia({ id: d.credencial.id, nome: d.credencial.nome });
      buscarCodigo({ id: d.credencial.id });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (cred: Credencial) => {
    const ok = await askConfirm({
      title: "Remover acesso",
      description: `"${cred.nome}" é apagado e deixa de aparecer para todos, e o nome fica livre para ser usado de novo. O histórico de consultas é preservado. Guarde a chave original antes, se ainda precisar dela — ela não é recuperável.`,
      destructive: true,
      confirmText: "Remover",
    });
    if (!ok) return;
    try {
      await chamar({ action: "remover", credencial_id: cred.id });
      toast.success("Acesso removido");
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const renomear = async () => {
    if (!renomeando || !novoNome.nome.trim()) return;
    setSalvando(true);
    try {
      await chamar({
        action: "renomear",
        credencial_id: renomeando.id,
        nome: novoNome.nome.trim(),
        descricao: novoNome.descricao.trim() || undefined,
      });
      toast.success("Nome atualizado");
      setRenomeando(null);
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const abrirAcessos = async (cred: Credencial) => {
    setAcessosDe(cred);
    try {
      const [a, m] = await Promise.all([
        chamar({ action: "acessos", credencial_id: cred.id }),
        chamar({ action: "membros" }),
      ]);
      setAcessos(a.acessos ?? []);
      setMembros(m.membros ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const alternarAcesso = async (userId: string, conceder: boolean) => {
    if (!acessosDe) return;
    try {
      await chamar({
        action: conceder ? "conceder" : "revogar",
        credencial_id: acessosDe.id,
        user_id: userId,
      });
      const a = await chamar({ action: "acessos", credencial_id: acessosDe.id });
      setAcessos(a.acessos ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const abrirHistorico = async () => {
    setHistoricoAberto(true);
    try {
      const d = await chamar({ action: "auditoria" });
      setHistorico(d.registros ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!credenciais) {
    return <AppLayout><div className="max-w-4xl mx-auto p-6"><ListSkeleton rows={3} /></div></AppLayout>;
  }

  const comAcesso = new Set(acessos.map((a) => a.user_id));

  // Renovações automáticas ficam escondidas por padrão: elas são a maioria
  // absoluta das linhas e enterram o que importa — quem abriu o quê, e quando.
  const renovacoes = historico.filter((r) => r.detalhe?.renovacao).length;
  const historicoVisivel = mostrarRenovacoes
    ? historico
    : historico.filter((r) => !r.detalhe?.renovacao);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold font-body tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-primary" /> Códigos dos tribunais
            </h1>
            <p className="text-muted-foreground mt-1">
              Código de verificação em duas etapas, sem depender do celular.
              Toda consulta fica registrada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TutorialCodigos custodiante={custodiante} />
            {custodiante && (
              <>
                <Button variant="outline" size="sm" onClick={abrirHistorico}>
                  <History className="w-4 h-4" /> Histórico
                </Button>
                <Button size="sm" onClick={() => setNovoAberto(true)}>
                  <Plus className="w-4 h-4" /> Novo acesso
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={carregar}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {credenciais.length === 0 && (
          <Card className="p-8 text-center">
            <KeyRound className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {custodiante
                ? "Nenhum acesso cadastrado ainda. Use \"Novo acesso\" para cadastrar o primeiro."
                : "Você ainda não tem permissão para ver nenhum código. Fale com o responsável."}
            </p>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {credenciais.map((cred) => {
            const ativo = codigos[cred.id];
            const restante = ativo ? Math.max(0, Math.ceil((ativo.ate - Date.now()) / 1000)) : 0;
            const proporcao = ativo ? Math.max(0, Math.min(1, restante / ativo.periodo)) : 0;
            const esgotando = restante <= 5;

            return (
              <Card key={cred.id} className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold font-body tracking-tight truncate" title={cred.nome}>{cred.nome}</h2>
                    {cred.descricao && (
                      <p className="text-xs text-muted-foreground mt-0.5">{cred.descricao}</p>
                    )}
                  </div>
                  {custodiante && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => abrirAcessos(cred)} title="Quem vê">
                        <Users className="w-4 h-4" />
                      </Button>
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
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remover(cred)} title="Remover">
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
                        className={`h-full transition-[width] duration-500 ease-linear ${esgotando ? "bg-destructive" : "bg-primary"}`}
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
      </div>

      {/* ---------------------------------------------------------------- */}
      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar acesso de tribunal</DialogTitle>
            <DialogDescription>
              A chave é gravada cifrada e nunca mais é exibida. Guarde uma cópia no cofre físico antes de continuar.
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
                onChange={(e) => setForm({ ...form, segredo: e.target.value })
                }
                placeholder="JBSWY3DPEHPK3PXP..."
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                É o texto que aparece em "não consegue escanear o código?" na tela de configuração
                do autenticador. Só letras de A a Z e números de 2 a 7.
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
              "{conferencia?.nome}" foi cadastrado. Abra o autenticador no celular e veja se ele
              mostra o mesmo número. O código abaixo gira sozinho, então leve o tempo que precisar.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const c = conferencia ? codigos[conferencia.id] : undefined;
            if (!c) return <p className="py-8 text-center text-muted-foreground">Gerando código...</p>;
            const restante = Math.max(0, Math.ceil((c.ate - Date.now()) / 1000));
            return (
              <div className="space-y-2 py-2">
                <p className="font-mono text-4xl tracking-[0.2em] text-center tabular-nums">{c.codigo}</p>
                <div className="h-1 w-full rounded bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-500 ease-linear"
                    style={{ width: `${Math.max(0, Math.min(1, restante / c.periodo)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">Muda em {restante}s</p>
              </div>
            );
          })()}
          <p className="text-xs text-muted-foreground text-center">
            Se o celular mostrar outro número, a chave foi digitada errada: remova o acesso e cadastre de novo.
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
              Muda só o rótulo. A chave, as permissões e o histórico continuam como estão.
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

      {/* Quem vê cada credencial */}
      <Dialog open={!!acessosDe} onOpenChange={(o) => !o && setAcessosDe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quem vê "{acessosDe?.nome}"</DialogTitle>
            <DialogDescription>
              Custodiantes sempre enxergam. Marque abaixo quem mais precisa deste código.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
            {membros.map((m) => {
              const tem = comAcesso.has(m.user_id);
              return (
                <div key={m.user_id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{m.nome || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{m.papel}</p>
                  </div>
                  <Button
                    variant={tem ? "ghost" : "outline"}
                    size="sm"
                    className={tem ? "text-destructive" : ""}
                    onClick={() => alternarAcesso(m.user_id, !tem)}
                  >
                    {tem ? "Remover" : "Liberar"}
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcessosDe(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
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
            {historicoVisivel.length === 0 && (
              <p className="py-6 text-center text-muted-foreground">Nenhum registro ainda.</p>
            )}
            {historicoVisivel.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">
                    {r.nome || "—"}
                    <span className="text-muted-foreground"> · {r.acao}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.credencial_nome || "—"} · {new Date(r.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                {!r.sucesso && <Badge variant="destructive" className="text-[10px] shrink-0">negado</Badge>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
