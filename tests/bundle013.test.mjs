import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('published standalone matches runtime sources and manifest and starts without external resources',()=>{
 const html=read('index.html'),manifest=JSON.parse(read('version.json'));assert.equal(createHash('sha256').update(html).digest('hex'),manifest.sha256);assert.equal(read(manifest.artifact),html);
 let expected=read('src/sonoran-drive-013/template.html');for(const n of ['world','geometry','worm','flight','aggression','game','visitor','gpu','arrival','contact','view','app'])expected=expected.replace('/*__'+n.toUpperCase()+'__*/',()=>read('src/sonoran-drive-013/'+n+'.js'));assert.equal(expected,html);assert(!/fetch\(|https?:\/\//.test(html));
 const ctx=vm.createContext({console,performance});for(const script of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].slice(0,-1))new vm.Script(script[1]).runInContext(ctx);
 const game=new ctx.SDGame.Game(701);game.start();for(let i=0;i<600;i++)game.step({forward:true});assert.equal(game.worms.length,2);assert(game.car.speed>50);assert(Math.abs(game.world.ledger().balance)<1e-7);
});
