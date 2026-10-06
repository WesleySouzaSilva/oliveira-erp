-- Acompanhamento da notificação por titular + banco
CREATE TABLE public.notificacoes_banco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  titular_nome text NOT NULL,
  banco text NOT NULL,
  responsavel text,
  estado text NOT NULL DEFAULT 'em_preparo',
  protocolo_data date,
  protocolo_canal text,
  protocolo_ref text,
  cobranca_prazo date,
  resposta_data date,
  resposta_resultado text,
  resposta_anexo text,
  contador_desde date,
  silencio_banco boolean NOT NULL DEFAULT false,
  ultimo_contato_cliente date,
  decisao text,
  decisao_motivo text,
  decisao_em timestamptz,
  decisao_por uuid,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notif_banco_estado_chk CHECK (estado IN ('em_preparo','protocolada','aguardando_resposta','respondida','decidida','encerrada')),
  CONSTRAINT notif_banco_resultado_chk CHECK (resposta_resultado IS NULL OR resposta_resultado IN ('deferida','negada','evasiva','pediu_documento')),
  CONSTRAINT notif_banco_canal_chk CHECK (protocolo_canal IS NULL OR protocolo_canal IN ('consumidor_gov','email','agencia','carta','outro')),
  CONSTRAINT notif_banco_protocolo_chk CHECK (
    estado = 'em_preparo' OR protocolo_data IS NOT NULL AND protocolo_canal IS NOT NULL AND protocolo_ref IS NOT NULL
  )
);
CREATE UNIQUE INDEX notif_banco_unico ON public.notificacoes_banco (organizacao_id, lower(titular_nome), lower(banco));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_banco TO authenticated;
GRANT ALL ON public.notificacoes_banco TO service_role;
ALTER TABLE public.notificacoes_banco ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_banco_select ON public.notificacoes_banco FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_banco_insert ON public.notificacoes_banco FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_banco_update ON public.notificacoes_banco FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_banco_delete ON public.notificacoes_banco FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));

CREATE TRIGGER trg_notif_banco_org BEFORE INSERT ON public.notificacoes_banco
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

-- Histórico de contatos com o produtor
CREATE TABLE public.notificacao_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes_banco(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT current_date,
  canal text NOT NULL,
  resumo text NOT NULL,
  registrado_por uuid,
  registrado_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notif_contato_canal_chk CHECK (canal IN ('telefone','whatsapp','presencial','email','outro'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacao_contatos TO authenticated;
GRANT ALL ON public.notificacao_contatos TO service_role;
ALTER TABLE public.notificacao_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_contato_select ON public.notificacao_contatos FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_contato_insert ON public.notificacao_contatos FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_contato_update ON public.notificacao_contatos FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_contato_delete ON public.notificacao_contatos FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE TRIGGER trg_notif_contato_org BEFORE INSERT ON public.notificacao_contatos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

-- Decisões do próximo passo (histórico)
CREATE TABLE public.notificacao_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes_banco(id) ON DELETE CASCADE,
  decisao text NOT NULL,
  motivo text,
  sugestao text,
  decidido_por uuid,
  decidido_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notificacao_decisoes TO authenticated;
GRANT ALL ON public.notificacao_decisoes TO service_role;
ALTER TABLE public.notificacao_decisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_dec_select ON public.notificacao_decisoes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_dec_insert ON public.notificacao_decisoes FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE TRIGGER trg_notif_dec_org BEFORE INSERT ON public.notificacao_decisoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();

-- Prazos configuráveis
CREATE TABLE public.notificacao_config (
  organizacao_id uuid PRIMARY KEY,
  prazo_consumidor_gov integer NOT NULL DEFAULT 10,
  prazo_outros_canais integer NOT NULL DEFAULT 7,
  dias_sem_resposta integer NOT NULL DEFAULT 15,
  dias_silencio integer NOT NULL DEFAULT 30,
  dias_contato_cliente integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notificacao_config TO authenticated;
GRANT ALL ON public.notificacao_config TO service_role;
ALTER TABLE public.notificacao_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_cfg_select ON public.notificacao_config FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY notif_cfg_insert ON public.notificacao_config FOR INSERT TO authenticated
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));
CREATE POLICY notif_cfg_update ON public.notificacao_config FOR UPDATE TO authenticated
  USING (is_admin_in_org(auth.uid(), organizacao_id))
  WITH CHECK (is_admin_in_org(auth.uid(), organizacao_id));

-- Sugestões vindas da varredura das pastas (nada aplicado sem clique)
CREATE TABLE public.varredura_sugestoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  tipo text NOT NULL,
  responsavel text,
  cliente_nome text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  valor text,
  codigo text,
  data date,
  vezes integer NOT NULL DEFAULT 1,
  arquivo text,
  variantes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente',
  operacao_id uuid REFERENCES public.operacoes_credito(id) ON DELETE SET NULL,
  aplicado_em timestamptz,
  aplicado_por uuid,
  aplicado_nome text,
  descartado_motivo text,
  importado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT varredura_tipo_chk CHECK (tipo IN ('instituicao','protocolo')),
  CONSTRAINT varredura_status_chk CHECK (status IN ('pendente','aplicada','descartada'))
);
CREATE INDEX varredura_cliente_idx ON public.varredura_sugestoes (organizacao_id, tipo, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.varredura_sugestoes TO authenticated;
GRANT ALL ON public.varredura_sugestoes TO service_role;
ALTER TABLE public.varredura_sugestoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY varredura_select ON public.varredura_sugestoes FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY varredura_insert ON public.varredura_sugestoes FOR INSERT TO authenticated
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY varredura_update ON public.varredura_sugestoes FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE POLICY varredura_delete ON public.varredura_sugestoes FOR DELETE TO authenticated
  USING (organizacao_id IN (SELECT user_org_ids(auth.uid())));
CREATE TRIGGER trg_varredura_org BEFORE INSERT ON public.varredura_sugestoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_organizacao_id();
