export interface Laudo {
  id: string;
  numero: string;
  produtor: string;
  cultura: string;
  safra: string;
  municipio: string;
  uf: string;
  status: "rascunho" | "analise" | "finalizado" | "exportado";
  createdAt: string;
}

export const mockLaudos: Laudo[] = [
  {
    id: "1",
    numero: "LA-2025-0001",
    produtor: "José Carlos da Silva",
    cultura: "Soja",
    safra: "2024/2025",
    municipio: "Londrina",
    uf: "PR",
    status: "finalizado",
    createdAt: "2025-03-15",
  },
  {
    id: "2",
    numero: "LA-2025-0002",
    produtor: "Maria Aparecida Souza",
    cultura: "Milho",
    safra: "2024/2025",
    municipio: "Ribeirão Preto",
    uf: "SP",
    status: "analise",
    createdAt: "2025-03-12",
  },
  {
    id: "3",
    numero: "LA-2025-0003",
    produtor: "Fazenda Três Irmãos Ltda",
    cultura: "Café Arábica",
    safra: "2024/2025",
    municipio: "Patrocínio",
    uf: "MG",
    status: "rascunho",
    createdAt: "2025-03-10",
  },
  {
    id: "4",
    numero: "LA-2025-0004",
    produtor: "Pedro Henrique Oliveira",
    cultura: "Algodão",
    safra: "2023/2024",
    municipio: "Luís Eduardo Magalhães",
    uf: "BA",
    status: "exportado",
    createdAt: "2025-02-28",
  },
  {
    id: "5",
    numero: "LA-2025-0005",
    produtor: "Agropecuária Santa Fé",
    cultura: "Pecuária Bovina de Corte",
    safra: "2024/2025",
    municipio: "Campo Grande",
    uf: "MS",
    status: "rascunho",
    createdAt: "2025-02-20",
  },
  {
    id: "6",
    numero: "LA-2025-0006",
    produtor: "Antônio Marcos Pereira",
    cultura: "Arroz",
    safra: "2024/2025",
    municipio: "Pelotas",
    uf: "RS",
    status: "finalizado",
    createdAt: "2025-02-15",
  },
];
