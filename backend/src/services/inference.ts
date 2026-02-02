import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Topology } from '../types';
import {
  componentDiscoveryPrompt,
  connectionTracingPrompt,
  singlePassPrompt,
} from './prompts';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const REQUEST_TIMEOUT = 300_000;
const TEMPERATURE = 0.1;
const MAX_TOKENS = 8192;

function encodeImageToBase64(imagePath: string): string {
  return fs.readFileSync(imagePath).toString('base64');
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

const COMPONENT_PATTERNS: Array<{ re: RegExp; type: string }> = [
  { re: /\b(R\d+)\b/g, type: 'Resistor' },
  { re: /\b(C\d+)\b/g, type: 'Capacitor' },
  { re: /\b(L\d+)\b/g, type: 'Inductor' },
  { re: /\b(VD\d+)\b/g, type: 'Diode' },
  { re: /\b(D\d+)\b/g, type: 'Diode' },
  { re: /\b(VZ\d*)\b/g, type: 'Zener Diode' },
  { re: /\b(ZD\d+)\b/g, type: 'Zener Diode' },
  { re: /\b(Q\d+)\b/g, type: 'Transistor' },
  { re: /\b(VT\d+)\b/g, type: 'Transistor' },
  { re: /\b(V\d+)\b/g, type: 'Transistor' },
  { re: /\b(IC\d+)\b/g, type: 'IC' },
  { re: /\b(U\d+)\b/g, type: 'IC' },
  { re: /\b(T\d+)\b/g, type: 'Transformer' },
  { re: /\b(F\d+)\b/g, type: 'Fuse' },
  { re: /\b(LED\d*)\b/g, type: 'LED' },
  { re: /\b(RV\d+)\b/g, type: 'Varistor' },
  { re: /\b(S\d+)\b/g, type: 'Switch' },
  { re: /\b(SW\d+)\b/g, type: 'Switch' },
  { re: /\b(RP\d+)\b/g, type: 'Potentiometer' },
];

/**
 * Fallback parser: extract component IDs and connection pairs from
 * verbose/thinking model output when JSON parsing fails.
 *
 * To avoid phantom matches (e.g., "C4" from "pin 4"), we require that
 * a candidate ID appears near a component-type keyword or a value-like
 * token (e.g., "10k", "IN4001", "220u") within the same line.
 */
function parseComponentsFromText(text: string): Topology {
  const componentMap = new Map<string, string>(); // id -> type

  // Count occurrences of each candidate ID to filter phantoms
  const idCounts = new Map<string, number>();
  for (const { re } of COMPONENT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const id = m[1];
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  }

  for (const { re, type } of COMPONENT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const id = m[1];
      if (componentMap.has(id)) continue;
      // Multi-char prefixes (VD, IC, LED, RP, SW, VZ) are unlikely phantoms - accept always.
      // Single-char prefixes (R, C, D, T, V, L, F, S, U) need 2+ mentions to filter
      // phantom matches from pin numbers, step counts, etc.
      const count = idCounts.get(id) || 0;
      const prefixLen = id.replace(/\d+$/, '').length;
      if (prefixLen >= 2 || count >= 2) {
        componentMap.set(id, type);
      }
    }
  }

  // Try to extract labels like "R1 20k", "C1 220u/16V", "VD1 IN4001"
  const components = [...componentMap.entries()].map(([id, type]) => {
    const labelRe = new RegExp(`${id}[:\\s]+([\\w./]+(?:\\s*[\\w./]+)?)`, 'i');
    const labelMatch = text.match(labelRe);
    const label = labelMatch ? `${id} ${labelMatch[1]}` : id;
    return { id, type, label };
  });

  // Extract connections via multiple patterns
  const connections: Array<{ source: string; target: string }> = [];
  const ids = new Set(componentMap.keys());
  const idPattern = '[A-Z]+\\d+';

  // Pattern 1: "X connected to Y", "X connects to Y", "X -> Y", "X → Y"
  const connPatterns = [
    new RegExp(`\\b(${idPattern})\\b\\s*(?:connected to|connects to|→|->|=>|to)\\s*\\b(${idPattern})\\b`, 'gi'),
    // Pattern 2: "X and Y" in connection context
    new RegExp(`\\b(${idPattern})\\b\\s*(?:and|,)\\s*\\b(${idPattern})\\b`, 'gi'),
    // Pattern 3: "source": "X", "target": "Y" in partial JSON
    new RegExp(`"source"\\s*:\\s*"(${idPattern})"[^}]*"target"\\s*:\\s*"(${idPattern})"`, 'gi'),
  ];

  for (const re of connPatterns) {
    let cm: RegExpExecArray | null;
    while ((cm = re.exec(text)) !== null) {
      const src = cm[1].toUpperCase();
      const tgt = cm[2].toUpperCase();
      if (ids.has(src) && ids.has(tgt) && src !== tgt) {
        connections.push({ source: src, target: tgt });
      }
    }
  }

  // Pattern 4: proximity - find component IDs mentioned near each other in
  // connection-related sentences. Split text into sentences, look for sentences
  // with 2+ component IDs and connection keywords.
  const connKeywords = /connect|wire|trace|link|path|pin|output|input|anode|cathode|bridge|series|parallel/i;
  const sentences = text.split(/[.\n]/);
  const idRe = new RegExp(`\\b(${idPattern})\\b`, 'g');
  for (const sentence of sentences) {
    if (!connKeywords.test(sentence)) continue;
    const found: string[] = [];
    let sm: RegExpExecArray | null;
    idRe.lastIndex = 0;
    while ((sm = idRe.exec(sentence)) !== null) {
      const id = sm[1].toUpperCase();
      if (ids.has(id) && !found.includes(id)) found.push(id);
    }
    // Create chain connections for IDs in the same sentence
    for (let i = 0; i < found.length - 1; i++) {
      connections.push({ source: found[i], target: found[i + 1] });
    }
  }

  // Deduplicate connections
  const seen = new Set<string>();
  const dedupedConns = connections.filter((c) => {
    const key = `${c.source}--${c.target}`;
    const rev = `${c.target}--${c.source}`;
    if (seen.has(key) || seen.has(rev)) return false;
    seen.add(key);
    return true;
  });

  return { components, connections: dedupedConns };
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

  // Fallback: extract components and connections from unstructured text
  const parsed = parseComponentsFromText(cleaned);
  if (parsed.components.length > 0) {
    return { ...parsed, raw_response: response };
  }

  return {
    components: [], connections: [],
    raw_response: response,
    parse_error: 'Could not extract JSON from response',
  };
}

