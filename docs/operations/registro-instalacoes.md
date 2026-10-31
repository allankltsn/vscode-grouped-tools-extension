# Installation registry
Location: docs/operations/registro-instalacoes.md. Rule: nothing is installed, enabled or granted without a proposal, explicit approval and a row here, recorded in the same turn.

## Installed or enabled
| Date (UTC) | What | Source | Version/commit | Scope (project/user/global) | Approved by | Files/settings changed | Remove with | Verification |
|---|---|---|---|---|---|---|---|---|
| 2026-10-31 | lucide-static (somente no build; npm pack em pasta temporária, sem npm install no repo) | https://www.npmjs.com/package/lucide-static (repo lucide-icons/lucide, ISC) | 1.66.0 | project (gera media/icons.js) | usuário (aprovação na sessão) | media/icons.js, scripts/build-icons.js | apagar a pasta temporária; regenerar com scripts/build-icons.js | 2015 ícones gerados; licença ISC em media/lucide-LICENSE.txt |

## Attempted but not installed
| Date | What | Reason (cancelled/blocked/rejected by security review) | Alternative used |
|---|---|---|---|

## Temporary files outside the repository
| Path | Created for | Safe to delete after |
|---|---|---|
| C:\Users\Allan\AppData\Local\Temp\claude\e--allan-grouped-tools\89fe6fc0-a510-44bc-9147-74970588cd4f\scratchpad\lucide | Extrair ícones do lucide-static | Após gerar media/icons.js |
