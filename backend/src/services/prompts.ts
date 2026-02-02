/**
 * Prompt templates for VLM circuit analysis.
 * Extracted from inference.ts to keep prompts generic and maintainable.
 */

// -- Pass 1: Component Discovery --

export function componentDiscoveryPrompt(model: string, hasReference: boolean): string {
  if (model.toLowerCase().includes('deepseek-ocr')) {
    return '<|grounding|>Convert the document to markdown.';
  }

  if (hasReference) {
    return (
      'Image 1 is a symbol reference. Image 2 is a circuit diagram.\n\n' +
      'List every component visible in the circuit diagram.\n' +
      'For each component, provide:\n' +
      '- Reference designator (e.g., R1, C3, U1, T1)\n' +
      '- Component type (Resistor, Capacitor, Diode, Transistor, IC, Transformer, etc.)\n' +
      '- Any visible value or label (e.g., 10k, 100uF, LM358)\n' +
      '- Approximate position: (left/center/right, top/middle/bottom)\n\n' +
      'Return JSON only:\n{\n' +
      '  "components": [\n' +
      '    {"id": "R1", "type": "Resistor", "label": "R1 10k", "position": "left-top"}\n' +
      '  ]\n}'
    );
  }

  if (model.toLowerCase().includes('qwen')) {
    return (
      'Analyze this electrical circuit diagram carefully.\n\n' +
      'List every component visible in the schematic. Read all reference designators.\n' +
      'Common component types to look for:\n' +
      '- Resistors (R), Capacitors (C), Inductors (L)\n' +
      '- Diodes (D, VD), Zener diodes (VZ, ZD)\n' +
      '- Transistors (Q, VT), ICs (U, IC)\n' +
      '- Transformers (T), Fuses (F)\n' +
      '- LEDs (LED), Varistors (RV, MOV)\n' +
      '- Connectors (J, X), Switches (S, SW)\n\n' +
      'For each component provide:\n' +
      '- Reference designator as id\n' +
      '- Component type\n' +
      '- Full label including any values\n' +
      '- Approximate position in the schematic (left/center/right, top/middle/bottom)\n\n' +
      'Return JSON:\n{\n' +
      '  "components": [\n' +
      '    {"id": "R1", "type": "Resistor", "label": "R1 1k", "position": "left-top"},\n' +
      '    {"id": "C1", "type": "Capacitor", "label": "C1 6.8uF", "position": "center-middle"}\n' +
      '  ]\n}'
    );
  }

  // LLaVA and other models - generic prompt (replaces hardcoded power supply prompt)
  return (
    'You are an expert electronics engineer analyzing a circuit schematic.\n\n' +
    'TASK: Read EVERY component label in this circuit diagram.\n\n' +
    'Scan the entire schematic systematically from left to right, top to bottom.\n' +
    'Look for all component types:\n' +
    '- Resistors (R), Capacitors (C), Inductors (L)\n' +
    '- Diodes (D, VD), Zener diodes (VZ, ZD)\n' +
    '- Transistors (Q, VT), ICs (U, IC)\n' +
    '- Transformers (T), Fuses (F)\n' +
    '- LEDs (LED), Varistors (RV, MOV)\n' +
    '- Connectors (J, X), Switches (S, SW)\n' +
    '- Voltage sources (V), Ground symbols (GND)\n\n' +
    'For each component provide its reference designator, type, visible label/value,\n' +
    'and approximate position (left/center/right, top/middle/bottom).\n\n' +
    'Return JSON:\n{\n' +
    '  "components": [\n' +
    '    {"id": "R1", "type": "Resistor", "label": "R1 10k", "position": "left-top"}\n' +
    '  ]\n}\n\n' +
    'IMPORTANT: Return valid JSON. List ALL components you can identify.'
  );
}

// -- Pass 2: Connection Tracing --

export function connectionTracingPrompt(
  componentList: string,
  componentIds: string[],
  hasReference: boolean,
): string {
  const preamble = hasReference
    ? 'Image 1 is a symbol reference. Image 2 is a circuit diagram.\n\n'
    : '';

  // Use actual component IDs in the example so the VLM doesn't invent IDs
  const exSrc = componentIds[0] || 'COMP1';
  const exTgt = componentIds[1] || 'COMP2';

  return (
    preamble +
    'Here are the components previously identified in this circuit:\n' +
    componentList + '\n\n' +
    'ALLOWED COMPONENT IDs (use ONLY these):\n' +
    componentIds.join(', ') + '\n\n' +
    'TASK: Trace every wire/connection between these components.\n\n' +
    'For each wire, follow its path on the schematic and note:\n' +
    '- source: the component ID where the wire starts\n' +
    '- target: the component ID where the wire ends\n' +
    '- wire_id: the wire label if visible\n\n' +
    'Guidelines:\n' +
    '- Follow each wire carefully from one component to another\n' +
    '- Include power and ground connections\n' +
    '- If a wire connects through a junction (dot), list each segment separately\n' +
    '- ONLY use component IDs from the ALLOWED list above. Do NOT invent new IDs.\n\n' +
    'Return JSON:\n{\n' +
    '  "connections": [\n' +
    `    {"source": "${exSrc}", "target": "${exTgt}"},\n` +
    `    {"source": "${exTgt}", "target": "${componentIds[2] || exSrc}"}\n` +
    '  ]\n}\n\n' +
    'IMPORTANT: Return valid JSON. Every source and target MUST be one of the allowed IDs listed above.'
  );
}

