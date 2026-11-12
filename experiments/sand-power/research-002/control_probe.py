#!/usr/bin/env python3
"""Sand Power Research 002: distributed actuation, momentum and coating.

Disposable normalized 2D mechanical diagnostic, NOT a game or sand solver.
Prescribed joint motion has no motor force/power limit. Resistance is a linear,
uncalibrated positive anisotropic law, NOT a measured granular constitutive law.
No vertical gravity, self-contact, dunes, renderer, deployment or live saves.
Requires Python >=3.10 and NumPy. Supply a NEW output directory to each run.
"""
from __future__ import annotations
import argparse
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import platform
import numpy as np


@dataclass(frozen=True)
class Spec:
    n: int = 40
    length: float = 1.0
    mass: float = 1.0
    along: float = 1.0
    across: float = 4.0
    contact: str = 'all'


def shape(phase: float, amplitude: float, bend: float, s: Spec):
    ds = s.length / s.n
    u = (np.arange(s.n) + .5) / s.n  # index 0=head, 1=tail
    angle = amplitude * np.sin(2*np.pi*u-phase) + bend*(u-.5)
    tangents = np.column_stack((np.cos(angle), np.sin(angle)))
    nodes = np.vstack((np.zeros(2), np.cumsum(ds*tangents, axis=0)))
    mid = .5*(nodes[:-1]+nodes[1:])
    origin = mid.mean(axis=0)
    return mid-origin, tangents, nodes-origin


