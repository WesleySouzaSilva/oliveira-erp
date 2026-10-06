import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NASA MODIS/VIIRS NDVI data via TESViS REST API (free, no key required)
// API docs: https://modis.ornl.gov/rst/api/v1/
const MODIS_BASE = "https://modis.ornl.gov/rst/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, data_inicio, data_fim, produto } = await req.json();

    if (!latitude || !longitude) {
      throw new Error("Informe latitude e longitude da propriedade");
    }

    // NDVI product: MOD13Q1 (250m, 16-day MODIS Terra) or VNP13A1 (500m VIIRS)
    const modisProduct = produto || "MOD13Q1";
    
    // 1. Get available dates for this location
    const datesUrl = `${MODIS_BASE}/${modisProduct}/dates?latitude=${latitude}&longitude=${longitude}`;
    const datesResponse = await fetch(datesUrl, {
      headers: { "Accept": "application/json" },
    });
    
    if (!datesResponse.ok) {
      const errText = await datesResponse.text();
      throw new Error(`NASA MODIS API error (dates): ${datesResponse.status} - ${errText}`);
    }
    
    const allDates = await datesResponse.json();
    
    // Filter dates by range if provided
    let filteredDates = allDates;
    if (data_inicio || data_fim) {
      filteredDates = allDates.filter((d: any) => {
        const date = d.calendar_date;
        if (data_inicio && date < data_inicio) return false;
        if (data_fim && date > data_fim) return false;
        return true;
      });
    }
    
    // Take last 12 dates (approximately 6 months of 16-day composites)
    const recentDates = filteredDates.slice(-12);
    
    if (recentDates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          mensagem: "Nenhum dado NDVI disponível para este período/localização",
          latitude,
          longitude,
          produto: modisProduct,
          ndvi_data: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get NDVI subset data for each date
    const ndviData: any[] = [];
    
    for (const dateObj of recentDates) {
      try {
        const subsetUrl = `${MODIS_BASE}/${modisProduct}/subset?latitude=${latitude}&longitude=${longitude}&band=250m_16_days_NDVI&startDate=${dateObj.modis_date}&endDate=${dateObj.modis_date}&kmAboveBelow=0&kmLeftRight=0`;
        
        const subsetResponse = await fetch(subsetUrl, {
          headers: { "Accept": "application/json" },
        });
        
        if (subsetResponse.ok) {
          const subsetData = await subsetResponse.json();
          
          if (subsetData.subset && subsetData.subset.length > 0) {
            const subset = subsetData.subset[0];
            // MODIS NDVI is scaled by 10000
            const ndviRaw = subset.data?.[0] ?? null;
            const ndviValue = ndviRaw !== null ? ndviRaw / 10000 : null;
            
            ndviData.push({
              data: dateObj.calendar_date,
              modis_date: dateObj.modis_date,
              ndvi: ndviValue,
              ndvi_raw: ndviRaw,
              qualidade: ndviValue !== null ? (
                ndviValue > 0.6 ? "vegetação densa" :
                ndviValue > 0.4 ? "vegetação moderada" :
                ndviValue > 0.2 ? "vegetação esparsa" :
                ndviValue > 0 ? "solo exposto/vegetação mínima" :
                "água/nuvem/sem dado"
              ) : "sem dado",
            });
          }
        } else {
          await subsetResponse.text(); // consume body
        }
      } catch (e) {
        console.log(`Failed to get NDVI for ${dateObj.calendar_date}:`, e);
      }
    }

    // Calculate statistics
    const validNdvi = ndviData.filter(d => d.ndvi !== null && d.ndvi > -0.5);
    const stats = validNdvi.length > 0 ? {
      media: validNdvi.reduce((s, d) => s + d.ndvi, 0) / validNdvi.length,
      minimo: Math.min(...validNdvi.map(d => d.ndvi)),
      maximo: Math.max(...validNdvi.map(d => d.ndvi)),
      variacao: Math.max(...validNdvi.map(d => d.ndvi)) - Math.min(...validNdvi.map(d => d.ndvi)),
      tendencia: validNdvi.length >= 2 ? (
        validNdvi[validNdvi.length - 1].ndvi > validNdvi[0].ndvi ? "crescente" :
        validNdvi[validNdvi.length - 1].ndvi < validNdvi[0].ndvi ? "decrescente" :
        "estável"
      ) : "insuficiente",
    } : null;

    // Generate satellite image URL (NASA Worldview)
    const worldviewUrl = `https://worldview.earthdata.nasa.gov/?v=${longitude - 0.5},${latitude - 0.5},${longitude + 0.5},${latitude + 0.5}&l=MODIS_Terra_NDVI_8Day&t=${recentDates[recentDates.length - 1]?.calendar_date || ""}`;

    return new Response(
      JSON.stringify({
        success: true,
        latitude,
        longitude,
        produto: modisProduct,
        periodo: {
          inicio: recentDates[0]?.calendar_date,
          fim: recentDates[recentDates.length - 1]?.calendar_date,
        },
        ndvi_data: ndviData,
        estatisticas: stats,
        imagem_satelite_url: worldviewUrl,
        fonte: "NASA MODIS/VIIRS via ORNL DAAC TESViS",
        consultado_em: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
