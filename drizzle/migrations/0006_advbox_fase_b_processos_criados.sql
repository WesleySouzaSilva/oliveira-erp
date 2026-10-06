-- Vincula as operações aos processos criados no ADVBOX (Fase B enxuta)
UPDATE public.operacoes_credito
SET advbox_lawsuits_id = '18372925',
    advbox_titular_customers_id = '17114784',
    advbox_vinculo_status = 'vinculado',
    advbox_vinculo_origem = 'fase_b_criado',
    advbox_vinculo_obs = 'Processo criado na Fase B. Parte contrária não cadastrada: definir qual Cresol.'
WHERE id = '5f46f516-7697-45ed-8eed-5d74e75eb4a6';

UPDATE public.operacoes_credito
SET advbox_lawsuits_id = '18372926',
    advbox_titular_customers_id = '12900738',
    advbox_vinculo_status = 'vinculado',
    advbox_vinculo_origem = 'fase_b_criado',
    advbox_vinculo_obs = 'Processo criado na Fase B com Cresol Triunfo (8201308) como parte contrária.'
WHERE id = 'a67dff4c-e60c-4447-8c2b-2da9b2fe6831';

-- Pendências: contatos não criados por falta de CPF/CNPJ
INSERT INTO public.advbox_pendencias (organizacao_id, tipo, titulo, descricao, status)
SELECT c.organizacao_id, 'cadastro',
       'Coletar CPF antes de criar no ADVBOX — ' || c.nome,
       'Contato não criado no ADVBOX: sem CPF/CNPJ no app. Contato criado errado não pode ser corrigido pela API.',
       'aberta'
FROM public.clientes c
WHERE c.id IN (
  '9afb6a4d-dd77-4846-95ce-89333dee66c5',
  'b71733be-6eb0-4ee6-8519-3e32bda19b38',
  'fc399faa-b0a2-44fc-95a1-f9f4d58d19f5',
  '73410fe3-ed0e-4073-b47c-6f42024e3ddc',
  'ee61de64-d9f9-4f5a-82ba-3919a47454b5',
  'e774609b-8b14-41ca-8ca1-da2e3830ea1d'
);

-- Pendência: qual Cresol é a parte contrária do Ronaldo
INSERT INTO public.advbox_pendencias (organizacao_id, tipo, titulo, descricao, status)
SELECT o.organizacao_id, 'fase_b',
       'Definir qual Cresol no processo 18372925 (Ronaldo Alves de Jesus)',
       'O processo foi criado só com o titular. No ADVBOX existem várias cooperativas Cresol e a operação está como "Cresol" genérico — incluir a parte contrária correta manualmente.',
       'aberta'
FROM public.operacoes_credito o WHERE o.id = '5f46f516-7697-45ed-8eed-5d74e75eb4a6';

-- Marca como resolvida a pendência do 15832917 (anotação Sicoob gravada)
UPDATE public.advbox_pendencias
SET status = 'resolvida', resolvido_em = now()
WHERE id = '3970134e-5532-4cd8-bde1-7187dc592803';