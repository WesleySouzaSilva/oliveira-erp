
ALTER TABLE public.clientes
ADD COLUMN vip boolean NOT NULL DEFAULT false,
ADD COLUMN status_adimplencia text NOT NULL DEFAULT 'adimplente';
