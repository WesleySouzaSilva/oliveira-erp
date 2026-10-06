import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Star, StarOff, Plus, Copy, Trash2, Edit3, X, Save } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeletons";

interface Template {
  id: string;
  nome: string;
  hipotese_mcr: string | null;
  conteudo: string;
  is_sistema: boolean;
  is_favorito: boolean;
}

const hipoteseLabels: Record<string, string> = {
  a: "Dificuldade de comercialização",
  b: "Frustração de safra",
  c: "Ocorrência prejudicial",
  d: "Dificuldades de fluxo de caixa",
};

const hipoteseOptions = [
  { value: "", label: "Nenhuma" },
  { value: "a", label: "a — Dificuldade de comercialização" },
  { value: "b", label: "b — Frustração de safra" },
  { value: "c", label: "c — Ocorrência prejudicial" },
  { value: "d", label: "d — Dificuldades de fluxo de caixa" },
];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "sistema" | "meus">("todos");
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formConteudo, setFormConteudo] = useState("");
  const [formHipotese, setFormHipotese] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const askConfirm = useConfirm();

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("templates_conclusao")
      .select("*")
      .order("is_sistema", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) setTemplates(data as Template[]);
    setLoading(false);
  };

  const toggleFavorito = async (template: Template) => {
    if (template.is_sistema) return;
    const { error } = await supabase
      .from("templates_conclusao")
      .update({ is_favorito: !template.is_favorito })
      .eq("id", template.id);
    if (error) {
      toast({ title: "Erro ao favoritar", description: error.message, variant: "destructive" });
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_favorito: !t.is_favorito } : t))
      );
      toast({ title: !template.is_favorito ? "Favoritado" : "Removido dos favoritos" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Texto copiado!", description: "Cole no seu laudo." });
  };

  const deleteTemplate = async (id: string) => {
    const ok = await askConfirm({
      title: "Excluir template",
      description: "Esta ação não pode ser desfeita.",
      destructive: true,
      confirmText: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("templates_conclusao").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "Template excluído" });
    }
  };

  const openNew = () => {
    setEditingTemplate(null);
    setFormNome("");
    setFormConteudo("");
    setFormHipotese("");
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setFormNome(t.nome);
    setFormConteudo(t.conteudo);
    setFormHipotese(t.hipotese_mcr || "");
    setShowModal(true);
  };

  const saveTemplate = async () => {
    if (!formNome.trim() || !formConteudo.trim() || !user) return;
    setSaving(true);
    const payload = {
      nome: formNome,
      conteudo: formConteudo,
      hipotese_mcr: formHipotese || null,
      user_id: user.id,
      is_sistema: false,
    };

    if (editingTemplate) {
      const { error } = await supabase
        .from("templates_conclusao")
        .update(payload)
        .eq("id", editingTemplate.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Template atualizado!" }); }
    } else {
      const { error } = await supabase
        .from("templates_conclusao")
        .insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Template criado!" }); }
    }

    setSaving(false);
    setShowModal(false);
    fetchTemplates();
  };

  const filtered = templates.filter((t) => {
    if (filter === "sistema") return t.is_sistema;
    if (filter === "meus") return !t.is_sistema;
    return true;
  });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Templates de Conclusão</h1>
          <p className="text-sm text-muted-foreground mt-1">Modelos de texto para a conclusão do laudo técnico.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-accent-foreground shadow-card hover:shadow-card-hover transition-all"
        >
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-6">
        {([
          { value: "todos", label: "Todos" },
          { value: "sistema", label: "Do sistema" },
          { value: "meus", label: "Meus templates" },
        ] as const).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (<CardSkeleton key={i} />))}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-lg border border-border shadow-card p-5 group"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{template.nome}</h3>
                    {template.hipotese_mcr && (
                      <span className="text-xs text-muted-foreground">
                        MCR 2.6.4-{template.hipotese_mcr} · {hipoteseLabels[template.hipotese_mcr] || ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {template.is_sistema && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Sistema</span>
                  )}
                  {!template.is_sistema && (
                    <button onClick={() => toggleFavorito(template)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                      {template.is_favorito ? <Star className="w-4 h-4 text-accent fill-accent" /> : <StarOff className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">{template.conteudo}</p>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => copyToClipboard(template.conteudo)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
                {!template.is_sistema && (
                  <>
                    <button onClick={() => openEdit(template)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                      <Edit3 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={() => deleteTemplate(template.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Nenhum template encontrado"
          description="Crie um modelo de conclusão para reutilizar nos laudos."
          action={{ label: "Novo template", icon: Plus, onClick: openNew }}
        />
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setShowModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-card rounded-lg border border-border shadow-card-hover p-6 max-w-lg w-full"
          >
            <button onClick={() => setShowModal(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-display font-bold text-foreground mb-4">
              {editingTemplate ? "Editar Template" : "Novo Template"}
            </h2>

            <div className="space-y-4">
              <div className="floating-label-group">
                <input type="text" placeholder=" " value={formNome} onChange={(e) => setFormNome(e.target.value)} />
                <label>Nome do template</label>
              </div>

              <div className="floating-label-group">
                <select value={formHipotese} onChange={(e) => setFormHipotese(e.target.value)}>
                  {hipoteseOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <label>Hipótese MCR (opcional)</label>
              </div>

              <div className="floating-label-group">
                <textarea placeholder=" " rows={8} value={formConteudo} onChange={(e) => setFormConteudo(e.target.value)} />
                <label>Conteúdo do template</label>
              </div>

              <p className="text-xs text-muted-foreground">
                Use variáveis: {"{PRODUTOR}"}, {"{CULTURA}"}, {"{SAFRA}"}, {"{MUNICIPIO}"}, {"{UF}"}
              </p>

              <button
                onClick={saveTemplate}
                disabled={saving || !formNome.trim() || !formConteudo.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold bg-accent text-accent-foreground hover:shadow-card-hover transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Template"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
