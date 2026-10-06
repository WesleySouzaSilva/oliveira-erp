ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS base_historica_advbox boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.clientes.base_historica_advbox IS 'Cliente importado do ADVBOX como base histórica: fora do Workflow e da fila, sem distribuição automática.';

CREATE OR REPLACE FUNCTION public.fn_cliente_auto_responsavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  escolhido uuid;
BEGIN
  IF COALESCE(NEW.base_historica_advbox, false) THEN
    NEW.aguardando_distribuicao := false;
    RETURN NEW;
  END IF;
  IF NEW.responsavel_pos_venda IS NOT NULL THEN
    NEW.aguardando_distribuicao := false;
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.situacao, 'ativo') <> 'ativo' THEN
    RETURN NEW;
  END IF;
  IF NEW.organizacao_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.grupo, '') <> '' THEN
    SELECT c.responsavel_pos_venda INTO escolhido
    FROM public.clientes c
    WHERE c.organizacao_id = NEW.organizacao_id
      AND c.responsavel_pos_venda IS NOT NULL
      AND c.deleted_at IS NULL
      AND (NEW.id IS NULL OR c.id <> NEW.id)
      AND lower(f_unaccent(COALESCE(c.grupo, ''))) = lower(f_unaccent(NEW.grupo))
    ORDER BY c.created_at LIMIT 1;
  END IF;
  IF escolhido IS NULL THEN
    SELECT cr.user_id INTO escolhido
    FROM public.carteira_responsaveis cr
    LEFT JOIN public.clientes c
      ON c.responsavel_pos_venda = cr.user_id
     AND c.organizacao_id = NEW.organizacao_id
     AND c.deleted_at IS NULL
     AND COALESCE(c.situacao, 'ativo') = 'ativo'
    WHERE cr.ativo
    GROUP BY cr.user_id, cr.nome_curto
    ORDER BY count(c.id) ASC, cr.nome_curto
    LIMIT 1;
  END IF;
  IF escolhido IS NOT NULL THEN
    NEW.responsavel_pos_venda := escolhido;
    NEW.aguardando_distribuicao := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.processos_judiciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  advbox_lawsuit_id text NOT NULL,
  numero_cnj text,
  numero_cnj_formatado text,
  tipo text, grupo text, fase text, etapa text,
  advbox_responsavel_id text, advbox_responsavel_nome text, responsavel_user_id uuid,
  observacoes text,
  advbox_criado_em timestamptz,
  status_closure_bruto text,
  dados_brutos jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, advbox_lawsuit_id)
);
COMMENT ON COLUMN public.processos_judiciais.status_closure_bruto IS 'Valor cru do ADVBOX. NÃO significa encerrado: processos com data aqui seguem recebendo intimação.';
CREATE INDEX ON public.processos_judiciais (organizacao_id, numero_cnj);
CREATE INDEX ON public.processos_judiciais (responsavel_user_id);
GRANT SELECT ON public.processos_judiciais TO authenticated;
GRANT ALL ON public.processos_judiciais TO service_role;
ALTER TABLE public.processos_judiciais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem processos judiciais" ON public.processos_judiciais FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.processo_judicial_clientes (
  processo_judicial_id uuid NOT NULL REFERENCES public.processos_judiciais(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  PRIMARY KEY (processo_judicial_id, cliente_id)
);
CREATE INDEX ON public.processo_judicial_clientes (cliente_id);
CREATE INDEX ON public.processo_judicial_clientes (organizacao_id);
GRANT SELECT ON public.processo_judicial_clientes TO authenticated;
GRANT ALL ON public.processo_judicial_clientes TO service_role;
ALTER TABLE public.processo_judicial_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem relacao processo cliente" ON public.processo_judicial_clientes FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.advbox_clientes_alias (
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  advbox_customers_id text NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  motivo text,
  conferido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organizacao_id, advbox_customers_id)
);
CREATE INDEX ON public.advbox_clientes_alias (cliente_id);
GRANT SELECT ON public.advbox_clientes_alias TO authenticated;
GRANT ALL ON public.advbox_clientes_alias TO service_role;
ALTER TABLE public.advbox_clientes_alias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem alias advbox" ON public.advbox_clientes_alias FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.advbox_importacao_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  iniciado_por uuid,
  modo text NOT NULL DEFAULT 'simular',
  etapa text NOT NULL DEFAULT 'clientes',
  offset_atual integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento',
  contagens jsonb NOT NULL DEFAULT '{}'::jsonb,
  relatorio jsonb,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.advbox_importacao_execucoes (organizacao_id);
GRANT SELECT ON public.advbox_importacao_execucoes TO authenticated;
GRANT ALL ON public.advbox_importacao_execucoes TO service_role;
ALTER TABLE public.advbox_importacao_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins leem execucoes advbox" ON public.advbox_importacao_execucoes FOR SELECT TO authenticated
  USING (public.controladoria_is_admin((select auth.uid()), organizacao_id));

ALTER TABLE public.djen_comunicacoes ADD COLUMN IF NOT EXISTS processo_judicial_id uuid REFERENCES public.processos_judiciais(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS djen_comunicacoes_processo_judicial_id_idx ON public.djen_comunicacoes (processo_judicial_id);