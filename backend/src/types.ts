export interface Component {
  id: string;
  type: string;
  label: string;
  position?: string;
}

export interface Connection {
  source: string;
  target: string;
  wire_id?: string;
  pipe_id?: string;
  confidence?: number;
}

export interface Topology {
  components: Component[];
  connections: Connection[];
  parse_error?: string;
  raw_response?: string;
  raw_ocr?: string;
  validation_warnings?: ValidationWarning[];
}

export interface ValidationWarning {
  type: 'orphan' | 'invalid_reference' | 'duplicate';
  message: string;
  componentId: string;
}

export interface LotoRequirement {
  id: string;
  type: 'lockout' | 'verification' | 'isolation';
  action: string;
  reason: string;
}
