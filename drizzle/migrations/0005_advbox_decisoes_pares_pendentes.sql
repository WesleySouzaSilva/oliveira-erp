-- 1. Colunas de status do vínculo e observação de CPF
ALTER TABLE public.operacoes_credito
  ADD COLUMN IF NOT EXISTS advbox_vinculo_status text,
  ADD COLUMN IF NOT EXISTS advbox_vinculo_obs text;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf_observacao text;

-- 2. CPFs da família de Boer
update clientes set cpf_cnpj='082.092.759-76', cpf_origem='CPF vindo do ADVBOX (confirmado em documento)', cpf_origem_em=now() where id='93fb8242-c0eb-407b-b57f-75f7d6c88577';
update clientes set cpf_cnpj='082.092.769-48', cpf_origem='CPF vindo do ADVBOX (confirmado em contrato)', cpf_origem_em=now() where id='2bfbb096-46e5-4492-984b-26ec8eee20f0';
update clientes set cpf_cnpj='082.092.779-10', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now(), cpf_observacao='confirmar na procuração' where id='b1081859-e083-429c-8d94-61157dd38a14';
update clientes set cpf_cnpj='032.483.239-73', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='ce450ff7-69b5-48d4-b732-197da780fab1';

-- 3. Tabelas de apoio: marcas de processos e pendências
CREATE TABLE IF NOT EXISTS public.advbox_processos_marcas (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid,
  advbox_lawsuits_id text not null,
  marca text not null,
  referencia_lawsuits_id text,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  unique (advbox_lawsuits_id, marca)
);
GRANT SELECT ON public.advbox_processos_marcas TO authenticated;
GRANT ALL ON public.advbox_processos_marcas TO service_role;
ALTER TABLE public.advbox_processos_marcas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "advbox_marcas_select_org" ON public.advbox_processos_marcas;
CREATE POLICY "advbox_marcas_select_org" ON public.advbox_processos_marcas
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS public.advbox_pendencias (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid,
  tipo text not null,
  titulo text not null,
  descricao text,
  status text not null default 'aberta',
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid
);
GRANT SELECT, UPDATE ON public.advbox_pendencias TO authenticated;
GRANT ALL ON public.advbox_pendencias TO service_role;
ALTER TABLE public.advbox_pendencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "advbox_pend_select_org" ON public.advbox_pendencias;
CREATE POLICY "advbox_pend_select_org" ON public.advbox_pendencias
  FOR SELECT TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
