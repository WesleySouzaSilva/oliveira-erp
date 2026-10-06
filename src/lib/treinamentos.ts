import { useQuery } from "@tanstack/react-query";
import { useVerComo } from "@/lib/verComo";
import { useEffect, useState, useCallback } from "react";
import jsPDF from "jspdf";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import logoAdvogados from "@/assets/oliveira-advogados-horizontal-dark.png";

export const db = supabase as any;

export interface Setor { id: string; nome: string; pai_id: string | null; ordem: number; ativo?: boolean; institucional: boolean; organizacao_id?: string }
export interface Trilha {
  id: string; organizacao_id: string; setor_id: string; titulo: string; descricao: string | null;
  obrigatoria: boolean; prazo_dias: number | null; versao: number; publicada: boolean; arquivada: boolean; updated_at: string;
}
export interface Atribuicao {
  id: string; user_id: string; trilha_id: string; status: "pendente" | "em_andamento" | "concluida" | "refazer";
  obrigatoria: boolean; atribuida_em: string; prazo_em: string | null; concluida_em: string | null; nota_final: number | null; origem: string;
}

export const TIPOS_AULA: Record<string, string> = {
  video_link: "Vídeo (YouTube ou Vimeo)",
  video_arquivo: "Vídeo (arquivo enviado)",
  documento: "PDF ou documento",
  texto: "Texto",
  link: "Link externo",
  checklist: "Checklist",
};

export const STATUS_ATRIB: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Não iniciado", cls: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", cls: "bg-accent/20 text-accent-foreground" },
  concluida: { label: "Concluído", cls: "bg-primary/15 text-primary" },
  refazer: { label: "Refazer (nova versão)", cls: "bg-destructive/15 text-destructive" },
};

/** Grupos em ordem, cada um seguido dos subgrupos. */
export function ordenarSetores<T extends Setor>(lista: T[]): T[] {
  const raizes = lista.filter((s) => !s.pai_id).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  const out: T[] = [];
  for (const r of raizes) {
    out.push(r);
    lista.filter((s) => s.pai_id === r.id).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)).forEach((f) => out.push(f));
  }
  return out;
}

export function nomeSetor(setores: Setor[], id: string | null | undefined) {
  const s = setores.find((x) => x.id === id);
  if (!s) return "";
  const pai = s.pai_id ? setores.find((x) => x.id === s.pai_id) : null;
  return pai ? `${pai.nome} › ${s.nome}` : s.nome;
}

export function atrasada(a: Pick<Atribuicao, "status" | "prazo_em">) {
  return a.status !== "concluida" && !!a.prazo_em && new Date(a.prazo_em).getTime() < Date.now();
}

export const fmtData = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");

export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html || "", { ADD_ATTR: ["target", "rel"] });
}

/** Converte link do YouTube/Vimeo em endereço de incorporação. */
export function embedVideo(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const h = u.hostname.replace(/^www\.|^m\./, "");
    if (h === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (h.endsWith("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return `https://www.youtube-nocookie.com${u.pathname}`;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube-nocookie.com/embed/${u.pathname.split("/")[2]}`;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
    }
    if (h === "vimeo.com") {
      const [id, hash] = u.pathname.split("/").filter(Boolean);
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}`;
    }
    if (h === "player.vimeo.com") return u.toString();
  } catch { /* inválido */ }
  return null;
}

export async function urlAssinada(path: string) {
  const { data, error } = await supabase.storage.from("treinamentos").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export interface PapelTrein { admin: boolean; gestor: boolean; lider_provas: boolean; organizacao_id: string | null; lider_setores: string[]; ve_menu: boolean; carregando: boolean }

/**
 * Papel no módulo + se o item "Treinamentos" deve aparecer no menu (ve_menu:
 * líder, atribuição, ou trilha publicada num setor visível). Uma chamada por
 * sessão, compartilhada entre menu e telas (cache do React Query).
 */
export function usePapelTrein(): PapelTrein {
  const alvo = useVerComo();
  const { data } = useQuery({
    queryKey: ["trein-papel", alvo?.user_id ?? "eu"],
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      // Modo "ver como": papel da pessoa vista (só flags; nada além do que o admin já lê).
      const { data } = await (alvo ? db.rpc("trein_papel_de", { _user: alvo.user_id }) : db.rpc("trein_meu_papel"));
      return (data ?? {}) as any;
    },
  });
  return {
    admin: !!data?.admin, gestor: !!data?.gestor, lider_provas: !!data?.lider_provas,
    organizacao_id: data?.organizacao_id ?? null, lider_setores: data?.lider_setores ?? [],
    ve_menu: !!data?.ve_menu, carregando: data === undefined,
  };
}

/** Setores que a pessoa pode editar: admin = todos; líder = o próprio e os subgrupos. */
export function setoresEditaveis(setores: Setor[], papel: PapelTrein) {
  if (papel.admin || papel.gestor) return setores;
  return setores.filter((s) => papel.lider_setores.includes(s.id) || (s.pai_id && papel.lider_setores.includes(s.pai_id)));
}

export function useSetores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const recarregar = useCallback(async () => {
    const { data } = await db.from("setores").select("*").order("ordem");
    setSetores(ordenarSetores(data || []));
  }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { setores, recarregar };
}

async function dataUrl(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  return new Promise((res, rej) => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob); });
}

/** Certificado simples de conclusão (A4 paisagem), com o logo atual do escritório. */
export async function gerarCertificado(d: { nome: string; trilha: string; setor: string; data: string; nota: number | null }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;
  const VERDE: [number, number, number] = [27, 67, 50];
  const DOURADO: [number, number, number] = [160, 130, 104];
  doc.setFillColor(250, 247, 240); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...VERDE); doc.rect(0, 0, W, 42, "F");
  try { doc.addImage(await dataUrl(logoAdvogados), "PNG", W / 2 - 45, 10, 90, 21); } catch { /* sem logo */ }
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.8); doc.rect(10, 50, W - 20, H - 60);
  doc.setTextColor(...VERDE); doc.setFont("times", "bold"); doc.setFontSize(30);
  doc.text("Certificado de conclusão", W / 2, 72, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(60, 60, 60);
  doc.text("Certificamos que", W / 2, 90, { align: "center" });
  doc.setFont("times", "bold"); doc.setFontSize(24); doc.setTextColor(...VERDE);
  doc.text(d.nome, W / 2, 104, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(60, 60, 60);
  doc.text("concluiu a trilha de treinamento", W / 2, 118, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...DOURADO);
  doc.text(doc.splitTextToSize(d.trilha, W - 60), W / 2, 131, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(90, 90, 90);
  const partes = [`Setor: ${d.setor}`, `Concluída em ${d.data}`];
  if (d.nota != null) partes.push(`Nota: ${String(d.nota).replace(".", ",")}%`);
  doc.text(partes.join("   |   "), W / 2, 152, { align: "center" });
  doc.setDrawColor(...DOURADO); doc.line(W / 2 - 50, 176, W / 2 + 50, 176);
  doc.setFontSize(10); doc.text("Oliveira Advogados", W / 2, 182, { align: "center" });
  doc.save(`Certificado - ${d.trilha}.pdf`.replace(/[\\/:*?"<>|]/g, ""));
}
