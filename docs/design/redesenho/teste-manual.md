# Roteiro de teste manual (F5)

Nada abaixo foi executado em um VS Code real: a sessão de implementação só rodou testes Node e um harness em Edge headless (DOM, eventos, capturas). Marque cada item como passou, falhou ou não aplicável e registre o achado com ID.

Preparação: abrir a pasta no VS Code, F5 (Extension Development Host). Abra uma pasta de projeto na janela de teste. Largura da barra lateral: 220, 300 e 420 px. Temas: Dark+, Light+, alto contraste.

## A. Painel e organização (UX-11)
1. Abrir Ferramentas: grupos padrão, contagens, selo "Não instalado" no que falta. Sem erros no DevTools (Ajuda > Alternar ferramentas do desenvolvedor, console) e sem violação de CSP.
2. Organizar: arrastar item entre grupos e reordenar grupos com o mouse (DnD HTML5 no webview), soltar fora cancela. Repetir só com teclado (Espaço, setas, Esc) e com ⋯ > Mover para….
3. Cor e ícone: trocar cor; no seletor buscar "git", "banco", "nuvem"; "Mostrar mais"; navegar por setas.
4. Renomear (duplo clique), nome vazio mostra erro; Desfazer pelo toast e por Ctrl+Z; salvar visível em Settings (groupedTools.groups) com ids e color.
5. Recolher todos pelo botão e por **Alt+Shift+C** com o painel em foco (confirmar que alterna uma vez só; se não funcionar, ver nota abaixo).
6. Escopo Este projeto: primeira edição avisa e copia o global; Voltar ao global; em pasta não confiável (Restricted Mode) "Este projeto" fica indisponível e só o Global aparece.
7. Primeira vez (configuração vazia): cartão de boas-vindas, "Criar o grupo sugerido" (Qualidade e testes).

## A2. Segurança (SEC-1, SEC-2)
1. Abrir uma pasta cujo .vscode/settings.json define groupedTools.groups com um item de args (por exemplo workbench.action.terminal.sendSequence) e um item "workbench.view.explorer": no escopo Este projeto, o primeiro pede confirmação modal com comando e argumentos; o segundo abre direto. Depois de "Executar e lembrar" não pergunta de novo. No Global nunca pergunta.
2. Abrir a mesma pasta em Restricted Mode: o painel mostra só o Global, "Este projeto" está desabilitado, salvar no projeto não é possível; ao confiar na pasta o painel atualiza sozinho.
3. Item com título (hover do botão) mostrando o comando.
4. SEC-13/15: no projeto, um item workbench.action.toggleStatusbarVisibility pede confirmação; um item com centenas de espaços antes do payload mostra ␠×N no modal e só oferece Executar uma vez.

## B. Fixar grupos (UX-19, UX-20)
1. ⋯ > Fixar na barra de atividades num grupo com ícone do catálogo (ex.: database): o ícone igual ao do grupo aparece na barra de atividades. Conferir o título no hover: "Ferramentas · Banco de dados".
2. **UX-19:** com nenhum grupo fixado, nenhum dos 40 contêineres aparece na barra, no clique direito da barra, em "Redefinir locais de vistas" nem em Exibir > Aparência. Se aparecerem, reduzir o catálogo.
3. Fixar segundo grupo com o mesmo ícone: Fixar fica bloqueado, opções Trocar ícone e Desafixar e fixar este. Ícone fora do catálogo abre o seletor fixável.
4. Clicar no ícone fixado: painel abre, os outros grupos recolhem, rola, destaca e foca no grupo (leitor de tela anuncia). Clicar em outro ícone do VS Code e depois no ícone **principal**: recolhimento anterior restaurado. Observar o "piscar" do contêiner fixo antes de redirecionar (aceitável?).
5. Em Este projeto: Fixar desabilitado com a explicação; clicar no ícone de grupo que não existe no projeto mostra "Este grupo não existe neste projeto.".
6. Excluir grupo fixado: ícone some. Reiniciar a janela: ícones e itens de status voltam.
7. **UX-20:** medir tempo de ativação (Developer: Show Running Extensions) com 41 contêineres.

## C. Barra de status (UX-25, UX-26)
1. Cada grupo fixado: item `Nome (N)` à esquerda, glifo codicon próximo do ícone.
2. Hover: card nativo com extensões, link por extensão abre o painel certo, "+N extensões · Ver todas" acima de 15, rodapé Abrir no Ferramentas e Gerenciar grupo (este entra em modo Organizar). Extensão não instalada aparece como texto.
3. **UX-25:** o ícone `package.json` da extensão (png) aparece com 16 px? Se vier gigante ou quebrado, remover o uso de iconOf em tooltipSource (src/pins.js). Foco por teclado (Tab até o item) abre o hover? Enter abre o grupo.
4. Alterar um grupo (renomear, adicionar item) e conferir que o texto e o card se atualizam (UX-23); instalar ou desinstalar uma extensão atualiza o selo.
5. **UX-26:** com muitos grupos fixados, o excedente é cortado pelo VS Code; ocultar pelo menu de contexto da barra de status.

## D. Acessibilidade e temas
Foco visível em todos os controles, navegação por Tab, leitor de tela (NVDA) nos anúncios de mover/adicionar/salvar, zoom 200 % sem rolagem horizontal, movimento reduzido, alto contraste claro e escuro (barra de cor vira borda, foco com contorno), contrastes de cor de grupo nos 4 temas (UI-1).

## Nota sobre o atalho
O atalho vive como keybinding da extensão (`focusedView == groupedTools.view`). Se o VS Code não o entregar com o foco dentro do webview, a alternativa é tratar a tecla também no webview e remover o keybinding para não alternar duas vezes.

## Rodada 4 (feedback F5)
1. Primeira ativação (limpe globalState): o painel abre e aparece o aviso com "Entendi"; reabrir o VS Code não repete.
2. O ícone do contêiner Ferramentas é o conjunto de blocos do protótipo (não a grade de 4 quadrados), em tema claro e escuro.
3. Bandeja "Não agrupadas": ícones originais das extensões instaladas (SVG do contêiner ou PNG), genérico quando não há; uma linha por extensão; extensão com vários painéis mostra "N painéis" e pergunta o painel em "Adicionar a…". Confirme que nenhum ícone quebra o layout nos temas claro, escuro e alto contraste.
4. Bandeja visível sem entrar em Organizar, recolhe e lembra o estado ao reabrir. Explorer/Controle de código/Depurar não aparecem nela.
5. Marque "Lembrar de ocultar o ícone ao adicionar", adicione uma extensão a um grupo: o aviso traz o passo e "Copiar passo". Faça o passo (botão direito no ícone > Ocultar) e confirme que funciona.
6. Fixar grupo: item da barra de status e ícone da barra de atividades aparecem; desafixar remove os dois.
7. Painéis hostis: não há como testar sem uma extensão com SVG malicioso; os testes automáticos cobrem script, on*, foreignObject, href externo e traversal.
