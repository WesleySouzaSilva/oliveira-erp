
CREATE TABLE public.contratos_vencimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_cliente text NOT NULL,
  banco text,
  numero_contrato text,
  vencimento_proxima_parcela date,
  valor_parcela numeric(15,2),
  valor_total_operacao numeric(15,2),
  parcelas_vencidas boolean DEFAULT false,
  possui_laudo boolean DEFAULT false,
  laudo_id uuid REFERENCES public.laudos(id),
  data_limite_protocolo text,
  protocolo_realizado boolean DEFAULT false,
  data_notificacao date,
  canal_notificacao text,
  responsavel_gestao text,
  status_prazo text DEFAULT 'pendente',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_vencimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contratos" ON public.contratos_vencimentos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contratos" ON public.contratos_vencimentos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contratos" ON public.contratos_vencimentos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contratos" ON public.contratos_vencimentos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_contratos_vencimentos_updated_at
  BEFORE UPDATE ON public.contratos_vencimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
