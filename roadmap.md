# Roadmap

## Concluído
- [x] Controladoria (DJEN + D-5): tabelas, funções, crons em sa-east-1, telas. Captura validada: 334 comunicações, 210 processos, 207 no ADVBOX, idempotente.
- [x] Assinaturas (ZapSign): tabelas assinatura_* com RLS interno, funções zapsign-enviar/sync/webhook/webhook-registrar, tela /assinaturas (Documentos, Novo envio, Configuração), botão na página do cliente, item no menu. Webhook testado com corpo simulado (401 sem segredo, externo idempotente com segredo). Sem POST /docs/ real nos testes.

- [x] Treinamentos: setores e membros × setores, trilhas/módulos/aulas/questionários, atribuição automática, avisos, painel, certificado, bucket privado (vídeo até 200 MB). Catálogo vazio. Assinaturas usam os setores novos.

## Aguardando o usuário
- [ ] Treinamentos parte 1 (nova especificação: trilhas/módulos markdown, progresso, painel Acompanhamento): aguardando escolha entre trocar, juntar ou descartar.
- [ ] Treinamentos parte 2 (Provas: 5 tabelas, 4 funções, link de candidato em /prova/:token, testes de segurança): depende da parte 1.
  - Complemento aprovado (aplicar junto com a parte 2): aviso de privacidade no rodapé da abertura da prova pública (quem coleta: Oliveira Advogados; finalidade: avaliação em processo seletivo; prazo de guarda; como pedir exclusão); campo `provas.retencao_dias` int not null default 180 e `prova_aplicacoes.anonimizada_em` timestamptz null; função de anonimização de candidatos além da retenção (apaga nome, e-mail e telefone, mantém nota e respostas, grava anonimizada_em), exposta como ação "Limpar dados antigos de candidatos" na tela de provas, sem cron; nenhum nome, e-mail ou telefone de candidato em log, console.log ou mensagem de erro da função pública.
- [ ] Marcar os setores e líderes da equipe em Treinamentos → Configuração.
- [ ] Carregar o conteúdo real das trilhas.
- [ ] Cadastrar o segredo ZAPSIGN_API_TOKEN (Project Settings → Secrets) — até lá a tela mostra "integração não configurada".
- [ ] Primeiro envio real: feito pelo próprio usuário, para si mesmo como cliente.
- [ ] Registrar o webhook: botão na aba Configuração (só admin), depois de cadastrar o token.

## Treinamentos, ajustes de 26/09
- [x] Player mostra "Prova de saída" no fim da aula
- [x] Editor de aula edita prova_de_saida
- [x] Conferir árvore de setores fixa em código (ler sempre da tabela)
- [x] Assinaturas: continuar funcionando se a consulta de setores falhar; manter setor gravado nos documentos antigos
- Não publicar trilhas (decisão do titular)

## Performance etapa 1
- [x] H. Cache de dados globais (membros, CEO, tipo de usuário, liderados, notificações, contador do menu) + portão leve dos Códigos dos Tribunais
- [ ] Futuro: paginação real com rolagem virtual nas listas grandes
- [ ] Futuro: frequência do registro de "última atividade" (30 s por usuário)
- [x] Índices das 71 FKs
- [x] 495 políticas com (select auth.uid()), diff validado
- [x] Pacote inicial 293 -> 171 KB gz
- [~] Teto 1.000 linhas: clientes e painéis feitos; faltam processos, vencimentos, tarefas, arquivos, assinaturas
- [ ] Contagens por papel (membro/admin/portal) antes/depois — psql restrito não troca de papel

## Etapa 1B (performance)
- [x] Pré-carregar código das telas (ocioso + passar o mouse no menu; respeita economia de dados/2g).
- [x] Resumo da OlivIA no Início aparece na hora (guardado por pessoa/dia no navegador, atualiza em segundo plano). Não usa IA: custo zero.
- [x] Consultas repetidas do Início com cache compartilhado (38 → 28 requisições).
- [ ] Aguardando decisão: tabela + cron 06h30 para o resumo da OlivIA (dispensável: a função não chama IA e responde em 0,5–1,5 s; pré-gerar no servidor exigiria ler dados sem as regras de acesso de cada pessoa).
- [ ] Aguardando aval do titular: reduzir registro de "última atividade" (heartbeat de user_sessions) de 30 s para 2 min.

## Importação ADVBOX (clientes e processos judiciais)
- [x] Passo 1: tabelas novas (processos_judiciais, relação com clientes, apelidos, execuções), marcador `base_historica_advbox`, distribuição automática ignora a base histórica. Portal não vê processos judiciais.
- [x] Passo 2: simulação dos clientes (relatório enviado)
- [ ] Aguardando resposta do usuário ao relatório: importação real dos clientes
- [ ] Processos judiciais + ligação das intimações
- [ ] Telas: cartão no cliente, lista no Jurídico, CPF pendente, duplicados; Workflow ignora base histórica
- [ ] Sincronização diária ADVBOX -> app

## Importação ADVBOX (set/2026)
- [x] Clientes importados (base histórica), processos judiciais, ligação de intimações, telas, sincronização diária 06:00.
- [ ] 9 homônimos do ADVBOX não importados (mesmo nome de outro cliente): aguardando decisão do titular.
- [ ] Apagar a tabela de foto `advbox_foto_clientes_antes` depois da revisão: aguardando aval.

## Controladoria: DataJud e Radar de clientes (set/2026)
- [x] B0 chave pública DataJud (secret DATAJUD_API_KEY)
- [x] B1 simulação 20 processos
- [~] B2 carga inicial + cron diário/semanal (05:00 BRT, a cada 10 min até 07:50)
- [x] B3 linha do tempo (clique no número) + aba "Movimentações novas"
- [x] A1 tabelas + função radar-clientes (só simulação e decisão)
- [ ] A2 aguardando calibração dos pesos pelo titular (avisos e rodada real desligados)
- [ ] A3 tela "Radar de clientes" (depois do A2)
