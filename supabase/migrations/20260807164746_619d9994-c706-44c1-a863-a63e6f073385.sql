-- Códigos de verificação (TOTP) de acesso aos tribunais.
--
-- Princípio: o segredo NUNCA sai do servidor. Todas as tabelas abaixo usam o mesmo
-- padrão de public.app_secrets — RLS ligada e NENHUMA política, com privilégios
-- revogados de anon/authenticated. Só service_role (edge function) alcança.
-- O front consulta exclusivamente pela edge function totp-tribunais.

-- ---------------------------------------------------------------------------
-- 1. Credenciais: uma linha por acesso de tribunal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tj_credenciais (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id   uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  descricao        text,
  -- AES-GCM: iv (12 bytes) + ciphertext, tudo em base64.
  -- A chave de cifra vive em Deno.env (TOTP_ENCRYPTION_KEY), fora do banco.
  segredo_cifrado  text NOT NULL,
  digitos          smallint NOT NULL DEFAULT 6  CHECK (digitos BETWEEN 6 AND 8),
  periodo          smallint NOT NULL DEFAULT 30 CHECK (periodo BETWEEN 15 AND 120),
  algoritmo        text NOT NULL DEFAULT 'SHA-1' CHECK (algoritmo IN ('SHA-1','SHA-256','SHA-512')),
  ativo            boolean NOT NULL DEFAULT true,
  criado_por       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, nome)
);

REVOKE ALL ON public.tj_credenciais FROM PUBLIC;
REVOKE ALL ON public.tj_credenciais FROM anon;
REVOKE ALL ON public.tj_credenciais FROM authenticated;
GRANT ALL ON public.tj_credenciais TO service_role;
ALTER TABLE public.tj_credenciais ENABLE ROW LEVEL SECURITY;
-- Sem políticas: nada de anon/authenticated chega aqui, nem para SELECT do nome.

CREATE TRIGGER trg_tj_credenciais_updated_at
  BEFORE UPDATE ON public.tj_credenciais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. Custodiantes: quem administra as credenciais e concede acesso.
--    Deliberadamente NÃO é o papel 'admin' da organização — um admin do app
--    não consegue se tornar custodiante pela interface.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tj_custodiantes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, user_id)
);

REVOKE ALL ON public.tj_custodiantes FROM PUBLIC;
REVOKE ALL ON public.tj_custodiantes FROM anon;
REVOKE ALL ON public.tj_custodiantes FROM authenticated;
GRANT ALL ON public.tj_custodiantes TO service_role;
ALTER TABLE public.tj_custodiantes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Lista de acesso: quem enxerga o código de cada credencial
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tj_credencial_acessos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credencial_id  uuid NOT NULL REFERENCES public.tj_credenciais(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concedido_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credencial_id, user_id)
);

REVOKE ALL ON public.tj_credencial_acessos FROM PUBLIC;
REVOKE ALL ON public.tj_credencial_acessos FROM anon;
REVOKE ALL ON public.tj_credencial_acessos FROM authenticated;
GRANT ALL ON public.tj_credencial_acessos TO service_role;
ALTER TABLE public.tj_credencial_acessos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tj_acessos_user ON public.tj_credencial_acessos (user_id);

-- ---------------------------------------------------------------------------
-- 4. Auditoria: toda consulta de código e toda mudança de permissão.
--    Sem FK para tj_credenciais de propósito: apagar a credencial não pode
--    apagar o histórico de quem a consultou.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tj_auditoria (
  id              bigserial PRIMARY KEY,
  organizacao_id  uuid,
  credencial_id   uuid,
  credencial_nome text,
  user_id         uuid,
  acao            text NOT NULL,
  sucesso         boolean NOT NULL DEFAULT true,
  detalhe         jsonb,
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.tj_auditoria FROM PUBLIC;
REVOKE ALL ON public.tj_auditoria FROM anon;
REVOKE ALL ON public.tj_auditoria FROM authenticated;
GRANT ALL ON public.tj_auditoria TO service_role;
ALTER TABLE public.tj_auditoria ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tj_auditoria_org  ON public.tj_auditoria (organizacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tj_auditoria_cred ON public.tj_auditoria (credencial_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tj_auditoria_user ON public.tj_auditoria (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Semeadura dos custodiantes iniciais.
--    Resolvidos por e-mail; se o e-mail não existir, a linha simplesmente não
--    é criada (nada quebra). Ajuste a lista antes de aplicar.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_emails text[] := ARRAY[
    'juridico@advogadosoliveira.com.br',
    'crystian.santos@gmail.com'
  ];
  v_email text;
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    CONTINUE WHEN v_user_id IS NULL;

    SELECT organizacao_id INTO v_org_id FROM public.membros WHERE user_id = v_user_id LIMIT 1;
    CONTINUE WHEN v_org_id IS NULL;

    INSERT INTO public.tj_custodiantes (organizacao_id, user_id, observacao)
    VALUES (v_org_id, v_user_id, 'custodiante inicial')
    ON CONFLICT (organizacao_id, user_id) DO NOTHING;
  END LOOP;
END $$;

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