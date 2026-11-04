# QA independente: ajustes do painel (instância qa, não autora)
Snapshot: working tree, hash do diff 2458a19442e27b2f (confirmado) + test/panel-ajustes.test.js. Nenhum código editado.
VEREDITO: REPROVADO para este snapshot (1 achado Medium em AJ-6; correção + reconfirmação independente necessárias).

Execução: `npm run check` limpo; `npm test` 127/127 verde.

## Achados
QA-1 [Medium] AJ-6: no formato HSL não é possível apagar com Backspace
- Repro: `M.maskColorInput('hsl','217, 91%, 60',true)` (campo "217, 91%, 60%" após Backspace no fim) devolve "217, 91%, 60%". O mesmo ocorre com "217, 91%, 6" e com "217, 91" (devolve "217, 91%"). Em view.js:567-568 o valor re-mascarado é reescrito e o cursor vai ao fim, então o usuário só apaga selecionando tudo.
- Esperado: Backspace remove o último dígito; o `%` não pode ser reinserido enquanto `deleting` for true. RGB e HEX apagam normalmente (verificado).
- Evidência: script de sonda no scratchpad (loop de Backspace sobre a máscara; imprime STUCK).
- Causa provável: `maskColorInput` sempre sufixa `%` nos tokens 2 e 3 (model.js, `tokens.map`), inclusive com `deleting`.

QA-2 [Low] AJ-6: após escolher cor da paleta, a cor customizada some do seletor
- `paint()` lista a custom só quando é a cor atual; voltar a ela exige redigitar ou Desfazer. Não é defeito de segurança.

QA-3 [Low] AJ-6: `parseColorInput('__proto__', x)` devolve `{ok:false}` sem `error` (COLOR_FORMATS é objeto comum). Inalcançável pela UI (select fechado); sugerir `Object.hasOwn`.

QA-4 [Low] AJ-6: colar "300" em RGB vira "30, 0" (dígito que passaria de 255 fecha o token e o seguinte abre outro). Resultado válido, comportamento de máscara pouco óbvio; só registrar.

## Sem achado (tentei quebrar)
- AJ-5: rng NaN, 1, -1, `at` fora da faixa, groups nulo: sempre cor da paleta sem g-10; evita a cor do vizinho. (rng que lança não é tratado, só em teste.)
- AJ-6 segurança: normalizeColor/colorOf rejeitam "#ABCDEF", "#abcdef\n", "#abc", "red", "url(x)", objeto, array, null (caem em g-10); valor aplicado só por `style.setProperty` após `isHexColor`; CSP `style-src` + CSSOM coerente. Máscara: dígitos fullwidth/árabes, sinais, 4º canal, valores >255 e >360 rejeitados; parse HEX/RGB/HSL corretos (217,91%,60% = #3c83f6; 360,100,100 = #ffffff).
- AJ-2: sem resquício de `S.mode`/"Organizar"/"Concluir" em media/ e src/ (resta só a flag `organize` do host, sem efeito, já declarada).
- AJ-7/AJ-8: displayName, contêiner, título da view e comandos = "group tools"; `name`/ids intactos; nenhuma ocorrência de "Ferramentas agrupadas" em src, media, scripts, package.json. Desvio de escopo em scripts/build-pins.js: ratificar (coerente, check em dia).

## Limites (não verificado)
Não reexecutei arraste nativo (AJ-1) nem layout em 200/280/400 px e temas (AJ-4) em navegador; dependo da evidência CDP/harness do autor, sem confirmação independente. Temas reais do VS Code, leitor de tela e save real ao host sem cobertura. Pendências do autor: README/docs ainda com termos antigos (fora de escopo).
Próximo dono: frontend-senior (QA-1), depois QA reconfirma; security e revisão técnica no snapshot corrigido.

---
# Follow-ups 0.1.1 (HEAD bc3ec98; diff d5f4e93e06d76efa; test/followups.test.js sha256 409767e84aee26d0)
Persistido pelo principal a partir do relatório do QA. Veredito: APROVADO sem bloqueios. `npm run check` limpo; `npm test` 133/133 em 3 execuções seguidas.
- QA-7 fecha: vazio, espaços, NBSP, ideográfico, zero-width, bidi, U+2028/9, tag chars e controle caem em "Novo grupo"/"Extensão sem nome"; nomes com markdown/pipe misturados a invisíveis saem escapados, 2 células por linha, sem link injetado.
- SEC-2 fecha: 64 processado, 65 rejeitado; 100k caracteres em <0,03 ms; colagens rgb()/hsl() no limite corretas.
- REV-4: testado por mutação em cópia temporária; lentidão constante de 120 ms faz o teste falhar (mediana não mascara regressão sistemática). Backtracking catastrófico `(a+)+$` com 28 caracteres trava (falha por travamento, não por assert, pois o corte de 1 s só vale após o retorno da função).
- QA-9 [Low, ACEITO pelo principal como dívida]: nome com surrogate solitário (`"\ud800"`) sobrevive à limpeza e `slice(0,100)` pode partir par surrogate; só estético, sem injeção.
- QA-10 [Low, ACEITO, igual ao REV-10]: nome só de pontuação não cai no fallback; aparece escapado.
- Não verificado: render real do hover no VS Code.
