DELETE FROM public.conversas WHERE titulo = '__STRESS__';
DELETE FROM public.notificacoes_sistema 
  WHERE tipo='mencao_mensagem' 
    AND mensagem LIKE '%mencionou você: msg %';