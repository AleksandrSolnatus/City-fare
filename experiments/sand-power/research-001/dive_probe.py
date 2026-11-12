#!/usr/bin/env python3
"""Prescribed-path dive geometry only. Not a granular-force simulation."""
from __future__ import annotations
import hashlib
import json
import math
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent

def smooth5(u: np.ndarray) -> np.ndarray:
    a=np.clip(u,0,1)
    return a*a*a*(a*(6*a-15)+10)

def surface(x: np.ndarray,z: np.ndarray) -> np.ndarray:
    return 8+20*np.exp(-.5*((z-360)/70)**2)+.5*np.sin(x/30)

def run() -> dict:
    # Every position is world-space; the body is not snapped to the dune surface.
    t=np.arange(-20,40+1/240,1/240)
    z=24*t; x=10*np.sin(z*.006)
    y=2-30*smooth5((t-4)/5)+60*smooth5((t-13)/7)-30*smooth5((t-25)/7)
    p=np.column_stack((x,y,z))
    arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))]
    length=200.; segments=64; ds=length/segments; radius=10.
    records=[]; max_chord_error=0.; exposed_rider_burial_frames=0
    for now in np.arange(0,36,.25):
        head_arc=float(np.interp(now,t,arc))
        s=head_arc-np.linspace(0,length,segments+1)
        body=np.column_stack([np.interp(s,arc,p[:,i]) for i in range(3)])
        error=float(np.max(np.abs(np.linalg.norm(np.diff(body,axis=0),axis=1)-ds))/ds)
        max_chord_error=max(max_chord_error,error)
        h=surface(body[:,0],body[:,2])
        buried=body[:,1]+radius<h
        above=body[:,1]-radius>h
        crossing=~(buried|above)
        # A rider on the open crest, 24m behind the head, would be submerged.
        mount_s=head_arc-24
        mount=np.array([np.interp(mount_s,arc,p[:,i]) for i in range(3)])
        foot=mount[1]+radius
        clearance=foot-float(surface(mount[0],mount[2]))
        exposed_rider_burial_frames+=int(clearance<0)
        if now in (0.,6.,10.,15.,20.,25.,32.):
            records.append(dict(time_s=float(now),fully_buried_proxy_rings=int(buried.sum()),
                                surface_crossing_proxy_rings=int(crossing.sum()),
                                fully_above_proxy_rings=int(above.sum()),
                                open_rider_foot_clearance_m=clearance))
        assert np.isfinite(body).all()
    assert max_chord_error<.001
    assert exposed_rider_burial_frames>0
    assert any(r['fully_buried_proxy_rings'] and r['surface_crossing_proxy_rings'] for r in records)
    return dict(kind='prescribed kinematic path and surface intersection diagnostic',
                length_m=length,diameter_m=radius*2,segments=segments,
                nominal_forward_speed_mps=24,world_path_sample_dt_s=1/240,
                inspection_frames=144,max_relative_resampled_segment_chord_error=max_chord_error,
                open_rider_below_surface_frames=exposed_rider_burial_frames,snapshots=records,
                conclusion='A single continuous trajectory gives mixed above/below-ground body portions. A fully diving mount needs an explicit fictional rider refuge or an alternative rider rule.',
                limits='Prescribed, not force-derived. Vertical-radius proxies do not resolve exact inclined cross sections. No sand displaced, self-contact checked, camera rendered, or gameplay tested.')

if __name__=='__main__':
    r=run()
    r['source_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (ROOT/'dive-results.json').write_text(json.dumps(r,indent=2)+'\n')
    print(json.dumps(r,indent=2))
