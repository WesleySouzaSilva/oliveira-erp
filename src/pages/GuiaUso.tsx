import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown, Compass, Workflow, Users, FileText, Scale, CalendarClock,
  Handshake, Bell, CheckCircle2, Clock, Lightbulb, AlertTriangle,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const fluxos = [
  {
    id: "novo-cliente",
    icon: Users,
    titulo: "1. Entrada de um novo produtor",
    quando: "Sempre que um lead vira cliente (contrato assinado ou onboarding iniciado).",
    passos: [
      "Cadastrar em Clientes → Novo Cliente (CPF/CNPJ, contato, endereço da fazenda).",
      "Subir documentos iniciais no Drive do cliente (RG, CCIR, contratos bancários, matrículas).",
      "Preencher o Checklist do Produtor para identificar lacunas de informação.",
      "Lançar vencimentos conhecidos em Vencimentos para alimentar os alertas de 15 dias úteis.",
    ],
    responsavel: "Comercial / SDR / Closer",
  },
  {
    id: "laudo",
    icon: FileText,
    titulo: "2. Elaboração do laudo técnico (MCR 2.6.4)",
    quando: "Após o cliente entregar contratos, notas fiscais e dados de safra.",
    passos: [
      "Em Laudos → Novo Laudo, selecionar o cliente já cadastrado (não recadastrar).",
      "Seguir as 7 etapas do wizard: Identificação → Safra → Documentos → Enquadramento → Capacidade → Projeção → Finalização.",
      "Anexar dados climáticos (INMET/NASA), decretos e CEPEA direto pelo painel de Dados Externos.",
      "Gerar PDF Parte I (Perda) e Parte II (Capacidade) e arquivar no Drive do cliente.",
    ],
    responsavel: "Agrônomo",
  },
  {
    id: "juridico",
    icon: Scale,
    titulo: "3. Abertura do processo jurídico",
    quando: "Quando o laudo está finalizado e validado pelo agrônomo responsável.",
    passos: [
      "Em Processos → criar caso vinculado ao cliente e ao laudo.",
      "Avançar pelas fases (Notificação → Petição inicial → Audiência → Acordo).",
      "Usar o Banco de Petições para gerar peças sem redigitar dados (puxa do laudo).",
      "Cada fase tem prazo automático — confira em Tarefas e na Agenda.",
    ],
    responsavel: "Advogado",
  },
  {
    id: "vencimentos",
    icon: CalendarClock,
    titulo: "4. Acompanhamento de vencimentos",
    quando: "Diariamente — alertas disparam 15 dias úteis antes do vencimento.",
    passos: [
      "Conferir o sino de Notificações ao iniciar o dia.",
      "Em Vencimentos, marcar contratos como Renegociado / Quitado / Em alongamento.",
      "Atualizações sincronizam para toda a equipe automaticamente.",
    ],
    responsavel: "Toda a equipe",
  },
  {
    id: "acordos",
    icon: Handshake,
    titulo: "5. Negociação e acordos",
    quando: "Após proposta do banco ou audiência conciliatória.",
    passos: [
      "Registrar a proposta em Acordos com valores, prazos e parcelas.",
      "Mover o card no Kanban de Acordos conforme o andamento.",
      "Acordos recorrentes geram lembretes automáticos de parcelas.",
    ],
    responsavel: "Advogado / Closer",
  },
  {
    id: "rotina",
    icon: Workflow,
    titulo: "6. Rotina diária recomendada",
    quando: "Início e fim de cada expediente.",
    passos: [
      "Manhã: abrir Dashboard → checar Feed → revisar Tarefas do dia → conferir Agenda.",
      "Durante o dia: registrar toda interação no cliente correto (notas, anexos, status).",
      "Final do dia: atualizar Pipeline de Casos e marcar tarefas concluídas.",
    ],
    responsavel: "Toda a equipe",
  },
];

const principios = [
  {
    icon: Bell,
    titulo: "Tudo é compartilhado",
    texto: "Clientes, processos, vencimentos e acordos aparecem para toda a equipe. Cada registro mostra quem criou — não trabalhe em planilhas paralelas.",
  },
  {
    icon: Users,
    titulo: "Cliente é a fonte da verdade",
    texto: "Sempre busque o cliente existente antes de criar outro. Laudos, processos e arquivos devem estar vinculados ao mesmo produtor.",
  },
  {
    icon: Clock,
    titulo: "Prazos são sagrados",
    texto: "Confirme o sino de notificações diariamente. Prazos bancários e judiciais não admitem atraso.",
  },
  {
    icon: Lightbulb,
    titulo: "Use o que a plataforma já automatiza",
    texto: "Petições, climáticos, decretos e PDFs são gerados pela IA. Edite o que precisar, mas não comece do zero.",
  },
];

const papeis = [
  { papel: "Agrônomo", foco: "Laudos, dados climáticos, capacidade de pagamento, evidências técnicas." },
  { papel: "Advogado", foco: "Processos, petições, acordos, prazos judiciais." },
  { papel: "Comercial / SDR / Closer", foco: "Clientes, funil comercial, onboarding, follow-up." },
  { papel: "RH / Admin", foco: "Equipe, metas, salários, bônus, configurações." },
];

export default function GuiaUso() {
  const [open, setOpen] = useState<string | null>("novo-cliente");

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Compass className="w-5 h-5 text-accent" />
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">
            Guia de uso da plataforma
          </span>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Como e quando usar cada parte da plataforma
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roteiro prático para a equipe — do primeiro contato com o produtor até o acordo final.
        </p>
      </div>

      {/* Princípios */}
      <section className="mb-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-4">
          Princípios da operação
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {principios.map((p, i) => (
            <motion.div
              key={p.titulo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card rounded-lg border border-border shadow-card p-4 flex gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <p.icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{p.titulo}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{p.texto}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Fluxos */}
      <section className="mb-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <Workflow className="w-5 h-5 text-accent" />
          Fluxo completo de um caso
        </h2>
        <div className="space-y-3">
          {fluxos.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card rounded-lg border border-border shadow-card overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === f.id ? null : f.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{f.titulo}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground/70">Quando:</span> {f.quando}
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ${
                    open === f.id ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open === f.id && (
                <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                      Passo a passo
                    </h4>
                    <ul className="space-y-1.5">
                      {f.passos.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-secondary/40 rounded-md px-3 py-2 text-xs text-foreground/80">
                    <span className="font-semibold">Responsável principal:</span> {f.responsavel}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Papéis */}
      <section className="mb-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-accent" />
          Quem faz o quê
        </h2>
        <div className="bg-card rounded-lg border border-border shadow-card divide-y divide-border">
          {papeis.map((p) => (
            <div key={p.papel} className="p-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-semibold text-foreground sm:w-56 shrink-0">
                {p.papel}
              </span>
              <span className="text-sm text-muted-foreground">{p.foco}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Aviso */}
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Em caso de dúvida sobre o MCR 2.6.4, jurisprudência ou hipóteses de prorrogação, consulte
            também a página <span className="font-semibold text-foreground">Ajuda / MCR 2.6.4</span>.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}