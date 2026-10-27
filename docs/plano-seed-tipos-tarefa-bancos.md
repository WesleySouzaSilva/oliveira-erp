# Plano — Seed Flyway: tipos de tarefa (ADVBOX) e bancos (fonte)

> **Status:** aprovado e aplicado (titular) — 23/10/2026 — V23 gerada a partir de
> `docs/lista-v23-para-edicao.md` (lista editada e aprovada: 235 tipos + 17 bancos, nada
> removido), tipos gravados em MAIUSCULAS a pedido do titular; validada no banco local
> (V22+V23 aplicadas: 470 tipos / 34 bancos, org sem membro pulada) e na suíte da API.
> **Origem:** pedido do titular 23/10: "veja os dados que temos nos fontes de tipos de
> tarefas, tipos de bancos, se é no código fonte ou se é no advbox, vamos criar a lista
> que temos para importar via flyway no nosso projeto, verifique, me envie para validar".

---

## 1. Onde está cada lista (verificado nos fontes)

### Tipos de tarefa — estão NO ADVBOX, não no código

- O ADVBOX expõe a lista em `GET https://app.advbox.com.br/api/v1/settings` — o
  comentário do sync diz na cara: "returns the ADVBOX account settings payload as-is
  (users, **task types**, lawsuit types/groups, stages, customer origins...)"
  (`fontes-sistema-antigo/supabase/functions/advbox-sync/index.ts:277-283`). O token é
  o segredo da nuvem `ADVBOX_API_TOKEN` (Advbox › Configurações › API) — não existe
  nesta máquina.
- **Cópia local da lista:** as capturas da tela do ADVBOX que já estão no repo
  (`docs/exemplo-quadro-tarefas.html` e `docs/exemplo-detalhado-tarefa.html`) trazem o
  select `name="tasks_id"` ("Tipo de tarefa") com as opções. As duas capturas são
  **idênticas**: 241 opções = "Selecione" + **240 tipos**, que viram **235 únicos**
  (5 nomes aparecem 2× com IDs diferentes no ADVBOX — ver D1).
- No sistema antigo (Supabase legado) **não existe** tipo de tarefa: a tabela
  `public.tarefas` só tem `titulo` (`supabase/migrations/20260319200100...sql:3-15`) e a
  tela de tarefas do fonte (`src/pages/Tarefas.tsx`) não tem seletor de tipo — grep não
  acha nada.
- No nosso ERP a tabela `tarefa_tipos` já existe desde a **V21** e está **vazia** (0
  linhas no banco local).

### Bancos — estão NO CÓDIGO FONTE, não no ADVBOX

- Lista fixa do combo de contrato, idêntica em 3 arquivos do fonte:
  `src/components/EditClienteDialog.tsx:11-16`, `src/pages/NovoCliente.tsx:21-26`,
  `src/components/laudo/EtapaIdentificacao.tsx:21-26` — **17 nomes + "Outro"**.
- No ADVBOX não há cadastro de bancos estruturado para o form: os bancos do legado
  chegam como **texto** nas operações de crédito (o sync lê `operacoes_credito.banco`
  como string, `advbox-sync/index.ts:433`) e como nome digitado. O "Outro" do combo é
  a própria saída de texto livre.
- No nosso ERP a tabela `bancos` nasceu na **V22** (ainda pendente no banco local —
  aplicada no próximo boot) e também está sem seed.

---

## 2. Tipos de tarefa — lista do ADVBOX (235, ordem do ADVBOX preservada)

 1. Intimações Judiciais
 2. Pauta de audiências
 3. RECADO/RESPOSTAS
 4. 1º CONTATO COM O LEAD
 5. ABERTURA DE DIT PERANTE A FAZENDA ESTADUAL
 6. AÇÃO FILIAÇÃO SOCIOAFETIVA
 7. ACOMPANHAR AJG
 8. ACOMPANHAR CITAÇÃO
 9. ACOMPANHAR CLIENTE
