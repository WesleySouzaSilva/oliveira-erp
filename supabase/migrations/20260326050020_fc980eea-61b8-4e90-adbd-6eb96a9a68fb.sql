
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  cpf_cnpj text,
  rg text,
  orgao_emissor text,
  nacionalidade text DEFAULT 'Brasileira',
  estado_civil text,
  profissao text DEFAULT 'Produtor Rural',
  endereco text,
  municipio text,
  uf text,
  cep text,
  telefone text,
  email text,
  nome_propriedade text,
  area_hectares numeric,
  cultura_principal text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own clientes" ON public.clientes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR shares_org(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
