-- Portal do Cliente v2: chamados, contratos visíveis ao cliente, notificações.
-- Aplicada manualmente no banco (connector Lovable) em 17/09/2026 e versionada aqui.

-- ---------------------------------------------------------------------------
-- 1. Contratos bancários: vínculo por cliente_id + visibilidade no portal
-- ---------------------------------------------------------------------------
ALTER TABLE public.contratos_vencimentos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS contratos_vencimentos_cliente_id_idx
  ON public.contratos_vencimentos (cliente_id);

-- Backfill: casa pelo nome exato (case-insensitive) dentro da mesma organização,
-- só quando há UM cliente com aquele nome (evita vincular ao homônimo errado).
UPDATE public.contratos_vencimentos cv
SET cliente_id = c.id
FROM public.clientes c
WHERE cv.cliente_id IS NULL
  AND cv.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND c.organizacao_id = cv.organizacao_id
  AND lower(trim(c.nome)) = lower(trim(cv.nome_cliente))
  AND (
    SELECT count(*) FROM public.clientes c2
    WHERE c2.organizacao_id = cv.organizacao_id
      AND c2.deleted_at IS NULL
      AND lower(trim(c2.nome)) = lower(trim(cv.nome_cliente))
  ) = 1;

-- Trigger: ao inserir/atualizar contrato sem cliente_id, tenta o mesmo casamento.
CREATE OR REPLACE FUNCTION public.contratos_vencimentos_vincula_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_n integer;
BEGIN
  IF NEW.cliente_id IS NULL AND NEW.nome_cliente IS NOT NULL AND NEW.organizacao_id IS NOT NULL THEN
    SELECT min(c.id::text)::uuid, count(*) INTO v_id, v_n
    FROM public.clientes c
    WHERE c.organizacao_id = NEW.organizacao_id
      AND c.deleted_at IS NULL
      AND lower(trim(c.nome)) = lower(trim(NEW.nome_cliente));
    IF v_n = 1 THEN
      NEW.cliente_id := v_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contratos_vencimentos_vincula_cliente ON public.contratos_vencimentos;
CREATE TRIGGER trg_contratos_vencimentos_vincula_cliente
  BEFORE INSERT OR UPDATE OF nome_cliente, cliente_id ON public.contratos_vencimentos
  FOR EACH ROW EXECUTE FUNCTION public.contratos_vencimentos_vincula_cliente();

-- RLS: o usuário do portal enxerga só os contratos do próprio cliente e visíveis.
DROP POLICY IF EXISTS contratos_select_portal_cliente ON public.contratos_vencimentos;
CREATE POLICY contratos_select_portal_cliente ON public.contratos_vencimentos
  FOR SELECT TO authenticated
  USING (
    visivel_cliente = true
    AND deleted_at IS NULL
    AND cliente_id IS NOT NULL
    AND cliente_id = public.cliente_do_usuario_portal(auth.uid())
  );

-- View segura: só colunas que o cliente pode ver (sem observações, responsável
-- nem o texto livre de status_prazo, que carrega anotações internas).
CREATE OR REPLACE VIEW public.portal_cliente_contratos_view
WITH (security_invoker = true) AS
SELECT
  id,
  cliente_id,
  banco,
  numero_contrato,
  primeiro_vencimento,
  vencimento_proxima_parcela,
  vencimento_ultima_parcela,
  valor_parcela,
  valor_total_operacao,
  coalesce(parcelas_vencidas, false) AS parcelas_vencidas,   -- boolean: tem parcela em atraso
  coalesce(protocolo_realizado, false) AS protocolo_realizado,
  data_notificacao,
  coalesce(resolvido, false) AS resolvido,
  created_at,
  updated_at
FROM public.contratos_vencimentos
WHERE deleted_at IS NULL AND visivel_cliente = true;

