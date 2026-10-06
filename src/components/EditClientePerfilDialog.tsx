import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Star, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCpfCnpj } from "@/lib/utils";
import { SITUACOES } from "@/lib/situacaoCliente";
import { BancosContratadosSection, normBancoNome } from "@/components/cliente/BancosContratadosSection";
import { usePapelRadar } from "@/hooks/usePapelRadar";
import { dispararAdvbox } from "@/lib/advboxDisparo";
import {
  EncerramentoComunicadoSection,
  comunicadoVazio,
  type ComunicadoEncerramento,
} from "@/components/cliente/EncerramentoComunicadoSection";


const estadosCivis = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const ufs = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

// Normaliza nome para "Primeira Maiúscula, resto minúsculo",
// respeitando conectivos comuns em português (de, da, do, dos, das, e)
// e siglas curtas (LTDA, ME, EPP, S/A, SA, EIRELI).
const LOWER_WORDS = new Set(["de", "da", "do", "dos", "das", "e", "di", "du"]);
const KEEP_UPPER = new Set(["LTDA", "ME", "EPP", "SA", "S/A", "S.A.", "EIRELI", "MEI", "II", "III", "IV"]);
export function toTitleCaseNome(raw: string): string {
  if (!raw) return raw;
  const clean = raw.trim().replace(/\s+/g, " ");
  return clean
    .split(" ")
    .map((word, idx) => {
      const upper = word.toUpperCase();
      if (KEEP_UPPER.has(upper)) return upper;
      const lower = word.toLocaleLowerCase("pt-BR");
      if (idx > 0 && LOWER_WORDS.has(lower)) return lower;
      // trata hifenização: São João-do-Sul → São João-Do-Sul (mantém após hífen)
      return lower
        .split("-")
        .map((seg) =>
          seg.length > 0
            ? seg.charAt(0).toLocaleUpperCase("pt-BR") + seg.slice(1)
            : seg,
        )
        .join("-");
    })
    .join(" ");
}

interface ClientePerfil {
  id?: string;
  cpf_cnpj: string;
  rg: string;
  orgao_emissor: string;
  nacionalidade: string;
  estado_civil: string;
  profissao: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  nome_propriedade: string;
  area_hectares: string;
  cultura_principal: string;
  observacoes: string;
  vip: boolean;
  status_adimplencia: string;
  situacao: string;
  situacao_motivo: string;
}

const empty: ClientePerfil = {
  cpf_cnpj: "", rg: "", orgao_emissor: "", nacionalidade: "Brasileira",
  estado_civil: "", profissao: "Produtor Rural", endereco: "", municipio: "",
  uf: "", cep: "", telefone: "", email: "", nome_propriedade: "",
  area_hectares: "", cultura_principal: "", observacoes: "",
  vip: false, status_adimplencia: "adimplente",
  situacao: "ativo", situacao_motivo: "",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nomeCliente: string;
  onSaved: () => void;
  onDeleted?: () => void;
}

