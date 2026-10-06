
create or replace function public.fn_radar_regra_historico()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int; m int;
begin
  update public.operacoes_credito
     set status_conferencia = 'historico'
   where status_conferencia = 'radar'
     and vence_em is not null
     and vence_em < current_date - 90
     and notificado_em is null
     and dispensar_alerta = false;
  get diagnostics n = row_count;

  update public.operacoes_credito
     set status_conferencia = 'radar'
   where status_conferencia = 'historico'
     and vence_em is not null
     and vence_em >= current_date - 90
     and notificado_em is null
     and dispensar_alerta = false;
  get diagnostics m = row_count;

  return n + m;
end;
$$;

revoke all on function public.fn_radar_regra_historico() from public, anon;
grant execute on function public.fn_radar_regra_historico() to service_role;

select public.fn_radar_regra_historico();

select cron.unschedule('radar-regra-historico')
where exists (select 1 from cron.job where jobname = 'radar-regra-historico');

select cron.schedule('radar-regra-historico', '10 3 * * *', $$select public.fn_radar_regra_historico();$$);
