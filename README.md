# Ferramentas agrupadas — 0.0.4

Painel compacto de atalhos agrupados: busca, grupos recolhíveis com cor e ícone, favoritos, modo Organizar (arrastar, renomear, cor, ícone), grupos fixados na barra de atividades e na barra de status. Respeita as cores e fontes do tema (claro, escuro e alto contraste). Favoritos são salvos por workspace.

## Instalar permanentemente
1. Obtenha um arquivo .vsix da extensão (veja "Gerar o pacote" abaixo; ainda não há um comando de empacotamento aprovado neste repositório).
2. No VS Code, abra Extensões (Ctrl+Shift+X).
3. No menu de três pontos, escolha Instalar do VSIX.
4. Selecione o arquivo grouped-tools-<versão>.vsix.
5. Abra Ferramentas na barra lateral.

## Testar o código-fonte
1. Clone o repositório e abra a pasta grouped-tools no VS Code.
2. Pressione F5 e selecione Testar extensão, se necessário.
3. Na janela Extension Development Host, clique no ícone Ferramentas.
4. Se já estava executando uma versão antiga, encerre a sessão de depuração e inicie novamente.

Não requer npm install ou build: JavaScript puro, sem dependências. Os scripts de verificação (npm run check e npm test) exigem Node.js 21 ou superior (o check usa fs.readdirSync recursivo e o test usa um glob entre aspas, expandido pelo próprio Node).

## Gerar o pacote
O empacotamento usa o @vscode/vsce, ferramenta oficial da Microsoft. Ela ainda não está instalada nem aprovada neste projeto; a instalação segue a política de instalações (docs/operations/registro-instalacoes.md), e por isso não há script de empacotamento no package.json. Até lá, não é possível gerar o VSIX a partir deste repositório.

