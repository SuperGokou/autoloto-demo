import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ZoomIn, ZoomOut, Move, Columns, Maximize } from 'lucide-react';
import { clsx } from 'clsx';
import type { CircuitNode, CircuitEdge } from '../types';

interface CanvasProps {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  onNodeSelect: (node: CircuitNode) => void;
  selectedNodeId?: string;
  simulationMode: 'energized' | 'isolating';
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  edges,
  onNodeSelect,
  selectedNodeId,
  simulationMode,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 2));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.5));
  const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const getNodeBorderColor = (type: string) => {
    switch (type) {
      case 'breaker': return 'border-l-red-500';
      case 'switch': return 'border-l-blue-500';
      case 'capacitor': return 'border-l-cyan-500';
      case 'motor': return 'border-l-indigo-500';
      case 'source': return 'border-l-emerald-500';
      case 'transform': return 'border-l-purple-500';
      default: return 'border-l-slate-400';
    }
  };

  const getNodeStatusColor = (status: string, mode: string) => {
    if (mode === 'energized') return 'bg-red-500';
    return status === 'energized' ? 'bg-red-500' : 'bg-emerald-500';
  };

  return (
    <div
      className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col h-full cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      ref={containerRef}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      />

      <div
        className="absolute top-6 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-full px-4 py-2 flex items-center gap-4 shadow-lg z-10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
          <button onClick={zoomOut} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-500 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 pl-2">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition-colors" title="Pan Mode">
            <Move className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition-colors" title="Split View">
            <Columns className="w-4 h-4" />
          </button>
          <button onClick={resetView} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition-colors" title="Reset View">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="absolute top-0 left-0 w-full h-full origin-top-left transition-transform duration-75 ease-out"
        style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
      >
        <svg className="absolute top-0 left-0 w-[2000px] h-[2000px] pointer-events-none overflow-visible">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" />
            </marker>
            <marker id="arrowhead-energized" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const src = nodes.find((n) => n.id === edge.source);
            const tgt = nodes.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;
            const isEnergized = simulationMode === 'energized';
            return (
              <g key={edge.id}>
                <line
                  x1={src.x + 90} y1={src.y + 30}
                  x2={tgt.x + 90} y2={tgt.y + 30}
                  stroke={isEnergized ? '#F59E0B' : '#94A3B8'}
                  strokeWidth="2"
                  markerEnd={isEnergized ? 'url(#arrowhead-energized)' : 'url(#arrowhead)'}
                  className="transition-colors duration-500"
                />
                {isEnergized && (
                  <circle r="3" fill="#F59E0B">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path={`M${src.x + 90},${src.y + 30} L${tgt.x + 90},${tgt.y + 30}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={clsx(
              'absolute w-[180px] h-[60px] bg-white rounded shadow-sm flex flex-col justify-between px-3 py-2 cursor-pointer transition-all hover:scale-105 z-10 border-l-[6px] border border-slate-200',
              getNodeBorderColor(node.type),
              selectedNodeId === node.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-50 shadow-md' : '',
            )}
            style={{ left: node.x, top: node.y }}
            onMouseDown={(e) => { e.stopPropagation(); onNodeSelect(node); }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800 truncate">{node.label}</span>
              <div className={clsx('w-2.5 h-2.5 rounded-full ring-2 ring-white', getNodeStatusColor(node.status, simulationMode))} />
            </div>
            <div className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              {node.meta ? Object.values(node.meta).join(' / ') : 'No Specs'}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="absolute bottom-6 left-6 flex flex-col gap-2 pointer-events-none">
        <div className="bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-md text-xs text-slate-600 shadow-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> <span>Breaker / Disconnect</span>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div> <span>Capacitor Bank</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> <span>Live / Energized</span>
          </div>
        </div>
      </div>
    </div>
  );
};
