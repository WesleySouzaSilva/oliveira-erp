import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak, PageNumber,
} from "https://esm.sh/docx@9.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Color Palette ──────────────────────────────────────────────────────────
const C = {
  dkGreen: "1B4D1B",
  mdGreen: "2E7D32",
  ltGreen: "D4EDDA",
  paleGreen: "F4FAF4",
  stone: "F7F5F0",
  dkGray: "3B3B3B",
  mdGray: "6B6B6B",
  ltGray: "E8E8E4",
  dkBrown: "4A3000",
  ltBrown: "FFF8EE",
  red: "8B1A1A",
  ltRed: "FFF0F0",
  white: "FFFFFF",
  ink: "1C2B1C",
  rule: "BBBBAA",
};

const CW = 9638; // A4 content width in DXA (2cm margins)
const FONT = "Calibri";
const BODY_SIZE = 21; // ~10.5pt
const NOTE_SIZE = 18; // ~9pt
const H1_SIZE = 28;
const H2_SIZE = 24;

// ─── Helpers ────────────────────────────────────────────────────────────────

function bodyRun(text: string, opts?: Partial<{ bold: boolean; italics: boolean; color: string; size: number }>): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size || BODY_SIZE,
    bold: opts?.bold || false,
    italics: opts?.italics || false,
    color: opts?.color || C.ink,
  });
}

function bodyParagraph(text: string, opts?: { spacing?: number; bold?: boolean; italics?: boolean }): Paragraph {
  return new Paragraph({
    spacing: { after: opts?.spacing ?? 120, line: 276 },
    children: [bodyRun(text, { bold: opts?.bold, italics: opts?.italics })],
  });
}

function sectionBar(numero: number | string, titulo: string): Table {
  const numCell = new TableCell({
    width: { size: 600, type: WidthType.DXA },
    shading: { fill: C.dkGreen, type: ShadingType.CLEAR },
    verticalAlign: "center" as any,
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(numero), font: FONT, size: 24, bold: true, color: C.white })],
    })],
  });

  const titleCell = new TableCell({
    width: { size: CW - 600, type: WidthType.DXA },
    shading: { fill: C.paleGreen, type: ShadingType.CLEAR },
    verticalAlign: "center" as any,
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 6, color: C.ltGreen },
    },
    margins: { top: 80, bottom: 80, left: 150, right: 80 },
    children: [new Paragraph({
      children: [new TextRun({ text: titulo, font: FONT, size: H1_SIZE, bold: true, color: C.dkGreen })],
    })],
  });

  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [600, CW - 600],
    rows: [new TableRow({ children: [numCell, titleCell] })],
  });
}

function dataTable(headers: string[], rows: string[][], headerBg = C.mdGreen, headerColor = C.white): Table {
  const colCount = headers.length;
  const colWidth = Math.floor(CW / colCount);
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: C.rule };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      width: { size: colWidth, type: WidthType.DXA },
      shading: { fill: headerBg, type: ShadingType.CLEAR },
      borders,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: h, font: FONT, size: NOTE_SIZE, bold: true, color: headerColor })],
      })],
    })),
  });

  const dataRows = rows.map((row, idx) => new TableRow({
    children: row.map(cell => new TableCell({
      width: { size: colWidth, type: WidthType.DXA },
      shading: { fill: idx % 2 === 0 ? C.white : C.stone, type: ShadingType.CLEAR },
      borders,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({
        children: [new TextRun({ text: cell || "—", font: FONT, size: NOTE_SIZE, color: C.ink })],
      })],
    })),
  }));

  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth),
    rows: [headerRow, ...dataRows],
  });
}

function highlightBox(text: string, bgColor = C.ltGreen, borderColor = C.mdGreen): Table {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [CW],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CW, type: WidthType.DXA },
        shading: { fill: bgColor, type: ShadingType.CLEAR },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: borderColor },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: borderColor },
          left: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
          right: { style: BorderStyle.SINGLE, size: 2, color: borderColor },
        },
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
        children: [new Paragraph({
          children: [bodyRun(text, { bold: true, color: C.dkGreen })],
        })],
      })],
    })],
  });
}

// ─── Build Document from JSON ───────────────────────────────────────────────

