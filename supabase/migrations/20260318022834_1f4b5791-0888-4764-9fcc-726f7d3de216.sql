
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('agronomo', 'advogado', 'admin');

-- Enum for laudo status
CREATE TYPE public.laudo_status AS ENUM ('rascunho', 'analise', 'finalizado', 'exportado');

-- Enum for processo phase
CREATE TYPE public.fase_processo AS ENUM ('1', '2', '3', '4', '5');

-- Enum for phase status
CREATE TYPE public.status_fase AS ENUM ('pendente', 'em_andamento', 'concluida', 'bloqueada');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===================== PROFILES =====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  crea_numero TEXT,
  crea_uf TEXT,
  especialidade TEXT,
  cidade TEXT,
  uf TEXT,
  telefone TEXT,
  assinatura_url TEXT,
  plano TEXT NOT NULL DEFAULT 'gratuito',
  laudos_mes_atual INTEGER NOT NULL DEFAULT 0,
  onboarding_completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===================== ORGANIZACOES =====================
CREATE TABLE public.organizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  oab_uf TEXT,
  oab_numero TEXT,
  endereco TEXT,
  logo_url TEXT,
  plano TEXT NOT NULL DEFAULT 'gratuito',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;

-- ===================== MEMBROS =====================
CREATE TABLE public.membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel app_role NOT NULL DEFAULT 'agronomo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organizacao_id, user_id)
);

ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

-- Security definer function to check org membership
CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organizacao_id FROM public.membros WHERE user_id = _user_id;
$$;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE user_id = _user_id AND papel = _role
  );
$$;