def trace(spec: Spec, mode: str='straight', dt: float=1/120, duration: float=12.,
          initial_v=(0., 0.), full_trace: bool=False):
    phase=amp=bend=0.
    xy=np.zeros(2); yaw=0.; P=spec.mass*np.array(initial_v, dtype=float); H=0.
    prev=shape(phase, amp, bend, spec)[0]
    history=[]; worst=0.; len_error=0.; max_shape_h=0.; max_power=0.
    identity=np.eye(2); ds=spec.length/spec.n; mi=spec.mass/spec.n
    for k in range(round(duration/dt)):
        t=k*dt
        active=mode!='frozen'
        a_target=.62 if active else 0.
        turn=(.55 if mode=='left' else -.55 if mode=='right' else 0.)
        b_target=turn if t>=4. else 0.
        # Short intent smoothing: inertia is NOT implemented as input delay.
        amp += (a_target-amp)*(-np.expm1(-dt/.18))
        bend += (b_target-bend)*(-np.expm1(-dt/.18))
        if active: phase += 2*np.pi*.8*dt
        q,tangent,nodes=shape(phase,amp,bend,spec)
        w=(q-prev)/dt; prev=q
        len_error=max(len_error,float(np.max(np.abs(np.linalg.norm(np.diff(nodes,axis=0),axis=1)-ds))))
        jq=np.column_stack((-q[:,1],q[:,0]))
        I=mi*float(np.sum(q*q))
        shape_h=mi*float(np.sum(q[:,0]*w[:,1]-q[:,1]*w[:,0]))
        max_shape_h=max(max_shape_h,abs(shape_h))
        # Each segment sees resistance at its own tangent and material velocity.
        D=ds*(spec.across*identity[None,:,:]+(spec.along-spec.across)*np.einsum('ni,nj->nij',tangent,tangent))
        if spec.contact=='front-half': D[spec.n//2:]=0.
        elif spec.contact=='none': D[:]=0.
        c,sn=np.cos(yaw),np.sin(yaw)
        R=np.array([[c,-sn],[sn,c]])
        B=np.zeros((spec.n,2,3)); B[:,:,:2]=identity; B[:,:,2]=jq
        K=np.einsum('nai,nab,nbj->ij',B,D,B)
        g=np.einsum('nai,nab,nb->i',B,D,w)
        diag=np.diag([spec.mass,spec.mass,I])
        oldP=P.copy(); oldH=H
        # Angular momentum includes internal shape motion; dropping that term
        # would let motors invent total angular momentum when contact is absent.
        rhs=np.r_[R.T@P,H-shape_h]-dt*g
        rigid=np.linalg.solve(diag+dt*K,rhs)
        vel=rigid[:2]+rigid[2]*jq+w
        F=-np.einsum('nij,nj->ni',D,vel)
        torque=float(np.sum(q[:,0]*F[:,1]-q[:,1]*F[:,0]))
        P=R@(spec.mass*rigid[:2]); H=I*rigid[2]+shape_h
        residual=max(float(np.linalg.norm(P-oldP-dt*(R@F.sum(axis=0)))),abs(H-oldH-dt*torque))
        worst=max(worst,residual)
        power=float(np.sum(F*vel)); max_power=max(max_power,power)
        xy += dt*(P/spec.mass)
        yaw += dt*rigid[2]
        if k%max(1,round(.1/dt))==0 or k==round(duration/dt)-1:
            history.append([t+dt,float(xy[0]),float(xy[1]),float(yaw),float(np.linalg.norm(P/spec.mass)),float(H),float(bend)])
    arr=np.array(history)
    summary=dict(mode=mode,dt=dt,duration=duration,mass=spec.mass,contact=spec.contact,
                 along=spec.along,across=spec.across,final_com=xy.tolist(),final_yaw_rad=float(yaw),
                 final_speed=float(np.linalg.norm(P/spec.mass)),
                 max_discrete_momentum_residual=worst,max_segment_length_abs_error=len_error,
                 max_positive_environment_power=max_power,max_shape_angular_momentum=max_shape_h,
                 peak_lateral_com_displacement=float(np.max(np.abs(arr[:,2]))))
    assert np.isfinite(arr).all()
    assert worst<1e-10 and len_error<1e-12 and max_power<1e-12
    if full_trace: summary['trace_columns']=['t','x','y','yaw','speed','total_H','steering_bias']; summary['trace']=history
    return summary


def coating_fixture():
    """Isolated mass-transfer bookkeeping on 32 persistent material patches.

    Contact and orientation are PRESCRIBED test inputs, not collision output.
    1m^2 patches; at most 2mm authored coating; constant assumed bulk packing.
    Downward/sideways patches shed faster by an authored law, not material data.
    """
    n=32; area=1.; thickness=.002; cap=area*thickness
    stock=np.zeros(n); pool=.1; shed_total=0.; initial=pool
    patch_ids=np.arange(n); base_color=np.column_stack((patch_ids%5,patch_ids%7,patch_ids%11))
    base_digest=hashlib.sha256(base_color.tobytes()).hexdigest()
    norm_y=np.cos(np.arange(n)*2*np.pi/n)
    contact=np.zeros(n,dtype=bool); contact[:16]=True
    max_budget=0.; episodes=[]
    dt=1/120
    for k in range(120*8):
        t=k*dt
        touching=contact if t<2 else np.zeros(n,dtype=bool)
        desired=np.where(touching,np.maximum(0,cap-stock)*(-np.expm1(-dt*1.8)),0.)
        total=float(desired.sum()); accepted=desired*min(1,pool/total) if total else desired
        stock+=accepted; pool-=float(accepted.sum())
        # Near horizontal plate tops keep sand longer than steep/downturned ones.
        rate=.08+1.5*(1-np.maximum(0,norm_y))
        amount=np.where(touching,0.,stock*(-np.expm1(-dt*rate)))
        stock-=amount; shed_total+=float(amount.sum())
        max_budget=max(max_budget,abs(pool+float(stock.sum())+shed_total-initial))
        assert stock.min()>=0 and stock.max()<=cap+1e-12 and pool>=-1e-12
        if k in (239,479,959): episodes.append(dict(t=t+dt,coat_m3=float(stock.sum()),coverage=(stock/cap).tolist()))
    snapshot=dict(patch_ids=patch_ids.tolist(),base_color=base_color.tolist(),coating=stock.tolist(),
                  pool=pool,shed=shed_total,tick=960)
    restored=json.loads(json.dumps(snapshot,allow_nan=False))
    assert restored==snapshot
    assert np.all(stock[16:]==0),'Untouched patch must not invent coating'
    assert base_digest==hashlib.sha256(base_color.tobytes()).hexdigest()
    assert episodes[0]['coat_m3']>episodes[-1]['coat_m3']
    return dict(patches=n,contacted_patches=16,max_layer_m=thickness,initial_source_m3=initial,
                remaining_source_m3=pool,final_coating_m3=float(stock.sum()),shed_m3=shed_total,
                max_budget_error_m3=max_budget,base_colors_unchanged=True,untouched_patches_remained_clean=True,
                exact_json_roundtrip=True,snapshots=episodes,
                limits='No renderer or actual terrain/body contact; appearance and coating-rate validation remain open.')


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--out',type=Path,required=True); args=ap.parse_args()
    args.out.mkdir(parents=True,exist_ok=False)
    cases={}
    cases['no_contact']=trace(Spec(contact='none'),mode='left')
    cases['isotropic']=trace(Spec(along=1.,across=1.),mode='straight')
    cases['anisotropic']=trace(Spec(),mode='straight',full_trace=True)
    cases['left']=trace(Spec(),mode='left',full_trace=True)
    cases['right']=trace(Spec(),mode='right')
    cases['half_contact']=trace(Spec(contact='front-half'),mode='straight')
    cases['coast_mass1']=trace(Spec(mass=1.),mode='frozen',duration=3.,initial_v=(1.,0.))
    cases['coast_mass4']=trace(Spec(mass=4.),mode='frozen',duration=3.,initial_v=(1.,0.))
    cases['frozen_rest']=trace(Spec(),mode='frozen',duration=3.)
    cases['dt60']=trace(Spec(),mode='straight',dt=1/60)
    cases['dt240']=trace(Spec(),mode='straight',dt=1/240)
    assert np.linalg.norm(cases['no_contact']['final_com'])<1e-12
    assert np.linalg.norm(cases['isotropic']['final_com'])<1e-9
    assert np.linalg.norm(cases['anisotropic']['final_com'])>0.01
    assert cases['coast_mass4']['final_speed']>cases['coast_mass1']['final_speed']
    assert cases['frozen_rest']['final_speed']==0
    repeat=trace(Spec(),mode='left')
    assert repeat=={k:v for k,v in cases['left'].items() if k not in ('trace','trace_columns')}
    out=dict(study='CITY FARE: Sand Power / Research 002',kind='normalized diagnostic, not gameplay',
             environment=dict(python=platform.python_version(),numpy=np.__version__),cases=cases,
             same_process_repeat_exact=True,coating=coating_fixture(),
             source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
             limitations=['2D uncalibrated linear resistance, not a sand constitutive law',
                          'Actuated shape is prescribed, without motor torque or power limits',
                          'Normalized units; no biological mass, realistic speed or game feel claim',
                          'No vertical gravity, self-contact, dive, dunes, sand transport or rendering',
                          'No physical iPhone, independent review, or game modifications'])
    (args.out/'results.json').write_text(json.dumps(out,indent=2,allow_nan=False)+'\n')
    for name,result in cases.items():
        print(name,json.dumps({k:v for k,v in result.items() if k not in ('trace','trace_columns')}))
    print('coating',json.dumps({k:v for k,v in out['coating'].items() if k!='snapshots'}))


if __name__=='__main__': main()
