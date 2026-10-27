import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import {
  Banknote, Briefcase, Building2, ChevronDown, FileSignature, FolderTree, KeyRound, Landmark, Layers, ListChecks, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plug, ScrollText, ShieldCheck, Tags, UserCog, Users, Waypoints, X,
} from "lucide-react";
import { autenticadoApi, buscarUsuarioAtual, logoutApi, usuarioApi, type UsuarioApi } from "@/lib/api/http";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { Button } from "@/components/ui/button";
import { TemaToggle } from "@/components/theme/TemaToggle";

/**
 * Layout dos módulos já migrados para a API própria (rotas `/erp/...`).
 *
 * É um shell enxuto de propósito: enquanto migramos módulo a módulo, o menu mostra só o que
 * já fala com a nossa API — o sistema antigo continua em `/` (Supabase). Quando um módulo
 * sai daqui, ele entra no `AppLayout` normal.
 *
 * Menu com recolhimento:
 *
 * - no desktop, o botão do topo recolhe a barra (`w-60` -> `w-[72px]`), some com os rótulos e
 *   deixa só os ícones centralizados; a escolha fica guardada no `localStorage`;
 * - no celular a barra vira uma gaveta que abre pelo hambúrguer (o menu recolhido do desktop
 *   não vale aqui: a gaveta abre cheia, com os rótulos), com fundo escurecido atrás.
 */
const CHAVE_MENU_RECOLHIDO = "oliveira:menu-recolhido";
/** Grupos do menu abertos/fechados (estilo do fonte antigo: clica no grupo e abre o submenu). */
const CHAVE_MENU_GRUPOS = "oliveira:menu-grupos";
const SUPABASE_CONFIGURADO = Boolean(import.meta.env.VITE_SUPABASE_URL);

