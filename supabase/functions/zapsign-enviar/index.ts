// Envia um PDF ao ZapSign (POST /docs/). Só roda com usuário interno autenticado.
import { adminClient, autenticarInterno, corsHeaders, cpfValido, json, somenteDigitos, zapsign, zapsignToken } from "../_shared/zapsign.ts";

const MAX_PDF = 10 * 1024 * 1024;

type SignatarioIn = {
  nome: string; email?: string; telefone?: string; cpf?: string;
  qualificacao?: string; papel?: "cliente" | "avulso" | "escritorio"; cliente_id?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  const auth = await autenticarInterno(req, admin);
  if (!auth.ok) return json({ error: "Não autorizado" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }

  // Consulta leve: a integração está configurada?
  if (body?.acao === "status") return json({ configurado: !!Deno.env.get("ZAPSIGN_API_TOKEN") });

  try { zapsignToken(); } catch { return json({ error: "Integração não configurada: cadastre o segredo ZAPSIGN_API_TOKEN." }, 412); }

  const { organizacao_id, cliente_id, tipo, nome, referencia, prazo, canal, incluir_escritorio, sem_visto, marcadores, base64_pdf, base64_docx, storage_path, signatarios, setor } = body || {};
  const formato: "pdf" | "docx" = base64_docx || String(storage_path || "").toLowerCase().endsWith(".docx") ? "docx" : "pdf";
  
  if (!organizacao_id || !auth.orgIds.includes(organizacao_id)) return json({ error: "Organização inválida" }, 403);
  if (!nome || typeof nome !== "string") return json({ error: "Nome do documento é obrigatório" }, 400);
  if (!["contrato", "procuracao", "proposta", "contrato_rh", "contrato_fornecedor", "declaracao", "outro"].includes(tipo)) return json({ error: "Tipo inválido" }, 400);
  if (!["nenhum", "email", "whatsapp", "ambos"].includes(canal)) return json({ error: "Canal inválido" }, 400);
  if (!Array.isArray(signatarios) || !signatarios.length) return json({ error: "Informe ao menos um signatário" }, 400);
  const externos = (signatarios as SignatarioIn[]).filter((s) => s.papel !== "escritorio");
  if ((tipo === "contrato" || tipo === "procuracao") && externos.length !== 1) {
    return json({ error: "Contrato de honorários e procuração têm um único signatário (contratante/outorgante)" }, 400);
  }

  // Validação dos signatários
  for (const s of signatarios as SignatarioIn[]) {
    if (!s.nome?.trim()) return json({ error: "Signatário sem nome" }, 400);
    if (s.papel !== "escritorio") {
      if (!s.cpf || !cpfValido(s.cpf)) return json({ error: `CPF inválido para ${s.nome}` }, 400);
      const tel = somenteDigitos(s.telefone);
      if ((canal === "nenhum" || canal === "whatsapp" || canal === "ambos") && (tel.length < 10 || tel.length > 11)) {
        return json({ error: `Telefone com DDD obrigatório para ${s.nome}` }, 400);
      }
      if ((canal === "email" || canal === "ambos") && !s.email) return json({ error: `E-mail obrigatório para ${s.nome}` }, 400);
    }
  }

  // Obtém o PDF: base64 direto ou arquivo do drive do cliente
  let b64: string | null = base64_docx || base64_pdf || null;
  if (!b64 && storage_path) {
    const { data: file, error } = await admin.storage.from("cliente-drive").download(storage_path);
    if (error || !file) return json({ error: "Não foi possível ler o arquivo do drive" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_PDF) return json({ error: "Arquivo maior que 10 MB" }, 400);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    b64 = btoa(bin);
  }
  if (!b64) return json({ error: "Envie o arquivo (upload ou drive do cliente)" }, 400);
  const approxBytes = Math.floor(b64.length * 3 / 4);
  if (approxBytes > MAX_PDF) return json({ error: "Arquivo maior que 10 MB" }, 400);

  // Guarda o original no bucket (nunca em arquivos_cliente)
  const docId = crypto.randomUUID();
  const originalPath = `assinaturas/${organizacao_id}/${docId}/original.${formato}`;
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  const up = await admin.storage.from("cliente-drive").upload(originalPath, bytes, { contentType: formato === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf", upsert: true });
  if (up.error) return json({ error: `Falha ao guardar o original: ${up.error.message}` }, 500);

  // Monta o payload do ZapSign
  const semCanal = canal === "nenhum";
  const usaMarcadores = !!(marcadores && Array.isArray(marcadores) && marcadores.length);
  const signers = (signatarios as SignatarioIn[]).map((s, i) => {
    const ehCliente = s.papel !== "escritorio";
    const base: any = ehCliente
      ? {
          name: s.nome.trim(),
          email: s.email || "",
          lock_name: true,
          lock_email: !!s.email,
          lock_phone: !!s.telefone,
          phone_country: "55",
          phone_number: somenteDigitos(s.telefone),
          qualification: s.qualificacao || (tipo === "procuracao" ? "Outorgante" : "Contratante"),
          auth_mode: "assinaturaTela",
          require_selfie_photo: true,
          require_document_photo: true,
          require_cpf: true,
          cpf: somenteDigitos(s.cpf),
        }
      : {
          name: s.nome.trim(),
          email: s.email || "",
          lock_name: true,
          lock_email: !!s.email,
          qualification: "Contratada",
          auth_mode: "assinaturaTela",
        };
    base.send_automatic_email = !semCanal && (canal === "email" || canal === "ambos");
    base.send_automatic_whatsapp = !semCanal && (canal === "whatsapp" || canal === "ambos");
    if (usaMarcadores) {
      base.signature_placement = `<<assinatura_${i + 1}>>`;
      if (!sem_visto) base.rubrica_placement = `<<visto_${i + 1}>>`;
    }
    return base;
  });
  const payload: any = {
    name: nome,
    ...(formato === "docx" ? { base64_docx: b64 } : { base64_pdf: b64 }),
    lang: "pt-br",
    brand_name: "Oliveira Advogados",
    disable_signer_emails: semCanal,
    signers,
  };
  if (referencia) payload.external_id = referencia;
  if (prazo) payload.date_limit_to_sign = `${prazo}T23:59:00.000000Z`;
  if (!semCanal) payload.reminder_every_n_days = 2;

  const r = await zapsign("/docs/", { method: "POST", body: payload });
  if (r.status < 200 || r.status >= 300) {
    await admin.storage.from("cliente-drive").remove([originalPath]);
    return json({ error: `ZapSign respondeu ${r.status}`, detalhe: typeof r.body === "string" ? r.body.slice(0, 500) : r.body }, 502);
  }

  const { data: doc, error: docErr } = await admin.from("assinatura_documentos").insert({
    id: docId,
    organizacao_id,
    zapsign_token: r.body?.token || null,
    nome,
    referencia: referencia || null,
    cliente_id: cliente_id || null,
    origem: "app",
    tipo,
    status: "pending",
    canal,
    prazo: prazo || null,
    incluir_escritorio: !!incluir_escritorio,
    sem_visto: !!sem_visto,
    marcadores_encontrados: !!marcadores,
    enviado_por: auth.userId,
    setor: setor ? String(setor).slice(0, 60) : null,
    formato,
    enviado_em: new Date().toISOString(),
    original_path: originalPath,
  }).select("*").single();
  if (docErr) return json({ error: `Falha ao gravar o documento: ${docErr.message}` }, 500);

  const respSigners: any[] = Array.isArray(r.body?.signers) ? r.body.signers : [];
  const linhas = (signatarios as SignatarioIn[]).map((s, i) => ({
    documento_id: docId,
    organizacao_id,
    zapsign_token: respSigners[i]?.token || null,
    nome: s.nome.trim(),
    email: s.email || null,
    telefone: somenteDigitos(s.telefone) || null,
    cpf: somenteDigitos(s.cpf) || null,
    qualificacao: s.qualificacao || (tipo === "procuracao" ? "Outorgante" : "Contratante"),
    papel: s.papel === "escritorio" ? "escritorio" : s.papel === "avulso" ? "avulso" : "cliente",
    cliente_id: s.papel === "cliente" ? (s.cliente_id || null) : null,
    status: "pending",
    sign_url: respSigners[i]?.sign_url || null,
  }));
  await admin.from("assinatura_signatarios").insert(linhas);

  return json({ ok: true, documento: doc, signatarios: linhas });
});
