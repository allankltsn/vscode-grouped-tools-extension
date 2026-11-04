# Redesenho visual (UI) - Ferramentas agrupadas

Autor: ui-designer. Escopo: tokens, componentes e movimento da webview (`media/view.css`). Fluxo e estados de UX ficam com o ux-designer. Status: especificação pronta para validação; contrastes marcados "a medir" exigem conferência do QA nos temas reais. Não consultei `docs/design/prototipos/`.

## 1. Princípios
1. **O tema manda.** Superfícies, texto, bordas e foco vêm de `--vscode-*`. Só o acento do grupo é cor própria, sempre misturada ao tema com `color-mix`.
2. **Leve, não vazio.** Sem bordas em volta de tudo: separar por espaço e por fundos translúcidos (4-8%). Bordas só em campos, foco e alto contraste.
3. **Cantos suaves, escala curta.** 6 / 8 / 12 px e pílula. Nada de cantos retos nem de raios maiores que 12 px em itens.
4. **Hierarquia por peso e tom, não por tamanho.** Três tamanhos: 11 (meta), 13 (corpo), 14 (título de grupo, peso 600).
5. **Cor com propósito.** Cor identifica o grupo (chip do ícone, faixa, contador). O resto é neutro. A cor nunca é o único sinal: o nome do grupo está sempre presente.
6. **Movimento discreto.** 120-200 ms, só `transform` e `opacity`/cor. Desligado com `prefers-reduced-motion`.
7. **Funciona de 220 a 420 px.** Layout fluido sem media query de largura; `container queries` não são necessárias (ver 6).
8. **CSP.** Sem `style=""`. A cor do grupo vai por classe `.g-1`..`.g-10` que define `--g`. O ícone escolhido é SVG com `stroke:currentColor`.

## 2. Tokens (bloco único no topo de `view.css`)
Nenhum valor literal fora deste bloco. Fallbacks `#...` dos `var(--vscode-*)` hoje espalhados devem ir para cá, uma vez só.

```css
:root{
  /* espaçamento (base 4) */
  --sp-1:2px; --sp-2:4px; --sp-3:8px; --sp-4:12px; --sp-5:16px; --sp-6:24px;
  /* raios */
  --r-sm:6px; --r-md:8px; --r-lg:12px; --r-pill:999px;
  /* tipografia (família e corpo herdam do VS Code) */
  --fs-meta:11px; --fs-body:var(--vscode-font-size,13px); --fs-title:14px;
  --fw-regular:400; --fw-medium:500; --fw-strong:600; --lh:1.45;
  /* tamanhos de ícone e alvo */
  --ic-sm:16px; --ic-md:18px; --ic-stroke:1.75; --chip:28px; --hit:32px;
  /* movimento */
  --dur-fast:120ms; --dur:180ms; --dur-slow:240ms;
  --ease:cubic-bezier(.2,.7,.2,1); --ease-spring:cubic-bezier(.3,1.4,.5,1);
  /* camadas */
  --z-base:0; --z-sticky:10; --z-drag:20; --z-pop:30; --z-toast:40;

  /* superfícies derivadas do tema */
  --fg:var(--vscode-foreground);
  --fg-dim:var(--vscode-descriptionForeground,var(--vscode-foreground));
  --bg:var(--vscode-sideBar-background,var(--vscode-editor-background));
  --line:color-mix(in srgb,var(--fg) 10%,transparent);
  --hover:color-mix(in srgb,var(--fg) 6%,transparent);
  --press:color-mix(in srgb,var(--fg) 10%,transparent);
  --raise:color-mix(in srgb,var(--fg) 5%,var(--bg));
  --accent:var(--vscode-focusBorder,var(--vscode-textLink-foreground));
  --ring:0 0 0 2px var(--accent);
  /* sombras (elevação; no escuro fica sutil, o contorno --line ajuda) */
  --sh-1:0 1px 2px color-mix(in srgb,#000 18%,transparent);
  --sh-2:0 6px 16px color-mix(in srgb,#000 24%,transparent),0 0 0 1px var(--line);
  --sh-drag:0 10px 24px color-mix(in srgb,#000 32%,transparent),0 0 0 1px var(--accent);
}
```
Nota: `#000` em `color-mix` de sombra é o único literal permitido (sombra não é cor de tema). `--sh-*` usa `--vscode-widget-shadow` quando existir (UI-4).

