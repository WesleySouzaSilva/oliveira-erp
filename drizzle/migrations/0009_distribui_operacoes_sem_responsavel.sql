-- 1) Vincula operações sem cliente ao cliente de mesmo nome do grupo
update public.operacoes_credito o
set cliente_id = c.id
from public.clientes c
where o.cliente_id is null
  and o.grupo is not null
  and c.deleted_at is null
  and lower(f_unaccent(c.nome)) = lower(f_unaccent(o.grupo));

-- 2) Operação sem responsável herda o responsável do cliente
update public.operacoes_credito o
set responsavel = case c.responsavel_pos_venda
    when '40b399e7-72e9-4711-bda3-430cd3abcb1b' then 'Willian'
    when '0b78b856-fccf-4a7a-af7a-639c247f0f33' then 'Maycon'
    when 'd569ac8c-d44f-4f77-a655-c497fa6d1606' then 'Fernanda'
    when 'dc6e00ec-51a2-489e-bdda-ad5a00d1bd72' then 'Vitoria'
  end,
  updated_at = now()
from public.clientes c
where c.id = o.cliente_id
  and (o.responsavel is null or btrim(o.responsavel) = '')
  and c.responsavel_pos_venda in (
    '40b399e7-72e9-4711-bda3-430cd3abcb1b','0b78b856-fccf-4a7a-af7a-639c247f0f33',
    'd569ac8c-d44f-4f77-a655-c497fa6d1606','dc6e00ec-51a2-489e-bdda-ad5a00d1bd72');

-- 3) Cliente existente sem responsável entra na fila de distribuição do Willian
update public.clientes c
set aguardando_distribuicao = true
where c.deleted_at is null
  and c.responsavel_pos_venda is null
  and exists (
    select 1 from public.operacoes_credito o
    where o.cliente_id = c.id and (o.responsavel is null or btrim(o.responsavel) = '')
  );