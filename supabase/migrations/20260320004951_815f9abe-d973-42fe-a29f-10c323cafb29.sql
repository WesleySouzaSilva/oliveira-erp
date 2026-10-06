
ALTER TABLE public.atividades_clientes 
  ADD COLUMN data_atividade date DEFAULT CURRENT_DATE,
  ADD COLUMN anexo_url text,
  ADD COLUMN anexo_nome text;
