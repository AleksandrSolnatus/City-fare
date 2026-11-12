/* Deterministic moving prey. Catching observes the exposed body; it never drives it. */
(function(root){'use strict';
class Hunt {
 constructor(){this.count=0;this.seed=123456789;this.prey=[0,1,2,3,4].map((id)=>({id,x:8+id*2,y:[0,2.4,-3.2,4.6,-1][id],phase:id*1.7,active:true,respawnAt:0}));}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 nearest(q,x,y){let best={distance:Infinity,index:0};for(let i=0;i<q.length;i++){const d=Math.hypot(x-q[i].x,y-q[i].y)-q[i].r;if(d<best.distance)best={distance:d,index:i};}return best;}
 spawn(p,body,q){const c=body.com();for(let tries=0;tries<12;tries++){const angle=this.random()*Math.PI*2,r=8+this.random()*6;p.x=c.x+Math.cos(angle)*r;p.y=c.y+Math.sin(angle)*r;if(this.nearest(q,p.x,p.y).distance>3)break;}p.phase=this.random()*Math.PI*2;p.active=true;}
 step(body){const q=body.shape(),c=body.com(),dt=body.dt;let caught=0;
  for(const p of this.prey){
   if(!p.active){if(body.time>=p.respawnAt)this.spawn(p,body,q);continue;}
   const nearest=this.nearest(q,p.x,p.y),section=q[nearest.index];
   const catchable=q.some((part,i)=>body.h[i]+part.r>body.ground(part.x,part.y)+.03&&Math.hypot(p.x-part.x,p.y-part.y)-part.r<.23);
   if(catchable){p.active=false;p.respawnAt=body.time+1.8;this.count++;caught++;continue;}
   if(Math.hypot(p.x-c.x,p.y-c.y)>42){p.active=false;p.respawnAt=body.time+.5;continue;}
   const flee=nearest.distance<3.1,angle=flee?Math.atan2(p.y-section.y,p.x-section.x):p.phase+body.time*.37;
   const wobble=Math.sin(body.time*5+p.phase)*.22,speed=flee?.95:.16;
   p.x+=Math.cos(angle+wobble)*speed*dt;p.y+=Math.sin(angle+wobble)*speed*dt;
  }
  return caught;
 }
 target(body){const c=body.com();return this.prey.filter(p=>p.active).reduce((best,p)=>!best||Math.hypot(p.x-c.x,p.y-c.y)<Math.hypot(best.x-c.x,best.y-c.y)?p:best,null);}
 snapshot(){return {count:this.count,seed:this.seed,prey:this.prey.map(p=>({...p}))};}
}
root.SandHunt=Hunt;if(typeof module!=='undefined')module.exports={Hunt};
})(typeof globalThis!=='undefined'?globalThis:this);
