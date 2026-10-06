-- ============= ia_consumo =============
CREATE TABLE public.ia_consumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  organizacao_id uuid,
  funcao text NOT NULL,
  modelo text NOT NULL,
  provedor text NOT NULL DEFAULT 'anthropic',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  erro_codigo integer,
  duracao_ms integer,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ia_consumo TO authenticated;
GRANT ALL ON public.ia_consumo TO service_role;

ALTER TABLE public.ia_consumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_consumo: leitura por org"
ON public.ia_consumo FOR SELECT TO authenticated
USING (
  organizacao_id IS NOT NULL
  AND organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
);

CREATE INDEX idx_ia_consumo_org_data ON public.ia_consumo (organizacao_id, created_at DESC);
CREATE INDEX idx_ia_consumo_funcao ON public.ia_consumo (funcao, created_at DESC);

-- ============= analise_chat_mensagens =============
CREATE TABLE public.analise_chat_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id uuid,
  arquivo_hash text,
  user_id uuid NOT NULL,
  organizacao_id uuid,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.analise_chat_mensagens TO authenticated;
GRANT ALL ON public.analise_chat_mensagens TO service_role;

ALTER TABLE public.analise_chat_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat análise: ver da org"
ON public.analise_chat_mensagens FOR SELECT TO authenticated
USING (
  organizacao_id IS NOT NULL
  AND organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
);

CREATE POLICY "chat análise: inserir próprio"
ON public.analise_chat_mensagens FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat análise: apagar próprio"
ON public.analise_chat_mensagens FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_analise_chat_hash ON public.analise_chat_mensagens (arquivo_hash, created_at);
CREATE INDEX idx_analise_chat_analise ON public.analise_chat_mensagens (analise_id, created_at);

-- preenche organizacao_id automaticamente
CREATE TRIGGER trg_set_org_chat_analise
BEFORE INSERT ON public.analise_chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();