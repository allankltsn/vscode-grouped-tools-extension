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

`data` (extensão para webview): `groups[]` (`id,name,icon,color,pinned?,items[]`), item `{id,name,command,icon,favorite,kind,extensionId?,installed,args?}`, `unassigned[]`, `extensions[]`, `scope{active,hasWorkspace,trusted,projectOverride}`, `pins[]` (`{groupId,icon,name}`, sempre do Global), `stats`, `workspace`, `hasWorkspace`.

Webview para extensão: `ready{scope}`, `setScope`, `saveGroups{scope,groups,op}`, `undo{scope,groups,op}`, `resetGroups{scope}`, `useSuggested{scope}`, `run{id}`, `favorite{id}`, `openMarketplace{extensionId}`, `configure`, `focusAck{seq}`.

Extensão para webview: `data`, `saved`, `saveError{reason}`, `focusGroup{seq,groupId?,collapseOthers,organize?,missing?}`, `restoreFold{seq}`, `toggleFold` (sem ack), `openEditor`.

## Decisões da rodada de revisão
- **Somente leitura removido:** `groupedTools.groups` é `scope: "window"`; o VS Code não guarda valor por pasta (`workspaceFolderValue`) para esse escopo, então o ramo folderOverride/readOnly era código morto e foi removido (extensão, painel e testes). O que existe de verdade é Workspace Trust: sem confiança, só o Global.
- **Restauração do recolhimento (UX-18):** a view principal, ao ficar visível sem navegação em curso (flag `navigating`, 1,5 s após openGroup/openEditor), recebe `restoreFold` pelo mesmo canal com ack dos demais comandos de navegação.
- **Máquina de salvar:** fila por escopo, um salvamento em voo e merge de `data` em media/sync.js (puro, testado), incluindo a corrida salvar/trocar de escopo que antes descartava a edição pendente.
- **Ids derivados do nome (REV-5):** ver README, seção Segurança. É deliberado: a configuração escrita à mão continua válida sem `id`.
- **Termo:** neste plano "item" é cada entrada de um grupo; "atalho" aparece só em textos antigos da v1.

## Achados da segunda rodada (disposição)
| ID | Disposição |
|---|---|
| SEC-7 | Corrigido: o modal mostra o comando e os argumentos completos, com controle, bidi e zero-width como escape; acima de 1500 caracteres mostra "(truncado, N caracteres no total)" e oferece só "Executar uma vez". Argumentos limitados a 4096 caracteres serializados (readGroups descarta, validateGroups recusa). |
| SEC-8 | Corrigido: sem confirmação só workbench.view.* e uma lista explícita de ações inofensivas (SAFE_ACTIONS em src/tools-view.js). Tasks, debug, terminal e o resto pedem confirmação. |
| SEC-9 | Corrigido: o comando vem primeiro e o nome do item vai entre aspas, em uma linha só. |
| SEC-10 | Tratado: runCommands não está na lista segura, então sempre pede confirmação no projeto, com os argumentos à vista. No Global não pede (configuração do próprio usuário). |
| SEC-11 | Corrigido: approvedItems e favoritos novos guardam SHA-256 (prefixo h:); chaves antigas de favoritos continuam valendo e migram ao alternar. Limpeza de chaves órfãs: não feita (a lista de aprovados é limitada a 200). |
| SEC-12 | Corrigido: o painel usa a mesma lista BLOCKED_COMMANDS (teste de igualdade). |
| QA-9 | Corrigido: a extensão conta o que descartou (stats.invalid) e o painel avisa que salvar remove isso. |
| QA-10 = REV-12 | Corrigido: restoreFold não substitui navegação pendente; a janela de 5 s é só teto, e o focusAck a encurta para 400 ms. |
| QA-8 (resíduo) | Corrigido: cleanText cobre U+061C, U+00AD, U+180E e tag characters. |
| REV-11 | Corrigido: ux.md atualizado (escopo window, Workspace Trust). |
| REV-13, QA-11, QA-5/6 cosmético | Ressalva registrada, sem código: ainda dependem de verificação no VS Code real (layout em 220 px, navegação por setas em Recentes). |

## Terceira rodada (achados baixos de segurança, QA e revisão)
| ID | Disposição |
|---|---|
| SEC-13 | Corrigido: sequências de 4 ou mais espaços/tabs aparecem como barra-invertida, u e o código entre chaves (exemplo: u{E0041}). |
| SEC-14 | Corrigido: na ativação, approvedItems perde o que não começa com "h:"; favoritos ficam limitados a 500; favoritos legados em texto puro viram hash quando o item existe na configuração atual (Global, projeto ou pasta), os demais são descartados. |
| SEC-15 | Corrigido: toggleStatusbarVisibility e toggleActivityBarVisibility saíram de SAFE_ACTIONS (gravam em settings.json). As 12 restantes alternam estado de interface sem gravar configurações do usuário (revisadas). |
| SEC-16 | Corrigido: caracteres acima de U+FFFF aparecem como barra-invertida, u e o código entre chaves (exemplo: u{E0041}). |
| SEC-10 (limitação) | Aceito, sem código: no Global, runCommands e qualquer comando não pedem confirmação, porque a configuração Global é do próprio usuário. Quem copiar uma configuração de terceiros para o Global assume o risco. Documentado no README. |
| QA-12, QA-13, REV-15, REV-17, REV-18 | Aceitos como estão (sem código). |
| REV-16 | Aceito: aprovações antigas gravadas em texto puro deixam de valer e pedem confirmação mais uma vez; nota no README. |

## Dívida técnica
- **REV-4:** media/view.js tem cerca de 1100 linhas (render, DnD, teclado, seletor de ícones, menus). Dividir em módulos (render, dnd, picker, menus) depois de validar no VS Code real; a extração de model.js e sync.js foi o primeiro passo.

## Riscos
- **Não verificável sem VS Code:** renderização real, DnD HTML5 no webview, contêineres ocultos (UX-19), tooltip com imagem e foco (UX-25), excedente da barra de status (UX-26), atalho Alt+Shift+C em webview. Roteiro em `teste-manual.md`.
- ~40 contêineres e views no `package.json` (UX-20): medir ativação; o gerador permite reduzir o catálogo.
- `color-mix()` exige VS Code >= 1.78 (`engines` ^1.85, ok).
- Ids de item mudam de `new-*` para hash após salvar: o foco cai para o cabeçalho do grupo quando o alvo some.
- Risco de regressão de favoritos: a chave (`favoriteKey`) não mudou.

- SEC-17: "blank" now covers every Unicode space (\s) plus U+2800, U+3164, U+FFA0, U+115F, U+1160 and the JSON escapes \t \n \r. SEC-18: the favorites cap keeps the newest (slice(-500)) on activation and on toggle; hashes without a matching item in the current scope are kept on purpose (items of other scopes/projects share the same workspaceState), so they are not pruned.