GRANT SELECT ON public.portal_cliente_contratos_view TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Chamados do portal (pós-venda, atualização de banco, documento, dúvida)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  aberto_por uuid NOT NULL,                         -- auth.users.id (portal ou equipe)
  aberto_por_tipo text NOT NULL DEFAULT 'cliente' CHECK (aberto_por_tipo IN ('cliente','equipe')),
  tipo text NOT NULL CHECK (tipo IN ('pos_venda','banco','documento','duvida')),
  titulo text NOT NULL,
  descricao text,
  banco text,                                       -- só para tipo = 'banco'
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos_vencimentos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','aguardando_cliente','resolvido')),
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  responsavel_id uuid,                              -- auth.users.id do membro
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_chamados_org_status_idx ON public.portal_chamados (organizacao_id, status);
CREATE INDEX IF NOT EXISTS portal_chamados_cliente_idx ON public.portal_chamados (cliente_id);

CREATE TABLE IF NOT EXISTS public.portal_chamado_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES public.portal_chamados(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  autor_tipo text NOT NULL CHECK (autor_tipo IN ('cliente','equipe','olivia')),
  conteudo text NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,        -- [{path, nome, tamanho, tipo}]
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_chamado_mensagens_chamado_idx ON public.portal_chamado_mensagens (chamado_id, created_at);

ALTER TABLE public.portal_chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_chamado_mensagens ENABLE ROW LEVEL SECURITY;

-- Equipe (membros da organização): tudo.
DROP POLICY IF EXISTS chamados_org_all ON public.portal_chamados;
CREATE POLICY chamados_org_all ON public.portal_chamados
  FOR ALL TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

DROP POLICY IF EXISTS chamado_msgs_org_all ON public.portal_chamado_mensagens;
CREATE POLICY chamado_msgs_org_all ON public.portal_chamado_mensagens
  FOR ALL TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- Cliente do portal: vê e abre só os seus; nunca muda status/responsável
-- (o UPDATE do cliente não é liberado; quem fecha é a equipe).
DROP POLICY IF EXISTS chamados_portal_select ON public.portal_chamados;
CREATE POLICY chamados_portal_select ON public.portal_chamados
  FOR SELECT TO authenticated
  USING (cliente_id = public.cliente_do_usuario_portal(auth.uid()));

DROP POLICY IF EXISTS chamados_portal_insert ON public.portal_chamados;
CREATE POLICY chamados_portal_insert ON public.portal_chamados
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id = public.cliente_do_usuario_portal(auth.uid())
    AND aberto_por = auth.uid()
    AND aberto_por_tipo = 'cliente'
    AND status = 'aberto'
  );

DROP POLICY IF EXISTS chamado_msgs_portal_select ON public.portal_chamado_mensagens;
CREATE POLICY chamado_msgs_portal_select ON public.portal_chamado_mensagens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.portal_chamados ch
    WHERE ch.id = portal_chamado_mensagens.chamado_id
      AND ch.cliente_id = public.cliente_do_usuario_portal(auth.uid())
  ));

DROP POLICY IF EXISTS chamado_msgs_portal_insert ON public.portal_chamado_mensagens;
CREATE POLICY chamado_msgs_portal_insert ON public.portal_chamado_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND autor_tipo = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.portal_chamados ch
      WHERE ch.id = portal_chamado_mensagens.chamado_id
        AND ch.cliente_id = public.cliente_do_usuario_portal(auth.uid())
    )
  );

-- organizacao_id da mensagem sempre copiado do chamado (o cliente não sabe o org id).
CREATE OR REPLACE FUNCTION public.portal_chamado_mensagens_preenche()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chamado public.portal_chamados%ROWTYPE;
BEGIN
  SELECT * INTO v_chamado FROM public.portal_chamados WHERE id = NEW.chamado_id;
  IF v_chamado.id IS NULL THEN
    RAISE EXCEPTION 'Chamado não encontrado';
  END IF;
  NEW.organizacao_id := v_chamado.organizacao_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_chamado_mensagens_preenche ON public.portal_chamado_mensagens;
CREATE TRIGGER trg_portal_chamado_mensagens_preenche
  BEFORE INSERT ON public.portal_chamado_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.portal_chamado_mensagens_preenche();

