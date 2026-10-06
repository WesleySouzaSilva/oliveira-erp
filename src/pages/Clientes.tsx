import { lerTudo } from "@/lib/lerTudo";
import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/usePagination";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Search, UserPlus, Users, ChevronRight, Building2, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeSearch } from "@/lib/utils";
import { ListSkeleton } from "@/components/ui/loaders";
import { EmptyState } from "@/components/ui/empty-state";

const statusMap: Record<string, { label: string; color: string }> = {
  prospeccao: { label: "Prospecção", color: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em Andamento", color: "bg-primary/15 text-primary" },
  laudo_concluido: { label: "Laudo Concluído", color: "bg-accent/15 text-accent" },
  notificado: { label: "Notificado", color: "bg-yellow-500/15 text-yellow-700" },
  aguardando: { label: "Aguardando", color: "bg-orange-500/15 text-orange-700" },
  judicial: { label: "Via Judicial", color: "bg-destructive/15 text-destructive" },
  encerrado: { label: "Encerrado", color: "bg-green-500/15 text-green-700" },
};

const adimplenciaMap: Record<string, { label: string; color: string }> = {
  inadimplente: { label: "Inadimplente", color: "bg-destructive/15 text-destructive" },
  parcial: { label: "Parcial", color: "bg-yellow-500/15 text-yellow-700" },
};

interface ClienteResumo {
  id: string | null;
  nome_cliente: string;
  bancos: string[];
  total_contratos: number;
  sem_numero: number;
  total_atividades: number;
  status: string | null;
  vip: boolean;
  status_adimplencia: string;
}

const normBanco = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function Clientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      const [contratosRes, atividadesRes, laudosRes, clientesRes, operacoesRes] = await Promise.all([
        supabase.from("contratos_vencimentos").select("nome_cliente, banco, numero_contrato"),
        supabase.from("atividades_clientes").select("nome_cliente, status_cliente").is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("laudos").select("dados_etapa1"),
        lerTudo(() => supabase.from("clientes").select("id, nome, vip, status_adimplencia").is("deleted_at", null)),
        lerTudo(() => supabase.from("operacoes_credito").select("id, cliente_id, banco, numero, origem_arquivo").is("deleted_at", null)),
      ]);

      const contratos = contratosRes.data || [];
      const atividades = atividadesRes.data || [];
      const laudos = laudosRes.data || [];
      const clientesDb = clientesRes.data || [];
      const operacoes = operacoesRes.data || [];

      // Build a lookup for client profile data
      const perfilMap = new Map<string, { vip: boolean; status_adimplencia: string }>();
      const nomePorId = new Map<string, string>();
      const idPorNome = new Map<string, string>();
      for (const c of clientesDb as any[]) {
        perfilMap.set(c.nome?.toLowerCase(), { vip: c.vip || false, status_adimplencia: c.status_adimplencia || "adimplente" });
        if (c.id && c.nome) nomePorId.set(c.id, c.nome);
        if (c.id && c.nome) idPorNome.set(c.nome.toLowerCase(), c.id);
      }

      // Números já contados por cliente (evita contar o mesmo contrato duas vezes)
      const numerosPorCliente = new Map<string, Set<string>>();
      const numeroLimpo = (numero: string | null | undefined) => {
        const txt = (numero || "").trim();
        if (!txt || /^sem\s*n/i.test(txt)) return "";
        return txt.replace(/\D/g, "");
      };
      // Quando a operação veio da varredura sem número, tenta o número que está no nome do arquivo
      const numeroDoArquivo = (arquivo: string | null | undefined) => {
        const nome = (arquivo || "").split(/[\\/]/).pop() || "";
        const achados = nome.match(/\d{5,}/g);
        return achados && achados.length ? achados[0] : "";
      };
      // Retorna: "novo" | "repetido" | "sem-numero"
      const registraNumero = (key: string, numero: string) => {
        if (!numero) return "sem-numero" as const;
        if (!numerosPorCliente.has(key)) numerosPorCliente.set(key, new Set());
        const set = numerosPorCliente.get(key)!;
        if (set.has(numero)) return "repetido" as const;
        set.add(numero);
        return "novo" as const;
      };

      const novoResumo = (nome: string, key: string): ClienteResumo => {
        const perfil = perfilMap.get(key);
        return {
          id: idPorNome.get(key) || null,
          nome_cliente: nome,
          bancos: [],
          total_contratos: 0,
          sem_numero: 0,
          total_atividades: 0,
          status: null,
          vip: perfil?.vip || false,
          status_adimplencia: perfil?.status_adimplencia || "adimplente",
        };
      };

      const bancosPorCliente = new Map<string, Map<string, string>>();
      const addBanco = (key: string, bancoValor: string | null | undefined) => {
        const banco = String(bancoValor || "").trim();
        if (!banco) return;
        const bancoKey = normBanco(banco);
        if (!bancosPorCliente.has(key)) bancosPorCliente.set(key, new Map());
        const mapa = bancosPorCliente.get(key)!;
        if (mapa.has(bancoKey)) return;
        mapa.set(bancoKey, banco);
      };

      const clienteMap = new Map<string, ClienteResumo>();

      for (const c of contratos) {
        const nome = c.nome_cliente.trim();
        const key = nome.toLowerCase();
        if (!clienteMap.has(key)) clienteMap.set(key, novoResumo(nome, key));
        const entry = clienteMap.get(key)!;
        const res = registraNumero(key, numeroLimpo((c as any).numero_contrato));
        if (res === "novo") entry.total_contratos++;
        else if (res === "sem-numero") entry.sem_numero++;
        addBanco(key, c.banco);
      }

      // Operações de crédito (cadastro de fechamento / radar)
      for (const o of operacoes as any[]) {
        const nome = (o.cliente_id ? nomePorId.get(o.cliente_id) : null)?.trim();
        if (!nome) continue;
        const key = nome.toLowerCase();
        if (!clienteMap.has(key)) clienteMap.set(key, novoResumo(nome, key));
        const entry = clienteMap.get(key)!;
        const num = numeroLimpo(o.numero) || numeroDoArquivo(o.origem_arquivo);
        const res = registraNumero(key, num);
        if (res === "novo") entry.total_contratos++;
        else if (res === "sem-numero") entry.sem_numero++;
        addBanco(key, o.banco);
      }




      for (const l of laudos) {
        const d1 = (l.dados_etapa1 || {}) as Record<string, any>;
        const nome = (d1.nomeProdutor || d1.nome || "").trim();
        if (!nome) continue;
        const key = nome.toLowerCase();
        if (!clienteMap.has(key)) clienteMap.set(key, novoResumo(nome, key));
      }

      for (const a of atividades) {
        const key = a.nome_cliente.trim().toLowerCase();
        const entry = clienteMap.get(key);
        if (entry) {
          entry.total_atividades++;
          if (!entry.status && (a as any).status_cliente) {
            entry.status = (a as any).status_cliente;
          }
        }
      }

      // Also add clients from clientes table that might not be in contratos/laudos
      for (const c of clientesDb as any[]) {
        const key = c.nome?.toLowerCase();
        if (key && !clienteMap.has(key)) clienteMap.set(key, novoResumo(c.nome, key));
      }

      setClientes(
        Array.from(clienteMap.entries()).map(([key, c]) => ({
          ...c,
          bancos: Array.from((bancosPorCliente.get(key) || new Map()).values()).sort((a, b) => a.localeCompare(b)),
        })).sort((a, b) => {
          // VIP first, then alphabetical
          if (a.vip !== b.vip) return a.vip ? -1 : 1;
          return a.nome_cliente.localeCompare(b.nome_cliente);
        })
      );
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = clientes.filter((c) => {
    const matchBusca = busca ? normalizeSearch(c.nome_cliente).includes(normalizeSearch(busca)) : true;
    return matchBusca;
  });

  const { paginatedItems, hasMore, totalCount, shownCount, loadMore } = usePagination(filtered, { pageSize: 50 });

  return (
    <AppLayout>
      <PageHeader
        icon={Users}
        title="Clientes"
        subtitle={`${clientes.length} clientes cadastrados`}
        breadcrumb={[{ label: "Agro" }, { label: "Clientes" }]}
        actions={
          <button
            onClick={() => navigate("/novo-cliente")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all"
          >
            <UserPlus className="w-4 h-4" /> Novo Cliente
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente por nome..."
          className="pl-9"
        />
      </div>

      {/* Client list */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={busca ? "Ajuste a busca ou cadastre um novo cliente." : "Cadastre o primeiro cliente para começar."}
          action={{ label: "Novo cliente", icon: UserPlus, onClick: () => navigate("/novo-cliente") }}
        />
      ) : (
        <div className="space-y-2">
          {paginatedItems.map((cliente) => (
            <div
              key={cliente.nome_cliente}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/clientes/${encodeURIComponent(cliente.nome_cliente)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/clientes/${encodeURIComponent(cliente.nome_cliente)}`);
              }}
              className="w-full cursor-pointer flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-all text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary" data-private>
                      {cliente.nome_cliente.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {cliente.vip && (
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 absolute -top-1 -right-1" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground truncate" data-private>{cliente.nome_cliente}</p>
                    {cliente.vip && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 shrink-0">VIP</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-0.5">
                    {cliente.bancos.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        Bancos
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {cliente.total_contratos} contrato{cliente.total_contratos !== 1 ? "s" : ""}
                    </span>
                    {cliente.sem_numero > 0 && (
                      <span className="text-xs text-muted-foreground/80" title="Documentos sem número de contrato identificado">
                        +{cliente.sem_numero} sem número
                      </span>
                    )}
                    {cliente.total_atividades > 0 && (
                      <span className="text-xs text-accent font-medium">
                        {cliente.total_atividades} atividade{cliente.total_atividades !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex max-w-[46%] flex-wrap items-center justify-end gap-2 shrink-0">
                {adimplenciaMap[cliente.status_adimplencia] && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${adimplenciaMap[cliente.status_adimplencia].color}`}>
                    {adimplenciaMap[cliente.status_adimplencia].label}
                  </span>
                )}
                {cliente.status && statusMap[cliente.status] && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${statusMap[cliente.status].color}`}>
                    {statusMap[cliente.status].label}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>
          ))}
          <LoadMoreButton
            shownCount={shownCount}
            totalCount={totalCount}
            hasMore={hasMore}
            onLoadMore={loadMore}
            label="clientes"
          />
        </div>
      )}
    </AppLayout>
  );
}
