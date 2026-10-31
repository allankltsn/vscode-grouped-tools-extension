# Redesenho do painel "Ferramentas agrupadas" - especificação de UX

Autor: ux-designer. Status: pronto para validação (não aprovado). Base: `media/view.*`, `src/tools-view.js`, `src/config.js`, README. Glossário fixo: **grupo**, **item** (atalho dentro do grupo), **extensão** (instalada com painel), **bandeja** (lista "Não agrupadas"), **escopo** (Global ou Este projeto).

## 1. Objetivos e princípios
Objetivo: abrir o painel e chegar à ferramenta em um clique; organizar sem sair da lista.
1. **A lista é o editor.** Nada de formulário aberto. Editar é um modo ("Organizar") sobre a mesma lista.
2. **Uso primeiro, organização sob demanda.** Modo Usar (padrão): clicar executa. Modo Organizar: arrastar, renomear, cor, ícone.
3. **Todo arrastar tem equivalente por teclado e por menu**, com anúncio por aria-live.
4. **Cor e ícone nunca são o único sinal** (estado "quebrado", favorito e destino de soltar também têm texto/forma).
5. **Salvar é automático e reversível** (Desfazer por 8 s), escopo discreto.
6. Leve: densidade compacta, sem bordas pesadas, variáveis de tema do VS Code, claro/escuro/alto contraste.

Hipóteses: arrastar HTML5 (dragstart/dragover/drop) funciona no webview do VS Code; paleta de 8 cores + "sem cor"; gravar em `groupedTools.groups` continua sendo o armazenamento. Sem evidência de usabilidade ainda (ver UX-12).

## 2. Mapa de regiões (largura 220-420 px, coluna única)
```
+------------------------------------+
| [Buscar ferramenta…        ] [Org.]|  A. Barra: busca + botão Organizar (aria-pressed)
| (Todas) (Favoritos)   Global ▾    |  B. Filtro + chip de escopo (discreto)
+------------------------------------+
| aviso: 2 itens quebrados  [Ver]    |  C. Faixa de alertas (só se houver)
| v ● Git                 5  [⋯]    |  D. Grupos (cor = barra lateral 3px + ícone)
|     [ic] Git Graph      ☆         |     itens: ícone, nome, estrela
|     [ic] GitLens ⚠ não instalada  |
| > ● Bancos de dados     3         |
| + Novo grupo (solte aqui)          |  E. Alvo "soltar para criar grupo" (só Organizar)
| v Não agrupadas         4          |  F. Bandeja (só Organizar; ou sempre se 1ª vez)
|     [ic] Docker  [+ Adicionar ▸]   |
+------------------------------------+
| 12 itens · 4 grupos · 4 não agrup. |  G. Rodapé-resumo (+ status de salvar)
+------------------------------------+
| (região aria-live; invisível)      |  H. Anúncios
```
Larguras: a 220 px o botão Organizar vira só ícone (com rótulo acessível), chip de escopo vira ícone+tooltip, contagem permanece; nomes truncam com reticências e `title`. Acima de 340 px mostram-se rótulos completos. Zoom 200% = reflow em coluna única, sem rolagem horizontal.

## 3. Regiões em detalhe
**A. Busca/Organizar.** Busca filtra grupos e itens (nome, comando, grupo); não filtra a bandeja em modo Usar. Botão "Organizar" alterna o modo; em modo Organizar mostra "Concluir". Esc na busca limpa.
**B. Filtro e escopo.** Segmentado Todas/Favoritos (aria-pressed). Chip "Global" ou "Este projeto" abre menu de 2 opções com descrição curta (ver 5.7). Se não há projeto aberto, "Este projeto" fica desabilitado com motivo.
**C. Alertas.** Uma linha por tipo: "N itens quebrados" (abre filtro de quebrados), "N extensões fora de grupos" (rola até a bandeja). Dispensáveis por sessão. Nunca bloqueiam.
**D. Grupo.** Cabeçalho: botão de recolher (chevron, aria-expanded), barra de cor, ícone do grupo, nome, contagem, menu "⋯" (sempre visível ao focar/passar o mouse; em modo Organizar sempre visível) com: Renomear, Cor e ícone, Mover para cima/baixo, Adicionar item, Excluir grupo. Em modo Organizar surge a alça de arrastar (⠿) no início do cabeçalho e dos itens.
**Item.** Clique (modo Usar) executa; estrela alterna favorito; menu "⋯" (modo Organizar): Mover para…, Trocar ícone, Renomear, Remover do grupo (volta à bandeja se for extensão). Item quebrado: ícone com marca, texto "não instalada", clique abre diálogo curto: "Esta extensão não está instalada. [Ver no Marketplace] [Remover do grupo]" (Marketplace só se `extensionId` conhecido).
**E. Novo grupo.** Linha tracejada "+ Novo grupo": clicar cria grupo "Novo grupo" em edição inline do nome; soltar uma extensão/item aqui cria o grupo já com ele.
**F. Bandeja "Não agrupadas".** Extensões instaladas com painel e sem item em nenhum grupo (do escopo atual). Cada linha: ícone, nome, botão "Adicionar a…" (menu de grupos + "Novo grupo"). Busca interna ao ter mais de 8. Ao arrastar para um grupo, o item é criado; o comando é `workbench.view.extension.<container>`.
**G. Rodapé.** "12 itens · 4 grupos · 4 não agrupadas". Também exibe estados Salvando…/Salvo/Erro (7.6-7.7) e botão "Desfazer".

