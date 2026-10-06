UPDATE public.clientes
SET responsavel_pos_venda = '0b78b856-fccf-4a7a-af7a-639c247f0f33',
    aguardando_distribuicao = false
WHERE id = '6a5fa362-eb6d-4a94-bb6d-ffe0745b46e2';

UPDATE public.operacoes_credito
SET responsavel = 'Maycon'
WHERE cliente_id = '6a5fa362-eb6d-4a94-bb6d-ffe0745b46e2' AND deleted_at IS NULL;

UPDATE public.clientes
SET deleted_at = now(), situacao = 'fora_do_escopo', situacao_motivo = 'Ficha de teste do portal - arquivada'
WHERE id = '45c1e85b-9c22-4b51-85d2-81f31b150d4e';