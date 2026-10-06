
CREATE OR REPLACE FUNCTION public.controladoria_is_internal(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.membros m WHERE m.user_id=_user_id AND m.organizacao_id=_org_id)
     AND NOT EXISTS (SELECT 1 FROM public.cliente_portal_usuarios c WHERE c.user_id=_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.empresa_portal_usuarios e WHERE e.user_id=_user_id)
$$;

CREATE TABLE public.controladoria_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin','membro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, user_id)
);

CREATE OR REPLACE FUNCTION public.controladoria_is_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.controladoria_is_internal(_user_id,_org_id) AND (
    EXISTS (SELECT 1 FROM public.controladoria_membros c WHERE c.user_id=_user_id AND c.organizacao_id=_org_id AND c.papel='admin')
    OR public.is_admin_in_org(_user_id,_org_id))
$$;

REVOKE ALL ON FUNCTION public.controladoria_is_internal(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.controladoria_is_admin(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controladoria_is_internal(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.controladoria_is_admin(uuid,uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.controladoria_membros TO authenticated;
GRANT ALL ON public.controladoria_membros TO service_role;
ALTER TABLE public.controladoria_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctrl_membros_select" ON public.controladoria_membros FOR SELECT TO authenticated USING (public.controladoria_is_internal(auth.uid(), organizacao_id));
CREATE POLICY "ctrl_membros_admin" ON public.controladoria_membros FOR ALL TO authenticated USING (public.controladoria_is_admin(auth.uid(), organizacao_id)) WITH CHECK (public.controladoria_is_admin(auth.uid(), organizacao_id));

CREATE TABLE public.controladoria_oabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  numero text NOT NULL,
  uf text NOT NULL,
  advogado_nome text,
  user_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  carga_inicial_feita boolean NOT NULL DEFAULT false,
  ultima_captura timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, numero, uf)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controladoria_oabs TO authenticated;
GRANT ALL ON public.controladoria_oabs TO service_role;
ALTER TABLE public.controladoria_oabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctrl_oabs_select" ON public.controladoria_oabs FOR SELECT TO authenticated USING (public.controladoria_is_internal(auth.uid(), organizacao_id));
CREATE POLICY "ctrl_oabs_admin" ON public.controladoria_oabs FOR ALL TO authenticated USING (public.controladoria_is_admin(auth.uid(), organizacao_id)) WITH CHECK (public.controladoria_is_admin(auth.uid(), organizacao_id));

CREATE TABLE public.djen_comunicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  djen_id bigint NOT NULL,
  hash text,
  oab_id uuid REFERENCES public.controladoria_oabs(id) ON DELETE SET NULL,
  data_disponibilizacao date,
  sigla_tribunal text,
  tipo_comunicacao text,
  nome_orgao text,
  nome_classe text,
  numero_processo text,
  numero_processo_mascara text,
  texto text,
  link text,
  meio text,
  ativo boolean,
  status text,
  data_cancelamento timestamptz,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  advogados jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_publicacao date,
  inicio_prazo date,
  aviso_suspensao boolean NOT NULL DEFAULT false,
  advbox_lawsuit_id text,
  advbox_responsavel text,
  advbox_nao_cadastrado boolean NOT NULL DEFAULT false,
  advbox_consultado_em timestamptz,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  polo_cliente text,
  status_triagem text NOT NULL DEFAULT 'nova' CHECK (status_triagem IN ('nova','lida','tarefa_criada','sem_providencia')),
  triado_por uuid,
  triado_em timestamptz,
  prazo_dias integer,
  prazo_fatal date,
  tarefa_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, djen_id)
);
CREATE INDEX djen_com_org_data_idx ON public.djen_comunicacoes (organizacao_id, data_disponibilizacao DESC);
CREATE INDEX djen_com_proc_idx ON public.djen_comunicacoes (numero_processo);
GRANT SELECT, UPDATE ON public.djen_comunicacoes TO authenticated;
GRANT ALL ON public.djen_comunicacoes TO service_role;
ALTER TABLE public.djen_comunicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "djen_select" ON public.djen_comunicacoes FOR SELECT TO authenticated USING (public.controladoria_is_internal(auth.uid(), organizacao_id));
CREATE POLICY "djen_update" ON public.djen_comunicacoes FOR UPDATE TO authenticated USING (public.controladoria_is_internal(auth.uid(), organizacao_id)) WITH CHECK (public.controladoria_is_internal(auth.uid(), organizacao_id));

CREATE OR REPLACE FUNCTION public.fn_djen_triagem_valida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.status_triagem IS DISTINCT FROM OLD.status_triagem THEN
    IF NEW.status_triagem = 'nova' AND OLD.status_triagem <> 'nova' THEN
      NULL; -- reabrir é permitido
    END IF;
    IF NEW.status_triagem = 'tarefa_criada' AND (NEW.prazo_dias IS NULL OR NEW.prazo_fatal IS NULL) THEN
      RAISE EXCEPTION 'Para gerar tarefa informe o prazo em dias';
    END IF;
    IF NEW.status_triagem = 'sem_providencia' AND coalesce(trim(NEW.observacao),'') = '' THEN
      RAISE EXCEPTION 'Informe o motivo de "sem providência"';
    END IF;
    IF NEW.status_triagem <> 'nova' THEN
      NEW.triado_em := coalesce(NEW.triado_em, now());
      NEW.triado_por := coalesce(NEW.triado_por, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_djen_triagem BEFORE UPDATE ON public.djen_comunicacoes FOR EACH ROW EXECUTE FUNCTION public.fn_djen_triagem_valida();

CREATE TABLE public.controladoria_d5_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  d0 date NOT NULL,
  janela_fim date NOT NULL,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  total_janela integer NOT NULL DEFAULT 0,
  total_vencidas integer NOT NULL DEFAULT 0,
  totais jsonb NOT NULL DEFAULT '{}'::jsonb,
  html text,
  UNIQUE (organizacao_id, data_ref)
);
GRANT SELECT ON public.controladoria_d5_snapshots TO authenticated;
GRANT ALL ON public.controladoria_d5_snapshots TO service_role;
ALTER TABLE public.controladoria_d5_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "d5s_select" ON public.controladoria_d5_snapshots FOR SELECT TO authenticated USING (public.controladoria_is_internal(auth.uid(), organizacao_id));

CREATE TABLE public.controladoria_d5_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.controladoria_d5_snapshots(id) ON DELETE CASCADE,
  origem text NOT NULL CHECK (origem IN ('ADVBOX','App')),
  id_externo text,
  titulo text,
  processo text,
  cliente text,
  prazo date,
  d_n integer,
  vencida boolean NOT NULL DEFAULT false,
  responsavel_nome text,
  responsavel_email text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX d5_itens_snap_idx ON public.controladoria_d5_itens (snapshot_id);
GRANT SELECT ON public.controladoria_d5_itens TO authenticated;
GRANT ALL ON public.controladoria_d5_itens TO service_role;
ALTER TABLE public.controladoria_d5_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "d5i_select" ON public.controladoria_d5_itens FOR SELECT TO authenticated USING (public.controladoria_is_internal(auth.uid(), organizacao_id));

CREATE TABLE public.controladoria_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  funcao text NOT NULL,
  origem text,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  novas integer DEFAULT 0,
  total integer DEFAULT 0,
  detalhes jsonb DEFAULT '{}'::jsonb,
  erro text
);
GRANT SELECT ON public.controladoria_execucoes TO authenticated;
GRANT ALL ON public.controladoria_execucoes TO service_role;
ALTER TABLE public.controladoria_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exec_select" ON public.controladoria_execucoes FOR SELECT TO authenticated USING (organizacao_id IS NOT NULL AND public.controladoria_is_internal(auth.uid(), organizacao_id));

CREATE TABLE public.controladoria_feriados_forenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  data date NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controladoria_feriados_forenses TO authenticated;
GRANT ALL ON public.controladoria_feriados_forenses TO service_role;
ALTER TABLE public.controladoria_feriados_forenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fforense_select" ON public.controladoria_feriados_forenses FOR SELECT TO authenticated USING (public.controladoria_is_internal(auth.uid(), organizacao_id));
CREATE POLICY "fforense_admin" ON public.controladoria_feriados_forenses FOR ALL TO authenticated USING (public.controladoria_is_admin(auth.uid(), organizacao_id)) WITH CHECK (public.controladoria_is_admin(auth.uid(), organizacao_id));
