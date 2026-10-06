CREATE TABLE public.advbox_foto_clientes_antes AS SELECT * FROM public.clientes;
COMMENT ON TABLE public.advbox_foto_clientes_antes IS 'Foto dos clientes antes da importação ADVBOX (validação). Só service_role.';
GRANT ALL ON public.advbox_foto_clientes_antes TO service_role;
ALTER TABLE public.advbox_foto_clientes_antes ENABLE ROW LEVEL SECURITY;