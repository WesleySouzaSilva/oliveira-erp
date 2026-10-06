import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Upload, FileText, Search, UserPlus, Users, ChevronDown, ChevronUp, TrendingDown, Wallet, Layers } from "lucide-react";
import { FloatingInput, FloatingSelect } from "./FloatingInputs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const culturas = [
  "Soja","Milho","Café Arábica","Café Conilon","Pecuária Bovina de Corte",
  "Pecuária Bovina Leiteira","Arroz","Feijão","Trigo","Algodão",
  "Cana-de-açúcar","Laranja","Mandioca","Eucalipto","Sericicultura","Outro",
];

const bancos = [
  "Banco do Brasil","Caixa Econômica Federal","Bradesco","Itaú","Santander",
  "Sicoob","Sicredi","Banrisul","BNB","BASA","BNDES","Banco Safra","Banco CNH",
  "BTG Pactual","ABC Brasil","Rabobank","Outro",
];

interface Contrato {
  id: string;
  banco: string[];
  contrato: string;
  modalidade: string;
  valorOriginal: string;
  saldoDevedor: string;
  dataVencimento: string;
  arquivoNome?: string;
  arquivoUrl?: string;
  arquivoFile?: File;
}

interface MembroFamiliar {
  id: string;
  nome: string;
  documento: string;
  tipoPessoa: "fisica" | "juridica";
  email: string;
  telefone: string;
  parentesco: string;
  contratos: Contrato[];
}

function criarContrato(): Contrato {
  return {
    id: crypto.randomUUID(),
    banco: [],
    contrato: "",
    modalidade: "",
    valorOriginal: "",
    saldoDevedor: "",
    dataVencimento: "",
  };
}

function criarMembro(): MembroFamiliar {
  return {
    id: crypto.randomUUID(),
    nome: "",
    documento: "",
    tipoPessoa: "fisica",
    email: "",
    telefone: "",
    parentesco: "",
    contratos: [criarContrato()],
  };
}

interface Props {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function EtapaIdentificacao({ data, onChange }: Props) {
  const { user } = useAuth();
  const [clientSource, setClientSource] = useState<"novo" | "existente">(data._clientSource || "novo");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [grupoFamiliar, setGrupoFamiliar] = useState<boolean>(data.grupoFamiliar || false);
  const [membrosExpandidos, setMembrosExpandidos] = useState<Record<string, boolean>>({});

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search across existing laudos AND contratos_vencimentos
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2 || !user || clientSource !== "existente") {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);

      // Search laudos
      const { data: laudos } = await supabase
        .from("laudos")
        .select("id, numero_laudo, dados_etapa1")
        .order("created_at", { ascending: false })
        .limit(50);

      // Search contratos_vencimentos
      const { data: contratos } = await supabase
        .from("contratos_vencimentos")
        .select("nome_cliente, banco, numero_contrato")
        .ilike("nome_cliente", `%${q}%`)
        .limit(30);

      const results: any[] = [];
      const seenNames = new Set<string>();

      // Add laudo results
      if (laudos) {
        const filtered = laudos.filter((l) => {
          const d1 = (l.dados_etapa1 || {}) as Record<string, any>;
          const nome = (d1.nome || "").toLowerCase();
          const doc = (d1.documento || "").toLowerCase();
          const prop = (d1.nomePropriedade || "").toLowerCase();
          const membrosMatch = (d1.membros || []).some((m: any) =>
            (m.nome || "").toLowerCase().includes(q.toLowerCase()) ||
            (m.documento || "").toLowerCase().includes(q.toLowerCase())
          );
          const term = q.toLowerCase();
          return nome.includes(term) || doc.includes(term) || prop.includes(term) || membrosMatch;
        });
        for (const l of filtered.slice(0, 10)) {
          const d1 = (l.dados_etapa1 || {}) as Record<string, any>;
          seenNames.add((d1.nome || "").toLowerCase().trim());
          results.push({ ...l, _source: "laudo" });
        }
      }