function buildDocxFromLaudo(laudo: any, tipo: string): Document {
  const capa = laudo.capa || {};
  const ficha = laudo.ficha_tecnica || {};
  const secoes = laudo.secoes || [];
  const anexos = laudo.anexos || [];

  // Build sections content
  const children: any[] = [];

  // ─── Cover Page ───
  children.push(new Paragraph({ spacing: { before: 3000 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: capa.titulo || "LAUDO TÉCNICO", font: FONT, size: 48, bold: true, color: C.dkGreen })],
  }));
  if (capa.subtitulo) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: capa.subtitulo, font: FONT, size: 24, italics: true, color: C.mdGray })],
    }));
  }
  if (capa.culturas_safra) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: capa.culturas_safra, font: FONT, size: 22, color: C.dkGray })],
    }));
  }
  if (capa.numero_laudo) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Nº ${capa.numero_laudo}`, font: FONT, size: 28, bold: true, color: C.dkGreen })],
    }));
  }

  // Ficha técnica on cover
  if (ficha && Object.keys(ficha).length > 0) {
    children.push(new Paragraph({ spacing: { before: 600 } }));
    const fichaLabels: Record<string, string> = {
      produtor: "Produtor Rural", cpf_cnpj: "CPF/CNPJ", propriedade: "Propriedade",
      car: "Registro CAR", area_cultivada: "Área cultivada", safra: "Safra de referência",
      credor: "Credor", finalidade: "Finalidade do laudo", agronomo: "Eng. Agrônomo",
      crea: "CREA", data_vistoria: "Data da vistoria", data_emissao: "Data de emissão",
    };
    const fichaRows = Object.entries(fichaLabels)
      .filter(([key]) => ficha[key])
      .map(([key, label]) => [label, ficha[key]]);
    if (fichaRows.length > 0) {
      children.push(dataTable(["Campo", "Dado"], fichaRows, C.dkGreen));
    }
  }

  // Page break after cover
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ─── Content Sections ───
  for (const secao of secoes) {
    children.push(new Paragraph({ spacing: { before: 200 } }));
    children.push(sectionBar(secao.numero, secao.titulo));
    children.push(new Paragraph({ spacing: { after: 120 } }));

    // Paragraphs
    if (secao.paragrafos && Array.isArray(secao.paragrafos)) {
      for (const p of secao.paragrafos) {
        if (typeof p === "string") {
          children.push(bodyParagraph(p));
        }
      }
    }

    // Subtitles with paragraphs
    if (secao.subsecoes && Array.isArray(secao.subsecoes)) {
      for (const sub of secao.subsecoes) {
        children.push(new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: sub.titulo, font: FONT, size: H2_SIZE, bold: true, color: C.mdGreen })],
        }));
        if (sub.paragrafos) {
          for (const p of sub.paragrafos) {
            children.push(bodyParagraph(p));
          }
        }
        if (sub.tabela) {
          const t = sub.tabela;
          if (t.headers && t.linhas) {
            children.push(dataTable(t.headers, t.linhas));
            children.push(new Paragraph({ spacing: { after: 120 } }));
          }
        }
      }
    }

    // Tables
    if (secao.tabelas && Array.isArray(secao.tabelas)) {
      for (const t of secao.tabelas) {
        if (t.titulo) {
          children.push(new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [bodyRun(t.titulo, { bold: true, size: NOTE_SIZE, color: C.mdGray })],
          }));
        }
        if (t.tipo === "chave_valor" && t.linhas) {
          children.push(dataTable(["Campo", "Dado"], t.linhas, C.dkGreen));
        } else if (t.headers && t.linhas) {
          children.push(dataTable(t.headers, t.linhas));
        } else if (t.linhas) {
          // Infer headers from first row
          const headers = t.linhas[0] || [];
          children.push(dataTable(headers, t.linhas.slice(1)));
        }
        children.push(new Paragraph({ spacing: { after: 120 } }));
      }
    }

    // Highlight boxes
    if (secao.destaque) {
      children.push(highlightBox(secao.destaque));
      children.push(new Paragraph({ spacing: { after: 120 } }));
    }
  }

  // ─── Annexes ───
  if (anexos.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionBar("📎", "ANEXOS"));
    children.push(new Paragraph({ spacing: { after: 120 } }));
    const anexoRows = anexos.map((a: string, i: number) => [String(i + 1), a]);
    children.push(dataTable(["Nº", "Documento"], anexoRows));
  }

  // ─── Fallback: if only raw text ───
  if (laudo.texto_completo && secoes.length === 0) {
    const paragraphs = laudo.texto_completo.split("\n\n");
    for (const p of paragraphs) {
      if (p.startsWith("#")) {
        const level = p.match(/^#+/)?.[0]?.length || 1;
        const text = p.replace(/^#+\s*/, "");
        children.push(new Paragraph({
          heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text, font: FONT, size: level === 1 ? 32 : 28, bold: true, color: C.dkGreen })],
        }));
      } else {
        children.push(bodyParagraph(p));
      }
    }
  }

  // Build document
  const agronomo = ficha.agronomo || "Engenheiro Agrônomo";
  const crea = ficha.crea || "CREA";
  const numLaudo = capa.numero_laudo || "";

  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE, color: C.ink } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // ~2cm
        },
      },
      headers: {
        default: new Header({
          children: [new Table({
            width: { size: CW, type: WidthType.DXA },
            columnWidths: [Math.floor(CW * 0.55), Math.floor(CW * 0.45)],
            rows: [new TableRow({
              children: [
                new TableCell({
                  width: { size: Math.floor(CW * 0.55), type: WidthType.DXA },
                  shading: { fill: C.dkGreen, type: ShadingType.CLEAR },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  margins: { top: 40, bottom: 40, left: 80, right: 80 },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: agronomo, font: FONT, size: 16, bold: true, color: C.white })] }),
                    new Paragraph({ children: [new TextRun({ text: crea, font: FONT, size: 14, color: C.ltGreen })] }),
                  ],
                }),
                new TableCell({
                  width: { size: Math.floor(CW * 0.45), type: WidthType.DXA },
                  shading: { fill: C.mdGreen, type: ShadingType.CLEAR },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  margins: { top: 40, bottom: 40, left: 80, right: 80 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [new TextRun({ text: capa.titulo || "LAUDO TÉCNICO", font: FONT, size: 16, bold: true, color: C.white })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [new TextRun({ text: numLaudo, font: FONT, size: 14, color: C.ltGreen })],
                    }),
                  ],
                }),
              ],
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100 },
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.ltGray, space: 4 } },
            children: [
              new TextRun({ text: `${capa.titulo || "Laudo Técnico"} — ${numLaudo}  |  Página `, font: FONT, size: 16, color: C.mdGray }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: C.mdGray }),
              new TextRun({ text: " de ", font: FONT, size: 16, color: C.mdGray }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: C.mdGray }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Exige usuário autenticado
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } },
    );
    const { data: authData } = token
      ? await authClient.auth.getUser(token)
      : { data: { user: null } };
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { laudo_data, tipo, laudo_id } = await req.json();
    
    if (!laudo_data) throw new Error("laudo_data é obrigatório");

    // O laudo precisa estar visível para o chamador (RLS)
    if (laudo_id) {
      const { data: laudoOk } = await authClient
        .from("laudos").select("id").eq("id", laudo_id).maybeSingle();
      if (!laudoOk) {
        return new Response(JSON.stringify({ error: "Laudo não encontrado ou sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const doc = buildDocxFromLaudo(laudo_data, tipo || "perda");
    const buffer = await Packer.toBuffer(doc);

    // If laudo_id provided, upload to storage
    if (laudo_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceKey);

      const fileName = `${laudo_id}/${tipo || "perda"}_${Date.now()}.docx`;
      const { error: uploadError } = await sb.storage
        .from("laudos")
        .upload(fileName, buffer, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Erro ao salvar o arquivo: " + uploadError.message);
      }

      const { data: urlData } = sb.storage.from("laudos").getPublicUrl(fileName);

      return new Response(JSON.stringify({ 
        success: true, 
        file_name: fileName,
        url: urlData?.publicUrl || null,
        message: "Laudo .docx gerado e salvo com sucesso" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return buffer directly
    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="laudo_${tipo || "perda"}.docx"`,
      },
    });
  } catch (e) {
    console.error("gerar-laudo-docx error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
