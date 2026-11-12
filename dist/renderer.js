import {center,elevation,heading,terrainHeight,ROUTE_LENGTH,cactusRecords} from './road.js';
import {activeWing} from './aero.js';
// Native WebGL: world metres -> orthonormal camera frame -> perspective.
// No textures, network assets, game engine, or screen-space imitation of 3D.
const hex=s=>[parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n)};
const rand=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
function tri(out,a,b,c,color,shade=1){let n=norm(cross(sub(b,a),sub(c,a))); if(n[1]<0)n=n.map(v=>-v);let light=(.72+.28*Math.max(0,dot(n,norm([-.6,1,-.35]))))*shade;let col=typeof color==='string'?hex(color):color;for(const p of [a,b,c])out.push(...p,...col.map(v=>v*light))}
function quad(o,a,b,c,d,col,shade=1){tri(o,a,b,c,col,shade);tri(o,a,c,d,col,shade)}
function box(o,x,y,z,sx,sy,sz,col){let v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>[x+p[0]*sx/2,y+p[1]*sy/2,z+p[2]*sz/2]);for(const [ids,k] of [[[0,1,2,3],.9],[[4,7,6,5],1],[[0,4,5,1],.8],[[3,2,6,7],1],[[1,5,6,2],.92],[[0,3,7,4],.8]])quad(o,...ids.map(i=>v[i]),col,k)}
function column(o,x,y,z,r,height,col,segments=7){for(let i=0;i<segments;i++){let a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;let p=[x+r*Math.cos(a),y,z+r*Math.sin(a)],q=[x+r*Math.cos(b),y,z+r*Math.sin(b)],u=[q[0],y+height,q[2]],v=[p[0],y+height,p[2]];quad(o,p,q,u,v,col);tri(o,v,u,[x,y+height,z],col)}}
function cactus(o,x,z,seed){let y=terrainHeight(x,z),h=2.8+rand(seed)*2.5,r=.19+rand(seed+1)*.08;column(o,x,y,z,r,h,'#3c5b5d');for(let s of [-1,1]){let arm=.6+rand(seed+s+4)*.5,at=y+h*(s<0?.48:.62);box(o,x+s*arm/2,at,z,arm,.24,.27,'#456768');column(o,x+s*arm,at-.1,z,r*.72,h*.3,'#466166')}}
function mesa(o,x,z,r,h,seed,base=-2){let rings=[],N=9;for(let j=0;j<4;j++){let rad=[1,.72,.48,.42][j]*r,yy=[0,.32,.86,1][j]*h;let ring=[];for(let i=0;i<N;i++){let a=i/N*Math.PI*2;let q=.83+rand(seed+i)*.25;ring.push([x+Math.cos(a)*rad*q,yy+base,z+Math.sin(a)*rad*q])}rings.push(ring)}let colors=['#6d6678','#837283','#9e818c'];for(let j=0;j<3;j++)for(let i=0;i<N;i++)quad(o,rings[j][i],rings[j][(i+1)%N],rings[j+1][(i+1)%N],rings[j+1][i],colors[j],.86+rand(seed+i+j)*.2);for(let i=0;i<N;i++)tri(o,rings[3][i],rings[3][(i+1)%N],[x,h+base,z],'#b19196')}
function roadPoint(z,lateral,y=.04){let a=heading(z);return [center(z)+Math.cos(a)*lateral,elevation(z)+y,z-Math.sin(a)*lateral]}
function stripe(o,z,z2,left,right,color,y){quad(o,roadPoint(z,left,y),roadPoint(z,right,y),roadPoint(z2,right,y),roadPoint(z2,left,y),color)}
function chunk(start,band=0,destroyed=new Set()){let o=[],end=start+600, xs=[-2600,-1800,-1100,-650,-350,-160,-70,-28,-12,-5.5,0,5.5,12,28,70,160,350,650,1100,1800,2600].map(x=>x+band);for(let z=start;z<end;z+=30)for(let i=0;i<xs.length-1;i++){let a=xs[i],b=xs[i+1],cc=center(z),cd=center(z+30);let p=[a+cc,terrainHeight(a+cc,z),z],q=[b+cc,terrainHeight(b+cc,z),z],r=[b+cd,terrainHeight(b+cd,z+30),z+30],s=[a+cd,terrainHeight(a+cd,z+30),z+30];let colors=['#a18483','#ac928b','#997d7d','#af948a'];quad(o,p,q,r,s,colors[Math.floor(rand(z+i*71)*4)])}
for(let z=start;z<end;z+=6){stripe(o,z,z+6,-5.4,5.4,'#ad9590',.02);stripe(o,z,z+6,-3.6,3.6,'#424c59',.06);for(let side of [-1,1])stripe(o,z,z+6,side*3.35-.055,side*3.35+.055,'#b5c1c3',.073);if(Math.floor(z/6)%3!==2)stripe(o,z,z+6,-.065,.065,'#e6ae83',.08)}
for(let z=start+30;z<end;z+=60)for(let s of [-1,1]){let x=center(z)+s*5.6,y=terrainHeight(x,z);box(o,x,y+.47,z,.09,.95,.09,'#eee3c7');box(o,x,y+.84,z,.12,.1,.13,s<0?'#eccd89':'#dc8052');let rockx=center(z)+s*(37+rand(z+81)*35);mesa(o,rockx,z+17,1+rand(z)*2,.6+rand(z+21),z,terrainHeight(rockx,z+17))}
// Geometry and hit testing use the SAME stable cactus records.
if(band===0)for(const item of cactusRecords(start))if(!destroyed.has(item.id))cactus(o,item.x,item.z,item.seed);
if(Math.floor(start/600)%4===0)for(let s of [-1,1]){let z=start+250,x=s*(1700+rand(z+s)*1300);mesa(o,x,z,180+rand(z)*280,90+rand(z+4)*130,z+s)}
// Store local chunk coordinates to avoid float jitter millions of metres into the drive.
for(let i=2;i<o.length;i+=6)o[i]-=start;
return o}
function carMesh(brake,steer,spin,wing=0){let o=[];
// A familiar coupe silhouette in brushed steel, gunmetal and restrained light strips.
box(o,0,.47,0,1.82,.3,4.12,'#202c38');box(o,0,.76,0,1.92,.46,4.25,'#677983');box(o,0,1.01,1.26,1.85,.12,1.55,'#9baeb4');box(o,0,.99,-1.58,1.84,.13,.91,'#536774');
let a=[-.83,1.02,-1.03],b=[.83,1.02,-1.03],c=[.65,1.39,-.52],d=[-.65,1.39,-.52];quad(o,a,b,c,d,'#143a4b');quad(o,[-.83,1.02,.94],[-.65,1.39,.43],[.65,1.39,.43],[.83,1.02,.94],'#295569');
for(let s of [-1,1]){quad(o,[s*.83,1.02,-.99],[s*.65,1.39,-.49],[s*.65,1.39,.40],[s*.83,1.02,.9],'#204352');box(o,s*.85,1.08,-.04,.06,.12,1.87,'#677983');box(o,s*.74,1.21,-.05,.045,.35,.055,'#5e747f');box(o,s*1.02,1.03,.65,.18,.09,.26,'#899da8');box(o,s*.98,.72,0,.035,.09,2.65,'#79e3db');box(o,s*.95,.97,-.28,.025,.045,.22,'#182d39')}
box(o,0,1.41,-.03,1.35,.08,1.02,'#a0b4bd');box(o,0,.54,-2.17,1.97,.13,.12,'#435762');box(o,0,.58,2.17,1.92,.12,.12,'#435762');box(o,0,.78,-2.15,.4,.15,.025,'#263b48');box(o,0,.88,-2.19,1.65,.065,.035,brake?'#ff573d':'#ff897b');box(o,0,.82,2.14,.7,.18,.04,'#283c40');for(let s of [-1,1]){box(o,s*.67,.82,-2.145,.36,.12,.06,'#24333e');box(o,s*.68,.84,2.14,.42,.065,.055,'#9af9ec')}
box(o,0,1.035,1.5,.07,.02,.9,'#70e4db');for(let s of [-1,1]){box(o,s*.61,1.09,-1.51,.17,.045,.56,'#263d49');box(o,s*.65,.46,-2.22,.22,.12,.08,'#263c49')}
// The active rear wing is a visible consequence of the same speed-dependent
// wing setting used by the mathematical aero model.
for(let side of [-1,1])box(o,side*.68,1.00+wing*.16,-1.93,.10,.42+wing*.28,.10,'#405665');
box(o,0,1.24+wing*.34,-2.02,2.18,.10,.52,'#b5c7cc');
box(o,0,.36,-2.17,1.72,.09,.35,'#263a44');
for(let x of [-.94,.94])for(let z of [-1.35,1.35]){let tire=[],N=12;for(let i=0;i<N;i++){let a=i/N*Math.PI*2+spin,b=(i+1)/N*Math.PI*2+spin;let p=[x-.14,.39+Math.sin(a)*.39,z+Math.cos(a)*.39],q=[x+.14,p[1],p[2]],r=[x+.14,.39+Math.sin(b)*.39,z+Math.cos(b)*.39],s=[x-.14,r[1],r[2]];quad(tire,p,q,r,s,'#253135');tri(tire,q,r,[x+.145,.39,z],'#2d393b');tri(tire,p,s,[x-.145,.39,z],'#2d393b');for(let side of [-1,1])tri(tire,[x+side*.15,.39+Math.sin(a)*.23,z+Math.cos(a)*.23],[x+side*.15,.39+Math.sin(b)*.23,z+Math.cos(b)*.23],[x+side*.15,.39,z],i%3===0?'#b2c7cf':'#5e7887')}
if(z>0){let ang=steer*.16;for(let i=0;i<tire.length;i+=6){let xx=tire[i]-x,zz=tire[i+2]-z;tire[i]=x+xx*Math.cos(ang)+zz*Math.sin(ang);tire[i+2]=z-xx*Math.sin(ang)+zz*Math.cos(ang)}}o.push(...tire)}return o}
const vertex=`attribute vec3 position;attribute vec3 color;uniform mat4 camera;uniform vec3 shift;varying vec3 vColor;varying float depth;void main(){gl_Position=camera*vec4(position+shift,1.);depth=gl_Position.w;vColor=color;}`;
const fragment=`precision mediump float;varying vec3 vColor;varying float depth;uniform float opacity;uniform float emission;void main(){float haze=smoothstep(700.,6200.,depth);gl_FragColor=vec4(mix(vColor,vec3(.62,.52,.56),haze*(1.-emission)),opacity);}`;
function program(gl,v,f){function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}let p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
function cameraMatrix(eye,target,aspect,fov){let f=norm(sub(target,eye)),r=norm(cross([0,1,0],f)),u=cross(f,r);let v=[r[0],u[0],f[0],0,r[1],u[1],f[1],0,r[2],u[2],f[2],0,-dot(r,eye),-dot(u,eye),-dot(f,eye),1];let t=1/Math.tan(fov/2),n=.15,far=8500,p=[t/aspect,0,0,0,0,t,0,0,0,0,(far+n)/(far-n),1,0,0,-2*far*n/(far-n),0],out=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[c*4+row]+=p[k*4+row]*v[c*4+k];return out}
export class Renderer{
constructor(canvas){this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});if(!gl)throw Error('This drive needs WebGL. Try enabling graphics acceleration or another browser.');this.p=program(gl,vertex,fragment);this.pos=gl.getAttribLocation(this.p,'position');this.col=gl.getAttribLocation(this.p,'color');this.cam=gl.getUniformLocation(this.p,'camera');this.shift=gl.getUniformLocation(this.p,'shift');this.opacity=gl.getUniformLocation(this.p,'opacity');this.emission=gl.getUniformLocation(this.p,'emission');this.chunks=new Map();this.car=this.mesh([]);this.shadow=this.mesh([]);this.dustMesh=this.mesh([]);this.poofMesh=this.mesh([]);this.glow=this.mesh([]);this.city=this.mesh([]);this.dust=[];this.poofs=[];this.destroyed=new Set();this.dustClock=0;this.yaw=null;this.frames=0;this.drawCalls=0;this.origin=0;
this.sky=program(gl,`attribute vec2 position;varying vec2 uv;void main(){uv=position;gl_Position=vec4(position,.9999,1.);}`,`precision mediump float;varying vec2 uv;uniform float aspect;uniform float yaw;void main(){float t=smoothstep(-.15,1.,uv.y);vec3 c=mix(vec3(.79,.53,.43),vec3(.13,.23,.36),t);vec2 sun=vec2(.40-sin(yaw)*1.4,.35);float d=length((uv-sun)*vec2(aspect,1.));c+=vec3(.24,.09,.025)*exp(-d*4.);c=mix(c,vec3(1.,.40,.10),1.-smoothstep(.059,.065,d));gl_FragColor=vec4(c,1.);}`);this.skybuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skybuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enable(gl.DEPTH_TEST);}
mesh(data){let gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return {buffer:b,count:data.length/6}}
update(mesh,data){let gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);mesh.count=data.length/6}
resetWorld(destroyed=[]){
  for(const chunk of this.chunks.values())this.gl.deleteBuffer(chunk.buffer);
  this.chunks.clear();this.destroyed=new Set(destroyed);this.poofs=[];
  this.dust=[];this.dustClock=0;this.yaw=null;
}
registerHits(hits=[]){
  for(const hit of hits){
    if(this.destroyed.has(hit.id))continue;
    this.destroyed.add(hit.id);
    const start=Number(hit.id.split(':')[1]);
    for(const [key,chunk] of this.chunks)if(chunk.z===start){
      this.gl.deleteBuffer(chunk.buffer);this.chunks.delete(key);
    }
    const ground=terrainHeight(hit.x,hit.z);
    for(let i=0;i<17;i++){
      const angle=i*Math.PI*2/17+rand(hit.seed+17)*.6;
      const velocity=3+rand(hit.seed*3+i*13)*5;
      this.poofs.push({x:hit.x,z:hit.z,y:ground+.65,
        vx:Math.cos(angle)*velocity,vz:Math.sin(angle)*velocity,
        vy:1.9+rand(hit.seed+i*11)*4.2,
        age:0,life:.6+rand(hit.seed+i*19)*.5,
        green:i%3!==0});
    }
  }
  if(this.poofs.length>220)this.poofs.splice(0,this.poofs.length-220);
}
resize(low){let d=Math.min(devicePixelRatio||1,low?1:1.6,1800/innerWidth);this.canvas.width=Math.round(innerWidth*d);this.canvas.height=Math.round(innerHeight*d);this.gl.viewport(0,0,this.canvas.width,this.canvas.height)}
render(s,prefs,dt,input={}){const gl=this.gl;
this.origin=Math.floor(s.z/600)*600;const origin=this.origin;
const band=Math.round((s.x-center(s.z))/2200)*2200;
for(let z=origin-3000;z<=origin+6600;z+=600){
  const key=z+':'+band;
  if(!this.chunks.has(key))this.chunks.set(key,{z,band,...this.mesh(chunk(z,band,this.destroyed))});
}
for(const [key,c] of this.chunks)
  if(c.band!==band||c.z<origin-3600||c.z>origin+7200){
    gl.deleteBuffer(c.buffer);this.chunks.delete(key);
  }let yaw=s.angle;if(this.yaw===null||prefs.motion)this.yaw=yaw;else this.yaw+=(yaw-this.yaw)*(1-Math.exp(-5*Math.min(dt,.05)));yaw=this.yaw;let far=prefs.camera==='wide',dist=far?16:11.5,height=far?7:4.7;let ground=terrainHeight(s.x,s.z)+.05,eye=[s.x-Math.sin(yaw)*dist,ground+height,s.z-Math.cos(yaw)*dist],target=[s.x+Math.sin(yaw)*14,ground+1.15,s.z+Math.cos(yaw)*14];eye[1]=Math.max(eye[1],terrainHeight(eye[0],eye[2])+1.8);eye[2]-=origin;target[2]-=origin;let matrix=cameraMatrix(eye,target,this.canvas.width/this.canvas.height,Math.PI/3.1+(prefs.motion?0:.10*Math.pow(Math.min(1,s.v/80.4672),2)));
gl.clearColor(.65,.75,.74,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.useProgram(this.sky);let a=gl.getAttribLocation(this.sky,'position');gl.bindBuffer(gl.ARRAY_BUFFER,this.skybuf);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.uniform1f(gl.getUniformLocation(this.sky,'aspect'),this.canvas.width/this.canvas.height);gl.uniform1f(gl.getUniformLocation(this.sky,'yaw'),yaw);gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(a);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.p);gl.uniform1f(this.opacity,1);gl.uniform1f(this.emission,0);gl.uniformMatrix4fv(this.cam,false,matrix);gl.enableVertexAttribArray(this.pos);gl.enableVertexAttribArray(this.col);this.drawCalls=1;
const draw=(m,z=0)=>{gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.vertexAttribPointer(this.pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(this.col,3,gl.FLOAT,false,24,12);gl.uniform3f(this.shift,0,0,z);gl.drawArrays(gl.TRIANGLES,0,m.count);this.drawCalls++};
for(let c of this.chunks.values())draw(c,c.z-origin);
// The far city is a stylized journey-progress cue, not a simulated city map.
let city=[],progress=Math.min(1,s.distance/ROUTE_LENGTH),cityDist=4400-3500*Math.pow(progress,5),cityZ=s.z+cityDist,cityX=center(s.z+300)+500;for(let i=0;i<19;i++){let x=cityX+(i-9)*33,z=cityZ+rand(i+901)*180,y=elevation(s.z);let hh=65+rand(i+12)*160;box(city,x,y+hh/2,z,18+rand(i)*20,hh,22,'#435e70');box(city,x,y+hh*.73,z-11.2,2,hh*.45,.3,'#81dfde');if(i%4===0)box(city,x,y+hh+18,z,2,36,2,'#a7c6d0')}for(let i=2;i<city.length;i+=6)city[i]-=origin;this.update(this.city,city);draw(this.city);
let car=carMesh(input.brake,s.steer,s.distance/.39,activeWing(s.v,prefs.wingMode)),pitch=Math.atan((terrainHeight(s.x+Math.sin(s.angle),s.z+Math.cos(s.angle))-terrainHeight(s.x-Math.sin(s.angle),s.z-Math.cos(s.angle)))/2),roll=prefs.motion?0:-s.steer*Math.min(s.v/80.4672,1)*.035;for(let i=0;i<car.length;i+=6){let x=car[i],y=car[i+1],z=car[i+2];let yy=y*Math.cos(pitch)+z*Math.sin(pitch)+x*Math.sin(roll),zz=z*Math.cos(pitch)-y*Math.sin(pitch);car[i]=s.x+x*Math.cos(s.angle)+zz*Math.sin(s.angle);car[i+1]=ground+yy+.055;car[i+2]=s.z+zz*Math.cos(s.angle)-x*Math.sin(s.angle)}for(let i=2;i<car.length;i+=6)car[i]-=origin;this.update(this.car,car);
let shadow=[];const shadowPoint=a=>{let x=s.x+Math.cos(a)*1.25*Math.cos(s.angle)+Math.sin(a)*2.5*Math.sin(s.angle),z=s.z+Math.sin(a)*2.5*Math.cos(s.angle)-Math.cos(a)*1.25*Math.sin(s.angle);return [x,terrainHeight(x,z)+.135,z]};for(let i=0;i<20;i++)tri(shadow,[s.x,ground+.085,s.z],shadowPoint(i/20*Math.PI*2),shadowPoint((i+1)/20*Math.PI*2),'#504f46');for(let i=2;i<shadow.length;i+=6)shadow[i]-=origin;this.update(this.shadow,shadow);draw(this.shadow);draw(this.car);

// A few additive, depth-tested light halos: geometry only, no bloom pipeline.
let glow=[];const carPoint=(x,y,z)=>{let yy=y*Math.cos(pitch)+z*Math.sin(pitch)+x*Math.sin(roll),zz=z*Math.cos(pitch)-y*Math.sin(pitch);return [s.x+x*Math.cos(s.angle)+zz*Math.sin(s.angle),ground+yy+.055,s.z+zz*Math.cos(s.angle)-x*Math.sin(s.angle)-origin]};
const halo=(c,rx,ry,color)=>{for(let i=0;i<14;i++){let a=i/14*Math.PI*2,b=(i+1)/14*Math.PI*2;glow.push(...c,...color,...[c[0]+Math.cos(a)*rx*Math.cos(yaw),c[1]+Math.sin(a)*ry,c[2]-Math.cos(a)*rx*Math.sin(yaw)],0,0,0,...[c[0]+Math.cos(b)*rx*Math.cos(yaw),c[1]+Math.sin(b)*ry,c[2]-Math.cos(b)*rx*Math.sin(yaw)],0,0,0)}};
for(let x of [-.65,0,.65])halo(carPoint(x,.88,-2.23),.55,.18,input.brake?[1,.15,.06]:[1,.25,.25]);for(let side of [-1,1])halo(carPoint(side*.97,.52,-.4),.14,.2,[.15,.85,.92]);
let under=[s.x,ground+.10,s.z-origin];for(let i=0;i<20;i++){let a=i/20*Math.PI*2,b=(i+1)/20*Math.PI*2;let edge=t=>{let x=s.x+Math.cos(t)*1.28*Math.cos(s.angle)+Math.sin(t)*2.45*Math.sin(s.angle),z=s.z+Math.sin(t)*2.45*Math.cos(s.angle)-Math.cos(t)*1.28*Math.sin(s.angle);return[x,terrainHeight(x,z)+.15,z-origin]};glow.push(...under,.05,.5,.6,...edge(a),0,0,0,...edge(b),0,0,0)}
this.update(this.glow,glow);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.uniform1f(this.opacity,.32);gl.uniform1f(this.emission,1);draw(this.glow);gl.uniform1f(this.emission,0);gl.uniform1f(this.opacity,1);gl.depthMask(true);gl.disable(gl.BLEND);

let delta=Math.min(.05,Math.max(0,dt));for(let d of this.dust){d.age+=delta;d.x+=delta*.8;d.y+=delta*.45}this.dust=this.dust.filter(d=>d.age<1.8);this.dustClock+=delta;if(s.v>4&&Math.abs(s.x-center(s.z))>2.8&&this.dustClock>.035){this.dustClock=0;for(let side of [-1,1])this.dust.push({x:s.x-Math.sin(s.angle)*2+Math.cos(s.angle)*side*.85,y:ground+.18,z:s.z-Math.cos(s.angle)*2-Math.sin(s.angle)*side*.85,age:0})}if(this.dust.length>100)this.dust.splice(0,this.dust.length-100);let dust=[];for(let d of this.dust){let r=.16+d.age*.55;for(let i=0;i<7;i++){let a=i/7*Math.PI*2,b=(i+1)/7*Math.PI*2;tri(dust,[d.x,d.y,d.z-origin],[d.x+Math.cos(a)*r*Math.cos(yaw),d.y+Math.sin(a)*r,d.z-origin-Math.cos(a)*r*Math.sin(yaw)],[d.x+Math.cos(b)*r*Math.cos(yaw),d.y+Math.sin(b)*r,d.z-origin-Math.cos(b)*r*Math.sin(yaw)],'#c4a4a0')}}this.update(this.dustMesh,dust);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(this.opacity,.17);draw(this.dustMesh);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(this.opacity,1);
// Short-lived green fragments + pale dust produce a visible cactus "poof".
let bits=[],deltaPoof=Math.min(.05,Math.max(0,dt));
for(const p of this.poofs){
  p.age+=deltaPoof;
  p.x+=p.vx*deltaPoof;p.z+=p.vz*deltaPoof;
  p.y+=p.vy*deltaPoof;p.vy-=8*deltaPoof;
  const life=Math.max(0,1-p.age/p.life),r=(p.green?.20:.43)*(1+.7*(1-life));
  const color=p.green?'#6d9b7b':'#d9b9a3';
  tri(bits,[p.x,p.y+r,p.z-origin],[p.x-r,p.y-r,p.z-origin],
           [p.x+r,p.y-r,p.z-origin],color,Math.max(.2,life));
}
this.poofs=this.poofs.filter(p=>p.age<p.life);
this.update(this.poofMesh,bits);
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
gl.depthMask(false);gl.uniform1f(this.opacity,.67);draw(this.poofMesh);
gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(this.opacity,1);
gl.disableVertexAttribArray(this.pos);gl.disableVertexAttribArray(this.col);this.frames++;}
inspect(){return {renderer:'native WebGL perspective + depth buffer',frames:this.frames,drawCalls:this.drawCalls,residentChunks:this.chunks.size,worldTriangles:[...this.chunks.values()].reduce((s,c)=>s+c.count/3,0),glError:this.gl.getError()}}
}