## 4. Cor, ícone e seletor
- **Cor do grupo:** 8 amostras nomeadas (Cinza, Vermelho, Laranja, Amarelo, Verde, Azul, Roxo, Rosa) + "Sem cor" (padrão). Cada amostra é botão radio com nome acessível e marca de seleção (✓). Cores mapeadas a tokens de tema (ui-designer define; contraste mínimo 3:1 contra o fundo para a barra e o ícone). Cor é decorativa: nome do grupo sempre presente.
- **Seletor de ícone** (grupo e item): popover (diálogo não modal) com campo de busca no topo (busca por nome e `window.toolIconTags`, sem acento, pt-BR e en), grade de ~6 colunas rolável com **virtualização/paginação** (renderizar ~60 por vez; "Mostrar mais") por haver ~2000 ícones; seção "Recentes" (até 12) e "Sugeridos" para o item (ícone atual). Cada célula: botão 32x32 com `aria-label` = nome do ícone; navegação por setas em grade (roving tabindex); Enter escolhe e fecha; Esc cancela e devolve o foco ao gatilho. Sem resultado: "Nenhum ícone para '…'. Tente em inglês, ex.: git." Prévia do ícone atual com o nome.
- Ícone padrão: grupo "extensions" (como hoje); item de extensão "extensions".

## 5. Fluxos
**5.1 Arrastar item (reordenar/mover entre grupos).** Entrar em Organizar → pressionar alça de item → arrastar. Indicador de inserção (linha de 2 px + texto no destino ao focar) entre itens; cabeçalho de grupo recolhido abre após 600 ms sobre ele. Soltar: item vai à posição, salva automaticamente, anuncia "Git Graph movido para Git, posição 2 de 5". Soltar fora de alvo ou Esc: cancela, item volta ("Movimento cancelado"). Mover para outro escopo não existe.
**5.2 Arrastar extensão da bandeja.** Igual a 5.1, origem bandeja; destino grupo (posição) ou alvo E. A linha some da bandeja ao criar o item; anuncia "Docker adicionado a Contêineres".
**5.3 Reordenar grupos.** Alça no cabeçalho; ao iniciar, todos os grupos recolhem visualmente (altura de cabeçalho) para facilitar; indicador entre grupos; ao soltar restauram. Anúncio "Grupo Git movido para posição 2 de 4".
**5.4 Mover por teclado (alternativa a todo arrastar).** Três caminhos, equivalentes:
 a) Menu "⋯" do item → "Mover para…" → lista de grupos (+ "Novo grupo") → posição "No início/No fim" (padrão: no fim).
 b) Foco na alça ou no item em Organizar: **Espaço** "pega" (anuncia "Git Graph pego. Use setas para cima/baixo para mover, setas para a direita/esquerda trocam de grupo, Espaço solta, Esc cancela"); setas movem a posição, **Alt+Seta** é sinônimo para quem não usa Espaço; Espaço solta e salva; Esc devolve.
 c) Bandeja: botão "Adicionar a…" por linha.
 Grupos: o mesmo em cabeçalho (Alt+Seta cima/baixo ou menu "Mover para cima/baixo"). Cada passo anuncia a nova posição ("posição 3 de 5 em Git"). Arrastar com ponteiro nunca é o único meio (WCAG 2.5.7).