10. ACOMPANHAR CUMPRIMENTO DE ACORDO
11. ACOMPANHAR DECISÃO/ACÓRDÃO
12. ACOMPANHAR DECISÃO/DESPACHO
13. ACOMPANHAR HABILITAÇÃO NO PROCESSO
14. ACOMPANHAR MANIFESTAÇÃO PARTE CONTRÁRIA
15. ACOMPANHAR PAGAMENTO
16. ACOMPANHAR PAGAMENTO DE CUSTAS
17. ACOMPANHAR PERÍCIA
18. ACOMPANHAR PROCESSO ADMINISTRATIVO
19. ACOMPANHAR TRÂNSITO EM JULGADO
20. AGENDAR REUNIÃO COM ADVOGADO
21. AGRAVO DE INSTRUMENTO
22. AGRAVO DE PETIÇÃO
23. AGRAVO EM RECURSO ESPECIAL
24. AGRAVO EM RECURSO EXTRAORDINÁRIO
25. AGRAVO INTERNO
26. AGUARDANDO DOCUMENTOS CLIENTE
27. AGUARDANDO DOCUMENTOS PARCEIRO
28. AGUARDAR E-MAIL DE RESPOSTA DO BANCO
29. ALEGAÇÕES FINAIS - NICHOS
30. ALEGAÇÕES FINAIS COMPLEXAS
31. ALEGAÇÕES FINAIS SIMPLES
32. ALEGAÇÕES FINAIS TRABALHISTAS
33. ANALISAR ATA DE AUDIÊNCIA
34. ANÁLISE DE ACÓRDÃO/DECISÃO
35. ANÁLISE DE CASO DO PARCEIRO
36. ANÁLISE DE DECISÃO/SENTENÇA
37. ANÁLISE DE PROPOSTA DE ACORDO
38. ANÁLISE DE PROPOSTA DE ACORDO COMPLEXA
39. ANÁLISE DO CASO
40. ATENDER NOVA DEMANDA DO PARCEIRO
41. ATENDER NOVO CLIENTE
42. ATENDIMENTO AO CLIENTE - EXTERNO
43. ATENDIMENTO AO CLIENTE - INTERNO
44. ATRIBUIR E-MAIL/NOTA DE EXPEDIENTE E TAREFA
45. AUDIÊNCIA DE CONCILIAÇÃO
46. AUDIÊNCIA DE INSTRUÇÃO/JULGAMENTO
47. AUDIÊNCIA DE INSTRUÇÃO/JULGAMENTO - SEM TESTEMUNHAS
48. AUDIÊNCIA DE INTERROGATÓRIO
49. AUDIÊNCIA DE MEDIAÇÃO
50. AUDIÊNCIA UNA
51. AVALIAR DOCUMENTAÇÃO PROBATÓRIA
52. AVISAR CLIENTE DA AUDIÊNCIA
53. AVISAR CLIENTE DA DATA DA SUSTENTAÇÃO ORAL
54. AVISAR CLIENTE DA PERÍCIA
55. BUSCAR INFORMAÇÕES EM ÓRGÃO PÚBLICO
56. CARGA DE PROCESSO
57. COBRAR HONORÁRIOS/ENVIAR BOLETO
58. COBRAR/RELEMBRAR CUSTAS PROCESSUAIS
59. COLETA DE PROVAS
60. COMENTÁRIO NO GOOGLE
61. COMPRAR MATERIAL PARA O ESCRITÓRIO
62. CONEXÃO FEITA
63. CONFERIR CÁLCULO DO PERITO/DA PARTE
64. CONFERIR RECEBIMENTO DE HONORÁRIOS SUCUMBENCIAIS
65. CONFERIR/REVISAR PETIÇÃO
66. CONTESTAÇÃO - NICHOS
67. CONTESTAÇÃO COM MODELO
68. CONTESTAÇÃO COMPLEXA
69. CONTESTAÇÃO SEM MODELO
70. CONTESTAÇÃO TRABALHISTA
71. CONTRATAÇÃO DE LAUDO
72. CONTRATAR CORRESPONDENTE/PARCEIRO
73. CORREÇÃO DE INICIAL
74. CORREÇÃO PEDIDO ADMINISTRATIVO
75. CUMPRIMENTO DE EXIGÊNCIAS
76. DAR PALESTRA EM EVENTO
77. DEFESA PRÉVIA
78. DESPACHO COM JUIZ
79. DESPACHO COM O DESEMBARGADOR
80. DESPACHO COM O MINISTRO
81. DESPACHO/PROTOCOLO NO CARTÓRIO
82. DEVOLUÇÃO DE DOCUMENTOS/PROCESSO
83. DIGILITALIZAÇÃO DE DOCUMENTOS
84. DILIGÊNCIA EM CARTÓRIO
85. EDIÇÃO DE ARTE PARA REDE SOCIAL
86. EFETUAR PAGAMENTO
87. ELABORAR CÁLCULO SIMPLES
88. ELABORAR CONTRARRAZÕES
89. ELABORAR DECLARAÇÕES FINAIS
90. ELABORAR DECLARAÇÕES INICIAIS
91. ELABORAR ESBOÇO DE PARTILHA
92. ELABORAR NOTIFICAÇÃO EXTRAJUDICIAL
93. ELABORAR PETIÇÃO COMPLEXA
94. ELABORAR PETIÇÃO DE ACORDO
95. ELABORAR PETIÇÃO DE CUMPRIMENTO DE SENTENÇA
96. ELABORAR PETIÇÃO DE EXECUÇÃO
97. ELABORAR PETIÇÃO DE LIQUIDAÇÃO (TRABALHISTA)
98. ELABORAR PETIÇÃO DE LIQUIDAÇÃO DE SENTENÇA
99. ELABORAR PETIÇÃO INICIAL COM MODELO
100. ELABORAR PETIÇÃO INICIAL SEM MODELO
101. ELABORAR PLANO DE CARTILHA
102. ELABORAR PROPOSTA DE ACORDO
103. ELABORAR QUESITOS
104. ELABORAR RECURSO ADMINISTRATIVO - COMPLEXO
105. ELABORAR RECURSO ADMINISTRATIVO (TRÂNSITO)
106. ELABORAR RECURSO INOMINADO (AIC/TRÂNSITO)
107. ELABORAR RELATÓRIO PROCESSUAL
108. ELABORAR REQUERIMENTO ADMINSITRATIVO
109. ELABORAR RESCISÃO DE CONTRATO
110. ELABORAR RESUMO DA DECISÃO PARA O INSS
111. EMBARGOS À EXECUÇÃO
112. EMBARGOS À EXECUÇÃO/PENHORA
113. EMBARGOS À MONITÓRIA
114. EMBARGOS DE DECLARAÇÃO
115. EMBARGOS INFRINGENTES
116. EMENDA À INICIAL
117. EMENDA À INICIAL - JUNTADA DE DOCUMENTOS
118. EMENDA À INICIAL - TRÂNSITO E NICHOS
119. EMISSÃO DE PARECER
120. EMITIR BOLETO
121. EMITIR BOLETO DE DEPÓSITO JUDICIAL
122. EMITIR CONTRATO DE HONORÁRIOS
123. EMITIR CUSTAS/DEPÓSITO RECURSAL
124. ENCAMINHAR PARA LAUDO - ENGENHEIRO
125. ENTRAR EM CONTATO COM O CLIENTE
126. ENTREGA DE DOCUMENTOS
127. ENTREGAR CARTA DE CONVITE PARA TESTEMUNHA
128. ENTREGAR GUIA DO ITCD PARA O INVENTARIANTE
129. ENVIAR CUSTAS AO CLIENTE
130. ENVIAR E-MAIL COM PEDIDO DE ALONGAMENTO
131. ESCREVER ARTIGO
132. ESPECIFICAÇÃO DE PROVAS
133. EXCEÇÃO DE PRÉ EXECUTIVIDADE
134. EXPEDIÇÃO DE ALVARÁ
135. EXPEDIR CERTIDÕES
136. FAZER ADMISSÃO DE COLABORADOR
137. FAZER ALTERAÇÕES REQUERIDAS PELA FAZENDA
138. FAZER DEMISSÃO DE COLABORADOR
139. FAZER ENTREVISTA DE COLABORADOR
140. FAZER O BRIEFING
141. FAZER RELATÓRIO DE COMISSÃO MENSAL DO PARCEIRO
142. FECHAMENTO COM COBRANÇA INICIAIS
143. FECHAMENTO COM HONORÁRIOS RECORRENTES
144. FECHAMENTO SEM COBRANÇA INICIAIS
145. GERAR BOLETO DE CUSTAS RECURSAIS
146. GERAR PROCURAÇÃO
147. GERENCIAR ANÚNCIOS DO ESCRITÓRIO SEMANAL
148. HABILITAÇÃO NO PROCESSO
149. IMPUGNAÇÃO À CÁLCULOS
150. IMPUGNAÇÃO À CONTESTAÇÃO - NICHOS
151. IMPUGNAÇÃO À PENHORA
152. IMPUGNAÇÃO AO CÁLCULO
153. IMPUGNAÇÃO AO CUMPRIMENTO DE SENTENÇA
154. IMPUGNAÇÃO AO IDPJ
155. IMPUGNAÇÃO DE DOCUMENTOS
156. INFORMAR CLIENTE DA SENTENÇA RECURSAL
157. INFORMAR CLIENTE DO ANDAMENTO DO PROCESSO
158. INFORMAR CLIENTE DO ANDAMENTO DO RECURSO
159. INFORMAR O CLIENTE DA DECISÃO
160. INTIMAÇÃO INSS PARA IMPLANTAR BENEFÍCIO
161. INVESTIGAÇÃO PRIVADA
162. IR AO BANCO
163. LEVANTAMENTO DE ALVARÁ
164. LEVANTAMENTO DE RPV
165. LIGAÇÃO AO CLIENTE
166. LIGAR PARA A PARTE CONTRÁRIA/ADVOGADO
167. LIMPEZA DO ESCRITÓRIO
168. NEGOCIAR CONTRATO DE PARCERIA
169. OBTER PROVA
170. OPORTUNIDADE GERADA
171. OPORTUNIDADE PERDIDA
172. ORGANIZAR AGENDAS
173. ORGANIZAR CONTAS A PAGAR
174. ORGANIZAR DOCUMENTOS
175. PAGAMENTO DE BOLETOS
176. PAGAR CONTAS INTERNET BANKING
177. PAGAR PARCEIROS
178. PAGAR SALÁRIO
179. PAGAR/REPASSAR VALOR PARA CLIENTE
180. PARTICIPAR DE EVENTO
181. PEDIDO ADMINISTRATIVO - ALONGAMENTOO
182. PEDIDO DE PRAZO
183. PETIÇÃO INICIAL - AIC/TRÂNSITO - EXCETO RENÚNCIA DE PROPRIEDADE
184. PETIÇÃO INICIAL COMPLEXA
185. PETIÇÃO INTERMEDIÁRIA
186. PETIÇÃO/PROTOCOLO INTERMEDIÁRIO
187. PETICIONAMENTO DE ALONGAMENTO COMPULSÓRIO
188. PRAZO SIMPLES
189. PREPARAR SUSTENTAÇÃO ORAL
190. PREPARAR TESTEMUNHAS
191. PROCESSO GANHO
192. PROCESSO PERDIDO
193. PROTESTO ANTI PRECLUSIVO
194. PROTOCOLO INTERMEDIÁRIO
195. PROTOCOLO INTERMEDIÁRIO JUDICIAL
196. PROTOCOLO JUDICIAL
197. PROTOCOLO JUDICIAL (AIC)
198. PROTOCOLO JUDICIAL RURAL
199. PROTOCOLO REQUERIMENTO
200. PROTOCOLO/ENVIO CORREIOS
201. REALIZAR DISTRATO
202. RECOLHER CUSTAS
203. RECURSO DE APELAÇÃO
204. RECURSO DE APELAÇÃO/ORDINÁRIO - NICHOS
205. RECURSO DE REVISTA
206. RECURSO ESPECIAL
207. RECURSO EXTRAORDINÁRIO
208. RECURSO INOMINADO (JUIZADO)
209. RECURSO ORDINÁRIO
210. RELATÓRIO DE AUDIÊNCIA
211. RELATÓRIO FINANCEIRO MENSAL
212. RENÚNCIA DE MANDATO
213. RÉPLICA/IMPUGNAÇÃO À CONTESTAÇÃO
214. RÉPLICA/IMPUGNAÇÃO À CONTESTAÇÃO - AIC/TRÂNSITO (EXCETO RENÚNCIA DE PROPRIEDADE)
215. REQUISIÇÃO JUDICIAL DE TESTEMUNHA
216. RESPONDER DÚVIDAS DO CLIENTE
217. RESPOSTA À ACUSAÇÃO (RA)
218. RESPOSTA AO CONSUMIDOR.GOV
219. REUNIÃO - DÚVIDAS
220. REUNIÃO - HIGH TICKET
221. REUNIÃO - ONBOARDING
222. REUNIÃO COM PARCEIRO
223. REUNIÃO DE ENCERRAMENTO
224. REVOGAÇÃO DE MANDATO
225. SAQUE DOS HONORÁRIOS NO BANCO
226. SOLICITAR DESISTÊNCIA
227. SOLICITAR DOCUMENTOS
228. SOLICITAR INFORMAÇÕES DO CLIENTE
229. SOLICITAR REEMBOLSO PARA O CLIENTE
230. SUSTENTAÇÃO ORAL TRT TRF TJ
231. SUSTENTAÇÃO ORAL TST STJ STF
232. TENTAR ACORDO EXTRAJUDICIAL
233. VER SE TEM CAFÉ ATRAVÉS DE TELEPATIA
234. VIDEOCHAMADA OU LIGAÇÃO +30MIN
235. VISITAR POSSÍVEIS CLIENTES

