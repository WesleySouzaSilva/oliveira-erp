import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Scale,
  BookOpen,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const hipoteses = [
  {
    letra: "a",
    titulo: "Dificuldade de comercialização dos produtos",
    resumo:
      "Quando o produtor não consegue vender a produção por preço justo, seja por excesso de oferta, problemas logísticos, queda de preços internacionais ou inadimplência de compradores.",
    detalhes:
      "O MCR 2.6.4, alínea 'a', prevê a prorrogação quando houver comprovada dificuldade de comercialização. O produtor deve demonstrar a diferença entre o preço esperado e o efetivamente obtido, apresentando notas fiscais, cotações de mercado (CEPEA) e documentos que comprovem as tentativas de venda.",
    documentos: [
      "Notas fiscais de venda (com preço abaixo do esperado)",
      "Cotações CEPEA do período",
      "Comprovantes de ofertas recusadas",
      "Relatórios de mercado",
    ],
  },
  {
    letra: "b",
    titulo: "Frustração de safras por fatores adversos",
    resumo:
      "Quando eventos climáticos (seca, geada, granizo, excesso de chuva) ou biológicos (pragas, doenças) causam perda significativa da produção esperada.",
    detalhes:
      "A alínea 'b' é a mais frequentemente invocada. Requer comprovação do evento adverso e do nexo causal com a perda de produção. Decretos de emergência/calamidade, dados do INMET e laudos de vistoria fortalecem enormemente o pedido. Se houver cobertura do Proagro ou seguro rural, isso não impede a prorrogação, mas deve ser mencionado.",
    documentos: [
      "Decreto municipal/estadual de emergência ou calamidade",
      "Boletim meteorológico do INMET",
      "Laudo de vistoria anterior",
      "Relatório do Proagro (se aplicável)",
      "Fotos da lavoura afetada",
      "Comprovante de seguro rural (se houver)",
    ],
  },
  {
    letra: "c",
    titulo: "Ocorrências prejudiciais ao desenvolvimento das explorações",
    resumo:
      "Eventos não climáticos que prejudicam a atividade, como surtos de pragas atípicas, doenças em rebanho, problemas sanitários, restrições fitossanitárias ou embargos.",
    detalhes:
      "A alínea 'c' abrange situações que não se enquadram diretamente como frustração de safra, mas que impactam negativamente a exploração agropecuária. Exemplos incluem febre aftosa, ferrugem asiática em proporções atípicas, restrições de exportação por questões sanitárias, entre outros.",
    documentos: [
      "Laudos sanitários oficiais",
      "Notificações de órgãos de defesa agropecuária",
      "Relatórios de perdas",
      "Documentos de restrição fitossanitária",
    ],
  },
  {
    letra: "d",
    titulo: "Dificuldades de fluxo de caixa por perdas acumuladas",
    resumo:
      "Quando o produtor acumula perdas em safras consecutivas que comprometem severamente sua capacidade de pagamento, mesmo que a safra atual não tenha sido afetada por evento específico.",
    detalhes:
      "A alínea 'd' reconhece que perdas acumuladas ao longo de múltiplas safras podem criar uma situação de insolvência que justifica o alongamento. O produtor deve demonstrar o histórico de perdas, o endividamento total no SNCR e a inviabilidade de cumprimento das obrigações sem a prorrogação.",
    documentos: [
      "Histórico de safras anteriores com perdas",
      "Extrato do SNCR mostrando endividamento total",
      "Planilha de fluxo de caixa",
      "Demonstrativos contábeis",
      "Laudos de safras anteriores (se houver)",
    ],
  },
];