**5.5 Editar grupo inline.** "⋯" → Renomear: o nome vira campo no lugar (Enter confirma, Esc cancela, foco volta ao cabeçalho). Vazio ou só espaços: borda de erro + texto "Dê um nome ao grupo", não salva. Máx. 100 caracteres, contador só nos últimos 20. "Cor e ícone" abre popover único com amostras e botão "Ícone: git ▸" que abre o seletor. Mudança de cor aplica e salva ao escolher.
**5.6 Excluir grupo/remover item.** Remover item: sem confirmação, com Desfazer. Excluir grupo com itens: confirmação inline no cabeçalho: "Excluir 'Git' e seus 5 itens? Extensões voltam à bandeja. [Excluir] [Cancelar]" (foco em Cancelar). Grupo vazio exclui direto com Desfazer.
**5.7 Escolher escopo e salvar.** Padrão Global. Chip abre: "Global - vale para todos os projetos" / "Este projeto - só neste projeto; prevalece sobre o global". Trocar de escopo recarrega a lista do escopo (nunca mistura). Se "Este projeto" não tem config própria, a 1ª edição copia a global e avisa uma vez: "Este projeto agora tem organização própria." com ação "Voltar ao global" (equivale a resetGroups, com confirmação que informa que a organização do projeto será descartada). Pasta não confiável (Workspace Trust): só o Global vale e "Este projeto" fica desabilitado com a explicação. (Revisão: o modo somente leitura por pasta foi removido; `groupedTools.groups` tem escopo `window`, então o VS Code não guarda valor por pasta.)
**5.8 Salvar.** Cada gesto confirmado gera um save único com a lista completa (debounce 400 ms para sequências rápidas). Enquanto salva, interação segue permitida mas novo save aguarda o anterior.

## 6. Estados (por região)
| Estado | Comportamento |
|---|---|
| Primeira vez (sem grupos, sem config do usuário) | Cartão de boas-vindas: "Organize suas extensões em grupos." + botões "Criar grupos sugeridos" (usa os padrões por tema atuais, escopo Global) e "Começar do zero"; abaixo, bandeja com extensões detectadas. Dica de 3 linhas: "Arraste para agrupar. Ou use ⋯ > Mover para…". Dispensável, não reaparece (estado do webview). |
| Vazio (grupos existem, sem itens) | Grupo mostra "Vazio. Arraste uma extensão aqui ou use Adicionar item." Todos vazios: mesma dica da primeira vez sem o botão de sugeridos. |
| Sem extensões detectadas | Bandeja: "Nenhuma extensão com painel encontrada." |
| Bandeja vazia | "Tudo agrupado." (com ✓), recolhida por padrão. |
| Buscando | Grupos sem resultado somem; os com resultado expandem; termo destacado; contagem do grupo mostra "2 de 5"; anúncio "N resultados". Organizar fica desabilitado enquanto há busca (evita reordenar lista filtrada) com `title` explicando. |
| Nenhum resultado | "Nada para '…'. [Limpar busca]" + se aplicável "Procurar também nas não agrupadas". |
| Favoritos sem itens | "Toque na estrela de um item para fixá-lo aqui." |
| Item quebrado | Ícone com marca de alerta + texto "não instalada" (não só cor); permanece no grupo, não é executado; menu: Remover do grupo. Comandos livres (não de extensão) nunca são marcados quebrados, salvo comando inexistente confirmado (UX-6). |
| Arrastando | Item origem a 50% de opacidade + rótulo "arrastando"; destinos válidos com contorno e texto; alvo inválido com cursor `not-allowed`. Com `prefers-reduced-motion`: sem animação de abertura/deslocamento. |
| Carregando (aguardando `data`) | Esqueleto de 3 grupos (sem animação em reduced-motion), `aria-busy`. Mais de 3 s: "Carregando extensões…" |
| Salvando | Rodapé "Salvando…"; itens permanecem interativos. |
| Salvo | Rodapé "Salvo" por 3 s + Desfazer por 8 s; anúncio polite. |
| Erro ao salvar | As alterações permanecem na tela como rascunho marcado (não revertem sozinhas); faixa de erro (role=alert): "Não foi possível salvar: <motivo>. [Tentar de novo] [Descartar alterações]". |
| Sem permissão/escopo | "Este projeto" desabilitado sem pasta aberta, motivo no tooltip e em texto sob o menu. |
| Lento/desconectado | Extensão ausente de resposta >5 s após `ready`: "O painel não recebeu os dados. [Recarregar]". |