// -- Safety Report Generation --

export function safetyReportPrompt(
  components: Array<{ id: string; type: string; label: string }>,
  connections: Array<{ source: string; target: string }>,
  lotoSteps: Array<{ action: string; type: string; componentId: string }>,
  simulationMode: string,
): string {
  const compList = components.map((c) => `- ${c.id}: ${c.type} (${c.label})`).join('\n');
  const connList = connections.map((c) => `- ${c.source} -> ${c.target}`).join('\n');
  const stepList = lotoSteps.map((s, i) => `${i + 1}. [${s.type.toUpperCase()}] ${s.action} (${s.componentId})`).join('\n');

  return (
    'You are a certified safety engineer. Generate a formal LOTO (Lock-Out / Tag-Out) safety report ' +
    'for the following electrical circuit based on ISO 14118 and OSHA 29 CFR 1910.147 standards.\n\n' +
    '## Circuit Components\n' + compList + '\n\n' +
    '## Circuit Connections\n' + connList + '\n\n' +
    '## Current System State: ' + simulationMode.toUpperCase() + '\n\n' +
    '## LOTO Isolation Steps\n' + (stepList || '(No steps defined)') + '\n\n' +
    'Write a professional safety report in Markdown with the following sections:\n' +
    '1. **Executive Summary** - Brief overview of the system and purpose of the report\n' +
    '2. **System Description** - Describe the circuit topology and key components\n' +
    '3. **Hazard Identification** - Identify electrical hazards in this circuit\n' +
    '4. **Isolation Procedure** - Step-by-step LOTO procedure with safety notes\n' +
    '5. **Verification Requirements** - How to verify zero energy state\n' +
    '6. **Restoration Procedure** - Steps to safely re-energize\n' +
    '7. **Personnel Requirements** - Qualifications and PPE needed\n\n' +
    'Use clear, professional language. Include specific component references. ' +
    'Do NOT include any JSON. Write only the Markdown report.'
  );
}

// -- Single-pass prompt (legacy / fallback) --

export function singlePassPrompt(model: string, hasReference: boolean): string {
  if (model.toLowerCase().includes('deepseek-ocr')) {
    return '<|grounding|>Convert the document to markdown.';
  }

  if (hasReference) {
    const prefix = model.toLowerCase().includes('qwen')
      ? 'Image 1 is a symbol reference. Image 2 is a circuit diagram.\n\n'
      : 'Image 1: Symbol reference guide\nImage 2: Circuit diagram to analyze\n\n';

    return (
      prefix +
      'Identify all components and connections in the circuit diagram.\n\n' +
      'Return ONLY JSON:\n{\n' +
      '  "components": [{"id": "CB-01", "type": "Circuit Breaker", "label": "CB 01"}],\n' +
      '  "connections": [{"source": "CB-01", "target": "M-01"}]\n}'
    );
  }

  return (
    'Analyze this electrical circuit diagram carefully.\n\n' +
    'Read ALL component labels and trace ALL wire connections.\n\n' +
    'Component types to look for:\n' +
    '- Resistors (R), Capacitors (C), Inductors (L)\n' +
    '- Diodes (D, VD), Zener diodes (VZ, ZD)\n' +
    '- Transistors (Q, VT), ICs (U, IC)\n' +
    '- Transformers (T), Fuses (F), LEDs (LED)\n' +
    '- Varistors (RV, MOV), Connectors (J, X), Switches (S, SW)\n\n' +
    'Return JSON with both components and connections:\n{\n' +
    '  "components": [\n' +
    '    {"id": "R1", "type": "Resistor", "label": "R1 1k"}\n' +
    '  ],\n' +
    '  "connections": [\n' +
    '    {"source": "R1", "target": "C1"}\n' +
    '  ]\n}\n\n' +
    'IMPORTANT: Return valid JSON with both components and connections.'
  );
}
