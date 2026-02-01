export interface Component {
  id: string;
  type: string;
  label: string;
}

export interface Connection {
  source: string;
  target: string;
  wire_id?: string;
  pipe_id?: string;
}

export interface Topology {
  components: Component[];
  connections: Connection[];
  parse_error?: string;
  raw_response?: string;
  raw_ocr?: string;
}

export interface LotoRequirement {
  id: string;
  type: 'lockout' | 'verification' | 'isolation';
  action: string;
  reason: string;
}
