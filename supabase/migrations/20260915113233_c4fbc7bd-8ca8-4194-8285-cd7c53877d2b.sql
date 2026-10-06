-- 1) Mover operações das fichas arquivadas para a ficha que ficou
UPDATE public.operacoes_credito SET cliente_id = 'ae0cd13d-21a1-417c-8708-467334b818ef' WHERE cliente_id = '6a69f0af-159d-44f4-b1c5-99148a5ac2d0';
UPDATE public.operacoes_credito SET cliente_id = 'bc88a041-a2d6-4158-8dc4-397734388561' WHERE cliente_id = 'd604069a-6768-42a6-9045-de820e75f3a6';

-- 2) Documentos gravados com a grafia antiga
UPDATE public.arquivos_cliente SET nome_cliente = 'Daniel Aparecido Montanher Bortolo' WHERE nome_cliente = 'Daniel Apareido Montanher Bortolo';

-- 3) Ficha sem equivalente: reativar e corrigir
UPDATE public.clientes SET
  deleted_at = NULL,
  nome = 'Jeisson Rolando Lipinski',
  grupo = 'Jeisson Rolando Lipinski',
  responsavel_pos_venda = 'dc6e00ec-51a2-489e-bdda-ad5a00d1bd72',
  situacao = 'ativo',
  grafias_alternativas = (SELECT ARRAY(SELECT DISTINCT e FROM unnest(coalesce(grafias_alternativas,'{}') || ARRAY['Jeisson Rolando Lipink']) e))
WHERE id = 'c1968192-e370-4ed5-b595-df47d3ff7d56';

-- 4) Fichas que ficaram: nome, grupo e responsável corretos
UPDATE public.clientes SET nome='Airton Brisola', grupo='Airton Brisola - Airton Brisola Junior', responsavel_pos_venda='40b399e7-72e9-4711-bda3-430cd3abcb1b' WHERE id='2ab2ac14-c78c-4e9c-adfc-dec20c7d9151';
UPDATE public.clientes SET nome='Amilton Divino Martins Pereira', grupo='Amilton Divino Martins Pereira', responsavel_pos_venda='40b399e7-72e9-4711-bda3-430cd3abcb1b' WHERE id='4fe33b09-b69b-4c15-a602-61edde91928d';
UPDATE public.clientes SET nome='Daniel Aparecido Montanher Bortolo', grupo='Daniel Aparecido Montanher Bortolo', responsavel_pos_venda='40b399e7-72e9-4711-bda3-430cd3abcb1b',
  grafias_alternativas=(SELECT ARRAY(SELECT DISTINCT e FROM unnest(coalesce(grafias_alternativas,'{}') || ARRAY['Daniel Apareido Montanher Bortolo']) e))
  WHERE id='b5be8971-fca4-43e2-a5bf-6d8ebe3020e8';
UPDATE public.clientes SET nome='Edivan Langoski', grupo='Edivan Langoski', responsavel_pos_venda='0b78b856-fccf-4a7a-af7a-639c247f0f33' WHERE id='c9c9113d-288a-4fc5-8e94-7a33b494d273';
UPDATE public.clientes SET nome='Erivelto dos Santos', grupo='Erivelto dos Santos', responsavel_pos_venda='40b399e7-72e9-4711-bda3-430cd3abcb1b' WHERE id='b64f4f6a-40ea-4eb3-a83f-05a9c2397a35';
UPDATE public.clientes SET nome='Estefano de Biassio', grupo='Estefano de Biassio', responsavel_pos_venda='0b78b856-fccf-4a7a-af7a-639c247f0f33' WHERE id='c75fec0d-b6c2-457f-bc2f-a60ffb7c9ab5';
UPDATE public.clientes SET nome='Evandro Paviani', grupo='Evandro Paviani', responsavel_pos_venda='0b78b856-fccf-4a7a-af7a-639c247f0f33' WHERE id='45c228b7-8e94-4492-a10a-88a2f6b99bc5';
UPDATE public.clientes SET nome='Fernando Kazuyuki Koike', grupo='Fernando Kazuyuki Koike', responsavel_pos_venda='0b78b856-fccf-4a7a-af7a-639c247f0f33' WHERE id='ae0cd13d-21a1-417c-8708-467334b818ef';
UPDATE public.clientes SET nome='Jose Idacil Soares', grupo='Jose Idacil Soares', responsavel_pos_venda='0b78b856-fccf-4a7a-af7a-639c247f0f33' WHERE id='092f3aeb-4660-4202-86c5-8bedd68185e4';
UPDATE public.clientes SET nome='Marciane Ester Hoffmann', grupo='Romarcio Siveris', responsavel_pos_venda='dc6e00ec-51a2-489e-bdda-ad5a00d1bd72' WHERE id='bc88a041-a2d6-4158-8dc4-397734388561';

-- 5) Operações herdam o responsável e o grupo da ficha
UPDATE public.operacoes_credito o SET
  grupo = c.grupo,
  responsavel = CASE c.responsavel_pos_venda::text
    WHEN '40b399e7-72e9-4711-bda3-430cd3abcb1b' THEN 'Willian'
    WHEN '0b78b856-fccf-4a7a-af7a-639c247f0f33' THEN 'Maycon'
    WHEN 'd569ac8c-d44f-4f77-a655-c497fa6d1606' THEN 'Fernanda'
    WHEN 'dc6e00ec-51a2-489e-bdda-ad5a00d1bd72' THEN 'Vitoria'
    ELSE o.responsavel END
FROM public.clientes c
WHERE o.cliente_id = c.id
  AND c.id IN ('2ab2ac14-c78c-4e9c-adfc-dec20c7d9151','4fe33b09-b69b-4c15-a602-61edde91928d','b5be8971-fca4-43e2-a5bf-6d8ebe3020e8','c9c9113d-288a-4fc5-8e94-7a33b494d273','b64f4f6a-40ea-4eb3-a83f-05a9c2397a35','c75fec0d-b6c2-457f-bc2f-a60ffb7c9ab5','45c228b7-8e94-4492-a10a-88a2f6b99bc5','ae0cd13d-21a1-417c-8708-467334b818ef','092f3aeb-4660-4202-86c5-8bedd68185e4','bc88a041-a2d6-4158-8dc4-397734388561','c1968192-e370-4ed5-b595-df47d3ff7d56');