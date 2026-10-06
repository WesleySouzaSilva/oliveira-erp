import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, ListChecks, Trash2, Calendar, Tag, Users, MessageSquare, Paperclip, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { KanbanCardData } from "./lib/types";
import { EtiquetasPopover } from "./EtiquetasPopover";
import { MembrosPopover } from "./MembrosPopover";
import { CardComentariosSection } from "./CardComentariosSection";
import { CardAtividadeSection } from "./CardAtividadeSection";
import { CardAnexosSection } from "./CardAnexosSection";
import { useAuth } from "@/contexts/AuthContext";
import { logAtividade } from "./hooks/useCardSocial";
import {
  useCardMeta,
  useUpdateCardMeta,
  useChecklists,
  useChecklistTemplates,
  useApplyChecklistTemplate,
  useToggleChecklistItem,
  useDeleteChecklist,
} from "./hooks/useCardDetail";

interface Props {
  card: KanbanCardData | null;
  orgId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CardDetailDialog({ card, orgId, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const meta = useCardMeta(card?.id ?? null, orgId);
  const updateMeta = useUpdateCardMeta();
  const checklists = useChecklists(card?.id ?? null);
  const templates = useChecklistTemplates(orgId);
  const applyTpl = useApplyChecklistTemplate();
  const toggleItem = useToggleChecklistItem(card?.id ?? null);
  const deleteList = useDeleteChecklist(card?.id ?? null);

  const [descricao, setDescricao] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [syncPrazo, setSyncPrazo] = useState(true);

  useEffect(() => {
    if (meta.data) {
      setDescricao(meta.data.descricao ?? "");
      setDueDate(meta.data.due_date ? meta.data.due_date.slice(0, 10) : "");
      setSyncPrazo(meta.data.sincroniza_prazo_15d);
    }
  }, [meta.data]);

  const prazoBadge = useMemo(() => {
    if (card?.prazoRestante == null) return null;
    const cls =
      card.prazoRestante <= 0
        ? "text-destructive"
        : card.prazoRestante <= 3
        ? "text-accent"
        : "text-success";
    return (
      <span className={`text-xs font-semibold ${cls}`}>
        {card.prazoRestante <= 0 ? "Prazo 15d vencido" : `${card.prazoRestante}d restantes (15d)`}
      </span>
    );
  }, [card]);

  if (!card) return null;

  const saveDescricao = () => {
    if (meta.data?.descricao === descricao) return;
    updateMeta.mutate({ processoId: card.id, patch: { descricao } });
  };

  const saveDueDate = (val: string) => {
    setDueDate(val);
    updateMeta.mutate({
      processoId: card.id,
      patch: {
        due_date: val ? new Date(val).toISOString() : null,
        due_origem: "manual",
      },
    });
    if (orgId && user?.id) {
      logAtividade(card.id, orgId, user.id, "alterou_prazo", {
        due_date: val ? new Date(val).toISOString() : null,
      });
    }
  };

  const toggleSync = (v: boolean) => {
    setSyncPrazo(v);
    updateMeta.mutate({ processoId: card.id, patch: { sincroniza_prazo_15d: v } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{card.produtor}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/processos/${card.id}`)}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir processo
            </Button>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{card.banco}</p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Prazo */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Prazo
            </Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => saveDueDate(e.target.value)}
                className="w-44"
              />
              {prazoBadge}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="sync-15d"
                checked={syncPrazo}
                onCheckedChange={toggleSync}
              />
              <Label htmlFor="sync-15d" className="text-xs cursor-pointer">
                Sincronizar com prazo de 15 dias (notificação extrajudicial)
              </Label>
            </div>
          </section>

          {/* Etiquetas */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" /> Etiquetas
            </Label>
            <EtiquetasPopover processoId={card.id} orgId={orgId} />
          </section>

          {/* Membros */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Membros / Responsáveis
            </Label>
            <MembrosPopover processoId={card.id} orgId={orgId} />
          </section>

          {/* Descrição */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Descrição
            </Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onBlur={saveDescricao}
              placeholder="Notas internas sobre o caso..."
              rows={3}
            />
          </section>

          {/* Checklists */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
                <ListChecks className="w-3.5 h-3.5" /> Checklists
              </Label>
              {templates.data && templates.data.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {templates.data.map((tpl) => (
                    <Button
                      key={tpl.id}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() =>
                        orgId &&
                        applyTpl.mutate({
                          processoId: card.id,
                          orgId,
                          template: tpl,
                        })
                      }
                    >
                      + {tpl.nome}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {checklists.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum checklist. Aplique um template para começar.
              </p>
            )}

            {checklists.data?.map((list) => {
              const total = list.itens.length;
              const done = list.itens.filter((i) => i.concluido).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={list.id} className="border border-border rounded-lg p-3 bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{list.titulo}</p>
                    <button
                      onClick={() => deleteList.mutate(list.id)}
                      className="text-muted-foreground/60 hover:text-destructive"
                      aria-label="Excluir checklist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {done}/{total}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {list.itens.map((item) => (
                      <li key={item.id} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          id={`it-${item.id}`}
                          checked={item.concluido}
                          onCheckedChange={(v) =>
                            toggleItem.mutate({ itemId: item.id, concluido: !!v })
                          }
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={`it-${item.id}`}
                          className={`cursor-pointer flex-1 ${
                            item.concluido ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {item.texto}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          {/* Anexos */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
              <Paperclip className="w-3.5 h-3.5" /> Anexos
            </Label>
            <CardAnexosSection processoId={card.id} orgId={orgId} />
          </section>

          {/* Comentários */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" /> Comentários
            </Label>
            <CardComentariosSection processoId={card.id} orgId={orgId} />
          </section>

          {/* Atividade */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Atividade
            </Label>
            <CardAtividadeSection processoId={card.id} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}