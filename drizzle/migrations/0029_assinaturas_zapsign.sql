CREATE TABLE public.assinatura_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  zapsign_token text UNIQUE,
  nome text NOT NULL,
  referencia text,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'app' CHECK (origem IN ('app','externo')),
  tipo text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('contrato','procuracao','proposta','outro')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','refused','expired','deleted')),
  canal text NOT NULL DEFAULT 'nenhum' CHECK (canal IN ('nenhum','email','whatsapp','ambos')),
  prazo date,
  incluir_escritorio boolean NOT NULL DEFAULT false,
  sem_visto boolean NOT NULL DEFAULT false,
  marcadores_encontrados boolean NOT NULL DEFAULT false,
  enviado_por uuid,
  enviado_em timestamptz,
  original_path text,
  assinado_path text,
  arquivo_cliente_id uuid REFERENCES public.arquivos_cliente(id) ON DELETE SET NULL,
  ultimo_sync_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assinatura_documentos_org_idx ON public.assinatura_documentos(organizacao_id);
CREATE INDEX assinatura_documentos_cliente_idx ON public.assinatura_documentos(cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinatura_documentos TO authenticated;
GRANT ALL ON public.assinatura_documentos TO service_role;
ALTER TABLE public.assinatura_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinatura_documentos_internos ON public.assinatura_documentos FOR ALL TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TABLE public.assinatura_signatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.assinatura_documentos(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  zapsign_token text,
  nome text NOT NULL,
  email text,
  telefone text,
  cpf text,
  qualificacao text,
  papel text NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente','escritorio')),
  status text NOT NULL DEFAULT 'pending',
  sign_url text,
  visualizou_em timestamptz,
  assinou_em timestamptz,
  recusou_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assinatura_signatarios_doc_idx ON public.assinatura_signatarios(documento_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinatura_signatarios TO authenticated;
GRANT ALL ON public.assinatura_signatarios TO service_role;
ALTER TABLE public.assinatura_signatarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinatura_signatarios_internos ON public.assinatura_signatarios FOR ALL TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TABLE public.assinatura_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.assinatura_documentos(id) ON DELETE SET NULL,
  zapsign_doc_token text,
  tipo text,
  payload jsonb,
  chave_idempotencia text UNIQUE,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  erro text
);
CREATE INDEX assinatura_eventos_doc_idx ON public.assinatura_eventos(documento_id);
GRANT SELECT ON public.assinatura_eventos TO authenticated;
GRANT ALL ON public.assinatura_eventos TO service_role;
ALTER TABLE public.assinatura_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinatura_eventos_internos ON public.assinatura_eventos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TABLE public.assinatura_config (
  organizacao_id uuid PRIMARY KEY REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  escritorio_nome text,
  escritorio_email text,
  escritorio_cpf text,
  webhook_id text,
  webhook_registrado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assinatura_config TO authenticated;
GRANT ALL ON public.assinatura_config TO service_role;
ALTER TABLE public.assinatura_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinatura_config_internos ON public.assinatura_config FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));