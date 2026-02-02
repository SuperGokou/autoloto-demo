import axios from 'axios';
import type { TopologyResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 300_000,
});

export async function uploadFile(file: File): Promise<{ imagePath: string }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ imagePath: string }>('/upload', form);
  return data;
}

export async function analyzeCircuit(
  imagePath: string,
  model: string,
  referencePath?: string,
): Promise<TopologyResponse> {
  const { data } = await api.post<TopologyResponse>('/analyze', {
    imagePath,
    model,
    referencePath,
  });
  return data;
}

export async function validateTopology(
  topology: TopologyResponse,
): Promise<{ warnings: Array<{ type: string; message: string; componentId: string }>; cleanedConnections: TopologyResponse['connections'] }> {
  const { data } = await api.post('/validate', { topology });
  return data;
}

export async function getLotoSteps(
  topology: TopologyResponse,
  componentId: string,
): Promise<Array<{ id: string; type: string; action: string; reason: string }>> {
  const { data } = await api.post('/loto', { topology, componentId });
  return data;
}

export interface EnvInfo {
  ollama: boolean;
  openai: boolean;
  dashscope: boolean;
}

export async function getEnv(): Promise<EnvInfo> {
  const { data } = await api.get<EnvInfo>('/env');
  return data;
}

export async function generateReport(payload: {
  components: Array<{ id: string; type: string; label: string }>;
  connections: Array<{ source: string; target: string }>;
  lotoSteps: Array<{ action: string; type: string; componentId: string }>;
  simulationMode: string;
  model: string;
}): Promise<string> {
  const { data } = await api.post<{ report: string }>('/report', payload);
  return data.report;
}

export async function healthCheck(): Promise<boolean> {
  try {
    await api.get('/health');
    return true;
  } catch {
    return false;
  }
}
