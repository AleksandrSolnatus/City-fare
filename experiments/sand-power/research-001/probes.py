#!/usr/bin/env python3
"""CITY FARE: Sand Power — research 001, disposable numerical probes.

Not a game, a granular physics solver, or evidence of enjoyable controls.
No network, game imports, checkpoint edits, rendering or deployment.
Requires Python 3.10+ and NumPy. Writes results.json next to this file.
"""
from __future__ import annotations
import hashlib
import json
import math
from pathlib import Path
import platform
from typing import Any
import numpy as np

ROOT = Path(__file__).resolve().parent


def digest(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(raw.encode()).hexdigest()


def scale_probe() -> dict[str, Any]:
    """Explicit design values; pinhole projection is not a perceptual user test."""
    v, rider, height, fovy = 24.0, 1.8, 720, math.radians(55)
    rows = []
    for length in (120., 200., 300.):
        diameter, radius = length / 10, .6 * length
        rows.append(dict(length_m=length, diameter_m=diameter,
                         speed_mps=v, body_passage_s=length/v,
                         turn_radius_m=radius,
                         seconds_for_90deg_turn=math.pi * radius / (2*v)))
    pixels = []
    for distance in (60., 90., 180., 400.):
        px = height*rider/(2*distance*math.tan(fovy/2))
        pixels.append(dict(camera_distance_m=distance, rider_pixels=px))
    return dict(assumptions=dict(speed_mps=v, rider_height_m=rider,
                                viewport_height_px=height, vertical_fov_deg=55),
                sizes=rows, rider_projection=pixels,
                limits="Frontal pinhole projection; no occlusion, cloak, antialiasing, phone UI, or perception test.")


def shape_probe() -> dict[str, Any]:
    """Compare naive sideways offsets with equal-length tangent integration."""
    rows=[]
    n=128
    for length in (120.,200.,300.):
        ds=length/n
        for ratio in (.05,.10,.20):
            errors=[]; fixed_errors=[]
            for phase in np.linspace(0,2*math.pi,32,endpoint=False):
                s=np.linspace(0,length,n+1)
                y=ratio*length*np.sin(2*math.pi*s/length-phase)
                naive=float(np.hypot(np.diff(s),np.diff(y)).sum())
                errors.append(naive/length-1)
                smid=(s[:-1]+s[1:])/2
                angles=np.arctan(2*math.pi*ratio*np.cos(2*math.pi*smid/length-phase))
                delta=ds*np.column_stack((np.cos(angles),np.sin(angles)))
                points=np.vstack((np.zeros(2),np.cumsum(delta,axis=0)))
                actual=np.linalg.norm(np.diff(points,axis=0),axis=1)
                fixed_errors.append(float(np.max(np.abs(actual-ds))/ds))
            rows.append(dict(length_m=length, amplitude_to_length=ratio,
                             naive_max_length_growth_percent=100*max(errors),
                             equal_segment_max_relative_error=max(fixed_errors)))
    # A fixed temporal delay at a nominal speed changes apparent body length.
    temporal=[]
    for speed in (12.,24.,36.):
        nominal=24.; length=200.
        temporal.append(dict(speed_mps=speed,
                             time_delay_body_length_m=speed*length/nominal,
                             distance_spaced_body_length_m=length))
    return dict(samples=3*3*32, nodes=n+1, shape_comparisons=rows,
                fixed_time_delay_comparison=temporal,
                limits="Kinematic length only. Does not test thrust, self-collision, contacts, inertia, or fun. A path-following chain alone is not sand swimming.")


def terrain_probe() -> dict[str, Any]:
    """Kinematic cut+deposit brush and explicitly uncalibrated repose relaxation.

    Constant bulk packing, fixed bedrock, closed boundary, no airborne mass,
    cavity, buried body volume, compaction, grain velocity, or calibrated forces.
    """
    n, dx, dt = 96, 2., 1/60
    x=(np.arange(n)-(n-1)/2)*dx
    X,Z=np.meshgrid(x,x,indexing='xy')
    initial=25+3*np.sin(X/30)+2*np.cos(Z/36)
    area=dx*dx
    h=initial.copy()
    excavated=0.; rejected=0
    # Cut only available material and place exactly that volume into side berms.
    for z0 in np.linspace(-60,60,61):
        x0=9*math.sin(z0/35)
        u=(X-x0)/7.; w=(Z-z0)/4.
        requested=.28*np.exp(-.5*(u*u+w*w))
        requested[(u*u+w*w)>9]=0
        removed=np.minimum(h,requested)
        weights=np.exp(-.5*(((np.abs(X-x0)-13)/3)**2+((Z-z0)/6)**2))
        weights[np.abs(X-x0)<9]=0
        total=float(weights.sum())
        if total<=0:
            rejected+=1
            continue
        q=float(removed.sum())
        h-=removed
        h+=q*weights/total
        excavated+=q*area
    after_brush=h.copy()
    # Build every edge once, including diagonals to expose/check orientation limits.
    ids=np.arange(n*n).reshape(n,n)
    edges=[]
    for oy,ox in ((0,1),(1,0),(1,1),(1,-1)):
        ay=slice(0,n-oy); by=slice(oy,n)
        ax=slice(max(0,-ox),min(n,n-ox)); bx=slice(max(0,ox),min(n,n+ox))
        edges.append((ids[ay,ax].ravel(),ids[by,bx].ravel(),dx*math.hypot(ox,oy)))
    p=np.concatenate([e[0] for e in edges]); q=np.concatenate([e[1] for e in edges])
    dist=np.concatenate([np.full(len(e[0]),e[2]) for e in edges])
    angle=32.; threshold=math.tan(math.radians(angle))*dist
    flat=h.ravel(); initial_volume=float(initial.sum()*area)
    worst_budget_error=abs(float(flat.sum()*area)-initial_volume)
    def max_slope(a: np.ndarray) -> float:
        return math.degrees(math.atan(float(np.max(np.abs(a[p]-a[q])/dist))))
    peak_before=max_slope(flat)
    # A synthetic pile adds no sand; exchange from a surrounding annulus first.
    # Used separately below so we do not pretend the worm makes this test mound.
    for tick in range(240):
        difference=flat[p]-flat[q]
        donors=np.where(difference>=0,p,q); receivers=np.where(difference>=0,q,p)
        amount=np.maximum(0,np.abs(difference)-threshold)*(3.0*dt)
        totals=np.bincount(donors,weights=amount,minlength=n*n)
        scale=np.minimum(1,np.divide(flat,totals,out=np.ones_like(flat),where=totals>0))
        amount*=scale[donors]
        update=np.bincount(receivers,weights=amount,minlength=n*n)-np.bincount(donors,weights=amount,minlength=n*n)
        flat+=update
        worst_budget_error=max(worst_budget_error,abs(float(flat.sum()*area)-initial_volume))
        if not np.isfinite(flat).all() or flat.min() < -1e-10:
            raise AssertionError('Nonfinite or negative bulk sand')
    saved=json.dumps(flat.tolist(),allow_nan=False,separators=(',',':'))
    decoded=np.array(json.loads(saved))
    exact_restore=np.array_equal(flat,decoded)
    # Four explicit contract checks, not broad physics validation.
    assert worst_budget_error<1e-6
    assert flat.min()>=0
    assert exact_restore
    assert float(flat.max())>float(initial.max()) or np.any(flat>initial.ravel()+.1)
    delta=flat.reshape(n,n)-initial
    return dict(grid=[n,n],cell_width_m=dx,steps=240,simulation_step_s=dt,
                authored_repose_angle_deg=angle,brush_stamp_count=61,
                rejected_stamps=rejected,cumulative_redistributed_bulk_m3=excavated,
                initial_bulk_m3=initial_volume,
                max_bulk_budget_error_m3=worst_budget_error,
                peak_local_neighbor_slope_before_settling_deg=peak_before,
                peak_local_neighbor_slope_after_settling_deg=max_slope(flat),
                max_depression_m=float(-delta.min()),max_berm_m=float(delta.max()),
                cells_changed_more_than_10cm=int(np.count_nonzero(abs(delta)>.1)),
                exact_json_state_roundtrip=bool(exact_restore),
                resulting_state_sha256=hashlib.sha256(flat.tobytes()).hexdigest(),
                limits="Surface accounting probe only: not a tunnel or worm-displacement solution; nominal seconds do not claim calibrated avalanche timing. No browser or phone performance tested.")


def settle_probe() -> dict[str, Any]:
    """1D discrete column slump; time step sensitivity and conservation diagnostic."""
    dx=2.; n=81; x=(np.arange(n)-n//2)*dx
    initial=10+20*np.maximum(0,1-abs(x)/12)
    target=math.tan(math.radians(32))*dx
    out=[]
    for dt in (1/30,1/60,1/120):
        h=initial.copy(); start=float(h.sum()*dx)
        for k in range(round(8/dt)):
            diff=np.diff(h)
            left=np.arange(n-1); right=left+1
            donor=np.where(diff>0,right,left); recv=np.where(diff>0,left,right)
            requested=np.maximum(0,abs(diff)-target)*3*dt
            totals=np.bincount(donor,weights=requested,minlength=n)
            scale=np.minimum(1,np.divide(h,totals,out=np.ones_like(h),where=totals>0))
            amount=requested*scale[donor]
            h+=np.bincount(recv,weights=amount,minlength=n)-np.bincount(donor,weights=amount,minlength=n)
        out.append(dict(dt_s=dt,initial_max_slope_deg=math.degrees(math.atan(float(abs(np.diff(initial)).max())/dx)),
                        final_max_slope_deg=math.degrees(math.atan(float(abs(np.diff(h)).max())/dx)),
                        conservation_error_m2=abs(float(h.sum()*dx)-start),min_height_m=float(h.min()),
                        final_heights=h.tolist()))
    a=np.array(out[1]['final_heights']); b=np.array(out[2]['final_heights'])
    max_difference=float(abs(a-b).max())
    assert max(o['conservation_error_m2'] for o in out)<1e-8
    for o in out: o.pop('final_heights')
    return dict(cases=out,dt60_vs_dt120_max_height_difference_m=max_difference,
                limits="Authored overdamped relaxation; no momentum, material calibration, or 3D/diagonal symmetry certification.")


def main() -> None:
    result=dict(study='CITY FARE: Sand Power / Research 001',
                kind='disposable numerical diagnostics — not gameplay',
                environment=dict(python=platform.python_version(),numpy=np.__version__),
                scale=scale_probe(),body=shape_probe(),terrain=terrain_probe(),settling=settle_probe())
    repeated=terrain_probe()
    assert digest(result['terrain'])==digest(repeated), 'Identical repeated run differed'
    result['terrain']['identical_repeat_summary']=True
    result['status']='COMPLETED; scoped assertions passed; no game build or playtest'
    result['source_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    output=ROOT/'results.json'
    output.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    main()
