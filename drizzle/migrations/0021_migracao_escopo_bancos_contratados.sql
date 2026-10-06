-- 1) Pares titular+banco com processo no ADVBOX viram "contratado"
with novos as (
  select o.cliente_id, min(o.organizacao_id::text)::uuid org, lower(trim(o.banco)) bk, min(trim(o.banco)) banco
  from public.operacoes_credito o
  where o.deleted_at is null and o.cliente_id is not null
    and coalesce(trim(o.banco),'') <> '' and o.advbox_lawsuits_id is not null
  group by 1,3
), faltantes as (
  select n.* from novos n
  left join public.cliente_banco_escopo e
    on e.cliente_id = n.cliente_id and lower(trim(e.banco)) = n.bk
  where e.id is null
), ins as (
  insert into public.cliente_banco_escopo (organizacao_id, cliente_id, banco, escopo, origem, observacao, definido_em)
  select org, cliente_id, banco, 'contratado', 'migracao',
         'marcado automaticamente na migração - já tinha processo no ADVBOX', now()
  from faltantes
  returning organizacao_id, cliente_id, banco
)
insert into public.cliente_banco_escopo_historico
  (organizacao_id, cliente_id, banco, escopo_anterior, escopo_novo, origem, motivo)
select organizacao_id, cliente_id, banco, null, 'contratado', 'migracao',
       'marcado automaticamente na migração - já tinha processo no ADVBOX'
from ins;

-- 2) Daniel / Banco do Brasil: correção (cautelar em andamento, operação 240305778)
with alvo as (
  select e.id, e.organizacao_id, e.cliente_id, e.banco, e.escopo
  from public.cliente_banco_escopo e
  join public.clientes c on c.id = e.cliente_id
  where c.nome ilike 'Daniel Aparecido Montanher Bortolo%'
    and lower(trim(e.banco)) = 'banco do brasil'
), upd as (
  update public.cliente_banco_escopo e
     set escopo = 'contratado',
         observacao = 'corrigido: cautelar em andamento contra o BB sobre a operação 240305778',
         definido_em = now(), updated_at = now()
    from alvo a where e.id = a.id
  returning e.organizacao_id, e.cliente_id, e.banco, a.escopo as anterior
)
insert into public.cliente_banco_escopo_historico
  (organizacao_id, cliente_id, banco, escopo_anterior, escopo_novo, origem, motivo)
select organizacao_id, cliente_id, banco, anterior, 'contratado', 'correcao',
       'cautelar em andamento contra o BB sobre a operação 240305778'
from upd;

-- 3) Pares sem processo definidos manualmente: Romarcio (3 bancos) e Edivan/Sicredi
with alvo as (
  select distinct o.cliente_id, o.organizacao_id, min(trim(o.banco)) over (partition by o.cliente_id, lower(trim(o.banco))) banco,
         lower(trim(o.banco)) bk
  from public.operacoes_credito o
  join public.clientes c on c.id = o.cliente_id
  where o.deleted_at is null
    and (
      (c.nome ilike 'Romarcio Siveris%' and lower(trim(o.banco)) in ('cresol','sicredi','banco do brasil'))
      or (c.nome ilike 'Edivan Langoski%' and lower(trim(o.banco)) = 'sicredi')
    )
), faltantes as (
  select a.* from alvo a
  left join public.cliente_banco_escopo e
    on e.cliente_id = a.cliente_id and lower(trim(e.banco)) = a.bk
  where e.id is null
), ins as (
  insert into public.cliente_banco_escopo (organizacao_id, cliente_id, banco, escopo, origem, observacao, definido_em)
  select organizacao_id, cliente_id, banco, 'contratado', 'decisao_willian',
         'marcado como contratado por decisão do Willian (sem processo no ADVBOX)', now()
  from faltantes
  returning organizacao_id, cliente_id, banco
)
insert into public.cliente_banco_escopo_historico
  (organizacao_id, cliente_id, banco, escopo_anterior, escopo_novo, origem, motivo)
select organizacao_id, cliente_id, banco, null, 'contratado', 'decisao_willian',
       'marcado como contratado por decisão do Willian (sem processo no ADVBOX)'
from ins;

-- 4) Edivan Langoski: 3 operações Sicredi que não são crédito rural
update public.operacoes_credito
   set dispensar_alerta = true,
       dispensa_motivo = 'não alongável - não é crédito rural'
 where deleted_at is null
   and numero in ('C40232103-7','C50231509-8','C50231510-1')
   and cliente_id = (select id from public.clientes where nome ilike 'Edivan Langoski%' limit 1);
