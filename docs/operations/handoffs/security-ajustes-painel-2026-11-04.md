# Gate security: ajustes do painel (AJ-6 e mudanças associadas)
Revisor: security (instância independente, não é o autor). Data: 2026-11-04.
Snapshot: `git diff -- media src test scripts package.json CHANGELOG.md | sha256sum` = 2458a19442e27b2f, mais test/panel-ajustes.test.js novo (sha256 3394f376c6160dc3).
Persistido pelo principal a partir do relatório do gate (sem ferramenta de escrita), sem alterar o conteúdo.
Veredito: APROVADO, sem achado bloqueante. Um achado Low informativo (SEC-1). Aceite humano é separado.

## Verificado
- Host: `validColor` (src/config.js:54) aceita só g-1..g-10 ou `^#[0-9a-f]{6}$`. `readGroups` (:81) cai para neutro, `validateGroups` (:107) lança "Cor inválida." ao salvar e o export de configuração (:137) omite cor inválida. Regex sem flag g, sem estado de lastIndex.
- Probe em node: `#3b82f6\n`, ` `, espaço antes ou depois, maiúsculas, `new String(...)`, objeto com toString, array, `#3b82f6;}` e `g-1 `: todos rejeitados no host e no model. Um save com `#fff;background:url(x)` é rejeitado.
- Esquema do package.json: `anyOf` com enum g-1..g-10 ou pattern `^#[0-9a-f]{6}$`. A validação de verdade continua no host.
- media/model.js: `colorOf`/`normalizeColor`/`colorClass` usam a mesma regex (teste compara `HEX_COLOR.source`). `createGroup` só aceita `props.color` válido. `parseColorInput` sempre devolve `#rrggbb` minúsculo (fuzz nos testes).
- Webview: CSP `style-src {{csp}}` sem `unsafe-inline`, inalterada. `paintCustom` (view.js:96-103) revalida com `isHexColor` e aplica `--g`, `--g-text` e `--on-g` por `style.setProperty`. Não surgiu `style=` inline nem `<style>`. Mensagens de erro e nomes passam por `esc()`.
- Workspace não confiável: `restrictedConfigurations` e `isTrusted` (tools-view.js:142-160, 190) inalterados. Pior caso da cor customizada: cor arbitrária, sem execução de código.
- Grupos fixados: src/pins.js e build-pins.js mudam só textos e constantes (`boxes`, prefixo `group tools · `), sem uso da cor.
- postMessage: nenhum tipo novo no host nem no webview. Saves continuam por `validateGroups`.
- Drag/drop: o `drop` (view.js:925) usa só o estado interno `drag`; arraste vindo de fora é ignorado. `setData` grava só o id.
- Dependências: sem mudança; npm audit não se aplica.

## Achados
[SEC-1] [Low] Cor customizada interpolada no HTML como atributo
Location: media/view.js:275 e :537 (`data-gc="${...}"`, `data-c="${c}"`)
Cenário: hoje nenhum, o valor só entra após `isHexColor`. Vira risco se mudança futura afrouxar a regex ou remover o controle.
Esperado (brief AJ-6): nunca interpolar o valor em HTML de texto. Atual: interpola o valor já validado, sem `esc()`.
Recomendação (dono: frontend-senior; não bloqueia): passar por `esc()` (defesa em profundidade) ou definir via `dataset` após o render; ou o principal aceita o desvio.

## Observações
- `#RRGGBB` maiúsculo editado à mão no settings cai para neutro sem aviso (usabilidade, cabe ao QA).
- scripts/build-pins.js fora do Allowed writes: sem impacto de segurança; ratificação do principal.

## Limites de cobertura
Sem VS Code real nem CDP. Rodou só `node --test test/panel-ajustes.test.js` (10/10), não a suíte inteira. Conformidade do CSSOM com a CSP avaliada pela especificação, sem teste no webview real.
Qualquer correção depois exige revalidar este gate.

---
# Revalidação (snapshot c67a11ebec54aa1f; panel-ajustes.test.js sha256 4d1b4f51e46cf1ec)
Persistido pelo principal a partir do relatório do gate. Veredito: APROVADO, sem achado bloqueante.
- SEC-1 CORRIGIDO: `data-gc` e `data-c` passam por `esc()` (media/view.js:275 e :539).
- Fuzz de 200k entradas (normal, colar, apagar) e payloads hostis: nenhuma cor fora de `#rrggbb` minúsculo. Regex estrita e CSSOM intactos; CSP sem `unsafe-inline`; sem tipo novo de postMessage.
- SEC-2 [Low, informativo] backtracking quadrático em `parseColorInput` (media/model.js:107-108): ~1,3 s com 16k caracteres, 0 ms com 20. Inalcançável hoje (maxLength 20 no campo, máscara corta em 64). Recomendação: `.slice(0, 64)` dentro de `parseColorInput`.
  Disposição do principal: ACEITO como dívida de defesa em profundidade, sem correção neste ciclo (evita nova rodada de gates). Registrar como follow-up.
- Limites: sem VS Code real nem CDP; rodou só panel-ajustes.test.js (15/15).

---
# Rodada 2 (snapshot ea22871fd539841d; panel-ajustes.test.js sha256 4d1b4f51e46cf1ec)
Persistido pelo principal a partir do relatório do gate. Veredito: APROVADO, sem achado novo. SEC-1 segue corrigido; SEC-2 segue aceito como dívida.
- Hover (src/pins.js:16-56): `escapeMarkdown` via `cleanText` escapa os caracteres especiais; fuzz de 20.018 nomes hostis sempre gera 10 linhas e só os 3 links `](command:` próprios. Argumentos com `encodeURIComponent(JSON.stringify(...))`; `isTrusted` só nos 3 comandos próprios; `supportHtml=false`; sem imagem nem `file://`.
- Barra de status: `statusText` = `$(codicon) N`; `item.name` e `accessibilityInformation.label` por `plainName` (sem controle, bidi, zero-width; máx. 100).
- "Copiar passo": copia só `hideHint(hideName(nome))` (uma linha, máx. 60 caracteres); toast com `esc()`; nada mexe em pinnedViewlets, state.vscdb nem settings de terceiros; sem tipo novo de postMessage.
- Cor: sem regressão; CSP sem `unsafe-inline`; `npm test` 132/132.
- Observações: `hideName` deixa passar `'` e `(`; homóglifos passam no rótulo (já era assim).
- Limites: sem VS Code real nem CDP; não verificou o markdown de `\|` em tabela no hover real nem a permissão de clipboard do webview.

---
# Rodada 3 (snapshot cb9b687ba83879b2; panel-ajustes.test.js sha256 4d1b4f51e46cf1ec)
Persistido pelo principal a partir do relatório do gate. Veredito: APROVADO, sem achado novo. SEC-1 corrigido; SEC-2 aceito como dívida.
- A remoção de "Ocultar o ícone ao adicionar" não enfraquece controle algum: validação de cor, CSP, isTrusted e aprovação "Executar e lembrar" inalterados; sem caminho de clipboard; toast só com "X adicionado a Y" e `esc()`.
- Estado antigo com `remember` é ignorado (lista fixa de chaves com checagem de tipo) e some no próximo save; sem tipo novo de postMessage.
- Observação: nomes de teste em test/provider.test.js já usam IDs SEC de ciclos anteriores; prefixar por ciclo nos próximos para evitar colisão.
- Limites: sem VS Code real nem CDP; render do painel após a remoção não verificado; npm audit não aplicável.
