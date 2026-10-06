
CREATE TABLE public.analises_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  cliente_nome text NOT NULL,
  tipo_contrato text NOT NULL,
  arquivo_nome text,
  contexto_adicional text,
  resumo_executivo jsonb,
  parecer_completo text,
  classificacao text,
  operador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analises_contratos TO authenticated;
GRANT ALL ON public.analises_contratos TO service_role;

ALTER TABLE public.analises_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operador vê suas análises"
ON public.analises_contratos FOR SELECT TO authenticated
USING (auth.uid() = operador_id);

CREATE POLICY "Operador cria suas análises"
ON public.analises_contratos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = operador_id);

CREATE POLICY "Operador atualiza suas análises"
ON public.analises_contratos FOR UPDATE TO authenticated
USING (auth.uid() = operador_id);

CREATE POLICY "Operador ou admin exclui"
ON public.analises_contratos FOR DELETE TO authenticated
USING (
  auth.uid() = operador_id
  OR EXISTS (SELECT 1 FROM public.membros m WHERE m.user_id = auth.uid() AND m.papel = 'admin'::app_role)
);

CREATE INDEX idx_analises_contratos_operador ON public.analises_contratos(operador_id, created_at DESC);