## 7. Microcopy (pt-BR, voz simples)
Organizar / Concluir; Novo grupo; Não agrupadas; Adicionar a…; Mover para…; Cor e ícone; Desfazer; Salvo; Tentar de novo; "não instalada". Mensagens no padrão "o que houve + o que fazer". Sem urgência artificial nem culpa. Termo único: "item" na UI técnica, "ferramenta" só no nome da extensão e busca (UX-9 para decisão final).

## 8. Acessibilidade (WCAG 2.2 AA)
- **Estrutura:** painel = `main`; cada grupo = `section` com `h2`/botão de cabeçalho (aria-expanded, aria-controls); itens em `ul/li`; bandeja idem. Menu "⋯" com `aria-haspopup="menu"`, `role=menu/menuitem`, setas, Esc fecha e devolve o foco.
- **Foco:** anel visível 2 px (`--vscode-focusBorder`), nunca removido; contraste de foco >= 3:1. Ordem: busca, Organizar, filtros, escopo, alertas, grupos (cabeçalho, itens), novo grupo, bandeja, rodapé. Após mover/excluir/renomear, o foco fica no elemento movido ou no vizinho mais próximo; nunca se perde no `body` (a render atual preserva por `data-focus-id`; manter).
- **Alvos:** mínimo 24x24 px (2.5.8), recomendado 28 px de linha com 4 px de espaço; alças e "⋯" com 24x24 e área de clique ampliada.
- **Arrastar (2.5.7):** alternativas em 5.4; toda função de arrastar com menu ou teclado em <= 3 ações.
- **aria-live:** região `polite` única para movimentos, adições, contagens de busca e salvar; `role=alert` só para erro de salvar. Texto sempre completo (item, origem, destino, posição). Não anunciar a cada dragover; só ao entrar em novo destino com teclado e ao soltar.
- **Pegar/soltar:** a alça tem `aria-roledescription="item reordenável"` e `aria-describedby` com as instruções; estado "pego" via `aria-pressed`/texto no live.
- **Cor/contraste:** texto >= 4.5:1, ícones e barra >= 3:1, tema claro/escuro/alto contraste (em alto contraste, barra de cor vira borda sólida de tema e o ícone/texto transmitem o estado). Cores nunca são únicas (nome do grupo, ✓ nas amostras, texto "não instalada", "★" com rótulo).
- **Movimento:** respeitar `prefers-reduced-motion`; sem piscar. **Zoom 200% / 220 px:** reflow, truncamento com `title`, sem sobreposição.
- **Erro:** associado ao campo (`aria-invalid`, `aria-describedby`), mensagem em texto, não só borda vermelha.
- **Seletor de ícone:** `role=dialog` rotulado, foco no campo de busca ao abrir, retorno ao gatilho; células com nome acessível; resultados anunciados ("24 ícones").
- **Autenticação/entrada redundante:** não aplicável; rascunho de nome preservado ao fechar popover por engano (não há campos sensíveis).