## 3. Paleta de grupo (10 cores)
Cada classe define só `--g`. Valores de luminância média (≈0,17-0,30): contraste do próprio `--g` contra fundo claro **ou** escuro fica perto de 3:1 ou acima (faixa/ícone = componente, 3:1, **a medir**). O **texto** nunca usa `--g` puro: usa `--g-text`, que mistura `--g` com `--fg` e é recalculado pelo tema (alvo 4,5:1, a medir nos dois temas).

| Classe | Nome | `--g` | Obs. |
|---|---|---|---|
| g-1 | Azul | `#3b82f6` | padrão |
| g-2 | Violeta | `#8b5cf6` | |
| g-3 | Rosa | `#ec4899` | |
| g-4 | Vermelho | `#ef4444` | |
| g-5 | Laranja | `#ea6a0c` | limítrofe em fundo branco (~3:1) |
| g-6 | Âmbar | `#c98a04` | limítrofe em branco; ícone sempre com `--g-text` |
| g-7 | Verde | `#16a34a` | |
| g-8 | Turquesa | `#0d9488` | |
| g-9 | Ciano | `#0891b2` | |
| g-10 | Ardósia | `#64748b` | neutro; também é o "sem cor" |

```css
.g-1{--g:#3b82f6} /* ... g-2..g-10 conforme a tabela */
[class*=" g-"],[class^="g-"]{
  --g:var(--g-fallback,#64748b);
  --g-bg:color-mix(in srgb,var(--g) 16%,transparent);        /* chip, contador */
  --g-bg-soft:color-mix(in srgb,var(--g) 7%,transparent);    /* hover/alvo de soltura */
  --g-text:color-mix(in srgb,var(--g) 55%,var(--fg));        /* texto/ícone sobre --g-bg */
}
```
Cor personalizada (hex livre) não é suportada sem `style=""`; uma cor fora da paleta cai em `g-10` (UI-2).

**Alto contraste.** `@media (forced-colors:active)`, `body.vscode-high-contrast` e `body.vscode-high-contrast-light`: remover fundos translúcidos e sombras; `--g-bg:transparent`; chip, faixa e contador ganham `border:1px solid var(--vscode-contrastBorder,currentColor)`; texto usa `--fg`; foco `outline:2px solid var(--vscode-focusBorder)` (sem `box-shadow`, que `forced-colors` ignora); item selecionado/arrastado com `outline` + `outline-offset:-2px`. Em `forced-colors`, usar palavras-chave de sistema (`CanvasText`, `Highlight`, `ButtonBorder`). `prefers-contrast:more` aplica a mesma regra de bordas.

## 4. Componentes
Estrutura: `main.shell` > cabeçalho fixo (busca, abas) > lista rolável > bandeja > rodapé. Padding horizontal `--sp-4`.

### 4.1 Busca
Altura 32, raio `--r-md`, fundo `--vscode-input-background`, borda 1px `--line`, ícone Lucide `search` 16 px (`--fg-dim`). Foco: borda e `--ring` em `--accent`. Botão limpar (x) aparece com texto, alvo 24 px. Placeholder em `--vscode-input-placeholderForeground`.

### 4.2 Contexto e abas
Contexto: uma linha de meta (11 px, `--fg-dim`) com ponto de 6 px e nome do projeto; sem caixa. Abas "Todas/Favoritos": **segmented control** em pílula (fundo `--raise`, raio `--r-pill`, padding 2); item ativo com fundo `--bg`, `--sh-1`, peso 500; hover `--hover`. `aria-pressed` continua. Em 220 px, só o rótulo, sem ícone.

