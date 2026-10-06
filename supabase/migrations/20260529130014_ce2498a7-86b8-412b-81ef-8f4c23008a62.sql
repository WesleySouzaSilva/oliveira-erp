-- 1) Novo campo
ALTER TABLE public.mkt_lancamentos_diarios
  ADD COLUMN IF NOT EXISTS leads_desqualificados_sdr integer NOT NULL DEFAULT 0;

-- 2) Função que cria a tarefa mensal para cada SDR
CREATE OR REPLACE FUNCTION public.fn_criar_tarefa_mensal_sdr_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref_mes text;
  _venc date := CURRENT_DATE + INTERVAL '5 days';
  _admin_id uuid;
  _sdr record;
BEGIN
  _ref_mes := to_char((CURRENT_DATE - INTERVAL '1 month'), 'TMMonth/YYYY');

  FOR _sdr IN
    SELECT m.user_id, m.organizacao_id
    FROM public.membros m
    WHERE m.papel IN ('sdr', 'social_seller')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.responsavel_id = _sdr.user_id
        AND t.organizacao_id = _sdr.organizacao_id
        AND t.titulo LIKE 'Lançar leads qualificados e desqualificados%'
        AND t.created_at::date = CURRENT_DATE
    ) THEN
      CONTINUE;
    END IF;

    SELECT user_id INTO _admin_id
    FROM public.membros
    WHERE organizacao_id = _sdr.organizacao_id AND papel = 'admin'
    LIMIT 1;
    IF _admin_id IS NULL THEN _admin_id := _sdr.user_id; END IF;

    INSERT INTO public.tarefas (
      organizacao_id, responsavel_id, titulo, descricao,
      data_vencimento, prioridade, created_by
    ) VALUES (
      _sdr.organizacao_id,
      _sdr.user_id,
      'Lançar leads qualificados e desqualificados — ' || _ref_mes,
      'Acesse Setor de Negócios → Lançamento Comercial (SDR) e registre o total de leads qualificados e desqualificados de ' || _ref_mes || '.',
      _venc,
      'alta',
      _admin_id
    );
  END LOOP;
END;
$$;

-- 3) Agenda mensal (dia 1, 08:00 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('tarefa-mensal-sdr-leads');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'tarefa-mensal-sdr-leads',
  '0 8 1 * *',
  $$SELECT public.fn_criar_tarefa_mensal_sdr_leads();$$
);