## 9. Contrato de dados mínimo (UI <-> extensão)
**Mensagem `data` (extensão -> webview), campos novos em negrito.**
- `groups[]`: `id`, `name`, `icon`, **`color`** (`null` ou um de `gray|red|orange|yellow|green|blue|purple|pink`), `items[]`.
- `items[]`: `id`, `name`, `command`, `icon`, `favorite`, **`kind`** (`extension` | `command`), **`extensionId`** (se `kind=extension`), **`installed`** (`true/false/null`; `null` = não verificável), **`collapsed`** não é dado: fica no estado do webview.
- **`unassigned[]`**: extensões com painel não presentes em nenhum item do escopo ativo: `{extensionId, name, command, icon, views}`. Cálculo na extensão (fonte única; hoje o webview recebe `extensions` completo).
- `extensions[]` completo continua disponível para o menu "Adicionar a…" e para resolver ícone/`extensionId`.
- **`scope`**: `{ active: 'global'|'workspace', hasWorkspace, trusted, projectOverride }`; `groups` já refletem o escopo ativo. (`folderOverride` e `readOnly` foram removidos na revisão: o setting é `window`.)
- **`stats`** (opcional): `{items, groups, unassigned, broken}`; a UI pode calcular, mas `broken` depende de `installed`.
- **`reason`** no `saved`/`saveError`: `{type, text, op}` para a UI saber qual operação reverter/repetir.
**Mensagens do webview.**
- `saveGroups {scope, groups, op}`: lista completa com ids estáveis (UX-3). `op` = texto curto para anúncio/Desfazer.
- `undo` (reaplica snapshot anterior mantido na extensão ou no webview), `resetGroups {scope}`, `openMarketplace {extensionId}`, `run`, `favorite`, `configure`.
**Persistência `groupedTools.groups` (schema):** acrescentar `color` (enum) a grupo; item de extensão ganha `extensionId` opcional (necessário para detectar quebrado e não agrupadas sem inferir pelo `command`). `validateGroups` precisa aceitar/validar `color` e `extensionId` e **hoje descarta qualquer campo não listado**; o schema de `package.json` também. Estado só da UI (webview `setState`): modo, busca, recolhidos, dica dispensada, ícones recentes.
**Estados derivados:** `installed` recalculado em `vscode.extensions.onDidChange`; `unassigned` idem; refresh por mudança de configuração (existente).

## 10. Critérios de aceitação (resumo testável)
1. Mover item entre grupos e reordenar grupos funciona por ponteiro, por Espaço+setas e por menu, com o mesmo resultado persistido.
2. Cada movimento e adição produz um anúncio com item, destino e posição.
3. Seletor de ícone alcança qualquer um dos ~2000 ícones por busca em <= 2 s de digitação, sem renderizar todos de uma vez.
4. Item quebrado distinguível sem cor; não executa; removível.
5. Erro ao salvar mantém o rascunho e oferece repetir/descartar.
6. Nenhum controle < 24 px; 220 px e 200% de zoom sem rolagem horizontal; temas claro, escuro e alto contraste.
7. Primeira vez mostra dica e sugeridos; depois de dispensada não volta.

## 11. Achados e dúvidas em aberto
- **UX-1** Decidir a UI de "Organizar" como modo (proposta) versus alças sempre visíveis. Risco: o modo adiciona um clique; alças sempre visíveis poluem em 220 px. Dono: Allan/ui-designer.
- **UX-2** Salvamento automático por gesto (proposto) altera o fluxo atual "Salvar grupo". Confirmar com Allan; alternativa: botão "Salvar" com rascunho global.
- **UX-3** Ids de grupo/item hoje são posicionais (`g0`, `0:1`); reordenar quebra favoritos? Favoritos usam `favoriteKey` (comando+nome+args), então sobrevivem, mas o foco e o `collapsed` do webview usam id posicional. Pedir ids estáveis (ou chave de grupo derivada) à extensão.
- **UX-4** `validateGroups` descarta campos desconhecidos (`color`, `extensionId`): bloqueia o contrato (seção 9). Dono: frontend-senior.
- **UX-5** Desfazer: onde guardar o snapshot (webview perde ao recarregar; extensão pode manter em memória). Decidir.
- **UX-6** "Quebrado" só é confiável para itens de extensão (`workbench.view.extension.*`); verificar comandos livres com `commands.getCommands()` é possível mas custoso. Escopo a decidir.
- **UX-7** Escopo "Este projeto" copia a global na 1ª edição; confirmar que é aceitável para o usuário (efeito: deixa de seguir mudanças globais).
- **UX-8** Favoritos são por workspace (`workspaceState`), não por escopo de config; deixar claro na UI ("Favoritos deste projeto").
- **UX-9** Termos: README e UI usam "ferramenta" e "extensão"; propor "item" e "extensão". Consultar brand-strategist.
- **UX-10** Paleta e tokens de cor por tema (incluindo alto contraste) e o ícone de "quebrado": ui-designer. Novos componentes (menu, popover, seletor de ícone, toast) exigem pedido via principal ao ui-designer/frontend-senior.
- **UX-11** Compatibilidade do drag-and-drop HTML5 no webview e touchpad/telas de toque; teste técnico (spike) antes de implementar. Se falhar, ponteiro com eventos `pointer*`, mantendo o resto.
- **UX-12** Evidência de usabilidade ausente: rodada `/usability` com dois lay-users e QA de acessibilidade (leitor de tela NVDA) sobre o protótipo; sem dados de uso reais hoje.
- **UX-13** Privacidade: sem dado pessoal; nomes de extensões ficam locais. Nenhuma consulta a privacy-compliance necessária, salvo se houver telemetria (não proposta).
- **UX-14** `listViewExtensions` usa só `contributes.views`; extensões sem painel (ex.: só comandos) não aparecem na bandeja. Aceitável? Ampliar exigiria outra regra.

