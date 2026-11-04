# Revisão independente: README, CHANGELOG e assets (registro do principal)
Snapshot: branch docs/readme-changelog sobre develop 96e49af; README.md, CHANGELOG.md e assets/** (56 arquivos) sem commit. Revisor: instância nova, só leitura.
Veredito: conformidade e técnica = achados pendentes; nenhum bloqueante. Confirmados: números (117 testes em 8 arquivos, linhas, 41 contêineres, 40 pins, 2015 ícones, 33 commits/29 sem merges), conteúdo de 0.0.2 a 0.0.4 contra os .vsix, 56 SVGs válidos sem script/href externo, links locais, pt-BR sem emoji e sem travessão.

## Achados e disposição do principal
| ID | Sev. | Achado | Disposição |
|---|---|---|---|
| DOC-1 | média | README:48 e a árvore dizem que o pacote tem só package.json, README.md, src/** e media/**; sem excluir assets/**, o VSIX levaria assets (148K); CHANGELOG.md entra por padrão no vsce | Corrigir: adicionar `assets/**` ao .vscodeignore e ajustar o texto (inclui CHANGELOG.md) |
| DOC-2 | média | vsce, pelo conhecimento do revisor (não executado), recusa SVG no README e no changelog, exceto de provedores de badge confiáveis: o primeiro `vsce package` pode falhar | Documentar como pendência conhecida (README, seção do pacote, e CHANGELOG); decidir quando o vsce for aprovado; marcar como NÃO verificado |
| DOC-3 | baixa | CHANGELOG:73 usa `README.md#segurança`; título com `<img>` gera âncora `#-segurança` | Corrigir: link sem âncora |
| DOC-4 | baixa | Datas de 0.0.2 a 0.0.4 vêm de mtime; arquivos internos do 0.0.2 são das 14:52, posteriores ao 0.0.4 (12:19): só o dia 08/10 é confiável, não a ordem | Corrigir: uma frase dizendo que só o dia é confiável |
| DOC-5 | baixa | CHANGELOG:23 omite view.css e view.html na lista medida (total 2721, não 3176); SEC-4 atribuído ao commit 389cc5d, que é de testes | Corrigir: completar a lista e ajustar a descrição (allowlist de SVG no gerador mais o teste) |
| DOC-6 | baixa | Falta assets/icons/README.md (conjunto padrão da skill); badge "117 testes passando" é estático e o teste SEC-19 falhou uma vez por tempo (72,6 ms contra 50 ms) | Criar o README de ícones; a flakiness do teste vai ao usuário (fora do escopo de docs) |

Não verificado pelo revisor: renderização no GitHub real, links http, `vsce package/ls`, cada frase da seção Uso contra view.js (amostragem).
