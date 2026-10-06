
-- RPC: buscar clientes por nome normalizado
CREATE OR REPLACE FUNCTION public.search_clientes_norm(q text)
RETURNS SETOF public.clientes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.clientes
  WHERE deleted_at IS NULL
    AND public.normalize_search(nome) LIKE '%' || public.normalize_search(q) || '%'
  ORDER BY nome
  LIMIT 50;
$$;

-- RPC: buscar contratos_vencimentos distintos por nome normalizado
CREATE OR REPLACE FUNCTION public.search_contratos_clientes_norm(q text)
RETURNS TABLE (nome_cliente text, banco text, numero_contrato text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT nome_cliente, banco, numero_contrato
  FROM public.contratos_vencimentos
  WHERE public.normalize_search(nome_cliente) LIKE '%' || public.normalize_search(q) || '%'
  LIMIT 20;
$$;

-- RPC: buscar laudos por nome de produtor (dentro de dados_etapa1)
CREATE OR REPLACE FUNCTION public.search_laudos_by_produtor_norm(q text)
RETURNS SETOF public.laudos
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.laudos
  WHERE deleted_at IS NULL
    AND (
      public.normalize_search(numero_laudo) LIKE '%' || public.normalize_search(q) || '%'
      OR public.normalize_search(coalesce(dados_etapa1->>'nomeProdutor', dados_etapa1->>'nome', '')) LIKE '%' || public.normalize_search(q) || '%'
    )
  LIMIT 20;
$$;
