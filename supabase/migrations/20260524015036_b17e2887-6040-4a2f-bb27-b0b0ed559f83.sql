
-- Restrict marketing & contratos policies to authenticated role
ALTER POLICY org_delete_contratos ON public.contratos_vencimentos TO authenticated;
ALTER POLICY org_select_contratos ON public.contratos_vencimentos TO authenticated;
ALTER POLICY org_update_contratos ON public.contratos_vencimentos TO authenticated;

ALTER POLICY mkt_lanc_delete_org ON public.mkt_lancamentos_diarios TO authenticated;
ALTER POLICY mkt_lanc_select_org ON public.mkt_lancamentos_diarios TO authenticated;
ALTER POLICY mkt_lanc_update_org ON public.mkt_lancamentos_diarios TO authenticated;

ALTER POLICY mkt_org_delete_org ON public.mkt_leads_organicos_origem TO authenticated;
ALTER POLICY mkt_org_select_org ON public.mkt_leads_organicos_origem TO authenticated;
ALTER POLICY mkt_org_update_org ON public.mkt_leads_organicos_origem TO authenticated;

ALTER POLICY mkt_metas_ind_delete_org ON public.mkt_metas_individuais TO authenticated;
ALTER POLICY mkt_metas_ind_select_org ON public.mkt_metas_individuais TO authenticated;
ALTER POLICY mkt_metas_ind_update_org ON public.mkt_metas_individuais TO authenticated;

ALTER POLICY mkt_metas_delete_org ON public.mkt_metas_mensais TO authenticated;
ALTER POLICY mkt_metas_select_org ON public.mkt_metas_mensais TO authenticated;
ALTER POLICY mkt_metas_update_org ON public.mkt_metas_mensais TO authenticated;

-- Add missing DELETE policy for assinaturas bucket (owner-scoped)
CREATE POLICY "Users can delete own signature"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assinaturas' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Add explicit UPDATE policy for cliente-drive bucket mirroring INSERT
CREATE POLICY "cliente_drive_update_self"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'cliente-drive' AND ((storage.foldername(name))[1])::uuid = auth.uid())
WITH CHECK (bucket_id = 'cliente-drive' AND ((storage.foldername(name))[1])::uuid = auth.uid());
