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
- **Não agrupadas:** sempre visível abaixo dos grupos (recolhível; o estado é lembrado). Uma linha por extensão; se ela tem vários painéis, aparece "N painéis" e "Adicionar a…" pergunta qual. Ícones são os originais das extensões (ícone do contêiner na Activity Bar ou o ícone PNG da extensão), lidos e sanitizados pela extensão; o genérico aparece quando não há como mostrar o original com segurança. Comandos livres entram por ⋯ > Adicionar item… > Comando do VS Code.
- **Lembrar de ocultar o ícone ao adicionar:** o VS Code não oferece como uma extensão ocultar o ícone de outra na barra de atividades. Com a opção marcada, ao adicionar uma extensão o painel mostra o passo ("clique com o botão direito no ícone e escolha Ocultar") e o botão "Copiar passo".
- **Onde fica o ícone Ferramentas:** o VS Code coloca novos ícones no fim da barra de atividades e a extensão não controla a posição. Na primeira ativação o painel abre sozinho e avisa; arraste o ícone para onde quiser.
- **Salvar:** automático a cada gesto, com aviso Desfazer por 8 s (Ctrl+Z também). Erros mantêm o rascunho na tela, com Tentar de novo ou Descartar.
- **Escopo:** Global (padrão) vale para todos os projetos; Este projeto grava no workspace e prevalece; a primeira edição copia a global. Em pasta não confiável (Workspace Trust) só vale o Global e "Este projeto" fica indisponível. Edições avançadas (argumentos de comando) ficam no Settings (groupedTools.groups).

## Segurança

- **Itens do projeto:** a configuração do projeto (.vscode/settings.json) pode vir de um repositório de terceiros. No escopo "Este projeto", um item com argumentos, ou com comando fora de workbench.view.* e de uma lista curta de ações inofensivas (SAFE_ACTIONS em src/tools-view.js), pede confirmação modal com o comando e os argumentos completos (caracteres ocultos aparecem como XXXX). Argumentos longos (acima de 1500 caracteres) só podem ser executados uma vez; nos demais há "Executar e lembrar" (guardado como SHA-256 no workspaceState). Itens do Global não pedem. O comando do item aparece no title do botão.
- **Limitação do Global:** itens do escopo Global (e os grupos fixados) executam qualquer comando sem confirmação, inclusive runCommands, porque essa configuração é do próprio usuário. Não cole configuração de terceiros no Global sem ler. Ações que gravam em settings.json (como alternar a barra de status ou a de atividades) não fazem parte da lista de ações sem confirmação no projeto.
- **Aprovações antigas:** aprovações gravadas em texto puro por versões anteriores deixam de valer; o modal pede confirmação mais uma vez e passa a guardar só o hash. Na ativação, favoritos antigos viram hash quando o item ainda existe, e o armazenamento é limitado (500 favoritos, 200 aprovações). Espaços repetidos nos argumentos aparecem como ␠×N no modal.
- **Pasta não confiável:** a extensão declara suporte limitado (untrustedWorkspaces, restrictedConfigurations groupedTools.groups) e lê/grava só o valor Global enquanto a pasta não for confiável.
- **Comandos bloqueados como item:** groupedTools.run, runById, openGroup e manageGroup. O comando groupedTools.run não existe mais.
- **Limites da configuração:** até 100 grupos, nomes de até 100 caracteres, comando de até 200; caracteres de controle e bidi são removidos dos nomes. Erros de salvamento dizem qual grupo ou item corrigir.
- **Ids:** o id de um grupo sem `id` na configuração é derivado do nome (grp-<hash do nome>); renomear um grupo escrito à mão (sem id) muda o id até o painel gravá-lo. O id de item deriva de comando, nome e argumentos.
- **Ícones:** media/icons.js e media/pin/*.svg só podem conter tags e atributos da lista em scripts/svg-allowlist.js; o gerador e um teste falham se aparecer outra coisa.
- **Contraste:** `node scripts/contrast.js` mede a paleta (barra 3:1, texto 4.5:1) em Light+ e Dark+.

## Grupos fixados

⋯ do grupo > **Fixar na barra de atividades e na barra de status** (só no escopo Global). O grupo ganha um ícone na barra de atividades com o **mesmo ícone do grupo** e um item na barra de status (`Nome (N)`, à esquerda) com um card nativo que lista as extensões e abre cada uma. Clicar em qualquer um abre o painel com os outros grupos recolhidos, rola até o grupo, destaca e foca; o ícone principal Ferramentas restaura o recolhimento anterior.

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

O único grupo padrão é **Qualidade e testes** (cor Verde, classe g-7 da paleta g-1..g-10) com Problemas e Testes. Os demais grupos você cria no painel (ou em groupedTools.groups). O cartão de primeira vez oferece "Criar o grupo sugerido" (esse mesmo grupo) ou "Começar do zero". Os atalhos de extensões abrem o painel original (workbench.view.extension.<id do contêiner>) e só funcionam com a extensão instalada.

Ícones de grupos e itens aceitam qualquer nome do Lucide (ex.: plus, music, kanban).
