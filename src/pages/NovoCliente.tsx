import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Plus, Trash2, Save, UserPlus, ArrowLeft, AlertTriangle, CalendarDays, CheckCircle2, FilePlus, Scale } from "lucide-react";
import { LaudoActionDialog } from "@/components/LaudoActionDialog";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays, subDays } from "date-fns";
import { upsertClienteFromLaudo } from "@/lib/upsertCliente";
import { formatCpfCnpj } from "@/lib/utils";

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const bancos = [
  "Banco do Brasil","Caixa Econômica Federal","Bradesco","Itaú","Santander",
  "Sicoob","Sicredi","Cresol","Banrisul","BNB","BASA","BNDES","Banco Safra","Banco CNH",
  "BTG Pactual","ABC Brasil","Rabobank","Outro",
];

interface ContratoForm {
  id: string;
  banco: string;
  numero_contrato: string;
  valor_total_operacao: string;
  valor_parcela: string;
  vencimento_proxima_parcela: string;
  observacoes: string;
}

function criarContrato(): ContratoForm {
  return {
    id: crypto.randomUUID(),
    banco: "",
    numero_contrato: "",
    valor_total_operacao: "",
    valor_parcela: "",
    vencimento_proxima_parcela: "",
    observacoes: "",
  };
}

function calcularPrazoLaudo(vencimentoStr: string): { dias: number; label: string; urgente: boolean } {
  const hoje = new Date();
  const venc = new Date(vencimentoStr + "T12:00:00");
  const diasAteVenc = differenceInDays(venc, hoje);

  if (diasAteVenc <= 2) {
    return { dias: 0, label: "URGENTE — D-0 (vencimento imediato)", urgente: true };
  } else if (diasAteVenc <= 30) {
    return { dias: 7, label: "7 dias (vencimento em até 30 dias)", urgente: false };
  } else {
    return { dias: 15, label: "15 dias (vencimento superior a 90 dias)", urgente: false };
  }
}

