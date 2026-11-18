import {readFileSync,writeFileSync} from 'node:fs';

const template=new URL('./buggy-soundboard.html',import.meta.url);
const modules={
 '/*__BUGGY_AUDIO__*/':'../src/sonoran-drive-015/buggy-audio.js',
 '/*__CONTACT__*/':'../src/sonoran-drive-015/contact.js',
 '/*__BUGGY_AUDITION__*/':'./buggy-audition.js'
};
let html=readFileSync(template,'utf8');
for(const [marker,path] of Object.entries(modules)){
 if(html.split(marker).length!==2)throw new Error(`Expected exactly one ${marker}`);
 html=html.replace(marker,()=>readFileSync(new URL(path,import.meta.url),'utf8'));
}
writeFileSync(new URL('../CITY-FARE-Buggy-Soundboard.html',import.meta.url),html);
