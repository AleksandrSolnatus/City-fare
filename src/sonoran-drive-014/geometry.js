/* Shared original armour surfaces. Rendering and collision use the same geometry. */
(function(root){'use strict';
const TAU=Math.PI*2,mix=(a,b,t)=>a+(b-a)*t;
// Shared orthonormal section frame. Pitch belongs to the body, including its
// solar tissue; neither a view-facing billboard nor an independent animation.
function sectionFrame(a,b){
 const dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z,L=Math.hypot(dx,dy,dz),h=Math.hypot(dx,dy);
 if(L<1e-8)return {forward:[1,0,0],right:[0,1,0],up:[0,0,1]};
 const forward=[dx/L,dy/L,dz/L],right=h>1e-8?[-dy/h,dx/h,0]:[0,1,0];
 const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]].map(v=>-v);
 return {forward,right,up};
}
function headSpan(r){return r*1.55;}
function bodyLength(sections,i){const a=sections[Math.max(0,i-1)],b=sections[Math.min(sections.length-1,i+1)];return Math.max(8,Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/2);}
// Analytic enclosing sphere for broadphase only. It cannot itself award damage.
// Head max vertex distance <1.7r; fins lie inside a 1.8r transverse disk.
function sectionBound(sections,i){return i===0?sections[i].r*2:Math.hypot(bodyLength(sections,i)*.7,sections[i].r*1.8);}
function headMesh(head,next){
 const {forward,right,up}=sectionFrame(head,next),scale=head.r/20;
 const at=v=>v.map((_,k)=>[head.x,head.y,head.z][k]+scale*(forward[k]*v[0]+right[k]*v[1]+up[k]*v[2]));
 const faces=[],add=(v,color,label,finish)=>faces.push({vertices:v.map(at),color,label,...(finish?{finish}:{})});
 // Hammer Crown: swept lateral digging lobes, a high central keel and no eyes.
 // A single closed shell owns every plate. The widest part is 62m across at r20.
 // Cross sections are convex; nonplanar connections are explicitly triangulated.
 const profiles=[[-14,18,13,0],[-4,24,21,0],[8,31,12,-1],[18,28,6,-3],[24,18,3.5,-3]];
 const cross=[[0,1],[.35,.96],[.78,.6],[1,.03],[.82,-.55],[.35,-.83],[0,-.9],[-.35,-.83],[-.82,-.55],[-1,.03],[-.78,.6],[-.35,.96]];
 const rings=profiles.map(([x,w,h,z])=>cross.map(([y,v])=>[x,y*w,z+v*h]));
 const colors=['#476770','#55747a','#3c5962','#263c49','#1c303a','#192a33','#1b2c35','#233b44','#36545f','#486873','#56777c','#4d7076'];
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<cross.length;j++){
  const k=(j+1)%cross.length,a=rings[i][j],b=rings[i+1][j],c=rings[i+1][k],d=rings[i][k];
  // Copper mineral in the centre, cool side lobes, ivory on the worn leading edge.
  const edge=i===3&&(j===1||j===2||j===3||j===8||j===9||j===10),keel=(j===0||j===11)&&i<3;
  const color=edge?'#d9c49b':keel?(i===1?'#ae8957':'#8b8060'):colors[j];
  // All structural triangles remain in the shell for exact inside/outside tests.
  add([a,b,c],color,'crown',edge?'ivory':keel?'mineral':undefined);add([a,c,d],color,'crown',edge?'ivory':keel?'mineral':undefined);
 }
 add([...rings[0]].reverse(),'#273b44','rear-cap');add(rings.at(-1),'#b9a27d','nose-cap');
 // Recessed lower feeding seam: beneath the blunt ivory nose, never eye-like.
 add([[24.08,-12,-3.9],[24.08,12,-3.9],[24.08,11,-4.5],[24.08,-11,-4.5]],'#10242c','mouth-seam');
 // Separate raised lip facets have finite thickness and no coplanar overlays.
 for(const side of[-1,1]){
  add([[18,side*27.8,-3.1],[24,side*17.9,-3.1],[24.2,side*17.8,-2.5]],'#e0cba2','ivory-lip');
  add([[18,side*27.8,-3.1],[24.2,side*17.8,-2.5],[18.1,side*27.5,-2.3]],'#c9b48b','ivory-lip');
 }
 return faces;
}
function bodyMesh(sections,i){
 const p=sections[i],a=sections[Math.max(0,i-1)],b=sections[Math.min(sections.length-1,i+1)],{forward,right,up}=sectionFrame(a,b),length=bodyLength(sections,i);
 const at=(u,v,z)=>[p.x,p.y,p.z].map((q,k)=>q+forward[k]*u+right[k]*v+up[k]*z),faces=[];
 const face=(vertices,color,label)=>faces.push({vertices:vertices.map(v=>at(...v)),color,label});
 for(let j=0;j<8;j++){const t=j*TAU/8,u=(j+1)*TAU/8;face([[-length*.52,Math.cos(t)*p.r,Math.sin(t)*p.r],[length*.52,Math.cos(t)*p.r,Math.sin(t)*p.r],[length*.52,Math.cos(u)*p.r,Math.sin(u)*p.r],[-length*.52,Math.cos(u)*p.r,Math.sin(u)*p.r]],['#48545b','#56626a','#39434e','#293541','#26323e','#343e4b','#39434f','#46515b'][j],'armour');}
 if(i===sections.length-1)faces.push({vertices:faces.slice(0,8).map(f=>f.vertices[0]).reverse(),color:'#293541',label:'tail-cap'});
 if(i%2===0)for(const side of[-1,1])face([[length*.4,side*p.r*.25,p.r*.67],[-length*.5,side*p.r*.55,p.r*.8],[-length*.3,side*p.r*.15,p.r*.65]],'#ddd3ad','ivory');
 if(i%4===1)face([[-length*.4,-p.r*.65,p.r*.62],[-length*.28,-p.r*.65,p.r*.64],[length*.25,p.r*.65,p.r*.64],[length*.12,p.r*.65,p.r*.62]],'#a79065','mineral-band');
 // Paired sun-collecting crystalline frills. Faceted lamellae with ivory ribs.
 // Solar symbiont colonies are authored worldbuilding, not an energy calculation.
 // A gradual rear taper leaves an unbroken dark tail silhouette.
 if(i>=2&&i<Math.floor(sections.length*.82)&&i%3===2){
  const taper=Math.min(1,(sections.length*.86-i)/12),r=p.r,L=length;
  for(const side of[-1,1]){
   const root=[L*.43,side*r*.27,r*.87],heel=[-L*.53,side*r*.29,r*.86];
   const upper=[L*.18,side*r*(.37+.1*taper),r*(1.05+.43*taper)],tip=[-L*.34,side*r*(.55+.23*taper),r*(1.02+.27*taper)],rear=[-L*.65,side*r*.49,r*1.0];
   const middle=[-L*.07,side*r*.44,r*(1+.24*taper)];
   // This is actual contact geometry, kept attached to its supported section.
   face([root,upper,middle],side<0?'#6f9a88':'#b28b58','solar-frill');
   face([upper,tip,middle],side<0?'#4f817b':'#9c7850','solar-frill');
   face([tip,rear,middle],side<0?'#3f676b':'#76674d','solar-frill');
   face([rear,heel,middle],'#425a59','solar-frill');
   face([heel,root,middle],'#344f55','solar-frill');
   // Two shallow triangular struts sit on the lit/front side of the membrane.
   // Their raised middle is a geometric rib, not a coplanar painted line.
   const rib=(a,b)=>{const mid=a.map((v,k)=>(v+b[k])*.5);mid[0]+=r*.04;face([a,b,mid],'#d2bc8f','frill-rib');};
   rib(root,upper);rib(upper,tip);
  }
 }
 return faces;
}
function sectionMesh(sections,i){return i===0&&sections.length>1?headMesh(sections[0],sections[1]):bodyMesh(sections,i);}
// Same finite heightfield clipping is used for visibility and contact witnesses.
function clipGround(raw,ground){
 const out=[];for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],da=a[2]-ground(a[0],a[1]),db=b[2]-ground(b[0],b[1]);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){let lo=0,hi=1;for(let j=0;j<12;j++){const u=(lo+hi)/2,v=a.map((n,k)=>mix(n,b[k],u));if((v[2]-ground(v[0],v[1])>=0)===(da>=0))lo=u;else hi=u;}const v=a.map((n,k)=>mix(n,b[k],(lo+hi)/2));v[2]=Math.max(v[2],ground(v[0],v[1])+.01);out.push(v);}}return out;
}