### 4.3 Grupo
Cabeçalho (botão, altura 36, raio `--r-md`): [alça de arrastar] [chevron 14] [chip 28 com ícone] [nome 14/600, elipse] [contador]. Sem borda entre grupos; espaçamento `--sp-3`.
- **Chip:** 28x28, raio `--r-sm`, fundo `--g-bg`, ícone 16 px `--g-text`.
- **Contador:** pílula, `--fs-meta`, fundo `--g-bg`, texto `--g-text`, mínimo 20 px de largura, números tabulares.
- **Faixa de acento:** barra de 2 px à esquerda da lista de itens (`border-inline-start`, `--g` a 55%), raio `--r-pill`, recuo `--sp-5` alinhado ao centro do chip. Some se recolhido.
- Estados: hover `--hover`; ativo `--press`; foco `--ring`; recolhido gira chevron -90° (`--dur-fast`); grupo vazio mostra "Arraste itens para cá" em `--fg-dim`, borda tracejada 1px `--line`, raio `--r-md`.
- Expandir/recolher: `grid-template-rows:0fr -> 1fr` com `--dur`, sem medir altura em JS.

### 4.4 Item (linha)
Altura mínima 36 (alvo 32+ no botão), raio `--r-md`, padding 0 `--sp-3`, vão `--sp-3`. Ícone 18 px `--fg-dim` (stroke 1.75); nome 13 px; elipse com `title`.
- **Hover:** fundo `--hover`; ícone passa a `--g-text`; ações (estrela, alça) surgem com `opacity` 0 -> 1.
- **Foco (teclado):** `--ring` interno (`outline-offset:-2px`); ações ficam visíveis em `:focus-within`.
- **Ativo:** `--press`, `transform:scale(.99)`.
- **Favorito:** estrela Lucide `star` com `fill:currentColor` em `--g-text`; sempre visível quando ativa. Alvo 28 px.
- **Desabilitado/carregando:** opacidade .55 e `cursor:default`; carregando troca o ícone por spinner de 14 px (`--dur` linear, 800 ms).
- **Selo "não instalado":** pílula `--fs-meta`, texto `--fg-dim`, fundo `--raise`, borda tracejada 1px `--line`, ícone `circle-dashed` 12 px; nome do item em `--fg-dim`. Não depende de cor: tem texto "Não instalado". Clique abre a instalação (ação do UX).

### 4.5 Arrastar e soltar
- **Alça:** ícone `grip-vertical` 14 px, `--fg-dim`, `cursor:grab`, alvo 24x32; visível em hover/foco. Também operável por teclado (alt+setas, regra do UX).
- **Item levantado:** `--raise`, `--sh-drag`, `scale(1.02)`, raio `--r-md`, `z-index:var(--z-drag)`, `cursor:grabbing`. Origem fica com `opacity:.35`.
- **Placeholder de soltura:** linha de 2 px `--accent` com bolinha de 6 px na ponta esquerda, altura reservada 36 que abre com `--dur-fast`.
- **Alvo de grupo:** cabeçalho com fundo `--g-bg-soft`, contorno 1px `--g` tracejado e raio `--r-md`.
- **Zona "Soltar para criar grupo":** bloco de 56 px, borda tracejada 1.5px `--accent` a 60%, fundo `color-mix(--accent 8%)`, ícone `plus` + texto 13 px; ativo (item sobre ela) borda sólida e fundo 14%. Só aparece durante o arraste.
- Alto contraste: placeholder 2px sólido `--vscode-focusBorder`; alvo com `outline`.

### 4.6 Bandeja "Não agrupadas"
Seção recolhível ao fim da lista, título 11 px caixa normal `--fg-dim` + contador neutro. Itens em **chips-linha** compactos (altura 32, raio `--r-md`, borda 1px `--line`, ícone 16) em lista vertical (não grade) abaixo de 300 px; em >=300 px, `flex-wrap`. Todos arrastáveis. Fundo da seção `--raise` a 50%, raio `--r-lg`, padding `--sp-3`.

### 4.7 Seletor de ícone (popover/painel)
Painel `--r-lg`, `--sh-2`, fundo `--vscode-quickInput-background` ou `--vscode-editorWidget-background`, `z-index:var(--z-pop)`. Em <300 px ocupa a largura (inset `--sp-3`) em vez de flutuar. Topo: busca (4.1) com foco automático. Grade `repeat(auto-fill,minmax(36px,1fr))`, gap `--sp-2`; célula 36x36, raio `--r-sm`, ícone 18. Hover `--hover`; selecionado `--g-bg` + `--g-text` + `aria-selected`; foco `--ring`; navegação por setas (grade `role=grid`). Rolagem interna com altura máxima 240. Sem resultado: "Nenhum ícone encontrado" 11 px. Rótulo acessível = nome do ícone.

