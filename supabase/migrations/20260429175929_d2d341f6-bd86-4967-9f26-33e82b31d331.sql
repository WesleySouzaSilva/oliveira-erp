-- Backfill organizacao_id em atividades_clientes para que toda a equipe enxergue os registros antigos
UPDATE public.atividades_clientes a
SET organizacao_id = m.organizacao_id
FROM public.membros m
WHERE a.user_id = m.user_id
  AND a.organizacao_id IS NULL;