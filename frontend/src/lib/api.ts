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

export async function getLotoSteps(
  topology: TopologyResponse,
  componentId: string,
): Promise<Array<{ id: string; type: string; action: string; reason: string }>> {
  const { data } = await api.post('/loto', { topology, componentId });
  return data;
}

export async function healthCheck(): Promise<boolean> {
  try {
    await api.get('/health');
    return true;
  } catch {
    return false;
  }
}
