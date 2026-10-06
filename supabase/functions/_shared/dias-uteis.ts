// Calendário de dias úteis: fins de semana + feriados nacionais (fixos e móveis)
// + feriados estaduais/municipais/recesso cadastrados pela equipe.

export const isoDia = (d: Date) => d.toISOString().slice(0, 10);

const novaData = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** Domingo de Páscoa (algoritmo de Meeus/Butcher). */
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

const maisDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

/** Feriados nacionais do ano, incluindo os móveis. */
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
  ];
}

export type Calendario = {
  ehFeriado: (iso: string) => boolean;
  nomeFeriado: (iso: string) => string | null;
  ehDiaUtil: (iso: string) => boolean;
  proximoDiaUtil: (iso: string) => string;
  diaUtilAnterior: (iso: string) => string;
  /** Soma (ou subtrai, com n negativo) dias úteis a partir de um dia. */
  somaDiasUteis: (iso: string, n: number) => string;
  /** Último dia útil da semana corrente (sexta ou o dia útil anterior). */
  ehUltimoDiaUtilDaSemana: (iso: string) => boolean;
};

/**
 * Monta o calendário: nacionais calculados dos anos pedidos + linhas da tabela
 * `feriados` (ativo=false na mesma data desliga o nacional).
 */
export function montarCalendario(
  anos: number[],
  extras: { data: string; nome: string; ativo: boolean }[] = [],
): Calendario {
  const mapa = new Map<string, string>();
  for (const ano of anos) {
    for (const f of feriadosNacionais(ano)) mapa.set(f.data, f.nome);
  }
  for (const e of extras) {
    if (e.ativo) mapa.set(e.data, e.nome);
    else mapa.delete(e.data);
  }

  const ehFeriado = (iso: string) => mapa.has(iso);
  const fimDeSemana = (iso: string) => {
    const dow = novaData(iso).getUTCDay();
    return dow === 0 || dow === 6;
  };
  const ehDiaUtil = (iso: string) => !fimDeSemana(iso) && !ehFeriado(iso);

  const anda = (iso: string, passo: number) => {
    let d = novaData(iso);
    for (let i = 0; i < 400; i++) {
      d = maisDias(d, passo);
      if (ehDiaUtil(isoDia(d))) return isoDia(d);
    }
    return isoDia(d);
  };

  const proximoDiaUtil = (iso: string) => (ehDiaUtil(iso) ? iso : anda(iso, 1));
  const diaUtilAnterior = (iso: string) => (ehDiaUtil(iso) ? iso : anda(iso, -1));

  const somaDiasUteis = (iso: string, n: number) => {
    if (n === 0) return proximoDiaUtil(iso);
    let atual = iso;
    const passo = n > 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(n); i++) atual = anda(atual, passo);
    return atual;
  };

  const ehUltimoDiaUtilDaSemana = (iso: string) => {
    if (!ehDiaUtil(iso)) return false;
    let d = novaData(iso);
    // Sábado e domingo nunca são úteis; basta olhar até o próximo domingo.
    for (let i = 0; i < 7; i++) {
      d = maisDias(d, 1);
      const dow = d.getUTCDay();
      if (dow === 0) return true; // chegou no domingo sem achar outro dia útil
      if (ehDiaUtil(isoDia(d))) return false;
    }
    return true;
  };

  return {
    ehFeriado,
    nomeFeriado: (iso: string) => mapa.get(iso) ?? null,
    ehDiaUtil,
    proximoDiaUtil,
    diaUtilAnterior,
    somaDiasUteis,
    ehUltimoDiaUtilDaSemana,
  };
}

/** Carrega o calendário usando a tabela `feriados` (client com service role). */
export async function carregarCalendario(
  supabaseAdmin: { from: (t: string) => any },
  anoBase = new Date().getUTCFullYear(),
): Promise<Calendario> {
  let extras: { data: string; nome: string; ativo: boolean }[] = [];
  try {
    const { data } = await supabaseAdmin.from("feriados").select("data, nome, ativo");
    extras = ((data as any[]) || []).map((r) => ({
      data: String(r.data).slice(0, 10),
      nome: r.nome,
      ativo: r.ativo !== false,
    }));
  } catch {
    extras = [];
  }
  return montarCalendario([anoBase - 1, anoBase, anoBase + 1, anoBase + 2], extras);
}

/**
 * Data do evento (quando a tarefa aparece na agenda): 15 dias úteis antes do
 * prazo fatal, nunca depois do último dia útil anterior a ele, nunca antes de
 * hoje (ou do próximo dia útil).
 */
export function dataEvento(cal: Calendario, prazoFatalIso: string, hojeIso: string, diasUteis = 15) {
  const piso = cal.proximoDiaUtil(hojeIso);
  const vespera = cal.somaDiasUteis(prazoFatalIso, -1);
  let evento = cal.somaDiasUteis(prazoFatalIso, -diasUteis);
  if (evento > vespera) evento = vespera; // regra da véspera
  if (evento < piso) evento = piso;       // nunca no passado
  return evento;
}
