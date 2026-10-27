import { useState } from "react";
import { motion } from "framer-motion";
import { Plug } from "lucide-react";
import { ApiKeysManager } from "./ApiKeysManager";
import { IntegracaoInvertextoCard } from "./IntegracaoInvertextoCard";
import { IntegracoesLista } from "./IntegracoesLista";

/**
 * Tela de Integrações (Administração > Integrações). Mostra NOSSA lista de integrações
 * cadastradas (da API Spring) com url, descrição, apikey oculta e "Testar todas", mais o
 * editor da Invertexto (CEP/CNPJ) e o gerenciador de chaves.
 *
 * Os cards de status de terceiros (Advbox/Meta/Claude) e o teste "integrations-status"
 * vinham de edge functions Supabase que não existem nesta API própria — saíram daqui
 * (mostravam erro/indisponível). O foco são as integrações da nossa API.
 */
export function IntegracoesPanel() {
  /** Incrementado quando o editor salva — a lista recarrega (gera a lista ao salvar). */
  const [versao, setVersao] = useState(0);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plug className="w-4 h-4 text-primary" /> Integrações
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure as integrações externas (url, apikey, limite), veja a lista cadastrada e
          teste as conexões.
        </p>
      </motion.div>

      {/* Lista das integrações já cadastradas (url, descrição, apikey oculta) + Testar todas. */}
      <IntegracoesLista versao={versao} />

      {/* Editor da Invertexto (CEP/CNPJ): ao salvar, a lista acima recarrega. */}
      <IntegracaoInvertextoCard aoSalvar={() => setVersao((v) => v + 1)} />

      <div className="border-t border-border pt-6 mt-6">
        <ApiKeysManager />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Para adicionar novas chaves de API de terceiros, acesse as configurações de Lovable
        Cloud do projeto. As chaves ficam armazenadas com segurança e nunca são expostas no
        navegador.
      </p>
    </div>
  );
}
