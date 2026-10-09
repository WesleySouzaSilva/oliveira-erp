/**
 * Contrato de página da API (`org.springframework.data.Page` → `content` + `page`).
 * Mora aqui para todos os recursos da API própria (`clientes`, `tarefas`, ...) importarem
 * um tipo neutro em vez de se referirem a outro módulo.
 */
export interface Pagina<T> {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  };
}
