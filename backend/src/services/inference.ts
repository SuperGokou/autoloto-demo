import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Topology } from '../types';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const REQUEST_TIMEOUT = 300_000;
const TEMPERATURE = 0.1;
const MAX_TOKENS = 8192;

function encodeImageToBase64(imagePath: string): string {
  return fs.readFileSync(imagePath).toString('base64');
}

function getPromptForModel(model: string, hasReference: boolean): string {
  if (model.toLowerCase().includes('deepseek-ocr')) {
    return '<|grounding|>Convert the document to markdown.';
  }

  if (model.toLowerCase().includes('qwen')) {
    if (hasReference) {
      return (
        'Image 1 is a symbol reference. Image 2 is a circuit diagram.\n\n' +
        'Identify all components and connections in the circuit diagram.\n\n' +
        'Return JSON only:\n' +
        '{\n  "components": [{"id": "CB-01", "type": "Circuit Breaker", "label": "CB 01"}],\n' +
        '  "connections": [{"source": "CB-01", "target": "M-01"}]\n}'
      );
    }
    return (
      'Analyze this electrical circuit diagram carefully.\n\n' +
      'Read ALL component labels visible in the schematic. Look for:\n' +
      '- Resistors: R1, R2, R3, R4, R5, R6, R7, R8, etc.\n' +
      '- Capacitors: C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, etc.\n' +
      '- Diodes: D1, D2, D3, D4, D5, D6, D7, etc.\n' +
      '- Transistors/ICs: U1, U2, Q1, etc.\n' +
      '- Transformers: T1, T2, etc.\n' +
      '- Inductors: L1, L2, etc.\n' +
      '- Fuses: F1, F2, etc.\n' +
      '- Varistors/MOVs: RV1, VR1, VR2, VR3, etc.\n\n' +
      'List every component you can read from the diagram.\n\n' +
      'Return JSON:\n{\n' +
      '  "components": [\n' +
      '    {"id": "R1", "type": "Resistor", "label": "R1 1k"},\n' +
      '    {"id": "C1", "type": "Capacitor", "label": "C1 6.8uF"}\n' +
      '  ],\n' +
      '  "connections": [{"source": "D1", "target": "C1"}]\n}'
    );
  }

  // LLaVA and other models
  if (hasReference) {
    return (
      'Image 1: Symbol reference guide\nImage 2: Circuit diagram to analyze\n\n' +
      'Find all electrical components and their connections.\n\n' +
      'Return ONLY JSON:\n{\n' +
      '  "components": [\n' +
      '    {"id": "CB-01", "type": "Circuit Breaker", "label": "CB 01"},\n' +
      '    {"id": "M-01", "type": "Motor", "label": "M 01"}\n' +
      '  ],\n' +
      '  "connections": [\n' +
      '    {"source": "CB-01", "target": "M-01", "wire_id": "L1"}\n' +
      '  ]\n}'
    );
  }

  return (
    'You are an expert electronics engineer analyzing a power supply schematic.\n\n' +
    'TASK: Read EVERY component label in this circuit diagram. Go section by section:\n\n' +
    'INPUT SECTION (left side):\n- Look for fuse F1\n- Look for varistor RV1\n' +
    '- Look for diodes D1, D2, D3, D4 (bridge rectifier)\n- Look for capacitors C1, C2\n\n' +
    'PRIMARY SECTION (center-left):\n- Look for resistors R1, R5\n- Look for diode D5\n' +
    '- Look for zener VR2\n- Look for inductor L1\n- Look for IC U1 (controller chip)\n' +
    '- Look for capacitor C7\n- Look for resistor R8\n\n' +
    'TRANSFORMER (center):\n- Look for transformer T1\n\n' +
    'SECONDARY SECTION (center-right):\n- Look for capacitors C4, C5, C6\n' +
    '- Look for resistors R2, R3, R7\n- Look for diode D6\n- Look for zener VR3\n- Look for resistor R6\n\n' +
    'OUTPUT SECTION (right side):\n- Look for diode D7\n- Look for inductor L2\n' +
    '- Look for capacitors C10, C11\n- Look for optocoupler U2\n- Look for resistor R4\n\n' +
    'CONNECTIONS - trace the signal flow:\n' +
    '- AC input connects to F1\n- F1 connects to RV1\n- RV1 connects to D1-D4 bridge\n' +
    '- Bridge output connects to C1, C2\n- C1/C2 connects to T1 primary\n' +
    '- T1 primary connects to U1 (drain pin)\n- T1 secondary connects to D7\n' +
    '- D7 connects to L2\n- L2 connects to C10, C11\n- Output feedback: C10/C11 to VR3 to U2 to U1\n\n' +
    'Return JSON format with ALL components AND connections:\n{\n' +
    '  "components": [\n' +
    '    {"id": "F1", "type": "Fuse", "label": "F1 3.15A"},\n' +
    '    {"id": "RV1", "type": "Varistor", "label": "RV1 275VAC"}\n' +
    '  ],\n' +
    '  "connections": [\n' +
    '    {"source": "F1", "target": "RV1"}\n' +
    '  ]\n}\n\n' +
    'IMPORTANT: Return valid JSON with both components and connections.'
  );
}

