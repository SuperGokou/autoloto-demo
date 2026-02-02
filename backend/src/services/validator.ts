import { Topology, Connection, ValidationWarning } from '../types';

export interface ValidationResult {
  warnings: ValidationWarning[];
  cleanedConnections: Connection[];
}

/**
 * Normalize a component ID for comparison: strip whitespace, dashes,
 * underscores, and lowercase.  "VD 1" -> "vd1", "vd-1" -> "vd1"
 */
function normalizeId(id: string): string {
  return id.replace(/[\s\-_]/g, '').toLowerCase();
}

/**
 * Try to find the canonical component ID that matches a raw connection
 * reference.  Returns the matched canonical ID or null.
 */
function fuzzyMatch(raw: string, canonicalIds: string[], normalizedMap: Map<string, string>): string | null {
  // Exact match first
  if (normalizedMap.has(raw)) return raw;

  // Normalized match
  const norm = normalizeId(raw);
  for (const cid of canonicalIds) {
    if (normalizeId(cid) === norm) return cid;
  }

  // Prefix match - e.g., "C1" matching "C1_100nF" or vice versa
  for (const cid of canonicalIds) {
    const normCid = normalizeId(cid);
    if (normCid.startsWith(norm) || norm.startsWith(normCid)) return cid;
  }

  return null;
}

export function validateTopology(topology: Topology): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const canonicalIds = topology.components.map((c) => c.id);
  const idSet = new Set(canonicalIds);
  const normalizedMap = new Map(canonicalIds.map((id) => [id, id]));

  // Fix up and validate connections
  const validConnections: Connection[] = [];
  for (const conn of topology.connections) {
    let source = conn.source;
    let target = conn.target;
    let patched = false;

    if (!idSet.has(source)) {
      const match = fuzzyMatch(source, canonicalIds, normalizedMap);
      if (match) {
        source = match;
        patched = true;
      } else {
        warnings.push({
          type: 'invalid_reference',
          message: `Connection references unknown component "${conn.source}"`,
          componentId: conn.source,
        });
        continue;
      }
    }

    if (!idSet.has(target)) {
      const match = fuzzyMatch(target, canonicalIds, normalizedMap);
      if (match) {
        target = match;
        patched = true;
      } else {
        warnings.push({
          type: 'invalid_reference',
          message: `Connection references unknown component "${conn.target}"`,
          componentId: conn.target,
        });
        continue;
      }
    }

    const fixed: Connection = { ...conn, source, target };
    if (patched) {
      fixed.confidence = Math.min(fixed.confidence ?? 1.0, 0.6);
    }
    validConnections.push(fixed);
  }

  // Detect duplicate connections
  const seen = new Set<string>();
  const dedupedConnections: Connection[] = [];
  for (const conn of validConnections) {
    const key = `${conn.source}--${conn.target}`;
    const reverseKey = `${conn.target}--${conn.source}`;
    if (seen.has(key) || seen.has(reverseKey)) {
      warnings.push({
        type: 'duplicate',
        message: `Duplicate connection: ${conn.source} <-> ${conn.target}`,
        componentId: conn.source,
      });
      continue;
    }
    seen.add(key);
    dedupedConnections.push(conn);
  }

  // Flag components with zero connections
  const connectedIds = new Set<string>();
  for (const conn of dedupedConnections) {
    connectedIds.add(conn.source);
    connectedIds.add(conn.target);
  }
  for (const comp of topology.components) {
    if (!connectedIds.has(comp.id)) {
      warnings.push({
        type: 'orphan',
        message: `${comp.id} has no connections - may be missing wires`,
        componentId: comp.id,
      });
    }
  }

  // Assign default confidence
  const connectionsWithConfidence: Connection[] = dedupedConnections.map((conn) => ({
    ...conn,
    confidence: conn.confidence ?? 1.0,
  }));

  return { warnings, cleanedConnections: connectionsWithConfidence };
}
