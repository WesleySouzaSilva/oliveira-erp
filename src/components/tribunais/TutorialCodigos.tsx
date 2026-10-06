import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  BookOpen, Copy, Eye, History, KeyRound, Plus, ShieldCheck, Timer, Users, TriangleAlert,
} from "lucide-react";

interface Passo {
  icone: React.ElementType;
  titulo: string;
  texto: string;
}

const PASSOS_EQUIPE: Passo[] = [
  {
    icone: Eye,
    titulo: "1. Abra o acesso que você precisa",
    texto:
      "Cada cartão é um login de tribunal ou sistema. Você só enxerga os acessos liberados para você. Clique em \"Ver código\" no cartão certo.",
  },
  {
    icone: Timer,
    titulo: "2. Use o código antes da barra acabar",
    texto:
      "O código de 6 dígitos vale por poucos segundos. A barrinha embaixo mostra o tempo restante e ele fica vermelho quando está acabando — se acabar, o sistema gera outro sozinho.",
  },
  {
    icone: Copy,
    titulo: "3. Copie e cole no site do tribunal",
    texto:
      "Use o botão \"Copiar\" e cole no campo de verificação em duas etapas do tribunal. Se der erro, espere gerar o próximo código e tente com ele — nunca digite um código já vencido.",
  },
  {
    icone: ShieldCheck,
    titulo: "4. Tudo fica registrado",
    texto:
      "Cada vez que alguém abre um código, fica gravado quem abriu e quando. Não é vigilância: é rastreabilidade, exigida por se tratar de acesso a sistemas oficiais.",
  },
];

const PASSOS_GESTOR: Passo[] = [
  {
    icone: Plus,
    titulo: "Cadastrar um novo acesso",
    texto:
      "Em \"Novo acesso\", informe o nome (ex.: TJ-PR — Certificado do escritório) e cole a chave secreta que o tribunal mostra ao ativar a verificação em duas etapas (aquele texto ao lado do QR Code). Depois de salvar, confira se o código exibido bate com o do aplicativo antes de fechar.",
  },
  {
    icone: Users,
    titulo: "Liberar quem pode ver",
    texto:
      "No ícone de pessoas do cartão, marque os colaboradores que podem gerar aquele código. Quem não estiver marcado simplesmente não vê o cartão.",
  },
  {
    icone: History,
    titulo: "Conferir o histórico",
    texto:
      "O botão \"Histórico\" mostra quem consultou cada acesso. As renovações automáticas ficam ocultas por padrão para não poluir — dá para exibi-las quando precisar auditar em detalhe.",
  },
  {
    icone: KeyRound,
    titulo: "Renomear ou remover",
    texto:
      "O lápis renomeia. A lixeira apaga o acesso para todo mundo e a chave original não é recuperável — guarde-a antes se ainda for usar. O histórico de consultas é preservado.",
  },
];

function Lista({ passos }: { passos: Passo[] }) {
  return (
    <div className="space-y-3">
      {passos.map((p) => (
        <div key={p.titulo} className="flex gap-3">
          <div className="mt-0.5 shrink-0 rounded-md bg-secondary p-2 text-primary">
            <p.icone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{p.titulo}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{p.texto}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TutorialCodigos({ custodiante }: { custodiante: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <BookOpen className="w-4 h-4" /> Como usar
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> Como usar os códigos dos tribunais
            </DialogTitle>
            <DialogDescription>
              Guia rápido para a equipe. Leva menos de dois minutos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card className="p-4 bg-secondary/40">
              <p className="text-sm text-muted-foreground">
                Esta tela substitui o aplicativo autenticador no celular. Ela gera o
                código temporário de verificação em duas etapas dos tribunais e
                sistemas do escritório, sem que ninguém precise guardar a chave
                secreta ou depender do telefone de um colega.
              </p>
            </Card>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">No dia a dia</h3>
                <Badge variant="secondary">Toda a equipe</Badge>
              </div>
              <Lista passos={PASSOS_EQUIPE} />
            </section>

            {custodiante && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Gestão dos acessos</h3>
                  <Badge variant="secondary">Administradores e responsáveis</Badge>
                </div>
                <Lista passos={PASSOS_GESTOR} />
              </section>
            )}

            <Card className="p-4 border-destructive/30">
              <div className="flex gap-3">
                <TriangleAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Regras de segurança</p>
                  <p>Não tire print, não mande código por WhatsApp e não compartilhe sua conta: cada consulta é registrada no seu nome.</p>
                  <p>Se um código não for aceito duas vezes seguidas, avise o responsável em vez de insistir — pode ser bloqueio do tribunal.</p>
                  <p>Depois de um tempo com o cartão aberto, a renovação automática pausa. Basta clicar em atualizar para continuar.</p>
                </div>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
