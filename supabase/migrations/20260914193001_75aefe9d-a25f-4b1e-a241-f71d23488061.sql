-- 1. Equipe da carteira (allowlist)
CREATE TABLE IF NOT EXISTS public.carteira_responsaveis (
  user_id uuid PRIMARY KEY,
  nome_curto text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.carteira_responsaveis TO authenticated;
GRANT ALL ON public.carteira_responsaveis TO service_role;
ALTER TABLE public.carteira_responsaveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipe pode ver responsaveis da carteira" ON public.carteira_responsaveis;
CREATE POLICY "equipe pode ver responsaveis da carteira"
  ON public.carteira_responsaveis FOR SELECT TO authenticated USING (true);

INSERT INTO public.carteira_responsaveis (user_id, nome_curto) VALUES
  ('40b399e7-72e9-4711-bda3-430cd3abcb1b','Willian'),
  ('0b78b856-fccf-4a7a-af7a-639c247f0f33','Maycon'),
  ('d569ac8c-d44f-4f77-a655-c497fa6d1606','Fernanda'),
  ('dc6e00ec-51a2-489e-bdda-ad5a00d1bd72','Vitoria')
ON CONFLICT (user_id) DO NOTHING;

-- 2. Ariane: registra a grafia alternativa do contrato
UPDATE public.clientes
SET grafias_alternativas = (
  SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(grafias_alternativas,'{}'::text[]) || ARRAY['Ariane Siqueira da Vilhena Santos Freitas']))
)
WHERE deleted_at IS NULL AND nome = 'Ariane Siqueira de Vilhena Santos Freitas';

-- 3. Corrige responsáveis fora da equipe nos contratos
UPDATE public.contratos_vencimentos v
SET responsavel_gestao = sub.curto
FROM (
  SELECT v2.id, cr.nome_curto AS curto
  FROM public.contratos_vencimentos v2
  LEFT JOIN public.clientes c
    ON c.deleted_at IS NULL
   AND (lower(f_unaccent(c.nome)) = lower(f_unaccent(v2.nome_cliente))
        OR lower(f_unaccent(replace(v2.nome_cliente,' da ',' de '))) = lower(f_unaccent(c.nome)))
  LEFT JOIN public.carteira_responsaveis cr ON cr.user_id = c.responsavel_pos_venda
  WHERE v2.deleted_at IS NULL
    AND v2.responsavel_gestao IS NOT NULL
    AND v2.responsavel_gestao NOT IN (SELECT nome_curto FROM public.carteira_responsaveis)
) sub
WHERE v.id = sub.id;

-- 4. Trava: responsável sempre da equipe
CREATE OR REPLACE FUNCTION public.fn_responsavel_somente_equipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_cliente uuid;
BEGIN
  IF TG_TABLE_NAME = 'clientes' THEN
    IF NEW.responsavel_pos_venda IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.carteira_responsaveis WHERE user_id = NEW.responsavel_pos_venda AND ativo) THEN
      NEW.responsavel_pos_venda := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'operacoes_credito' THEN
    v_nome := NEW.responsavel;
    v_cliente := NEW.cliente_id;
  ELSE
    v_nome := NEW.responsavel_gestao;
    SELECT c.id INTO v_cliente FROM public.clientes c
     WHERE c.deleted_at IS NULL
       AND lower(f_unaccent(c.nome)) = lower(f_unaccent(COALESCE(NEW.nome_cliente,'')))
     LIMIT 1;
  END IF;

  IF v_nome IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.carteira_responsaveis WHERE lower(nome_curto) = lower(v_nome) AND ativo) THEN
    SELECT cr.nome_curto INTO v_nome
      FROM public.clientes c
      JOIN public.carteira_responsaveis cr ON cr.user_id = c.responsavel_pos_venda
     WHERE c.id = v_cliente;
    IF TG_TABLE_NAME = 'operacoes_credito' THEN
      NEW.responsavel := v_nome;
    ELSE
      NEW.responsavel_gestao := v_nome;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_responsavel_somente_equipe() FROM anon, public;

DROP TRIGGER IF EXISTS trg_resp_equipe_clientes ON public.clientes;
CREATE TRIGGER trg_resp_equipe_clientes
  BEFORE INSERT OR UPDATE OF responsavel_pos_venda ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_responsavel_somente_equipe();

DROP TRIGGER IF EXISTS trg_resp_equipe_operacoes ON public.operacoes_credito;
CREATE TRIGGER trg_resp_equipe_operacoes
  BEFORE INSERT OR UPDATE OF responsavel ON public.operacoes_credito
  FOR EACH ROW EXECUTE FUNCTION public.fn_responsavel_somente_equipe();

DROP TRIGGER IF EXISTS trg_resp_equipe_contratos ON public.contratos_vencimentos;
CREATE TRIGGER trg_resp_equipe_contratos
  BEFORE INSERT OR UPDATE OF responsavel_gestao ON public.contratos_vencimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_responsavel_somente_equipe();