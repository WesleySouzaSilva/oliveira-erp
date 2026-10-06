INSERT INTO public.arquivos_cliente (user_id, organizacao_id, nome_cliente, nome_arquivo, storage_path, tamanho_bytes, pasta)
SELECT
  d.user_id,
  d.organizacao_id,
  COALESCE(
    NULLIF(l.dados_etapa1->>'nomeProdutor',''),
    NULLIF(l.dados_etapa1->>'produtor',''),
    NULLIF(l.dados_etapa1->>'nome',''),
    NULLIF(l.dados_etapa1->>'nomePropriedade','')
  ) AS nome_cliente,
  d.nome_arquivo,
  d.storage_path,
  d.tamanho_bytes,
  'Laudos' AS pasta
FROM public.documentos d
JOIN public.laudos l ON l.id = d.laudo_id
WHERE d.categoria = 'laudo_externo'
  AND COALESCE(
    NULLIF(l.dados_etapa1->>'nomeProdutor',''),
    NULLIF(l.dados_etapa1->>'produtor',''),
    NULLIF(l.dados_etapa1->>'nome',''),
    NULLIF(l.dados_etapa1->>'nomePropriedade','')
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.arquivos_cliente ac
    WHERE ac.storage_path = d.storage_path
  );