-- 0) marca de operação restaurada que ainda não pode gerar tarefa no ADVBOX
alter table public.operacoes_credito
  add column if not exists restaurada_conferir boolean not null default false;

-- 1) CEDULA REGISTRADA 238800301668 (Geison Polazzo / Santander): restaura uma cópia
update public.operacoes_credito set
  deleted_at = null,
  numero = '238800301668',
  vence_em = '2026-10-19',
  data_conferida = true,
  status_conferencia = 'radar',
  duplicata_status = null,
  duplicata_de = null,
  duplicata_motivo = null,
  restaurada_conferir = false,
  alteracao_motivo = 'restaurada da duplicata - cédula registrada 238800301668, vencimento 19/10/2026 conforme base do caso'
where id = '3eef4fcb-8009-4a05-9776-8e775d68d2e1';

update public.operacoes_credito set
  duplicata_de = '3eef4fcb-8009-4a05-9776-8e775d68d2e1',
  duplicata_status = 'confirmada',
  duplicata_motivo = 'cópia (2) da cédula 238800301668'
where id = 'fd321346-43b3-48b6-90d7-1977e2fdf610';

-- 2) 238800300785 (Girlei / Santander): data da base do caso, marcada como não conferida
update public.operacoes_credito set
  vence_em = '2028-04-27',
  data_conferida = false,
  status_conferencia = 'radar',
  alteracao_motivo = 'divergência: app tinha 15/08/2028; base do caso diz 27/04/2028 - conferir no aditamento',
  historico_motivo = 'divergência: app tinha 15/08/2028; base do caso diz 27/04/2028 - conferir no aditamento'
where id = '9a76f39a-7f65-4e7b-bf00-28ab5512c20b';

-- 3) 1636695 (Girlei / Sicoob): uma só operação, vencimento 15/11/2030
update public.operacoes_credito set
  vence_em = '2030-11-15',
  numero = '1636695',
  trecho = coalesce(trecho || ' | ', '') || 'também referenciada como 1217231 e 1205443 (mesma operação)',
  alteracao_motivo = 'mesma operação também referenciada como 1217231 e 1205443; vencimento 15/11/2030 conforme base do caso'
where id = 'b5cb2bab-04ea-4a5d-b3b7-b91640b99ec7';

-- 4) 238800301889 (Geison / Santander)
update public.operacoes_credito set vence_em = '2026-08-12'
where id = '034717f7-47a6-404f-bf7f-b9a018a0b73f';

-- 5) cancelamento de débito automático 139231850: não é operação bancária
update public.operacoes_credito set
  nao_bancaria = true,
  dispensar_alerta = true,
  dispensa_motivo = 'não é operação bancária',
  duplicata_status = 'descartada',
  duplicata_de = null,
  alteracao_motivo = 'não é operação bancária - cancelamento de débito automático'
where id = '0574e394-4c98-4b09-92a8-ec7727c51ee1';

-- 6) restaura as arquivadas por duplicata que não têm gêmea ativa
with ativ as (
  select regexp_replace(coalesce(numero,''),'\D','','g') as dig
  from public.operacoes_credito where deleted_at is null
)
update public.operacoes_credito a set
  deleted_at = null,
  duplicata_status = null,
  duplicata_de = null,
  duplicata_motivo = null,
  restaurada_conferir = true,
  status_conferencia = case when a.vence_em is null then 'sem_vencimento' else 'radar' end,
  data_conferida = false,
  alteracao_motivo = 'restaurada - conferir'
where a.deleted_at is not null
  and a.alteracao_motivo = 'cópia do mesmo documento na varredura'
  and not exists (
    select 1 from ativ v
    where length(regexp_replace(coalesce(a.numero,''),'\D','','g')) > 0
      and v.dig = regexp_replace(a.numero,'\D','','g')
  )
  and not exists (
    select 1 from ativ v
    where length(v.dig) >= 5 and a.origem_arquivo ilike '%'||v.dig||'%'
  );