ALTER TYPE public.laudo_status ADD VALUE IF NOT EXISTS 'revisao' BEFORE 'finalizado';
ALTER TYPE public.laudo_status ADD VALUE IF NOT EXISTS 'retificacao' AFTER 'finalizado';