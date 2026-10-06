-- Backfill organizacao_id em contratos_vencimentos a partir do membro do user_id
UPDATE public.contratos_vencimentos cv
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE cv.organizacao_id IS NULL
  AND m.user_id = cv.user_id;

-- Mesma coisa para outras tabelas com escopo de equipe
UPDATE public.clientes c
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE c.organizacao_id IS NULL AND m.user_id = c.user_id;

UPDATE public.laudos l
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE l.organizacao_id IS NULL AND m.user_id = l.user_id;

UPDATE public.peticoes p
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE p.organizacao_id IS NULL AND m.user_id = p.user_id;

UPDATE public.processos pr
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE pr.organizacao_id IS NULL AND m.user_id = pr.user_id;

UPDATE public.arquivos_cliente a
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE a.organizacao_id IS NULL AND m.user_id = a.user_id;

UPDATE public.atividades_clientes a
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE a.organizacao_id IS NULL AND m.user_id = a.user_id;

UPDATE public.documentos d
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE d.organizacao_id IS NULL AND m.user_id = d.user_id;

-- Trigger para garantir organizacao_id automaticamente em novos registros
CREATE OR REPLACE FUNCTION public.fn_set_organizacao_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organizacao_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT organizacao_id INTO NEW.organizacao_id
    FROM public.membros WHERE user_id = NEW.user_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_org_contratos ON public.contratos_vencimentos;
CREATE TRIGGER trg_set_org_contratos BEFORE INSERT OR UPDATE ON public.contratos_vencimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

DROP TRIGGER IF EXISTS trg_set_org_clientes ON public.clientes;
CREATE TRIGGER trg_set_org_clientes BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

DROP TRIGGER IF EXISTS trg_set_org_laudos ON public.laudos;
CREATE TRIGGER trg_set_org_laudos BEFORE INSERT OR UPDATE ON public.laudos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

DROP TRIGGER IF EXISTS trg_set_org_peticoes ON public.peticoes;
CREATE TRIGGER trg_set_org_peticoes BEFORE INSERT OR UPDATE ON public.peticoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

DROP TRIGGER IF EXISTS trg_set_org_processos ON public.processos;
CREATE TRIGGER trg_set_org_processos BEFORE INSERT OR UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

DROP TRIGGER IF EXISTS trg_set_org_arquivos ON public.arquivos_cliente;
CREATE TRIGGER trg_set_org_arquivos BEFORE INSERT OR UPDATE ON public.arquivos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

DROP TRIGGER IF EXISTS trg_set_org_atividades ON public.atividades_clientes;
CREATE TRIGGER trg_set_org_atividades BEFORE INSERT OR UPDATE ON public.atividades_clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

DROP TRIGGER IF EXISTS trg_set_org_documentos ON public.documentos;
CREATE TRIGGER trg_set_org_documentos BEFORE INSERT OR UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();