-- Depois da mensagem: atualiza o chamado (última mensagem, status quando o
-- cliente responde) e notifica o outro lado.
CREATE OR REPLACE FUNCTION public.portal_chamado_mensagens_pos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chamado public.portal_chamados%ROWTYPE;
  v_cliente_nome text;
  v_destino uuid;
  v_portal_user uuid;
BEGIN
  SELECT * INTO v_chamado FROM public.portal_chamados WHERE id = NEW.chamado_id;
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = v_chamado.cliente_id;

  IF NEW.autor_tipo = 'cliente' THEN
    -- cliente respondeu: volta para a fila da equipe
    UPDATE public.portal_chamados
      SET ultima_mensagem_em = NEW.created_at,
          updated_at = now(),
          status = CASE WHEN status IN ('aguardando_cliente','resolvido') THEN 'aberto' ELSE status END,
          resolvido_em = CASE WHEN status = 'resolvido' THEN NULL ELSE resolvido_em END
      WHERE id = NEW.chamado_id;

    v_destino := coalesce(v_chamado.responsavel_id,
      (SELECT responsavel_pos_venda FROM public.clientes WHERE id = v_chamado.cliente_id));
    IF v_destino IS NOT NULL THEN
      INSERT INTO public.notificacoes_sistema (user_id, processo_id, mensagem, tipo, lida)
      VALUES (v_destino, v_chamado.processo_id,
              'Portal: ' || coalesce(v_cliente_nome, 'cliente') || ' respondeu no chamado "' || v_chamado.titulo || '"',
              'info', false);
    ELSE
      -- sem responsável: avisa os admins da organização
      INSERT INTO public.notificacoes_sistema (user_id, processo_id, mensagem, tipo, lida)
      SELECT m.user_id, v_chamado.processo_id,
             'Portal: ' || coalesce(v_cliente_nome, 'cliente') || ' respondeu no chamado "' || v_chamado.titulo || '" (sem responsável)',
             'info', false
      FROM public.membros m WHERE m.organizacao_id = v_chamado.organizacao_id AND m.papel = 'admin';
    END IF;
  ELSE
    -- equipe (ou OlivIA) respondeu: avisa o usuário do portal
    UPDATE public.portal_chamados
      SET ultima_mensagem_em = NEW.created_at,
          updated_at = now(),
          status = CASE WHEN NEW.autor_tipo = 'equipe' AND status = 'aberto' THEN 'em_andamento' ELSE status END
      WHERE id = NEW.chamado_id;

    FOR v_portal_user IN
      SELECT user_id FROM public.cliente_portal_usuarios WHERE cliente_id = v_chamado.cliente_id AND ativo = true
    LOOP
      INSERT INTO public.notificacoes_sistema (user_id, processo_id, mensagem, tipo, lida)
      VALUES (v_portal_user, NULL,
              'Nova resposta da equipe no chamado "' || v_chamado.titulo || '"',
              'info', false);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_chamado_mensagens_pos_insert ON public.portal_chamado_mensagens;
CREATE TRIGGER trg_portal_chamado_mensagens_pos_insert
  AFTER INSERT ON public.portal_chamado_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.portal_chamado_mensagens_pos_insert();

-- Ao abrir o chamado: preenche organizacao_id e responsável pelo cliente,
-- registra a descrição como primeira mensagem e notifica a equipe.
CREATE OR REPLACE FUNCTION public.portal_chamados_antes_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_resp uuid;
BEGIN
  SELECT organizacao_id, responsavel_pos_venda INTO v_org, v_resp
  FROM public.clientes WHERE id = NEW.cliente_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente sem organização';
  END IF;
  NEW.organizacao_id := v_org;
  IF NEW.aberto_por_tipo = 'cliente' THEN
    -- o cliente não escolhe responsável, prioridade acima de 'alta' nem status
    NEW.responsavel_id := v_resp;
    NEW.status := 'aberto';
    IF NEW.prioridade = 'urgente' THEN NEW.prioridade := 'alta'; END IF;
  ELSIF NEW.responsavel_id IS NULL THEN
    NEW.responsavel_id := v_resp;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_chamados_antes_insert ON public.portal_chamados;
