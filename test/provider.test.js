const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
test('provider: data, favorites, command whitelist and configuration refresh', async () => {
  let provider, onMessage, onChange;
  const store = {}, calls = [];
  const groups = JSON.parse(JSON.stringify(require('../package.json').contributes.configuration.properties['groupedTools.groups'].default));
  const disposable = {dispose(){}};
  const updates = [];
  const config = {get:()=>groups,inspect:()=>({defaultValue:groups}),update:async (...args)=>updates.push(args)};
  const vscode = {
    ConfigurationTarget:{Global:1,Workspace:2},
    extensions:{all:[{id:'test.spotify',packageJSON:{name:'Spotify',contributes:{views:{'vscode-spotify':[{name:'Playlists'}]}}}}]},
    Uri:{joinPath:(uri,...parts)=>({fsPath:path.join(uri.fsPath,...parts),toString(){return this.fsPath;}})},
    workspace:{name:'AuraFit',workspaceFolders:[{}],getConfiguration:()=>config,onDidChangeConfiguration:f=>(onChange=f,disposable)},
    window:{registerWebviewViewProvider:(id,p)=>(provider=p,disposable),onDidChangeActiveTextEditor:()=>disposable,showErrorMessage:async m=>calls.push(m)},
    commands:{registerCommand:()=>disposable,executeCommand:async (...args)=>calls.push(args)}
  };
  const context = {extensionUri:{fsPath:path.resolve(__dirname,'..')},subscriptions:[],workspaceState:{get:(k,d)=>store[k]||d,update:async(k,v)=>{store[k]=v;}}};
  const sandbox = {module:{exports:{}},require:n=>n==='vscode'?vscode:require(n)};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../extension.js'),'utf8'),sandbox);
  sandbox.module.exports.activate(context);
  const messages=[];
  const view={webview:{asWebviewUri:u=>u,cspSource:'local',postMessage:m=>messages.push(m),onDidReceiveMessage:f=>(onMessage=f,disposable)},onDidDispose:()=>disposable};
  provider.resolveWebviewView(view);
  assert.ok(!view.webview.html.includes('{{'));
  assert.ok(view.webview.html.includes("default-src 'none'"));
  await onMessage({type:'ready'});
  const variados = messages.at(-1).groups.find(g => g.name === 'Variados');
  assert.equal(variados.icon, 'plus');
  assert.equal(variados.items.length, 2);
  for (const item of variados.items) await onMessage({type:'run', id:item.id});
  assert.deepEqual(calls.splice(0), [
    ['workbench.view.extension.vscode-spotify'],
    ['workbench.view.extension.clickup-kanban-sidebar-view']
  ]);
  assert.equal(messages.at(-1).groups[0].items[0].favorite,false);
  await onMessage({type:'favorite',id:'0:0'});
  assert.equal(messages.at(-1).groups[0].items[0].favorite,true);
  await onMessage({type:'run',id:'invented',command:'untrusted'});
  assert.equal(calls.length,0);
  await onMessage({type:'run',id:'0:0'});
  assert.equal(calls[0][0],'workbench.action.showCommands');
  await onMessage({type:'favorite',id:'0:0'});
  assert.equal(messages.at(-1).groups[0].items[0].favorite,false);
  groups[0].name='Updated'; onChange({affectsConfiguration:()=>true});
  assert.equal(messages.at(-1).groups[0].name,'Updated');
  assert.equal(messages.at(-1).extensions[0].command,'workbench.view.extension.vscode-spotify');
  await onMessage({type:'saveGroups',scope:'global',groups});
  assert.equal(updates.at(-1)[2],1);
  await onMessage({type:'saveGroups',scope:'workspace',groups});
  assert.equal(updates.at(-1)[2],2);
  await onMessage({type:'resetGroups',scope:'workspace'});
  assert.equal(updates.at(-1)[1],undefined);
  const before = updates.length;
  await onMessage({type:'saveGroups',scope:'global',groups:[{name:'Bad',items:[{name:'Recursive',command:'groupedTools.run'}]}]});
  assert.equal(updates.length,before);
  assert.equal(messages.at(-1).type,'saveError');
  vscode.workspace.workspaceFolders = [];
  await onMessage({type:'saveGroups',scope:'workspace',groups});
  assert.equal(updates.length,before);
  assert.equal(messages.at(-1).type,'saveError');
  config.update = async () => { throw new Error('Falha de escrita'); };
  await onMessage({type:'saveGroups',scope:'global',groups});
  assert.equal(messages.at(-1).text,'Falha de escrita');
});
