WITH d AS (
  SELECT id, lower(f_unaccent(trim(nome))) k, responsavel_pos_venda, created_at,
         row_number() OVER (
           PARTITION BY lower(f_unaccent(trim(nome)))
           ORDER BY (responsavel_pos_venda IS NULL), created_at
         ) rn
  FROM public.clientes WHERE deleted_at IS NULL
)
UPDATE public.clientes c
SET deleted_at = now(),
    observacoes = coalesce(c.observacoes || E'\n', '') || 'Ficha duplicada removida da base em 14/09/2026.'
FROM d
WHERE d.id = c.id AND d.rn > 1;