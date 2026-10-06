CREATE TABLE public.controladoria_datajud_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  numero_cnj text NOT NULL,
  processo_judicial_id uuid REFERENCES public.processos_judiciais(id) ON DELETE SET NULL,
  cliente_id uuid,
  origem text NOT NULL DEFAULT 'advbox',
  tribunal text,
  classe text,
  orgao_julgador text,
  assuntos jsonb,
  data_ajuizamento timestamptz,
  grau text,
  dados_brutos jsonb,
  nao_encontrado boolean NOT NULL DEFAULT false,
  erro text,
  frequencia text NOT NULL DEFAULT 'semanal',
  consultado_em timestamptz,
  proxima_consulta_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, numero_cnj)
);
CREATE INDEX ON public.controladoria_datajud_processos (proxima_consulta_em);
CREATE INDEX ON public.controladoria_datajud_processos (processo_judicial_id);
GRANT SELECT ON public.controladoria_datajud_processos TO authenticated;
GRANT ALL ON public.controladoria_datajud_processos TO service_role;
ALTER TABLE public.controladoria_datajud_processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem datajud processos" ON public.controladoria_datajud_processos FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.controladoria_datajud_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  numero_cnj text NOT NULL,
  codigo integer NOT NULL DEFAULT 0,
  nome text,
  data_hora timestamptz NOT NULL,
  complementos jsonb,
  carga_inicial boolean NOT NULL DEFAULT false,
  visto_em timestamptz,
  visto_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, numero_cnj, codigo, data_hora)
);
CREATE INDEX ON public.controladoria_datajud_movimentos (organizacao_id, created_at DESC);
GRANT SELECT, UPDATE ON public.controladoria_datajud_movimentos TO authenticated;
GRANT ALL ON public.controladoria_datajud_movimentos TO service_role;
ALTER TABLE public.controladoria_datajud_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem movimentos" ON public.controladoria_datajud_movimentos FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));
CREATE POLICY "internos marcam visto" ON public.controladoria_datajud_movimentos FOR UPDATE TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id))
  WITH CHECK (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.controladoria_radar_buscas (
  organizacao_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ultima_busca_em date,
  ultima_execucao_em timestamptz,
  nome_comum boolean NOT NULL DEFAULT false,
  PRIMARY KEY (organizacao_id, cliente_id)
);
GRANT SELECT ON public.controladoria_radar_buscas TO authenticated;
GRANT ALL ON public.controladoria_radar_buscas TO service_role;
ALTER TABLE public.controladoria_radar_buscas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem radar buscas" ON public.controladoria_radar_buscas FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.controladoria_radar_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  numero_processo text NOT NULL,
  numero_processo_mascara text,
  djen_id bigint,
  data_disponibilizacao date,
  tribunal text,
  classe text,
  orgao text,
  polos jsonb,
  trecho text,
  link text,
  nota integer NOT NULL DEFAULT 0,
  faixa text NOT NULL DEFAULT 'improvavel',
  sinais jsonb,
  destaque boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'novo',
  simulacao boolean NOT NULL DEFAULT false,
  avisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, cliente_id, numero_processo)
);
CREATE INDEX ON public.controladoria_radar_resultados (organizacao_id, faixa, status);
GRANT SELECT ON public.controladoria_radar_resultados TO authenticated;
GRANT ALL ON public.controladoria_radar_resultados TO service_role;
ALTER TABLE public.controladoria_radar_resultados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem radar resultados" ON public.controladoria_radar_resultados FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.controladoria_radar_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  numero_processo text NOT NULL,
  decisao text NOT NULL,
  decidido_por uuid,
  decidido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, cliente_id, numero_processo)
);
GRANT SELECT ON public.controladoria_radar_decisoes TO authenticated;
GRANT ALL ON public.controladoria_radar_decisoes TO service_role;
ALTER TABLE public.controladoria_radar_decisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem radar decisoes" ON public.controladoria_radar_decisoes FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));

CREATE TABLE public.controladoria_monitor_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  tipo text NOT NULL,
  modo text NOT NULL DEFAULT 'real',
  origem text,
  status text NOT NULL DEFAULT 'rodando',
  requisicoes integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  erros jsonb,
  resumo jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);
GRANT SELECT ON public.controladoria_monitor_execucoes TO authenticated;
GRANT ALL ON public.controladoria_monitor_execucoes TO service_role;
ALTER TABLE public.controladoria_monitor_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos leem execucoes monitor" ON public.controladoria_monitor_execucoes FOR SELECT TO authenticated
  USING (public.controladoria_is_internal((select auth.uid()), organizacao_id));