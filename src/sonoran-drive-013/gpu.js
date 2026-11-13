/* Targeted surface/depth replacement. World geometry is fixed on a 8m lattice.
   No camera-dependent tessellation; all actors share the same hardware depth buffer. */
(function(root){'use strict';
const STEP=8,MIN=-4096,MAX=4096,N=(MAX-MIN)/STEP+1,EDITN=513;
const albedo=m=>m.overlay==='salt_crust'?[224,210,174]:m.substrate==='bedrock'?[111,100,91]:m.substrate==='gravel'?[157,136,111]:m.substrate==='hardpan'?[191,171,136]:[215,165,104];
function parseColor(s){if(s[0]==='#')return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);return s.slice(4,-1).split(',').map(Number).map(n=>n/255);}
// Material IDs are presentation only: they never alter the world's substrate or safety.
const MATERIAL=Object.freeze({none:0,sand:1,firm:2,rock:3,craft:4,membrane:5,armour:6,crown:7,ivory:8,solar:9});
const terrainMaterial=m=>m.substrate==='bedrock'?MATERIAL.rock:m.overlay==='salt_crust'||['hardpan','gravel'].includes(m.substrate)?MATERIAL.firm:MATERIAL.sand;
const topology=new WeakMap(),baseSamples=new WeakMap();
function nodeBase(w,x,y){if(!w.baseHeight)return w.terrain.height(x,y);const i=(x-MIN)/STEP,j=(y-MIN)/STEP;if(!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<0||i>=N||j>=N)return w.baseHeight(x,y);let c=baseSamples.get(w);if(!c){c={z:new Float64Array(N*N),valid:new Uint8Array(N*N)};baseSamples.set(w,c)}const k=j*N+i;if(!c.valid[k]){c.z[k]=w.baseHeight(x,y);c.valid[k]=1}return c.z[k];}
function nodeHeight(w,x,y){return w.baseHeight?nodeBase(w,x,y)+(w._delta?w._delta(x,y):0):w.terrain.height(x,y);}

function diagonal(w,x,y){ // fixed base geometry, independent of camera and live edits
 if(!w.baseHeight)return 0;
 let cache=topology.get(w);if(!cache){cache=new Uint8Array((N-1)*(N-1));topology.set(w,cache)}
 const i=Math.round((x-MIN)/STEP),j=Math.round((y-MIN)/STEP),k=j*(N-1)+i;
 if(i<0||j<0||i>=N-1||j>=N-1)return 0;if(cache[k])return cache[k]-1;
 const h=(x,y)=>nodeBase(w,x,y),m=h(x+STEP/2,y+STEP/2),a=h(x,y),b=h(x+STEP,y),c=h(x,y+STEP),d=h(x+STEP,y+STEP);
 const v=Math.abs((a+d)/2-m)<=Math.abs((b+c)/2-m)?0:1;cache[k]=v+1;return v;
}
function meshSample(world,x,y){const ix=Math.floor(x/STEP)*STEP,iy=Math.floor(y/STEP)*STEP,u=(x-ix)/STEP,v=(y-iy)/STEP,h=(a,b)=>nodeHeight(world,a,b),a=h(ix,iy),b=h(ix+STEP,iy),c=h(ix,iy+STEP),d=h(ix+STEP,iy+STEP);return diagonal(world,ix,iy)?u+v<=1?a*(1-u-v)+b*u+c*v:b*(1-v)+d*(u+v-1)+c*(1-u):u>=v?a*(1-u)+b*(u-v)+d*v:a*(1-v)+d*u+c*(v-u);}
// Clip decals to the actual fixed terrain triangles, then lift a few centimetres.
// This avoids depth holes without allowing decals to show through a genuine hill.
function drape(raw,w,cache=new Map()){
 const out=[],xmin=Math.floor(Math.min(...raw.map(p=>p[0]))/STEP),xmax=Math.floor(Math.max(...raw.map(p=>p[0]))/STEP),ymin=Math.floor(Math.min(...raw.map(p=>p[1]))/STEP),ymax=Math.floor(Math.max(...raw.map(p=>p[1]))/STEP);
 const clip=(p,f)=>{const q=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=f(a),db=f(b);if(da>=-1e-7)q.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);q.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return q;};
 const H=(x,y)=>{const key=x+','+y;if(!cache.has(key))cache.set(key,nodeHeight(w,x,y));return cache.get(key)};
 for(let i=xmin;i<=xmax;i++)for(let j=ymin;j<=ymax;j++){const x=i*STEP,y=j*STEP;let p=raw.map(v=>v.slice(0,2));for(const f of [p=>p[0]-x,p=>x+STEP-p[0],p=>p[1]-y,p=>y+STEP-p[1]])p=clip(p,f);if(p.length<3)continue;const diag=diagonal(w,x,y),f=diag?p=>(p[0]-x)+(p[1]-y)-STEP:p=>(p[0]-x)-(p[1]-y),a=H(x,y),b=H(x+STEP,y),c=H(x,y+STEP),d=H(x+STEP,y+STEP);
 for(const sign of[-1,1]){const q=clip(p,p=>sign*f(p));if(q.length<3)continue;out.push(q.map(([px,py])=>{const u=(px-x)/STEP,v=(py-y)/STEP,z=diag?(sign<0?a*(1-u-v)+b*u+c*v:b*(1-v)+d*(u+v-1)+c*(1-u)):(sign>0?a*(1-u)+b*(u-v)+d*v:a*(1-v)+d*u+c*(v-u));return [px,py,z+.03]}));}}
 return out;
}
// Conservative sphere/frustum test includes vertical view and edited relief.
// Looking almost straight up or down must not inherit a flat horizontal wedge.
function chunkVisible(ch,cam,opt,padding=0){
 if(!Number.isFinite(ch.z)||!Number.isFinite(ch.radius))return true;
 const dx=ch.x-cam.x,dy=ch.y-cam.y,dz=ch.z-cam.z,cx=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch??-.16),sp=Math.sin(cam.pitch??-.16),horizontal=dx*cx+dy*sy,depth=horizontal*cp+dz*sp,up=-horizontal*sp+dz*cp,side=-dx*sy+dy*cx,r=ch.radius+padding,focal=opt.H/(2*Math.tan(Math.PI/6)),tx=opt.W/(2*focal),top=opt.H*.43/focal,bottom=opt.H*.57/focal;
 return depth+r>(cam.near??.8)&&depth-r<24000&&Math.abs(side)-depth*tx<=r*Math.hypot(1,tx)&&up-depth*top<=r*Math.hypot(1,top)&&-up-depth*bottom<=r*Math.hypot(1,bottom);
}