## 12. Recolher/expandir todos e fixar grupo na barra de atividades
Autor: ux-designer/ui-designer (extensão do protótipo em `docs/design/redesenho/prototipo/`). Status: para validação (não aprovado). Variante escolhida pelo usuário: **um contêiner fixo por ícone de um catálogo curado** (revisão: substitui os 5 slots numerados; PV-15 e PV-19 decididos).

### 12.1 Recolher/expandir todos (região A)
- Botão único na barra do topo, ao lado de "Organizar". Estado "algum grupo aberto" mostra ícone `chevrons-down-up`, rótulo "Recolher todos"; estado "todos recolhidos" mostra `chevrons-up-down`, "Expandir todos". Rótulo visível só a partir de 341 px; abaixo disso só ícone com `aria-label` e `title` (inclui o atalho).
- Atalho opcional **Alt+Shift+C** (a confirmar contra atalhos do VS Code; deve ser um `keybinding` da extensão, não só do webview).
- Anuncia em aria-live: "Todos os grupos recolhidos." / "Todos os grupos expandidos." Desabilitado sem grupos ou durante busca (a busca já expande o que casa). O estado de recolhimento é só da UI (não é salvo na configuração e não gera Desfazer).

### 12.2 Fixar grupo (menu ⋯ do grupo)
**Regra central:** o item fixado na Activity Bar usa o **mesmo ícone do grupo**. Como o ícone de um contêiner é um arquivo estático do `package.json`, a extensão declara **um contêiner por ícone do catálogo de "ícones fixáveis"** (~40 Lucide; o protótipo usa `PIN_NAME` em `prototipo.js`). O limite deixa de ser "5 slots" e passa a ser **um grupo fixado por ícone**.

Fluxo: ⋯ do grupo > "Fixar na barra de atividades" / "Desafixar da barra de atividades". Toast com Desfazer e anúncio em aria-live em cada caso.
- **Ícone do grupo está no catálogo e livre:** fixa direto; o ícone aparece na barra.
- **Ícone fora do catálogo:** o item abre o seletor "Escolha um ícone fixável" (grade só com o catálogo; ícones já usados por outro grupo fixado ficam indisponíveis, com cadeado e dica "Em uso por “X” (fixado)"). A escolha também passa a ser o ícone do grupo, em **uma operação só** com Desfazer.
- **Conflito (outro grupo fixado usa o mesmo ícone):** "Fixar" fica desabilitado com a explicação "O ícone “…” já é usado por “X” (fixado)", e o menu oferece "Trocar o ícone deste grupo…" (abre o seletor fixável) ou "Desafixar “X” e fixar este" (uma operação).
- **Trocar o ícone de um grupo já fixado** (menu "Cor e ícone"): o seletor bloqueia ícones fora do catálogo ou em conflito (cadeado, dica "Não fixável: desafixe o grupo para usar este ícone").
- **Selo no cabeçalho:** só o pino, sem numeral (o ícone do grupo já é o da barra); `role=img`, `aria-label` "Fixado na barra de atividades" e `title` explicativo. Não depende de cor.
- **Escopo:** fixados são definidos pela configuração **Global**. Em "Este projeto" a opção fica desabilitada com "Itens fixados valem para todos os projetos; edite no escopo Global", e o chip de escopo tem a mesma dica no `title`. Em pasta não confiável também indisponível.
- **Excluir grupo fixado:** o contêiner some e o ícone fica livre (anúncio informa).
- Estados: não fixado / fixado / ícone não fixável / conflito / bloqueado por escopo / bloqueado por leitura.