O arquivo .vscodeignore já define o conteúdo do pacote: package.json, README.md, src/** e media/** (incluindo lucide-LICENSE.txt). Ficam de fora a configuração de engenharia (.engineering, .claude, .codex, .agents), .vscode, docs, test, v1, scripts .ps1, arquivos .vsix e arquivos de ambiente.

## Fluxo de branches (gitflow)
- main: releases.
- develop: integração.
- feature/*: trabalho em andamento, criado a partir de develop e mesclado de volta nele.

## Posicionar como no mockup
O VS Code não permite que uma extensão contribua diretamente à barra lateral secundária por padrão. Mova o painel uma vez:

1. Abra Ferramentas.
2. No menu de contexto do título Ferramentas, escolha Mover Exibição e Barra Lateral Secundária (os nomes podem variar conforme o idioma/versão).
3. Também é possível arrastar a exibição para a barra lateral secundária.
4. Ajuste a largura para cerca de 300 px; a interface se adapta a outras larguras.
5. Para liberar espaço para código, use Exibir → Aparência → Barra Lateral Secundária para ocultar/reabrir a barra.

O posicionamento e os controles para recolher a barra são administrados pelo VS Code. Após mover, o acesso ao painel acompanha a localização escolhida; não há um ícone esquerdo espelhado nesta versão.

## Usar e organizar

- **Usar:** clique num item para abrir o painel da extensão; a estrela favorita; busca filtra grupos e itens; **Recolher todos** (Alt+Shift+C com o painel em foco) alterna entre recolher e expandir todos os grupos.
- **Organizar:** o botão abre o modo de edição sobre a mesma lista. Arraste itens e grupos pela alça, ou use Espaço (pegar), setas (mover; esquerda e direita trocam de grupo), Espaço (soltar) e Esc (cancelar); Alt+setas move um passo. O menu ⋯ oferece Mover para…, Renomear, Cor e ícone e Excluir. Duplo clique no nome renomeia o grupo.
- **Ícones:** o seletor busca entre todos os ícones Lucide (nome, tags, palavras em português como banco, nuvem, pasta) e mostra 60 por vez.
- **Não agrupadas:** extensões instaladas com painel que ainda não estão em nenhum grupo; arraste ou use Adicionar a…. Comandos livres entram por ⋯ > Adicionar item… > Comando do VS Code.
- **Salvar:** automático a cada gesto, com aviso Desfazer por 8 s (Ctrl+Z também). Erros mantêm o rascunho na tela, com Tentar de novo ou Descartar.
- **Escopo:** Global (padrão) vale para todos os projetos; Este projeto grava no workspace e prevalece; a primeira edição copia a global. Configuração por pasta deixa o painel somente leitura. Edições avançadas (argumentos de comando) ficam no Settings (groupedTools.groups).

## Grupos fixados

⋯ do grupo > **Fixar na barra de atividades** (só no escopo Global). O grupo ganha um ícone na barra de atividades com o **mesmo ícone do grupo** e um item na barra de status (`Nome (N)`, à esquerda) com um card nativo que lista as extensões e abre cada uma. Clicar em qualquer um abre o painel com os outros grupos recolhidos, rola até o grupo, destaca e foca; o ícone principal Ferramentas restaura o recolhimento anterior.

Limites da plataforma: o ícone da barra de atividades é um arquivo estático, por isso só ícones do catálogo curado (media/pin-catalog.js, 40 ícones) podem ser fixados, **um grupo por ícone**; o hover da barra de atividades mostra só o título "Ferramentas · <ícone>" (não o nome nem a cor do grupo); o excedente da barra de status é cortado pelo VS Code. Os contêineres, views e SVGs são gerados: `node scripts/build-pins.js` (`--check` verifica; o teste compara).

## O que é funcional
- Busca por ferramenta, grupo ou ID de comando.
- Grupos recolhíveis e contadores de resultados.
- Favoritos por workspace, com estrelas e filtro.
- Execução dos comandos configurados.
- Navegação por Tab/Enter, foco visível e estados vazios.

## Limites
Agrupa atalhos; não move as interfaces originais das extensões (os ícones originais podem ser ocultados pelo menu da Activity Bar). O contexto mostra o workspace real; não é seletor de perfis. Nada foi verificado dentro do VS Code real nesta etapa (veja docs/design/redesenho/teste-manual.md).

## Verificação
- npm run check: valida a sintaxe (node --check) de src/, media/*.js (exceto icons.js) e scripts/.
- npm test: node --test "test/*.test.js": config, comandos, provedor (mock do vscode), pins (catálogo, gerador, schema, tooltip) e modelo do painel.
- Teste manual no VS Code: docs/design/redesenho/teste-manual.md.

## Estrutura do código
- src/extension.js: ativação, comandos, contêineres fixos.
- src/tools-view.js: provedor do painel, mensagens, escopos, focusGroup.
- src/pins.js: context keys, itens da barra de status e tooltip Markdown; redirecionador das views fixas.
- src/config.js e src/commands.js: módulos puros.
- media/: view.html, view.css, view.js (interface), model.js (modelo puro), pin-catalog.js (catálogo único dos ícones fixáveis), icons.js (Lucide, gerado), pin/*.svg (gerados).
- scripts/: build-icons.js e build-pins.js.
- test/: testes node --test. docs/design/redesenho/: ux, ui, plano, protótipo e teste manual.
- v1/: versão anterior, só referência.

## Grupos padrão

Os padrões agrupam por tema os painéis que normalmente ocupam a Activity Bar. Cada atalho abre o painel original (workbench.view.extension.<id do contêiner>) e só funciona se a extensão estiver instalada.

| Grupo | Atalhos |
| --- | --- |
| Claude e IA | Claude Code (sidebar e sessões), Claude Code Chat, Claude Control, Claude Lens, Claude Code Graph, Codex, CodeCursor, Tabnine |
| Git e GitHub | Controle de código-fonte, GitLens, Pull requests e issues, GitHub Actions, Git Graph |
| Bancos de dados | Database Client, PostgreSQL, Prisma |
| Containers e remoto | Docker, Explorador remoto, terminal, tarefas |
| Diagramas e planejamento | Diagram Forge, Archify, Kanban Markdown |
| Linguagens e notebooks | Python, Jupyter, PowerShell, Makefile, corretor ortográfico |
| Qualidade e testes | Problemas, Testes |
| Variados | Spotify, ClickUp |

## Grupo Variados

Ícone plus e atalhos Spotify e ClickUp. Os atalhos abrem os painéis originais das extensões shyykoserhiy.vscode-spotify e mcdev.clickup-kanban, que precisam estar instaladas. Não há substituição de grupos neste workspace por padrão. Configurações personalizadas em outros workspaces prevalecem sobre os padrões.

Ícones de grupos e itens também aceitam plus, music e kanban.
