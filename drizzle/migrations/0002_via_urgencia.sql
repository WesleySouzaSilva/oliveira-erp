-- Via de urgência: entrada urgente, protocolo em regime de urgência e decisão pós-vencimento.
ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS entrada_urgente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgencia_em timestamptz,
  ADD COLUMN IF NOT EXISTS protocolo_urgencia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS protocolo_faltava text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS protocolo_por_cpf boolean,
  ADD COLUMN IF NOT EXISTS pendencia_completar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pendencia_prazo date,
  ADD COLUMN IF NOT EXISTS pendencia_resolvida_em timestamptz,
  ADD COLUMN IF NOT EXISTS pendencia_resolvida_por uuid,
  ADD COLUMN IF NOT EXISTS decisao_vencida text,
  ADD COLUMN IF NOT EXISTS decisao_obs text,
  ADD COLUMN IF NOT EXISTS decisao_em timestamptz,
  ADD COLUMN IF NOT EXISTS decisao_por uuid;

ALTER TABLE public.pos_venda_onboardings
  ADD COLUMN IF NOT EXISTS entrada_urgente boolean NOT NULL DEFAULT false;

-- Entrada urgente pode ir direto à fila de protocolo, sem esperar laudo nem checklist completo.
CREATE OR REPLACE FUNCTION public.fn_operacao_pronta_protocolar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pend int;
  v_registrato_ok boolean;
BEGIN
  IF NEW.pronta_protocolar THEN
    IF COALESCE(NEW.entrada_urgente, false) THEN
      IF NEW.pronta_em IS NULL THEN NEW.pronta_em := now(); END IF;
      IF NEW.pronta_por IS NULL THEN NEW.pronta_por := auth.uid(); END IF;
      RETURN NEW;
    END IF;

    IF COALESCE(NEW.data_conferida, false) = false
       OR NEW.laudo_status NOT IN ('pronto','nao_precisa','nota_preliminar_entregue','laudo_completo_entregue') THEN
      RAISE EXCEPTION 'A operação só pode ser marcada como pronta para protocolar com a data conferida e o laudo pronto ou dispensado.';
    END IF;

    SELECT count(*) INTO v_pend
      FROM public.pos_venda_checklist_itens i
     WHERE i.arquivado_em IS NULL
       AND i.operacao_id = NEW.id
       AND i.etapa = 2
       AND i.obrigatorio
       AND i.status NOT IN ('conferido','nao_aplica','dispensado');

    IF v_pend > 0 THEN
      RAISE EXCEPTION 'Faltam % documento(s) obrigatório(s) da etapa 2 desta operação (conferir, marcar não se aplica ou dispensar).', v_pend;
    END IF;

    IF NEW.cliente_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.pos_venda_checklist_itens i
         WHERE i.arquivado_em IS NULL
           AND i.chave = 'registrato'
           AND i.titular_cliente_id = NEW.cliente_id
           AND i.status IN ('conferido','nao_aplica','dispensado')
           AND (
             i.status <> 'conferido'
             OR COALESCE(i.data_recebimento, current_date) >= current_date - 90
           )
      ) INTO v_registrato_ok;

      IF NOT v_registrato_ok AND EXISTS (
        SELECT 1 FROM public.pos_venda_checklist_itens i
         WHERE i.arquivado_em IS NULL
           AND i.chave = 'registrato'
           AND i.titular_cliente_id = NEW.cliente_id
      ) THEN
        RAISE EXCEPTION 'O Registrato do titular está pendente ou desatualizado (mais de 90 dias). Emita um novo antes de marcar como pronta para protocolar.';
      END IF;
    END IF;

    IF NEW.pronta_em IS NULL THEN NEW.pronta_em := now(); END IF;
    IF NEW.pronta_por IS NULL THEN NEW.pronta_por := auth.uid(); END IF;
  ELSE
    NEW.pronta_em := NULL;
    NEW.pronta_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- A decisão do vencimento perdido é do administrador.
CREATE OR REPLACE FUNCTION public.fn_operacao_decisao_vencida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.decisao_vencida IS DISTINCT FROM OLD.decisao_vencida AND NEW.decisao_vencida IS NOT NULL THEN
    IF NOT public.is_admin_in_org(auth.uid(), NEW.organizacao_id) THEN
      RAISE EXCEPTION 'Somente o administrador registra a decisão da operação vencida.';
    END IF;
    NEW.decisao_em := now();
    NEW.decisao_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operacao_decisao_vencida ON public.operacoes_credito;
CREATE TRIGGER trg_operacao_decisao_vencida
BEFORE UPDATE ON public.operacoes_credito
FOR EACH ROW EXECUTE FUNCTION public.fn_operacao_decisao_vencida();

REVOKE ALL ON FUNCTION public.fn_operacao_decisao_vencida() FROM PUBLIC, anon;