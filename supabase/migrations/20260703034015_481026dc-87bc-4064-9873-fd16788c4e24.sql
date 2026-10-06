ALTER TABLE public.tarefas REPLICA IDENTITY FULL;
ALTER TABLE public.contratos_vencimentos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contratos_vencimentos;