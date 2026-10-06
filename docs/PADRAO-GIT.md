# Padrão de Git — branches, commits e Pull Requests

Padrão adotado pelo time (arquivo de origem: `padrao estrutura github.txt`). Fonte:
[uma maneira de organizar suas branches, commits e pull requests](https://www.tabnews.com.br/guscsales/uma-maneira-de-organizar-suas-branches-commits-e-pull-requests).

---

## Passo 1 — Nome da branch

Sempre que for modificar ou criar código, separe por branch: fica mais fácil entender o que foi
feito antes de atualizar o projeto principal. O padrão usa as **iniciais do projeto + uma sequência
numérica** (ex.: `sistema-hotel-pet` → `SHP-1`).

```text
# Padrão
<id-da-sua-tarefa>/<super-resumo-da-feature>

# Exemplo de criação
git checkout -b TL-100/create-post-api
# ex.: SHP-1/criar-projeto
```

Usar Trello/Jira para os IDs das tarefas liga a branch à tarefa, deixando o projeto fácil de
entender por qualquer desenvolvedor.

## Passo 2 — Padrões de commit (convenção Angular)

Mantenha o padrão `tipo(escopo): descrição` nos commits.

| tipo | quando usar |
| --- | --- |
| `feat` | novo recurso para a aplicação; não precisa ser grande — algo que não existia e que a pessoa final irá acessar |
| `fix` | correções de bugs |
| `docs` | alterações em arquivos relacionados à documentação |
| `style` | alterações de estilização, formatação etc. |
| `refactor` | código de refatoração: mudança transparente para o usuário final, porém real para a aplicação |
| `perf` | alterações relacionadas à performance |
| `test` | criação ou modificação de testes |
| `chore` | alterações em arquivos de configuração, build, distribuição, CI e afins (nada que envolva diretamente o código da aplicação para o usuário final) |

```text
# Exemplos
feat(post): criar nova integracao com a API
feat: criar nova integracao POST com a API
test: adicionar testes a nova inregracao
```

Inicia-se pelo **tipo**, seguido do **escopo** (opcional) e, então, de uma **descrição** da
funcionalidade.

## Passo 3 — Padrão de título na Pull Request

Une a convenção da branch com a do commit, dando contexto à alteração.

```text
# Padrão
[<id-da-sua-tarefa>] tipo(escopo): descrição

# Exemplo
[SHP-1] feat(post): criar nova integracao com a API
```

Além do título, inclua sempre uma breve **descrição** e um **checklist** do que foi feito.

### Seções do corpo da PR

```markdown
## Tipo de modificações
## Descrição
## Screenshots ou Prints se tiver
## Links das tarefas
## Checklist
## Dependências usadas nessa etapa
```

- **Item 1 — Tipo de modificação:** bug fix, feature, chore ou uma release (quando a release sai de
  uma branch diferente da `main`).
- **Item 2 — Descrição:** com mais detalhes, principalmente se o recurso altera pontos fundamentais
  do sistema — pontos que precisaremos lembrar no futuro (não dá para confiar só na memória).
- **Item 3 — Screenshots/Prints:** se fizer sentido, capturas que explicam melhor o recurso.
- **Item 4 — Links das tarefas:** links para as tarefas na aplicação que gerencia as estórias.
- **Item 5 — Checklist básico para subir uma PR:**
  - [ ] menos de 400 linhas
  - [ ] revisão no próprio código antes de abrir a PR
  - [ ] todos os testes existentes passaram
  - [ ] comentários em lugares necessários foram escritos
  - [ ] criação de testes para o novo recurso
- **Item 6 — Dependências:** outras PRs dependentes (ex.: uma PR de API do backend que precisa ser
  entregue antes de subir uma tela no frontend).