### 4.8 Seletor de cor
Linha de 10 amostras (círculos 24, alvo 28, `role=radiogroup`), quebra em 2 linhas abaixo de 300 px (grade 5 colunas). Amostra = `--g`; selecionada: anel 2px `--fg` com recuo 2px (`box-shadow` via `outline` para alto contraste) e ícone `check` 14 em branco/preto contrastante (`color:Canvas` nas forced-colors). Hover `scale(1.1)`. Nome da cor em `aria-label` e `title`.

### 4.9 Edição inline
Substitui a seção "Personalizar grupos" fixa por edição no lugar: duplo clique ou botão lápis no cabeçalho transforma o nome em input (altura 28, raio `--r-sm`, borda `--accent`, `--ring`); chip clicável abre ícone/cor. Enter salva, Esc cancela. Salvando: ícone de check discreto 1.5 s. Erro: borda `--vscode-inputValidation-errorBorder`, texto de erro 11 px com ícone `circle-alert` (não só cor). Botões: primário `--vscode-button-*` raio `--r-sm`, altura 28; secundário idem; destrutivo = texto `--vscode-errorForeground` com fundo `--hover` no hover.

### 4.10 Toasts e status
Toast na base, acima do rodapé: raio `--r-md`, `--sh-2`, fundo `--vscode-notifications-background` (fallback `--raise`), borda `--line`, padding `--sp-3 --sp-4`, largura `calc(100% - 24px)`, `z-index:var(--z-toast)`. Entra `translateY(8px) + opacity` em `--dur`, some em 3 s (erros: ficam até dispensar). `role=status` (erro: `role=alert`); ícone Lucide `check`/`circle-alert`/`info`. Ação "Desfazer" como botão de texto. O status de salvamento ("Salvo em Global") também vai a `#live`.

### 4.11 Estado vazio / primeira vez
Centralizado, padding `--sp-6`: ilustração em SVG inline de 48 px (stroke `--fg-dim`, traço 1.75, sem foto), título 14/600, texto 13 `--fg-dim` com máx. 32ch, botão primário "Criar primeiro grupo" e link secundário "Usar grupos sugeridos". Busca sem resultados: mesma estrutura, menor (ícone `search-x`).

### 4.12 Rodapé
Altura 36, sem borda superior marcada (`--line`), texto 11 `--fg-dim`: resumo ("12 ferramentas em 5 grupos") à esquerda; ações de ícone (`settings`, 28 px, `title` "Abrir Settings") à direita. Escopo ("Global"/"Este projeto") como pílula neutra clicável.

## 5. Movimento
| Uso | Duração | Curva |
|---|---|---|
| hover/cor/foco | `--dur-fast` | `--ease` |
| chevron, expandir | `--dur` | `--ease` |
| item levantado, toast | `--dur` | `--ease-spring` (só `transform`) |
| placeholder abre | `--dur-fast` | `--ease` |

```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}
  .item.dragging{transform:none}
}
```
Spinner em reduced-motion vira indicador estático (ícone `loader` parado + texto "Carregando"). Sem parallax nem animações em loop.

## 6. Responsividade (220-420 px)
- Nada de largura fixa em itens; `min-width:0` em todo filho flex/grid para elipse.
- 220-259: contador, estrela e alça permanecem; selo "Não instalado" vira só ícone com `title` e rótulo para leitor de tela; abas só texto; popovers largos 100%.
- 260-340: layout nominal. 341-420: bandeja em `flex-wrap`; seletor de cor numa linha de 10.
- Zoom 200% e fonte maior: alturas são `min-height`, nunca `height`.
- Verificar matriz: {220, 300, 420} x {claro, escuro, HC escuro, HC claro}.

