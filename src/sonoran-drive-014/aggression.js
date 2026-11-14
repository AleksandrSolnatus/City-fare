/* Rare opt-in initiative, separate from the accepted vehicle/footstep response. */
(function(root){'use strict';
function roll(seed,window){let x=(seed^Math.imul(window+1,0x9e3779b1))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
class RareEncounter{
 constructor(seed){this.seed=seed;this.enabled=false;this.window=-1;this.triggered=false;this.events=[];}
 step(game){if(!this.enabled||this.triggered||game.time<180)return;const window=Math.floor((game.time-180)/120);if(window===this.window)return;this.window=window;
 const c=game.car,w=game.worm,distance=Math.hypot(c.x-w.head.x,c.y-w.head.y),chance=roll(this.seed,window),eligible=!game.parked&&w.state==='roam'&&w.cooldown===0&&distance>=800&&distance<=1250&&!game.world.safe(c.x,c.y,60)&&w.legal(c.x,c.y,10);
 const event={time:game.time,seed:this.seed,window,roll:chance,probability:1/64,eligible,triggered:eligible&&chance<1/64,head:{...w.head},car:{x:c.x,y:c.y,vx:c.vx,vy:c.vy,speed:c.speed},priorState:w.state,distance,cause:'rare spontaneous initiative; opt-in; at most once per outing'};this.events.push(event);if(this.events.length>80)this.events.shift();
 if(event.triggered){this.triggered=true;w.target={x:c.x,y:c.y};w.warningAge=0;w.change('telegraph');game.events.push({...event,type:'spontaneous-initiative'});}
 }
 snapshot(){return {enabled:this.enabled,seed:this.seed,window:this.window,triggered:this.triggered,events:this.events.map(e=>({...e,head:{...e.head},car:{...e.car}}))};}
}
const api={RareEncounter,roll};root.SDAggression=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