CREATE POLICY "Members can view own org" ON public.organizacoes
  FOR SELECT USING (id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can update org" ON public.organizacoes
  FOR UPDATE USING (id IN (SELECT public.user_org_ids(auth.uid())) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view membros of own org" ON public.membros
  FOR SELECT USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Admins can manage membros" ON public.membros
  FOR ALL USING (organizacao_id IN (SELECT public.user_org_ids(auth.uid())) AND public.has_role(auth.uid(), 'admin'));

-- ===================== LAUDOS =====================
CREATE TABLE public.laudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_laudo TEXT NOT NULL,
  status laudo_status NOT NULL DEFAULT 'rascunho',
  dados_etapa1 JSONB DEFAULT '{}',
  dados_etapa2 JSONB DEFAULT '{}',
  dados_etapa3 JSONB DEFAULT '{}',
  dados_etapa4 JSONB DEFAULT '{}',
  dados_etapa5 JSONB DEFAULT '{}',
  dados_etapa6 JSONB DEFAULT '{}',
  hipoteses_selecionadas TEXT[] DEFAULT '{}',
  texto_analise_narrativa TEXT,
  texto_conclusao TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.laudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own laudos" ON public.laudos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own laudos" ON public.laudos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own laudos" ON public.laudos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own laudos" ON public.laudos
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_laudos_updated_at
  BEFORE UPDATE ON public.laudos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== DOCUMENTOS =====================
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laudo_id UUID NOT NULL REFERENCES public.laudos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  categoria TEXT,
  storage_path TEXT NOT NULL,
  tamanho_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own docs" ON public.documentos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own docs" ON public.documentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own docs" ON public.documentos
  FOR DELETE USING (auth.uid() = user_id);

-- ===================== ANALISES_IA =====================
CREATE TABLE public.analises_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laudo_id UUID NOT NULL REFERENCES public.laudos(id) ON DELETE CASCADE,
  resultado JSONB NOT NULL DEFAULT '{}',
  tokens_usados INTEGER DEFAULT 0,
  modelo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analises_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.analises_ia
  FOR SELECT USING (
    laudo_id IN (SELECT id FROM public.laudos WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can create analyses for own laudos" ON public.analises_ia
  FOR INSERT WITH CHECK (
    laudo_id IN (SELECT id FROM public.laudos WHERE user_id = auth.uid())
  );

-- ===================== PROCESSOS =====================
CREATE TABLE public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laudo_id UUID NOT NULL REFERENCES public.laudos(id) ON DELETE CASCADE,
  organizacao_id UUID REFERENCES public.organizacoes(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fase_atual fase_processo NOT NULL DEFAULT '1',
  status_fases JSONB NOT NULL DEFAULT '{"1":"em_andamento","2":"pendente","3":"pendente","4":"bloqueada","5":"pendente"}',
  datas_fases JSONB NOT NULL DEFAULT '{}',
  responsavel_juridico_id UUID REFERENCES auth.users(id),
  dados_fase2 JSONB DEFAULT '{}',
  dados_fase3 JSONB DEFAULT '{}',
  dados_fase4 JSONB DEFAULT '{}',
  dados_fase5 JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processos" ON public.processos
  FOR SELECT USING (auth.uid() = user_id OR organizacao_id IN (SELECT public.user_org_ids(auth.uid())));
CREATE POLICY "Users can create processos" ON public.processos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own processos" ON public.processos
  FOR UPDATE USING (auth.uid() = user_id OR organizacao_id IN (SELECT public.user_org_ids(auth.uid())));

CREATE TRIGGER update_processos_updated_at
  BEFORE UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== MOVIMENTACOES =====================
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  fase fase_processo NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  documento_url TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view movimentacoes of own processos" ON public.movimentacoes
  FOR SELECT USING (
    processo_id IN (SELECT id FROM public.processos WHERE user_id = auth.uid() OR organizacao_id IN (SELECT public.user_org_ids(auth.uid())))
  );
CREATE POLICY "Users can create movimentacoes" ON public.movimentacoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===================== DADOS_CLIMATICOS =====================
CREATE TABLE public.dados_climaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laudo_id UUID NOT NULL REFERENCES public.laudos(id) ON DELETE CASCADE,
  estacao_codigo TEXT,
  estacao_nome TEXT,
  municipio TEXT,
  uf TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dados_climaticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dados_climaticos" ON public.dados_climaticos
  FOR SELECT USING (
    laudo_id IN (SELECT id FROM public.laudos WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can create dados_climaticos" ON public.dados_climaticos
  FOR INSERT WITH CHECK (
    laudo_id IN (SELECT id FROM public.laudos WHERE user_id = auth.uid())
  );

-- ===================== TEMPLATES_CONCLUSAO =====================
CREATE TABLE public.templates_conclusao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  hipotese_mcr CHAR(1),
  conteudo TEXT NOT NULL,
  is_sistema BOOLEAN NOT NULL DEFAULT false,
  is_favorito BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates_conclusao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system templates and own" ON public.templates_conclusao
  FOR SELECT USING (is_sistema = true OR auth.uid() = user_id);
CREATE POLICY "Users can create own templates" ON public.templates_conclusao
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_sistema = false);
CREATE POLICY "Users can update own templates" ON public.templates_conclusao
  FOR UPDATE USING (auth.uid() = user_id AND is_sistema = false);
CREATE POLICY "Users can delete own templates" ON public.templates_conclusao
  FOR DELETE USING (auth.uid() = user_id AND is_sistema = false);

-- ===================== NOTIFICACOES_SISTEMA =====================
CREATE TABLE public.notificacoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notificacoes_sistema
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notificacoes_sistema
  FOR UPDATE USING (auth.uid() = user_id);

-- ===================== STORAGE BUCKETS =====================
INSERT INTO storage.buckets (id, name, public) VALUES ('laudos', 'laudos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('assinaturas', 'assinaturas', false);

CREATE POLICY "Users can upload to own laudo folder" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'laudos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own laudo files" ON storage.objects
  FOR SELECT USING (bucket_id = 'laudos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own laudo files" ON storage.objects
  FOR DELETE USING (bucket_id = 'laudos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own signature" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'assinaturas' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own signature" ON storage.objects
  FOR SELECT USING (bucket_id = 'assinaturas' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own signature" ON storage.objects
  FOR UPDATE USING (bucket_id = 'assinaturas' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Insert system templates
INSERT INTO public.templates_conclusao (nome, hipotese_mcr, conteudo, is_sistema) VALUES
  ('Frustração de safra por evento climático', 'b', 'Diante do exposto, conclui-se que o mutuário foi acometido por evento climático adverso que resultou em frustração de safra, enquadrando-se na hipótese prevista na alínea "b" do MCR 2.6.4, conforme Resolução CMN nº 4.883/2020. A produtividade obtida ficou significativamente abaixo da expectativa contratual, demonstrando a impossibilidade de cumprimento das obrigações financeiras no prazo originalmente pactuado. Nos termos da Súmula 298 do STJ, o alongamento constitui direito subjetivo do produtor rural quando preenchidos os requisitos legais.', true),
  ('Dificuldade de comercialização', 'a', 'Diante do exposto, resta demonstrado que o mutuário enfrentou dificuldade de comercialização dos produtos agropecuários, configurando a hipótese prevista na alínea "a" do MCR 2.6.4. A diferença entre o preço de mercado esperado e o efetivamente obtido comprova o prejuízo financeiro que inviabiliza o pagamento nos termos originais do contrato. O alongamento da dívida é medida que se impõe nos termos da legislação vigente.', true),
  ('Ocorrência prejudicial (praga/doença)', 'c', 'Diante do exposto, conclui-se que ocorrências prejudiciais ao desenvolvimento da exploração agropecuária, conforme alínea "c" do MCR 2.6.4, comprometeram a capacidade produtiva e financeira do mutuário. As perdas documentadas justificam tecnicamente o pedido de prorrogação da dívida rural.', true),
  ('Dificuldades acumuladas de fluxo de caixa', 'd', 'Diante do exposto, verifica-se que o mutuário acumula perdas em safras consecutivas que comprometem severamente seu fluxo de caixa, configurando a hipótese da alínea "d" do MCR 2.6.4. O endividamento acumulado no SNCR demonstra a necessidade de prorrogação para viabilizar a recuperação econômica da atividade rural.', true);
