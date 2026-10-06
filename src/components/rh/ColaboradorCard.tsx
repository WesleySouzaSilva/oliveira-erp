import { Star, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ColaboradorCardProps {
  nome: string;
  papel: string;
  cargo?: string | null;
  setor?: string | null;
  fotoUrl?: string | null;
  ativo: boolean;
  ultimoFeedbackNota?: number | null;
  engajamentoScore: number;
  onClick: () => void;
}

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador", agronomo: "Agrônomo", advogado: "Advogado",
  engenheiro_agronomo: "Eng. Agrônomo", estagiario_direito: "Estagiário",
  assessor_juridico: "Assessor Jurídico", pos_venda: "Pós-Venda",
  coordenador: "Coordenador",
};

export function ColaboradorCard({
  nome, papel, cargo, setor, fotoUrl, ativo, ultimoFeedbackNota, engajamentoScore, onClick,
}: ColaboradorCardProps) {
  const engCor = engajamentoScore >= 3 ? "bg-emerald-500" : engajamentoScore === 2 ? "bg-amber-500" : "bg-red-500";
  const engLabel = engajamentoScore >= 3 ? "Alto" : engajamentoScore === 2 ? "Médio" : "Baixo";

  return (
    <Card className="p-5 cursor-pointer hover:shadow-lg transition-shadow border-border/60 hover:border-primary/30" onClick={onClick}>
      <div className="flex items-start gap-4">
        {fotoUrl ? (
          <img src={fotoUrl} alt={nome} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{nome}</h3>
            <Badge variant={ativo ? "default" : "secondary"} className="text-[10px] shrink-0">
              {ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{cargo || PAPEL_LABEL[papel] || papel}</p>
          {setor && <p className="text-[10px] text-muted-foreground">{setor}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${engCor}`} />
          <span className="text-xs text-muted-foreground">Engajamento {engLabel}</span>
        </div>
        {ultimoFeedbackNota && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-3 h-3 ${i < ultimoFeedbackNota ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
