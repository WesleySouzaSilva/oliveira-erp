// Cálculo dos feriados nacionais (fixos e móveis) e de dias úteis.
// Mesma regra usada pela integração do ADVBOX.

export const isoDia = (d: Date) => d.toISOString().slice(0, 10);

const maisDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

/** Domingo de Páscoa (Meeus/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

export function feriadosNacionais(ano: number): { data: string; nome: string }[] {
  const p = pascoa(ano);
  return [
    { data: `${ano}-01-01`, nome: "Confraternização Universal" },
    { data: isoDia(maisDias(p, -48)), nome: "Carnaval (segunda)" },
    { data: isoDia(maisDias(p, -47)), nome: "Carnaval" },
    { data: isoDia(maisDias(p, -2)), nome: "Sexta-feira Santa" },
    { data: isoDia(p), nome: "Páscoa" },
    { data: `${ano}-04-21`, nome: "Tiradentes" },
    { data: `${ano}-05-01`, nome: "Dia do Trabalho" },
    { data: isoDia(maisDias(p, 60)), nome: "Corpus Christi" },
    { data: `${ano}-09-07`, nome: "Independência" },
    { data: `${ano}-10-12`, nome: "Nossa Senhora Aparecida" },
    { data: `${ano}-11-02`, nome: "Finados" },
    { data: `${ano}-11-15`, nome: "Proclamação da República" },
    { data: `${ano}-11-20`, nome: "Consciência Negra" },
    { data: `${ano}-12-25`, nome: "Natal" },
  ].sort((a, b) => a.data.localeCompare(b.data));
}

export const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export const diaSemanaBR = (iso: string) =>
  ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][
    new Date(`${iso}T12:00:00Z`).getUTCDay()
  ];

// ---- Calendário de dias úteis ---------------------------------------------

export interface Calendario {
  /** Datas ISO que não são dia útil (feriados nacionais + estaduais/municipais/recesso). */
  feriados: Set<string>;
}

/**
 * Monta o calendário do ano base -1 até +2, somando os feriados cadastrados
 * (estaduais, municipais e recesso) e removendo os nacionais desativados.
 */
export function montarCalendario(
  anoBase: number,
  extras: { data: string; ativo?: boolean | null }[] = [],
): Calendario {
  const feriados = new Set<string>();
  for (let a = anoBase - 1; a <= anoBase + 2; a++) {
    feriadosNacionais(a).forEach((f) => feriados.add(f.data));
  }
  extras.forEach((e) => {
    const d = e.data.slice(0, 10);
    if (e.ativo === false) feriados.delete(d);
    else feriados.add(d);
  });
  return { feriados };
}

export const ehDiaUtil = (iso: string, cal: Calendario) => {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !cal.feriados.has(iso);
};

const desloca = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return isoDia(d);
};

export function proximoDiaUtil(iso: string, cal: Calendario): string {
  let d = iso;
  for (let i = 0; i < 40 && !ehDiaUtil(d, cal); i++) d = desloca(d, 1);
  return d;
}

export function diaUtilAnterior(iso: string, cal: Calendario): string {
  let d = iso;
  for (let i = 0; i < 40 && !ehDiaUtil(d, cal); i++) d = desloca(d, -1);
  return d;
}

/** Soma (ou subtrai, com n negativo) dias ÚTEIS a partir de uma data. */
export function somaDiasUteis(iso: string, n: number, cal: Calendario): string {
  const passo = n >= 0 ? 1 : -1;
  let restam = Math.abs(n);
  let d = iso;
  let guarda = 0;
  while (restam > 0 && guarda++ < 400) {
    d = desloca(d, passo);
    if (ehDiaUtil(d, cal)) restam--;
  }
  return d;
}
