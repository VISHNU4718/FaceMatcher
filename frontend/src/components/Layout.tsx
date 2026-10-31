import { ReactNode, useCallback, useEffect, useState } from 'react';
import Sidebar, { useSidebarCollapsed } from './Sidebar';
import { useEngine } from '../lib/useEngine';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bell, Command as CommandIcon } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import CommandPalette from './CommandPalette';

const CRUMB: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Overview', title: 'Dashboard' },
  '/video': { eyebrow: 'Module 01', title: 'Video Match' },
  '/live': { eyebrow: 'Module 02', title: 'Live Camera' },
  '/database': { eyebrow: 'Module 03', title: 'Face Database' },
  '/emotion': { eyebrow: 'Module 04', title: 'Emotion Detection' },
};

export default function Layout({ children }: { children: ReactNode }) {
  const engine = useEngine();
  const showBanner = engine.status === 'loading' || engine.status === 'error';
  const location = useLocation();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ml = collapsed ? 72 : 240;
  const crumb = CRUMB[location.pathname] ?? CRUMB['/'];

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar onOpenPalette={openPalette} collapsed={collapsed} setCollapsed={setCollapsed} />
      <main
        className="flex-1 flex flex-col min-h-screen transition-[margin] duration-300"
        style={{ marginLeft: ml }}
      >
        {/* Top bar */}
        <div
          className="sticky top-0 z-20 flex items-center gap-3 h-14 px-6 lg:px-8 border-b border-white/[0.05]"
          style={{
            background: 'linear-gradient(180deg, rgba(10,15,30,0.85), rgba(10,15,30,0.65))',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/" className="text-[11px] font-mono text-slate-500 tracking-widest uppercase hover:text-slate-300 transition-colors">
              FaceMatcher
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-[11px] font-mono text-slate-500 tracking-widest uppercase">{crumb.eyebrow}</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-syne font-semibold text-white truncate">{crumb.title}</span>
          </div>

          <div className="flex-1" />

          <button
            onClick={openPalette}
            className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-lg border border-white/8 bg-white/[0.02] hover:bg-white/5 transition-all text-xs text-slate-400"
          >
            <CommandIcon size={12} />
            <span>Search</span>
            <kbd className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘K</kbd>
          </button>

          <button className="w-8 h-8 rounded-lg border border-white/8 bg-white/[0.02] hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <Bell size={14} />
          </button>

          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center font-syne font-bold text-white text-xs shadow-md shadow-blue-500/30">
            V
          </div>
        </div>

        <AnimatePresence>
          {showBanner && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2.5">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300 font-mono">
                  {engine.status === 'error'
                    ? `Could not load the face models: ${engine.error ?? 'unknown error'}`
                    : 'Loading face models (about 13 MB, cached after the first visit)…'}
                </span>
                {engine.status === 'error' && (
                  <button onClick={engine.retry} className="ml-auto text-xs font-mono text-amber-200 underline">
                    Retry
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 p-6 lg:p-8 w-full max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
