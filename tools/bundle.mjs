import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),src=resolve(root,'src/sonoran-drive-015');
const names=['geometry.js','world.js','gpu.js','buggy.js','worm.js','flight.js','aggression.js','game.js','arrival.js','visitor.js','buggy-audio.js','contact.js','view.js','app.js'];
let html=readFileSync(resolve(src,'template.html'),'utf8');
for(const name of names){const marker='/*__'+name.split('.')[0].toUpperCase()+'__*/';if(html.split(marker).length!==2)throw Error('Expected exactly one marker '+marker);html=html.replace(marker,()=>readFileSync(resolve(src,name),'utf8'));}
const artifact='CITY-FARE-Sonoran-Drive-015.html',sha256=createHash('sha256').update(html).digest('hex');
writeFileSync(resolve(root,'index.html'),html);writeFileSync(resolve(root,artifact),html);
writeFileSync(resolve(root,'version.json'),JSON.stringify({game:'CITY fare',edition:'Sonoran Drive 015 — Lantern Dock',artifact,sha256,bytes:Buffer.byteLength(html)},null,2)+'\n');
console.log('Built Sonoran Drive 015 · '+Buffer.byteLength(html)+' bytes · '+sha256);
