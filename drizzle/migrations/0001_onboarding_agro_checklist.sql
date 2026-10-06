-- 1. Novas colunas no checklist
ALTER TABLE public.pos_venda_checklist_itens
  ADD COLUMN IF NOT EXISTS etapa smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nivel text NOT NULL DEFAULT 'pessoa',
  ADD COLUMN IF NOT EXISTS titular_cliente_id uuid,
  ADD COLUMN IF NOT EXISTS titular_nome text,
  ADD COLUMN IF NOT EXISTS operacao_id uuid,
  ADD COLUMN IF NOT EXISTS operacao_label text,
  ADD COLUMN IF NOT EXISTS chave text,
  ADD COLUMN IF NOT EXISTS nome_simples text,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS conferido_por uuid,
  ADD COLUMN IF NOT EXISTS conferido_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_dispensa text,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz;

-- 2. Arquiva todo o checklist legado (nada é apagado; anexos preservados)
UPDATE public.pos_venda_checklist_itens
   SET arquivado_em = now()
 WHERE arquivado_em IS NULL;

-- 3. Novas colunas no onboarding
ALTER TABLE public.pos_venda_onboardings
  ADD COLUMN IF NOT EXISTS grupo text,
  ADD COLUMN IF NOT EXISTS respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS modulos_opcionais jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS etapa_atual smallint NOT NULL DEFAULT 1;

-- 4. Registro do acesso gov.br (somente o fato do acesso — nunca credenciais)
CREATE TABLE IF NOT EXISTS public.pos_venda_govbr_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  onboarding_id uuid NOT NULL REFERENCES public.pos_venda_onboardings(id) ON DELETE CASCADE,
  cliente_id uuid,
  titular_nome text,
  data date NOT NULL DEFAULT current_date,
  forma text NOT NULL,
  conduzido_por uuid,
  conduzido_por_nome text,
  finalidade text NOT NULL DEFAULT 'Registrato, imposto de renda e CAR',
  nivel_conta text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_venda_govbr_acessos TO authenticated;
GRANT ALL ON public.pos_venda_govbr_acessos TO service_role;

ALTER TABLE public.pos_venda_govbr_acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "govbr_select_org" ON public.pos_venda_govbr_acessos;
CREATE POLICY "govbr_select_org" ON public.pos_venda_govbr_acessos
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "govbr_insert_org" ON public.pos_venda_govbr_acessos;
CREATE POLICY "govbr_insert_org" ON public.pos_venda_govbr_acessos
  FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "govbr_update_org" ON public.pos_venda_govbr_acessos;
CREATE POLICY "govbr_update_org" ON public.pos_venda_govbr_acessos
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE INDEX IF NOT EXISTS idx_govbr_onboarding ON public.pos_venda_govbr_acessos(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_checklist_operacao ON public.pos_venda_checklist_itens(operacao_id);
CREATE INDEX IF NOT EXISTS idx_checklist_ativo ON public.pos_venda_checklist_itens(onboarding_id) WHERE arquivado_em IS NULL;

-- 5. "Pronta para protocolar" passa a exigir a etapa 2 daquela operação resolvida
--    e o Registrato com menos de 90 dias.
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
    IF COALESCE(NEW.data_conferida, false) = false
       OR NEW.laudo_status NOT IN ('pronto','nao_precisa') THEN
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

REVOKE EXECUTE ON FUNCTION public.fn_operacao_pronta_protocolar() FROM anon, public;