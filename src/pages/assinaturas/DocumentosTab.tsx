import { ordenarSetores } from "@/lib/treinamentos";
import { lerTudo } from "@/lib/lerTudo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Download, Link2, RefreshCw, Search, MessageCircle, ChevronDown, ChevronRight } from "lucide-react";
import { fmtData, fmtDataHora, linkWhatsApp, mascaraCpf, SETORES, STATUS_DOC, STATUS_SIGN, TIPO_DOC } from "@/lib/assinaturas";

type Doc = any;

export default function DocumentosTab() {
  const { orgId } = useOrgMembers();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [signs, setSigns] = useState<Record<string, any[]>>({});
  const [setoresLista, setSetoresLista] = useState<string[]>([]);
  useEffect(() => {
    // Falha na consulta não quebra a tela: o filtro usa os setores gravados nos próprios documentos.
    Promise.resolve((supabase.from("setores") as any).select("id,nome,pai_id,ordem,institucional").eq("ativo", true))
      .then(({ data }: any) => setSetoresLista(ordenarSetores(data || []).map((s: any) => s.nome)))
      .catch(() => setSetoresLista([]));
  }, []);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fSetor, setFSetor] = useState("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState("");

  const carregar = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [{ data: ds }, { data: ss }, { data: cs }] = await Promise.all([
      lerTudo(() => supabase.from("assinatura_documentos").select("*").eq("organizacao_id", orgId).order("created_at", { ascending: false })),
      lerTudo(() => supabase.from("assinatura_signatarios").select("*").eq("organizacao_id", orgId)),
      lerTudo(() => supabase.from("clientes").select("id, nome").order("nome")),
    ]);
    setDocs(ds || []);
    const map: Record<string, any[]> = {};
    for (const s of ss || []) (map[s.documento_id] ||= []).push(s);
    setSigns(map);
    setClientes(cs || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => docs.filter((d) => {
    if (fStatus !== "todos" && d.status !== fStatus) return false;
    if (fSetor !== "todos" && (d.setor || "sem_setor") !== fSetor) return false;
    if (busca && !`${d.nome} ${d.referencia || ""}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [docs, busca, fStatus, fSetor]);

  const sincronizar = async (d: Doc) => {
    setSincronizando(d.id);
    const { data, error } = await supabase.functions.invoke("zapsign-sync", { body: { documento_id: d.id } });
    setSincronizando(null);
    if (error || data?.error) {
      toast.error(data?.error || "Falha ao sincronizar");
    } else {
      toast.success(data?.aviso || "Status atualizado");
      carregar();
    }
  };

  const baixarAssinado = async (d: Doc) => {
    // Sempre pede um link novo (arquivo guardado ou GET /docs/{token}/ no ZapSign)
    setSincronizando(d.id);
    const { data, error } = await supabase.functions.invoke("zapsign-sync", { body: { acao: "baixar", documento_id: d.id } });
    setSincronizando(null);
    if (error || data?.error) { toast.error(data?.error || "Falha ao baixar o assinado"); return; }
    if (!data?.url) { toast.info("Documento ainda não consta como assinado no ZapSign."); carregar(); return; }
    window.open(data.url, "_blank", "noopener");
  };

  const vincularExterno = async () => {
    const token = linkToken.trim();
    if (!token) return;
    const { data, error } = await supabase.functions.invoke("zapsign-sync", { body: { acao: "link_novo", token } });
    if (error || data?.error) toast.error(data?.error || "Falha ao importar");
    else { toast.success(data?.ja_existia ? "Documento já estava na lista" : "Documento importado"); setLinkToken(""); carregar(); }
  };

  const vincularCliente = async (d: Doc, clienteId: string) => {
    const { data, error } = await supabase.functions.invoke("zapsign-sync", { body: { acao: "link", documento_id: d.id, cliente_id: clienteId } });
    if (error || data?.error) toast.error(data?.error || "Falha ao vincular");
    else { toast.success("Cliente vinculado"); carregar(); }
  };

  const copiar = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Link copiado"); };

  const nomeCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nome || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou referência" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_DOC).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fSetor} onValueChange={setFSetor}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {Array.from(new Set([...setoresLista, ...docs.map((d: any) => d.setor).filter(Boolean)])).map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            <SelectItem value="sem_setor">Sem setor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border p-3 bg-card">
        <p className="text-xs text-muted-foreground mb-2">Documento enviado fora do app? Cole o token do ZapSign para importar:</p>
        <div className="flex gap-2">
          <Input placeholder="token do documento" value={linkToken} onChange={(e) => setLinkToken(e.target.value)} />
          <Button variant="outline" onClick={vincularExterno}><Link2 className="w-4 h-4 mr-1" /> Importar</Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((d) => {
            const st = STATUS_DOC[d.status] || STATUS_DOC.pending;
            const ss = signs[d.id] || [];
            const expandido = aberto === d.id;
            return (
              <div key={d.id} className="rounded-lg border border-border bg-card">
                <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setAberto(expandido ? null : d.id)}>
                  {expandido ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{d.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIPO_DOC[d.tipo] || d.tipo}
                      {d.setor ? ` · ${d.setor}` : ""}
                      {d.referencia ? ` · ${d.referencia}` : ""}
                      {nomeCliente(d.cliente_id) ? ` · ${nomeCliente(d.cliente_id)}` : " · sem cliente"}
                      {` · enviado em ${fmtDataHora(d.enviado_em || d.created_at)}`}
                    </p>
                  </div>
                  {d.origem === "externo" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">externo</span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${st.cor}`}>{st.label}</span>
                </button>
                {expandido && (
                  <div className="border-t border-border p-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={sincronizando === d.id} onClick={() => sincronizar(d)}>
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${sincronizando === d.id ? "animate-spin" : ""}`} /> Atualizar status
                      </Button>
                      {d.status === "signed" && (
                        <Button size="sm" variant="outline" onClick={() => baixarAssinado(d)}>
                          <Download className="w-3.5 h-3.5 mr-1" /> Baixar assinado
                        </Button>
                      )}
                      {!d.cliente_id && (
                        <Select onValueChange={(v) => vincularCliente(d, v)}>
                          <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue placeholder="Vincular a um cliente…" /></SelectTrigger>
                          <SelectContent>
                            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {ss.map((s) => (
                        <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm rounded-md bg-secondary/40 px-3 py-2">
                          <span className="font-medium">{s.nome}</span>
                          <span className="text-xs text-muted-foreground">{mascaraCpf(s.cpf)}</span>
                          <span className="text-xs text-muted-foreground">{STATUS_SIGN[s.status] || s.status}</span>
                          {s.assinou_em && <span className="text-xs text-muted-foreground">em {fmtDataHora(s.assinou_em)}</span>}
                          {s.sign_url && s.status !== "signed" && (
                            <span className="flex gap-1 ml-auto">
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copiar(s.sign_url)}>
                                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar link
                              </Button>
                              {linkWhatsApp(s.telefone, d.nome, s.sign_url) && (
                                <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                                  <a href={linkWhatsApp(s.telefone, d.nome, s.sign_url)!} target="_blank" rel="noreferrer">
                                    <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                                  </a>
                                </Button>
                              )}
                            </span>
                          )}
                        </div>
                      ))}
                      {!ss.length && <p className="text-xs text-muted-foreground">Sem signatários registrados.</p>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Canal: {d.canal} · Prazo: {fmtData(d.prazo)} · Última sincronização: {fmtDataHora(d.ultimo_sync_em)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
