import { CheckCircle, AlertCircle, Info } from "lucide-react";

const hipoteses = [
  {
    id: "A",
    titulo: "Hipótese A — Frustração de safra por evento climático",
    descricao: "Comprovação de frustração de safra decorrente de fenômenos naturais como seca, geada, granizo, excesso de chuvas ou enchentes, com base em dados meteorológicos e laudo técnico.",
    requisitos: [
      "Laudo técnico agronômico atestando a frustração",
      "Dados meteorológicos do INMET ou órgão oficial",
      "Comparativo de produtividade esperada vs. realizada",
      "Registro no Proagro ou seguro rural (se houver)",
    ],
  },
  {
    id: "B",
    titulo: "Hipótese B — Queda de preço do produto",
    descricao: "Demonstração de que o preço de comercialização do produto caiu significativamente em relação ao preço vigente na época da contratação, inviabilizando a quitação.",
    requisitos: [
      "Cotações históricas do produto (CEPEA/ESALQ ou similares)",
      "Comparativo preço na contratação vs. preço na safra",
      "Demonstrativo de impacto na receita bruta",
    ],
  },
  {
    id: "C",
    titulo: "Hipótese C — Aumento extraordinário de custos de produção",
    descricao: "Comprovação de elevação anormal dos custos de produção (insumos, combustíveis, mão de obra) que comprometeu a capacidade de pagamento.",
    requisitos: [
      "Planilha de custos de produção detalhada",
      "Comparativo de custos projetados vs. realizados",
      "Notas fiscais dos principais insumos",
      "Índices de inflação setorial",
    ],
  },
  {
    id: "D",
    titulo: "Hipótese D — Combinação de fatores adversos",
    descricao: "Quando dois ou mais fatores adversos (climáticos, econômicos, fitossanitários) atuam conjuntamente, comprometendo a viabilidade da operação.",
    requisitos: [
      "Documentação comprobatória de cada fator",
      "Análise integrada dos impactos",
      "Parecer técnico justificando a combinação",
    ],
  },
];

interface Props {
  selected: string[];
  onChange: (selected: string[]) => void;
  data: Record<string, any>;
  onDataChange: (data: Record<string, any>) => void;
}

export function EtapaEnquadramento({ selected, onChange, data, onDataChange }: Props) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">
          Enquadramento MCR 2.6.4
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Selecione a(s) hipótese(s) que se aplicam ao caso para fundamentar a prorrogação.
        </p>

        <div className="bg-info/10 border border-info/20 rounded-lg p-4 mb-6 flex gap-3">
          <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Súmula 298 — STJ</p>
            <p className="text-xs text-muted-foreground">
              "O alongamento de dívida originada de crédito rural não constitui novação."
              É possível selecionar mais de uma hipótese.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {hipoteses.map((h) => {
            const isSelected = selected.includes(h.id);
            return (
              <div
                key={h.id}
                onClick={() => toggle(h.id)}
                className={`border rounded-xl p-5 cursor-pointer transition-all ${
                  isSelected
                    ? "border-accent bg-accent/5 shadow-sm"
                    : "border-border hover:border-accent/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    isSelected ? "border-accent bg-accent" : "border-border"
                  }`}>
                    {isSelected && <CheckCircle className="w-4 h-4 text-accent-foreground" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground mb-1">{h.titulo}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{h.descricao}</p>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-foreground">Requisitos documentais:</p>
                      {h.requisitos.map((r) => (
                        <div key={r} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Justificativa */}
      {selected.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Justificativa complementar</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Descreva brevemente por que as hipóteses selecionadas se aplicam ao caso.
          </p>
          <div className="floating-label-group">
            <textarea
              placeholder=" "
              rows={4}
              value={data.justificativa || ""}
              onChange={(e) => onDataChange({ ...data, justificativa: e.target.value })}
            />
            <label>Justificativa</label>
          </div>
        </section>
      )}
    </div>
  );
}
