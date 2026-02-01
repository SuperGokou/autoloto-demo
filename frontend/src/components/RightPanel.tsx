import React from 'react';
import { Download, FileDown, ShieldCheck, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { CircuitNode, LotoStep } from '../types';

interface RightPanelProps {
  selectedNode: CircuitNode | null;
  simulationMode: 'energized' | 'isolating';
  setSimulationMode: (mode: 'energized' | 'isolating') => void;
  lotoSteps: LotoStep[];
  onStepClick: (stepId: string) => void;
  topologyJson?: string;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedNode,
  simulationMode,
  setSimulationMode,
  lotoSteps,
  onStepClick,
  topologyJson,
}) => {
  const downloadJson = () => {
    if (!topologyJson) return;
    const blob = new Blob([topologyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topology.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-96 h-full bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-slate-900 font-bold text-xl flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          LOTO Procedure
        </h2>
        <p className="text-xs text-slate-500 mt-1">ISO 14118 Compliance Checklist</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="bg-white rounded-sm border border-slate-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-1 h-3 bg-blue-600"></div>
            Selected Component
          </h3>
          {selectedNode ? (
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-lg font-bold text-slate-900">{selectedNode.label}</span>
                <span
                  className={clsx(
                    'px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider',
                    selectedNode.type === 'breaker'
                      ? 'bg-red-50 text-red-600 border border-red-100'
                      : selectedNode.type === 'source'
                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                        : 'bg-slate-100 text-slate-600 border border-slate-200',
                  )}
                >
                  {selectedNode.type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {selectedNode.meta &&
                  Object.entries(selectedNode.meta).map(([key, value]) => (
                    <div key={key} className="bg-slate-50 p-2.5 rounded-sm border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{key}</p>
                      <p className="text-sm text-slate-700 font-mono font-medium">{value}</p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm bg-slate-50/50 rounded-sm border border-dashed border-slate-200">
              Select a component on the schematic to view details.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-3 bg-blue-600"></div>
            Simulation State
          </h3>
          <div className="flex bg-slate-100 p-1.5 rounded-md border border-slate-200">
            <button
              onClick={() => setSimulationMode('energized')}
              className={clsx(
                'flex-1 py-2.5 rounded-sm text-xs font-bold transition-all shadow-sm',
                simulationMode === 'energized'
                  ? 'bg-white text-amber-600 shadow border border-slate-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 shadow-none',
              )}
            >
              ENERGIZED (LIVE)
            </button>
            <button
              onClick={() => setSimulationMode('isolating')}
              className={clsx(
                'flex-1 py-2.5 rounded-sm text-xs font-bold transition-all shadow-sm',
                simulationMode === 'isolating'
                  ? 'bg-white text-emerald-600 shadow border border-slate-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 shadow-none',
              )}
            >
              ISOLATING
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-3 bg-blue-600"></div>
            Isolation Steps
          </h3>
          <div className="space-y-3">
            {lotoSteps.map((step) => (
              <div
                key={step.id}
                onClick={() => onStepClick(step.id)}
                className={clsx(
                  'p-4 rounded-md border flex items-start gap-3 cursor-pointer transition-all hover:shadow-md',
                  step.completed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-white border-slate-200 hover:border-blue-300',
                )}
              >
                <div
                  className={clsx(
                    'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border',
                    step.completed
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : 'bg-white border-slate-300 text-slate-500',
                  )}
                >
                  {step.completed ? <CheckCircle2 className="w-4 h-4" /> : step.order}
                </div>
                <div className="flex-1">
                  <p className={clsx('text-sm font-bold', step.completed ? 'text-emerald-800 line-through opacity-70' : 'text-slate-800')}>
                    {step.action}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {step.type === 'lockout' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold border border-red-200 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> LOCKOUT
                      </span>
                    )}
                    {step.type === 'verification' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold border border-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> VERIFY
                      </span>
                    )}
                    {step.type === 'isolation' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold border border-blue-200 flex items-center gap-1">
                        ISOLATION
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">{step.componentId.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
        <button
          onClick={downloadJson}
          className="w-full py-3 bg-white border border-slate-300 rounded-sm text-slate-700 text-xs font-bold hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Download className="w-4 h-4" />
          DOWNLOAD TOPOLOGY (JSON)
        </button>
        <button className="w-full py-3 bg-blue-600 rounded-sm text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
          <FileDown className="w-4 h-4" />
          EXPORT SAFETY REPORT (PDF)
        </button>
      </div>
    </div>
  );
};