export function EditClientePerfilDialog({ open, onOpenChange, nomeCliente, onSaved, onDeleted }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<ClientePerfil>(empty);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(nomeCliente);
  const [situacaoOriginal, setSituacaoOriginal] = useState("ativo");
  const { isAdmin } = usePapelRadar();
  const [bancosOps, setBancosOps] = useState<string[]>([]);
  const [bancosContratados, setBancosContratados] = useState<string[]>([]);
  const [contratadosIniciais, setContratadosIniciais] = useState<string[]>([]);
  const [comunicado, setComunicado] = useState<ComunicadoEncerramento>(comunicadoVazio);
  const [opsProximas, setOpsProximas] = useState<{ id: string }[]>([]);
  const [comunicadoGravado, setComunicadoGravado] = useState<{
    data: string | null;
    canal: string | null;
    arquivo: string | null;
  } | null>(null);

  useEffect(() => {
    if (open) setNomeEdit(nomeCliente);
  }, [open, nomeCliente]);

  /** Bancos das operações e o que já está marcado como contratado. */
  const carregarBancos = async (clienteId: string) => {
    const [{ data: ops }, { data: escopos }] = await Promise.all([
      supabase.from("operacoes_credito").select("banco").eq("cliente_id", clienteId).is("deleted_at", null),
      supabase.from("cliente_banco_escopo").select("banco, escopo").eq("cliente_id", clienteId),
    ]);
    setBancosOps([...new Set(((ops as any[]) || []).map((o) => String(o.banco || "").trim()).filter(Boolean))]);
    const contratados = ((escopos as any[]) || [])
      .filter((e) => e.escopo === "contratado")
      .map((e) => String(e.banco || "").trim())
      .filter(Boolean);
    setBancosContratados(contratados);
    setContratadosIniciais(contratados);
  };

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("clientes" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("nome", nomeCliente)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setExistingId(d.id);
          setPerfil({
            cpf_cnpj: d.cpf_cnpj || "",
            rg: d.rg || "",
            orgao_emissor: d.orgao_emissor || "",
            nacionalidade: d.nacionalidade || "Brasileira",
            estado_civil: d.estado_civil || "",
            profissao: d.profissao || "Produtor Rural",
            endereco: d.endereco || "",
            municipio: d.municipio || "",
            uf: d.uf || "",
            cep: d.cep || "",
            telefone: d.telefone || "",
            email: d.email || "",
            nome_propriedade: d.nome_propriedade || "",
            area_hectares: d.area_hectares?.toString() || "",
            cultura_principal: d.cultura_principal || "",
            observacoes: d.observacoes || "",
            vip: d.vip || false,
            status_adimplencia: d.status_adimplencia || "adimplente",
            situacao: d.situacao || "ativo",
            situacao_motivo: d.situacao_motivo || "",
          });
          setSituacaoOriginal(d.situacao || "ativo");
          setComunicado(comunicadoVazio);
          setComunicadoGravado(
            d.encerramento_comunicado_em
              ? {
                  data: d.encerramento_comunicado_em,
                  canal: d.encerramento_comunicado_canal,
                  arquivo: d.encerramento_comunicado_arquivo,
                }
              : null,
          );
          carregarBancos(d.id);
        } else {
          setExistingId(null);
          setPerfil(empty);
          setBancosOps([]);
          setBancosContratados([]);
          setContratadosIniciais([]);
        }
        setLoading(false);
      });
  }, [open, user, nomeCliente]);

  /**
   * Grava a seção "Bancos contratados": histórico de cada mudança e, para o
   * banco acrescentado, o mesmo trâmite interno do fechamento (sem tarefa para
   * operação já vencida — essas seguem para a fila de vencidas).
   */
  const salvarBancosContratados = async (clienteId: string) => {
    if (!isAdmin) return;
    const chave = (b: string) => normBancoNome(b);
    const antes = new Set(contratadosIniciais.map(chave));
    const agora = new Set(bancosContratados.map(chave));
    const todos = new Map<string, string>();
    [...contratadosIniciais, ...bancosContratados, ...bancosOps].forEach((b) => {
      const k = chave(b);
      if (k && !todos.has(k)) todos.set(k, b.trim());
    });

    const novos: string[] = [];
    for (const [k, banco] of todos) {
      const ficou = agora.has(k);
      const escopo = ficou ? "contratado" : "fora_escopo";
      const { data: existente } = await supabase
        .from("cliente_banco_escopo")
        .select("id, escopo")
        .eq("cliente_id", clienteId)
        .ilike("banco", banco)
        .maybeSingle();
      const escopoAnterior = (existente as any)?.escopo ?? null;
      if (escopoAnterior === escopo) continue;
      // Banco nunca classificado e que segue desmarcado: não gravar
      // "fora_escopo" — senão qualquer edição do cadastro tiraria essas
      // operações do radar sem ninguém ter decidido isso.
      if (escopoAnterior === null && !ficou) continue;
      const payload = {
        cliente_id: clienteId,
        banco,
        escopo,
        origem: "editar cadastro",
        pendencia_comercial: !ficou,
        pendencia_texto: ficou ? null : `Cliente tem dívida em ${banco} fora do contrato — avaliar ampliação`,
        definido_em: new Date().toISOString(),
      };
      if ((existente as any)?.id) {
        await supabase.from("cliente_banco_escopo").update(payload as any).eq("id", (existente as any).id);
      } else {
        await supabase.from("cliente_banco_escopo").insert(payload as any);
      }
      await supabase.from("cliente_banco_escopo_historico").insert({
        cliente_id: clienteId,
        banco,
        escopo_anterior: escopoAnterior,
        escopo_novo: escopo,
        origem: "editar cadastro",
        alterado_por: user?.id ?? null,
        alterado_nome: (user as any)?.user_metadata?.nome ?? user?.email ?? null,
      } as any);
      if (ficou && !antes.has(k)) novos.push(banco);
    }


    for (const banco of novos) {
      const r = await dispararAdvbox(clienteId, `editar cadastro: ${banco}`, { semVencidas: true });
      toast[r.ok ? "success" : "warning"](r.texto, { duration: 10000 });
    }
    setContratadosIniciais(bancosContratados);
  };


  const update = (field: keyof ClientePerfil, value: string | boolean) =>
    setPerfil((p) => ({ ...p, [field]: value }));

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const handleSave = async () => {
    if (!user) return;
    const novoNome = toTitleCaseNome(nomeEdit);
    if (novoNome.length < 2) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }
    if (perfil.situacao !== "ativo" && !perfil.situacao_motivo.trim()) {
      toast.error("Informe o motivo da situação do cliente");
      return;
    }
    const situacaoMudou = perfil.situacao !== situacaoOriginal;
    const encerrando = situacaoMudou && perfil.situacao !== "ativo" && situacaoOriginal === "ativo";
    if (encerrando && !isAdmin) {
      toast.error("Encerrar cliente é decisão do Willian.");
      return;
    }
    const exigeComunicado = encerrando && opsProximas.length > 0;
    if (exigeComunicado && (!comunicado.data || !comunicado.canal || !comunicado.arquivo)) {
      toast.error(
        "Há operações vencendo nos próximos 60 dias: registre o comunicado por escrito (data, canal e arquivo) antes de encerrar.",
      );
      return;
    }
    setSaving(true);
    try {
      const row = {
        user_id: user.id,
        nome: novoNome,
        cpf_cnpj: perfil.cpf_cnpj || null,
        rg: perfil.rg || null,
        orgao_emissor: perfil.orgao_emissor || null,
        nacionalidade: perfil.nacionalidade || null,
        estado_civil: perfil.estado_civil || null,
        profissao: perfil.profissao || null,
        endereco: perfil.endereco || null,
        municipio: perfil.municipio || null,
        uf: perfil.uf || null,
        cep: perfil.cep || null,
        telefone: perfil.telefone || null,
        email: perfil.email || null,
        nome_propriedade: perfil.nome_propriedade || null,
        area_hectares: perfil.area_hectares ? parseFloat(perfil.area_hectares) : null,
        cultura_principal: perfil.cultura_principal || null,
        observacoes: perfil.observacoes || null,
        vip: perfil.vip,
        status_adimplencia: perfil.status_adimplencia,
        situacao: perfil.situacao,
        situacao_motivo: perfil.situacao_motivo.trim() || null,
        ...(exigeComunicado
          ? {
              encerramento_comunicado_em: comunicado.data,
              encerramento_comunicado_canal: comunicado.canal,
              encerramento_comunicado_arquivo: comunicado.arquivo,
              encerramento_comunicado_por: user.id,
              encerramento_comunicado_registrado_em: new Date().toISOString(),
            }
          : {}),
        ...(situacaoMudou
          ? { situacao_alterada_por: user.id, situacao_alterada_em: new Date().toISOString() }
          : {}),
      };

      let clienteId = existingId;
      if (existingId) {
        const { error } = await supabase.from("clientes" as any).update(row).eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("clientes" as any).insert(row).select("id").single();
        if (error) throw error;
        clienteId = (data as any)?.id ?? null;
        setExistingId(clienteId);
      }

      if (clienteId) await salvarBancosContratados(clienteId);


      // Se o nome mudou, propaga nas tabelas ligadas por nome e redireciona a URL
      if (novoNome !== nomeCliente) {
        const results = await Promise.all([
          supabase.from("contratos_vencimentos" as any).update({ nome_cliente: novoNome }).eq("nome_cliente", nomeCliente),
          supabase.from("atendimentos_notas" as any).update({ cliente_nome: novoNome }).eq("cliente_nome", nomeCliente),
          supabase.from("atividades_clientes" as any).update({ nome_cliente: novoNome }).eq("nome_cliente", nomeCliente),
          supabase.from("arquivos_cliente" as any).update({ nome_cliente: novoNome }).eq("nome_cliente", nomeCliente),
        ]);
        const anyErr = results.some((r: any) => r?.error);
        if (anyErr) {
          toast.warning("Nome atualizado, mas alguns vínculos não puderam ser propagados.");
        } else {
          toast.success(`Cliente renomeado: "${nomeCliente}" → "${novoNome}"`);
        }
        onOpenChange(false);
        navigate(`/clientes/${encodeURIComponent(novoNome)}`, { replace: true });
        return;
      }

      toast.success("Perfil do cliente salvo");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Soft-delete da qualificação (clientes) — preserva histórico de processos/laudos
      if (existingId) {
        const { error } = await supabase
          .from("clientes" as any)
          .update({ deleted_at: new Date().toISOString() } as any)
          .eq("id", existingId);
        if (error) throw error;
      }
      // Remove dados diretamente vinculados ao nome do cliente
      await supabase.from("atividades_clientes" as any).delete().eq("nome_cliente", nomeCliente);
      await supabase.from("contratos_vencimentos" as any).delete().eq("nome_cliente", nomeCliente);
      await supabase.from("arquivos_cliente" as any).delete().eq("nome_cliente", nomeCliente);

      toast.success("Cliente excluído");
      setConfirmOpen(false);
      onOpenChange(false);
      if (onDeleted) {
        onDeleted();
      } else {
        navigate("/clientes");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir cliente");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil do Cliente — {nomeCliente}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : (
          <div className="space-y-5 mt-2">
            {/* Nome do cliente (renomear) */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Nome do Cliente</h3>
              <Label className="text-xs text-muted-foreground">Nome completo</Label>
              <Input
                value={nomeEdit}
                onChange={(e) => setNomeEdit(e.target.value)}
                onBlur={() => setNomeEdit((v) => toTitleCaseNome(v))}
                placeholder="Nome do cliente"
              />
              {toTitleCaseNome(nomeEdit) !== nomeCliente && toTitleCaseNome(nomeEdit).length >= 2 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Ao salvar, o nome será normalizado (ex.: <b>{toTitleCaseNome(nomeEdit)}</b>) e atualizado em contratos, atendimentos, atividades e arquivos vinculados.
                </p>
              )}
            </div>

            {/* Classificação */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Classificação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <Checkbox
                    id="vip"
                    checked={perfil.vip}
                    onCheckedChange={(v) => update("vip", !!v)}
                  />
                  <label htmlFor="vip" className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                    <Star className={`w-4 h-4 ${perfil.vip ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                    Cliente VIP
                  </label>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status de Adimplência</Label>
                  <select
                    value={perfil.status_adimplencia}
                    onChange={(e) => update("status_adimplencia", e.target.value)}
                    className={selectClass}
                  >
                    <option value="adimplente">✅ Adimplente</option>
                    <option value="parcial">⚠️ Parcialmente Adimplente</option>
                    <option value="inadimplente">❌ Inadimplente</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Situação do cliente</Label>
                  <select
                    value={perfil.situacao}
                    onChange={(e) => update("situacao", e.target.value)}
                    className={selectClass}
                  >
                    {SITUACOES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {perfil.situacao !== "ativo" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Motivo (obrigatório)</Label>
                    <Input
                      value={perfil.situacao_motivo}
                      onChange={(e) => update("situacao_motivo", e.target.value)}
                      placeholder="Ex.: contrato encerrado em 08/2026"
                    />
                  </div>
                )}
              </div>
              {perfil.situacao !== "ativo" && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Clientes fora de "Ativo" saem do radar de vencimentos. As operações continuam salvas na ficha.
                </p>
              )}
            </div>

            {existingId && (
              <EncerramentoComunicadoSection
                clienteId={existingId}
                situacao={perfil.situacao}
                situacaoOriginal={situacaoOriginal}
                valor={comunicado}
                onChange={setComunicado}
                onOperacoes={setOpsProximas}
                podeEncerrar={isAdmin}
              />
            )}
            {comunicadoGravado?.data && (
              <p className="text-[11px] text-muted-foreground">
                Cliente comunicado por escrito dos vencimentos em{" "}
                {comunicadoGravado.data.split("-").reverse().join("/")}
                {comunicadoGravado.canal ? ` (${comunicadoGravado.canal})` : ""}.
              </p>
            )}

            {/* Bancos contratados — mesma seção do fechamento */}
            <BancosContratadosSection
              bancosDasOperacoes={bancosOps}
              marcados={bancosContratados}
              onChange={setBancosContratados}
              disabled={!isAdmin}
              avisoBloqueio="Alteração só pelo Willian."
            />



            {/* Identificação */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Identificação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
                  <MaskedInput mask="cpfCnpj" value={perfil.cpf_cnpj} onChange={(v) => update("cpf_cnpj", v)} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">RG</Label>
                  <Input value={perfil.rg} onChange={(e) => update("rg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Órgão Emissor</Label>
                  <Input value={perfil.orgao_emissor} onChange={(e) => update("orgao_emissor", e.target.value)} placeholder="SSP/UF" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nacionalidade</Label>
                  <Input value={perfil.nacionalidade} onChange={(e) => update("nacionalidade", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estado Civil</Label>
                  <select value={perfil.estado_civil} onChange={(e) => update("estado_civil", e.target.value)} className={selectClass}>
                    <option value="">Selecione</option>
                    {estadosCivis.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Profissão</Label>
                  <Input value={perfil.profissao} onChange={(e) => update("profissao", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Contato e Endereço */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contato e Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <MaskedInput mask="telefone" value={perfil.telefone} onChange={(v) => update("telefone", v)} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <Input type="email" value={perfil.email} onChange={(e) => update("email", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Endereço</Label>
                  <Input value={perfil.endereco} onChange={(e) => update("endereco", e.target.value)} placeholder="Rua, número, bairro" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Município</Label>
                  <Input value={perfil.municipio} onChange={(e) => update("municipio", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">UF</Label>
                  <select value={perfil.uf} onChange={(e) => update("uf", e.target.value)} className={selectClass}>
                    <option value="">Selecione</option>
                    {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CEP</Label>
                  <MaskedInput mask="cep" value={perfil.cep} onChange={(v) => update("cep", v)} placeholder="00000-000" />
                </div>
              </div>
            </div>

            {/* Propriedade */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Propriedade Rural</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome da Propriedade</Label>
                  <Input value={perfil.nome_propriedade} onChange={(e) => update("nome_propriedade", e.target.value)} placeholder="Fazenda..." />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Área (hectares)</Label>
                  <Input type="number" step="0.01" value={perfil.area_hectares} onChange={(e) => update("area_hectares", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Cultura Principal</Label>
                  <Input value={perfil.cultura_principal} onChange={(e) => update("cultura_principal", e.target.value)} placeholder="Soja, Milho, Café..." />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={perfil.observacoes} onChange={(e) => update("observacoes", e.target.value)} rows={3} placeholder="Anotações gerais sobre o cliente..." />
            </div>
          </div>
        )}

        <div className="flex justify-between items-center gap-3 mt-4 pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => setConfirmOpen(true)}
            disabled={saving || loading || deleting}
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" /> Excluir cliente
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Perfil"}
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente "{nomeCliente}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação removerá a qualificação do cliente, suas atividades, contratos cadastrados
                e arquivos do Drive. Processos e laudos vinculados serão preservados no histórico,
                mas o cliente deixará de aparecer na lista. Não é possível desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Excluindo..." : "Excluir definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
