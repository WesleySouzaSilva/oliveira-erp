import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Brain, Trash2, Loader2, Upload } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

const CATEGORIAS = [
  "manifesto", "glossario", "playbook", "mcr", "abusividade",
  "alongamento", "laudo_modelo", "peticao_modelo", "jurisprudencia",
  "sop_interno", "faq", "geral",
];

const SEED_BASE: Array<{ categoria: string; titulo: string; fonte: string; tags: string[]; conteudo: string }> = [
  {
    categoria: "manifesto",
    titulo: "Manifesto Oliveira Agro",
    fonte: "Doutrina interna",
    tags: ["identidade", "valores"],
    conteudo: `# Manifesto Oliveira Agro

## Quem somos
A Oliveira Agro é uma plataforma de reestruturação rural que une engenharia agronômica e advocacia bancária para devolver ao produtor o controle da sua atividade. Operamos sob o lema "Se é Agro, começa aqui".

## Missão
Transformar crises de crédito rural em planos sustentáveis de longo prazo por meio de laudos técnicos rigorosos (MCR 2.6.4), análises de abusividade contratual e defesas judiciais especializadas.

## Valores inegociáveis
1. **Verdade técnica antes de retórica jurídica** — o laudo manda na peça.
2. **Respeito absoluto ao produtor** — linguagem simples, sem prometer ganho de causa.
3. **LGPD e sigilo bancário** — nenhum dado sai do tenant sem autorização expressa.
4. **Padrão MCR e BCB** — sempre fundamentado em normativo oficial.
5. **Documentação obsessiva** — toda fase tem prazo, responsável e evidência.

## Voz da marca
Direta, técnica, calorosa quando explica ao produtor; firme e fundamentada quando dialoga com banco ou juízo. Nunca promete resultado. Nunca usa jargão vazio.

## Olívia — copiloto da casa
A Olívia é a assistente IA interna. Ela responde citando fontes da base de conhecimento, não inventa números, escala para humano quando há dúvida jurídica relevante, e sempre lembra que decisões finais cabem ao agrônomo, ao advogado responsável ou ao cliente.`,
  },
  {
    categoria: "glossario",
    titulo: "Glossário interno Oliveira Agro",
    fonte: "Wiki interna",
    tags: ["glossario"],
    conteudo: `# Glossário Oliveira Agro

- **MCR 2.6.4**: seção do Manual de Crédito Rural do BCB que trata de prorrogação e alongamento por frustração de safra, intempéries climáticas ou eventos sistêmicos. Base técnica para a maior parte dos nossos laudos.
- **Laudo Parte I (Perda)**: documento técnico-agronômico que comprova a frustração de safra, com NDVI, INMET, decretos de emergência e cálculo de quebra de produtividade.
- **Laudo Parte II (Capacidade)**: análise de capacidade de pagamento e proposta de alongamento — fluxo de caixa projetado, receita bruta esperada e cronograma viável.
- **Alongamento (Fases 1–5)**: processo de reestruturação em 5 fases — (1) Laudo, (2) Pedido administrativo ao banco, (3) Negociação, (4) Judicialização se necessário, (5) Acordo/Sentença e monitoramento.
- **Abusividade contratual**: análise técnica de cláusulas de juros, encargos, comissão de permanência, capitalização e tarifas em CPRs e cédulas rurais, à luz da jurisprudência STJ/TJs.
- **Defesa MCR**: peça processual que combina laudo técnico + tese jurídica, geralmente em execução, busca e apreensão ou ação revisional.
- **Setor de Acordos**: equipe interna que conduz a negociação extrajudicial após o laudo, com prazos bancários de 15 dias úteis por iteração.
- **shares_org**: função de RLS que garante isolamento multi-tenant — todo dado consultado pertence à organização do usuário.
- **Cliente Drive**: repositório único de arquivos por produtor (laudos, contratos, decretos, comprovantes).
- **Kanban Pipeline**: gestão visual de processos em 5 colunas com cronômetro de SLA por fase.`,
  },
  {
    categoria: "sop_interno",
    titulo: "Regras de conduta da Olívia",
    fonte: "Política interna",
    tags: ["olivia", "compliance"],
    conteudo: `# Regras de conduta da Olívia (assistente IA)

1. **Nunca prometa ganho de causa.** Use linguagem condicional: "há fundamento para pleitear", "a tese encontra respaldo em...".
2. **Cite a fonte** quando responder com base na BASE DE CONHECIMENTO INTERNA — use o formato "Fonte N".
3. **Não invente números** — quando não houver dado, peça ao usuário ou escale para humano.
4. **Respeite a LGPD** — não exiba CPF, telefone ou dados sensíveis em respostas que não sejam para o próprio dono do dado.
5. **Multi-tenant** — só fale de clientes/processos da organização do usuário logado.
6. **Escalar para humano** quando: (a) houver risco jurídico de tese inédita, (b) o produtor demonstrar fragilidade emocional, (c) o pedido envolver decisão de acordo financeiro acima do mandato do operador.
7. **Tom**: técnico, direto, caloroso com produtor; firme e fundamentado em interlocução com banco/juízo.
8. **Sempre lembrar** que decisões finais cabem ao agrônomo, ao advogado responsável ou ao cliente.`,
  },
];

