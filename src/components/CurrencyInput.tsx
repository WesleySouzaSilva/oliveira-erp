import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}

function formatBRL(cents: number): string {
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const decPart = (abs % 100).toString().padStart(2, "0");
  const formatted = intPart.toLocaleString("pt-BR");
  return `R$ ${cents < 0 ? "-" : ""}${formatted},${decPart}`;
}

function parseCentsFromRaw(raw: string): number {
  // Keep only digits
  const digits = raw.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function CurrencyInput({ value, onChange, placeholder = "R$ 0,00", className }: CurrencyInputProps) {
  const cents = value != null ? Math.round(value * 100) : 0;
  const display = value != null && value !== 0 ? formatBRL(cents) : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const newCents = parseCentsFromRaw(raw);
    if (newCents === 0) {
      onChange(null);
    } else {
      onChange(newCents / 100);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
    />
  );
}

