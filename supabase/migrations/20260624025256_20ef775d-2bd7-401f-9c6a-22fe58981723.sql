
CREATE TABLE public.financeiro_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  asaas_payment_id text NOT NULL,
  asaas_customer_id text,
  cliente_nome text,
  valor numeric NOT NULL DEFAULT 0,
  status text,
  tipo text,
  vencimento date,
  pago_em date,
  descricao text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, asaas_payment_id)
);

CREATE INDEX idx_fin_cobr_status ON public.financeiro_cobrancas (status);
CREATE INDEX idx_fin_cobr_vencimento ON public.financeiro_cobrancas (vencimento);
CREATE INDEX idx_fin_cobr_org ON public.financeiro_cobrancas (organizacao_id);

GRANT SELECT ON public.financeiro_cobrancas TO authenticated;
GRANT ALL ON public.financeiro_cobrancas TO service_role;

ALTER TABLE public.financeiro_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO da org pode ler cobrancas"
  ON public.financeiro_cobrancas
  FOR SELECT
  TO authenticated
  USING (
    organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    AND public.is_ceo(auth.uid())
  );
-- Sem políticas de INSERT/UPDATE/DELETE para authenticated: apenas service_role escreve.