export default function OliviaConhecimento() {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [categoria, setCategoria] = useState("playbook");
  const [titulo, setTitulo] = useState("");
  const [fonte, setFonte] = useState("");
  const [tags, setTags] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState<string>("");

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("olivia_conhecimento")
      .select("id, categoria, titulo, fonte, tags, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Erro ao carregar: " + error.message);
    setItens(data || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvar() {
    if (!conteudo.trim()) return toast.error("Conteúdo é obrigatório");
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("olivia-ingest", {
      body: {
        categoria, titulo: titulo || null, fonte: fonte || null,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        conteudo,
      },
    });
    setSalvando(false);
    if (error) return toast.error("Falha: " + error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success(`Ingerido em ${(data as any)?.chunks_inseridos || "?"} fragmento(s)`);
    setTitulo(""); setFonte(""); setTags(""); setConteudo("");
    carregar();
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || "");
        const idx = res.indexOf(",");
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
  }

  async function onUploadArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const nome = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || nome.endsWith(".pdf");
    const isDocx = file.type.includes("wordprocessingml") || nome.endsWith(".docx");
    if (!isPdf && !isDocx) {
      toast.error("Envie um arquivo PDF ou DOCX.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (limite 10MB).");
      return;
    }
    setUploading(true);
    try {
      setProgressoUpload("Lendo arquivo…");
      const b64 = await fileToBase64(file);
      setProgressoUpload(isPdf ? "Extraindo texto do PDF (via IA)…" : "Extraindo texto do DOCX…");
      const { data, error } = await supabase.functions.invoke("olivia-ingest", {
        body: {
          categoria,
          titulo: titulo || file.name,
          fonte: fonte || null,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
          arquivo_base64: b64,
          arquivo_mime: file.type || (isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
          arquivo_nome: file.name,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Ingerido em ${(data as any)?.chunks_inseridos || "?"} fragmento(s)`);
      setTitulo(""); setFonte(""); setTags("");
      carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao processar arquivo");
    } finally {
      setUploading(false);
      setProgressoUpload("");
    }
  }

  const askConfirm = useConfirm();
  async function excluir(id: string) {
    if (!(await askConfirm({ title: "Excluir conhecimento", description: "Excluir este conhecimento da base?", destructive: true, confirmText: "Excluir" }))) return;
    const { error } = await supabase.from("olivia_conhecimento").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    carregar();
  }

  async function popularBase() {
    if (!(await askConfirm({ title: "Popular base da Olívia", description: "Ingerir manifesto + glossário + regras da Olívia na sua organização?", confirmText: "Ingerir" }))) return;
    setSeeding(true);
    let ok = 0, fail = 0;
    for (const item of SEED_BASE) {
      const { data, error } = await supabase.functions.invoke("olivia-ingest", { body: item });
      if (error || (data as any)?.error) { fail++; console.error(error || (data as any)?.error); }
      else ok++;
    }
    setSeeding(false);
    toast.success(`Base inicial: ${ok} documento(s) ingerido(s)${fail ? `, ${fail} falha(s)` : ""}`);
    carregar();
  }

  // Agrupa por título para mostrar 1 linha por documento original
  const agrupado = itens.reduce((acc: any, it) => {
    const k = `${it.titulo || "(sem título)"}__${it.categoria}`;
    if (!acc[k]) acc[k] = { ...it, chunks: 0, ids: [] };
    acc[k].chunks += 1;
    acc[k].ids.push(it.id);
    return acc;
  }, {});
  const docs: any[] = Object.values(agrupado);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Cérebro da Olívia</h1>
          <p className="text-sm text-muted-foreground">
            Alimente a base de conhecimento para que a Olívia responda com precisão sobre seus processos, modelos, MCR, jurisprudência e padrões internos.
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold">Adicionar conhecimento</h2>
          <Button variant="outline" size="sm" onClick={popularBase} disabled={seeding}>
            {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
            Popular base inicial (manifesto + glossário + conduta)
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Categoria</label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={categoria} onChange={e => setCategoria(e.target.value)}
            >
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Input placeholder="Título (ex.: Roteiro de defesa MCR 2.6.4)" value={titulo} onChange={e => setTitulo(e.target.value)} />
          <Input placeholder="Fonte (ex.: Manual interno v3)" value={fonte} onChange={e => setFonte(e.target.value)} />
        </div>
        <Input placeholder="Tags separadas por vírgula (ex.: soja, frustracao)" value={tags} onChange={e => setTags(e.target.value)} />
        <Textarea
          placeholder="Cole aqui o texto: playbook, modelo de petição, trecho de manual, jurisprudência, FAQ interno..."
          value={conteudo} onChange={e => setConteudo(e.target.value)}
          rows={10}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border cursor-pointer text-sm hover:bg-accent/40 transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? "Processando…" : "Enviar arquivo (PDF ou DOCX)"}</span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                disabled={uploading}
                onChange={onUploadArquivo}
              />
            </label>
            {progressoUpload && <span className="text-xs text-muted-foreground">{progressoUpload}</span>}
          </div>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Ingerir na Olívia
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Conhecimento atual ({docs.length} documentos, {itens.length} fragmentos)</h2>
          <Button variant="ghost" size="sm" onClick={carregar} disabled={loading}>Atualizar</Button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum conhecimento cadastrado ainda.</p>
        ) : (
          <div className="divide-y">
            {docs.map((d) => (
              <div key={d.titulo + d.categoria} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{d.categoria}</Badge>
                    <span className="font-medium truncate">{d.titulo || "(sem título)"}</span>
                    <Badge variant="outline">{d.chunks} chunk(s)</Badge>
                  </div>
                  {d.fonte && <p className="text-xs text-muted-foreground mt-1">Fonte: {d.fonte}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  // exclui todos os chunks do documento
                  (async () => {
                    if (!(await askConfirm({ title: "Excluir documento", description: `Excluir "${d.titulo}" (${d.chunks} chunks)?`, destructive: true, confirmText: "Excluir" }))) return;
                    await supabase.from("olivia_conhecimento").delete().in("id", d.ids);
                    toast.success("Removido");
                    carregar();
                  })();
                }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}