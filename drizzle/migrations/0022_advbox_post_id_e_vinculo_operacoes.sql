-- 1) Controle do número real da tarefa no ADVBOX e aviso de data antiga
alter table public.advbox_tarefas_criadas
  add column if not exists post_id_pendente boolean not null default false,
  add column if not exists data_desatualizada boolean not null default false,
  add column if not exists data_desatualizada_em timestamptz,
  add column if not exists data_nova date;

-- 2) Vínculo de operações sem titular
alter table public.operacoes_credito
  add column if not exists vinculo_adiado_em timestamptz,
  add column if not exists nao_bancaria boolean not null default false;

-- 3) Quando o vencimento muda depois da tarefa criada, marcar a tarefa como desatualizada
create or replace function public.fn_operacao_data_alterada_avisa_advbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vence_em is distinct from old.vence_em then
    update public.advbox_tarefas_criadas
       set data_desatualizada = true,
           data_desatualizada_em = now(),
           data_nova = new.vence_em
     where operacao_id = new.id
       and coalesce(data_desatualizada, false) = false;
  end if;
  return new;
end;
$$;

revoke all on function public.fn_operacao_data_alterada_avisa_advbox() from public, anon;

drop trigger if exists trg_operacao_data_alterada on public.operacoes_credito;
create trigger trg_operacao_data_alterada
after update of vence_em on public.operacoes_credito
for each row execute function public.fn_operacao_data_alterada_avisa_advbox();