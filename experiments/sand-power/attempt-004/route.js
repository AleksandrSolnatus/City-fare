/* Targets observe real centre-of-mass travel. They never apply movement forces. */
(function(root){'use strict';
class Route{
 constructor(){this.count=0;this.target={x:8,y:.2,kind:'surface',index:1,radius:1.8};}
 step(body){const c=body.com(),q=body.shape(),buried=q.filter((p,i)=>body.h[i]+p.r<body.ground(p.x,p.y)).length;
 const near=Math.hypot(c.x-this.target.x,c.y-this.target.y)<this.target.radius;
 const depthOK=this.target.kind==='dive'?buried>=8:buried<6;
 if(!near||!depthOK)return false;
 this.count++;const a=Math.atan2(q[2].y-q[20].y,q[2].x-q[20].x)+Math.sin(this.count*1.7)*.25;
 this.target={x:c.x+Math.cos(a)*8,y:c.y+Math.sin(a)*8,kind:body.gait==='lateral'||this.count%2===0?'surface':'dive',index:this.count+1,radius:1.8};return true;}
}
root.SandRoute=Route;if(typeof module!=='undefined')module.exports={Route};
})(typeof globalThis!=='undefined'?globalThis:this);
