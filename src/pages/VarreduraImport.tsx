import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { agrupaSugestoes, lerCsvVarredura, type SugestaoAgrupada } from "@/lib/varredura";
import { useVarreduraSugestoes } from "@/hooks/useVarreduraSugestoes";
import { formatDataBR } from "@/lib/notificacoesBanco";

export default function VarreduraImport() {
  const { importar, sugestoes } = useVarreduraSugestoes();
  const [grupos, setGrupos] = useState<SugestaoAgrupada[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [ignoradas, setIgnoradas] = useState(0);
  const [gravando, setGravando] = useState(false);

  const resumo = useMemo(() => {
    const porTipo = { instituicao: 0, protocolo: 0 };
    const porResp = new Map<string, { instituicao: number; protocolo: number }>();
    grupos.forEach((g) => {
      porTipo[g.tipo] += 1;
      const k = g.responsavel || "sem responsável";
      const linha = porResp.get(k) || { instituicao: 0, protocolo: 0 };
      linha[g.tipo] += 1;
      porResp.set(k, linha);
    });
    return { porTipo, porResp: Array.from(porResp.entries()).sort((a, b) => a[0].localeCompare(b[0])) };
  }, [grupos]);

  const lerArquivo = async (file: File) => {
    const texto = await file.text();
    const { linhas, ignoradas: ign } = lerCsvVarredura(texto);
    if (linhas.length === 0) {
      toast.error("Não encontrei linhas válidas no arquivo");
      return;
    }
    setGrupos(agrupaSugestoes(linhas));
    setArquivo(file.name);
    setIgnoradas(ign);
    toast.success(`${linhas.length} linhas lidas`);
  };

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Importar a varredura das pastas</h1>
          <p className="text-sm text-muted-foreground">
            Tudo entra como sugestão. Nada é aplicado em massa e nada muda sem alguém clicar.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/notificacoes">
            <ArrowLeft className="mr-1 h-4 w-4" /> Notificações
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
        <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          Arquivo CSV com as colunas responsavel, cliente, tipo, valor, codigo, data, vezes, arquivo.
        </p>
        <input
          id="csv-varredura"
          type="file"
          accept=".csv,text/csv"
          className="mt-3"
          aria-label="Arquivo da varredura"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) lerArquivo(f);
          }}
        />
      </div>

      {grupos.length > 0 && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="font-serif text-base font-bold">Prévia de {arquivo}</p>
            <p className="mt-1 text-sm">
              <Badge variant="outline" className="mr-2 font-normal">
                {resumo.porTipo.instituicao}
              </Badge>
              sugestões na fila “Identificar a instituição exata”
              <span className="mx-2">·</span>
              <Badge variant="outline" className="mr-2 font-normal">
                {resumo.porTipo.protocolo}
              </Badge>
              sugestões de protocolo (já vencidas e operações sem protocolo)
              {ignoradas > 0 && <span className="ml-2 text-muted-foreground">{ignoradas} linhas ignoradas</span>}
            </p>

            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Responsável</th>
                    <th className="px-3 py-2 text-left">Instituição</th>
                    <th className="px-3 py-2 text-left">Protocolo</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.porResp.map(([resp, l]) => (
                    <tr key={resp} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold">{resp}</td>
                      <td className="px-3 py-2">{l.instituicao}</td>
                      <td className="px-3 py-2">{l.protocolo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              className="mt-3"
              disabled={gravando}
              onClick={async () => {
                setGravando(true);
                const ok = await importar(grupos);
                setGravando(false);
                if (ok) setGrupos([]);
              }}
            >
              Gravar como sugestões
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Sugestão</th>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Vezes</th>
                  <th className="px-3 py-2 text-left">Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {grupos.slice(0, 200).map((g, idx) => (
                  <tr key={`${g.cliente}-${g.valor}-${idx}`} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">{g.cliente}</td>
                    <td className="px-3 py-2">{g.tipo === "instituicao" ? "Instituição" : "Protocolo"}</td>
                    <td className="px-3 py-2">
                      {g.valor}
                      {g.variantes.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          agrupado com: {g.variantes.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{g.codigo || "—"}</td>
                    <td className="px-3 py-2">{g.data ? formatDataBR(g.data) : "—"}</td>
                    <td className="px-3 py-2">{g.vezes}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-xs text-muted-foreground">{g.arquivo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Sugestões já gravadas: {sugestoes.filter((s) => s.status === "pendente").length} pendentes ·{" "}
        {sugestoes.filter((s) => s.status === "aplicada").length} aplicadas.
      </p>
    </AppLayout>
  );
}
