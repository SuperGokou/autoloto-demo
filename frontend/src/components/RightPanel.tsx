import React from 'react';
import { Download, FileDown, ShieldCheck, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { CircuitNode, LotoStep, ValidationWarning } from '../types';

interface RightPanelProps {
  selectedNode: CircuitNode | null;
  simulationMode: 'energized' | 'isolating';
  setSimulationMode: (mode: 'energized' | 'isolating') => void;
  lotoSteps: LotoStep[];
  onStepClick: (stepId: string) => void;
  topologyJson?: string;
  validationWarnings?: ValidationWarning[];
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedNode,
  simulationMode,
  setSimulationMode,
  lotoSteps,
  onStepClick,
  topologyJson,
  validationWarnings = [],
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
    <div className="w-96 h-full bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0px_24px_0px_rgba(0,0,0,0.02)] z-20">
      {/* Header */}
      <div className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-6">
        <h2 className="text-slate-900 font-bold text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          Safety Protocol
        </h2>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">ISO 14118</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 space-y-6 bg-slate-50/30">
        {/* Selected Component / Empty State */}
        <div className="bg-white/50 border border-slate-200 rounded-xl px-8 py-8">
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
                    <div key={key} className="bg-slate-50 p-2.5 rounded border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">{key}</p>
                      <p className="text-sm text-slate-700 font-mono font-medium">{value}</p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center">Select a component to view details</p>
          )}
        </div>

        {/* System State */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">System State</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 opacity-95"></div>
              <span className="text-[10px] font-bold text-amber-600">LIVE VOLTAGE</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
            <div className="flex">
              <button
                onClick={() => setSimulationMode('energized')}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                  simulationMode === 'energized'
                    ? 'bg-amber-50 border border-amber-200 text-amber-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600',
                )}
              >
                Energized
              </button>
              <button
                onClick={() => setSimulationMode('isolating')}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                  simulationMode === 'isolating'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600',
                )}
              >
                Safe / Isolated
              </button>
            </div>
          </div>
        </div>

        {validationWarnings.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Validation Warnings</h3>
            <div className="space-y-2">
              {validationWarnings.map((w, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-amber-800 font-medium">{w.message}</p>
                    <span className="text-[10px] text-amber-600 font-mono">{w.type.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOTO Checklist */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">LOTO Checklist</h3>
          <div className="space-y-2">
            {lotoSteps.map((step) => (
              <div
                key={step.id}
                onClick={() => onStepClick(step.id)}
                className={clsx(
                  'bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md',
                  step.completed && 'bg-emerald-50 border-emerald-200',
                )}
              >
                <div
                  className={clsx(
                    'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
                    step.completed
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : 'bg-white border-slate-200 text-slate-400',
                  )}
                >
                  {step.completed ? <CheckCircle2 className="w-4 h-4" /> : step.order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm font-bold', step.completed ? 'text-emerald-800 line-through opacity-70' : 'text-slate-800')}>
                    {step.action}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div>
                      {step.type === 'lockout' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold border border-red-100">
                          Lockout
                        </span>
                      )}
                      {step.type === 'verification' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold border border-amber-200">
                          Verify
                        </span>
                      )}
                      {step.type === 'isolation' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold border border-blue-200">
                          Isolation
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{step.componentId.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pt-6 pb-6 border-t border-slate-100 bg-white">
        <div className="flex gap-3">
          <button
            onClick={downloadJson}
            className="flex-1 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
          <button className="flex-1 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2">
            <FileDown className="w-4 h-4" />
            PDF Report
          </button>
        </div>
      </div>
    </div>
  );
};
