// City Fare 009 — intentionally small, deterministic arcade-aerodynamics model.
// SI units throughout. Geometry parameters are exposed for experiments, not presented
// as measured real-car coefficients.
export const AERO = Object.freeze({
  mass: 1250, airDensity: 1.2, bodyCdA: .55, wingCdA: .13,
  floorClA: .16, wingClA: 1.55, power: 560000,
  maxDriveForce: 12500, brakeForce: 17000,
  roadFriction: 1.30, sandFriction: .62, gravity: 9.81,
});
const aeroClamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function activeWing(speed) {
  // Wing starts extending as speed rises; more grip costs drag.
  return aeroClamp((speed-22)/80,0,1);
}
export function windAt(x,z) {
  // A repeatable wind FIELD, not a random impulse each animation frame.
  return {x: 4.1*Math.sin(z/950+.31*Math.sin(x/1400)),
          z: 2.3*Math.cos(z/1700+x/2500)};
}
export function aeroForces(speed,angle,x,z,wing=activeWing(speed),spec=AERO) {
  const wind=windAt(x,z), along=Math.sin(angle)*wind.x+Math.cos(angle)*wind.z;
  const across=Math.cos(angle)*wind.x-Math.sin(angle)*wind.z;
  const longitudinal=speed-along, apparent=Math.hypot(longitudinal,across);
  const q=.5*spec.airDensity*apparent*apparent;
  // Project aerodynamic drag onto forward car motion. Wind does not
  // spontaneously drive a stopped car backward in this arcade model.
  const drag=q*(spec.bodyCdA+spec.wingCdA*wing)*
    Math.max(0,longitudinal)/Math.max(1,apparent);
  const downforce=q*(spec.floorClA+spec.wingClA*wing);
  return {wind,along,across,apparent,drag,downforce,wing};
}
export function vehicleForces(speed,angle,x,z,sand=0,spec=AERO) {
  const aero=aeroForces(speed,angle,x,z,activeWing(speed),spec);
  const surface=aeroClamp(sand,0,1);
  const mu=spec.roadFriction*(1-surface)+spec.sandFriction*surface;
  const lateralGrip=mu*(spec.gravity+aero.downforce/spec.mass);
  const traction=spec.mass*lateralGrip;
  const drive=Math.min(spec.maxDriveForce, traction,
    spec.power/Math.max(speed,18));
  // Sand loss grows with speed instead of applying an arbitrary sand speed cap.
  const resistance=155+surface*(850+.38*speed*speed);
  const acceleration=(drive-aero.drag-resistance)/spec.mass;
  const braking=(Math.min(spec.brakeForce,traction)-aero.drag-resistance)/spec.mass;
  return {...aero, mu,lateralGrip,drive,resistance,acceleration,
          braking:-Math.max(0,-braking) - 2*Math.min(0,braking)};
}
