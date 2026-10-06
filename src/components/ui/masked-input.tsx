import * as React from "react";
import { Input } from "@/components/ui/input";

export type MaskPreset =
  | "cpf"
  | "cnpj"
  | "cpfCnpj"
  | "telefone"
  | "cep"
  | "cnj"
  | "data";

const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");

function applyMask(preset: MaskPreset, raw: string): string {
  const d = onlyDigits(raw);
  switch (preset) {
    case "cpf": {
      const s = d.slice(0, 11);
      return s
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }
    case "cnpj": {
      const s = d.slice(0, 14);
      return s
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    case "cpfCnpj": {
      const s = d.slice(0, 14);
      if (s.length <= 11) return applyMask("cpf", s);
      return applyMask("cnpj", s);
    }
    case "telefone": {
      const s = d.slice(0, 11);
      if (s.length <= 10) {
        // (00) 0000-0000
        return s
          .replace(/^(\d{0,2})/, (_, a) => (a ? `(${a}` : ""))
          .replace(/^(\(\d{2})(\d)/, "$1) $2")
          .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
      }
      // (00) 00000-0000
      return s
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
    }
    case "cep": {
      const s = d.slice(0, 8);
      return s.replace(/^(\d{5})(\d)/, "$1-$2");
    }
    case "cnj": {
      // 0000000-00.0000.0.00.0000 (20 dígitos)
      const s = d.slice(0, 20);
      return s
        .replace(/^(\d{7})(\d)/, "$1-$2")
        .replace(/^(\d{7})-(\d{2})(\d)/, "$1-$2.$3")
        .replace(/^(\d{7})-(\d{2})\.(\d{4})(\d)/, "$1-$2.$3.$4")
        .replace(/^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})(\d)/, "$1-$2.$3.$4.$5")
        .replace(/^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})(\d)/, "$1-$2.$3.$4.$5.$6");
    }
    case "data": {
      const s = d.slice(0, 8);
      return s
        .replace(/^(\d{2})(\d)/, "$1/$2")
        .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
    }
    default:
      return raw;
  }
}

export interface MaskedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  mask: MaskPreset;
  value: string | null | undefined;
  /** Recebe o valor já FORMATADO (o que é exibido / salvo). */
  onChange: (formatted: string) => void;
}

/**
 * Input controlado com máscara progressiva. Não valida — apenas formata.
 * Aceita valor inicial cru ou já formatado e re-aplica a máscara.
 * Comparações que dependem só dos dígitos devem usar `String(v).replace(/\D+/g,"")`.
 */
export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, inputMode, maxLength, ...rest }, ref) => {
    const formatted = React.useMemo(() => applyMask(mask, String(value ?? "")), [mask, value]);
    return (
      <Input
        ref={ref}
        value={formatted}
        onChange={(e) => onChange(applyMask(mask, e.target.value))}
        inputMode={inputMode ?? "numeric"}
        maxLength={maxLength}
        {...rest}
      />
    );
  }
);
MaskedInput.displayName = "MaskedInput";

export { applyMask as applyMaskPreset, onlyDigits as digitsOnly };