DROP POLICY IF EXISTS "advbox_pend_update_org" ON public.advbox_pendencias;
CREATE POLICY "advbox_pend_update_org" ON public.advbox_pendencias
  FOR UPDATE TO authenticated
  USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  WITH CHECK (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

-- 4. Vínculos definitivos
WITH alvo(titular, banco, lawsuit) AS (VALUES
  ('Jose Francisco de Oliveira Filho','Cresol','14271243'),
  ('Leonardo Telles Canha','Bradesco','15584418'),
  ('Ronald Fernando de Boer','Sicoob','17469322'),
  ('Luciano Kohl','Sicredi','13797734'),
  ('Luciano Kohl','Sicoob','15584275'),
  ('Luciano Kohl','Cresol','15584275'),
  ('Vinicius Colombo Rigon','Banco do Brasil','15847687'),
  ('Vitor Cesar Rigon','Banco do Brasil','15847687'),
  ('Wilian Guimaraes Dusi','Sicredi','11777019'),
  ('Clovis Rogerio Vicentini','Banco CNH','14279128')
)
UPDATE operacoes_credito o
SET advbox_lawsuits_id = a.lawsuit,
    advbox_vinculo_origem = 'decisao_manual',
    advbox_vinculo_status = 'definitivo',
    advbox_vinculo_obs = NULL
FROM alvo a, clientes c
WHERE c.id = o.cliente_id
  AND o.deleted_at IS NULL
  AND coalesce(o.titular_nome, c.nome) = a.titular
  AND o.banco = a.banco;

-- 5. Vínculos provisórios (processo ativo mais recente)
WITH alvo(titular, banco, lawsuit) AS (VALUES
  ('Alison Andre Latreille','Sicoob','15632179'),
  ('Celso Isnaldo Marques','Sicredi','15935979'),
  ('Celso Isnaldo Marques','Caixa Econômica Federal','15935979'),
  ('Celso Isnaldo Marques','Banco do Brasil','15935979'),
  ('Iran Ferreira Morais Freire','Bradesco','11283907'),
  ('Reinaldo de Boer','Sicoob','15832917')
)
UPDATE operacoes_credito o
SET advbox_lawsuits_id = a.lawsuit,
    advbox_vinculo_origem = 'decisao_manual',
    advbox_vinculo_status = 'a_confirmar',
    advbox_vinculo_obs = 'Vínculo provisório — processo ativo mais recente; revisar'
FROM alvo a, clientes c
WHERE c.id = o.cliente_id
  AND o.deleted_at IS NULL
  AND coalesce(o.titular_nome, c.nome) = a.titular
  AND o.banco = a.banco;

-- 6. Marcas de processos
INSERT INTO public.advbox_processos_marcas (organizacao_id, advbox_lawsuits_id, marca, referencia_lawsuits_id, observacao) VALUES
  ('c937a42c-a30b-4c80-a595-7887926683fd','14410973','duplicado_revisar',NULL,'Jose Francisco de Oliveira Filho / Cresol'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','15182747','duplicado_revisar',NULL,'Leonardo Telles Canha / Bradesco'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','16871516','duplicado_revisar',NULL,'Ronald Fernando de Boer / Sicoob'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','11810848','duplicado_revisar',NULL,'Wilian Guimaraes Dusi / Sicredi'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','13724492','duplicado_revisar',NULL,'Vitor Cesar Rigon / Banco do Brasil'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','18165842','recurso','14279128','Agravo 0126825-60.2026.8.16.0000 ligado ao caso do Clovis Rogerio Vicentini'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','9240341','pendente_conferencia',NULL,'Clovis Rogerio Vicentini — processo RS/2025, aguardando conferência do Willian')
ON CONFLICT (advbox_lawsuits_id, marca) DO UPDATE
  SET referencia_lawsuits_id = excluded.referencia_lawsuits_id,
      observacao = excluded.observacao;

-- 7. Pendências
INSERT INTO public.advbox_pendencias (organizacao_id, tipo, titulo, descricao) VALUES
  ('c937a42c-a30b-4c80-a595-7887926683fd','operacao','Definir a cooperativa credora na operação do Edivan (conferir na cédula)','Existem dois processos: Sicredi Campos Gerais (17758944) e Sicredi Centro Sul (18361796). A operação está como "Sicredi" genérico e não foi vinculada.'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','revisao','Revisar vínculos provisórios do ADVBOX (a confirmar)','Alison Andre Latreille/Sicoob → 15632179; Celso Isnaldo Marques/Sicredi, Caixa e Banco do Brasil → 15935979; Iran Ferreira Morais Freire/Bradesco → 11283907; Reinaldo de Boer/Sicoob → 15832917.'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','revisao','Conferir o processo 9240341 (RS, 2025) do Clovis Rogerio Vicentini','Ficou fora do vínculo até decisão do Willian.'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','fase_b','Escrever "Sicoob" nas anotações do processo 15832917 (Reinaldo de Boer) quando a Fase B rodar','Processo sem parte contrária cadastrada; o banco só sobrevive nas anotações.'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','cadastro','Confirmar o CPF do Frank Hendrik de Boer na procuração','CPF 082.092.779-10 gravado a partir do ADVBOX, ainda sem documento conferido.'),
  ('c937a42c-a30b-4c80-a595-7887926683fd','revisao','Revisar processos marcados como duplicado','14410973, 15182747, 16871516, 11810848 e 13724492 — não vinculados.');