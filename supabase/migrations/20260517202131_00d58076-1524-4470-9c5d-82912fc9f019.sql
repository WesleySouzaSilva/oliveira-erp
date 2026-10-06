
ALTER TABLE public.arquivos_cliente
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'upload_manual',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

CREATE INDEX IF NOT EXISTS idx_arquivos_cliente_status_aprovacao
  ON public.arquivos_cliente(organizacao_id, status_aprovacao)
  WHERE status_aprovacao = 'pendente';

CREATE POLICY org_update_arquivos
  ON public.arquivos_cliente
  FOR UPDATE
  TO authenticated
  USING ((organizacao_id IN (SELECT user_org_ids(auth.uid()))) OR (auth.uid() = user_id))
  WITH CHECK ((organizacao_id IN (SELECT user_org_ids(auth.uid()))) OR (auth.uid() = user_id));
