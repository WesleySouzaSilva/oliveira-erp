import { FloatingInput, FloatingTextarea } from "./FloatingInputs";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck } from "lucide-react";
import {
  CAUSAS_FRUSTRACAO,
  DOCUMENTOS_ENTREVISTA,
  perguntasDaCultura,
} from "@/data/entrevistaPorCultura";

const CULTURAS = [
  "Soja","Milho","Café Arábica","Café Conilon","Pecuária Bovina de Corte",
  "Pecuária Bovina Leiteira","Arroz","Feijão","Trigo","Algodão",
  "Cana-de-açúcar","Laranja","Mandioca","Eucalipto","Sericicultura","Outro",
];

interface Props {
  /** Objeto `entrevista` guardado em dados_etapa1.entrevista */
  data: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}

export function EntrevistaProdutor({ data, onChange }: Props) {
  const set = (key: string, value: any) => onChange({ ...data, [key]: value });
  const perguntas = perguntasDaCultura(data.cultura);
  const docs: Record<string, string> = data.documentos || {};

  const setDoc = (nome: string, status: string) =>
    onChange({ ...data, documentos: { ...docs, [nome]: status } });

  const selectCls =
    "w-full h-11 px-3 rounded-lg border border-border bg-background text-sm text-foreground";

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1">Entrevista com o produtor</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Registro da reunião inicial. Cada laudo trata de uma cultura e de uma situação de frustração.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cultura do laudo</label>
            <select
              className={selectCls}
              value={data.cultura || ""}
              onChange={(e) => set("cultura", e.target.value)}
            >
              <option value="">Selecione...</option>
              {CULTURAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <FloatingInput
            label="Safra (ex.: 2023/2024)"
            value={data.safra || ""}
            onChange={(e) => set("safra", e.target.value)}
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Causa da frustração</label>
            <select
              className={selectCls}
              value={data.causa || ""}
              onChange={(e) => set("causa", e.target.value)}
            >
              <option value="">Selecione...</option>
              {CAUSAS_FRUSTRACAO.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <FloatingInput
            label="Período do evento (ex.: dez/2023 a fev/2024)"
            value={data.periodo || ""}
            onChange={(e) => set("periodo", e.target.value)}
          />
          <FloatingInput
            label="Perda estimada (%)"
            type="number"
            value={data.perda_estimada || ""}
            onChange={(e) => set("perda_estimada", e.target.value)}
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Seguro / Proagro</label>
            <select
              className={selectCls}
              value={data.seguro || ""}
              onChange={(e) => set("seguro", e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="nao">Não possuía</option>
              <option value="proagro">Proagro</option>
              <option value="seguro">Seguro agrícola privado</option>
              <option value="ambos">Proagro + seguro</option>
              <option value="acionado_negado">Acionado e negado</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <FloatingTextarea
            label="Relato do produtor"
            rows={4}
            value={data.relato || ""}
            onChange={(e) => set("relato", e.target.value)}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Perguntas específicas{data.cultura ? ` — ${data.cultura}` : ""}
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {perguntas.map((p) =>
            p.tipo === "longo" ? (
              <div key={p.key} className="md:col-span-2">
                <FloatingTextarea
                  label={p.label}
                  rows={3}
                  value={data[p.key] || ""}
                  onChange={(e) => set(p.key, e.target.value)}
                />
              </div>
            ) : (
              <FloatingInput
                key={p.key}
                label={p.label}
                type={p.tipo === "numero" ? "number" : "text"}
                tooltip={p.dica}
                value={data[p.key] || ""}
                onChange={(e) => set(p.key, e.target.value)}
              />
            ),
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" /> Documentos a recolher
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Marque o que já foi entregue. O que ficar pendente é o que deve ser cobrado após a reunião.
        </p>
        <div className="grid md:grid-cols-2 gap-2">
          {DOCUMENTOS_ENTREVISTA.map((nome) => {
            const recebido = docs[nome] === "recebido";
            return (
              <label
                key={nome}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <Checkbox
                  checked={recebido}
                  onCheckedChange={(v) => setDoc(nome, v ? "recebido" : "pendente")}
                />
                <span className={`text-sm ${recebido ? "text-foreground" : "text-muted-foreground"}`}>
                  {nome}
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-4">
          <FloatingTextarea
            label="Outros documentos / observações"
            rows={2}
            value={data.documentos_obs || ""}
            onChange={(e) => set("documentos_obs", e.target.value)}
          />
        </div>
      </section>
    </div>
  );
}