function buildImages(imagePath: string, referencePath?: string): string[] {
  const images: string[] = [];
  if (referencePath) images.push(encodeImageToBase64(referencePath));
  images.push(encodeImageToBase64(imagePath));
  return images;
}

const EQUIPMENT_RE = /\b([A-Z]{1,3}[-\s]?\d{1,3}[-\s]?[A-Z]?)\b/g;

const TYPE_MAPPING: Record<string, string> = {
  SC: 'Scrubber', SP: 'Separator', MK: 'Mixer', MP: 'Pump',
  TK: 'Tank', V: 'Vessel', P: 'Pump', E: 'Heat Exchanger',
  C: 'Column', HX: 'Heat Exchanger',
};

function parseDeepseekOcrOutput(markdownText: string): Topology {
  const matches = new Set(markdownText.match(EQUIPMENT_RE) || []);
  const components = [...matches].sort().map((label) => {
    const normalized = label.replace(/\s/g, '-').toUpperCase();
    let compType = 'Equipment';
    for (const [prefix, eqType] of Object.entries(TYPE_MAPPING)) {
      if (label.toUpperCase().startsWith(prefix)) {
        compType = eqType;
        break;
      }
    }
    return { id: normalized, type: compType, label };
  });
  return { components, connections: [], raw_ocr: markdownText };
}

function extractJsonFromResponse(response: string, model: string): Topology {
  if (!response || !response.trim()) {
    return {
      components: [], connections: [],
      raw_response: '(empty response)',
      parse_error: 'Model returned empty response',
    };
  }

  if (model.toLowerCase().includes('deepseek-ocr')) {
    return parseDeepseekOcrOutput(response);
  }

  const cleaned = response.trim();

  // Direct parse
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // Code fence
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch { /* continue */ }
  }

  // First JSON object
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch { /* continue */ }
  }

  return {
    components: [], connections: [],
    raw_response: response,
    parse_error: 'Could not extract JSON from response',
  };
}

async function callOllamaChat(
  imagePath: string,
  model: string,
  referencePath?: string,
): Promise<string> {
  const images = buildImages(imagePath, referencePath);
  const prompt = getPromptForModel(model, !!referencePath);

  const resp = await axios.post(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      model,
      messages: [{ role: 'user', content: prompt, images }],
      stream: false,
      options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS },
    },
    { timeout: REQUEST_TIMEOUT },
  );

  return resp.data?.message?.content || '';
}

async function callOllamaGenerate(
  imagePath: string,
  model: string,
  referencePath?: string,
): Promise<string> {
  const images = buildImages(imagePath, referencePath);
  const prompt = getPromptForModel(model, !!referencePath);

  const resp = await axios.post(
    `${OLLAMA_BASE_URL}/api/generate`,
    {
      model,
      prompt,
      images,
      stream: false,
      options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS },
    },
    { timeout: REQUEST_TIMEOUT },
  );

  return resp.data?.response || '';
}

async function callOpenAIVision(
  imagePath: string,
  model: string,
  referencePath?: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to your .env file.');
  }

  const prompt = getPromptForModel(model, !!referencePath);
  const content: Array<Record<string, any>> = [{ type: 'text', text: prompt }];

  if (referencePath) {
    const refB64 = encodeImageToBase64(referencePath);
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${refB64}` } });
  }
  const imgB64 = encodeImageToBase64(imagePath);
  content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imgB64}` } });

  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [{ role: 'user', content }],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: REQUEST_TIMEOUT,
    },
  );

  return resp.data?.choices?.[0]?.message?.content || '';
}

async function callDashScopeVision(
  imagePath: string,
  model: string,
  referencePath?: string,
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not set. Add it to your .env file.');
  }

  const prompt = getPromptForModel(model, !!referencePath);
  const content: Array<Record<string, any>> = [{ type: 'text', text: prompt }];

  if (referencePath) {
    const refB64 = encodeImageToBase64(referencePath);
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${refB64}` } });
  }
  const imgB64 = encodeImageToBase64(imagePath);
  content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${imgB64}` } });

  const resp = await axios.post(
    'https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      model,
      messages: [{ role: 'user', content }],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: REQUEST_TIMEOUT,
    },
  );

  return resp.data?.choices?.[0]?.message?.content || '';
}

type CloudProvider = 'openai' | 'dashscope' | null;

function getCloudProvider(model: string): CloudProvider {
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('qwen3-vl-')) return 'dashscope';
  return null;
}

export async function analyzeDiagram(
  imagePath: string,
  model: string = 'qwen3-vl:latest',
  referencePath?: string,
): Promise<Topology> {
  try {
    let response: string;
    const provider = getCloudProvider(model);

    if (provider === 'openai') {
      response = await callOpenAIVision(imagePath, model, referencePath);
    } else if (provider === 'dashscope') {
      response = await callDashScopeVision(imagePath, model, referencePath);
    } else {
      const useGenerate = model.toLowerCase().includes('deepseek-ocr');
      const caller = useGenerate ? callOllamaGenerate : callOllamaChat;
      response = await caller(imagePath, model, referencePath);
    }

    return extractJsonFromResponse(response, model);
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      return {
        components: [], connections: [],
        parse_error: 'Cannot connect to Ollama. Make sure it is running: ollama serve',
      };
    }
    throw err;
  }
}
