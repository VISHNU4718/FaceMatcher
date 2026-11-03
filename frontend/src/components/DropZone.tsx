import { useRef, useState, useEffect, DragEvent } from 'react';
import { Image as ImageIcon, Film, X } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../App';
import { compressImage } from '../lib/api';
import { fileProblem } from '../lib/validation';

interface Props {
  accept: 'image' | 'video';
  file: File | null;
  onFile: (f: File | null) => void;
  label: string;
  previewUrl?: string | null;
}


export default function DropZone({ accept, file, onFile, label, previewUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const { toast } = useToast();

  const acceptAttr = accept === 'image' ? 'image/jpeg,image/png,image/webp,image/heic' : 'video/mp4,video/avi,video/quicktime';
  const Icon = accept === 'image' ? ImageIcon : Film;

  useEffect(() => {
    if (previewUrl) {
      setPreviewSrc(previewUrl);
      return;
    }
    if (file && accept === 'image') {
      const url = URL.createObjectURL(file);
      setPreviewSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewSrc(null);
  }, [file, previewUrl, accept]);

  async function handleFile(incoming: File) {
    if (incoming.name.toLowerCase().endsWith('.heic')) {
      toast('HEIC files may not be supported in all browsers — convert to JPG if issues occur.', 'warning');
    }
    const problem = fileProblem(incoming, accept);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    if (accept === 'image') {
      const compressed = await compressImage(incoming, 800);
      onFile(compressed);
    } else {
      onFile(incoming);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</span>
      <div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'relative glass glass-hover flex flex-col items-center justify-center gap-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden',
          dragging ? 'border-blue-500/70 bg-blue-500/5' : 'border-transparent',
          file ? 'min-h-[180px]' : 'min-h-[160px] py-8 px-6',
        )}
      >
        {file && accept === 'image' && previewSrc ? (
          <>
            <img
              src={previewSrc}
              alt="preview"
              className="w-full h-full object-cover max-h-[220px] rounded-xl"
            />
            <div className="absolute inset-0 flex items-start justify-end p-3">
              <button
                onClick={(e) => { e.stopPropagation(); onFile(null); }}
                className="bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </>
        ) : file && accept === 'video' ? (
          <div className="w-full px-4 py-4 flex flex-col items-center gap-2">
            <Film size={32} className="text-blue-400" />
            <p className="text-sm text-slate-200 font-sans font-medium text-center">{file.name}</p>
            <p className="text-xs text-slate-500 font-mono">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <button
              onClick={(e) => { e.stopPropagation(); onFile(null); }}
              className="mt-1 text-xs text-slate-500 hover:text-red-400 underline transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Icon size={22} className="text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-300 font-sans">
                Drop {accept === 'image' ? 'image' : 'video'} or{' '}
                <span className="text-blue-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-600 mt-1 font-mono">Max {accept === 'image' ? '5 MB' : '100 MB'}</p>
            </div>
          </>
        )}

        {dragging && (
          <div className="absolute inset-0 border-2 border-blue-500 rounded-2xl pointer-events-none" />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}
