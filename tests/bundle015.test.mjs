import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const dir='src/sonoran-drive-015/';
const parts=['geometry','world','gpu','buggy','worm','flight','aggression','game','arrival','visitor','buggy-audio','contact','view','app'];

test('015 works as an offline bundle built from the editable modules',()=>{
 const manifest=JSON.parse(read('version.json'));
 const html=read(manifest.artifact);
 assert.equal(html,read('index.html'));
 assert.equal(createHash('sha256').update(html).digest('hex'),manifest.sha256);
 assert.equal(Buffer.byteLength(html),manifest.bytes);
 const template=read(dir+'template.html');
 assert.equal(parts.reduce((source,part)=>source.replace(`/*__${part.toUpperCase()}__*/`,()=>read(dir+part+'.js')),template),html);
 const returnLink='<a href="https://bridges.c-amar.chatgpt.site/#work">Return to Bridges</a>';
 assert(!/fetch\(|https?:\/\//.test(html.replace(returnLink,'')));
 const context=vm.createContext({console,performance});
 for(const [,script]of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].slice(0,-1))new vm.Script(script).runInContext(context);
 const game=new context.SDVisitor.VisitGame(701);
 game.park('dock');game.start();
 const session=new context.SDArrival.ArrivalSession(game);
 assert.deepEqual(Array.from(game.vehicles,v=>v.id),['skimmer-01','buggy-01']);
 assert.equal(session.mode,'walk');
 for(let tick=0;tick<600;tick++)session.step({});
 assert(Math.abs(game.time-10)<1e-10);
 assert.equal(game.world.ledger().balance,0);
});
