CREATE OR REPLACE FUNCTION public.saude_sistema()
RETURNS TABLE(chave text, titulo text, total bigint, detalhes jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
BEGIN
  SELECT m.organizacao_id INTO _org FROM membros m WHERE m.user_id = auth.uid() LIMIT 1;
  IF _org IS NULL OR NOT is_admin_in_org(auth.uid(), _org) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  RETURN QUERY
  WITH radar AS (
    SELECT o.* FROM operacoes_credito o
    WHERE o.deleted_at IS NULL AND o.organizacao_id = _org
      AND coalesce(o.dispensar_alerta,false) = false AND o.protocolo_ref IS NULL
  ),
  ativos AS (
    SELECT c.* FROM clientes c
    WHERE c.deleted_at IS NULL AND c.organizacao_id = _org AND c.situacao = 'ativo'
  ),
  v1 AS (
    SELECT 'radar_sem_data'::text k, 'Contratos sem vencimento (fora da fila de digitação)'::text t,
           count(*)::bigint n,
           coalesce(jsonb_agg(jsonb_build_object('item', coalesce(r.titular_nome, r.banco), 'obs', r.numero)), '[]'::jsonb) d
    FROM radar r WHERE r.vence_em IS NULL AND coalesce(r.status_conferencia,'') <> 'a_digitar'
  ),
  v1b AS (
    SELECT 'a_digitar', 'Contratos aguardando digitação', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', coalesce(r.titular_nome, r.banco), 'obs', coalesce(r.responsavel,'sem responsável'))), '[]'::jsonb)
    FROM radar r WHERE coalesce(r.status_conferencia,'') = 'a_digitar'
  ),
  v2 AS (
    SELECT 'sem_responsavel', 'Clientes ativos sem responsável de carteira', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', a.nome, 'obs', coalesce(a.grupo,'sem grupo'))), '[]'::jsonb)
    FROM ativos a WHERE a.responsavel_pos_venda IS NULL
  ),
  v3 AS (
    SELECT 'responsavel_invalido', 'Responsáveis fora da equipe de carteira', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', a.nome, 'obs', a.responsavel_pos_venda::text)), '[]'::jsonb)
    FROM ativos a
    WHERE a.responsavel_pos_venda IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM carteira_responsaveis cr WHERE cr.ativo AND cr.user_id = a.responsavel_pos_venda)
  ),
  v4 AS (
    SELECT 'cpf_invalido', 'Fichas com CPF inválido', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', a.nome, 'obs', a.cpf_cnpj)), '[]'::jsonb)
    FROM ativos a
    WHERE a.cpf_cnpj IS NOT NULL
      AND length(regexp_replace(a.cpf_cnpj, '[^0-9]', '', 'g')) = 11
      AND NOT valida_cpf(a.cpf_cnpj)
  ),
  v5 AS (
    SELECT 'cpf_duplicado', 'Mesmo CPF em mais de uma ficha', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', x.cpf, 'obs', x.nomes)), '[]'::jsonb)
    FROM (
      SELECT regexp_replace(a.cpf_cnpj, '[^0-9]', '', 'g') cpf, string_agg(a.nome, ' | ') nomes
      FROM ativos a WHERE coalesce(a.cpf_cnpj,'') <> ''
      GROUP BY 1 HAVING count(*) > 1
    ) x
  ),
  v6 AS (
    SELECT 'sem_grupo', 'Clientes ativos sem grupo familiar', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', a.nome, 'obs', coalesce(a.cpf_cnpj,'—'))), '[]'::jsonb)
    FROM ativos a WHERE coalesce(a.grupo,'') = ''
  ),
  v7 AS (
    SELECT 'data_fora_faixa', 'Vencimentos fora da faixa 2015–2045', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', coalesce(r.titular_nome, r.banco), 'obs', to_char(r.vence_em,'DD/MM/YYYY'))), '[]'::jsonb)
    FROM radar r
    WHERE r.vence_em IS NOT NULL AND (r.vence_em < date '2015-01-01' OR r.vence_em > date '2045-12-31')
  ),
  v8 AS (
    SELECT 'protocolo_sem_ref', 'Protocolos sem referência registrada', count(*)::bigint,
           coalesce(jsonb_agg(jsonb_build_object('item', coalesce(o.titular_nome, o.banco), 'obs', o.numero)), '[]'::jsonb)
    FROM operacoes_credito o
    WHERE o.deleted_at IS NULL AND o.organizacao_id = _org
      AND o.notificado_em IS NOT NULL AND coalesce(o.protocolo_ref,'') = ''
  )
  SELECT * FROM v1 UNION ALL SELECT * FROM v1b UNION ALL SELECT * FROM v2 UNION ALL SELECT * FROM v3
  UNION ALL SELECT * FROM v4 UNION ALL SELECT * FROM v5 UNION ALL SELECT * FROM v6
  UNION ALL SELECT * FROM v7 UNION ALL SELECT * FROM v8;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.saude_sistema() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.saude_sistema() TO authenticated, service_role;