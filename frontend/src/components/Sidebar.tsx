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
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <img src={logoImg} alt="AutoLOTO" className="h-8 object-contain" />
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        {/* Ingestion */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3">
            <h3 className="text-lg font-bold text-slate-800">Schematic Ingestion</h3>
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
              'border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group',
              isDragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50/50',
            )}
          >
            <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">
              {selectedFileName || 'Drop Schematic Here'}
            </p>
            <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG supported</p>
          </div>
        </div>

        {/* Model Config */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3">
            <h3 className="text-lg font-bold text-slate-800">VLM Engine</h3>
          </div>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-sm px-4 py-3 text-sm text-slate-700 font-medium appearance-none focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-shadow shadow-sm"
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Reference Upload */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-l-4 border-blue-600 pl-3">
            <h3 className="text-lg font-bold text-slate-800">Symbol Legend</h3>
          </div>
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
            className="border border-slate-200 rounded-sm bg-white p-4 flex items-center gap-3 hover:border-blue-400 transition-colors cursor-pointer shadow-sm group"
          >
            <div className="bg-blue-50 p-2 rounded-sm group-hover:bg-blue-100 transition-colors">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-700">
                {referenceFileName || 'Upload Legend'}
              </p>
              <p className="text-xs text-slate-500">Optional context</p>
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
      <div className="p-6 border-t border-slate-100 bg-slate-50">
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || (!selectedFileName && !useDemoData)}
          className={clsx(
            'w-full py-4 rounded-sm font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 uppercase',
            isAnalyzing || (!selectedFileName && !useDemoData)
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg',
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              ANALYZING...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-current" />
              ANALYZE CIRCUIT
            </>
          )}
        </button>
        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>v2.4.1</span>
          <span className="flex items-center gap-1 text-emerald-600 font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> CONNECTED
          </span>
        </div>
      </div>
    </div>
  );
};
