-- Apaga as credenciais que ficaram apenas desativadas.
--
-- A versão anterior de "remover" fazia soft delete (ativo = false) para não
-- perder o histórico. Era desnecessário: tj_auditoria não referencia
-- tj_credenciais e guarda credencial_nome como texto, justamente para
-- sobreviver à remoção. O efeito colateral foi ruim — a restrição
-- UNIQUE (organizacao_id, nome) mantinha o nome ocupado, e recadastrar o mesmo
-- tribunal passava a falhar com erro de banco.
--
-- Estas linhas não são alcançáveis pela interface (a listagem só traz ativas),
-- então não há como removê-las a não ser aqui. O histórico delas permanece.

DELETE FROM public.tj_credenciais WHERE ativo = false;
