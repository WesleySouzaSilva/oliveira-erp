-- Ajusta a lista de custodiantes dos códigos dos tribunais.
--
-- Custodiante é quem cadastra acessos, libera/remove pessoas e lê a auditoria.
-- Deliberadamente NÃO coincide com o papel 'admin' da organização: um admin do
-- app não vira custodiante pela interface, só por migration como esta.
--
-- Idempotente: pode ser reaplicada sem efeito colateral. E-mails que não
-- existirem em auth.users são simplesmente ignorados.

DO $$
DECLARE
  v_emails text[] := ARRAY[
    'willian.marcondes@outlook.com',
    'crystian.santos@gmail.com',
    'juridico@advogadosoliveira.com.br'
  ];
  v_email text;
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email);
    CONTINUE WHEN v_user_id IS NULL;

    SELECT organizacao_id INTO v_org_id FROM public.membros WHERE user_id = v_user_id LIMIT 1;
    CONTINUE WHEN v_org_id IS NULL;

    INSERT INTO public.tj_custodiantes (organizacao_id, user_id, observacao)
    VALUES (v_org_id, v_user_id, 'custodiante inicial')
    ON CONFLICT (organizacao_id, user_id) DO NOTHING;

    RAISE NOTICE 'custodiante garantido: %', v_email;
  END LOOP;
END $$;