Observações da validação:
- Os 3 primeiros (Intimações Judiciais, Pauta de audiências, RECADO/RESPOSTAS) vêm
  primeiro na captura — provavelmente os mais usados; a ordem aqui é a ordem do
  ADVBOX, mas o seletor do ERP ordena por cadastro.
- Um item é zoeira do ADVBOX: **"VER SE TEM CAFÉ ATRAVÉS DE TELEPATIA"** (linha 234) —
  está na lista verbatim; se quiser tirar, é só dizer (D1).

---

## 3. Bancos — lista do fonte (17)

 1. Banco do Brasil
 2. Caixa Econômica Federal
 3. Bradesco
 4. Itaú
 5. Santander
 6. Sicoob
 7. Sicredi
 8. Cresol
 9. Banrisul
10. BNB
11. BASA
12. BNDES
13. Banco Safra
14. Banco CNH
15. BTG Pactual
16. ABC Brasil
17. Rabobank

- **"Outro" não entra**: é a saída de texto livre do form (nosso front já a mantém
  como sentinel separado — um banco cadastrado chamado "Outro" não colide).
- Observação: o ADVBOX também tem `BANCOS_GENERICOS = [cresol, sicredi, sicoob,
  unicred, cresol baser, sistema cresol]` (`advbox-sync/index.ts:86`) — mas é a lista
  de NOMES GENÉRICOS que o sync BLOQUEIA (tem que abrir processo na cooperativa
  singular), não é cadastro; **Unicred** por isso não aparece no combo do fonte —
  manter assim (D3).

