export type NodeType = 'source' | 'breaker' | 'motor' | 'capacitor' | 'switch' | 'transform';

export interface CircuitNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  status: 'energized' | 'de-energized' | 'unknown' | 'locked-out';
  meta?: Record<string, string>;
}

export interface CircuitEdge {
  id: string;
  source: string;
  target: string;
  energized: boolean;
  confidence?: number;
  wire_id?: string;
}

export interface ValidationWarning {
  type: 'orphan' | 'invalid_reference' | 'duplicate';
  message: string;
  componentId: string;
}

export interface LotoStep {
  id: string;
  order: number;
  action: string;
  componentId: string;
  type: 'isolation' | 'verification' | 'lockout';
  completed: boolean;
  status: 'pending' | 'success' | 'warning' | 'danger';
}

export interface CircuitState {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  lotoSteps: LotoStep[];
  simulationMode: 'energized' | 'isolating';
}

export interface TopologyResponse {
  components: Array<{
    id: string;
    type: string;
    label: string;
    position?: string;
  }>;
  connections: Array<{
    source: string;
    target: string;
    wire_id?: string;
    confidence?: number;
  }>;
  parse_error?: string;
  raw_response?: string;
  validation_warnings?: ValidationWarning[];
}
