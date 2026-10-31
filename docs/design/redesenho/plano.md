# Plano de implementação - redesenho do painel

Autor: frontend-senior. Branch `feature/redesenho-painel`. Referência: `ux.md` (incl. seção 12), `ui.md` e o protótipo aprovado em `prototipo/`. Status: plano de execução, sem aprovação própria; reviewer, qa e security validam depois, sobre o mesmo snapshot.

## Fases e verificação
| Fase | Escopo | Verificação (cada fase) |
|---|---|---|
| 0 | Este plano | leitura |
| 1 | `src/`, `package.json`, `scripts/`, `media/pin*`, testes | `npm run check` e `npm test` |
| 2 | `media/view.html`, `view.css`, `view.js`, `model.js` | `npm run check`, `npm test`, teste do modelo puro |
| 3 | README, `.vscodeignore`, `teste-manual.md` | idem |

## Arquivos
- `media/pin-catalog.js` (novo, UMD): **fonte única** do catálogo de ícones fixáveis (nome pt-BR, codicon aproximado, alias legado). Consumido por `src/config.js`, `src/pins.js`, `scripts/build-pins.js` e pelo webview.
- `scripts/build-pins.js` (novo): gera `media/pin/<icone>.svg` (do `icons.js`) e as seções `viewsContainers.activitybar` e `views` do `package.json`. Idempotente; teste compara o gerado com o arquivo (modo `--check`).
- `src/config.js`: `readGroups`/`validateGroups` com `pinned` (só escopo Global), unicidade por ícone, `color`, `extensionId`, ids estáveis.
- `src/pins.js` (novo): context keys, StatusBarItems e tooltip Markdown; parte pura testável.
- `src/tools-view.js`: contrato `data`, `focusGroup` (reenvio após `ready` com `seq`/ack), redirecionador das views fixas.
- `src/extension.js`: registro, comandos ocultos da paleta, keybinding.
- `media/view.*`, `media/model.js`: interface conforme protótipo (sem palco `pv-*`).

## Decisões técnicas
1. **Contêiner fixo = redireciona.** Cada `groupedTools.pin.<icone>` traz uma view webview mínima (`groupedTools.pin.<icone>.view`, sem script). Ao ficar visível ela executa `groupedTools.view.focus` e envia `focusGroup` ao painel principal. Alternativa descartada: reaproveitar o mesmo provider em 40 views (40 webviews pesadas, estados divergentes). Custo aceito: a barra lateral troca de contêiner por um instante (a validar, PV/UX-19).
2. **Context key** `groupedTools.pinned.<icone com _ no lugar de ->` (hífen em `when` é arriscado). Cada view do contêiner usa `when: <key>`. Contêiner sem view visível fica oculto.
3. **Barra de status:** um item por grupo fixado, `$(codicon) Nome (N)`, à esquerda, prioridade decrescente pela ordem dos grupos. Tooltip `MarkdownString` com `isTrusted.enabledCommands` só para `groupedTools.runById`, `groupedTools.openGroup` e `groupedTools.manageGroup`. Esses comandos recebem **ids de string** e resolvem na configuração (lista branca); nomes são escapados antes de entrar no Markdown. Ícone da extensão só se `packageJSON.icon` for png/jpg/webp (SVG cai no codicon genérico).
4. **Atalho Alt+Shift+C** vive só como `keybinding` da extensão (`focusedView == groupedTools.view`) e posta `toggleFold`; o webview não escuta a tecla (evita alternar duas vezes).
5. **Desfazer:** snapshot na memória do webview, reenviado como `undo` (a extensão valida de novo). Salvar: debounce 400 ms, lista completa por gesto.
6. **CSP:** `default-src 'none'; style-src <cspSource>; script-src 'nonce-...'`. Sem `style=""` e sem `innerHTML` com texto de configuração. Única exceção declarada: posição de popover por `element.style.setProperty` (CSSOM, permitido pela CSP).
7. Sem dependências novas; nada a registrar em `registro-instalacoes.md`.

## Contrato de dados final
Configuração `groupedTools.groups[]`: `id?` (`[A-Za-z0-9_-]{1,64}`), `name` (<=100), `icon`, `color?` (`g-1`..`g-10`), `pinned?` (boolean; só Global; ícone no catálogo; um por ícone), `items[]`: `name`, `command`, `icon?`, `args?`, `extensionId?`.

`data` (extensão para webview): `groups[]` (`id,name,icon,color,pinned?,items[]`), item `{id,name,command,icon,favorite,kind,extensionId?,installed,args?}`, `unassigned[]`, `extensions[]`, `scope{active,hasWorkspace,projectOverride,folderOverride,readOnly}`, `pins[]` (`{groupId,icon,name}`, sempre do Global), `stats`, `workspace`, `hasWorkspace`.

Webview para extensão: `ready{scope}`, `setScope`, `saveGroups{scope,groups,op}`, `undo{scope,groups,op}`, `resetGroups{scope}`, `useSuggested{scope}`, `run{id}`, `favorite{id}`, `openMarketplace{extensionId}`, `configure`, `focusAck{seq}`.

Extensão para webview: `data`, `saved`, `saveError{reason}`, `focusGroup{seq,groupId?,collapseOthers,organize?,missing?}`, `toggleFold`, `openEditor`.

## Riscos
- **Não verificável sem VS Code:** renderização real, DnD HTML5 no webview, contêineres ocultos (UX-19), tooltip com imagem e foco (UX-25), excedente da barra de status (UX-26), atalho Alt+Shift+C em webview. Roteiro em `teste-manual.md`.
- ~40 contêineres e views no `package.json` (UX-20): medir ativação; o gerador permite reduzir o catálogo.
- `color-mix()` exige VS Code >= 1.78 (`engines` ^1.85, ok).
- Ids de item mudam de `new-*` para hash após salvar: o foco cai para o cabeçalho do grupo quando o alvo some.
- Risco de regressão de favoritos: a chave (`favoriteKey`) não mudou.
