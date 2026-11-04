# Handoff: README e CHANGELOG estilizados
Task issue: sem board (perfil base); brief: docs/operations/briefs/readme-changelog-2026-11-04.md; skills: .claude/skills/readme-styling, .claude/skills/dark-pipeline-svg
Current role/instance: author (readme-generator, instância nova); next: reviewer independente (conformidade do brief, exatidão dos números, renderização no GitHub)
Snapshot/base: branch docs/readme-changelog sobre 96e49af; sha256 (16 primeiros) README.md 943ef94b7289d683, CHANGELOG.md 4566dde3d61cdd5a; 56 arquivos novos em assets/; sem commit
Allowed paths/exclusions/capabilities: escritas só em README.md, CHANGELOG.md, assets/**, este handoff; src/, media/, test/, package.json, docs/design/** e a sincronização do template não foram tocados (git status confere)
Existing authorization: só escrita local; nada instalado, sem commit/push/tag, sem rede (badges shields.io só como <img>)
Completed work and real evidence:
- README: banner hero.svg, badges (versão 0.0.4, VS Code ^1.85, JS sem dependências, Node 21+, 117 testes; sem licença e sem CI de propósito), início rápido, grid de 6 recursos, diagrama animado fluxo-grupos.svg, gráficos de testes e de linhas, uso, segurança, verificação, estrutura, contribuir; cartões SVG com texto copiável em <details>
- CHANGELOG: Keep a Changelog pt-BR, Não lançado (proposta 0.1.0), reestruturação 19 a 30/10 com hashes, 0.0.4, 0.0.3, 0.0.2 e 0.0.1 a partir do git e da inspeção dos .vsix e de v1/; gráfico animado evolucao.svg (29 commits)
- Conferido: npm test = 117 passando em 8 arquivos (41,23,14,11,10,8,7,3); build-pins.js --check ok; 2015 ícones Lucide; 41 contêineres; 40 fixáveis; limites lidos em src/; contagens por commit via git show; todos os SVGs parseiam como XML (55); renderizados no Edge headless: hero, fluxo, evolução, gráficos, cartões
- Ícones: copiados de lucide-static 1.66.0 já registrado só os 23 usados (assets/icons/lucide + LICENSE) e recoloridos com lucide_icon.py
Pending findings/decisions:
- F-1 (baixa, mantenedor): o brief diz 31 commits; o git tem 33 (29 sem merges); o texto usa os números do git
- F-2 (média, mantenedor): .vscodeignore não exclui assets/**, então o VSIX incluiria assets; fora do meu escopo de escrita
- F-3 (baixa): datas de 0.0.2, 0.0.3 e 0.0.4 são só a modificação dos .vsix locais (08/10/2026); lançamento "sem registro"
- F-4 (média, reviewer): renderização no GitHub real (SMIL, <picture>, grid) não foi vista; só Edge headless local
- F-5 (baixa): 0.1.0 é proposta; docs/design/redesenho/teste-manual.md não foi estilizado (era opcional)
Gate validity by snapshot: nenhum gate rodou; reviewer, QA e segurança ainda não validaram este snapshot
Next action: reviewer independente confere README/CHANGELOG/assets contra este snapshot e devolve IDs; mantenedor decide F-1, F-2, F-5
State: ready for validation; não aprovado; silêncio ou timeout não é aprovação