      // Add contrato-only clients (not already in laudos)
      if (contratos) {
        const grouped = new Map<string, { bancos: string[]; contratos: string[] }>();
        for (const c of contratos) {
          const key = c.nome_cliente.trim().toLowerCase();
          if (seenNames.has(key)) continue;
          if (!grouped.has(key)) grouped.set(key, { bancos: [], contratos: [] });
          const g = grouped.get(key)!;
          if (c.banco && !g.bancos.includes(c.banco)) g.bancos.push(c.banco);
          if (c.numero_contrato && !g.contratos.includes(c.numero_contrato)) g.contratos.push(c.numero_contrato);
        }
        for (const [key, info] of grouped) {
          const nome = contratos.find(c => c.nome_cliente.trim().toLowerCase() === key)!.nome_cliente;
          results.push({
            id: `contrato-${key}`,
            _source: "contrato",
            _clienteNome: nome,
            _bancos: info.bancos,
            _numContratos: info.contratos.length || 1,
            dados_etapa1: { nome },
          });
        }
      }

      setSearchResults(results.slice(0, 15));
      setShowResults(results.length > 0);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchQuery, user, clientSource]);

  const handleSelectClient = (laudo: any) => {
    const d1 = (laudo.dados_etapa1 || {}) as Record<string, any>;
    onChange({ ...d1, _clientSource: "existente", _fromLaudoId: laudo.id });
    setGrupoFamiliar(d1.grupoFamiliar || false);
    setShowResults(false);
    setSearchQuery("");
  };

  const update = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // --- Grupo familiar: membros adicionais ---
  const membros: MembroFamiliar[] = data.membros || [];
  const updateMembros = (next: MembroFamiliar[]) => update("membros", next);

  const addMembro = () => {
    updateMembros([...membros, criarMembro()]);
    // Expand the new member
    const newId = membros.length; // index-based since we don't have id yet
    setMembrosExpandidos((prev) => ({ ...prev }));
  };

  const removeMembro = (idx: number) => {
    updateMembros(membros.filter((_, i) => i !== idx));
  };

  const updateMembro = (idx: number, field: keyof MembroFamiliar, value: any) => {
    const next = [...membros];
    next[idx] = { ...next[idx], [field]: value };
    updateMembros(next);
  };

  const toggleMembroExpanded = (id: string) => {
    setMembrosExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Contratos do membro
  const updateMembroContrato = (membroIdx: number, contratoIdx: number, field: keyof Contrato, value: any) => {
    const next = [...membros];
    const contratos = [...(next[membroIdx].contratos || [])];
    contratos[contratoIdx] = { ...contratos[contratoIdx], [field]: value };
    next[membroIdx] = { ...next[membroIdx], contratos };
    updateMembros(next);
  };

  const addMembroContrato = (membroIdx: number) => {
    const next = [...membros];
    next[membroIdx] = { ...next[membroIdx], contratos: [...(next[membroIdx].contratos || []), criarContrato()] };
    updateMembros(next);
  };

  const removeMembroContrato = (membroIdx: number, contratoIdx: number) => {
    const next = [...membros];
    const contratos = next[membroIdx].contratos.filter((_, i) => i !== contratoIdx);
    next[membroIdx] = { ...next[membroIdx], contratos: contratos.length > 0 ? contratos : [criarContrato()] };
    updateMembros(next);
  };

  const toggleMembroBanco = (membroIdx: number, contratoIdx: number, banco: string) => {
    const current: string[] = membros[membroIdx].contratos[contratoIdx].banco || [];
    const next = current.includes(banco) ? current.filter((b) => b !== banco) : [...current, banco];
    updateMembroContrato(membroIdx, contratoIdx, "banco", next);
  };

  // Toggle grupo familiar
  const handleToggleGrupo = (checked: boolean) => {
    setGrupoFamiliar(checked);
    update("grupoFamiliar", checked);
    if (checked && membros.length === 0) {
      updateMembros([criarMembro()]);
    }
  };

  // Multi-select culturas
  const culturasSelecionadas: string[] = data.culturas || (data.cultura ? [data.cultura] : []);
  const toggleCultura = (c: string) => {
    const next = culturasSelecionadas.includes(c)
      ? culturasSelecionadas.filter((x: string) => x !== c)
      : [...culturasSelecionadas, c];
    update("culturas", next);
  };

  // Contratos do produtor principal
  const contratos: Contrato[] = data.contratos || [criarContrato()];
  const updateContratos = (next: Contrato[]) => update("contratos", next);
  const updateContrato = (idx: number, field: keyof Contrato, value: any) => {
    const next = [...contratos];
    next[idx] = { ...next[idx], [field]: value };
    updateContratos(next);
  };
  const addContrato = () => updateContratos([...contratos, criarContrato()]);
  const removeContrato = (idx: number) => {
    if (contratos.length <= 1) return;
    updateContratos(contratos.filter((_, i) => i !== idx));
  };

  const toggleBancoContrato = (idx: number, banco: string) => {
    const current: string[] = contratos[idx].banco || [];
    const next = current.includes(banco) ? current.filter((b) => b !== banco) : [...current, banco];
    updateContrato(idx, "banco", next);
  };

  const handleFileUpload = (idx: number, file: File) => {
    updateContrato(idx, "arquivoNome", file.name);
    updateContrato(idx, "arquivoFile", file);
  };

  const handleMembroFileUpload = (membroIdx: number, contratoIdx: number, file: File) => {
    updateMembroContrato(membroIdx, contratoIdx, "arquivoNome", file.name);
    updateMembroContrato(membroIdx, contratoIdx, "arquivoFile" as any, file);
  };

  // Render contrato card (reusable for principal + membros)
  const renderContratoCard = (
    contrato: Contrato,
    idx: number,
    opts: {
      onUpdate: (idx: number, field: keyof Contrato, value: any) => void;
      onRemove: (idx: number) => void;
      onToggleBanco: (idx: number, banco: string) => void;
      onFileUpload: (idx: number, file: File) => void;
      canRemove: boolean;
    }
  ) => (
    <div key={contrato.id} className="relative border border-border rounded-xl p-5 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Contrato {idx + 1}</h3>
        {opts.canRemove && (
          <button onClick={() => opts.onRemove(idx)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors" title="Remover contrato">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bancos */}
      <div className="mb-4">
        <p className="text-sm font-medium text-foreground mb-2">Banco(s) credor(es) *</p>
        <div className="flex flex-wrap gap-2">
          {bancos.map((b) => (
            <label
              key={b}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer transition-all text-xs ${
                (contrato.banco || []).includes(b)
                  ? "border-accent bg-accent/10 text-foreground font-medium"
                  : "border-border bg-background text-muted-foreground hover:border-accent/50"
              }`}
            >
              <Checkbox
                checked={(contrato.banco || []).includes(b)}
                onCheckedChange={() => opts.onToggleBanco(idx, b)}
                className="h-3.5 w-3.5 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
              />
              {b}
            </label>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FloatingInput label="Nº do contrato" value={contrato.contrato} onChange={(e) => opts.onUpdate(idx, "contrato", e.target.value)} />
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Modalidade *</p>
          <div className="flex gap-3">
            {["Custeio", "Investimento", "Comercialização"].map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input type="radio" name={`modalidade-${contrato.id}`} value={m} checked={contrato.modalidade === m}
                  onChange={() => opts.onUpdate(idx, "modalidade", m)} className="accent-accent w-4 h-4" />
                {m}
              </label>
            ))}
          </div>
        </div>
        <FloatingInput label="Valor original (R$)" required value={contrato.valorOriginal} onChange={(e) => opts.onUpdate(idx, "valorOriginal", e.target.value)} />
        <FloatingInput label="Saldo devedor atual (R$)" required value={contrato.saldoDevedor} onChange={(e) => opts.onUpdate(idx, "saldoDevedor", e.target.value)} />
        <FloatingInput label="Data de vencimento" type="date" value={contrato.dataVencimento} onChange={(e) => opts.onUpdate(idx, "dataVencimento", e.target.value)} />

        {/* Anexo */}
        <div className="flex flex-col justify-center">
          <p className="text-sm font-medium text-foreground mb-2">Anexar contrato</p>
          {contrato.arquivoNome ? (
            <div className="flex items-center gap-2 text-sm text-foreground bg-muted rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="truncate flex-1">{contrato.arquivoNome}</span>
              <button onClick={() => { opts.onUpdate(idx, "arquivoNome", undefined); opts.onUpdate(idx, "arquivoFile", undefined); }}
                className="text-destructive hover:text-destructive/80 text-xs">Remover</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all text-sm text-muted-foreground">
              <Upload className="w-4 h-4" /> Selecionar arquivo
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) opts.onFileUpload(idx, file); }} />
            </label>
          )}
        </div>
      </div>
    </div>
  );

  const parentescos = ["Cônjuge", "Filho(a)", "Pai/Mãe", "Irmão(ã)", "Genro/Nora", "Sobrinho(a)", "Tio(a)", "Outro"];

  return (
    <div className="space-y-8">
      {/* Tipo de Laudo */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Tipo de Laudo</h2>
        <p className="text-sm text-muted-foreground mb-4">Escolha o tipo de laudo a gerar. Isso ajusta as etapas seguintes do wizard.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { value: "perda", label: "Perda de Safra", desc: "Documenta evento e prejuízo agronômico", Icon: TrendingDown },
            { value: "capacidade", label: "Capacidade de Pagamento", desc: "Análise financeira para renegociação", Icon: Wallet },
            { value: "ambos", label: "Ambos os Laudos", desc: "Perda + Capacidade integrados", Icon: Layers },
          ].map((opt) => {
            const selected = (data.tipo_laudo || "ambos") === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("tipo_laudo", opt.value)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selected ? "border-accent bg-accent/5 shadow-card" : "border-border bg-card hover:border-accent/40"
                }`}
              >
                <opt.Icon className={`w-5 h-5 mb-2 ${selected ? "text-accent" : "text-muted-foreground"}`} />
                <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Seletor de origem do cliente */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Origem do Cliente</h2>
        <p className="text-sm text-muted-foreground mb-4">Escolha se deseja usar dados de um cliente já cadastrado ou preencher manualmente.</p>

        <div className="flex bg-muted rounded-lg p-1 w-fit mb-5">
          <button
            onClick={() => { setClientSource("novo"); update("_clientSource", "novo"); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              clientSource === "novo" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Novo Cliente
          </button>
          <button
            onClick={() => { setClientSource("existente"); update("_clientSource", "existente"); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              clientSource === "existente" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" /> Cliente Cadastrado
          </button>
        </div>

        {clientSource === "existente" && (
          <div ref={searchRef} className="relative max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                placeholder="Buscar por nome, CPF/CNPJ ou propriedade..." className="pl-9" />
            </div>
            {searching && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
            {showResults && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((item) => {
                  const d1 = (item.dados_etapa1 || {}) as Record<string, any>;
                  const isContrato = item._source === "contrato";
                  return (
                    <button key={item.id} type="button"
                      className="w-full text-left px-4 py-3 hover:bg-accent/10 transition-colors border-b border-border last:border-0"
                      onClick={() => {
                        if (isContrato) {
                          onChange({ ...data, nome: item._clienteNome, _clientSource: "existente" });
                          setShowResults(false);
                          setSearchQuery(item._clienteNome);
                        } else {
                          handleSelectClient(item);
                        }
                      }}>
                      <p className="text-sm font-medium text-foreground">{d1.nome || "Sem nome"}</p>
                      {isContrato ? (
                        <p className="text-xs text-muted-foreground">
                          {[item._bancos?.join(", "), `${item._numContratos} contrato(s)`].filter(Boolean).join(" · ")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {[d1.documento, d1.municipio && d1.uf ? `${d1.municipio}/${d1.uf}` : null, d1.nomePropriedade]
                            .filter(Boolean).join(" · ") || "Sem detalhes"}
                        </p>
                      )}
                      {!isContrato && d1.grupoFamiliar && d1.membros?.length > 0 && (
                        <p className="text-xs text-accent mt-0.5">
                          <Users className="w-3 h-3 inline mr-1" />
                          Grupo familiar ({d1.membros.length + 1} membros)
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {isContrato ? "📋 Da planilha de contratos" : `Laudo ${item.numero_laudo}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            {data._fromLaudoId && (
              <p className="text-xs text-accent mt-2 font-medium">✓ Dados importados. Você pode editar os campos abaixo se necessário.</p>
            )}
          </div>
        )}
      </section>

      {/* Dados do Produtor Principal */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-display font-bold text-foreground">
            {grupoFamiliar ? "Produtor Principal (Titular)" : "Dados do Produtor"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Informações do mutuário do crédito rural.</p>

        <div className="flex bg-muted rounded-lg p-1 w-fit mb-5">
          {(["fisica", "juridica"] as const).map((t) => (
            <button key={t}
              onClick={() => update("tipoPessoa", t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                (data.tipoPessoa || "fisica") === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FloatingInput
            label={(data.tipoPessoa || "fisica") === "fisica" ? "Nome completo" : "Razão Social"}
            required tooltip="Nome do mutuário conforme contrato"
            value={data.nome || ""} onChange={(e) => update("nome", e.target.value)} />
          <FloatingInput
            label={(data.tipoPessoa || "fisica") === "fisica" ? "CPF" : "CNPJ"}
            required tooltip="Documento do mutuário"
            value={data.documento || ""} onChange={(e) => update("documento", e.target.value)} />
          <FloatingInput label="E-mail do produtor" type="email" value={data.email || ""} onChange={(e) => update("email", e.target.value)} />
          <FloatingInput label="Telefone" type="tel" value={data.telefone || ""} onChange={(e) => update("telefone", e.target.value)} />
        </div>

        {/* Toggle Grupo Familiar */}
        <div className="mt-5 flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
          <Checkbox
            checked={grupoFamiliar}
            onCheckedChange={(checked) => handleToggleGrupo(!!checked)}
            className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
          />
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              Grupo Familiar
            </p>
            <p className="text-xs text-muted-foreground">
              Marque para incluir outros membros da família no mesmo laudo, cada um com seus próprios contratos.
            </p>
          </div>
        </div>
      </section>

      {/* Membros do Grupo Familiar */}
      {grupoFamiliar && (
        <section>
          <h2 className="text-lg font-display font-bold text-foreground mb-1">Membros do Grupo Familiar</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Cada membro possui CPF/nome e contratos individuais. A propriedade e culturas são compartilhadas.
          </p>

          <div className="space-y-4">
            {membros.map((membro, mIdx) => {
              const isExpanded = membrosExpandidos[membro.id] !== false; // default expanded
              return (
                <div key={membro.id} className="border border-accent/30 rounded-xl overflow-hidden bg-card">
                  {/* Header do membro */}
                  <button
                    onClick={() => toggleMembroExpanded(membro.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                        {mIdx + 2}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">
                          {membro.nome || `Membro ${mIdx + 2}`}
                          {membro.parentesco && <span className="text-xs text-muted-foreground font-normal ml-2">({membro.parentesco})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {membro.documento || "CPF não informado"} · {membro.contratos.length} contrato{membro.contratos.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeMembro(mIdx); }}
                        className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                        title="Remover membro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Conteúdo do membro */}
                  {isExpanded && (
                    <div className="px-4 pb-5 border-t border-border pt-4 space-y-5">
                      {/* Dados pessoais */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FloatingInput label="Nome completo" required value={membro.nome}
                          onChange={(e) => updateMembro(mIdx, "nome", e.target.value)} />
                        <FloatingInput label="CPF" required value={membro.documento}
                          onChange={(e) => updateMembro(mIdx, "documento", e.target.value)} />
                        <FloatingSelect label="Parentesco" options={parentescos.map((p) => ({ value: p, label: p }))}
                          value={membro.parentesco} onChange={(e) => updateMembro(mIdx, "parentesco", e.target.value)} />
                        <FloatingInput label="E-mail" type="email" value={membro.email}
                          onChange={(e) => updateMembro(mIdx, "email", e.target.value)} />
                        <FloatingInput label="Telefone" type="tel" value={membro.telefone}
                          onChange={(e) => updateMembro(mIdx, "telefone", e.target.value)} />
                      </div>

                      {/* Contratos do membro */}
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-3">Contratos de {membro.nome || `Membro ${mIdx + 2}`}</p>
                        <div className="space-y-4">
                          {membro.contratos.map((contrato, cIdx) =>
                            renderContratoCard(contrato, cIdx, {
                              onUpdate: (ci, field, value) => updateMembroContrato(mIdx, ci, field, value),
                              onRemove: (ci) => removeMembroContrato(mIdx, ci),
                              onToggleBanco: (ci, banco) => toggleMembroBanco(mIdx, ci, banco),
                              onFileUpload: (ci, file) => handleMembroFileUpload(mIdx, ci, file),
                              canRemove: membro.contratos.length > 1,
                            })
                          )}
                        </div>
                        <button onClick={() => addMembroContrato(mIdx)}
                          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-accent/50 text-accent text-sm font-medium hover:bg-accent/5 transition-all w-full justify-center">
                          <Plus className="w-4 h-4" /> Adicionar contrato
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={addMembro}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-accent/40 text-accent text-sm font-semibold hover:bg-accent/5 transition-all w-full justify-center">
            <UserPlus className="w-4 h-4" /> Adicionar membro ao grupo familiar
          </button>
        </section>
      )}

      {/* Dados da Propriedade */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Dados da Propriedade</h2>
        <p className="text-sm text-muted-foreground mb-4">Localização e dimensões da propriedade rural{grupoFamiliar ? " (compartilhada pelo grupo familiar)" : ""}.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <FloatingSelect label="UF" required options={ufs.map((u) => ({ value: u, label: u }))} value={data.uf || ""} onChange={(e) => update("uf", e.target.value)} />
          <FloatingInput label="Município" required tooltip="Município da propriedade" value={data.municipio || ""} onChange={(e) => update("municipio", e.target.value)} />
          <FloatingInput label="Nome da propriedade rural" required value={data.nomePropriedade || ""} onChange={(e) => update("nomePropriedade", e.target.value)} />
          <FloatingInput label="Nº Matrícula do imóvel" value={data.matricula || ""} onChange={(e) => update("matricula", e.target.value)} />
          <FloatingInput label="Nº CAR" tooltip="Cadastro Ambiental Rural" value={data.car || ""} onChange={(e) => update("car", e.target.value)} />
          <FloatingInput label="Área total (ha)" required type="number" value={data.areaTotal || ""} onChange={(e) => update("areaTotal", e.target.value)} />
          <FloatingInput label="Área cultivada na safra (ha)" required type="number" value={data.areaCultivada || ""} onChange={(e) => update("areaCultivada", e.target.value)} />
          <FloatingInput label="Latitude" type="text" tooltip="Ex: -23.5505" value={data.latitude || ""} onChange={(e) => update("latitude", e.target.value)} />
          <FloatingInput label="Longitude" type="text" tooltip="Ex: -46.6333" value={data.longitude || ""} onChange={(e) => update("longitude", e.target.value)} />
        </div>
      </section>

      {/* Culturas */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">Culturas Principais *</h2>
        <p className="text-sm text-muted-foreground mb-4">Selecione uma ou mais culturas exploradas na propriedade.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {culturas.map((c) => (
            <label key={c}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                culturasSelecionadas.includes(c)
                  ? "border-accent bg-accent/10 text-foreground font-medium"
                  : "border-border bg-card text-muted-foreground hover:border-accent/50"
              }`}>
              <Checkbox checked={culturasSelecionadas.includes(c)} onCheckedChange={() => toggleCultura(c)}
                className="data-[state=checked]:bg-accent data-[state=checked]:border-accent" />
              {c}
            </label>
          ))}
        </div>
        {culturasSelecionadas.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {culturasSelecionadas.length} cultura{culturasSelecionadas.length > 1 ? "s" : ""} selecionada{culturasSelecionadas.length > 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* Contratos do Produtor Principal */}
      <section>
        <h2 className="text-lg font-display font-bold text-foreground mb-1">
          {grupoFamiliar ? `Contratos de ${data.nome || "Produtor Principal"}` : "Dados do Financiamento"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {grupoFamiliar
            ? "Contratos de crédito rural do produtor titular. Os contratos dos demais membros ficam na seção acima."
            : "Adicione os contratos de crédito rural vinculados."}
        </p>

        <div className="mb-5">
          <FloatingInput label="Safra de referência" required tooltip="Ex: 2023/2024" value={data.safra || ""} onChange={(e) => update("safra", e.target.value)} />
        </div>

        <div className="space-y-6">
          {contratos.map((contrato, idx) =>
            renderContratoCard(contrato, idx, {
              onUpdate: updateContrato,
              onRemove: removeContrato,
              onToggleBanco: toggleBancoContrato,
              onFileUpload: handleFileUpload,
              canRemove: contratos.length > 1,
            })
          )}
        </div>

        <button onClick={addContrato}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-accent/50 text-accent text-sm font-medium hover:bg-accent/5 transition-all w-full justify-center">
          <Plus className="w-4 h-4" /> Adicionar outro contrato
        </button>
      </section>

      {/* Resumo grupo familiar */}
      {grupoFamiliar && membros.length > 0 && (
        <section className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            Resumo do Grupo Familiar
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{membros.length + 1}</p>
              <p className="text-xs text-muted-foreground">Membros</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {contratos.length + membros.reduce((s, m) => s + m.contratos.length, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Contratos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {new Set([
                  ...contratos.flatMap((c) => c.banco),
                  ...membros.flatMap((m) => m.contratos.flatMap((c) => c.banco)),
                ]).size}
              </p>
              <p className="text-xs text-muted-foreground">Bancos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                R$ {(
                  [...contratos, ...membros.flatMap((m) => m.contratos)]
                    .reduce((s, c) => s + (parseFloat(c.saldoDevedor?.replace(/[^\d.,]/g, "").replace(",", ".")) || 0), 0)
                ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Saldo Devedor Total</p>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[10px]">1</span>
              <span className="font-medium">{data.nome || "Titular"}</span>
              <span className="text-muted-foreground">· {data.documento || "—"} · {contratos.length} contrato{contratos.length > 1 ? "s" : ""}</span>
            </div>
            {membros.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2 text-xs text-foreground">
                <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[10px]">{i + 2}</span>
                <span className="font-medium">{m.nome || `Membro ${i + 2}`}</span>
                <span className="text-muted-foreground">
                  · {m.documento || "—"} {m.parentesco ? `· ${m.parentesco}` : ""} · {m.contratos.length} contrato{m.contratos.length > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
