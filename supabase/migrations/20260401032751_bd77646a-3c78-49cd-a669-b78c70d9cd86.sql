
-- =============================================
-- P0: Performance indexes for 3000+ scale
-- =============================================

-- processos: queries by org, user, fase, laudo
CREATE INDEX IF NOT EXISTS idx_processos_org ON public.processos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_processos_user ON public.processos (user_id);
CREATE INDEX IF NOT EXISTS idx_processos_fase ON public.processos (fase_atual);
CREATE INDEX IF NOT EXISTS idx_processos_laudo ON public.processos (laudo_id);
CREATE INDEX IF NOT EXISTS idx_processos_created ON public.processos (created_at DESC);

-- laudos: queries by user, status
CREATE INDEX IF NOT EXISTS idx_laudos_user ON public.laudos (user_id);
CREATE INDEX IF NOT EXISTS idx_laudos_status ON public.laudos (status);
CREATE INDEX IF NOT EXISTS idx_laudos_created ON public.laudos (created_at DESC);

-- tarefas: queries by org, responsavel, concluida, processo
CREATE INDEX IF NOT EXISTS idx_tarefas_org ON public.tarefas (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON public.tarefas (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_concluida ON public.tarefas (concluida);
CREATE INDEX IF NOT EXISTS idx_tarefas_vencimento ON public.tarefas (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_processo ON public.tarefas (processo_id);

-- contratos_vencimentos: queries by user, resolvido, vencimento
CREATE INDEX IF NOT EXISTS idx_contratos_user ON public.contratos_vencimentos (user_id);
CREATE INDEX IF NOT EXISTS idx_contratos_resolvido ON public.contratos_vencimentos (resolvido);
CREATE INDEX IF NOT EXISTS idx_contratos_vencimento ON public.contratos_vencimentos (vencimento_proxima_parcela);
CREATE INDEX IF NOT EXISTS idx_contratos_nome_cliente ON public.contratos_vencimentos (nome_cliente);

-- clientes: queries by user, municipio
CREATE INDEX IF NOT EXISTS idx_clientes_user ON public.clientes (user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_municipio ON public.clientes (municipio);

-- membros: queries by user_id (RLS functions)
CREATE INDEX IF NOT EXISTS idx_membros_user ON public.membros (user_id);
CREATE INDEX IF NOT EXISTS idx_membros_org ON public.membros (organizacao_id);

-- atividades_clientes
CREATE INDEX IF NOT EXISTS idx_atividades_user ON public.atividades_clientes (user_id);
CREATE INDEX IF NOT EXISTS idx_atividades_nome ON public.atividades_clientes (nome_cliente);

-- movimentacoes
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo ON public.movimentacoes (processo_id);

-- notificacoes_sistema
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes_sistema (user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes_sistema (user_id, lida);

-- peticoes
CREATE INDEX IF NOT EXISTS idx_peticoes_user ON public.peticoes (user_id);
CREATE INDEX IF NOT EXISTS idx_peticoes_processo ON public.peticoes (processo_id);

-- tarefas_historico
CREATE INDEX IF NOT EXISTS idx_tarefas_hist_org ON public.tarefas_historico (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_hist_exec ON public.tarefas_historico (executado_por);
CREATE INDEX IF NOT EXISTS idx_tarefas_hist_data ON public.tarefas_historico (data_acao DESC);

-- arquivos_cliente
CREATE INDEX IF NOT EXISTS idx_arquivos_user ON public.arquivos_cliente (user_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_nome ON public.arquivos_cliente (nome_cliente);

-- documentos
CREATE INDEX IF NOT EXISTS idx_documentos_laudo ON public.documentos (laudo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_user ON public.documentos (user_id);

-- profiles: lider_id for coordinator queries
CREATE INDEX IF NOT EXISTS idx_profiles_lider ON public.profiles (lider_id);

-- comercial tables
CREATE INDEX IF NOT EXISTS idx_comercial_leads_org ON public.comercial_leads (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_comercial_leads_resp ON public.comercial_leads (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_comercial_leads_etapa ON public.comercial_leads (etapa_funil);
CREATE INDEX IF NOT EXISTS idx_comercial_ativ_org ON public.comercial_atividades (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_comercial_ativ_lead ON public.comercial_atividades (lead_id);
CREATE INDEX IF NOT EXISTS idx_comercial_metas_org ON public.comercial_metas (organizacao_id);

-- RH tables
CREATE INDEX IF NOT EXISTS idx_rh_contratos_membro ON public.rh_contratos (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_contratos_org ON public.rh_contratos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_docs_membro ON public.rh_documentos (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_docs_org ON public.rh_documentos (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_feedbacks_membro ON public.rh_feedbacks (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_feedbacks_org ON public.rh_feedbacks (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_metas_membro ON public.rh_metas (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_metas_org ON public.rh_metas (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_pdis_membro ON public.rh_pdis (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_pdis_org ON public.rh_pdis (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_salarios_membro ON public.rh_salarios (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_salarios_org ON public.rh_salarios (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_hist_membro ON public.rh_historico (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_hist_org ON public.rh_historico (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_rh_1on1_membro ON public.rh_reunioes_1on1 (membro_id);
CREATE INDEX IF NOT EXISTS idx_rh_1on1_org ON public.rh_reunioes_1on1 (organizacao_id);

-- Composite indexes for common RLS patterns
CREATE INDEX IF NOT EXISTS idx_membros_user_org ON public.membros (user_id, organizacao_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_org_resp ON public.tarefas (organizacao_id, responsavel_id);
CREATE INDEX IF NOT EXISTS idx_contratos_user_resolvido ON public.contratos_vencimentos (user_id, resolvido);