export default function LayoutErp() {
  /** Sino de notificações de tarefa (mesmo contador da tela de Tarefas). */
  const sino = useNotificacoes();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<UsuarioApi | null>(() => usuarioApi());
  /** Barra recolhida no desktop (só ícones). */
  const [recolhido, setRecolhido] = useState(
    () => window.localStorage.getItem(CHAVE_MENU_RECOLHIDO) === "1",
  );
  /** Gaveta do menu aberta no celular. */
  const [gavetaAberta, setGavetaAberta] = useState(false);
  /**
   * Grupos abertos/fechados por id (padrão do fonte antigo — SidebarNavSection com
   * openMenus/toggleMenu). Guardado no localStorage; ausente = ABERTO, para nada
   * sumir do menu sem a pessoa ter mexido (pedido do titular 22/10).
   */
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>(() => {
    try {
      const bruto = window.localStorage.getItem(CHAVE_MENU_GRUPOS);
      if (bruto) return JSON.parse(bruto) as Record<string, boolean>;
    } catch {
      /* localStorage indisponível ou JSON sujo: começa com tudo aberto */
    }
    return {};
  });

  // Token guardado mas sem usuário em cache? Confirma a sessão contra a API (GET /auth/me).
  useEffect(() => {
    if (!autenticadoApi() || usuario) return;
    buscarUsuarioAtual()
      .then(setUsuario)
      .catch(() => {
        /* 401 já limpa a sessão e o guard abaixo manda para o login */
      });
  }, [usuario]);

  // Janela grande o suficiente? A gaveta só faz sentido no celular.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const fechar = () => setGavetaAberta(false);
    media.addEventListener("change", fechar);
    return () => media.removeEventListener("change", fechar);
  }, []);

  // Clientes (Base), Contratos Clientes e seus detalhes são de LEITURA para TODOS os
  // usuários da plataforma (decisão do titular, 15/10/2026) — quem vê quais contratos é
  // recorte da API; criar/editar continua exigindo o módulo clientes (ou admin/ceo).

  if (!autenticadoApi()) {
    return <Navigate to="/erp/entrar" replace />;
  }

  const sair = async () => {
    await logoutApi();
    navigate("/erp/entrar", { replace: true });
  };

  const alternarRecolhido = () => {
    setRecolhido((atual) => {
      window.localStorage.setItem(CHAVE_MENU_RECOLHIDO, atual ? "0" : "1");
      return !atual;
    });
  };

  /** Link do menu: ícone sempre; rótulo some quando a barra está recolhida. */
  const itemMenu = (icone: ReactNode, rotulo: string, destino: string, selo?: ReactNode) => (
    <NavLink
      to={destino}
      onClick={() => setGavetaAberta(false)}
      title={rotulo}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        } ${recolhido ? "lg:justify-center lg:px-0" : ""}`
      }
    >
      <span className="relative inline-flex">
        {icone}
        {selo}
      </span>
      <span className={recolhido ? "lg:hidden" : ""}>{rotulo}</span>
    </NavLink>
  );

  /**
   * Grupo retrátil do menu (espelho do fonte antigo): o rótulo do grupo é um botão —
   * clicou, abre/fecha os itens dele; a escolha fica no localStorage. Com a barra
   * recolhida (só ícones) os grupos ficam sempre abertos e o rótulo some.
   */
  const grupoMenu = (id: string, titulo: string, conteudo: ReactNode) => {
    const aberto = gruposAbertos[id] !== false;
    return (
      <div>
        <button
          type="button"
          onClick={() =>
            setGruposAbertos((atual) => {
              const novo = { ...atual, [id]: !aberto };
              try {
                window.localStorage.setItem(CHAVE_MENU_GRUPOS, JSON.stringify(novo));
              } catch {
                /* sem localStorage: a escolha vale só nesta sessão */
              }
              return novo;
            })
          }
          aria-expanded={aberto}
          className={`w-full flex items-center gap-1 px-3 pt-4 pb-1 text-[11px] font-semibold uppercase text-muted-foreground tracking-wide hover:text-foreground transition-colors ${recolhido ? "lg:hidden" : ""}`}
        >
          <ChevronDown
            className={`w-3 h-3 shrink-0 transition-transform ${aberto ? "" : "-rotate-90"}`}
          />
          {titulo}
        </button>
        {(aberto || recolhido) && (
          <div className="space-y-1">{conteudo}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Barra de topo só no celular (menu recolhido vira gaveta) */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          aria-label="Abrir menu"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-serif font-bold">Oliveira</span>
        <TemaToggle className="ml-auto" />
      </header>

      {/* Fundo escuro atrás da gaveta no celular */}
      {gavetaAberta && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setGavetaAberta(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`bg-card/40 border-r flex-col shrink-0 w-60 transition-[width] duration-200 ${
          gavetaAberta ? "flex fixed inset-y-0 left-0 z-50 shadow-2xl" : "hidden"
        } lg:flex lg:static lg:z-auto lg:shadow-none ${recolhido ? "lg:w-[72px]" : ""}`}
      >
        <div
          className={`px-4 py-4 border-b flex items-center gap-2 ${
            recolhido ? "lg:flex-col lg:gap-3 lg:px-2" : ""
          }`}
        >
          <span className="w-8 h-8 shrink-0 rounded-lg bg-primary text-primary-foreground grid place-items-center font-serif font-bold">
            O
          </span>
          <div className={`leading-tight min-w-0 ${recolhido ? "lg:hidden" : ""}`}>
            <p className="font-serif font-bold text-sm">Oliveira</p>
            <p className="text-[11px] text-muted-foreground">módulos na API</p>
          </div>
          <div className={`flex items-center gap-1 ${recolhido ? "lg:mt-1" : "ml-auto"}`}>
            <TemaToggle />
            <button
              type="button"
              onClick={alternarRecolhido}
              title={recolhido ? "Expandir menu" : "Recolher menu"}
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
              className="hidden lg:inline-flex w-7 h-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {recolhido ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setGavetaAberta(false)}
              aria-label="Fechar menu"
              className="lg:hidden w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {/* Sino de notificações no menu Tarefas: some quando a pessoa ABRE a tarefa */}
          {itemMenu(
            <ListChecks className="w-4 h-4" />,
            "Tarefas",
            "/erp/tarefas",
            sino.naoLidas > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold grid place-items-center">
                {sino.naoLidas > 99 ? "99+" : sino.naoLidas}
              </span>
            ) : undefined,
          )}
          {/* Grupo Clientes: Base + Contratos (contrato com o ESCRITÓRIO) */}
          {grupoMenu(
            "clientes",
            "Clientes",
            <>
              {itemMenu(<Users className="w-4 h-4" />, "Base", "/erp/clientes")}
              {itemMenu(
                <FileSignature className="w-4 h-4" />,
                "Contratos",
                "/erp/contratos",
              )}
            </>,
          )}
          {/* Grupo Comercial: "Contratos Cliente" = contrato do cliente COM OS BANCOS
              (correção do titular 22/10) */}
          {grupoMenu(
            "comercial",
            "Comercial",
            itemMenu(
              <Landmark className="w-4 h-4" />,
              "Contratos Cliente",
              "/erp/contratos-banco",
            ),
          )}
          {/* Ferramentas: códigos dos tribunais — leitura para TODOS (a gestão
              (cadastrar/remover/histórico) é só admin, barrada pela API) */}
          {grupoMenu(
            "ferramentas",
            "Ferramentas",
            itemMenu(
              <KeyRound className="w-4 h-4" />,
              "Códigos dos tribunais",
              "/erp/codigos-tribunais",
            ),
          )}
          {/* Pessoas e permissões: SÓ o administrador (decisão do titular 16/10/2026) —
              é ele quem cadastra usuário, atribui permissão e acompanha a auditoria */}
          {usuario?.admin &&
            grupoMenu(
              "administracao",
              "Administração",
              <>
                {itemMenu(<UserCog className="w-4 h-4" />, "Usuários", "/erp/usuarios")}
                {itemMenu(<ShieldCheck className="w-4 h-4" />, "Permissões", "/erp/permissoes")}
                {itemMenu(<ScrollText className="w-4 h-4" />, "Auditoria", "/erp/auditoria")}
                {/* Integrações (26/10/2026): config da Invertexto (CEP/CNPJ) + consumo —
                    destino do card que antes só existia em /configuracoes. */}
                {itemMenu(<Plug className="w-4 h-4" />, "Integrações", "/erp/integracoes")}
              </>,
            )}
          {(usuario?.admin || usuario?.ceo) &&
            grupoMenu(
              "cadastro",
              "Cadastro",
              <>
                {itemMenu(<FolderTree className="w-4 h-4" />, "Objetos", "/erp/objetos")}
                {itemMenu(<Layers className="w-4 h-4" />, "Sub-Categoria / Objeto", "/erp/sub-objetos")}
                {itemMenu(<Waypoints className="w-4 h-4" />, "Setores", "/erp/setores")}
                {itemMenu(<Briefcase className="w-4 h-4" />, "Funções", "/erp/funcoes")}
                {/* Tipos de tarefa: é o destino do aviso "cadastre em Cadastro > Tipos de
                    tarefa" do form de nova tarefa (Tarefas.tsx) — rótulo exato. */}
                {itemMenu(<Tags className="w-4 h-4" />, "Tipos de tarefa", "/erp/tipos-tarefa")}
                {/* Bancos: é a origem do seletor "Banco" do form de contrato do Comercial
                    (antes lista fixa no fonte) — destino do aviso "cadastre em Cadastro >
                    Bancos". */}
                {itemMenu(<Banknote className="w-4 h-4" />, "Bancos", "/erp/bancos")}
              </>,
            )}
        </nav>

        <div className={`p-3 border-t space-y-2 ${recolhido ? "lg:px-2" : ""}`}>
          <div
            className={`px-2 text-xs text-muted-foreground truncate ${recolhido ? "lg:hidden" : ""}`}
            title={usuario?.email}
          >
            {usuario?.nome || usuario?.email}
          </div>
          {SUPABASE_CONFIGURADO && (
            <Button
              variant="outline"
              size="sm"
              title="Sistema antigo"
              className={`w-full ${recolhido ? "lg:justify-center lg:px-0" : "justify-start"}`}
              asChild
            >
              <a href="/">
                <Building2 className="w-4 h-4 lg:mr-0" />
                <span className={recolhido ? "lg:hidden" : ""}>Sistema antigo</span>
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            title="Sair"
            className={`w-full ${recolhido ? "lg:justify-center lg:px-0" : "justify-start"}`}
            onClick={sair}
          >
            <LogOut className="w-4 h-4 lg:mr-0" />
            <span className={recolhido ? "lg:hidden" : ""}>Sair</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
