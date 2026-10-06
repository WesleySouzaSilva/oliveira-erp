
-- Trigger function for clientes.nome
CREATE OR REPLACE FUNCTION public.fn_normalize_cliente_nome()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS NOT NULL THEN
    NEW.nome := public.normalize_person_name(NEW.nome);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_cliente_nome ON public.clientes;
CREATE TRIGGER trg_normalize_cliente_nome
  BEFORE INSERT OR UPDATE OF nome ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_cliente_nome();

-- Generic trigger for tables using nome_cliente
CREATE OR REPLACE FUNCTION public.fn_normalize_nome_cliente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome_cliente IS NOT NULL THEN
    NEW.nome_cliente := public.normalize_person_name(NEW.nome_cliente);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_nome_cliente ON public.contratos_vencimentos;
CREATE TRIGGER trg_normalize_nome_cliente
  BEFORE INSERT OR UPDATE OF nome_cliente ON public.contratos_vencimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_nome_cliente();

DROP TRIGGER IF EXISTS trg_normalize_nome_cliente ON public.atividades_clientes;
CREATE TRIGGER trg_normalize_nome_cliente
  BEFORE INSERT OR UPDATE OF nome_cliente ON public.atividades_clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_nome_cliente();

DROP TRIGGER IF EXISTS trg_normalize_nome_cliente ON public.arquivos_cliente;
CREATE TRIGGER trg_normalize_nome_cliente
  BEFORE INSERT OR UPDATE OF nome_cliente ON public.arquivos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_nome_cliente();

-- atendimentos_notas uses cliente_nome
CREATE OR REPLACE FUNCTION public.fn_normalize_cliente_nome_atend()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_nome IS NOT NULL THEN
    NEW.cliente_nome := public.normalize_person_name(NEW.cliente_nome);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_cliente_nome_atend ON public.atendimentos_notas;
CREATE TRIGGER trg_normalize_cliente_nome_atend
  BEFORE INSERT OR UPDATE OF cliente_nome ON public.atendimentos_notas
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_cliente_nome_atend();