CREATE TRIGGER trg_portal_chamados_antes_insert
  BEFORE INSERT ON public.portal_chamados
  FOR EACH ROW EXECUTE FUNCTION public.portal_chamados_antes_insert();

CREATE OR REPLACE FUNCTION public.portal_chamados_pos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_nome text;
  v_tipo_label text;
BEGIN
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;
  v_tipo_label := CASE NEW.tipo
    WHEN 'banco' THEN 'atualização do banco'
    WHEN 'pos_venda' THEN 'chamado de pós-venda'
    WHEN 'documento' THEN 'envio de documento'
    ELSE 'dúvida' END;

  IF NEW.aberto_por_tipo = 'cliente' THEN
    IF NEW.responsavel_id IS NOT NULL THEN
      INSERT INTO public.notificacoes_sistema (user_id, processo_id, mensagem, tipo, lida)
      VALUES (NEW.responsavel_id, NEW.processo_id,
              'Portal: ' || coalesce(v_cliente_nome, 'cliente') || ' abriu ' || v_tipo_label || ': "' || NEW.titulo || '"',
              CASE WHEN NEW.tipo = 'banco' OR NEW.prioridade IN ('alta','urgente') THEN 'urgente' ELSE 'info' END, false);
    ELSE
      INSERT INTO public.notificacoes_sistema (user_id, processo_id, mensagem, tipo, lida)
      SELECT m.user_id, NEW.processo_id,
             'Portal: ' || coalesce(v_cliente_nome, 'cliente') || ' abriu ' || v_tipo_label || ': "' || NEW.titulo || '" (sem responsável de pós-venda)',
             'urgente', false
      FROM public.membros m WHERE m.organizacao_id = NEW.organizacao_id AND m.papel = 'admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_chamados_pos_insert ON public.portal_chamados;
CREATE TRIGGER trg_portal_chamados_pos_insert
  AFTER INSERT ON public.portal_chamados
  FOR EACH ROW EXECUTE FUNCTION public.portal_chamados_pos_insert();

CREATE OR REPLACE FUNCTION public.portal_chamados_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'resolvido' AND (OLD.status IS DISTINCT FROM 'resolvido') THEN
    NEW.resolvido_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_chamados_touch ON public.portal_chamados;
CREATE TRIGGER trg_portal_chamados_touch
  BEFORE UPDATE ON public.portal_chamados
  FOR EACH ROW EXECUTE FUNCTION public.portal_chamados_touch();

-- ---------------------------------------------------------------------------
-- 3. Storage: anexos dos chamados (bucket privado)
--    Caminho: <cliente_id>/<chamado_id>/<arquivo>
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portal-anexos', 'portal-anexos', false, 20971520,
        ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic',
              'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS portal_anexos_cliente_insert ON storage.objects;
CREATE POLICY portal_anexos_cliente_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-anexos'
    AND (storage.foldername(name))[1] = public.cliente_do_usuario_portal(auth.uid())::text
  );

DROP POLICY IF EXISTS portal_anexos_cliente_select ON storage.objects;
CREATE POLICY portal_anexos_cliente_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'portal-anexos'
    AND (storage.foldername(name))[1] = public.cliente_do_usuario_portal(auth.uid())::text
  );

DROP POLICY IF EXISTS portal_anexos_org_all ON storage.objects;
CREATE POLICY portal_anexos_org_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'portal-anexos'
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    )
  )
  WITH CHECK (
    bucket_id = 'portal-anexos'
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.organizacao_id IN (SELECT public.user_org_ids(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Notificações do portal: o cliente também pode ler as suas
--    (a policy "Users can view own notifications" já cobre: user_id = auth.uid()).
--    Conversas da OlivIA: as policies olivia_*_owner_all já são por dono.
-- ---------------------------------------------------------------------------
