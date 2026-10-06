import type { Alerta, Movimentacao, Processo } from "@/data/mockProcessos";
import { getFaseLabel } from "@/data/mockProcessos";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Download,
  User,
  Clock,
  FileText,
  MessageSquare,
} from "lucide-react";

interface ProcessoPainelProps {
  processo: Processo;
  alertas: Alerta[];
  movimentacoes: Movimentacao[];
}

function AlertaIcon({ tipo }: { tipo: Alerta["tipo"] }) {
  switch (tipo) {
    case "urgente":
      return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
    case "atencao":
      return <AlertCircle className="w-4 h-4 text-accent shrink-0" />;
    case "info":
      return <Info className="w-4 h-4 text-info shrink-0" />;
    case "ok":
      return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
  }
}

function alertaBg(tipo: Alerta["tipo"]) {
  switch (tipo) {
    case "urgente": return "bg-destructive/5 border-destructive/20";
    case "atencao": return "bg-accent/5 border-accent/20";
    case "info": return "bg-info/5 border-info/20";
    case "ok": return "bg-success/5 border-success/20";
  }
}

export function ProcessoPainel({ processo, alertas, movimentacoes }: ProcessoPainelProps) {
  return (
    <div className="space-y-5">
      {/* Resumo do caso */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-card">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Resumo do Caso
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Produtor</span>
            <span className="font-medium text-foreground text-right truncate ml-2">{processo.produtor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Banco</span>
            <span className="font-medium text-foreground">{processo.banco}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contrato</span>
            <span className="font-medium text-foreground text-xs">{processo.contrato}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo devedor</span>
            <span className="font-semibold text-foreground">{processo.saldoDevedor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Prazo solicitado</span>
            <span className="font-medium text-foreground">{processo.prazoSolicitado} meses</span>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 shadow-card">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Alertas & Prazos
          </h4>
          <div className="space-y-2">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-md border ${alertaBg(alerta.tipo)}`}
              >
                <AlertaIcon tipo={alerta.tipo} />
                <p className="text-xs text-foreground leading-relaxed">{alerta.mensagem}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipe */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-card">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Equipe
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
              <User className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">{processo.responsavelAgronomo}</p>
              <p className="text-[11px] text-muted-foreground">Agrônomo</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center">
              <User className="w-4 h-4 text-info" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">{processo.responsavelJuridico}</p>
              <p className="text-[11px] text-muted-foreground">Jurídico</p>
            </div>
          </div>
        </div>
        <button className="mt-3 flex items-center gap-1.5 text-xs text-accent font-medium hover:underline">
          <MessageSquare className="w-3.5 h-3.5" /> Adicionar comentário
        </button>
      </div>

      {/* Atividade recente */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-card">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Atividade Recente
        </h4>
        <div className="space-y-3">
          {movimentacoes.slice(-5).reverse().map((mov) => (
            <div key={mov.id} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
              <div>
                <p className="text-xs text-foreground leading-relaxed">{mov.descricao}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {mov.usuario} · {new Date(mov.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
