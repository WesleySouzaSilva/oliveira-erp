ALTER TABLE public.assinatura_documentos ADD COLUMN IF NOT EXISTS setor text;
ALTER TABLE public.assinatura_documentos ADD COLUMN IF NOT EXISTS formato text NOT NULL DEFAULT 'pdf';
ALTER TABLE public.assinatura_documentos DROP CONSTRAINT IF EXISTS assinatura_documentos_tipo_check;
ALTER TABLE public.assinatura_documentos ADD CONSTRAINT assinatura_documentos_tipo_check CHECK (tipo = ANY (ARRAY['contrato','procuracao','proposta','contrato_rh','contrato_fornecedor','declaracao','outro']));
ALTER TABLE public.assinatura_documentos ADD CONSTRAINT assinatura_documentos_formato_check CHECK (formato = ANY (ARRAY['pdf','docx']));
ALTER TABLE public.assinatura_signatarios ADD COLUMN IF NOT EXISTS cliente_id uuid;
ALTER TABLE public.assinatura_signatarios DROP CONSTRAINT IF EXISTS assinatura_signatarios_papel_check;
ALTER TABLE public.assinatura_signatarios ADD CONSTRAINT assinatura_signatarios_papel_check CHECK (papel = ANY (ARRAY['cliente','avulso','escritorio']));

DROP POLICY IF EXISTS assinatura_documentos_internos ON public.assinatura_documentos;
CREATE POLICY assinatura_documentos_select ON public.assinatura_documentos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND (enviado_por = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY assinatura_documentos_update ON public.assinatura_documentos FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND (enviado_por = auth.uid() OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND (enviado_por = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY assinatura_documentos_insert ON public.assinatura_documentos FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND enviado_por = auth.uid());
CREATE POLICY assinatura_documentos_delete ON public.assinatura_documentos FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS assinatura_signatarios_internos ON public.assinatura_signatarios;
CREATE POLICY assinatura_signatarios_select ON public.assinatura_signatarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assinatura_documentos d WHERE d.id = documento_id));
CREATE POLICY assinatura_signatarios_update ON public.assinatura_signatarios FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assinatura_documentos d WHERE d.id = documento_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assinatura_documentos d WHERE d.id = documento_id));

DROP POLICY IF EXISTS assinatura_eventos_internos ON public.assinatura_eventos;
CREATE POLICY assinatura_eventos_select ON public.assinatura_eventos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND (
    public.has_role(auth.uid(),'admin')
    OR (documento_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.assinatura_documentos d WHERE d.id = documento_id))));