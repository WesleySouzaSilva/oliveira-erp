import { motion } from "framer-motion";
import {
  Upload,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ChevronDown,
  Download,
  Link2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_OPTIONS } from "@/components/vencimentos/lib/types";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

interface VencimentosToolbarProps {
  search: string;
  setSearch: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterBanco: string;
  setFilterBanco: (v: string) => void;
  bancos: (string | null)[];
  onNovo: () => void;
  onImportClick: () => void;
  syncConfig: any;
  syncing: boolean;
  onResync: () => void;
  onDisconnectSheets: () => void;
  onOpenSheets: () => void;
  onExport: () => void;
  duplicateGroupsCount: number;
  onOpenDuplicates: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function VencimentosToolbar({
  search,
  setSearch,
  filterStatus,
  setFilterStatus,
  filterBanco,
  setFilterBanco,
  bancos,
  onNovo,
  onImportClick,
  syncConfig,
  syncing,
  onResync,
  onDisconnectSheets,
  onOpenSheets,
  onExport,
  duplicateGroupsCount,
  onOpenDuplicates,
  fileInputRef,
  onImportCSV,
}: VencimentosToolbarProps) {
  return (
    <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-[2_1_320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente, contrato, banco..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-[150px]">
          <Filter className="w-4 h-4 mr-1" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterBanco} onValueChange={setFilterBanco}>
        <SelectTrigger className="w-[150px]">
          <ChevronDown className="w-4 h-4 mr-1" />
          <SelectValue placeholder="Banco" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos bancos</SelectItem>
          {bancos.map((b) => (
            <SelectItem key={b!} value={b!}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="hidden h-7 w-px bg-border lg:block" />
      <Button onClick={onNovo}>
        <Plus className="w-4 h-4" /> Novo
      </Button>
      <Button variant="outline" onClick={onImportClick}>
        <Upload className="w-4 h-4" /> Importar CSV
      </Button>
      {syncConfig ? (
        <>
          <Button variant="outline" onClick={onResync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sincronizar
          </Button>
          <Button variant="ghost" size="icon" onClick={onDisconnectSheets} title="Desconectar planilha" aria-label="Desconectar planilha">
            <Unlink className="w-4 h-4 text-muted-foreground" />
          </Button>
        </>
      ) : (
        <Button variant="outline" onClick={onOpenSheets}>
          <Link2 className="w-4 h-4" /> Google Sheets
        </Button>
      )}
      <Button variant="outline" onClick={onExport}>
        <Download className="w-4 h-4" /> Exportar
      </Button>
      {duplicateGroupsCount > 0 && (
        <Button variant="outline" onClick={onOpenDuplicates}>
          <AlertTriangle className="w-4 h-4 text-destructive" /> Revisar duplicados
        </Button>
      )}
      <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={onImportCSV} />
    </motion.div>
  );
}