function skimmerMesh(c){
 const faces=[];
  const box=(x,y,z,dx,dy,h,colors,kind='world',yaw=0)=>{const cs=Math.cos(yaw),sn=Math.sin(yaw),p=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*dx/2*cs-b*dy/2*sn,y+a*dx/2*sn+b*dy/2*cs,z+c*h]);for(const [ids,col] of [[[0,1,5,4],colors[0]],[[1,2,6,5],colors[1]],[[2,3,7,6],colors[1]],[[3,0,4,7],colors[0]],[[4,5,6,7],colors[2]]])faces.push({vertices:ids.map(i=>p[i]),color:col,label:'skimmer'});};
  const cs=Math.cos(c.yaw||0),sn=Math.sin(c.yaw||0),at=(x,y,z)=>[c.x+cs*x-sn*y,c.y+sn*x+cs*y,c.z+z];
  const ship=(v,color)=>faces.push({vertices:v.map(p=>at(...p)),color,label:'skimmer'});
  for(const side of[-1,1]){
   const v=[[3.5,side*.65,-.05],[2.7,side*1.9,-.15],[-2.6,side*1.85,-.25],[-3.1,side*1.1,-.35],[.4,side*.8,.36]];
   ship(v,'#e7d9b6');ship([v[1],v[2],[-2.7,side*1.85,-.8],[2.6,side*1.9,-.55]],'#a26c47');
   ship([[2.7,side*1.9,-.15],[-2.6,side*1.85,-.25],[-2.1,side*1.4,.35],[1.5,side*1.45,.45]],'#d4b77b');
   ship([[-1.8,side*1.87,-.2],[-2.5,side*1.87,-.25],[-2.5,side*1.87,-.65],[-1.8,side*1.87,-.6]],'#547f85');
  }
  ship([[-2.6,-1.1,-.15],[-2.6,1.1,-.15],[1.4,1,.2],[1.4,-1,.2]],'#bd8c56');
  ship([[1.7,-.7,.25],[1.7,.7,.25],[.15,.65,1.18],[.15,-.65,1.18]],'#42646b');
  ship([[.15,-.65,1.18],[.15,.65,1.18],[-1.05,.7,.65],[-1.05,-.7,.65]],'#eee0bd');
  ship([[1.7,-.7,.25],[.15,-.65,1.18],[-1.05,-.7,.65],[-.8,-.9,.1]],'#78969b');
  ship([[1.7,.7,.25],[.15,.65,1.18],[-1.05,.7,.65],[-.8,.9,.1]],'#35535d');
  for(const side of[-1,1]){const p=at(-2.6,side*.68,-.15);box(...p,.8,.65,.65,['#775144','#443c3d','#be8b60'],'ship',c.yaw);ship([[-3.04,side*.68-.22,-.05],[-3.04,side*.68+.22,-.05],[-3.04,side*.68+.22,.25],[-3.04,side*.68-.22,.25]],c.boosting?'#b5e8df':'#73a9ac');}
  const cargo=at(-1.65,0,.15);box(...cargo,1,.9,.65,['#a17b53','#715c47','#c6a775'],'ship',c.yaw);
 return faces;
}
const api={headMesh,bodyMesh,sectionMesh,sectionFrame,sectionBound,headSpan,clipGround,skimmerMesh};root.SDGeometry=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
