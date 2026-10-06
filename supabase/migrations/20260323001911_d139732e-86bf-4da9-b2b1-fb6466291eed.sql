
CREATE TABLE public.tarefa_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view task comments"
  ON public.tarefa_comentarios FOR SELECT TO authenticated
  USING (
    tarefa_id IN (
      SELECT t.id FROM public.tarefas t
      WHERE t.organizacao_id IN (SELECT user_org_ids(auth.uid()))
    )
  );

CREATE POLICY "Org members can create task comments"
  ON public.tarefa_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND tarefa_id IN (
      SELECT t.id FROM public.tarefas t
      WHERE t.organizacao_id IN (SELECT user_org_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can delete own comments"
  ON public.tarefa_comentarios FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
