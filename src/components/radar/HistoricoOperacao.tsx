import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History } from "lucide-react";

interface Registro {
  id: string;
  acao: string;
  campos_alterados: string[] | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

/** Nomes amigáveis dos campos acompanhados. */
const ROTULOS: Record<string, string> = {
  vence_em: "Vencimento",
  responsavel: "Responsável",
  banco: "Banco",
  numero: "Nº da operação",
  modalidade: "Modalidade",
  saldo_devedor: "Saldo devedor",
  notificado_em: "Data do protocolo",
  protocolo_ref: "Referência do protocolo",
  dispensar_alerta: "Alerta dispensado",
  dispensa_motivo: "Motivo da dispensa",
  data_conferida: "Data conferida",
  status_conferencia: "Situação da conferência",
  laudo_status: "Laudo",
  pronta_protocolar: "Pronta para protocolar",
  grupo: "Grupo",
  cliente_id: "Ficha do cliente",
  alteracao_motivo: "Motivo informado",
  deleted_at: "Arquivamento",
};

const ACOES: Record<string, string> = {
  INSERT: "Cadastro",
  UPDATE: "Alteração",
  DELETE: "Arquivamento",
};

function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (v === true) return "sim";
  if (v === false) return "não";
  const s = String(v);
  const data = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (data) return `${data[3]}/${data[2]}/${data[1]}`;
  return s;
}

const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function HistoricoOperacao({ operacaoId }: { operacaoId: string }) {
  const [itens, setItens] = useState<Registro[]>([]);
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("audit_log")
        .select("id, acao, campos_alterados, dados_anteriores, dados_novos, user_id, created_at")
        .eq("tabela", "operacoes_credito")
        .eq("registro_id", operacaoId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!ativo) return;
      const lista = (data || []) as unknown as Registro[];
      setItens(lista);

      const ids = Array.from(new Set(lista.map((i) => i.user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles_publico").select("id, nome").in("id", ids);
        if (!ativo) return;
        const mapa: Record<string, string> = {};
        (profs || []).forEach((p: { id: string; nome: string | null }) => {
          mapa[p.id] = p.nome || "—";
        });
        setAutores(mapa);
      }
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, [operacaoId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        <History className="w-6 h-6 mx-auto mb-2 opacity-60" />
        Nenhuma alteração registrada ainda.
      </div>
    );
  }

  return (
    <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
      {itens.map((it) => {
        const campos = (it.campos_alterados || []).filter((c) => ROTULOS[c]);
        return (
          <div key={it.id} className="border rounded-md p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{ACOES[it.acao] || it.acao}</span>
              <span className="text-xs text-muted-foreground">
                {dataHoraBR(it.created_at)} · {it.user_id ? autores[it.user_id] || "—" : "sistema"}
              </span>
            </div>
            {it.acao === "UPDATE" && (
              <ul className="mt-2 space-y-1">
                {campos.length === 0 ? (
                  <li className="text-xs text-muted-foreground">Sem campos acompanhados nesta alteração.</li>
                ) : (
                  campos.map((c) => (
                    <li key={c} className="text-xs">
                      <span className="text-muted-foreground">{ROTULOS[c]}: </span>
                      <span className="line-through opacity-70">{valor(it.dados_anteriores?.[c])}</span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">{valor(it.dados_novos?.[c])}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