const faqs = [
  {
    pergunta: "O banco pode negar o pedido de prorrogação?",
    resposta:
      "A Súmula 298 do STJ estabelece que o alongamento de dívida originada de crédito rural não constitui faculdade da instituição financeira, mas direito do devedor nos termos da lei. Portanto, se os requisitos do MCR 2.6.4 estiverem preenchidos, o banco não pode negar arbitrariamente. Caso negue sem fundamentação adequada, o produtor pode ingressar com Ação de Obrigação de Fazer.",
  },
  {
    pergunta: "E se a dívida já venceu?",
    resposta:
      "O vencimento da dívida não impede o pedido de prorrogação. A jurisprudência dos tribunais (TJPR, TJSP, TJMG, TRF4) tem reconhecido o direito à prorrogação mesmo após o vencimento, especialmente quando o produtor demonstra que as condições adversas persistiam durante a vigência do contrato.",
  },
  {
    pergunta: "Posso usar CCB (Cédula de Crédito Bancário) como base?",
    resposta:
      "Sim. A CCB, quando vinculada a crédito rural, está sujeita às mesmas regras do MCR. O alongamento se aplica independentemente do instrumento contratual utilizado (CCR, CCB, contrato de crédito rural).",
  },
  {
    pergunta: "Qual o prazo máximo de prorrogação?",
    resposta:
      "O MCR não estabelece um prazo máximo fixo para a prorrogação. O prazo deve ser compatível com a capacidade de pagamento demonstrada pelo produtor. Na prática, prazos de 12 a 60 meses são comuns, dependendo da gravidade da situação e da capacidade de recuperação.",
  },
  {
    pergunta: "O Proagro substitui a prorrogação?",
    resposta:
      "Não. O Proagro é um programa de garantia da atividade agropecuária que cobre parte das perdas. A prorrogação da dívida é um direito independente. Mesmo que o produtor tenha recebido indenização do Proagro, pode solicitar a prorrogação se as perdas excederem a cobertura.",
  },
  {
    pergunta: "Preciso de advogado para fazer o pedido?",
    resposta:
      "O pedido extrajudicial pode ser feito pelo próprio produtor com o laudo técnico. Porém, recomenda-se fortemente o acompanhamento de advogado especializado em direito do agronegócio, especialmente se o banco negar o pedido e for necessário ingressar com ação judicial.",
  },
];

export default function Ajuda() {
  const [openHipotese, setOpenHipotese] = useState<string | null>("b");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">
          Ajuda — MCR 2.6.4
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entenda o Manual de Crédito Rural e como fundamentar seu pedido de prorrogação.
        </p>
      </div>

      {/* Súmula 298 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary/5 border border-primary/20 rounded-lg p-5 mb-8"
      >
        <div className="flex items-start gap-3">
          <Scale className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">
              Súmula 298 do STJ
            </h2>
            <blockquote className="text-sm text-foreground italic border-l-2 border-primary/30 pl-3">
              "O alongamento de dívida originada de crédito rural não constitui
              faculdade da instituição financeira, mas direito do devedor nos
              termos da lei."
            </blockquote>
            <p className="text-xs text-muted-foreground mt-2">
              Superior Tribunal de Justiça — Consolidação da jurisprudência sobre
              o direito subjetivo do produtor rural ao alongamento.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Hipóteses */}
      <section className="mb-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent" />
          As 4 Hipóteses do MCR 2.6.4
        </h2>

        <div className="space-y-3">
          {hipoteses.map((h, i) => (
            <motion.div
              key={h.letra}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-lg border border-border shadow-card overflow-hidden"
            >
              <button
                onClick={() =>
                  setOpenHipotese(openHipotese === h.letra ? null : h.letra)
                }
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-bold shrink-0">
                  {h.letra}
                </span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {h.titulo}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {h.resumo}
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0 ${
                    openHipotese === h.letra ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openHipotese === h.letra && (
                <div className="px-5 pb-5 border-t border-border pt-4">
                  <p className="text-sm text-foreground leading-relaxed mb-4">
                    {h.detalhes}
                  </p>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                      Documentos essenciais
                    </h4>
                    <ul className="space-y-1.5">
                      {h.documentos.map((doc) => (
                        <li
                          key={doc}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-accent" />
          Perguntas Frequentes
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-card rounded-lg border border-border shadow-card overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                <span className="flex-1 text-sm font-medium text-foreground">
                  {faq.pergunta}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {faq.resposta}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Link oficial + aviso */}
      <div className="space-y-4">
        <a
          href="https://www3.bcb.gov.br/mcr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Texto oficial do MCR — Banco Central
        </a>

        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Este conteúdo é informativo e não substitui orientação jurídica
              profissional. Consulte um advogado especializado em crédito rural
              para análise do seu caso específico.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