### 12.3 Comportamento ao clicar na Activity Bar
- **Ícone de um grupo fixado:** abre o painel Ferramentas com **todos os grupos recolhidos, exceto o fixado**; rola até ele, o destaca por ~1,6 s (sem animação em `prefers-reduced-motion`; o destaque estático permanece) e move o foco para o cabeçalho do grupo. Anuncia "Ferramentas · <ícone>: grupo X aberto; os outros grupos estão recolhidos." Busca, favoritos e filtro de quebrados são limpos.
- **Grupo fixado inexistente no projeto ativo:** abre o painel e mostra o aviso "Este grupo não existe neste projeto." (dispensável, `role=status`, anunciado). Nenhum grupo é recolhido ou destacado.
- **Ícone principal Ferramentas:** comportamento normal; restaura o recolhimento anterior à primeira entrada por um ícone fixado (se houve).
- Passar de um fixado para outro mantém o "recolhimento anterior" original.
- **Muitos fixados:** a Activity Bar do VS Code colapsa o excedente num "…" (o protótipo simula com 12 grupos; os ocultos abrem num menu).

### 12.4 O que a plataforma NÃO permite (não simulado)
- **Hover do ícone na Activity Bar é só o tooltip nativo** com o título estático do contêiner. Como cada contêiner é fixo por ícone, o título pode ser "Ferramentas · <nome do ícone em pt-BR>" (ex.: "Ferramentas · Banco de dados"). Não existe caixa de hover rica nem links, e o **nome do grupo não pode aparecer** no tooltip nem no rótulo. A **cor do grupo também não aparece** na Activity Bar (o SVG é estático e herda a cor do tema).
- **Só ícones do catálogo:** o ícone fixado precisa ser um SVG estático declarado no `package.json`; ícone fora do catálogo não pode ser fixado (por isso o seletor fixável).
- **Contêineres fixos:** declarados em `contributes.viewsContainers.activitybar` (`groupedTools.pin.<icone>`); não se criam contêineres em tempo de execução. Contêiner sem grupo fica oculto por *context key* (`when`); a ordem na Activity Bar é do usuário e do VS Code.
- O usuário pode ocultar ou reordenar esses ícones pela própria Activity Bar; a extensão não controla isso. O excedente vai para o "…" do VS Code.

### 12.5 Contrato de dados (para o frontend-senior)
- `group.pinned`: booleano, **só na configuração global**. O contêiner é **derivado de `group.icon`** (deve pertencer ao catálogo fixável). **Unicidade por ícone** entre grupos fixados. `validateGroups` e o schema do `package.json` precisam aceitar `pinned` (hoje descartam campos desconhecidos, ver UX-4), ignorar `pinned` se o ícone não está no catálogo e descartar o segundo grupo fixado com o mesmo ícone. Em configuração de projeto `pinned` é ignorado.
- **Catálogo:** exportado de um único módulo (lista de ícones fixáveis com nome pt-BR), consumido pelo `package.json` (geração/verificação), pela extensão e pelo webview (seletor fixável).
- Contêineres e views: ids `groupedTools.pin.<icone>` (um por ícone do catálogo); context key sugerida `groupedTools.pin.<icone>.visible`, controlada pela extensão a partir de `pinned` + `icon`.
- Mensagens: `saveGroups` leva `pinned` (lista completa, escopo global). Extensão → webview: `data.groups[].pinned` e `data.pinCatalog` (ou módulo compartilhado). Clique no ícone do contêiner: a extensão abre o contêiner e envia `{type:'focusGroup', groupId, collapseOthers:true}`; se o grupo não existe no escopo ativo, envia `{type:'focusGroup', missing:true}` e o webview mostra o aviso de 12.3.
- Ícones estáticos: `media/pin/<icone>.svg` (viewBox 24, `stroke:currentColor`, 1,75), um por ícone do catálogo, mesmos traços do `icons.js`.