class SurfaceGPU{
 constructor(){this.canvas=document.createElement('canvas');const gl=this.gl=this.canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)throw Error('This experiment requires WebGL 2 for reliable terrain depth.');
 const vs=`#version 300 es
 precision highp float;
 in vec3 aPosition;in vec4 aColor;in vec3 aNormal;in float aMaterial;in vec3 aSurface;
 uniform vec3 uEye;uniform float uYaw,uPitch,uNear,uFocal,uW,uH;uniform bool uTerrain;uniform sampler2D uEdits;uniform vec4 uEditBounds;
 out vec4 vColor;out float vDepth;out vec3 vSurface;out vec4 vMaterial;
 float delta(vec2 xy){vec2 f=(xy+4096.0)/16.0;ivec2 a=ivec2(floor(f));vec2 t=fract(f);if(any(lessThan(a,ivec2(0)))||any(greaterThan(a,ivec2(511))))return 0.0;return mix(mix(texelFetch(uEdits,a,0).r,texelFetch(uEdits,a+ivec2(1,0),0).r,t.x),mix(texelFetch(uEdits,a+ivec2(0,1),0).r,texelFetch(uEdits,a+ivec2(1,1),0).r,t.x),t.y);}
 void main(){vec3 p=aPosition;vec4 color=aColor;if(uTerrain){vec3 n=aNormal;if(all(greaterThanEqual(p.xy,uEditBounds.xy))&&all(lessThanEqual(p.xy,uEditBounds.zw))){p.z+=delta(p.xy);n=normalize(vec3(aNormal.xy/aNormal.z-vec2(delta(p.xy+vec2(1,0))-delta(p.xy-vec2(1,0)),delta(p.xy+vec2(0,1))-delta(p.xy-vec2(0,1)))*.5,1));}float sun=dot(n,vec3(.912,.267,.31));float light=.61+.84*max(0.,sun);float cool=clamp((.28-sun)*.33,0.,.18);color.rgb=clamp(color.rgb*light+vec3(-22.,0.,36.)/255.*cool,0.,1.);}
 vec3 a=p-uEye;float cx=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);float right=-sy*a.x+cx*a.y;float up=-cx*sp*a.x-sy*sp*a.y+cp*a.z;float depth=cx*cp*a.x+sy*cp*a.y+sp*a.z;float near=uNear,far=24000.;gl_Position=vec4(2.*uFocal/uW*right,2.*uFocal/uH*up+.14*depth,(far+near)/(far-near)*depth-2.*far*near/(far-near),depth);vColor=color;vDepth=depth;vSurface=uTerrain?aPosition:aSurface;vMaterial=uTerrain?vec4(float(aMaterial==1.),float(aMaterial==2.),float(aMaterial==3.),0.):vec4(0.,0.,0.,aMaterial);}`;
 const fs=`#version 300 es
 precision highp float;
 in vec4 vColor;in float vDepth;in vec3 vSurface;in vec4 vMaterial;
 uniform bool uFog,uMaterials,uFine,uWormFinish;out vec4 color;
 // Stateless world/body coordinates; no time, camera UVs, texture fetches or noise octaves.
 float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 // Gradients computed before material branches. Unresolved frequencies fade to their mean.
 float grain(vec2 p,float footprint){return (noise(p)-.5)*(1.-smoothstep(.35,1.1,footprint));}
 float wave(float phase,float footprint){return sin(phase)*(1.-smoothstep(.7,2.7,footprint));}
 float seam(float distance,float width,float footprint){float aa=max(.0005,footprint*.5);return (1.-smoothstep(max(0.,width-aa),width+aa,abs(distance)))*min(1.,width/aa);}
 float materialTone(){
  vec3 p=vSurface;vec3 dp=abs(dFdx(p))+abs(dFdy(p));
  float xy=max(dp.x,dp.y),xyz=max(xy,dp.z);
  float nearFade=1.-smoothstep(90.,700.,vDepth),broadFade=1.-smoothstep(900.,2700.,vDepth);
  float tone=0.;
  if(vMaterial.x>.001){
   float bend=noise(p.xy*.025)*1.7;
   tone+=vMaterial.x*broadFade*.045*grain(p.xy*.045,xy*.045);
   if(uFine){float phase=dot(p.xy,vec2(.61,1.72))+bend;
    tone+=vMaterial.x*nearFade*(.037*wave(phase,xy*2.4)+.038*grain(p.xy*5.5,xy*5.5));}
  }
  if(vMaterial.y>.001){
   tone+=vMaterial.y*broadFade*.075*grain(p.xy*.32,xy*.32);
   if(uFine)tone+=vMaterial.y*nearFade*.065*grain(p.xy*3.8,xy*3.8);
  }
  if(vMaterial.z>.001||abs(vMaterial.w-3.)<.1){
   float weight=vMaterial.z>0.?vMaterial.z:1.;
   float phase=p.z*1.1+p.x*.055+p.y*.035;
   tone+=weight*broadFade*(.042*wave(phase,dp.z*1.1+xy*.09)+.065*grain((p.xy+vec2(p.z*.3))* .19,xyz*.31));
   if(uFine)tone+=weight*nearFade*.04*grain((p.xy+vec2(p.z)) *3.1,xyz*6.2);
  }
  if(abs(vMaterial.w-4.)<.1){
   // Soft panel-age variation; colour response only, not a new reflection model.
   tone=broadFade*.045*grain(p.xy*vec2(.65,1.4),xy*1.4);
   // Two finite shoulder seams and a rear service-panel joint, never a tiled grid.
   float shoulder=seam(abs(p.y)-1.56,.016,dp.y)*(1.-smoothstep(2.1,2.6,abs(p.x)));
   float service=seam(p.x+1.3,.013,dp.x)*(1.-smoothstep(.72,1.05,abs(p.y)));
   float edgeWear=seam(abs(p.y)-1.60,.022,dp.y)*(1.-smoothstep(2.0,2.5,abs(p.x)));
   tone+=broadFade*(-.12*max(shoulder,service)+.045*edgeWear);
   if(uFine)tone+=nearFade*(.028*grain((p.xy+vec2(p.z)) *12.,xyz*24.)+.018*wave(p.x*28.+p.y*2.,xy*30.));
  }
  if(abs(vMaterial.w-5.)<.1){
   tone=broadFade*.045*grain(p.xy*.8,xy*.8);
   if(uFine)tone+=nearFade*(.033*wave(p.y*17.+p.x*1.8,xy*18.8)+.035*grain(p.xy*9.,xy*9.));
  }
  if(abs(vMaterial.w-6.)<.1&&uWormFinish){
   // Finite trailing plate rim + an interrupted mineral chevron, in section metres.
   float top=smoothstep(-2.,9.,p.z);
   float rim=seam(p.x+3.95,.20,dp.x),worn=seam(p.x+3.58,.16,dp.x);
   float v=p.x-.7+abs(p.y)*.17;
   float chevron=seam(v,.20,dp.x+dp.y*.17)*smoothstep(1.3,3.,abs(p.y))*(1.-smoothstep(14.,18.,abs(p.y)))*top;
   tone=broadFade*(-.22*rim+.13*worn+.14*chevron+.10*grain(p.xy*.19,xy*.19));
   if(uFine)tone+=nearFade*(.05*grain((p.xy+vec2(p.z*.5))*5.,xyz*7.5)+.026*wave(p.x*22.+p.y*.6,dp.x*22.+dp.y*.6));
  }
  if(abs(vMaterial.w-7.)<.1){
   // Broad head plates, interrupted by a central keel. No tiled face grid.
   float brow=seam(p.x+2.0,.18,dp.x),keel=seam(abs(p.y)-2.8,.16,dp.y)*smoothstep(9.,13.,p.z);
   float worn=seam(p.x+1.65,.14,dp.x);
   tone=broadFade*(-.20*brow-.13*keel+.15*worn+.075*grain(p.xy*.22,xy*.22));
   if(uFine)tone+=nearFade*(.032*wave(p.x*18.+p.y*.5,dp.x*18.+dp.y*.5)+.045*grain((p.xy+vec2(p.z*.5))*4.,xyz*6.));
  }
  if(abs(vMaterial.w-8.)<.1){
   tone=broadFade*(.07*grain(p.xy*.3,xy*.3)+.045*wave(p.x*2.+p.y*.13,dp.x*2.+dp.y*.13));
   if(uFine)tone+=nearFade*.035*grain(p.xy*8.,xy*8.);
  }
  if(abs(vMaterial.w-9.)<.1){
   // Fine vascular folds, attached to the frill's real section frame.
   float fold=wave(p.z*1.35+p.x*.6,dp.z*1.35+dp.x*.6);
   tone=broadFade*(.10*fold+.05*grain(p.xz*.35,max(dp.x,dp.z)*.35));
   if(uFine)tone+=nearFade*.035*grain(p.xz*5.,max(dp.x,dp.z)*5.);
  }
  if(abs(vMaterial.w-6.)<.1&&!uWormFinish){
   tone=broadFade*(.065*wave(p.x*.65+p.z*.12,xyz*.77)+.05*grain(p.xy*.7,xy*.7));
   if(uFine)tone+=nearFade*.055*grain((p.xy+vec2(p.z*.5))*5.,xyz*7.5);
  }
  return clamp(tone,vMaterial.w>=6.&&uWormFinish?-.26:-.12,vMaterial.w>=6.&&uWormFinish?.22:.12);
 }
 void main(){vec3 surface=vColor.rgb;if(uMaterials)surface=clamp(surface*(1.+materialTone()),0.,1.);float fog=uFog?clamp((vDepth-380.)/6100.,0.,.65):0.;color=vec4(mix(surface,vec3(162.,154.,156.)/255.,fog),vColor.a);}`;
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
 this.loc={};for(const k of ['Eye','Yaw','Pitch','Near','Focal','W','H','Terrain','Edits','EditBounds','Fog','Materials','Fine','WormFinish'])this.loc[k]=gl.getUniformLocation(this.program,'u'+k);this.attrs=['Position','Color','Normal','Material','Surface'].map(n=>gl.getAttribLocation(this.program,'a'+n));this.dynamic=gl.createBuffer();this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.edits=new Float32Array(EDITN*EDITN);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,EDITN,EDITN,0,gl.RED,gl.FLOAT,this.edits);this.baseSeed=null;this.editSignature='';this.buildMs=0;
 }
 bind(buffer,terrain=false){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(let i=0;i<5;i++){if(terrain&&i===4){gl.disableVertexAttribArray(this.attrs[i]);gl.vertexAttrib3f(this.attrs[i],0,0,0);continue;}gl.enableVertexAttribArray(this.attrs[i]);gl.vertexAttribPointer(this.attrs[i],[3,4,3,1,3][i],gl.FLOAT,false,terrain?44:56,[0,12,28,40,44][i]);}}
 build(w){const gl=this.gl,begin=performance.now(),vertices=new Float32Array(N*N*11);let o=0;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=MIN+i*STEP,y=MIN+j*STEP;const h=nodeBase(w,x,y),meta=w.metadata?w.metadata(x,y):{substrate:'sand'},height=(x,y)=>w.baseHeight?w.baseHeight(x,y):w.terrain.height(x,y),dx=(height(x+1,y)-height(x-1,y))/2,dy=(height(x,y+1)-height(x,y-1))/2,L=Math.hypot(dx,dy,1),col=albedo(meta);vertices.set([x,y,h,col[0]/255,col[1]/255,col[2]/255,1,-dx/L,-dy/L,1/L,terrainMaterial(meta)],o);o+=11;}
 const indices=new Uint32Array((N-1)*(N-1)*6);o=0;this.chunks=[];
 for(let cy=0;cy<N-1;cy+=32)for(let cx=0;cx<N-1;cx+=32){const start=o;
  for(let j=cy;j<cy+32;j++)for(let i=cx;i<cx+32;i++){const a=j*N+i,b=a+1,c=a+N,d=c+1;indices.set(diagonal(w,MIN+i*STEP,MIN+j*STEP)?[a,b,c,b,d,c]:[a,b,d,a,d,c],o);o+=6;}
  let zmin=Infinity,zmax=-Infinity;for(let j=cy;j<=cy+32;j++)for(let i=cx;i<=cx+32;i++){const z=vertices[(j*N+i)*11+2];zmin=Math.min(zmin,z);zmax=Math.max(zmax,z);}
  this.chunks.push({x:MIN+(cx+16)*STEP,y:MIN+(cy+16)*STEP,z:(zmin+zmax)/2,radius:Math.hypot(128*Math.SQRT2,(zmax-zmin)/2),start,count:o-start});
 }

 if(this.terrain)gl.deleteBuffer(this.terrain);if(this.indices)gl.deleteBuffer(this.indices);this.terrain=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.terrain);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);this.indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);this.indexCount=indices.length;this.baseSeed=w.seed;this.world=w;this.buildMs=performance.now()-begin;
 }
 render(w,cam,opt,faces){const gl=this.gl;if(!this.terrain||this.world!==w)this.build(w);const W=opt.W,H=opt.H,dpr=opt.DPR||1;if(this.canvas.width!==Math.round(W*dpr)||this.canvas.height!==Math.round(H*dpr)){this.canvas.width=Math.round(W*dpr);this.canvas.height=Math.round(H*dpr)}if(gl.isContextLost())throw Error('Graphics context lost; reload this offline experiment to restore it.');gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.program);
 gl.uniform3f(this.loc.Eye,cam.x,cam.y,cam.z);gl.uniform1f(this.loc.Yaw,cam.yaw);gl.uniform1f(this.loc.Pitch,cam.pitch??-.16);gl.uniform1f(this.loc.Near,cam.near??.8);gl.uniform1f(this.loc.Focal,H/(2*Math.tan(Math.PI/6)));gl.uniform1f(this.loc.W,W);gl.uniform1f(this.loc.H,H);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this.loc.Edits,0);gl.uniform1i(this.loc.Materials,opt.materials===false?0:1);gl.uniform1i(this.loc.Fine,opt.reduced?0:1);gl.uniform1i(this.loc.WormFinish,opt.wormFinish===false?0:1);
 const signature=w.edits?JSON.stringify([...w.edits]):'';if(signature!==this.editSignature){this.edits.fill(0);for(const [key,value]of w.edits||[]){const [x,y]=key.split(',').map(Number),i=x+256,j=y+256;if(i>=0&&j>=0&&i<EDITN&&j<EDITN)this.edits[j*EDITN+i]=value;}gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,EDITN,EDITN,gl.RED,gl.FLOAT,this.edits);this.editSignature=signature;}
 let xmin=1e9,ymin=1e9,xmax=-1e9,ymax=-1e9;for(const key of w.edits?.keys()||[]){const [x,y]=key.split(',').map(Number);xmin=Math.min(xmin,x*16-17);xmax=Math.max(xmax,x*16+17);ymin=Math.min(ymin,y*16-17);ymax=Math.max(ymax,y*16+17)}gl.uniform4f(this.loc.EditBounds,xmin,ymin,xmax,ymax);
 gl.uniform1i(this.loc.Fog,1);gl.uniform1i(this.loc.Terrain,1);this.bind(this.terrain,true);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);let visibleIndices=0,rangeStart=0,rangeCount=0;const flush=()=>{if(rangeCount){gl.drawElements(gl.TRIANGLES,rangeCount,gl.UNSIGNED_INT,rangeStart*4);visibleIndices+=rangeCount;rangeCount=0;}};
 let editPadding=0;for(const value of w.edits?.values()||[])editPadding=Math.max(editPadding,Math.abs(value));
 for(const ch of this.chunks){const visible=opt.noCull||chunkVisible(ch,cam,opt,editPadding);if(visible){if(!rangeCount)rangeStart=ch.start;rangeCount+=ch.count;}else flush();}flush();
 // True depth for every actor, including the skimmer. Surface decals test
 // against terrain but cannot write depth or punch holes through actors.
 const groups=[faces.filter(f=>f.kind==='mountain'),faces.filter(f=>['groundOverlay','groundDetail','shadow'].includes(f.kind)),faces.filter(f=>!['mountain','groundOverlay','groundDetail','shadow'].includes(f.kind))];let triangles=0;
 const dynamicStart=performance.now(),drapeCache=new Map();
 // Reuse the typed backing store across batches/frames. WebGL copies the used view
 // synchronously; no boxed numeric array or second full-size Float32 conversion.
 let packed=this.dynamicVertices||(this.dynamicVertices=new Float32Array(8192));
 gl.uniform1i(this.loc.Terrain,0);
 for(let group=0;group<3;group++){
  gl.uniform1i(this.loc.Fog,group!==0?1:0);let used=0;
  for(const f of groups[group]){
   const col=parseColor(f.color),parts=group===1?drape(f.raw,w,drapeCache):[f.raw],material=group===1?0:(f.material||0),coords=f.materialCoords||f.localVertices;
   for(const raw of parts){
    const needed=used+Math.max(0,raw.length-2)*42;
    if(needed>packed.length){let capacity=packed.length;while(capacity<needed)capacity*=2;const larger=new Float32Array(capacity);larger.set(packed.subarray(0,used));packed=this.dynamicVertices=larger;}
    for(let i=1;i<raw.length-1;i++)for(let corner=0;corner<3;corner++){
     const j=corner===0?0:corner===1?i:i+1,p=raw[j],local=coords?.[j]||p;
     packed[used++]=p[0];packed[used++]=p[1];packed[used++]=p[2];
     packed[used++]=col[0];packed[used++]=col[1];packed[used++]=col[2];packed[used++]=f.alpha;
     packed[used++]=0;packed[used++]=0;packed[used++]=1;packed[used++]=material;
     packed[used++]=local[0];packed[used++]=local[1];packed[used++]=local[2];
    }
   }
  }
  if(!used)continue;
  gl.depthMask(group!==1);if(group===1){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1)}else gl.disable(gl.POLYGON_OFFSET_FILL);
  this.bind(this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,packed.subarray(0,used),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,used/14);triangles+=used/42;
 }
 gl.depthMask(true);gl.disable(gl.POLYGON_OFFSET_FILL);this.metrics={materials:{enabled:opt.materials!==false,fine:!opt.reduced,coordinates:'fixed world / actor local',maxToneDelta:.26,extraTextureFetches:0,extraDrawCalls:0,terrainStrideBytes:44,actorStrideBytes:56},renderer:'WebGL2 shared hardware depth',terrainGridM:STEP,terrainTriangles:this.indexCount/3,submittedTerrainTriangles:visibleIndices/3,actorTriangles:triangles,terrainBuildMs:this.buildMs,terrainGeometry:'fixed world lattice; no camera LOD or re-tessellation',mountainDepthPass:true,actorDepthPass:true,depthBits:gl.getParameter(gl.DEPTH_BITS),gpuError:gl.getError(),dynamicGeometryMs:performance.now()-dynamicStart};return this.canvas;
 }
}
const api={MATERIAL,terrainMaterial,SurfaceGPU,meshSample,diagonal,drape,STEP,MIN,MAX,N,parseColor,chunkVisible};root.SDGPU=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