---

## 4. Migração proposta — `V23__seed_tipos_tarefa_e_bancos.sql`

```sql
-- =============================================================================
-- V23 — Seed das listas de TIPOS DE TAREFA (origem: ADVBOX) e BANCOS (origem:
--       codigo-fonte do sistema antigo) — pedido do titular 23/10/2026
--
-- LISTA-ONTE: oliveira-erp/docs/lista-v23-para-edicao.md (editada e aprovada
-- pelo titular — 235 tipos + 17 bancos, nada removido).
--
-- De onde vem cada lista (verificado nos fontes; detalhe em
-- oliveira-erp/docs/plano-seed-tipos-tarefa-bancos.md):
--   * tarefa_tipos: lista de "Tipo de tarefa" do ADVBOX — captura da tela em
--     docs/exemplo-quadro-tarefas.html (select "tasks_id"; 240 no ADVBOX, 5
--     nomes repetidos com IDs diferentes ja dedupados). O ADVBOX expoe a
--     mesma lista em GET /api/v1/settings ("task types" — advbox-sync/index.ts:278);
--     o fonte legado NAO tem tabela nem constante de tipos.
--   * bancos: combo fixo de contrato do fonte (EditClienteDialog.tsx:11-16 =
--     NovoCliente.tsx:21-26 = EtapaIdentificacao.tsx:21-26). "Outro" nao entra:
--     e texto livre no form (o front do Comercial ja o mantem).
--
-- Decisoes registradas (titular, 23/10/2026):
--   * TIPOS GRAVADOS EM MAIUSCULAS (pedido explicito); bancos mantem o nome
--     como no fonte (mix de maiusculas/minusculas).
--   * Seed em TODAS as organizacoes existentes (padrao do seed de funcoes da
--     V13: CROSS JOIN (VALUES ...) + WHERE NOT EXISTS — re-execucao segura).
--   * created_by NOT NULL vem do membro dono da seed por organizacao:
--     primeiro admin, senao CEO, senao o membro mais antigo. Organizacao SEM
--     membro nao recebe as linhas (created_by nao teria de onde vir).
--   * Todos com ativo = true (da para desligar depois pela tela).

INSERT INTO tarefa_tipos (organizacao_id, nome, created_by)
SELECT d.organizacao_id, t.nome, d.user_id
FROM (
    SELECT DISTINCT ON (m.organizacao_id) m.organizacao_id, m.user_id
    FROM membros m
    ORDER BY m.organizacao_id,
             (m.papel = 'admin') DESC,
             m.is_ceo DESC,
             m.created_at
) d
CROSS JOIN (VALUES
    ('INTIMAÇÕES JUDICIAIS'),
    ('PAUTA DE AUDIÊNCIAS'),
    ('RECADO/RESPOSTAS'),
    ('1º CONTATO COM O LEAD'),
    ('ABERTURA DE DIT PERANTE A FAZENDA ESTADUAL'),
    ('AÇÃO FILIAÇÃO SOCIOAFETIVA'),
    ('ACOMPANHAR AJG'),
    ('ACOMPANHAR CITAÇÃO'),
    ('ACOMPANHAR CLIENTE'),
    ('ACOMPANHAR CUMPRIMENTO DE ACORDO'),
    ('ACOMPANHAR DECISÃO/ACÓRDÃO'),
    ('ACOMPANHAR DECISÃO/DESPACHO'),
    ('ACOMPANHAR HABILITAÇÃO NO PROCESSO'),
    ('ACOMPANHAR MANIFESTAÇÃO PARTE CONTRÁRIA'),
    ('ACOMPANHAR PAGAMENTO'),
    ('ACOMPANHAR PAGAMENTO DE CUSTAS'),
    ('ACOMPANHAR PERÍCIA'),
    ('ACOMPANHAR PROCESSO ADMINISTRATIVO'),
    ('ACOMPANHAR TRÂNSITO EM JULGADO'),
    ('AGENDAR REUNIÃO COM ADVOGADO'),
    ('AGRAVO DE INSTRUMENTO'),
    ('AGRAVO DE PETIÇÃO'),
    ('AGRAVO EM RECURSO ESPECIAL'),
    ('AGRAVO EM RECURSO EXTRAORDINÁRIO'),
    ('AGRAVO INTERNO'),
    ('AGUARDANDO DOCUMENTOS CLIENTE'),
    ('AGUARDANDO DOCUMENTOS PARCEIRO'),
    ('AGUARDAR E-MAIL DE RESPOSTA DO BANCO'),
    ('ALEGAÇÕES FINAIS - NICHOS'),
    ('ALEGAÇÕES FINAIS COMPLEXAS'),
    ('ALEGAÇÕES FINAIS SIMPLES'),
    ('ALEGAÇÕES FINAIS TRABALHISTAS'),
    ('ANALISAR ATA DE AUDIÊNCIA'),
    ('ANÁLISE DE ACÓRDÃO/DECISÃO'),
    ('ANÁLISE DE CASO DO PARCEIRO'),
    ('ANÁLISE DE DECISÃO/SENTENÇA'),
    ('ANÁLISE DE PROPOSTA DE ACORDO'),
    ('ANÁLISE DE PROPOSTA DE ACORDO COMPLEXA'),
    ('ANÁLISE DO CASO'),
    ('ATENDER NOVA DEMANDA DO PARCEIRO'),
    ('ATENDER NOVO CLIENTE'),
    ('ATENDIMENTO AO CLIENTE - EXTERNO'),
    ('ATENDIMENTO AO CLIENTE - INTERNO'),
    ('ATRIBUIR E-MAIL/NOTA DE EXPEDIENTE E TAREFA'),
    ('AUDIÊNCIA DE CONCILIAÇÃO'),
    ('AUDIÊNCIA DE INSTRUÇÃO/JULGAMENTO'),
    ('AUDIÊNCIA DE INSTRUÇÃO/JULGAMENTO - SEM TESTEMUNHAS'),
    ('AUDIÊNCIA DE INTERROGATÓRIO'),
    ('AUDIÊNCIA DE MEDIAÇÃO'),
    ('AUDIÊNCIA UNA'),
    ('AVALIAR DOCUMENTAÇÃO PROBATÓRIA'),
    ('AVISAR CLIENTE DA AUDIÊNCIA'),
    ('AVISAR CLIENTE DA DATA DA SUSTENTAÇÃO ORAL'),
    ('AVISAR CLIENTE DA PERÍCIA'),
    ('BUSCAR INFORMAÇÕES EM ÓRGÃO PÚBLICO'),
    ('CARGA DE PROCESSO'),
    ('COBRAR HONORÁRIOS/ENVIAR BOLETO'),
    ('COBRAR/RELEMBRAR CUSTAS PROCESSUAIS'),
    ('COLETA DE PROVAS'),
    ('COMENTÁRIO NO GOOGLE'),
    ('COMPRAR MATERIAL PARA O ESCRITÓRIO'),
    ('CONEXÃO FEITA'),
    ('CONFERIR CÁLCULO DO PERITO/DA PARTE'),
    ('CONFERIR RECEBIMENTO DE HONORÁRIOS SUCUMBENCIAIS'),
    ('CONFERIR/REVISAR PETIÇÃO'),
    ('CONTESTAÇÃO - NICHOS'),
    ('CONTESTAÇÃO COM MODELO'),
    ('CONTESTAÇÃO COMPLEXA'),
    ('CONTESTAÇÃO SEM MODELO'),
    ('CONTESTAÇÃO TRABALHISTA'),
    ('CONTRATAÇÃO DE LAUDO'),
    ('CONTRATAR CORRESPONDENTE/PARCEIRO'),
    ('CORREÇÃO DE INICIAL'),
    ('CORREÇÃO PEDIDO ADMINISTRATIVO'),
    ('CUMPRIMENTO DE EXIGÊNCIAS'),
    ('DAR PALESTRA EM EVENTO'),
    ('DEFESA PRÉVIA'),
    ('DESPACHO COM JUIZ'),
    ('DESPACHO COM O DESEMBARGADOR'),
    ('DESPACHO COM O MINISTRO'),
    ('DESPACHO/PROTOCOLO NO CARTÓRIO'),
    ('DEVOLUÇÃO DE DOCUMENTOS/PROCESSO'),
    ('DIGILITALIZAÇÃO DE DOCUMENTOS'),
    ('DILIGÊNCIA EM CARTÓRIO'),
    ('EDIÇÃO DE ARTE PARA REDE SOCIAL'),
    ('EFETUAR PAGAMENTO'),
    ('ELABORAR CÁLCULO SIMPLES'),
    ('ELABORAR CONTRARRAZÕES'),
    ('ELABORAR DECLARAÇÕES FINAIS'),
    ('ELABORAR DECLARAÇÕES INICIAIS'),
    ('ELABORAR ESBOÇO DE PARTILHA'),
    ('ELABORAR NOTIFICAÇÃO EXTRAJUDICIAL'),
    ('ELABORAR PETIÇÃO COMPLEXA'),
    ('ELABORAR PETIÇÃO DE ACORDO'),
    ('ELABORAR PETIÇÃO DE CUMPRIMENTO DE SENTENÇA'),
    ('ELABORAR PETIÇÃO DE EXECUÇÃO'),
    ('ELABORAR PETIÇÃO DE LIQUIDAÇÃO (TRABALHISTA)'),
    ('ELABORAR PETIÇÃO DE LIQUIDAÇÃO DE SENTENÇA'),
    ('ELABORAR PETIÇÃO INICIAL COM MODELO'),
    ('ELABORAR PETIÇÃO INICIAL SEM MODELO'),
    ('ELABORAR PLANO DE CARTILHA'),
    ('ELABORAR PROPOSTA DE ACORDO'),
    ('ELABORAR QUESITOS'),
    ('ELABORAR RECURSO ADMINISTRATIVO - COMPLEXO'),
    ('ELABORAR RECURSO ADMINISTRATIVO (TRÂNSITO)'),
    ('ELABORAR RECURSO INOMINADO (AIC/TRÂNSITO)'),
    ('ELABORAR RELATÓRIO PROCESSUAL'),
    ('ELABORAR REQUERIMENTO ADMINSITRATIVO'),
    ('ELABORAR RESCISÃO DE CONTRATO'),
    ('ELABORAR RESUMO DA DECISÃO PARA O INSS'),
    ('EMBARGOS À EXECUÇÃO'),
    ('EMBARGOS À EXECUÇÃO/PENHORA'),
    ('EMBARGOS À MONITÓRIA'),
    ('EMBARGOS DE DECLARAÇÃO'),
    ('EMBARGOS INFRINGENTES'),
    ('EMENDA À INICIAL'),
    ('EMENDA À INICIAL - JUNTADA DE DOCUMENTOS'),
    ('EMENDA À INICIAL - TRÂNSITO E NICHOS'),
    ('EMISSÃO DE PARECER'),
    ('EMITIR BOLETO'),
    ('EMITIR BOLETO DE DEPÓSITO JUDICIAL'),
    ('EMITIR CONTRATO DE HONORÁRIOS'),
    ('EMITIR CUSTAS/DEPÓSITO RECURSAL'),
    ('ENCAMINHAR PARA LAUDO - ENGENHEIRO'),
    ('ENTRAR EM CONTATO COM O CLIENTE'),
    ('ENTREGA DE DOCUMENTOS'),
    ('ENTREGAR CARTA DE CONVITE PARA TESTEMUNHA'),
    ('ENTREGAR GUIA DO ITCD PARA O INVENTARIANTE'),
    ('ENVIAR CUSTAS AO CLIENTE'),
    ('ENVIAR E-MAIL COM PEDIDO DE ALONGAMENTO'),
    ('ESCREVER ARTIGO'),
    ('ESPECIFICAÇÃO DE PROVAS'),
    ('EXCEÇÃO DE PRÉ EXECUTIVIDADE'),
    ('EXPEDIÇÃO DE ALVARÁ'),
    ('EXPEDIR CERTIDÕES'),
    ('FAZER ADMISSÃO DE COLABORADOR'),
    ('FAZER ALTERAÇÕES REQUERIDAS PELA FAZENDA'),
    ('FAZER DEMISSÃO DE COLABORADOR'),
    ('FAZER ENTREVISTA DE COLABORADOR'),
    ('FAZER O BRIEFING'),
    ('FAZER RELATÓRIO DE COMISSÃO MENSAL DO PARCEIRO'),
    ('FECHAMENTO COM COBRANÇA INICIAIS'),
    ('FECHAMENTO COM HONORÁRIOS RECORRENTES'),
    ('FECHAMENTO SEM COBRANÇA INICIAIS'),
    ('GERAR BOLETO DE CUSTAS RECURSAIS'),
    ('GERAR PROCURAÇÃO'),
    ('GERENCIAR ANÚNCIOS DO ESCRITÓRIO SEMANAL'),
    ('HABILITAÇÃO NO PROCESSO'),
    ('IMPUGNAÇÃO À CÁLCULOS'),
    ('IMPUGNAÇÃO À CONTESTAÇÃO - NICHOS'),
    ('IMPUGNAÇÃO À PENHORA'),
    ('IMPUGNAÇÃO AO CÁLCULO'),
    ('IMPUGNAÇÃO AO CUMPRIMENTO DE SENTENÇA'),
    ('IMPUGNAÇÃO AO IDPJ'),
    ('IMPUGNAÇÃO DE DOCUMENTOS'),
    ('INFORMAR CLIENTE DA SENTENÇA RECURSAL'),
    ('INFORMAR CLIENTE DO ANDAMENTO DO PROCESSO'),
    ('INFORMAR CLIENTE DO ANDAMENTO DO RECURSO'),
    ('INFORMAR O CLIENTE DA DECISÃO'),
    ('INTIMAÇÃO INSS PARA IMPLANTAR BENEFÍCIO'),
    ('INVESTIGAÇÃO PRIVADA'),
    ('IR AO BANCO'),
    ('LEVANTAMENTO DE ALVARÁ'),
    ('LEVANTAMENTO DE RPV'),
    ('LIGAÇÃO AO CLIENTE'),
    ('LIGAR PARA A PARTE CONTRÁRIA/ADVOGADO'),
    ('LIMPEZA DO ESCRITÓRIO'),
    ('NEGOCIAR CONTRATO DE PARCERIA'),
    ('OBTER PROVA'),
    ('OPORTUNIDADE GERADA'),
    ('OPORTUNIDADE PERDIDA'),
    ('ORGANIZAR AGENDAS'),
    ('ORGANIZAR CONTAS A PAGAR'),
    ('ORGANIZAR DOCUMENTOS'),
    ('PAGAMENTO DE BOLETOS'),
    ('PAGAR CONTAS INTERNET BANKING'),
    ('PAGAR PARCEIROS'),
    ('PAGAR SALÁRIO'),
    ('PAGAR/REPASSAR VALOR PARA CLIENTE'),
    ('PARTICIPAR DE EVENTO'),
    ('PEDIDO ADMINISTRATIVO - ALONGAMENTOO'),
    ('PEDIDO DE PRAZO'),
    ('PETIÇÃO INICIAL - AIC/TRÂNSITO - EXCETO RENÚNCIA DE PROPRIEDADE'),
    ('PETIÇÃO INICIAL COMPLEXA'),
    ('PETIÇÃO INTERMEDIÁRIA'),
    ('PETIÇÃO/PROTOCOLO INTERMEDIÁRIO'),
    ('PETICIONAMENTO DE ALONGAMENTO COMPULSÓRIO'),
    ('PRAZO SIMPLES'),
    ('PREPARAR SUSTENTAÇÃO ORAL'),
    ('PREPARAR TESTEMUNHAS'),
    ('PROCESSO GANHO'),
    ('PROCESSO PERDIDO'),
    ('PROTESTO ANTI PRECLUSIVO'),
    ('PROTOCOLO INTERMEDIÁRIO'),
    ('PROTOCOLO INTERMEDIÁRIO JUDICIAL'),
    ('PROTOCOLO JUDICIAL'),
    ('PROTOCOLO JUDICIAL (AIC)'),
    ('PROTOCOLO JUDICIAL RURAL'),
    ('PROTOCOLO REQUERIMENTO'),
    ('PROTOCOLO/ENVIO CORREIOS'),
    ('REALIZAR DISTRATO'),
    ('RECOLHER CUSTAS'),
    ('RECURSO DE APELAÇÃO'),
    ('RECURSO DE APELAÇÃO/ORDINÁRIO - NICHOS'),
    ('RECURSO DE REVISTA'),
    ('RECURSO ESPECIAL'),
    ('RECURSO EXTRAORDINÁRIO'),
    ('RECURSO INOMINADO (JUIZADO)'),
    ('RECURSO ORDINÁRIO'),
    ('RELATÓRIO DE AUDIÊNCIA'),
    ('RELATÓRIO FINANCEIRO MENSAL'),
    ('RENÚNCIA DE MANDATO'),
    ('RÉPLICA/IMPUGNAÇÃO À CONTESTAÇÃO'),
    ('RÉPLICA/IMPUGNAÇÃO À CONTESTAÇÃO - AIC/TRÂNSITO (EXCETO RENÚNCIA DE PROPRIEDADE)'),
    ('REQUISIÇÃO JUDICIAL DE TESTEMUNHA'),
    ('RESPONDER DÚVIDAS DO CLIENTE'),
    ('RESPOSTA À ACUSAÇÃO (RA)'),
    ('RESPOSTA AO CONSUMIDOR.GOV'),
    ('REUNIÃO - DÚVIDAS'),
    ('REUNIÃO - HIGH TICKET'),
    ('REUNIÃO - ONBOARDING'),
    ('REUNIÃO COM PARCEIRO'),
    ('REUNIÃO DE ENCERRAMENTO'),
    ('REVOGAÇÃO DE MANDATO'),
    ('SAQUE DOS HONORÁRIOS NO BANCO'),
    ('SOLICITAR DESISTÊNCIA'),
    ('SOLICITAR DOCUMENTOS'),
    ('SOLICITAR INFORMAÇÕES DO CLIENTE'),
    ('SOLICITAR REEMBOLSO PARA O CLIENTE'),
    ('SUSTENTAÇÃO ORAL TRT TRF TJ'),
    ('SUSTENTAÇÃO ORAL TST STJ STF'),
    ('TENTAR ACORDO EXTRAJUDICIAL'),
    ('VER SE TEM CAFÉ ATRAVÉS DE TELEPATIA'),
    ('VIDEOCHAMADA OU LIGAÇÃO +30MIN'),
    ('VISITAR POSSÍVEIS CLIENTES')
) AS t(nome)
WHERE NOT EXISTS (
    SELECT 1 FROM tarefa_tipos tt
    WHERE tt.organizacao_id = d.organizacao_id
      AND tt.nome = t.nome
);

INSERT INTO bancos (organizacao_id, nome, created_by)
SELECT d.organizacao_id, b.nome, d.user_id
FROM (
    SELECT DISTINCT ON (m.organizacao_id) m.organizacao_id, m.user_id
    FROM membros m
    ORDER BY m.organizacao_id,
             (m.papel = 'admin') DESC,
             m.is_ceo DESC,
             m.created_at
) d
CROSS JOIN (VALUES
    ('Banco do Brasil'),
    ('Caixa Econômica Federal'),
    ('Bradesco'),
    ('Itaú'),
    ('Santander'),
    ('Sicoob'),
    ('Sicredi'),
    ('Cresol'),
    ('Banrisul'),
    ('BNB'),
    ('BASA'),
    ('BNDES'),
    ('Banco Safra'),
    ('Banco CNH'),
    ('BTG Pactual'),
    ('ABC Brasil'),
    ('Rabobank')
) AS b(nome)
WHERE NOT EXISTS (
    SELECT 1 FROM bancos bo
    WHERE bo.organizacao_id = d.organizacao_id
      AND bo.nome = b.nome
);
```
(SQL completo acima — já existe em `oliveira-api/src/main/resources/db/migration/`
como `V23__seed_tipos_tarefa_e_bancos.sql`, com os TIPOS EM MAIUSCULAS a pedido do
titular; a lista-fonte é `docs/lista-v23-para-edicao.md`.)

