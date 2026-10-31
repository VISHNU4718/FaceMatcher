import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Film,
  Camera,
  Database,
  Smile,
  Crosshair,
  ChevronLeft,
  Command,
  Activity,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useEngine } from '../lib/useEngine';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: string;
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/video', icon: Film, label: 'Video Match' },
  { to: '/live', icon: Camera, label: 'Live Camera' },
  { to: '/database', icon: Database, label: 'Face DB' },
  { to: '/emotion', icon: Smile, label: 'Emotion' },
];

const COLLAPSE_KEY = 'fm.sidebar.collapsed';

interface SidebarProps {
  onOpenPalette: () => void;
  collapsed: boolean;
  setCollapsed: (b: boolean) => void;
}

export default function Sidebar({ onOpenPalette, collapsed, setCollapsed }: SidebarProps) {
  const engine = useEngine();
  const healthy = engine.status === 'ready' ? true : engine.status === 'error' ? false : null;

  const width = collapsed ? 72 : 240;

  return (
    <motion.aside
      animate={{ width }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(13,18,38,0.92), rgba(10,15,30,0.92))',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(28px) saturate(150%)',
        WebkitBackdropFilter: 'blur(28px) saturate(150%)',
      }}
    >
      <div className="scan-line" />

      {/* Workspace header */}
      <div className="px-3 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
            <Crosshair size={17} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <p className="font-syne font-bold text-white text-sm leading-none tracking-tight">FaceMatcher</p>
                <p className="text-[10px] font-mono text-slate-500 mt-1 tracking-wider">VISION · v1.0</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              localStorage.setItem(COLLAPSE_KEY, String(next));
            }}
            className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft size={13} className={clsx('transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Search / palette trigger */}
      <div className="px-3 pt-3">
        <button
          onClick={onOpenPalette}
          className={clsx(
            'w-full flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] hover:bg-white/5 hover:border-white/15 transition-all px-2.5 h-9 text-left',
          )}
        >
          <Command size={13} className="text-slate-400 shrink-0" />
          {!collapsed && (
            <>
              <span className="text-xs text-slate-400 flex-1">Search…</span>
              <kbd className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-2 pt-2 pb-2 text-[10px] font-mono text-slate-600 tracking-[0.2em] uppercase">
            Workspace
          </p>
        )}
        {PRIMARY.map(({ to, icon: Icon, label, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'relative flex items-center gap-2.5 rounded-lg text-sm font-sans transition-all duration-150 h-9',
                collapsed ? 'px-2.5 justify-center' : 'px-2.5',
                isActive
                  ? 'bg-white/[0.06] text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="navIndicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-gradient-to-b from-blue-400 to-violet-400"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon size={15} className={isActive ? 'text-blue-300' : 'text-slate-500'} />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate font-medium">{label}</span>
                    {badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}

        {!collapsed && (
          <p className="px-2 pt-5 pb-2 text-[10px] font-mono text-slate-600 tracking-[0.2em] uppercase">
            System
          </p>
        )}
        <SystemRow icon={Activity} label="Models" value="face-api.js" collapsed={collapsed} />
        <SystemRow icon={Settings} label="Runs" value="In browser" collapsed={collapsed} />
      </nav>

      {/* Health */}
      <div className="px-3 py-3 border-t border-white/5">
        <div
          className={clsx(
            'rounded-lg border bg-white/[0.02] px-2.5 py-2',
            healthy === false ? 'border-rose-500/30' : 'border-white/8',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div
                className={clsx(
                  'w-2 h-2 rounded-full',
                  healthy === null ? 'bg-amber-400' : healthy ? 'bg-emerald-400' : 'bg-rose-400',
                )}
              />
              {healthy === true && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-50" />
              )}
            </div>
            {!collapsed && (
              <>
                <span className="text-[11px] font-mono text-slate-300 flex-1">
                  {healthy === null ? 'Loading models' : healthy ? 'Models ready' : 'Models failed'}
                </span>
                {engine.backend && (
                  <span className="text-[10px] font-mono text-slate-500">{engine.backend}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

function SystemRow({
  icon: Icon,
  label,
  value,
  collapsed,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  value: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center h-9 text-slate-500" title={`${label}: ${value}`}>
        <Icon size={14} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 px-2.5 h-8 text-[11px]">
      <Icon size={13} className="text-slate-600" />
      <span className="text-slate-500 flex-1">{label}</span>
      <span className="font-mono text-slate-400">{value}</span>
    </div>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  });
  return [collapsed, setCollapsed] as const;
}
