# Ferramentas agrupadas

Extensão mínima em JavaScript puro, sem build e sem dependências npm.

## Executar
1. Extraia o ZIP e abra a pasta grouped-tools no VS Code.
2. Pressione F5. Uma janela Extension Development Host abrirá.
3. Clique no ícone de quatro quadrados “Ferramentas”.
4. Expanda os grupos e clique nos itens.

## Personalizar
Clique na engrenagem do painel e edite groupedTools.groups em settings.json (preferencialmente .vscode/settings.json no seu projeto). A alteração atualiza o painel automaticamente. A ordem do JSON define a ordem dos grupos e itens.

```json
{
  "groupedTools.groups": [
    {
      "name": "Cloud",
      "icon": "cloud",
      "items": [
        {
          "name": "Terminal",
          "command": "workbench.action.terminal.toggleTerminal",
          "icon": "terminal"
        }
      ]
    }
  ]
}
```

Para ferramentas de terceiros, instale a extensão correspondente e use o ID real de um comando exposto por ela. Na lista de atalhos de teclado do VS Code, encontre o comando e use “Copiar ID do comando”. O campo opcional args aceita uma lista de argumentos. Use somente comandos e argumentos de confiança.

## Limites
Agrupa atalhos para comandos; não move ou oculta automaticamente os ícones de outras extensões na Activity Bar. Não desativa extensões. Para reduzir a barra, oculte manualmente os ícones originais pelo menu de contexto. Não inclui arrastar e soltar, descoberta automática de extensões, favoritos ou perfis.

## Validação
Execute npm run check para validar a sintaxe. O teste visual requer executar F5 no VS Code.

API oficial: https://code.visualstudio.com/api/extension-guides/tree-view
