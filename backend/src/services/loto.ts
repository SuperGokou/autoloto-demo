import { Topology, LotoRequirement } from '../types';

interface ConnectedInfo {
  upstream: Array<{ id: string; pipe: string }>;
  downstream: Array<{ id: string; pipe: string }>;
}

export function getConnected(topology: Topology, cid: string): ConnectedInfo {
  const upstream: Array<{ id: string; pipe: string }> = [];
  const downstream: Array<{ id: string; pipe: string }> = [];

  for (const c of topology.connections) {
    const wire = c.pipe_id || c.wire_id || '';
    if (c.target === cid) {
      upstream.push({ id: c.source, pipe: wire });
    } else if (c.source === cid) {
      downstream.push({ id: c.target, pipe: wire });
    }
  }

  return { upstream, downstream };
}

export function getLockoutRequirements(topology: Topology, cid: string): LotoRequirement[] {
  const conn = getConnected(topology, cid);
  const compMap = new Map(topology.components.map((c) => [c.id, c]));
  const items: LotoRequirement[] = [];

  const selType = (compMap.get(cid)?.type || '').toLowerCase();

  if (selType.includes('capacitor')) {
    items.push({
      id: cid,
      type: 'lockout',
      action: 'DISCHARGE BEFORE CONTACT',
      reason: 'Capacitors can store lethal charge even after power is removed',
    });
  }

  if (selType.includes('transformer')) {
    items.push({
      id: cid,
      type: 'verification',
      action: 'ISOLATE BOTH PRIMARY AND SECONDARY',
      reason: 'Transformer can be energized from either winding',
    });
  }

  for (const u of conn.upstream) {
    const ut = (compMap.get(u.id)?.type || '').toLowerCase();
    if (['breaker', 'switch', 'disconnect', 'fuse'].some((k) => ut.includes(k))) {
      items.push({
        id: u.id,
        type: 'lockout',
        action: 'OPEN and LOCK OUT',
        reason: `Isolate incoming power to ${cid}`,
      });
    } else if (ut.includes('capacitor')) {
      items.push({
        id: u.id,
        type: 'verification',
        action: 'DISCHARGE and VERIFY',
        reason: 'Capacitor may store hazardous energy',
      });
    } else {
      items.push({
        id: `Power source for ${u.id}`,
        type: 'isolation',
        action: 'DISCONNECT and VERIFY ZERO ENERGY',
        reason: `Isolate power from ${u.id} to ${cid}`,
      });
    }
  }

  for (const d of conn.downstream) {
    const dt = (compMap.get(d.id)?.type || '').toLowerCase();
    if (dt.includes('capacitor')) {
      items.push({
        id: d.id,
        type: 'verification',
        action: 'DISCHARGE and VERIFY',
        reason: 'Downstream capacitor may store hazardous energy',
      });
    } else if (['motor', 'load'].some((k) => dt.includes(k))) {
      items.push({
        id: d.id,
        type: 'verification',
        action: 'VERIFY DE-ENERGIZED',
        reason: 'Confirm load is not energized from alternate source',
      });
    }
  }

  return items;
}
