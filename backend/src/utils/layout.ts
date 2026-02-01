import { Topology } from '../types';

interface LayoutNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

export function autoLayout(topology: Topology): LayoutNode[] {
  const components = topology.components;
  const connections = topology.connections;

  const children: Record<string, string[]> = {};
  const parents: Record<string, string[]> = {};

  for (const c of components) {
    children[c.id] = [];
    parents[c.id] = [];
  }

  for (const conn of connections) {
    if (children[conn.source] && parents[conn.target]) {
      children[conn.source].push(conn.target);
      parents[conn.target].push(conn.source);
    }
  }

  const roots = Object.keys(parents).filter((id) => parents[id].length === 0);
  if (roots.length === 0 && components.length > 0) {
    roots.push(components[0].id);
  }

  const layers: Record<string, number> = {};
  const queue: [string, number][] = roots.map((r) => [r, 0]);

  while (queue.length) {
    const [node, layer] = queue.shift()!;
    if (node in layers) {
      layers[node] = Math.max(layers[node], layer);
      continue;
    }
    layers[node] = layer;
    for (const child of children[node] || []) {
      queue.push([child, layer + 1]);
    }
  }

  for (const c of components) {
    if (!(c.id in layers)) layers[c.id] = 0;
  }

  const layerGroups: Record<number, string[]> = {};
  for (const [nid, layer] of Object.entries(layers)) {
    (layerGroups[layer] ??= []).push(nid);
  }

  const compMap = new Map(components.map((c) => [c.id, c]));
  const result: LayoutNode[] = [];
  const xGap = 220, yGap = 120;

  for (const layerIdx of Object.keys(layerGroups).map(Number).sort((a, b) => a - b)) {
    const nodesInLayer = layerGroups[layerIdx];
    const totalHeight = (nodesInLayer.length - 1) * yGap;
    const startY = 250 - totalHeight / 2;

    for (let i = 0; i < nodesInLayer.length; i++) {
      const nid = nodesInLayer[i];
      const comp = compMap.get(nid)!;
      result.push({
        id: comp.id,
        type: comp.type,
        label: comp.label,
        x: 80 + layerIdx * xGap,
        y: Math.max(60, startY + i * yGap),
      });
    }
  }

  return result;
}
