create or replace function public.fn_operacao_herda_responsavel_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.responsavel is null or btrim(new.responsavel) = '')
     and new.grupo is not null and btrim(new.grupo) <> '' then
    select o.responsavel into new.responsavel
    from public.operacoes_credito o
    where btrim(lower(o.grupo)) = btrim(lower(new.grupo))
      and o.responsavel is not null and btrim(o.responsavel) <> ''
      and o.id is distinct from new.id
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.fn_operacao_herda_responsavel_grupo() from anon, public;

drop trigger if exists trg_operacao_herda_responsavel_grupo on public.operacoes_credito;
create trigger trg_operacao_herda_responsavel_grupo
before insert or update of grupo, responsavel on public.operacoes_credito
for each row execute function public.fn_operacao_herda_responsavel_grupo();