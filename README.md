# Ferramentas agrupadas — 0.0.4

Painel inspirado no mockup: busca fixa, contexto do projeto, abas Todas/Favoritos, grupos recolhíveis com contadores, linhas compactas com ícones e botão Personalizar grupos no rodapé. Respeita as cores e fontes do tema ativo. Rolagem fica dentro da lista, sem esconder busca ou rodapé. Favoritos são salvos por workspace; pesquisa, aba e grupos recolhidos são mantidos ao reabrir o painel.

## Instalar permanentemente
1. Extraia o ZIP.
2. No VS Code, abra Extensões (Ctrl+Shift+X).
3. No menu de três pontos, escolha Instalar do VSIX.
4. Selecione grouped-tools-0.0.4.vsix, incluído na raiz do ZIP.
5. Abra Ferramentas na barra lateral.

## Testar o código-fonte
1. Extraia o ZIP e abra a pasta grouped-tools no VS Code.
2. Pressione F5 e selecione Testar extensão, se necessário.
3. Na janela Extension Development Host, clique no ícone Ferramentas.
4. Se já estava executando a versão antiga, encerre a sessão de depuração e inicie novamente.

Não requer npm install ou build.

## Posicionar como no mockup
O VS Code não permite que uma extensão contribua diretamente à barra lateral secundária por padrão. Mova o painel uma vez:

1. Abra Ferramentas.
2. No menu de contexto do título Ferramentas, escolha Mover Exibição e Barra Lateral Secundária (os nomes podem variar conforme o idioma/versão).
3. Também é possível arrastar a exibição para a barra lateral secundária.
4. Ajuste a largura para cerca de 300 px; a interface se adapta a outras larguras.
5. Para liberar espaço para código, use Exibir → Aparência → Barra Lateral Secundária para ocultar/reabrir a barra.

O posicionamento e os controles para recolher a barra são administrados pelo VS Code. Após mover, o acesso ao painel acompanha a localização escolhida; não há um ícone esquerdo espelhado nesta versão.

## Configurar grupos

Personalizar grupos aparece aberto dentro do painel. Escolha Novo grupo ou um grupo existente, informe nome e ícone, adicione extensões instaladas ou comandos e clique em Salvar grupo. É possível editar nomes/comandos, remover ferramentas e excluir grupos. Argumentos e ícones já configurados de ferramentas são preservados; edições avançadas ficam disponíveis em Abrir Settings.

Salvar em começa em Global: a alteração é salva nas configurações do usuário e vale para todos os projetos. Escolha Este projeto para salvar no workspace atual (.vscode/settings.json ou arquivo .code-workspace). Uma configuração do projeto prevalece sobre a global. Use Usar configuração global neste projeto para remover essa substituição. Sem projeto aberto, essa opção fica desabilitada. Configurações legadas por pasta podem ser removidas no Settings.

Grupos vazios podem ser preparados no formulário e aparecem na lista de ferramentas após receberem itens. O seletor de extensões lista os painéis declarados pelas extensões instaladas; extensões sem painéis podem ser adicionadas por seus comandos. Os atalhos abrem os painéis originais, sem mover suas interfaces.

Os ícones são um subconjunto local do Lucide (licença ISC, em media/lucide-LICENSE.txt), sem CDN. Opções: plus, music, kanban, terminal, cloud, play, warning, beaker, code, database, sparkle, extensions, settings, star e search. Os controles nativos do VS Code usam Codicons.

## O que é funcional
- Busca por ferramenta, grupo ou ID de comando.
- Grupos recolhíveis e contadores de resultados.
- Favoritos por workspace, com estrelas e filtro.
- Execução dos comandos configurados.
- Navegação por Tab/Enter, foco visível e estados vazios.

## Limites
Agrupa atalhos; não reúne automaticamente todas as extensões, nem move suas interfaces originais. Os ícones originais podem ser ocultados manualmente pelo menu da Activity Bar. O contexto mostra o workspace real; não é um seletor de perfis. A reordenação é feita no JSON. Não inclui arrastar e soltar ou instalação automática de extensões.

## Verificação
Sintaxe de extension.js e media/view.js validada com node --check. Testes de integração do provedor e mensagens podem rodar com node --test test/provider.test.js. Teste visual no VS Code: buscar, favoritar, filtrar, recolher grupos, executar um comando, alternar tema, mover para a direita e fechar/reabrir.

API oficial: https://code.visualstudio.com/api/references/vscode-api
Posicionamento: https://code.visualstudio.com/api/ux-guidelines/sidebars

## Grupo Variados

Incluído por padrão com ícone plus e atalhos Spotify e ClickUp. Os atalhos abrem os painéis originais das extensões shyykoserhiy.vscode-spotify e mcdev.clickup-kanban, que precisam estar instaladas. Não há substituição de grupos neste workspace por padrão. Configurações personalizadas em outros workspaces prevalecem sobre os padrões.

Ícones de grupos e itens também aceitam plus, music e kanban.