function extractPartialJson(response: string): any {
  if (!response || !response.trim()) return null;
  const cleaned = response.trim();

  try { return JSON.parse(cleaned); } catch { /* continue */ }

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ }
  }

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
  }

  // Fallback: extract from unstructured text
  const parsed = parseComponentsFromText(cleaned);
  if (parsed.components.length > 0) {
    return parsed;
  }

  return null;
}

// --------------- Text LLM call (no images) ---------------

export async function callTextLlm(
  prompt: string,
  model: string,
): Promise<string> {
  const provider = getCloudProvider(model);

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set.');
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT,
      },
    );
    return resp.data?.choices?.[0]?.message?.content || '';
  }

  if (provider === 'dashscope') {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not set.');
    const resp = await axios.post(
      'https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT,
      },
    );
    return resp.data?.choices?.[0]?.message?.content || '';
  }

  // Ollama
  const resp = await axios.post(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.3, num_predict: MAX_TOKENS },
    },
    { timeout: REQUEST_TIMEOUT },
  );
  const msg = resp.data?.message;
  return msg?.content || msg?.thinking || '';
}

// --------------- VLM call helpers ---------------

async function callVlm(
  prompt: string,
  images: string[],
  model: string,
): Promise<string> {
  const provider = getCloudProvider(model);

  if (provider === 'openai') {
    return callOpenAIVision(prompt, images, model);
  }
  if (provider === 'dashscope') {
    return callDashScopeVision(prompt, images, model);
  }

  const useGenerate = model.toLowerCase().includes('deepseek-ocr');
  if (useGenerate) {
    return callOllamaGenerate(prompt, images, model);
  }
  return callOllamaChat(prompt, images, model);
}

async function callOllamaChat(
  prompt: string,
  images: string[],
  model: string,
): Promise<string> {
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
  const msg = resp.data?.message;
  return msg?.content || msg?.thinking || '';
}

async function callOllamaGenerate(
  prompt: string,
  images: string[],
  model: string,
): Promise<string> {
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
  prompt: string,
  images: string[],
  model: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to your .env file.');
  }

  const content: Array<Record<string, any>> = [{ type: 'text', text: prompt }];
  for (const img of images) {
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } });
  }

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
  prompt: string,
  images: string[],
  model: string,
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY is not set. Add it to your .env file.');
  }

  const content: Array<Record<string, any>> = [{ type: 'text', text: prompt }];
  for (const img of images) {
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } });
  }

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
  if (model.startsWith('qwen3-vl-') && !model.includes(':')) return 'dashscope';
  return null;
}

// --------------- Multi-stage analysis ---------------

export async function analyzeCircuitMultiStage(
  imagePath: string,
  model: string = 'qwen3-vl:latest',
  referencePath?: string,
): Promise<Topology> {
  const images = buildImages(imagePath, referencePath);
  const hasReference = !!referencePath;

  // Pass 1: Component Discovery
  const pass1Prompt = componentDiscoveryPrompt(model, hasReference);
  const pass1Response = await callVlm(pass1Prompt, images, model);
  const pass1Data = extractPartialJson(pass1Response);

  if (!pass1Data?.components?.length) {
    // Fall back to single-pass if component discovery fails
    return analyzeDiagram(imagePath, model, referencePath);
  }

  const componentIds: string[] = pass1Data.components.map((c: any) => c.id);
  const componentList = pass1Data.components
    .map((c: any) => `- ${c.id}: ${c.type}${c.label ? ` (${c.label})` : ''}${c.position ? ` [${c.position}]` : ''}`)
    .join('\n');

  // Pass 2: Connection Tracing
  const pass2Prompt = connectionTracingPrompt(componentList, componentIds, hasReference);
  const pass2Response = await callVlm(pass2Prompt, images, model);
  const pass2Data = extractPartialJson(pass2Response);

  const components = (pass1Data.components || []).map((c: any) => ({
    id: c.id,
    type: c.type,
    label: c.label || c.id,
    position: c.position,
  }));

  const connections = (pass2Data?.connections || []).map((c: any) => ({
    source: c.source,
    target: c.target,
    wire_id: c.wire_id,
    confidence: c.confidence,
  }));

  return { components, connections };
}

// --------------- Single-pass analysis (fallback) ---------------

export async function analyzeDiagram(
  imagePath: string,
  model: string = 'qwen3-vl:latest',
  referencePath?: string,
): Promise<Topology> {
  try {
    const images = buildImages(imagePath, referencePath);
    const prompt = singlePassPrompt(model, !!referencePath);
    const response = await callVlm(prompt, images, model);
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
