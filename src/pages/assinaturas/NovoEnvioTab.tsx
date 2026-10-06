import { ordenarSetores } from "@/lib/treinamentos";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, FileUp, HardDrive, Plus, Send, Trash2, UserSearch, X } from "lucide-react";
import {
  arquivoParaBase64, cpfValido, detectarMarcadores, detectarMarcadoresDocx, mascaraCpf, somenteDigitos,
  SETORES, TIPO_DOC, TIPOS_SIGNATARIO_UNICO,
} from "@/lib/assinaturas";

const MAX_ARQ = 10 * 1024 * 1024;

type Sign = {
  origem: "cliente" | "avulso";
  clienteId: string;
  nome: string; email: string; telefone: string; cpf: string; qualificacao: string;
};

const signVazio = (origem: Sign["origem"] = "avulso"): Sign =>
  ({ origem, clienteId: "", nome: "", email: "", telefone: "", cpf: "", qualificacao: "" });

const ehDocx = (nome: string) => nome.toLowerCase().endsWith(".docx");

function qualificacaoPadrao(tipo: string) {
  if (tipo === "procuracao") return "Outorgante";
  if (tipo === "contrato") return "Contratante";
  return "";
}

function ClientePicker({ clientes, valor, onEscolher }: { clientes: any[]; valor: string; onEscolher: (c: any) => void }) {
  const [aberto, setAberto] = useState(false);
  const atual = clientes.find((c) => c.id === valor);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal">
          <UserSearch className="w-4 h-4 mr-2" /> {atual ? atual.nome : "Buscar cliente cadastrado…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start">
        <Command>
          <CommandInput placeholder="Nome do cliente" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {clientes.map((c) => (
                <CommandItem key={c.id} value={`${c.nome} ${c.id}`} onSelect={() => { onEscolher(c); setAberto(false); }}>
                  {c.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function NovoEnvioTab() {
  const { orgId } = useOrgMembers();
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const clienteInicial = sp.get("cliente") || "";

  const [clientes, setClientes] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [tipo, setTipo] = useState("contrato");
  const [setor, setSetor] = useState("");
  const [nome, setNome] = useState("");
  const [referencia, setReferencia] = useState("");
  const [prazo, setPrazo] = useState("");
  const [canal, setCanal] = useState("nenhum");
  const [incluirEscritorio, setIncluirEscritorio] = useState(false);
  const [semVisto, setSemVisto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [drivePath, setDrivePath] = useState("");
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  // null = ainda não lido; "nao_verificado" = Word ilegível
  const [marcadores, setMarcadores] = useState<string[] | null | "nao_verificado">(null);
  const [signatarios, setSignatarios] = useState<Sign[]>([signVazio("cliente")]);
  const [arrastando, setArrastando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const unico = TIPOS_SIGNATARIO_UNICO.includes(tipo);

  useEffect(() => {
    supabase.functions.invoke("zapsign-enviar", { body: { acao: "status" } })
      .then(({ data }) => setConfigurado(!!data?.configurado))
      .catch(() => setConfigurado(null));
  }, []);

  const [setoresLista, setSetoresLista] = useState<string[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // Se a consulta falhar, a lista fica vazia e a tela usa a lista antiga (SETORES).
      try {
        const [{ data: sets }, { data: meus }] = await Promise.all([
          (supabase.from("setores") as any).select("id,nome,pai_id,ordem,institucional").eq("ativo", true).order("ordem"),
          (supabase.from("membro_setores") as any).select("setor_id,created_at").eq("user_id", user.id).order("created_at"),
        ]);
        const lista = ordenarSetores(sets || []);
        setSetoresLista(lista.map((s: any) => s.nome));
        const meu = (meus || []).map((m: any) => lista.find((s: any) => s.id === m.setor_id)).find((s: any) => s && !s.institucional);
        if (meu) setSetor((atual) => atual || meu.nome);
      } catch { setSetoresLista([]); }
    })();
  }, [user?.id]);

  const preencherCliente = (c: any): Partial<Sign> => ({
    origem: "cliente", clienteId: c.id, nome: c.nome || "", email: c.email || "",
    telefone: somenteDigitos(c.telefone), cpf: somenteDigitos(c.cpf_cnpj),
  });

  useEffect(() => {
    if (!orgId) return;
    supabase.from("clientes").select("id, nome, email, telefone, cpf_cnpj").order("nome").then(({ data }) => {
      setClientes(data || []);
      if (clienteInicial && data) {
        const c = data.find((x) => x.nome === clienteInicial);
        if (c) setSignatarios([{ ...signVazio("cliente"), ...preencherCliente(c), qualificacao: qualificacaoPadrao(tipo) }]);
      }
    });
    supabase.from("assinatura_config").select("*").eq("organizacao_id", orgId).maybeSingle().then(({ data }) => setConfig(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, clienteInicial]);

  // Cliente do documento = primeiro signatário cadastrado
  const clienteDoc = useMemo(() => {
    const s = signatarios.find((x) => x.origem === "cliente" && x.clienteId);
    return s ? clientes.find((c) => c.id === s.clienteId) || null : null;
  }, [signatarios, clientes]);

  useEffect(() => {
    if (!clienteDoc) { setDriveFiles([]); return; }
    supabase.from("arquivos_cliente").select("id, nome_arquivo, storage_path")
      .ilike("nome_cliente", clienteDoc.nome).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setDriveFiles((data || []).filter((f: any) => /\.(pdf|docx)$/i.test(f.nome_arquivo || ""))));
  }, [clienteDoc?.id]);

  // Tipo com signatário único: corta a lista para 1 e aplica a qualificação
  useEffect(() => {
    setSignatarios((ss) => {
      const lista = unico ? ss.slice(0, 1) : ss;
      const q = qualificacaoPadrao(tipo);
      return lista.map((s) => (unico || !s.qualificacao || ["Contratante", "Outorgante"].includes(s.qualificacao) ? { ...s, qualificacao: q } : s));
    });
    if (!unico) setIncluirEscritorio(false);
  }, [tipo, unico]);

  const escritorioConfigurado = !!(config?.escritorio_nome && config?.escritorio_email);

  const lerMarcadores = async (bytes: Uint8Array, nomeArq: string) => {
    if (ehDocx(nomeArq)) {
      const m = await detectarMarcadoresDocx(bytes);
      setMarcadores(m === null ? "nao_verificado" : m);
    } else setMarcadores(detectarMarcadores(bytes));
  };

  const aoEscolherArquivo = async (f: File | null) => {
    setArquivo(null); setDrivePath(""); setMarcadores(null);
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) { toast.error("Envie um PDF ou Word (.docx)"); return; }
    if (f.size > MAX_ARQ) { toast.error("Arquivo maior que 10 MB"); return; }
    setArquivo(f);
    if (!nome) setNome(f.name.replace(/\.(pdf|docx)$/i, ""));
    await lerMarcadores(new Uint8Array(await f.arrayBuffer()), f.name);
  };

  const aoEscolherDrive = async (path: string) => {
    setDrivePath(path); setArquivo(null); setMarcadores(null);
    if (!path) return;
    const { data, error } = await supabase.storage.from("cliente-drive").download(path);
    if (error || !data) { toast.error("Falha ao ler o arquivo do drive"); return; }
    if (data.size > MAX_ARQ) { toast.error("Arquivo maior que 10 MB"); setDrivePath(""); return; }
    await lerMarcadores(new Uint8Array(await data.arrayBuffer()), path);
  };

  const atualizar = (i: number, patch: Partial<Sign>) =>
    setSignatarios((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remover = (i: number) => setSignatarios((ss) => ss.filter((_, j) => j !== i));
  const mover = (i: number, d: -1 | 1) => setSignatarios((ss) => {
    const n = [...ss]; const j = i + d;
    if (j < 0 || j >= n.length) return ss;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const validar = (): string | null => {
    if (!nome.trim()) return "Informe o nome do documento";
    if (!setor) return "Escolha o setor de origem";
    if (!arquivo && !drivePath) return "Escolha um arquivo (PDF ou Word) ou um arquivo do drive do cliente";
    if (!signatarios.length) return "Adicione ao menos um signatário";
    if (unico && signatarios.length !== 1) return "Este tipo tem um único signatário";
    if (incluirEscritorio && !escritorioConfigurado) return "Configure o signatário do escritório na aba Configuração";
    for (const s of signatarios) {
      if (s.origem === "cliente" && !s.clienteId) return "Escolha o cliente cadastrado ou troque para pessoa avulsa";
      if (!s.nome.trim()) return "Signatário sem nome";
      if (!cpfValido(s.cpf)) return `CPF inválido para ${s.nome}`;
      const tel = somenteDigitos(s.telefone);
      if ((canal === "nenhum" || canal === "whatsapp" || canal === "ambos") && (tel.length < 10 || tel.length > 11)) return `Telefone com DDD obrigatório para ${s.nome}`;
      if ((canal === "email" || canal === "ambos") && !s.email) return `E-mail obrigatório para ${s.nome}`;
    }
    return null;
  };

  const abrirRevisao = () => {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    setRevisando(true);
  };

  const listaFinal = () => {
    const base = signatarios.map((s) => ({
      nome: s.nome.trim(), email: s.email.trim(), telefone: s.telefone, cpf: s.cpf,
      qualificacao: s.qualificacao.trim() || "Signatário",
      papel: s.origem as "cliente" | "avulso" | "escritorio",
      cliente_id: s.origem === "cliente" ? s.clienteId : null,
    }));
    if (unico && incluirEscritorio && escritorioConfigurado) {
      base.push({ nome: config.escritorio_nome, email: config.escritorio_email, telefone: "", cpf: config.escritorio_cpf || "", qualificacao: "Contratada", papel: "escritorio", cliente_id: null });
    }
    return base;
  };

  const marcList = Array.isArray(marcadores) ? marcadores : [];

  const confirmarEnvio = async () => {
    setEnviando(true);
    try {
      const todos = listaFinal();
      let b64: string | undefined;
      if (arquivo) b64 = await arquivoParaBase64(arquivo);
      const docx = arquivo ? ehDocx(arquivo.name) : ehDocx(drivePath);
      const marc = marcList.length ? todos.map((_, i) => `<<assinatura_${i + 1}>>`).filter((m) => marcList.includes(m)) : null;
      const { data, error } = await supabase.functions.invoke("zapsign-enviar", {
        body: {
          organizacao_id: orgId,
          cliente_id: clienteDoc?.id || null,
          tipo, setor,
          nome: nome.trim(),
          referencia: referencia.trim() || null,
          prazo: prazo || null,
          canal,
          incluir_escritorio: unico && incluirEscritorio,
          sem_visto: semVisto,
          marcadores: marc && marc.length === todos.length ? marc : null,
          ...(b64 ? (docx ? { base64_docx: b64 } : { base64_pdf: b64 }) : {}),
          storage_path: drivePath || null,
          signatarios: todos,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Falha no envio");
      } else {
        toast.success("Documento enviado ao ZapSign. Copie o link de assinatura na aba Documentos.");
        setRevisando(false);
        setArquivo(null); setDrivePath(""); setNome(""); setReferencia(""); setPrazo(""); setMarcadores(null);
        setSignatarios([signVazio("cliente")]);
      }
    } finally {
      setEnviando(false);
    }
  };

  const avisoMarcadores = () => {
    if (marcadores === "nao_verificado") return <p className="text-xs text-yellow-700 dark:text-yellow-400">Marcadores não verificados — não foi possível ler o texto do Word.</p>;
    if (marcadores === null) return null;
    return marcList.length > 0
      ? <p className="text-xs text-emerald-700 dark:text-emerald-400">Marcadores encontrados: {marcList.join(", ")}</p>
      : <p className="text-xs text-yellow-700 dark:text-yellow-400">{"Marcadores <<assinatura_N>> não encontrados — o ZapSign usará a página de manifesto."}</p>;
  };

  if (revisando) {
    const todos = listaFinal();
    return (
      <div className="max-w-2xl space-y-4">
        <h3 className="text-lg font-semibold">Revisão antes do envio</h3>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
          <p><span className="text-muted-foreground">Documento:</span> {nome} ({TIPO_DOC[tipo]})</p>
          <p><span className="text-muted-foreground">Setor:</span> {setor}</p>
          <p><span className="text-muted-foreground">Cliente vinculado:</span> {clienteDoc?.nome || "nenhum (o assinado fica só nesta tela)"}</p>
          <p><span className="text-muted-foreground">Arquivo:</span> {arquivo ? `${arquivo.name} (${(arquivo.size / 1024 / 1024).toFixed(2)} MB)` : "Arquivo do drive do cliente"}</p>
          {referencia && <p><span className="text-muted-foreground">Referência:</span> {referencia}</p>}
          <p><span className="text-muted-foreground">Canal de envio:</span> {canal === "nenhum" ? "Nenhum (você envia o link)" : canal === "ambos" ? "E-mail + WhatsApp" : canal}</p>
          {prazo && <p><span className="text-muted-foreground">Prazo para assinar:</span> {new Date(`${prazo}T12:00:00`).toLocaleDateString("pt-BR")}</p>}
          {marcList.length > 0 ? (
            <p className="text-emerald-700 dark:text-emerald-400">Marcadores encontrados: {marcList.join(", ")}{semVisto ? " (sem visto)" : ""}</p>
          ) : (
            <p className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="w-4 h-4" />
              {marcadores === "nao_verificado" ? "Marcadores não verificados no Word." : "Marcadores não encontrados — o ZapSign usará a página de manifesto."}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Signatários (na ordem dos marcadores)</p>
          {todos.map((s, i) => (
            <div key={i} className="text-sm flex flex-wrap gap-2 rounded-md bg-secondary/40 px-3 py-2">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className="font-medium">{s.nome}</span>
              <span className="text-muted-foreground">{s.qualificacao}</span>
              <span className="text-muted-foreground">{s.papel === "cliente" ? "cliente" : s.papel === "avulso" ? "avulso" : "escritório"}</span>
              {s.cpf && <span className="text-muted-foreground">{mascaraCpf(s.cpf)}</span>}
              {s.email && <span className="text-muted-foreground">{s.email}</span>}
              {s.telefone && <span className="text-muted-foreground">{s.telefone}</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRevisando(false)} disabled={enviando}>Voltar e editar</Button>
          <Button onClick={confirmarEnvio} disabled={enviando}>
            <Send className="w-4 h-4 mr-1" /> {enviando ? "Enviando…" : "Confirmar envio"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {configurado === false && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Integração não configurada: cadastre o segredo ZAPSIGN_API_TOKEN nas configurações do projeto para habilitar o envio.
        </div>
      )}

      {/* Arquivo */}
      <div className="space-y-2">
        <Label>Arquivo (PDF ou Word .docx, até 10 MB)</Label>
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); aoEscolherArquivo(e.dataTransfer.files?.[0] || null); }}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${arrastando ? "border-primary bg-primary/5" : "border-border bg-card"}`}
        >
          <FileUp className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          {arquivo ? (
            <p className="text-sm font-medium">{arquivo.name} <span className="text-muted-foreground">({(arquivo.size / 1024 / 1024).toFixed(2)} MB)</span></p>
          ) : drivePath ? (
            <p className="text-sm font-medium">Do drive: {drivePath.split("/").pop()}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Arraste e solte o arquivo aqui</p>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Escolher arquivo</Button>
            {(arquivo || drivePath) && (
              <Button variant="ghost" size="sm" onClick={() => { setArquivo(null); setDrivePath(""); setMarcadores(null); }}>
                <X className="w-4 h-4 mr-1" /> Remover
              </Button>
            )}
          </div>
          <input
            ref={fileRef} type="file" className="hidden"
            accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
            onChange={(e) => { aoEscolherArquivo(e.target.files?.[0] || null); e.target.value = ""; }}
          />
        </div>
        {clienteDoc && driveFiles.length > 0 && (
          <Select value={drivePath} onValueChange={aoEscolherDrive}>
            <SelectTrigger className="w-full sm:w-[360px]"><HardDrive className="w-4 h-4 mr-1" /><SelectValue placeholder="Ou escolha do drive do cliente" /></SelectTrigger>
            <SelectContent>{driveFiles.map((f) => <SelectItem key={f.id} value={f.storage_path}>{f.nome_arquivo}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {avisoMarcadores()}
        {marcList.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={semVisto} onCheckedChange={(v) => setSemVisto(!!v)} /> Sem visto (documento de uma página)
          </label>
        )}
      </div>

      {/* Dados do documento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo de documento</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TIPO_DOC).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Setor de origem</Label>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger><SelectValue placeholder="Escolha o setor" /></SelectTrigger>
            <SelectContent>{(setoresLista.length ? setoresLista : SETORES).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nome do documento</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Contrato de honorários — Fulano" />
        </div>
        <div className="space-y-1.5">
          <Label>Referência interna (opcional)</Label>
          <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ex.: OA-GRN-2026" />
        </div>
        <div className="space-y-1.5">
          <Label>Prazo para assinar (opcional)</Label>
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Canal de envio</Label>
          <Select value={canal} onValueChange={setCanal}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Nenhum — eu envio o link</SelectItem>
              <SelectItem value="email">E-mail (ZapSign envia)</SelectItem>
              <SelectItem value="whatsapp">WhatsApp (ZapSign envia)</SelectItem>
              <SelectItem value="ambos">E-mail + WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Signatários */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{unico ? (tipo === "procuracao" ? "Outorgante (signatário único)" : "Contratante (signatário único)") : "Signatários (a ordem é a dos marcadores)"}</Label>
          {!unico && (
            <Button size="sm" variant="outline" onClick={() => setSignatarios((ss) => [...ss, signVazio("avulso")])}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar signatário
            </Button>
          )}
        </div>
        {signatarios.map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
              <Select value={s.origem} onValueChange={(v) => atualizar(i, v === "avulso" ? { ...signVazio("avulso"), qualificacao: s.qualificacao } : { origem: "cliente", clienteId: "" })}>
                <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente cadastrado</SelectItem>
                  <SelectItem value="avulso">Pessoa avulsa</SelectItem>
                </SelectContent>
              </Select>
              {!unico && (
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Descer" disabled={i === signatarios.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Remover signatário" disabled={signatarios.length === 1} onClick={() => remover(i)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              )}
            </div>
            {s.origem === "cliente" && (
              <ClientePicker clientes={clientes} valor={s.clienteId} onEscolher={(c) => atualizar(i, preencherCliente(c))} />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="Nome completo" value={s.nome} onChange={(e) => atualizar(i, { nome: e.target.value })} />
              <Input placeholder="CPF" value={s.cpf} onChange={(e) => atualizar(i, { cpf: e.target.value })} />
              <Input placeholder="E-mail" value={s.email} onChange={(e) => atualizar(i, { email: e.target.value })} />
              <Input placeholder="Telefone com DDD" value={s.telefone} onChange={(e) => atualizar(i, { telefone: e.target.value })} />
              <Input placeholder="Qualificação (ex.: Contratante, Contratado, Declarante)" value={s.qualificacao} disabled={unico} onChange={(e) => atualizar(i, { qualificacao: e.target.value })} className="sm:col-span-2" />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Todos os signatários (exceto o escritório) assinam com selfie, foto do documento e CPF.</p>
        {unico && (
          <label className={`flex items-center gap-2 text-sm ${escritorioConfigurado ? "" : "opacity-50"}`}>
            <Checkbox checked={incluirEscritorio} disabled={!escritorioConfigurado} onCheckedChange={(v) => setIncluirEscritorio(!!v)} />
            Incluir o escritório como signatário
            {!escritorioConfigurado && <span className="text-xs text-muted-foreground">(configure na aba Configuração)</span>}
          </label>
        )}
      </div>

      <Button onClick={abrirRevisao}>Revisar envio</Button>
    </div>
  );
}
