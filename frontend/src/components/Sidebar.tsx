import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Zap, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import logoImg from '../assets/logo.png';
import { getEnv } from '../lib/api';

interface SidebarProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onFileSelect: (file: File) => void;
  onReferenceSelect: (file: File | null) => void;
  selectedFileName: string | null;
  referenceFileName: string | null;
  useDemoData: boolean;
  onToggleDemo: (v: boolean) => void;
  selectedModel: string;
  onModelChange: (m: string) => void;
}

interface ModelOption {
  value: string;
  label: string;
  provider: 'ollama' | 'openai' | 'dashscope';
}

const ALL_MODELS: ModelOption[] = [
  { value: 'llava:13b', label: 'LLaVA 13b (Fast)', provider: 'ollama' },
  { value: 'llava:7b', label: 'LLaVA 7b', provider: 'ollama' },
  { value: 'llava:latest', label: 'LLaVA (Latest)', provider: 'ollama' },
  { value: 'qwen3-vl:latest', label: 'Qwen3-VL Ollama (Local)', provider: 'ollama' },
  { value: 'gpt-4o', label: 'GPT-4o Vision (Cloud)', provider: 'openai' },
  { value: 'qwen3-vl-235b-a22b-thinking', label: 'Qwen3-VL 235B (Cloud)', provider: 'dashscope' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  onAnalyze,
  isAnalyzing,
  onFileSelect,
  onReferenceSelect,
  selectedFileName,
  referenceFileName,
  useDemoData,
  onToggleDemo,
  selectedModel,
  onModelChange,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(ALL_MODELS);

  useEffect(() => {
    getEnv().then((env) => {
      const available = ALL_MODELS.filter((m) => {
        if (m.provider === 'ollama') return env.ollama;
        if (m.provider === 'openai') return env.openai;
        if (m.provider === 'dashscope') return env.dashscope;
        return false;
      });
      if (available.length > 0) {
        setModels(available);
        if (!available.find((m) => m.value === selectedModel)) {
          onModelChange(available[0].value);
        }
      }
    }).catch(() => { /* keep all models as fallback */ });
  }, []);

  const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && ACCEPTED_TYPES.includes(file.type)) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-[4px_0px_24px_0px_rgba(0,0,0,0.02)] z-20">
      {/* Header */}
      <div className="h-16 border-b border-slate-100 flex items-center px-6">
        <img src={logoImg} alt="AutoLOTO" className="h-7 object-contain" />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-6 space-y-8 overflow-y-auto">
        {/* Source Material */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Source Material</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">NEW PROJECT</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelect(f);
            }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={clsx(
              'border-2 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group',
              isDragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-white hover:border-blue-400',
            )}
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              {selectedFileName || 'Upload Schematic'}
            </p>
            <p className="text-xs text-slate-500 mt-1">PDF, PNG, DXF</p>
          </div>
        </div>

        {/* Analysis Engine */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analysis Engine</h3>
          <div className="space-y-3">
            {/* VLM Model */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">VLM Model</label>
              <div className="relative mt-1.5">
                <select
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
                >
                  {models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Context */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Context</label>
              <input
                ref={refFileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  onReferenceSelect(f);
                }}
              />
              <div
                onClick={() => refFileRef.current?.click()}
                className="mt-1.5 border border-slate-200 rounded-lg bg-white px-3 py-3 flex items-center gap-3 hover:border-blue-400 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600 flex-1 truncate">
                  {referenceFileName || 'Symbol Legend.pdf'}
                </span>
                <span className="text-[10px] font-bold text-blue-600">EDIT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Demo toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useDemoData}
            onChange={(e) => onToggleDemo(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700 font-medium">Use Demo Data</span>
        </label>
      </div>

      {/* Footer */}
      <div className="px-6 pt-6 pb-6 border-t border-slate-100 space-y-4">
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || (!selectedFileName && !useDemoData)}
          className={clsx(
            'w-full py-3.5 rounded-lg font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2',
            isAnalyzing || (!selectedFileName && !useDemoData)
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0px_10px_15px_0px_rgba(28,57,142,0.05),0px_4px_6px_0px_rgba(28,57,142,0.05)]',
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-current" />
              Generate Digital Twin
            </>
          )}
        </button>
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-95"></div>
          <span>SYSTEM ONLINE</span>
        </div>
      </div>
    </div>
  );
};
