import { useRef } from "react";
import { lerTudo } from "@/lib/lerTudo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildContratoKey, type Contrato } from "@/hooks/useVencimentosData";
import { parseCSVLine, detectSeparator, normalizeHeader } from "@/components/vencimentos/lib/csv";
import { formatDateBR } from "@/components/vencimentos/lib/helpers";
import type { User } from "@supabase/supabase-js";

interface UseCsvImportExportOptions {
  user: User | null;
  filtered: Contrato[];
  onAfterImport: (info: { duplicateConflicts: number }) => void | Promise<void>;
}

export function useCsvImportExport({ user, filtered, onAfterImport }: UseCsvImportExportOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("Arquivo vazio");
        return;
      }

      const separator = detectSeparator(lines[0]);
      const headers = parseCSVLine(lines[0], separator).map(normalizeHeader);
      const rows = lines.slice(1);

      const { data: existingRows, error: existingError } = await lerTudo(() => supabase
        .from("contratos_vencimentos")
        .select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_total_operacao"));

      if (existingError) throw existingError;

      const lookup = new Map<string, Array<{ id: string }>>();
      for (const existing of (existingRows || []) as Array<Pick<Contrato, "id" | "nome_cliente" | "banco" | "numero_contrato" | "vencimento_proxima_parcela" | "valor_total_operacao">>) {
        const key = buildContratoKey(existing);
        if (!key) continue;
        const items = lookup.get(key) || [];
        items.push({ id: existing.id });
        lookup.set(key, items);
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let duplicateConflicts = 0;

      for (const row of rows) {
        const cols = parseCSVLine(row, separator);
        if (cols.length < 2 || cols.every((c) => !c)) continue;

        const get = (name: string) => {
          const idx = headers.findIndex((h) => h.includes(name));
          return idx >= 0 ? cols[idx] : "";
        };

        const parseMoney = (val: string) => {
          if (!val) return null;
          const cleaned = val.replace(/[R$\s]/g, "");
          const lastDot = cleaned.lastIndexOf(".");
          const lastComma = cleaned.lastIndexOf(",");

          let numeric: string;
          if (lastComma > lastDot) {
            numeric = cleaned.replace(/\./g, "").replace(",", ".");
          } else {
            numeric = cleaned.replace(/,/g, "");
          }

          const n = parseFloat(numeric);
          return isNaN(n) ? null : n;
        };

        const parseDate = (val: string) => {
          if (!val) return null;
          const trimmed = val.trim();

          const brMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
          if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;

          const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (isoMatch) return trimmed;

          return null;
        };

        const parseBool = (val: string) => {
          const v = val.trim().toUpperCase();
          return v === "TRUE" || v === "SIM" || v === "S" || v === "1" || v === "X";
        };

        const payload = {
          user_id: user.id,
          nome_cliente: get("nome") || get("cliente") || cols[0] || "",
          banco: get("banco") || cols[1] || null,
          numero_contrato: get("contrato") || get("numero") || cols[2] || null,
          vencimento_proxima_parcela: parseDate(get("vencimento") || cols[3] || ""),
          valor_parcela: parseMoney(get("parcela") || cols[4] || ""),
          valor_total_operacao: parseMoney(get("total") || get("operacao") || get("valor") || cols[5] || ""),
          parcelas_vencidas: parseBool(get("vencidas") || cols[6] || ""),
          possui_laudo: parseBool(get("laudo") || cols[7] || ""),
          data_limite_protocolo: get("limite") || get("protocolo") || cols[8] || null,
          protocolo_realizado: parseBool(get("realizado") || cols[9] || ""),
          status_prazo: get("status") || cols[13] || "pendente",
          updated_at: new Date().toISOString(),
        };

        if (!payload.nome_cliente) {
          skipped++;
          continue;
        }

        const key = buildContratoKey(payload);
        if (!key) {
          skipped++;
          continue;
        }

        const matches = lookup.get(key) || [];

        if (matches.length > 1) {
          duplicateConflicts++;
          continue;
        }

        if (matches.length === 1) {
          const { error: updateError } = await supabase
            .from("contratos_vencimentos")
            .update(payload)
            .eq("id", matches[0].id);

          if (updateError) {
            skipped++;
            continue;
          }

          updated++;
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("contratos_vencimentos")
          .insert(payload)
          .select("id, nome_cliente, banco, numero_contrato, vencimento_proxima_parcela, valor_total_operacao")
          .single();

        if (insertError || !inserted) {
          skipped++;
          continue;
        }

        created++;
        lookup.set(key, [{ id: inserted.id }]);
      }

      toast.success(`Importação concluída: ${created} novos, ${updated} atualizados${skipped > 0 ? `, ${skipped} ignorados` : ""}`);

      if (duplicateConflicts > 0) {
        toast.info(`${duplicateConflicts} linha(s) conflitante(s): já existem contratos duplicados cadastrados. Revise para editar/excluir.`);
      }

      await onAfterImport({ duplicateConflicts });
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar CSV");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportCSV = () => {
    const headers = [
      "Cliente",
      "Banco",
      "Contrato",
      "Vencimento",
      "Valor Parcela",
      "Valor Total",
      "Vencidas",
      "Laudo",
      "Limite Protocolo",
      "Protocolo",
      "Status",
    ];

    const rows = filtered.map((c) => [
      c.nome_cliente,
      c.banco,
      c.numero_contrato,
      formatDateBR(c.vencimento_proxima_parcela),
      c.valor_parcela?.toFixed(2) || "",
      c.valor_total_operacao?.toFixed(2) || "",
      c.parcelas_vencidas ? "SIM" : "NÃO",
      c.possui_laudo ? "SIM" : "NÃO",
      c.data_limite_protocolo || "",
      c.protocolo_realizado ? "SIM" : "NÃO",
      c.status_prazo || "",
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vencimentos.csv";
    a.click();
  };

  return { fileInputRef, handleImportCSV, exportCSV };
}