## 7. Trechos-chave (referência, não final)
```css
.item{display:flex;align-items:center;gap:var(--sp-3);min-height:36px;padding:0 var(--sp-3);
  border-radius:var(--r-md);transition:background var(--dur-fast) var(--ease)}
.item:hover{background:var(--hover)} .item:hover .ic{color:var(--g-text)}
.item:focus-within{outline:2px solid var(--accent);outline-offset:-2px}
.item .act{opacity:0;transition:opacity var(--dur-fast)}
.item:hover .act,.item:focus-within .act,.item .act[aria-pressed=true]{opacity:1}
.chip{display:grid;place-items:center;width:var(--chip);height:var(--chip);border-radius:var(--r-sm);
  background:var(--g-bg);color:var(--g-text)}
.ic{width:var(--ic-md);height:var(--ic-md);fill:none;stroke:currentColor;stroke-width:var(--ic-stroke);
  stroke-linecap:round;stroke-linejoin:round}
.count{padding:0 var(--sp-3);min-width:20px;text-align:center;border-radius:var(--r-pill);
  font-size:var(--fs-meta);font-variant-numeric:tabular-nums;background:var(--g-bg);color:var(--g-text)}
.drag-over>.head{background:var(--g-bg-soft);outline:1px dashed var(--g);outline-offset:-1px}
.drop-line{height:2px;margin:var(--sp-1) 0;border-radius:var(--r-pill);background:var(--accent)}
.item.dragging{background:var(--raise);box-shadow:var(--sh-drag);z-index:var(--z-drag);transform:scale(1.02)}
.panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--dur) var(--ease)}
.open>.panel{grid-template-rows:1fr} .panel>div{overflow:hidden}
```

## 8. Changelog de design-system e consumidores
- Novo: bloco de tokens (seção 2) -> consumido por todo `view.css`; substitui literais e fallbacks atuais.
- Novo: paleta `g-1..g-10` -> consumida por `view.js` (aplica classe ao grupo; config precisa de campo `color` com os 10 nomes) e `src/config.js` (validação).
- Alterado: stroke de ícones 1.5 -> 1.75 (`icons.js`/CSS); raios 3-5 -> 6-12; abas sublinhadas -> segmentado.
- Removido: borda entre grupos, caixa do contexto, formulário fixo "Personalizar grupos" (vira edição inline).
- Novos ícones Lucide a incluir localmente: `grip-vertical`, `chevron-right`, `check`, `x`, `pencil`, `circle-alert`, `info`, `circle-dashed`, `search-x`, `loader`, `settings` (licença ISC já presente).
- Protótipo alinhado ao produto 0.1.1 (04/11/2026), sem mudar tokens: botão Organizar removido (organização sempre ativa; `.is-org` virou `.is-reorder`, sem reordenação em lista filtrada); popover de cor com cor por código (`.cc*`) e `#rrggbb` próprio (`.g-custom`, `--on-g`); `.swatches` com `auto-fill`; modo somente leitura removido; nome exibido "group tools"; ícone da barra de atividades `boxes`; barra de status só com ícone e número; card de hover com ícone codicon por linha; bandeja sempre arrastável e sem opção de ocultar ícone.

## 9. Achados e dúvidas em aberto
- **UI-1** Contraste de `--g` (faixa/chip) e de `--g-text` sobre `--g-bg` nos 4 temas não foi medido com ferramenta; laranja e âmbar são limítrofes em branco. Dono: QA mede; ui-designer ajusta mistura (55%) ou os hex.
- **UI-2** Cor livre (hex) exige `style=""`/CSP; proposta: apenas a paleta fixa de 10. Decisão do principal/usuário.
- **UI-3** `color-mix()` exige VS Code recente (Chromium >= 111, VS Code >= 1.78). Confirmar `engines.vscode` do `package.json`; senão, fallbacks sólidos.
- **UI-4** Sombras: usar `--vscode-widget-shadow` onde existir; no HC, sem sombra. Validar visual no tema Light+ e Dark+.
- **UI-5** Em alto contraste, `forced-colors` ignora `box-shadow` e fundos; confirmar que todo estado (foco, arrastar, selecionado) tem `outline`/borda equivalente. Dono: frontend-senior implementa, QA verifica.
- **UI-6** Seletor de ícone "qualquer Lucide" exige catálogo grande local (peso de `icons.js`) ou carga sob demanda; fora do escopo visual, decidir com frontend-senior (impacta tamanho do VSIX).
- **UI-7** Edição inline substitui o formulário atual: depende do fluxo do ux-designer (aguardar alinhamento).
- **UI-8** Ilustração do estado vazio: SVG próprio simples, sem imagem de terceiros; licença não aplicável.
