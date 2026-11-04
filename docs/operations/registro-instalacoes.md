# Installation registry
Location: docs/operations/registro-instalacoes.md. Rule: nothing is installed, enabled or granted without a proposal, explicit approval and a row here, recorded in the same turn.

## Installed or enabled
| Date (UTC) | What | Source | Version/commit | Scope (project/user/global) | Approved by | Files/settings changed | Remove with | Verification |
|---|---|---|---|---|---|---|---|---|
| 2026-10-31 | lucide-static (somente no build; npm pack em pasta temporária, sem npm install no repo) | https://www.npmjs.com/package/lucide-static (repo lucide-icons/lucide, ISC) | 1.66.0 | project (gera media/icons.js) | usuário (aprovação na sessão) | media/icons.js, scripts/build-icons.js | apagar a pasta temporária; regenerar com scripts/build-icons.js | 2015 ícones gerados; licença ISC em media/lucide-LICENSE.txt |
| 2026-11-04 | @vscode/vsce (só para gerar o .vsix; npm install --ignore-scripts em pasta temporária, nenhum arquivo do repositório alterado) | https://www.npmjs.com/package/@vscode/vsce (repo microsoft/vsce; mantenedores Microsoft; cerca de 1,85 milhão de downloads na semana de 27/10 a 02/11/2026, conferido na API do npm em 04/11/2026; sem scripts preinstall, install ou postinstall) | 4.1.0 (fixada) | project (pasta temporária, fora do repo) | usuário (aprovação explícita na sessão, 04/11/2026) | nenhum no repositório; C:\Users\Allan\AppData\Local\Temp\claude\4620f8bc3ef2980a\7a6eee0a-eadb-4b59-882a-4cb48568ba9f\scratchpad\vsce-tool | apagar a pasta C:\Users\Allan\AppData\Local\Temp\claude\4620f8bc3ef2980a\7a6eee0a-eadb-4b59-882a-4cb48568ba9f\scratchpad\vsce-tool | package.json lido (4.1.0); vsce package gerou grouped-tools-0.1.1.vsix (61 files, 213.56 KB) a partir de cópia temporária com os SVGs locais do README e do CHANGELOG removidos (o vsce recusa SVG fora de hosts confiáveis); src e media do .vsix idênticos ao repositório (cmp, 56 arquivos) |

## Attempted but not installed
| Date | What | Reason (cancelled/blocked/rejected by security review) | Alternative used |
|---|---|---|---|

## Temporary files outside the repository
| Path | Created for | Safe to delete after |
|---|---|---|
| C:\Users\Allan\AppData\Local\Temp\claude\e--allan-grouped-tools\89fe6fc0-a510-44bc-9147-74970588cd4f\scratchpad\lucide | Extrair ícones do lucide-static | Após gerar media/icons.js |
| C:\Users\Allan\AppData\Local\Temp\claude\e--allan-grouped-tools\89fe6fc0-a510-44bc-9147-74970588cd4f\scratchpad (harness.html, scenario-*.js, capturas PNG) | Verificação do painel em Edge headless já instalado (nada instalado; sem pacotes) | Ao fim da revisão |
| C:\Users\Allan\AppData\Local\Temp\claude\4620f8bc3ef2980a\7a6eee0a-eadb-4b59-882a-4cb48568ba9f\scratchpad\vsce-tool, stage, unz, grouped-tools-0.1.1.vsix | Gerar e conferir o .vsix 0.1.1 | Após copiar o .vsix para o repositório e publicar. **REMOVIDO em 2026-11-04** (a cópia do .vsix na raiz do projeto foi mantida; é ignorada pelo git) |
| C:\Users\Allan\AppData\Local\Temp\mut, C:\Users\Allan\AppData\Local\Temp\vsce-tool, C:\Users\Allan\AppData\Local\Temp\p.js, C:\Users\Allan\AppData\Local\Temp\CHANGELOG.final.md e, no scratchpad da sessão, prof, prof3 a prof9, vsx, strip.js, registro.js, vscodeignore.bak | Sondas do QA, pasta vazia do vsce, perfis de navegador de teste e scripts auxiliares desta sessão | **REMOVIDOS em 2026-11-04** (20 itens). Ficaram os scripts pequenos dos agentes no scratchpad da sessão (cdp*.js, out-*, etc.), sem dados sensíveis, que o sistema descarta ao fim da sessão. Pastas Temp sem autoria comprovada (cdp-prof-*, aura-*, .tmp*) não foram tocadas |
