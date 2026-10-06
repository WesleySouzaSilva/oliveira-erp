import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MaskedInput } from "@/components/ui/masked-input";
import { Badge } from "@/components/ui/badge";
import {
  HandCoins, Plus, Trash2, UserPlus, AlertTriangle,
  Sparkles, Loader2, UploadCloud, CheckCircle2, XCircle, FileUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { diasRestantes, MODALIDADES, notifyRadarChanged } from "@/hooks/useOperacoesCredito";
import { dispararAdvbox } from "@/lib/advboxDisparo";
import { BancosContratadosSection } from "@/components/cliente/BancosContratadosSection";
import { urgenteNoCadastro, rotuloUrgencia } from "@/lib/urgencia";
import { MSG_NUMERO_E_CPF, numeroEhDocumento } from "@/lib/numeroOperacao";
import { toTitleCaseNome } from "@/components/EditClientePerfilDialog";
import {
  ETAPAS, PESSOA_PADRAO, RESPOSTAS_PADRAO, gerarItens, TIPOS_PROCESSO, tiposAtivos,
  labelTipoProcesso, type RespostasOnboarding,
} from "@/data/onboardingAgroTemplate";
import { validarArquivo, validarArquivos, ACCEPT_ARQUIVOS } from "@/lib/uploadLimits";


interface TitularForm {
  id: string;
  nome: string;
  documento: string;
}

interface OperacaoForm {
  id: string;
  titularId: string;
  banco: string;
  numero: string;
  modalidade: string;
  saldo: string;
  vence_em: string;
  semData: boolean;
  cedula: File | null;
}

const novoTitular = (): TitularForm => ({ id: crypto.randomUUID(), nome: "", documento: "" });
const novaOperacao = (titularId: string): OperacaoForm => ({
  id: crypto.randomUUID(),
  titularId,
  banco: "",
  numero: "",
  modalidade: "Custeio",
  saldo: "",
  vence_em: "",
  semData: false,
  cedula: null,
});


const normNome = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function NovoClienteFechamento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [grupo, setGrupo] = useState("");
  const [processos, setProcessos] = useState<string[]>([]);
  const [primeiroTitular] = useState<TitularForm>(novoTitular);
  const [titulares, setTitulares] = useState<TitularForm[]>([primeiroTitular]);
  // A primeira operação já nasce vinculada ao primeiro titular: contrato solto é escolha explícita.
  const [operacoes, setOperacoes] = useState<OperacaoForm[]>(() => [novaOperacao(primeiroTitular.id)]);
  const [salvando, setSalvando] = useState(false);
  /** Seção "Bancos contratados" — mesma usada no editar cadastro. */
  const [bancosContratados, setBancosContratados] = useState<string[]>([]);


  const [cpfRepetido, setCpfRepetido] = useState<Record<string, boolean>>({});

  /** Avisa que já existe ficha com o mesmo CPF — sem mostrar dados do outro cliente. */
  const conferirDocumento = async (id: string, valor: string) => {
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length < 11) {
      setCpfRepetido((p) => ({ ...p, [id]: false }));
      return;
    }
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .is("deleted_at", null)
      .in("cpf_cnpj", [valor, digitos])
      .limit(1);
    setCpfRepetido((p) => ({ ...p, [id]: !!(data && data.length > 0) }));
  };

  const upTitular = (id: string, campo: keyof TitularForm, valor: string) => {
    setTitulares((p) => p.map((t) => (t.id === id ? { ...t, [campo]: valor } : t)));
    if (campo === "documento") conferirDocumento(id, valor);
  };
  const upOperacao = (id: string, campo: keyof OperacaoForm, valor: any) =>
    setOperacoes((p) => p.map((o) => (o.id === id ? { ...o, [campo]: valor } : o)));

  const upBancoOperacao = (id: string, banco: string) =>
    setOperacoes((prev) => prev.map((op) => (op.id === id ? { ...op, banco } : op)));


  // ---------- Leitura automática de contratos/extratos/prints pela IA ----------
  type FilaItem = { id: string; nome: string; status: "fila" | "lendo" | "ok" | "erro"; resumo?: string };
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [lendoIA, setLendoIA] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const loteInputRef = useRef<HTMLInputElement>(null);
  const titularesRef = useRef(titulares);
  titularesRef.current = titulares;

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(((reader.result as string) || "").split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const dataValida = (v: any) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

  /** Preenche (sem sobrescrever o que já foi digitado) uma operação com o que a IA leu. */
  const aplicarExtracao = (dados: Record<string, any>, file: File, alvoId?: string) => {
    const venc =
      dataValida(dados.vencimento_proxima_parcela) ||
      dataValida(dados.primeiro_vencimento) ||
      dataValida(dados.vencimento_ultima_parcela);
    const valor =
      typeof dados.valor_total_operacao === "number"
        ? dados.valor_total_operacao
        : typeof dados.valor_parcela === "number"
          ? dados.valor_parcela
          : null;

    // Titular: tenta casar com quem já está na tela; senão preenche/cria lá em cima.
    const nomeLido = String(dados.nome_cliente || "").trim();
    const docLido = String(dados.cpf_cnpj || "").replace(/[^\d]/g, "");
    const lista = titularesRef.current;
    let titularId = "";
    const lido = normNome(nomeLido);
    if (lido) {
      const achado = lista.find((t) => {
        const n = normNome(t.nome);
        return n && (n === lido || lido.includes(n) || n.includes(lido));
      });
      if (achado) titularId = achado.id;
    }
    if (!titularId && docLido.length >= 11) {
      const porDoc = lista.find((t) => t.documento.replace(/\D/g, "") === docLido);
      if (porDoc) titularId = porDoc.id;
    }

    if (!titularId && nomeLido) {
      // Sem correspondência: usa o primeiro titular ainda em branco, ou cria um novo.
      const vazio = lista.find((t) => !t.nome.trim());
      const alvoTitular = vazio || novoTitular();
      titularId = alvoTitular.id;
      const nomeFmt = toTitleCaseNome(nomeLido);
      const docFmt = docLido.length >= 11 ? docLido : "";
      setTitulares((prev) => {
        const existe = prev.some((t) => t.id === alvoTitular.id);
        const atualizado = prev.map((t) =>
          t.id === alvoTitular.id
            ? { ...t, nome: t.nome.trim() || nomeFmt, documento: t.documento.trim() || docFmt }
            : t,
        );
        return existe ? atualizado : [...atualizado, { ...alvoTitular, nome: nomeFmt, documento: docFmt }];
      });
      if (docFmt) conferirDocumento(alvoTitular.id, docFmt);
    } else if (titularId && docLido.length >= 11) {
      setTitulares((prev) =>
        prev.map((t) => (t.id === titularId && !t.documento.trim() ? { ...t, documento: docLido } : t)),
      );
    }
    if (!titularId && lista.length === 1) titularId = lista[0].id;

    // Grupo em branco: assume o nome do titular lido (o comercial pode trocar depois).
    if (nomeLido) setGrupo((g) => g.trim() || toTitleCaseNome(nomeLido));

    const partes: string[] = [];
    if (nomeLido) partes.push(nomeLido);
    if (dados.banco) partes.push(String(dados.banco));
    if (dados.numero_contrato) partes.push(`nº ${dados.numero_contrato}`);
    if (venc) partes.push(venc.split("-").reverse().join("/"));
    if (valor != null)
      partes.push(`R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    setOperacoes((prev) => {
      const aplicar = (o: OperacaoForm): OperacaoForm => ({
        ...o,
        titularId: o.titularId || titularId,
        banco: o.banco.trim() || String(dados.banco || ""),
        numero: o.numero.trim() || String(dados.numero_contrato || ""),
        saldo:
          o.saldo.trim() ||
          (valor != null
            ? valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : ""),
        vence_em: o.semData ? o.vence_em : o.vence_em || venc,
        cedula: o.cedula || file,
      });

      if (alvoId) return prev.map((o) => (o.id === alvoId ? aplicar(o) : o));
      const vaga = prev.find((o) => !o.banco.trim() && !o.numero.trim() && !o.cedula);
      if (vaga) return prev.map((o) => (o.id === vaga.id ? aplicar(o) : o));
      return [...prev, aplicar(novaOperacao(titularId))];
    });

    const faltou: string[] = [];
    if (!venc) faltou.push("vencimento");
    if (!nomeLido) faltou.push("titular");
    const base = partes.length ? partes.join(" · ") : "Documento anexado";
    return faltou.length ? `${base} — preencha à mão: ${faltou.join(" e ")}` : base;
  };


  /** Lê um ou vários arquivos em fila, sem travar a tela. */
  const lerArquivos = async (arquivos: File[], alvoId?: string) => {
    const validos = arquivos.filter(Boolean);
    if (!validos.length) return;
    const erroArquivo = validarArquivos(validos);
    if (erroArquivo) { toast.error(erroArquivo); return; }
    setLendoIA(true);

    const itens: FilaItem[] = validos.map((f) => ({ id: crypto.randomUUID(), nome: f.name, status: "fila" }));
    setFila((p) => [...p, ...itens]);

    for (let i = 0; i < validos.length; i++) {
      const file = validos[i];
      const item = itens[i];
      const marcar = (patch: Partial<FilaItem>) =>
        setFila((p) => p.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
      marcar({ status: "lendo" });
      try {
        if (file.size > 6 * 1024 * 1024) throw new Error("Arquivo acima de 6MB — reduza ou recorte as páginas principais.");
        const base64 = await toBase64(file);
        const { data, error } = await supabase.functions.invoke("extrair-contrato-vencimento", {
          body: { arquivo_base64: base64, arquivo_mime: file.type, arquivo_nome: file.name },
        });
        if (error) throw error;
        if (!data?.ok || !data?.dados) throw new Error(data?.error || "Não foi possível ler o documento.");
        const resumo = aplicarExtracao(data.dados as Record<string, any>, file, alvoId);
        marcar({ status: "ok", resumo });
      } catch (e: any) {
        marcar({ status: "erro", resumo: e?.message || "Falha na leitura." });
      }
    }
    setLendoIA(false);
    toast.success("Leitura concluída — confira os dados antes de salvar.");
  };



  const urgentes = useMemo(
    () =>
      operacoes
        .filter((o) => !o.semData && o.vence_em)
        .map((o) => ({ op: o, dias: diasRestantes(o.vence_em) }))
        .filter((x) => x.dias <= 60),
    [operacoes],
  );

  // Grupo é opcional: sem grupo informado, usa o nome do primeiro titular.
  const grupoFinal = useMemo(
    () => grupo.trim() || toTitleCaseNome((titulares[0]?.nome || "").trim()),
    [grupo, titulares],
  );


  const erros = useMemo(() => {
    const e: string[] = [];

    if (titulares.length === 0) e.push("Cadastre ao menos um titular.");
    titulares.forEach((t, i) => {
      if (!t.nome.trim()) e.push(`Titular ${i + 1}: informe o nome.`);
      if (!t.documento.trim()) e.push(`Titular ${i + 1}: informe o CPF ou CNPJ.`);
    });
    titulares.forEach((t, i) => {
      if (cpfRepetido[t.id])
        e.push(`Titular ${i + 1}: já existe cliente com este CPF — fale com o Willian antes de cadastrar.`);
    });
    if (operacoes.length === 0) e.push("Cadastre ao menos uma operação.");
    operacoes.forEach((o, i) => {
      if (!o.banco.trim()) e.push(`Operação ${i + 1}: informe o banco.`);
      if (!o.numero.trim()) e.push(`Operação ${i + 1}: informe o número.`);
      // O número do Banco do Brasil tem o formato do começo de um CPF: recusar o documento no lugar do contrato.
      if (numeroEhDocumento(o.numero, titulares.map((t) => t.documento)))
        e.push(`Operação ${i + 1}: ${MSG_NUMERO_E_CPF}`);
      if (!o.vence_em && !o.semData)
        e.push(`Operação ${i + 1}: informe o vencimento ou marque "cliente não sabe a data".`);
    });
    if (processos.length === 0)
      e.push("Responda se há processo ou cobrança em andamento contra o cliente.");
    if (bancosContratados.length === 0)
      e.push("Marque pelo menos um banco em 'Bancos contratados'.");
    return e;
  }, [titulares, operacoes, cpfRepetido, processos, bancosContratados]);


  const salvar = async () => {
    if (!user) return;
    if (erros.length) {
      toast.error(erros[0]);
      return;
    }
    setSalvando(true);
    try {
      const { data: membro } = await supabase
        .from("membros")
        .select("organizacao_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const orgId = (membro as any)?.organizacao_id ?? null;
      if (!orgId) throw new Error("Você precisa pertencer a uma organização.");

      const agora = new Date().toISOString();
      const idsPorTitular = new Map<string, string>();
      // Distribuição automática: o banco escolhe o responsável (grupo familiar ou menor carteira).
      const responsavelPorTitular = new Map<string, string | null>();

      for (const t of titulares) {
        const nome = toTitleCaseNome(t.nome.trim());
        const { data, error } = await supabase
          .from("clientes")
          .upsert(
            {
              user_id: user.id,
              organizacao_id: orgId,
              nome,
              cpf_cnpj: t.documento.trim(),
              grupo: grupoFinal,
              situacao: "ativo",
              aguardando_distribuicao: false,
              cadastrado_por: user.id,
              cadastrado_em: agora,
            } as any,
            { onConflict: "user_id,nome" },
          )
          .select("id, responsavel_pos_venda")
          .single();
        if (error) throw error;
        idsPorTitular.set(t.id, (data as any).id as string);
        responsavelPorTitular.set(t.id, ((data as any).responsavel_pos_venda as string) || null);
      }

      // Nome curto do responsável, para a operação já cair na fila de conferência certa.
      const nomeCurtoPorUser = new Map<string, string>();
      const userIds = Array.from(new Set(Array.from(responsavelPorTitular.values()).filter(Boolean))) as string[];
      if (userIds.length) {
        const { data: resps } = await supabase
          .from("carteira_responsaveis")
          .select("user_id, nome_curto")
          .in("user_id", userIds);
        ((resps as any[]) || []).forEach((r) => nomeCurtoPorUser.set(r.user_id, r.nome_curto));
      }
      const distribuidos = Array.from(new Set(Array.from(nomeCurtoPorUser.values())));


      const avisos: { cliente: string; banco: string; numero: string; data: string; dias: number; urgente: boolean }[] = [];
      // Cédulas já enviadas pelo comercial, por titular — entram como recebidas no checklist do pós-venda.
      const cedulasPorTitular = new Map<string, { path: string; nome: string }>();
      // Operações criadas, para gerar os itens de nível "operação" do checklist.
      const opsCriadas: { id: string; clienteId: string | null; label: string; cedula: { path: string; nome: string } | null }[] = [];
      // Situação de cada banco já definida no fechamento (sem depender do Willian).
      const escopos = new Map<string, { clienteId: string; banco: string; escopo: string }>();
      const bancosContratadosSet = new Set(bancosContratados.map((b) => normNome(b)));


      for (const o of operacoes) {
        const clienteId = idsPorTitular.get(o.titularId) || null;
        let cedulaPath: string | null = null;
        if (o.cedula) {
          const safe = o.cedula.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${user.id}/${grupoFinal.replace(/\s+/g, "_")}/cedulas/${Date.now()}_${safe}`;
          const { error: upErr } = await supabase.storage.from("cliente-drive").upload(path, o.cedula);
          if (!upErr) {
            cedulaPath = path;
            if (!cedulasPorTitular.has(o.titularId))
              cedulasPorTitular.set(o.titularId, { path, nome: o.cedula.name });
          }
        }

        const temData = !o.semData && !!o.vence_em;
        const urgente = temData && urgenteNoCadastro(o.vence_em);
        const respUser = responsavelPorTitular.get(o.titularId) || null;
        const { data: opCriada, error } = await supabase.from("operacoes_credito").insert({
          organizacao_id: orgId,
          cliente_id: clienteId,
          grupo: grupoFinal,
          titular_a_definir: !clienteId,
          responsavel: (respUser && nomeCurtoPorUser.get(respUser)) || null,
          banco: o.banco.trim(),
          numero: o.numero.trim(),
          modalidade: o.modalidade,
          vence_em: temData ? o.vence_em : null,
          saldo_devedor: o.saldo ? Number(o.saldo.replace(/\./g, "").replace(",", ".")) : null,
          status_conferencia: temData ? "radar" : "sem_vencimento",
          // A data do fechamento sempre passa pela conferência de quem recebeu o cliente.
          data_conferida: false,
          // Via de urgência: vai direto para a fila de protocolo, sem esperar o laudo.
          entrada_urgente: urgente,
          urgencia_em: urgente ? agora : null,
          pronta_protocolar: urgente,
          cedula_path: cedulaPath,
          cadastrado_por: user.id,
          cadastrado_em: agora,
          created_by: user.id,
        } as any).select("id").single();
        if (error) throw error;
        if (clienteId && o.banco.trim()) {
          const escopo = bancosContratadosSet.has(normNome(o.banco)) ? "contratado" : "fora_escopo";
          escopos.set(`${clienteId}|${normNome(o.banco)}`, {
            clienteId,
            banco: o.banco.trim(),
            escopo,
          });
        }

        if (opCriada) {
          opsCriadas.push({
            id: (opCriada as any).id as string,
            clienteId,
            label: `${o.banco.trim()} nº ${o.numero.trim()}`,
            cedula: cedulaPath ? { path: cedulaPath, nome: o.cedula?.name || "cédula" } : null,
          });
        }

        if (temData) {
          const dias = diasRestantes(o.vence_em);
          if (dias <= 60) {
            const nomeCliente =
              titulares.find((t) => t.id === o.titularId)?.nome.trim() || grupoFinal;
            avisos.push({
              cliente: nomeCliente,
              banco: o.banco.trim(),
              numero: o.numero.trim(),
              data: o.vence_em,
              dias,
              urgente,
            });
          }
        }
      }

      if (avisos.length) {
        const { data: cfg } = await supabase.from("radar_etapas_config").select("protocola");
        const nomesAvisar = Array.from(
          new Set([...(((cfg as any[]) || []).map((c) => c.protocola).filter(Boolean)), "Willian", "Vitoria"]),
        ) as string[];
        const { data: perfis } = await supabase.from("profiles_publico").select("id, nome");
        const destinatarios = ((perfis as any[]) || [])
          .filter((p) => nomesAvisar.some((n) => (p.nome || "").toLowerCase().includes(n.toLowerCase())))
          .map((p) => p.id);

        for (const a of avisos) {
          const [y, m, d] = a.data.split("-");
          const msg = a.urgente
            ? `🚨 ENTRADA URGENTE: ${a.cliente} — ${a.banco}, contrato ${a.numero}, vence em ${d}/${m}/${y} (${a.dias < 0 ? `vencida há ${Math.abs(a.dias)} dias` : `${a.dias} dias`}). Vai direto para a fila de protocolo, sem esperar laudo.`
            : `🚨 Fechamento novo: ${a.cliente} — ${a.banco}, contrato ${a.numero}, vence em ${d}/${m}/${y} (${a.dias < 0 ? `vencida há ${Math.abs(a.dias)} dias` : `${a.dias} dias`}).`;
          for (const uid of destinatarios) {
            await supabase.from("notificacoes_sistema").insert({ user_id: uid, mensagem: msg, tipo: "urgente" } as any);
          }
        }
        const pior = avisos.sort((x, y) => x.dias - y.dias)[0];
        toast.warning(
          pior.dias < 0
            ? `Operação já vencida há ${Math.abs(pior.dias)} dias — o jurídico foi avisado`
            : `Operação vence em ${pior.dias} dias — o jurídico foi avisado`,
          { duration: 8000 },
        );
      }

      // Abre um único onboarding por família, com os itens das etapas 1 e 2 do checklist novo.
      let onboardingsCriados = 0;
      let onboardingId: string | null = null;
      const titularesRef = titulares
        .map((t) => ({ id: idsPorTitular.get(t.id) || "", nome: toTitleCaseNome(t.nome.trim()), doc: t.documento.trim() }))
        .filter((t) => !!t.id);

      if (titularesRef.length) {
        const { data: jaTem } = await supabase
          .from("pos_venda_onboardings")
          .select("id")
          .in("cliente_id", titularesRef.map((t) => t.id))
          .limit(1)
          .maybeSingle();

        if (!jaTem) {
          const respostas: RespostasOnboarding = {
            ...RESPOSTAS_PADRAO,
            urgente: avisos.some((a) => a.urgente),
            processos,
            pessoas: Object.fromEntries(
              titularesRef.map((t) => [
                t.id,
                {
                  ...PESSOA_PADRAO,
                  tipo: t.doc.replace(/\D/g, "").length > 11 ? "pj" : "pf",
                  govbr: "sem", // quem mapeia confere o nível no pós-venda
                } as const,
              ]),
            ) as any,
          };

          const { data: ob } = await supabase
            .from("pos_venda_onboardings")
            .insert({
              organizacao_id: orgId,
              responsavel_id: user.id,
              cliente_id: titularesRef[0].id,
              cliente_nome: titularesRef[0].nome,
              grupo: grupoFinal,
              cpf_cnpj: titularesRef[0].doc,
              status: "aberto",
              etapa_atual: 1,
              respostas: respostas as any,
              observacoes: `Aberto automaticamente no fechamento — grupo ${grupoFinal}.`,
            } as any)
            .select("id")
            .single();

          if (ob) {
            onboardingId = (ob as any).id;
            const gerados = gerarItens(
              respostas,
              titularesRef.map((t) => ({ id: t.id, nome: t.nome })),
              opsCriadas.map((o) => ({ id: o.id, label: o.label })),
              tiposAtivos(processos).length || processos.includes("nao_sei") ? [1, 2, 5] : [1, 2],
            );
            const comCedula = new Set(opsCriadas.filter((o) => o.cedula).map((o) => o.id));
            const cedulaPorOp = new Map(opsCriadas.filter((o) => o.cedula).map((o) => [o.id, o.cedula!]));
            const itens = gerados.map((g) => {
              const recebe = g.chave === "cedula_contrato" && !!g.operacao_id && comCedula.has(g.operacao_id);
              const ced = recebe ? cedulaPorOp.get(g.operacao_id!) : null;
              return {
                onboarding_id: (ob as any).id,
                organizacao_id: orgId,
                categoria: `etapa_${g.etapa}`,
                categoria_label: ETAPAS[g.etapa - 1].titulo,
                documento: g.documento,
                nome_simples: g.nome_simples,
                chave: g.chave,
                etapa: g.etapa,
                nivel: g.nivel,
                origem: g.origem,
                obrigatorio: g.obrigatorio,
                titular_cliente_id: g.titular_cliente_id,
                titular_nome: g.titular_nome,
                operacao_id: g.operacao_id,
                operacao_label: g.operacao_label,
                ordem: g.ordem,
                prioridade: g.obrigatorio ? "ESSENCIAL" : "CONDICIONAL",
                status: recebe ? "recebido" : "pendente",
                data_recebimento: recebe ? agora.slice(0, 10) : null,
                anexo_url: ced?.path || null,
                anexo_nome: ced?.nome || null,
              };
            });
            await supabase.from("pos_venda_checklist_itens").insert(itens as any);
            onboardingsCriados = 1;
          }
        }
      }

      // Processos e cobranças em andamento: liga o módulo "Garantias e execução".
      const ativos = tiposAtivos(processos);
      if (ativos.length && opsCriadas.length) {
        const linhas: any[] = [];
        for (const tipo of ativos) {
          for (const op of opsCriadas) {
            linhas.push({
              organizacao_id: orgId,
              onboarding_id: onboardingId,
              cliente_id: op.clienteId || titularesRef[0]?.id || null,
              operacao_id: op.id,
              grupo: grupoFinal,
              tipo,
              status: "ativo",
              created_by: user.id,
            });
          }
        }
        await supabase.from("cliente_execucoes").insert(linhas as any);

        const { data: perfisExec } = await supabase.from("profiles_publico").select("id, nome");
        const destinatariosExec = ((perfisExec as any[]) || [])
          .filter((p) => ["willian", "vitoria"].some((n) => (p.nome || "").toLowerCase().includes(n)))
          .map((p) => p.id);
        for (const tipo of ativos) {
          const msg = `⚠️ Cliente com ${labelTipoProcesso(tipo).toLowerCase()} em andamento — ${grupoFinal}`;
          for (const uid of destinatariosExec) {
            await supabase.from("notificacoes_sistema").insert({ user_id: uid, mensagem: msg, tipo: "urgente" } as any);
          }
        }
        toast.warning(`Módulo de execução ligado: ${ativos.map(labelTipoProcesso).join(", ")}.`, { duration: 8000 });
      }

      // Banco contratado marcado na seção, mas sem operação cadastrada: entra
      // igual, no primeiro titular.
      const clientePrincipal = idsPorTitular.get(titulares[0]?.id || "") || null;
      if (clientePrincipal) {
        for (const banco of bancosContratados) {
          const chave = `${clientePrincipal}|${normNome(banco)}`;
          const jaTem = [...escopos.keys()].some((k) => k.endsWith(`|${normNome(banco)}`));
          if (!jaTem) escopos.set(chave, { clienteId: clientePrincipal, banco: banco.trim(), escopo: "contratado" });
        }
      }

      // Situação por banco definida no fechamento + envio imediato ao ADVBOX
      // dos bancos contratados (cadastro, processo e tarefas da janela).
      const retornosAdvbox: string[] = [];
      if (escopos.size) {

        for (const e of escopos.values()) {
          await supabase.from("cliente_banco_escopo").insert({
            cliente_id: e.clienteId,
            banco: e.banco,
            escopo: e.escopo,
            origem: "fechamento",
            pendencia_comercial: e.escopo === "fora_escopo",
            pendencia_texto:
              e.escopo === "fora_escopo"
                ? `Cliente tem dívida em ${e.banco} fora do contrato — avaliar ampliação`
                : null,
            definido_em: new Date().toISOString(),
          } as any);
          await supabase.from("cliente_banco_escopo_historico").insert({
            cliente_id: e.clienteId,
            banco: e.banco,
            escopo_anterior: null,
            escopo_novo: e.escopo,
            origem: "fechamento",
            alterado_por: user.id,
          } as any);
        }
        const clientesContratados = [
          ...new Set([...escopos.values()].filter((e) => e.escopo === "contratado").map((e) => e.clienteId)),
        ];
        for (const cid of clientesContratados) {
          const r = await dispararAdvbox(cid, "fechamento: banco contratado");
          retornosAdvbox.push(r.texto);
        }
      }

      // Dispara as tarefas do ADVBOX do cliente novo (boleto, documentos,
      // laudo e peticionamento por banco). Só para fechamento novo.
      let tarefasAdvbox = 0;
      if (titularesRef[0]?.id) {
        try {
          const { data: res } = await supabase.functions.invoke("advbox-sync", {
            body: { action: "tarefas_fechamento", params: { cliente_id: titularesRef[0].id } },
          });
          tarefasAdvbox = Number((res as any)?.criadas ?? 0);
        } catch {
          toast.warning("Cliente salvo, mas as tarefas do ADVBOX não foram criadas. Avise o Willian.");
        }
      }

      retornosAdvbox.forEach((t) => toast.info(t, { duration: 10000 }));
      notifyRadarChanged();
      toast.success(
        `${titulares.length} ficha(s) e ${operacoes.length} operação(ões) cadastradas.` +
          (onboardingsCriados ? ` ${onboardingsCriados} onboarding(s) aberto(s) no pós-venda.` : "") +
          (tarefasAdvbox ? ` ${tarefasAdvbox} tarefa(s) criada(s) no ADVBOX.` : "") +
          (distribuidos.length
            ? ` Responsável definido automaticamente: ${distribuidos.join(", ")}.`
            : " O cliente entrou na fila de distribuição."),
      );
      navigate("/pos-venda/carteira");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar o fechamento");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <PageHeader
          icon={HandCoins}
          title="Novo cliente (fechamento)"
          subtitle="Cadastro feito pelo comercial logo após o fechamento do contrato."
          breadcrumb={[{ label: "Negócios" }, { label: "Novo cliente (fechamento)" }]}
        />

        <section className="rounded-lg border border-border bg-card p-5">
          <Label htmlFor="grupo">Grupo (família ou núcleo)</Label>
          <Input
            id="grupo"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            placeholder="Ex.: Família de Boer"
            className="mt-1.5 max-w-md"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Opcional. Sem grupo informado, usamos o nome do primeiro titular
            {grupoFinal ? `: ${grupoFinal}` : ""}.
          </p>

          <div className="mt-5 border-t border-border pt-4">
            <Label className="text-sm">
              Tem processo ou cobrança em andamento contra o cliente?{" "}
              <span className="text-destructive">*</span>
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Pode marcar mais de uma opção. Marcar qualquer processo liga o módulo de execução e avisa o jurídico.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TIPOS_PROCESSO.map((t) => (
                <label key={t.key} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={processos.includes(t.key)}
                    onCheckedChange={(v) =>
                      setProcessos((atual) => {
                        if (!v) return atual.filter((x) => x !== t.key);
                        // "Não" e "Não sei" não convivem com os tipos de processo.
                        if (t.key === "nao" || t.key === "nao_sei") return [t.key];
                        return [...atual.filter((x) => x !== "nao" && x !== "nao_sei"), t.key];
                      })
                    }
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
            {tiposAtivos(processos).length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Willian e Vitoria serão avisados e a família ganha a etapa "Execução / garantias".
              </p>
            )}
            {processos.includes("nao_sei") && (
              <p className="mt-2 text-xs text-amber-700">
                Vamos criar a pendência "Verificar processos e cobranças em nome dos titulares" para o mapeamento (2 dias úteis).
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold">Titulares</h2>
            <Button size="sm" variant="outline" onClick={() => setTitulares((p) => [...p, novoTitular()])}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar titular
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Cada pessoa vira uma ficha própria, com CPF ou CNPJ.</p>
          <div className="space-y-3">
            {titulares.map((t, i) => (
              <div key={t.id} className="space-y-1.5">
                <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
                  <Input
                    value={t.nome}
                    onChange={(e) => upTitular(t.id, "nome", e.target.value)}
                    placeholder={`Nome do titular ${i + 1}`}
                    aria-label={`Nome do titular ${i + 1}`}
                  />
                  <MaskedInput
                    mask="cpfCnpj"
                    value={t.documento}
                    onChange={(v) => upTitular(t.id, "documento", v)}
                    placeholder="CPF ou CNPJ"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={titulares.length === 1}
                    onClick={() => setTitulares((p) => p.filter((x) => x.id !== t.id))}
                    aria-label="Remover titular"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {cpfRepetido[t.id] && (
                  <p className="text-xs font-semibold text-destructive">
                    Já existe cliente com este CPF — fale com o Willian antes de cadastrar.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold">Operações</h2>
            <Button size="sm" variant="outline" onClick={() => setOperacoes((p) => [...p, novaOperacao(titulares[0]?.id || "")])}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar operação
            </Button>
          </div>

          {/* Leitura automática: arraste 1 arquivo ou vários (lote). */}
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              lerArquivos(Array.from(e.dataTransfer.files || []));
            }}
            className={`mb-4 rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
              arrastando ? "border-primary bg-primary/10" : "border-primary/40 bg-primary/5"
            }`}
          >
            <UploadCloud className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-sm font-medium">Arraste contratos, extratos ou prints aqui</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, JPG ou PNG — um arquivo ou vários de uma vez. A IA preenche banco, número, valor e vencimento.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={lendoIA}
              onClick={() => loteInputRef.current?.click()}
            >
              {lendoIA ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Lendo documentos...</>
              ) : (
                <><FileUp className="mr-1 h-4 w-4" /> Selecionar arquivos em lote</>
              )}
            </Button>
            <input
              ref={loteInputRef}
              type="file"
              multiple
              accept={ACCEPT_ARQUIVOS}
              className="hidden"
              onChange={(e) => {
                lerArquivos(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
            {fila.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-left">
                {fila.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-xs">
                    {f.status === "ok" ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : f.status === "erro" ? (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="font-medium">{f.nome}</span>
                      {f.resumo && (
                        <span className={f.status === "erro" ? "text-destructive" : "text-muted-foreground"}>
                          {" "}— {f.resumo}
                        </span>
                      )}
                      {f.status === "lendo" && <span className="text-muted-foreground"> — lendo com IA...</span>}
                      {f.status === "fila" && <span className="text-muted-foreground"> — na fila</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            {operacoes.map((o, i) => {
              const dias = !o.semData && o.vence_em ? diasRestantes(o.vence_em) : null;
              return (
                <div key={o.id} className="rounded-md border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">Operação {i + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={operacoes.length === 1}
                      onClick={() => setOperacoes((p) => p.filter((x) => x.id !== o.id))}
                      aria-label="Remover operação"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Titular</Label>
                      <select
                        className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={o.titularId}
                        onChange={(e) => upOperacao(o.id, "titularId", e.target.value)}
                      >
                        <option value="">Titular a definir</option>
                        {titulares.map((t) => (
                          <option key={t.id} value={t.id}>{t.nome || "(sem nome)"}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Banco *</Label>
                      <Input className="mt-1.5" value={o.banco} onChange={(e) => upBancoOperacao(o.id, e.target.value)} />
                    </div>

                    <div>
                      <Label>Número do contrato *</Label>
                      <Input className="mt-1.5" value={o.numero} onChange={(e) => upOperacao(o.id, "numero", e.target.value)} />
                    </div>
                    <div>
                      <Label>Modalidade</Label>
                      <select
                        className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={o.modalidade}
                        onChange={(e) => upOperacao(o.id, "modalidade", e.target.value)}
                      >
                        {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Saldo devedor</Label>
                      <Input className="mt-1.5" value={o.saldo} onChange={(e) => upOperacao(o.id, "saldo", e.target.value)} placeholder="Ex.: 250.000,00" />
                    </div>
                    <div>
                      <Label>Próximo vencimento</Label>
                      <Input
                        className="mt-1.5"
                        type="date"
                        disabled={o.semData}
                        value={o.vence_em}
                        onChange={(e) => upOperacao(o.id, "vence_em", e.target.value)}
                      />
                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={o.semData}
                          onCheckedChange={(v) => {
                            upOperacao(o.id, "semData", !!v);
                            if (v) upOperacao(o.id, "vence_em", "");
                          }}
                        />
                        Cliente não sabe a data
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`cedula-${o.id}`}>Cédula (opcional)</Label>
                      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          id={`cedula-${o.id}`}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            const err = f ? validarArquivo(f) : null;
                            if (err) { toast.error(err); e.target.value = ""; return; }
                            upOperacao(o.id, "cedula", f);
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={lendoIA || !o.cedula}
                          onClick={() => o.cedula && lerArquivos([o.cedula], o.id)}
                        >
                          <Sparkles className="mr-1 h-4 w-4" /> Ler com IA
                        </Button>
                      </div>
                      {o.cedula && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Arquivo anexado: {o.cedula.name}
                        </p>
                      )}
                    </div>

                  </div>
                  {dias != null && dias <= 60 && (
                    <p className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      {dias < 0
                        ? `Operação já vencida há ${Math.abs(dias)} dias — o jurídico será avisado`
                        : `Operação vence em ${dias} dias — o jurídico será avisado`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <BancosContratadosSection
          bancosDasOperacoes={operacoes.map((o) => o.banco)}
          marcados={bancosContratados}
          onChange={setBancosContratados}
          obrigatorio
        />



        {urgentes.length > 0 && (
          <Badge variant="outline" className="border-destructive font-normal text-destructive">
            {urgentes.length} operação(ões) vencendo em até 60 dias — Willian e Vitória serão avisados ao salvar
          </Badge>
        )}

        {erros.length > 0 && (
          <ul className="list-inside list-disc rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {erros.slice(0, 4).map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || erros.length > 0}>
            <UserPlus className="mr-1 h-4 w-4" /> Salvar fechamento
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
