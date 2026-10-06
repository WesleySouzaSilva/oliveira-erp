alter table public.clientes
  add column if not exists encerramento_comunicado_em date,
  add column if not exists encerramento_comunicado_canal text,
  add column if not exists encerramento_comunicado_arquivo text,
  add column if not exists encerramento_comunicado_por uuid,
  add column if not exists encerramento_comunicado_registrado_em timestamptz;

comment on column public.clientes.encerramento_comunicado_em is
  'Data em que o cliente foi comunicado por escrito dos vencimentos dos proximos 60 dias, antes do encerramento.';