# Roteiro de teste manual (F5)

Nada abaixo foi executado em um VS Code real: a sessão de implementação só rodou testes Node e um harness em Edge headless (DOM, eventos, capturas). Marque cada item como passou, falhou ou não aplicável e registre o achado com ID.

Preparação: abrir a pasta no VS Code, F5 (Extension Development Host). Abra uma pasta de projeto na janela de teste. Largura da barra lateral: 220, 300 e 420 px. Temas: Dark+, Light+, alto contraste.

## A. Painel e organização (UX-11)
1. Abrir Ferramentas: grupos padrão, contagens, selo "Não instalado" no que falta. Sem erros no DevTools (Ajuda > Alternar ferramentas do desenvolvedor, console) e sem violação de CSP.
2. Organizar: arrastar item entre grupos e reordenar grupos com o mouse (DnD HTML5 no webview), soltar fora cancela. Repetir só com teclado (Espaço, setas, Esc) e com ⋯ > Mover para….
3. Cor e ícone: trocar cor; no seletor buscar "git", "banco", "nuvem"; "Mostrar mais"; navegar por setas.
4. Renomear (duplo clique), nome vazio mostra erro; Desfazer pelo toast e por Ctrl+Z; salvar visível em Settings (groupedTools.groups) com ids e color.
5. Recolher todos pelo botão e por **Alt+Shift+C** com o painel em foco (confirmar que alterna uma vez só; se não funcionar, ver nota abaixo).
6. Escopo Este projeto: primeira edição avisa e copia o global; Voltar ao global; com configuração por pasta, painel somente leitura.
7. Primeira vez (configuração vazia): cartão de boas-vindas, "Criar grupos sugeridos".

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
3. **UX-25:** o ícone `package.json` da extensão (png) aparece com 16 px? Se vier gigante ou quebrado, desligar `SHOW_EXTENSION_IMAGES` em src/pins.js. Foco por teclado (Tab até o item) abre o hover? Enter abre o grupo.
4. Alterar um grupo (renomear, adicionar item) e conferir que o texto e o card se atualizam (UX-23); instalar ou desinstalar uma extensão atualiza o selo.
5. **UX-26:** com muitos grupos fixados, o excedente é cortado pelo VS Code; ocultar pelo menu de contexto da barra de status.

## D. Acessibilidade e temas
Foco visível em todos os controles, navegação por Tab, leitor de tela (NVDA) nos anúncios de mover/adicionar/salvar, zoom 200 % sem rolagem horizontal, movimento reduzido, alto contraste claro e escuro (barra de cor vira borda, foco com contorno), contrastes de cor de grupo nos 4 temas (UI-1).

## Nota sobre o atalho
O atalho vive como keybinding da extensão (`focusedView == groupedTools.view`). Se o VS Code não o entregar com o foco dentro do webview, a alternativa é tratar a tecla também no webview e remover o keybinding para não alternar duas vezes.
