-- 1) Trigger anti-data-futura
CREATE OR REPLACE FUNCTION public.fn_block_future_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data > CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é permitido lançar dados em data futura (recebido %)', NEW.data
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_future_lancamentos ON public.mkt_lancamentos_diarios;
CREATE TRIGGER trg_block_future_lancamentos
BEFORE INSERT OR UPDATE OF data ON public.mkt_lancamentos_diarios
FOR EACH ROW EXECUTE FUNCTION public.fn_block_future_date();

DROP TRIGGER IF EXISTS trg_block_future_organicos ON public.mkt_leads_organicos_origem;
CREATE TRIGGER trg_block_future_organicos
BEFORE INSERT OR UPDATE OF data ON public.mkt_leads_organicos_origem
FOR EACH ROW EXECUTE FUNCTION public.fn_block_future_date();

-- 2) RPC agregadora para o Dashboard
CREATE OR REPLACE FUNCTION public.mkt_dashboard_agregado(
  p_inicio date,
  p_fim date,
  p_nichos text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orgs uuid[];
  _result jsonb;
BEGIN
  SELECT array_agg(organizacao_id) INTO _orgs
  FROM public.membros WHERE user_id = auth.uid();

  IF _orgs IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  WITH base AS (
    SELECT *
    FROM public.mkt_lancamentos_diarios
    WHERE organizacao_id = ANY(_orgs)
      AND data BETWEEN p_inicio AND p_fim
      AND (p_nichos IS NULL OR nicho = ANY(p_nichos))
  ),
  totais AS (
    SELECT
      COALESCE(SUM(investimento), 0) AS investimento,
      COALESCE(SUM(impressoes), 0) AS impressoes,
      COALESCE(SUM(alcance), 0) AS alcance,
      COALESCE(SUM(cliques), 0) AS cliques,
      COALESCE(SUM(leads_pagos), 0) AS leads_pagos,
      COALESCE(SUM(leads_organicos), 0) AS leads_organicos,
      COALESCE(SUM(leads_qualificados_sdr), 0) AS leads_qualificados,
      COALESCE(SUM(reunioes_agendadas), 0) AS reunioes_agendadas,
      COALESCE(SUM(reunioes_realizadas), 0) AS reunioes_realizadas,
      COALESCE(SUM(propostas_enviadas), 0) AS propostas_enviadas,
      COALESCE(SUM(contratos_fechados), 0) AS contratos_fechados,
      COALESCE(SUM(contratos_perdidos), 0) AS contratos_perdidos,
      COALESCE(SUM(receita_fechada), 0) AS receita_fechada
    FROM base
  ),
  por_nicho AS (
    SELECT nicho,
      COALESCE(SUM(investimento), 0) AS investimento,
      COALESCE(SUM(leads_pagos + leads_organicos), 0) AS leads,
      COALESCE(SUM(contratos_fechados), 0) AS contratos,
      COALESCE(SUM(receita_fechada), 0) AS receita
    FROM base
    GROUP BY nicho
  ),
  por_dia AS (
    SELECT data,
      COALESCE(SUM(leads_pagos + leads_organicos), 0) AS leads,
      COALESCE(SUM(investimento), 0) AS investimento,
      COALESCE(SUM(receita_fechada), 0) AS receita
    FROM base
    GROUP BY data
    ORDER BY data
  ),
  motivos AS (
    SELECT motivo_perda_principal AS motivo, COUNT(*)::int AS qtd
    FROM base
    WHERE motivo_perda_principal IS NOT NULL AND motivo_perda_principal <> ''
    GROUP BY motivo_perda_principal
    ORDER BY qtd DESC
  )
  SELECT jsonb_build_object(
    'totais', (SELECT row_to_json(t) FROM totais t),
    'por_nicho', COALESCE((SELECT jsonb_agg(row_to_json(n)) FROM por_nicho n), '[]'::jsonb),
    'por_dia', COALESCE((SELECT jsonb_agg(row_to_json(d)) FROM por_dia d), '[]'::jsonb),
    'motivos', COALESCE((SELECT jsonb_agg(row_to_json(m)) FROM motivos m), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_dashboard_agregado(date, date, text[]) TO authenticated;