/* CITY FARE: Sand Power · Motion 001
 * A reduced 2D tissue-strip experiment, not an anatomical or calibrated sand model.
 * Two material sides, passive elasticity, area resistance, antagonistic muscle
 * force-pairs and local anisotropic drag. No head force or prescribed forward speed.
 */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const N=25, DS=.5, DT=1/240;
class Body {
 constructor(o={}) {
  this.n=N;this.dt=DT;this.time=0;this.phase=0;this.effort=0;this.lean=0;
  this.tune={force:o.force??22,rate:o.rate??2,drag:o.drag??.10,power:o.power??14,diag:o.diag??10};this.stiff=o.stiff??1;this.massScale=o.mass??1;this.contact=o.contact??1;
  this.dragRatio=o.dragRatio??9;this.depthEnabled=o.depth??false;this.burial=0;this.rise=0;this.wasDive=false;this.h=[];this.vh=[];this.p=[];this.links=[];this.cells=[];
  this.stats={power:0,motorCap:0,finite:true};this.distance=0;
  for(let i=0;i<N;i++){
   const s=i/(N-1),r=.13+.33*Math.pow(Math.sin(Math.PI*(.10+.87*s)),.45);
   this.h.push(this.ground(6-i*DS,0)-r*.2);this.vh.push(0);
   for(let side=0;side<2;side++)this.p.push({x:6-i*DS,y:(side?1:-1)*r,vx:0,vy:0,m:.075*this.massScale,fx:0,fy:0,r,cover:0,contact:1});
  }
  const link=(a,b,k,c,kind='passive',u=0)=>{const p=this.p[a],q=this.p[b];this.links.push({a,b,l:Math.hypot(q.x-p.x,q.y-p.y),k,c,kind,u});};
  for(let i=0;i<N;i++){
   link(2*i,2*i+1,110,.55);
   if(i<N-1){
    for(let s=0;s<2;s++)link(2*i+s,2*(i+1)+s,36,.25,'rail',(i+.5)/(N-1));
    link(2*i,2*(i+1)+1,this.tune.diag,.25);link(2*i+1,2*(i+1),this.tune.diag,.25);
    const ids=[2*i,2*i+1,2*i+3,2*i+2];
    let area=0;for(let j=0;j<4;j++){let a=this.p[ids[j]],b=this.p[ids[(j+1)%4]];area+=a.x*b.y-b.x*a.y;}
    this.cells.push({ids,area:area/2,u:(i+.5)/(N-1)});
   }
   if(i<N-2)for(let s=0;s<2;s++)link(2*i+s,2*(i+2)+s,9,.12,'bend',(i+1)/(N-1));
  }
  this.start=this.com();this.last=this.com();this.input={surge:false,left:false,right:false,coast:false};
 }
 ground(x,y){return .40*Math.sin(x*.22)+.32*Math.sin(y*.28+x*.10)+.13*Math.sin(y*.71-x*.09);}
 com(){let x=0,y=0,m=0;for(const p of this.p){x+=p.x*p.m;y+=p.y*p.m;m+=p.m;}return {x:x/m,y:y/m};}
 middle(u){return Math.exp(-Math.pow((u-.53)/.16,4));}
 force(a,b,f){const p=this.p[a],q=this.p[b],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1e-12;const fx=f*dx/l,fy=f*dy/l;p.fx+=fx;p.fy+=fy;q.fx-=fx;q.fy-=fy;}
 step(input=this.input){
  this.input=input;const dt=DT;
  if(this.depthEnabled)this.depthStep(input);
  const target=input.coast?0:(input.surge?1:.52);
  this.effort+=(target-this.effort)*(1-Math.exp(-dt*4));
  const turn=(input.right?1:0)-(input.left?1:0);
  this.lean+=(turn-this.lean)*(1-Math.exp(-dt*5));
  this.phase+=dt*(this.tune.rate*(.6+.4*this.effort))*this.effort;
  for(const p of this.p)p.fx=p.fy=0;
  let power=0,motorCap=0;
  for(const e of this.links){
   const a=this.p[e.a],b=this.p[e.b],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1e-12;
   const rel=((b.vx-a.vx)*dx+(b.vy-a.vy)*dy)/l;
   const rigid=1+(this.stiff-1)*this.middle(e.u);
   const k=e.k*(e.kind==='bend'?rigid:(e.kind==='rail'?Math.sqrt(rigid):1));
   this.force(e.a,e.b,k*(l-e.l)+e.c*Math.sqrt(Math.max(1,rigid))*rel);
   if(e.kind==='rail'){
    const side=e.a%2?1:-1;
    const wave=Math.sin(2*Math.PI*1.05*e.u-this.phase);
    const activation=clamp(.5+side*(.49*wave+.24*this.lean),0,1)*this.effort;
    // Active muscles contract only. Force and positive mechanical power are capped.
    let f=this.tune.force*activation;
    const shorten=-rel;
    if(shorten>0)f=Math.min(f,this.tune.power/Math.max(.001,shorten));
    this.force(e.a,e.b,f);power+=Math.max(0,f*shorten);motorCap=Math.max(motorCap,f);
   }
  }
  // Area penalty is a 2D surrogate for tissue/pressure resistance, not a fluid solver.
  for(const cell of this.cells){
   let area=0;const ids=cell.ids;
   for(let j=0;j<4;j++){const a=this.p[ids[j]],b=this.p[ids[(j+1)%4]];area+=a.x*b.y-b.x*a.y;}
   area*=.5;const k=260;const err=area-cell.area;
   for(let j=0;j<4;j++){const p=this.p[ids[j]],prev=this.p[ids[(j+3)%4]],next=this.p[ids[(j+1)%4]];
    p.fx-=k*err*(next.y-prev.y)/2;p.fy-=k*err*(prev.x-next.x)/2;
   }
  }
  // Non-neighbour cross sections repel. All reactions are pairwise internal.
  const sections=this.shape();
  for(let i=0;i<N;i++)for(let j=i+4;j<N;j++){
   const a=sections[i],b=sections[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   const reach=.85*(a.r+b.r);
   if(d>1e-9&&d<reach){
    const f=Math.min(30,55*(reach-d)),fx=f*dx/d/2,fy=f*dy/d/2;
    for(let side=0;side<2;side++){
     this.p[2*i+side].fx-=fx;this.p[2*i+side].fy-=fy;
     this.p[2*j+side].fx+=fx;this.p[2*j+side].fy+=fy;
    }
   }
  }
  // Finite forces change each tissue point's momentum. Contact acts at every point.
  for(let i=0;i<N;i++){
   let a=this.p[2*Math.max(0,i-1)],b=this.p[2*Math.min(N-1,i+1)];
   let tx=a.x-b.x,ty=a.y-b.y,tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;
   for(let s=0;s<2;s++){
    const p=this.p[2*i+s];let vx=p.vx+dt*p.fx/p.m,vy=p.vy+dt*p.fy/p.m;
    const c=this.contact*(p.contact??1)*this.tune.drag;
    let parallel=vx*tx+vy*ty,perp=-vx*ty+vy*tx;
    parallel/=1+dt*c/p.m;perp/=1+dt*c*this.dragRatio/p.m;
    p.vx=parallel*tx-perp*ty;p.vy=parallel*ty+perp*tx;
   }
  }
  for(const p of this.p){p.x+=p.vx*dt;p.y+=p.vy*dt;}
  this.time+=dt;
  const c=this.com();this.distance+=Math.hypot(c.x-this.last.x,c.y-this.last.y);this.last=c;
  this.stats.power=power;this.stats.motorCap=motorCap;
  this.stats.finite=this.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<1e6&&Math.abs(p.y)<1e6);
  if(!this.stats.finite)throw Error('Body integration became non-finite');
 }
 depthStep(input){
  const dt=DT,diving=!!input.dive;
  if(this.wasDive&&!diving)this.rise=.6;
  this.wasDive=diving;this.rise=Math.max(0,this.rise-dt);
  this.burial+=((diving?1:0)-this.burial)*(1-Math.exp(-dt*2.0));
  const q=this.shape(),acc=[];
  for(let i=0;i<N;i++){
   const p=q[i],g=this.ground(p.x,p.y),r=p.r;
   const frac=clamp((g-(this.h[i]-r))/(2*r),0,1);
   // This vertical controller is authored, finite and contact-gated. It is not
   // a solved 3D hydrostat or granular lift law; no invisible thrust in free air.
   const target=g-r*(.2+2.4*this.burial)+.06*Math.sin(this.phase-i*.16);
   const pressure=frac*clamp(22*(target-this.h[i])-5*this.vh[i]+1.5+this.rise*9,-10,12);
   let internal=0;
   if(i>0)internal+=7*(this.h[i-1]-this.h[i])+.6*(this.vh[i-1]-this.vh[i]);
   if(i<N-1)internal+=7*(this.h[i+1]-this.h[i])+.6*(this.vh[i+1]-this.vh[i]);
   acc.push(pressure-1.5+internal);
   for(let side=0;side<2;side++){
    const point=this.p[2*i+side];point.contact=frac*2;
    const topContact=clamp((g-(this.h[i]+.65*r))/(.6*r),0,1);
    point.cover=clamp(point.cover+dt*(2.5*topContact*(1-point.cover)-(.35+Math.abs(this.vh[i])*.6)*(1-topContact)*point.cover),0,1);
   }
  }
  for(let i=0;i<N;i++){this.vh[i]+=acc[i]*dt;this.h[i]+=this.vh[i]*dt;}
 }
 shape(){const pts=[];for(let i=0;i<N;i++){const l=this.p[2*i],r=this.p[2*i+1];pts.push({x:(l.x+r.x)/2,y:(l.y+r.y)/2,r:Math.hypot(l.x-r.x,l.y-r.y)/2});}return pts;}
 inspect(){let length=0;const q=this.shape();for(let i=1;i<q.length;i++)length+=Math.hypot(q[i].x-q[i-1].x,q[i].y-q[i-1].y);let vx=0,vy=0,m=0;for(const p of this.p){vx+=p.vx*p.m;vy+=p.vy*p.m;m+=p.m;}return {com:this.com(),speed:Math.hypot(vx,vy)/m,length,effort:this.effort,lean:this.lean,time:this.time,power:this.stats.power,motorCap:this.stats.motorCap};}
}
root.SandBody=Body;if(typeof module!=='undefined')module.exports={Body,DT};
})(typeof globalThis!=='undefined'?globalThis:this);
