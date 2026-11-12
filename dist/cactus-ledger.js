// Lossless, source-ID-preserving persistence for Sonoran Unbound cacti.
// Each generated 600m chunk owns 10 rows x 2 sides x 3 variants = 60 cacti.
// One 60-bit mask per visited chunk makes the full 2,200-mile journey bounded
// by world geometry instead of an arbitrary 10,000-hit storage ceiling.
const CACTUS_CHUNK_METRES=600;
const FIRST_CHUNK=-1; // The last cactus of chunk -1 can extend to +12m.
const LAST_CHUNK=Math.ceil(2200*1609.344/CACTUS_CHUNK_METRES);
const MASK_LIMIT=1n<<60n;
const MAX_EXTRAS=10000; // Previously accepted IDs that do not identify generated cacti.
export const MAX_CACTUS_IDS=(LAST_CHUNK-FIRST_CHUNK+1)*60+MAX_EXTRAS;
const LEGACY_ID=/^c:-?\d+:\d+:-?1:(?:0|1|near)$/;
const CANONICAL_ID=/^c:(-?\d+):(\d+):(-?1):(0|1|near)$/;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

function idFromBit(chunk,bit){
  const offset=30+60*Math.floor(bit/6),side=bit%6<3?-1:1;
  const kind=['0','1','near'][bit%3];
  return 'c:'+(chunk*CACTUS_CHUNK_METRES)+':'+offset+':'+side+':'+kind;
}
// Return null rather than guessing an identity for an unusual historical ID.
// Those strings are retained exactly as legacy extras in a compact checkpoint.
export function generatedCactusBit(id){
  if(typeof id!=='string')return null;
  const m=CANONICAL_ID.exec(id);
  if(!m)return null;
  const start=Number(m[1]),offset=Number(m[2]);
  if(!Number.isSafeInteger(start)||start%CACTUS_CHUNK_METRES!==0
    ||!Number.isSafeInteger(offset)||offset<30||offset>570
    ||(offset-30)%60!==0)return null;
  const chunk=start/CACTUS_CHUNK_METRES;
  if(chunk<FIRST_CHUNK||chunk>LAST_CHUNK)return null;
  const side=m[3]==='-1'?0:3;
  const kind=m[4]==='near'?2:Number(m[4]);
  const bit=(offset-30)/60*6+side+kind;
  // Reject alternate spellings such as c:000:030:1:0 as noncanonical IDs.
  return idFromBit(chunk,bit)===id?{chunk,bit}:null;
}

function checkedIds(ids){
  if(!Array.isArray(ids)||ids.length>MAX_CACTUS_IDS)return null;
  const seen=new Set();
  for(const id of ids){
    if(typeof id!=='string'||!LEGACY_ID.test(id)||seen.has(id))return null;
    seen.add(id);
  }
  return ids;
}
export function encodeCactusHistory(ids){
  if(!checkedIds(ids))return null;
  const masks=new Map(),extras=[];
  for(const id of ids){
    const hit=generatedCactusBit(id);
    if(hit){
      masks.set(hit.chunk,(masks.get(hit.chunk)||0n)|(1n<<BigInt(hit.bit)));
    }else{
      extras.push(id);
      if(extras.length>MAX_EXTRAS)return null;
    }
  }
  const destroyedCactusBits=[...masks.entries()].sort((a,b)=>a[0]-b[0])
    .map(([chunk,mask])=>[chunk,mask.toString(16).padStart(15,'0')]);
  return {destroyedCactusBits,...(extras.length?{destroyedCactusExtras:extras}:{})};
}
export function decodeCactusHistory(state){
  if(!state||typeof state!=='object'||Array.isArray(state))return null;
  if(!own(state,'destroyedCactusBits')){
    if(own(state,'destroyedCactusExtras'))return null;
    // 008 checkpoints have no cactus field. Pre-fix 009 stored raw ID arrays.
    const ids=own(state,'destroyedCacti')?state.destroyedCacti:[];
    return checkedIds(ids)?[...ids]:null;
  }
  if(own(state,'destroyedCacti'))return null; // Ambiguous dual representations.
  const entries=state.destroyedCactusBits;
  if(!Array.isArray(entries)||entries.length>LAST_CHUNK-FIRST_CHUNK+1)return null;
  const ids=[];
  let prev=FIRST_CHUNK-1;
  for(const entry of entries){
    if(!Array.isArray(entry)||entry.length!==2)return null;
    const [chunk,hex]=entry;
    if(!Number.isInteger(chunk)||chunk<FIRST_CHUNK||chunk>LAST_CHUNK
      ||chunk<=prev||typeof hex!=='string'||!/[0-9a-f]{15}/.test(hex)
      ||!/^([0-9a-f]{15})$/.test(hex))return null;
    const mask=BigInt('0x'+hex);
    if(mask===0n||mask>=MASK_LIMIT)return null;
    for(let bit=0;bit<60;bit++)
      if(mask&(1n<<BigInt(bit)))ids.push(idFromBit(chunk,bit));
    prev=chunk;
  }
  const extras=own(state,'destroyedCactusExtras')?state.destroyedCactusExtras:[];
  if(!Array.isArray(extras)||extras.length>MAX_EXTRAS)return null;
  const seen=new Set(ids);
  for(const id of extras){
    if(typeof id!=='string'||!LEGACY_ID.test(id)||generatedCactusBit(id)
      ||seen.has(id))return null;
    seen.add(id);ids.push(id);
  }
  return ids.length<=MAX_CACTUS_IDS?ids:null;
}
