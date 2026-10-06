import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientSearchInput } from "@/components/ClientSearchInput";
import { toast } from "sonner";
import { Loader2, MapPin, Camera, ChevronLeft } from "lucide-react";

/**
 * Modo de campo (mobile-first) para agrônomos:
 * - selecionar/buscar cliente
 * - registrar visita rápida (data, observações, foto opcional, GPS opcional)
 * Grava em `atividades_clientes` (tipo='visita_campo') — aparece na timeline do cliente.
 */
export default function Campo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<string>("");
  const [obs, setObs] = useState("");
  const [coords, setCoords] = useState<string>("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  function capturarGPS() {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não disponível neste dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
      () => toast.error("Não foi possível obter a localização."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function salvar() {
    if (!user) return;
    if (!cliente.trim()) { toast.error("Selecione o cliente."); return; }
    if (!obs.trim()) { toast.error("Descreva o que foi observado."); return; }
    setSalvando(true);
    try {
      let anexoUrl: string | null = null;
      if (foto) {
        const path = `campo/${user.id}/${Date.now()}-${foto.name}`;
        const up = await supabase.storage.from("arquivos-cliente").upload(path, foto, { upsert: false });
        if (!up.error) {
          const { data } = supabase.storage.from("arquivos-cliente").getPublicUrl(path);
          anexoUrl = data.publicUrl;
        }
      }
      const desc = [obs.trim(), coords ? `📍 ${coords}` : null].filter(Boolean).join("\n\n");
      const { error } = await supabase.from("atividades_clientes").insert({
        user_id: user.id,
        nome_cliente: cliente.trim(),
        descricao: desc,
        tipo: "visita_campo",
        anexo_url: anexoUrl,
      });
      if (error) throw error;
      toast.success("Visita registrada!");
      navigate(`/clientes/${encodeURIComponent(cliente.trim())}`);
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e?.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-3 max-w-md mx-auto">
          <Link to="/" className="p-1 -ml-1"><ChevronLeft className="w-5 h-5" /></Link>
          <h1 className="text-base font-semibold">Modo Campo</h1>
        </div>
      </div>
      <div className="p-4 max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registrar visita</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Cliente</label>
              <ClientSearchInput value={cliente} onChange={setCliente} placeholder="Nome do produtor" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">O que foi observado</label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={5} placeholder="Ex: lavoura de soja em R5, presença de ferrugem leve…" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={capturarGPS} className="gap-1">
                <MapPin className="w-3.5 h-3.5" /> GPS
              </Button>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" className="w-full gap-1" asChild>
                  <span><Camera className="w-3.5 h-3.5" /> {foto ? foto.name.slice(0, 12) : "Foto"}</span>
                </Button>
                <input
                  type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => setFoto(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            {coords && <p className="text-[11px] text-muted-foreground">📍 {coords}</p>}

            <Button onClick={salvar} disabled={salvando} className="w-full">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar visita"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}