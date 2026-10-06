ALTER TABLE public.membros ADD COLUMN IF NOT EXISTS areas text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.membros m
SET areas = COALESCE(
  (
    SELECT (
      CASE WHEN 'area_agro' = ANY(g.modulos) THEN ARRAY['agro'] ELSE ARRAY[]::text[] END
      || CASE WHEN 'area_empresarial' = ANY(g.modulos) THEN ARRAY['empresarial'] ELSE ARRAY[]::text[] END
      || CASE WHEN 'area_demandas' = ANY(g.modulos) THEN ARRAY['demandas-gerais'] ELSE ARRAY[]::text[] END
    )
    FROM public.permission_groups g
    WHERE g.id = m.permission_group_id
      AND g.modulos && ARRAY['area_agro','area_empresarial','area_demandas']
  ),
  ARRAY['agro','empresarial','demandas-gerais']
);