export default function NovoCliente() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [laudoDialogOpen, setLaudoDialogOpen] = useState(false);

  // Client data
  const [nomeCliente, setNomeCliente] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [nomePropriedade, setNomePropriedade] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [culturaPrincipal, setCulturaPrincipal] = useState("");

  // Commercial checklist
  const [dividaProximaVencer, setDividaProximaVencer] = useState(false);
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState("");
  const [contratosEmMaos, setContratosEmMaos] = useState(false);
  const [necessitaCautelar, setNecessitaCautelar] = useState(false);
  const [criarProcesso, setCriarProcesso] = useState(true);

  // Contracts
  const [contratos, setContratos] = useState<ContratoForm[]>([criarContrato()]);

  const addContrato = () => setContratos([...contratos, criarContrato()]);
  const removeContrato = (id: string) => {
    if (contratos.length <= 1) return;
    setContratos(contratos.filter((c) => c.id !== id));
  };
  const updateContrato = (id: string, field: keyof ContratoForm, value: string) => {
    setContratos(contratos.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  // Derive urgency info from first vencimento
  const primeiroVencimento = dataPrimeiroVencimento || contratos.find(c => c.vencimento_proxima_parcela)?.vencimento_proxima_parcela || "";
  const urgenciaInfo = primeiroVencimento ? calcularPrazoLaudo(primeiroVencimento) : null;

  const handleSave = async (opts?: { goToProcesso?: boolean }) => {
    if (!nomeCliente.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (contratos.every((c) => !c.banco)) {
      toast.error("Adicione pelo menos um banco/contrato");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const rows = contratos
        .filter((c) => c.banco)
        .map((c) => ({
          user_id: userData.user!.id,
          nome_cliente: nomeCliente.trim(),
          banco: c.banco,
          numero_contrato: c.numero_contrato || null,
          valor_total_operacao: c.valor_total_operacao ? parseFloat(c.valor_total_operacao) : null,
          valor_parcela: c.valor_parcela ? parseFloat(c.valor_parcela) : null,
          vencimento_proxima_parcela: c.vencimento_proxima_parcela || null,
          observacoes: [
            cpfCnpj && `CPF/CNPJ: ${cpfCnpj}`,
            municipio && `Município: ${municipio}`,
            uf && `UF: ${uf}`,
            telefone && `Telefone: ${telefone}`,
            email && `Email: ${email}`,
            dividaProximaVencer && `⚠ Dívida próxima a vencer`,
            dataPrimeiroVencimento && `1º Vencimento: ${format(new Date(dataPrimeiroVencimento + "T12:00:00"), "dd/MM/yyyy")}`,
            necessitaCautelar && `⚠ Necessita ação cautelar`,
            contratosEmMaos && `✓ Contratos em mãos`,
            c.observacoes,
          ].filter(Boolean).join(" | ") || null,
          responsavel_gestao: responsavel || null,
        }));

      const { error } = await supabase.from("contratos_vencimentos").insert(rows);
      if (error) throw error;

      // === UPSERT CLIENT PROFILE ===
      await upsertClienteFromLaudo(userData.user!.id, {
        nome: nomeCliente.trim(),
        cpf_cnpj: cpfCnpj || undefined,
        municipio: municipio || undefined,
        uf: uf || undefined,
        telefone: telefone || undefined,
        email: email || undefined,
        estado_civil: estadoCivil || undefined,
        nomePropriedade: nomePropriedade || undefined,
        areaHectares: areaHectares || undefined,
        cultura: culturaPrincipal || undefined,
      });

      // === AUTO-CREATE ONBOARDING TASK ===
      await criarTarefaOnboarding(userData.user!.id, nomeCliente.trim());

      // === AUTO-CREATE PROCESS IF REQUESTED ===
      if (criarProcesso) {
        try {
          // Um processo por banco informado (fallback: um único processo sem banco)
          const bancosUnicos = Array.from(
            new Set(
              contratos
                .filter((c) => c.banco)
                .map((c) => c.banco.trim())
            )
          );
          const alvos = bancosUnicos.length > 0 ? bancosUnicos : [""];

          for (const banco of alvos) {
            const numerosContrato = contratos
              .filter((c) => c.banco?.trim() === banco && c.numero_contrato)
              .map((c) => c.numero_contrato.trim());

            const laudoNum = `L-${Date.now().toString(36).toUpperCase()}-${Math.random()
              .toString(36)
              .slice(2, 5)
              .toUpperCase()}`;

            const { data: laudoData, error: laudoErr } = await supabase
              .from("laudos")
              .insert({
                user_id: userData.user!.id,
                numero_laudo: laudoNum,
                status: "rascunho",
                dados_etapa1: {
                  produtor: nomeCliente.trim(),
                  nome: nomeCliente.trim(),
                  nomeProdutor: nomeCliente.trim(),
                  cpfCnpj: cpfCnpj || undefined,
                  banco: banco || undefined,
                  contratos: numerosContrato.length > 0 ? numerosContrato : undefined,
                  cultura: culturaPrincipal || undefined,
                  municipio: municipio || undefined,
                  uf: uf || undefined,
                },
              })
              .select("id")
              .single();
            if (laudoErr) throw laudoErr;

            await supabase.from("processos").insert({
              user_id: userData.user!.id,
              laudo_id: laudoData.id,
              fase_atual: "1",
            });
          }
          toast.success(
            alvos.length > 1
              ? `${alvos.length} processos criados automaticamente`
              : "Processo criado automaticamente"
          );
        } catch (procErr: any) {
          console.error("Erro ao criar processo:", procErr);
          toast.error("Cliente salvo, mas houve erro ao criar o processo");
        }
      }

      toast.success(`Cliente "${nomeCliente}" cadastrado com ${rows.length} contrato(s)`);
      if (opts?.goToProcesso) {
        navigate(`/processos?cliente=${encodeURIComponent(nomeCliente.trim())}&open=1`);
      } else {
        navigate("/vencimentos");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const criarTarefaOnboarding = async (userId: string, clienteNome: string) => {
    try {
      // Get user's org
      const { data: membro } = await supabase
        .from("membros")
        .select("organizacao_id")
        .eq("user_id", userId)
        .limit(1)
        .single();

      if (!membro) return;

      // Preferência: Gestor de Pós-Venda → Pós-Venda → Admin
      let responsavelId = userId;
      const { data: gestorMembros } = await supabase
        .from("membros")
        .select("user_id")
        .eq("organizacao_id", membro.organizacao_id)
        .eq("papel", "gestor_pos_venda" as any)
        .limit(1);
      if (gestorMembros && gestorMembros.length > 0) {
        responsavelId = gestorMembros[0].user_id;
      } else {
        const { data: posVendaMembros } = await supabase
          .from("membros")
          .select("user_id")
          .eq("organizacao_id", membro.organizacao_id)
          .eq("papel", "pos_venda" as any)
          .limit(1);
        if (posVendaMembros && posVendaMembros.length > 0) {
          responsavelId = posVendaMembros[0].user_id;
        } else {
        const { data: adminMembros } = await supabase
          .from("membros")
          .select("user_id")
          .eq("organizacao_id", membro.organizacao_id)
          .eq("papel", "admin" as any)
          .limit(1);
        if (adminMembros && adminMembros.length > 0) {
          responsavelId = adminMembros[0].user_id;
        }
        }
      }

      const hoje = format(new Date(), "yyyy-MM-dd");

      // Build description
      const descParts = [
        `Onboarding do cliente: ${clienteNome}`,
        dividaProximaVencer ? `⚠ Dívida próxima a vencer` : null,
        dataPrimeiroVencimento ? `1º Vencimento: ${format(new Date(dataPrimeiroVencimento + "T12:00:00"), "dd/MM/yyyy")}` : null,
        urgenciaInfo ? `Prazo para laudo: ${urgenciaInfo.label}` : null,
        contratosEmMaos ? "✓ Cliente já possui contratos em mãos" : "✗ Contratos precisam ser solicitados",
        necessitaCautelar ? "⚠ Pode necessitar ação cautelar" : null,
      ].filter(Boolean).join("\n");

      const prioridade = urgenciaInfo?.urgente ? "urgente" : "normal";

      await supabase.from("tarefas" as any).insert({
        organizacao_id: membro.organizacao_id,
        responsavel_id: responsavelId,
        titulo: `ONBOARDING — ${clienteNome}`,
        descricao: descParts,
        data_vencimento: hoje,
        created_by: userId,
        prioridade,
        nome_cliente: clienteNome,
      } as any);

      // If urgent, notify all org members
      if (prioridade === "urgente") {
        const { data: orgMembros } = await supabase
          .from("membros")
          .select("user_id")
          .eq("organizacao_id", membro.organizacao_id);

        if (orgMembros) {
          const notifications = orgMembros.map(m => ({
            user_id: m.user_id,
            mensagem: `🚨 URGENTE: Onboarding de ${clienteNome} — Vencimento imediato (D-0/D-2). Verificar agenda!`,
            tipo: "urgente",
          }));

          // Use edge function or direct insert for notifications
          for (const notif of notifications) {
            await supabase.from("notificacoes_sistema" as any).insert(notif as any);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao criar tarefa de onboarding:", err);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Novo Cliente</h1>
              <p className="text-sm text-muted-foreground">Cadastre o cliente e seus contratos de financiamento</p>
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Dados do Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Nome do Cliente / Produtor *</Label>
              <Input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">CPF / CNPJ</Label>
              <MaskedInput mask="cpfCnpj" value={cpfCnpj} onChange={setCpfCnpj} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <MaskedInput mask="telefone" value={telefone} onChange={setTelefone} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Responsável pela Gestão</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Município</Label>
              <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Município" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">UF</Label>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Estado Civil</Label>
              <select
                value={estadoCivil}
                onChange={(e) => setEstadoCivil(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione</option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="União Estável">União Estável</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nome da Propriedade</Label>
              <Input value={nomePropriedade} onChange={(e) => setNomePropriedade(e.target.value)} placeholder="Ex: Sítio São José" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Área (hectares)</Label>
              <Input value={areaHectares} onChange={(e) => setAreaHectares(e.target.value)} placeholder="Ex: 50" type="number" step="0.01" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cultura Principal</Label>
              <Input value={culturaPrincipal} onChange={(e) => setCulturaPrincipal(e.target.value)} placeholder="Ex: Soja, Milho, Café" />
            </div>
          </div>
        </div>

        {/* Commercial Summary / Checklist */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent" /> Resumo Comercial
          </h2>

          <div className="space-y-4">
            {/* Dívida próxima a vencer */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
              <Checkbox
                id="divida-vencer"
                checked={dividaProximaVencer}
                onCheckedChange={(v) => setDividaProximaVencer(!!v)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label htmlFor="divida-vencer" className="text-sm font-medium text-foreground cursor-pointer">
                  Dívida próxima a vencer?
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">Marque se o cliente possui parcelas com vencimento iminente</p>
                {dividaProximaVencer && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Data do 1º vencimento</Label>
                    <Input
                      value={dataPrimeiroVencimento}
                      onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                      type="date"
                      className="w-48"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contratos em mãos */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
              <Checkbox
                id="contratos-maos"
                checked={contratosEmMaos}
                onCheckedChange={(v) => setContratosEmMaos(!!v)}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="contratos-maos" className="text-sm font-medium text-foreground cursor-pointer">
                  Cliente já possui os contratos em mãos?
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">Se não, o Pós-Venda precisará solicitar ao cliente</p>
              </div>
            </div>

            {/* Necessita cautelar */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
              <Checkbox
                id="cautelar"
                checked={necessitaCautelar}
                onCheckedChange={(v) => setNecessitaCautelar(!!v)}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="cautelar" className="text-sm font-medium text-foreground cursor-pointer">
                  Pode necessitar ação cautelar?
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">Marque se há risco de necessidade de medida judicial urgente</p>
              </div>
            </div>

            {/* Criar processo */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border">
              <Checkbox
                id="criar-processo"
                checked={criarProcesso}
                onCheckedChange={(v) => setCriarProcesso(!!v)}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="criar-processo" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                  <Scale className="w-4 h-4 text-accent" /> Criar processo automaticamente
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">Um laudo em rascunho e processo serão criados junto com o cadastro do cliente</p>
              </div>
            </div>

            {/* Urgency indicator */}
            {urgenciaInfo && (
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                urgenciaInfo.urgente
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-accent/5 border-accent/30"
              }`}>
                {urgenciaInfo.urgente ? (
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                ) : (
                  <CalendarDays className="w-5 h-5 text-accent shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-semibold ${urgenciaInfo.urgente ? "text-destructive" : "text-accent"}`}>
                    Prazo estimado para laudo: {urgenciaInfo.label}
                  </p>
                  {urgenciaInfo.urgente && (
                    <p className="text-xs text-destructive/80 mt-0.5">
                      Um alerta urgente será enviado a toda a equipe ao cadastrar este cliente.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contracts */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Contratos de Financiamento</h2>
            <button
              onClick={addContrato}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar Contrato
            </button>
          </div>

          <div className="space-y-4">
            {contratos.map((contrato, idx) => (
              <div key={contrato.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground">Contrato {idx + 1}</span>
                  {contratos.length > 1 && (
                    <button onClick={() => removeContrato(contrato.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Banco *</Label>
                    <select
                      value={contrato.banco}
                      onChange={(e) => updateContrato(contrato.id, "banco", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Selecione o banco</option>
                      {bancos.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nº do Contrato</Label>
                    <Input
                      value={contrato.numero_contrato}
                      onChange={(e) => updateContrato(contrato.id, "numero_contrato", e.target.value)}
                      placeholder="Número do contrato"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor Total da Operação (R$)</Label>
                    <Input
                      value={contrato.valor_total_operacao}
                      onChange={(e) => updateContrato(contrato.id, "valor_total_operacao", e.target.value)}
                      placeholder="0,00"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor da Parcela (R$)</Label>
                    <Input
                      value={contrato.valor_parcela}
                      onChange={(e) => updateContrato(contrato.id, "valor_parcela", e.target.value)}
                      placeholder="0,00"
                      type="number"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vencimento Próxima Parcela</Label>
                    <Input
                      value={contrato.vencimento_proxima_parcela}
                      onChange={(e) => updateContrato(contrato.id, "vencimento_proxima_parcela", e.target.value)}
                      type="date"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <Input
                      value={contrato.observacoes}
                      onChange={(e) => updateContrato(contrato.id, "observacoes", e.target.value)}
                      placeholder="Notas sobre este contrato"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setLaudoDialogOpen(true)}
            disabled={!nomeCliente.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-accent text-accent hover:bg-accent/5 disabled:opacity-30 transition-all"
          >
            <FilePlus className="w-4 h-4" /> Gerar / Retificar Laudo
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover disabled:opacity-40 transition-all"
            >
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Cadastrar Cliente"}
            </button>
            <button
              onClick={() => handleSave({ goToProcesso: true })}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:shadow-card-hover disabled:opacity-40 transition-all"
            >
              <Scale className="w-4 h-4" /> {saving ? "Salvando..." : "Cadastrar e Criar Processo"}
            </button>
          </div>
        </div>

        <LaudoActionDialog
          open={laudoDialogOpen}
          onOpenChange={setLaudoDialogOpen}
          nomeCliente={nomeCliente.trim()}
        />
      </div>
    </AppLayout>
  );
}
