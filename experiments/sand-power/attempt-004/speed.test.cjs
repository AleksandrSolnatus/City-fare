const assert = require('node:assert/strict');
const fs = require('node:fs');
const {Body, DT} = require('./body.js');
const {Route} = require('./route.js');
// 003's exact default tuning. The horizontal solver, mass, timestep and scale
// are unchanged in 004, so restoring these values reproduces that baseline.
const previous = {force:22, power:14, rate:2, drag:.10};
function ride(tune, surge) {
  const body = new Body({depth:true, ...tune});
  let sustained = 0, samples = 0, firstFive = 0;
  for (let i = 0; i < 30 / DT; i++) {
    body.step({surge});
    if (i === 5 / DT - 1) firstFive = body.distance;
    if (i >= 20 / DT) {sustained += body.inspect().speed; samples++;}
  }
  return {distance:body.distance, meanSpeed20to30:sustained/samples, firstFive};
}
const cruise = {previous:ride(previous,false), current:ride({},false)};
const surge = {previous:ride(previous,true), current:ride({},true)};
for (const run of [cruise,surge]) {
  run.distanceRatio = run.current.distance / run.previous.distance;
  assert.ok(run.distanceRatio > 2, 'actual travel must at least double');
}
assert.ok(surge.current.firstFive > surge.previous.firstFive * 2, 'startup must feel faster too');
const coast = new Body({depth:true});
for (let i = 0; i < 10/DT; i++) coast.step({surge:true});
const beforeCoast = coast.inspect().speed;
for (let i = 0; i < 5/DT; i++) coast.step({coast:true});
assert.ok(coast.inspect().speed < beforeCoast * .1, 'coast must still shed speed');
const body = new Body({depth:true}), route = new Route(), signals = [];
for (let i = 0; i < 30/DT && route.count < 2; i++) {
  const q = body.shape(), c = body.com();
  const heading = Math.atan2(q[2].y-q[20].y,q[2].x-q[20].x);
  const bearing = Math.atan2(route.target.y-c.y,route.target.x-c.x);
  const delta = Math.atan2(Math.sin(bearing-heading),Math.cos(bearing-heading));
  body.step({surge:true, right:delta>.12, left:delta<-.12, dive:route.target.kind==='dive'});
  if(route.step(body)) signals.push(body.time);
}
assert.equal(route.count,2,'surface and buried signals must remain reachable');
const report = {units:'unchanged model units; travelled distance, not straight-line displacement',previousTuning:previous,currentTuning:new Body().tune,cruise,surge,coast:{before:beforeCoast,afterFive:coast.inspect().speed},signalTimes:signals};
fs.mkdirSync(__dirname+'/evidence',{recursive:true});
fs.writeFileSync(__dirname+'/evidence/speed-results.json',JSON.stringify(report,null,2)+'\n');
console.log(`PASS actual cruise travel ${cruise.distanceRatio.toFixed(2)}x; surge travel ${surge.distanceRatio.toFixed(2)}x; faster startup, coast and two-signal route`);
