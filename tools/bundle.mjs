import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),src=resolve(root,'src/sonoran-drive-013');
const names=['world.js','geometry.js','worm.js','flight.js','aggression.js','game.js','visitor.js','gpu.js','arrival.js','contact.js','view.js','app.js'];
let html=readFileSync(resolve(src,'template.html'),'utf8');
for(const name of names){const marker='/*__'+name.split('.')[0].toUpperCase()+'__*/';if(html.split(marker).length!==2)throw Error('Expected exactly one marker '+marker);html=html.replace(marker,()=>readFileSync(resolve(src,name),'utf8'));}
const artifact='CITY-FARE-Sonoran-Drive-013.html',sha256=createHash('sha256').update(html).digest('hex');
writeFileSync(resolve(root,'index.html'),html);writeFileSync(resolve(root,artifact),html);
writeFileSync(resolve(root,'version.json'),JSON.stringify({game:'CITY fare',edition:'Sonoran Drive 013 — Sun Colonies',artifact,sha256,bytes:Buffer.byteLength(html)},null,2)+'\n');
console.log('Built Sonoran Drive013 · '+Buffer.byteLength(html)+' bytes · '+sha256);
