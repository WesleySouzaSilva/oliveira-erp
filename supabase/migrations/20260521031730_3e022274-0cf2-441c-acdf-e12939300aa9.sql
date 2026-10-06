CREATE TABLE public.mkt_contratos_fechados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizacao_id uuid NOT NULL,
  created_by uuid NOT NULL,
  nicho text NOT NULL,
  produto text,
  closer_id uuid,
  sdr_id uuid,
  data_venda date NOT NULL,
  data_pagamento date,
  mes_referencia date,
  tempo_fechamento_dias integer,
  plataforma text,
  cliente_nome text NOT NULL,
  cliente_contato text,
  cliente_estado text,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_entrada numeric NOT NULL DEFAULT 0,
  num_parcelas integer NOT NULL DEFAULT 1,
  valor_parcela numeric NOT NULL DEFAULT 0,
  valor_recebido numeric NOT NULL DEFAULT 0,
  porcentagem_final numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  tipo_pagamento text,
  via_credenciado boolean NOT NULL DEFAULT false,
  credenciado_nome text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contratos_fechados_org ON public.mkt_contratos_fechados(organizacao_id);
CREATE INDEX idx_contratos_fechados_nicho_mes ON public.mkt_contratos_fechados(nicho, mes_referencia);
CREATE INDEX idx_contratos_fechados_closer ON public.mkt_contratos_fechados(closer_id);
CREATE INDEX idx_contratos_fechados_sdr ON public.mkt_contratos_fechados(sdr_id);
CREATE INDEX idx_contratos_fechados_data_venda ON public.mkt_contratos_fechados(data_venda);

ALTER TABLE public.mkt_contratos_fechados ENABLE ROW LEVEL SECURITY;

CREATE POLICY contratos_select_org ON public.mkt_contratos_fechados
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY contratos_insert_org ON public.mkt_contratos_fechados
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())) AND created_by = auth.uid());
CREATE POLICY contratos_update_org ON public.mkt_contratos_fechados
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY contratos_delete_org ON public.mkt_contratos_fechados
  FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE OR REPLACE FUNCTION public.fn_contratos_fechados_compute()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.mes_referencia := date_trunc('month', NEW.data_venda)::date;
  IF NEW.data_pagamento IS NOT NULL THEN
    NEW.tempo_fechamento_dias := NEW.data_pagamento - NEW.data_venda;
  ELSE
    NEW.tempo_fechamento_dias := NULL;
  END IF;
  IF NEW.valor_total > 0 THEN
    NEW.porcentagem_final := ROUND((NEW.valor_recebido / NEW.valor_total) * 100, 2);
  ELSE
    NEW.porcentagem_final := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contratos_fechados_compute
  BEFORE INSERT OR UPDATE ON public.mkt_contratos_fechados
  FOR EACH ROW EXECUTE FUNCTION public.fn_contratos_fechados_compute();

ALTER TABLE public.mkt_metas_individuais
  ADD COLUMN IF NOT EXISTS meta_credenciados integer NOT NULL DEFAULT 0;