### 12.6 Achados e dúvidas
- **UX-15** Quando um slot é aberto pela Activity Bar, o webview pode não estar visível/criado ainda: a mensagem `focusGroup` precisa ser reenviada após `ready`. Dono: frontend-senior.
- **UX-16** Acessibilidade do ícone: o nome acessível do contêiner é estático ("Ferramentas · Banco de dados"); leitor de tela não ouve o nome do grupo antes de abrir. Mitigação: selo e anúncio ao abrir. Aceitável? (PV-14)
- **UX-17** Decidido (PV-19): fixados valem para todos os projetos, definidos só no escopo Global. Resta tratar o aviso "Este grupo não existe neste projeto" quando o escopo ativo é um projeto sem o grupo.
- **UX-18** Recolhimento "anterior" restaurado pelo ícone principal só vale na sessão do webview; ao recarregar volta ao padrão.
- **UX-19** **Risco a validar em spike no VS Code real:** ~40 contêineres da Activity Bar sem views visíveis (ocultos por `when`) permanecem ocultos e **não poluem** a personalização (menu de clique direito da Activity Bar, "Redefinir locais de vistas", lista de vistas). Se aparecerem, reduzir o catálogo ou reavaliar a abordagem.
- **UX-20** Tamanho do `package.json`: ~40 contêineres e ~40 views (e `menus`/`when`) aumentam o arquivo e o tempo de ativação; medir. Considerar gerar o trecho por script a partir do catálogo único.
- **UX-21** O catálogo precisa de SVGs estáticos em `media/pin/` (um por ícone), mantidos em sincronia com `icons.js` (licença ISC já presente). Dono: frontend-senior.
- **UX-22** O ícone do grupo passa a ser restrito quando fixado (seletor com cadeado) e a unicidade por ícone pode surpreender; validar com lay-users (PV-21 a PV-24).

### 12.7 Item na barra de status com card nativo no hover
Escolha do usuário: além do ícone na Activity Bar (que continua só com o tooltip simples "Ferramentas · <nome do ícone>"), **cada grupo fixado vira também um `StatusBarItem`** alinhado à esquerda.
- **Item:** codicon + nome do grupo + contagem, ex.: `$(database) Bancos de dados (5)`. Lucide não existe na barra de status; usa-se o codicon mais próximo do ícone do grupo (tabela de aproximação por ícone do catálogo, `CODICON` em `prototipo.js`; o protótipo mostra um glifo Lucide simulado e legenda o codicon real). Clique = mesmo comportamento aprovado do ícone fixado (abre o painel, recolhe os outros, rola, destaca, foca; grupo ausente no projeto mostra o aviso de 12.3).
- **Hover:** tooltip rico nativo (`MarkdownString` com `isTrusted` restrito aos comandos usados). Fica aberto enquanto o ponteiro está no item ou no card, com atraso nativo. **Estilo nativo** (fundo/borda do widget de hover, cantos pequenos, sem grade livre, sem botões). Conteúdo: título do grupo (e contagem); tabela Markdown com uma linha por extensão: ícone (imagem pequena de `package.json` `icon`, ou ícone genérico se não houver) + nome como link `command:` que abre o painel da extensão; extensão não instalada esmaecida com "Não instalado"; rodapé com links "Abrir no Ferramentas" e "Gerenciar grupo". Máximo ~15 linhas, depois "+N extensões" e "Ver todas" (abre o painel no grupo).
- **Teclado (aproximação):** o item é focável; o protótipo abre o card ao receber foco, ↑ entra nos links, ↑/↓ navegam, Esc fecha e devolve o foco, Enter no item abre o grupo. O comportamento real do tooltip no foco da barra de status deve ser confirmado no VS Code (UX-25); o painel continua sendo o caminho completo por teclado.
- **Muitos fixados:** a barra de status não tem "…" de overflow que a extensão controle; o VS Code corta o excedente e o usuário oculta itens pelo menu de contexto da barra (verificar no spike, UX-26). O protótipo corta e informa a contagem num texto do palco.
- **Não permite:** card arredondado do mockup, grade de ícones livre, botões, largura controlada pela extensão (decide o VS Code), links que não sejam de comando, imagens remotas.
- **Contrato de dados:** nenhum campo novo além de `group.pinned`. A extensão calcula por grupo fixado: lista de extensões (do `items`), `packageJSON.icon` de cada uma como URI de arquivo permitido, estado instalado, contagem para o texto do item, e atualiza o `StatusBarItem.tooltip` a cada mudança de configuração ou de `extensions.onDidChange`.
- **Achados:** **UX-23** o tooltip Markdown precisa ser regerado a cada mudança de grupo/extensão (e o card aberto não se atualiza sozinho); **UX-24** limite de links e de tamanho do Markdown, e `isTrusted` deve listar só os comandos permitidos; **UX-25** ícone da extensão exige URI de arquivo acessível ao tooltip (`asWebviewUri` não se aplica; testar `Uri.file` do `packageJSON.icon`, SVG pode não renderizar) e foco/teclado do hover; **UX-26** itens extras da barra de status: sem "…" nativo controlável, definir ordem/prioridade (`alignment`/`priority`) e limite razoável de itens fixados com status.
