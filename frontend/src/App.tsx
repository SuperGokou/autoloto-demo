import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { RightPanel } from './components/RightPanel';
import { initialCircuitData } from './lib/mockData';
import type { CircuitNode, CircuitState, TopologyResponse, ValidationWarning } from './types';
import { uploadFile, analyzeCircuit, validateTopology } from './lib/api';
import { Menu } from 'lucide-react';
import logoImg from './assets/logo.png';

function mapComponentType(t: string): CircuitNode['type'] {
  const lower = t.toLowerCase();
  if (lower.includes('breaker') || lower.includes('fuse')) return 'breaker';
  if (lower.includes('switch') || lower.includes('disconnect')) return 'switch';
  if (lower.includes('capacitor')) return 'capacitor';
  if (lower.includes('motor') || lower.includes('load')) return 'motor';
  if (lower.includes('source') || lower.includes('terminal') || lower.includes('power')) return 'source';
  if (lower.includes('transform') || lower.includes('inductor')) return 'transform';
  return 'source';
}

interface LayoutComponent { id: string; type: string; label: string; x: number; y: number; }

function autoLayout(topo: TopologyResponse): { components: LayoutComponent[]; connections: TopologyResponse['connections'] } {
  const components: LayoutComponent[] = topo.components.map((c) => ({ ...c, x: 0, y: 0 }));
  const connections = topo.connections;

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
  if (roots.length === 0 && components.length > 0) roots.push(components[0].id);

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

  const compMap: Record<string, LayoutComponent> = {};
  for (const c of components) compMap[c.id] = c;

  const xGap = 220, yGap = 120;
  for (const layerIdx of Object.keys(layerGroups).map(Number).sort((a, b) => a - b)) {
    const nodesInLayer = layerGroups[layerIdx];
    const totalWidth = (nodesInLayer.length - 1) * yGap;
    const startY = 250 - totalWidth / 2;
    for (let i = 0; i < nodesInLayer.length; i++) {
      compMap[nodesInLayer[i]].x = 80 + layerIdx * xGap;
      compMap[nodesInLayer[i]].y = Math.max(60, startY + i * yGap);
    }
  }

  return { components, connections };
}

function topologyToCircuitState(topo: TopologyResponse): CircuitState {
  const laid = autoLayout(topo);
  const nodes: CircuitNode[] = laid.components.map((c) => ({
    id: c.id,
    type: mapComponentType(c.type),
    label: c.label || c.id,
    x: c.x,
    y: c.y,
    status: 'energized' as const,
    meta: {} as Record<string, string>,
  }));

  const edges = topo.connections.map((conn, i) => ({
    id: `e${i + 1}`,
    source: conn.source,
    target: conn.target,
    energized: true,
    confidence: conn.confidence,
    wire_id: conn.wire_id,
  }));

  return { nodes, edges, lotoSteps: [], simulationMode: 'energized' };
}

export default function App() {
  const [circuitState, setCircuitState] = useState<CircuitState>(initialCircuitData);
  const [selectedNode, setSelectedNode] = useState<CircuitNode | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [useDemoData, setUseDemoData] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llava:13b');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [referencePath, setReferencePath] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    try {
      const result = await uploadFile(file);
      setImagePath(result.imagePath);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleReferenceSelect = async (file: File | null) => {
    setReferenceFile(file);
    if (file) {
      try {
        const result = await uploadFile(file);
        setReferencePath(result.imagePath);
      } catch (err) {
        console.error('Reference upload failed:', err);
      }
    } else {
      setReferencePath(null);
    }
  };

  const handleAnalyze = async () => {
    if (useDemoData) {
      setCircuitState(initialCircuitData);
      return;
    }
    if (!imagePath) return;

    setIsAnalyzing(true);
    try {
      const topo = await analyzeCircuit(imagePath, selectedModel, referencePath ?? undefined);
      if (topo.components.length > 0) {
        try {
          const validation = await validateTopology(topo);
          setValidationWarnings(validation.warnings as ValidationWarning[]);
        } catch {
          setValidationWarnings([]);
        }
        setCircuitState(topologyToCircuitState(topo));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const setSimulationMode = (mode: 'energized' | 'isolating') => {
    setCircuitState((prev) => ({ ...prev, simulationMode: mode }));
  };

  const handleStepClick = (stepId: string) => {
    setCircuitState((prev) => ({
      ...prev,
      lotoSteps: prev.lotoSteps.map((step) =>
        step.id === stepId ? { ...step, completed: !step.completed } : step,
      ),
    }));
  };

  const topologyJson = JSON.stringify(
    {
      components: circuitState.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label })),
      connections: circuitState.edges.map((e) => ({ source: e.source, target: e.target })),
    },
    null,
    2,
  );

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-800 font-sans selection:bg-blue-100">
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-50 shadow-sm">
        <img src={logoImg} alt="AutoLOTO" className="h-8 object-contain" />
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
      </div>

      <div className="hidden md:block h-full">
        <Sidebar
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          onFileSelect={handleFileSelect}
          onReferenceSelect={handleReferenceSelect}
          selectedFileName={selectedFile?.name ?? null}
          referenceFileName={referenceFile?.name ?? null}
          useDemoData={useDemoData}
          onToggleDemo={setUseDemoData}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>

      <div className="hidden md:block flex-1 h-full relative z-0">
        <Canvas
          nodes={circuitState.nodes}
          edges={circuitState.edges}
          onNodeSelect={setSelectedNode}
          selectedNodeId={selectedNode?.id}
          simulationMode={circuitState.simulationMode}
        />
      </div>

      <div className="hidden md:block h-full">
        <RightPanel
          selectedNode={selectedNode}
          simulationMode={circuitState.simulationMode}
          setSimulationMode={setSimulationMode}
          lotoSteps={circuitState.lotoSteps}
          onStepClick={handleStepClick}
          topologyJson={topologyJson}
          validationWarnings={validationWarnings}
          components={circuitState.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label }))}
          connections={circuitState.edges.map((e) => ({ source: e.source, target: e.target }))}
          selectedModel={selectedModel}
        />
      </div>

      <div className="md:hidden pt-16 w-full h-full flex flex-col bg-slate-50">
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Field Verification Mode</h2>
          <RightPanel
            selectedNode={selectedNode}
            simulationMode={circuitState.simulationMode}
            setSimulationMode={setSimulationMode}
            lotoSteps={circuitState.lotoSteps}
            onStepClick={handleStepClick}
            topologyJson={topologyJson}
            validationWarnings={validationWarnings}
            components={circuitState.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label }))}
            connections={circuitState.edges.map((e) => ({ source: e.source, target: e.target }))}
            selectedModel={selectedModel}
          />
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="absolute inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-4/5 h-full bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Sidebar
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              onFileSelect={handleFileSelect}
              onReferenceSelect={handleReferenceSelect}
              selectedFileName={selectedFile?.name ?? null}
              referenceFileName={referenceFile?.name ?? null}
              useDemoData={useDemoData}
              onToggleDemo={setUseDemoData}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