Padrão idêntico ao seed de funcoes da `V13` (CROSS JOIN + WHERE NOT EXISTS =
re-execução segura); número **V23** = próximo livre (V19 já existe no histórico local
como resíduo "contrato historico" do plano descartado, V20–V22 aplicadas/em fila).

---

## 5. O que a seed faz hoje no banco local (medido)

| Organização | Membros | Quem vira `created_by` | Sai de linha |
|---|---|---|---|
| Oliveira Advogados | 9 (5 admin) | primeiro admin | 235 tipos + 17 bancos |
| Agro | 1 (0 admin, 1 CEO) | o CEO | 235 tipos + 17 bancos |
| Org Seguranca Teste | 0 | — (sem membro) | **nada** (regra do D5) |

---

## 6. Decisões em aberto

- **D1 — Dedupe dos 5 repetidos no ADVBOX**: `ACOMPANHAR PAGAMENTO`,
  `EMBARGOS DE DECLARAÇÃO`, `IMPUGNAÇÃO À PENHORA`, `LIGAÇÃO AO CLIENTE`, `PRAZO
  SIMPLES` existem 2× (IDs diferentes lá). *Recomendação: deduplicar (UNIQUE da tabela
  bloqueia a 2ª linha) + manter a zoeira do café, salvo veto.*
- **D2 — Escopo do seed**: todas as organizações ou só a Oliveira? *Recomendação: todas
  — as tabelas são por organização e a lista base é o mesmo catálogo; dá para
  desativar tipo/banco depois pela tela.*
- **D3 — Bancos**: os 17 do fonte sem "Outro" e sem Unicred, como acima. *Recomendação:
  aprovado como está.*
- **D4 — Número V23**: confirmado com `flyway_schema_history` local (V19 = resíduo
  "contrato historico" true, V20/V21 true, V22 pendente). *Recomendação: V23.*
- **D5 — Organização sem membro** (caso real: Org Seguranca Teste): pular a org —
  `created_by` NOT NULL não teria de onde vir. *Recomendação: pular; se um dia a org
  ganhar membro, basta re-rodar a seed (WHERE NOT EXISTS cobre).*
