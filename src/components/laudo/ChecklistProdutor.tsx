import { useState } from "react";
import { CheckCircle, Circle, AlertTriangle, ChevronDown, ChevronRight, ClipboardList, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckItem {
  id: string;
  label: string;
  critical?: boolean;
}

interface CheckSection {
  id: string;
  title: string;
  part?: string;
  items: CheckItem[];
}

const sections: CheckSection[] = [
  {
    id: "produtor",
    title: "Dados do Produtor Rural",
    part: "Parte 1 — Laudo de Perda",
    items: [
      { id: "nome", label: "Nome completo" },
      { id: "nacionalidade", label: "Nacionalidade e estado civil" },
      { id: "profissao", label: "Profissão (produtor rural)" },
      { id: "rg", label: "RG — número e órgão emissor" },
      { id: "cpf", label: "CPF" },
      { id: "endereco", label: "Endereço completo da propriedade" },
    ],
  },
  {
    id: "propriedade",
    title: "Propriedade e Culturas",
    items: [
      { id: "area_total", label: "Área total cultivada (ha)" },
      { id: "culturas_plantadas", label: "Culturas plantadas" },
      { id: "variedade", label: "Variedade/cultivar de cada cultura" },
      { id: "finalidade", label: "Finalidade da produção" },
      { id: "sistema_cultivo", label: "Sistema de cultivo: sequeiro ou irrigado", critical: true },
      { id: "safra_ref", label: "Safra de referência" },
      { id: "epoca_plantio", label: "Época de plantio" },
      { id: "data_colheita", label: "Data prevista de colheita" },
      { id: "municipio_lavoura", label: "Município e estado da lavoura" },
      { id: "tipo_posse", label: "Tipo de posse: própria, arrendada ou parceria" },
      { id: "car_matricula", label: "Nº CAR ou matrícula do imóvel" },
    ],
  },
  {
    id: "adversidade",
    title: "Adversidade Climática / Causa da Perda",
    items: [
      { id: "tipo_evento", label: "Tipo do evento adverso" },
      { id: "periodo_evento", label: "Período de ocorrência" },
      { id: "fase_fisiologica", label: "Fase fisiológica afetada", critical: true },
      { id: "sintomas", label: "Sintomas visíveis nas plantas" },
      { id: "fonte_climatica", label: "Fonte climática oficial utilizada", critical: true },
      { id: "decreto_emergencia", label: "Decreto de emergência/calamidade?" },
      { id: "proagro_seguro", label: "Acionamento do Proagro ou seguro rural?", critical: true },
    ],
  },
  {
    id: "produtivos",
    title: "Dados Produtivos — Frustração de Safra",
    items: [
      { id: "prod_esperada", label: "Produtividade esperada (sacas/ha)" },
      { id: "prod_obtida", label: "Produtividade efetivamente obtida" },
      { id: "perc_perda", label: "Percentual de perda calculado" },
      { id: "area_afetada", label: "Área total afetada (ha)" },
      { id: "custo_producao", label: "Custo total de produção investido", critical: true },
      { id: "destino_produto", label: "Produto vendido, estocado ou perdido?" },
    ],
  },
  {
    id: "economicos",
    title: "Fatores Econômicos Adicionais",
    items: [
      { id: "preco_planejado", label: "Preço estimado no planejamento (R$/saca)" },
      { id: "preco_venda", label: "Preço efetivamente recebido (R$/saca)" },
      { id: "causa_queda", label: "Causa da queda de preço" },
      { id: "custo_adicional", label: "Custo adicional gerado (pragas etc.)" },
    ],
  },
  {
    id: "evidencias",
    title: "Evidências de Campo",
    items: [
      { id: "fotos_lavoura", label: "Fotos da lavoura afetada" },
      { id: "fotos_graos", label: "Fotos dos grãos/sementes colhidos" },
      { id: "geolocalizacao", label: "Fotos com geolocalização e data", critical: true },
      { id: "data_visita", label: "Data da visita técnica" },
      { id: "declaracao_produtor", label: "Declaração assinada pelo produtor", critical: true },
    ],
  },
  {
    id: "divida",
    title: "Dados da Dívida / Operação de Crédito",
    part: "Parte 2 — Capacidade Pgto.",
    items: [
      { id: "inst_financeira", label: "Instituição financeira credora" },
      { id: "num_contrato", label: "Número do contrato/operação" },
      { id: "valor_financiado", label: "Valor total financiado" },
      { id: "saldo_devedor", label: "Saldo devedor atualizado", critical: true },
      { id: "data_contratacao", label: "Data de contratação" },
      { id: "num_parcelas", label: "Número total de parcelas" },
      { id: "inicio_pgto", label: "Data de início do pagamento" },
      { id: "termino_pgto", label: "Data de término do pagamento" },
      { id: "valor_parcela", label: "Valor médio de cada parcela" },
      { id: "taxa_juros", label: "Taxa de juros do contrato" },
      { id: "divida_atraso", label: "Dívida em atraso? Há quanto tempo?" },
      { id: "tentativa_renego", label: "Tentativa anterior de renegociação?" },
      { id: "outras_dividas", label: "Outras dívidas além deste contrato?" },
    ],
  },
  {
    id: "receita",
    title: "Receita / Lucratividade Projetada",
    items: [
      { id: "area_cultivada_proj", label: "Área cultivada por cultura (ha)" },
      { id: "prod_esperada_normal", label: "Produtividade esperada em safra normal" },
      { id: "qtd_sacas_proj", label: "Quantidade total de sacas projetada" },
      { id: "valor_saca_mercado", label: "Valor médio da saca (R$)" },
      { id: "lucro_bruto_proj", label: "Lucro bruto anual projetado" },
      { id: "historico_prod", label: "Produtividade real últimas 2-3 safras", critical: true },
      { id: "outra_renda", label: "Outra fonte de renda?" },
    ],
  },
  {
    id: "custos",
    title: "Custos e Despesas",
    items: [
      { id: "custo_insumos", label: "Insumos: sementes, fertilizantes, defensivos" },
      { id: "custo_mao_obra", label: "Mão de obra" },
      { id: "custo_maquinario", label: "Maquinário" },
      { id: "custo_arrendamento", label: "Arrendamento da terra" },
      { id: "custo_transporte", label: "Transporte e logística" },
      { id: "despesas_pessoais", label: "Despesas pessoais e familiares" },
      { id: "custeio_vs_invest", label: "Custeio separado de investimento?", critical: true },
    ],
  },
  {
    id: "renegociacao",
    title: "Proposta de Renegociação",
    items: [
      { id: "modalidade_renego", label: "Modalidade de renegociação solicitada" },
      { id: "carencia", label: "Carência solicitada (anos)" },
      { id: "prazo_total", label: "Prazo total de pagamento (anos)" },
      { id: "garantias", label: "Garantias adicionais a oferecer", critical: true },
    ],
  },
  {
    id: "checklist_final",
    title: "Checklist Final — Entrega ao Banco",
    part: "Parte 4 — Verificação Final",
    items: [
      { id: "laudos_assinados", label: "Laudos assinados digitalmente?" },
      { id: "numeros_consistentes", label: "Números consistentes entre os laudos?" },
      { id: "projecoes_embasadas", label: "Projeções embasadas em histórico real?" },
      { id: "fonte_oficial_citada", label: "Fonte climática oficial citada?" },
      { id: "fotos_incluidas", label: "Registro fotográfico incluído?" },
      { id: "declaracao_obtida", label: "Declaração do produtor obtida?" },
      { id: "saldo_atualizado", label: "Saldo devedor atualizado solicitado?" },
      { id: "prazo_realista", label: "Proposta de prazo realista?", critical: true },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  checked: Record<string, boolean>;
  onCheckedChange: (checked: Record<string, boolean>) => void;
  notes: Record<string, string>;
  onNotesChange: (notes: Record<string, string>) => void;
}

export function ChecklistProdutor({ open, onClose, checked, onCheckedChange, notes, onNotesChange }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ produtor: true });

  const toggleSection = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const toggleItem = (id: string) => onCheckedChange({ ...checked, [id]: !checked[id] });

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 z-40 h-full w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right-full duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent" />
          <h2 className="font-display font-bold text-foreground text-sm">Checklist do Produtor</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Progresso</span>
          <span className={cn("font-bold", progress === 100 ? "text-success" : "text-accent")}>
            {checkedCount}/{totalItems}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className={cn("h-1.5 rounded-full transition-all duration-500", progress === 100 ? "bg-success" : "bg-accent")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => {
          const sectionChecked = section.items.filter((i) => checked[i.id]).length;
          const isExpanded = expanded[section.id];

          return (
            <div key={section.id} className="border-b border-border">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {section.part && (
                    <span className="text-[10px] uppercase tracking-wider text-accent font-semibold block">{section.part}</span>
                  )}
                  <span className="text-sm font-semibold text-foreground">{section.title}</span>
                </div>
                <span className={cn("text-xs font-bold shrink-0", sectionChecked === section.items.length ? "text-success" : "text-muted-foreground")}>
                  {sectionChecked}/{section.items.length}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-1">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm",
                        checked[item.id] ? "bg-success/5" : "hover:bg-muted/50"
                      )}
                    >
                      {checked[item.id] ? (
                        <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-border shrink-0 mt-0.5" />
                      )}
                      <span className={cn("flex-1", checked[item.id] ? "text-muted-foreground line-through" : "text-foreground")}>
                        {item.label}
                      </span>
                      {item.critical && !checked[item.id] && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
