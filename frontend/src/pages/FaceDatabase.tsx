import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Search, UserCheck, Users, Database, X, Calendar } from 'lucide-react';
import { useToast } from '../App';
import { deleteFace, errorMessage, identifyFaces, listFaces, MAX_NAME_LENGTH, registerFace } from '../lib/api';
import { useEngine } from '../lib/useEngine';
import { Face, IdentifyResponse, IdentifyResult } from '../types';
import ConfidenceRing from '../components/ConfidenceRing';
import Skeleton from '../components/Skeleton';
import PageHeader from '../components/PageHeader';
import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import { recordActivity } from '../lib/activity';

const PAGE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function FaceDatabase() {
  const { toast } = useToast();
  useEngine();
  const [faces, setFaces] = useState<Face[]>([]);
  const [loadingFaces, setLoadingFaces] = useState(true);
  const [registerName, setRegisterName] = useState('');
  const [registerFile, setRegisterFile] = useState<File | null>(null);
  const [registerPreview, setRegisterPreview] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [identifyFile, setIdentifyFile] = useState<File | null>(null);
  const [identifyPreview, setIdentifyPreview] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState<IdentifyResponse | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Face | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const regFileRef = useRef<HTMLInputElement>(null);
  const idFileRef = useRef<HTMLInputElement>(null);

  const filtered = faces.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  async function loadFaces() {
    setLoadingFaces(true);
    try {
      setFaces(await listFaces());
    } catch {
      toast('Failed to load face database.', 'error');
    } finally {
      setLoadingFaces(false);
    }
  }

  useEffect(() => { loadFaces(); }, []);

  useEffect(() => {
    if (identifyResult && identifyPreview) drawAnnotations(identifyResult.results);
  }, [identifyResult, identifyPreview]);

  useEffect(() => {
    if (!registerFile) {
      setRegisterPreview(null);
      return;
    }
    const url = URL.createObjectURL(registerFile);
    setRegisterPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [registerFile]);

  useEffect(() => {
    if (!identifyFile) {
      setIdentifyPreview(null);
      return;
    }
    const url = URL.createObjectURL(identifyFile);
    setIdentifyPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [identifyFile]);

  async function handleRegister() {
    if (!registerName.trim()) { toast('Enter a name.', 'warning'); return; }
    if (!registerFile) { toast('Upload an image.', 'warning'); return; }
    setRegistering(true);
    try {
      await registerFace(registerName, registerFile);
      recordActivity({ kind: 'register', title: `Registered ${registerName.trim()}`, detail: 'Saved in this browser' });
      toast(`"${registerName}" registered!`, 'success');
      setRegisterName('');
      setRegisterFile(null);
      setRegisterPreview(null);
      loadFaces();
    } catch (err: unknown) {
      toast(errorMessage(err, 'Registration failed.'), 'error');
    } finally {
      setRegistering(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    try {
      await deleteFace(id);
      setFaces((p) => p.filter((f) => f.id !== id));
      recordActivity({ kind: 'delete', title: `Removed ${name}`, detail: 'Deleted from gallery' });
      toast(`"${name}" removed.`, 'success');
    } catch {
      toast('Delete failed.', 'error');
    }
  }

  async function handleIdentify() {
    if (!identifyFile) { toast('Upload an image to identify.', 'warning'); return; }
    setIdentifying(true);
    setIdentifyResult(null);
    try {
      const data = await identifyFaces(identifyFile);
      setIdentifyResult(data);
      const named = data.results.filter((r) => r.name !== 'Unknown').length;
      recordActivity({
        kind: 'identify',
        title: `Identified ${named}/${data.face_count} face${data.face_count === 1 ? '' : 's'}`,
        detail: data.results.map((r) => r.name).filter((n) => n !== 'Unknown').slice(0, 3).join(', ') || 'No matches in DB',
        meta: { matches: named, total: data.face_count },
      });
      toast(`${data.face_count} face(s) analysed.`, 'info');
    } catch (err: unknown) {
      toast(errorMessage(err, 'Identification failed.'), 'error');
    } finally {
      setIdentifying(false);
    }
  }

  function drawAnnotations(results: IdentifyResult[]) {
    const canvas = canvasRef.current;
    if (!canvas || !identifyPreview) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      for (const r of results) {
        const [top, right, bottom, left] = r.bbox;
        const color = r.name !== 'Unknown' ? '#22c55e' : '#ef4444';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, right - left, bottom - top);
        ctx.fillStyle = color + 'cc';
        ctx.fillRect(left, bottom, right - left, 22);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px DM Sans, sans-serif';
        ctx.fillText(`${r.name} ${(r.confidence * 100).toFixed(0)}%`, left + 4, bottom + 15);
      }
    };
    img.src = identifyPreview;
  }

  return (
    <motion.div {...PAGE} className="flex flex-col gap-6">
      <PageHeader
        icon={Database}
        eyebrow="MODULE · 03"
        title="Face Database"
        accent="#10B981, #2DD4BF"
        subtitle="Register known faces, then identify people in any image."
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DBStat label="Enrolled" value={faces.length} accent="#10B981" />
        <DBStat label="Matching" value={filtered.length} accent="#3B82F6" />
        <DBStat label="Storage" value="This browser" accent="#8B5CF6" />
        <DBStat label="Engine" value="128-D" accent="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        {/* Face grid */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 h-10 rounded-xl border border-white/8 bg-white/[0.02] focus-within:border-blue-500/40 transition-colors px-3">
              <Search size={14} className="text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                className="bg-transparent outline-none flex-1 text-sm text-slate-200 placeholder:text-slate-600"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
                  <X size={13} />
                </button>
              )}
            </div>
            <Chip variant="blue" icon={<Users size={10} />}>
              {filtered.length} / {faces.length}
            </Chip>
          </div>

          {loadingFaces ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              <Skeleton className="h-[160px]" count={8} />
            </div>
          ) : faces.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No faces registered"
              description="Use the right panel to upload a photo and register a known face."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches for that query"
              description={`Nothing matches "${query}". Clear the search to see all faces.`}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence>
                {filtered.map((f) => (
                  <motion.button
                    key={f.id}
                    layout
                    onClick={() => setSelected(f)}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    className="group relative flex flex-col gap-2 p-2.5 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all text-left overflow-hidden"
                  >
                    <div className="relative">
                      <img
                        src={f.image_path}
                        alt={f.name}
                        className="w-full aspect-[5/4] object-cover rounded-lg bg-navy-800 ring-1 ring-white/5"
                      />
                      <div className="absolute inset-0 rounded-lg ring-1 ring-emerald-500/0 group-hover:ring-emerald-500/30 transition-colors pointer-events-none" />
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/70 text-emerald-300 border border-emerald-500/30">
                        #{f.id}
                      </span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleDelete(f.id, f.name); }}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-rose-500/80 text-white rounded-md p-1 transition-all cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </span>
                    </div>
                    <p className="font-syne font-semibold text-sm text-white truncate">{f.name}</p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1"><Calendar size={9} />{new Date(f.created_at).toLocaleDateString()}</span>
                      <span className="opacity-0 group-hover:opacity-100 text-blue-300 transition-opacity">view →</span>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Register */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-emerald-300" />
                <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">Enroll Face</span>
              </div>
              <Chip variant="emerald">/register</Chip>
            </div>

            <label
              className="relative flex flex-col items-center justify-center gap-2 h-[130px] border-2 border-dashed border-blue-500/20 rounded-xl cursor-pointer hover:border-blue-500/40 transition-colors overflow-hidden"
              onClick={() => !registerPreview && regFileRef.current?.click()}
            >
              {registerPreview ? (
                <>
                  <img src={registerPreview} alt="reg" className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRegisterFile(null); setRegisterPreview(null); }}
                    className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </>
              ) : (
                <>
                  <UserCheck size={22} className="text-slate-600" />
                  <span className="text-xs text-slate-600 font-sans">Upload face photo</span>
                </>
              )}
            </label>
            <input
              ref={regFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 5 * 1024 * 1024) toast('Image too large (max 5 MB).', 'error');
                else if (f) setRegisterFile(f);
                e.target.value = '';
              }}
            />

            <input
              type="text"
              className="input-dark"
              placeholder="Full name"
              maxLength={MAX_NAME_LENGTH}
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            />

            <button
              onClick={handleRegister}
              disabled={registering}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {registering ? 'Registering…' : <><Plus size={14} /> Register</>}
            </button>
          </div>

          {/* Identify */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={14} className="text-blue-300" />
                <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">Identify in Image</span>
              </div>
              <Chip variant="blue">/identify</Chip>
            </div>

            <label
              className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-blue-500/20 rounded-xl cursor-pointer hover:border-blue-500/40 transition-colors overflow-hidden"
              style={{ minHeight: identifyPreview ? 'auto' : '100px' }}
              onClick={() => !identifyPreview && idFileRef.current?.click()}
            >
              {identifyPreview ? (
                <div className="w-full relative">
                  {identifyResult ? (
                    <canvas ref={canvasRef} className="w-full rounded-xl" />
                  ) : (
                    <img src={identifyPreview} alt="id" className="w-full rounded-xl" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIdentifyFile(null); setIdentifyPreview(null); setIdentifyResult(null); }}
                    className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ) : (
                <>
                  <Search size={20} className="text-slate-600" />
                  <span className="text-xs text-slate-600 font-sans">Upload image to identify</span>
                </>
              )}
            </label>
            <input
              ref={idFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 5 * 1024 * 1024) toast('Image too large (max 5 MB).', 'error');
                else if (f) { setIdentifyFile(f); setIdentifyResult(null); }
                e.target.value = '';
              }}
            />

            <button
              onClick={handleIdentify}
              disabled={identifying || !identifyFile}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {identifying ? 'Identifying…' : <><Search size={14} /> Identify</>}
            </button>

            {/* Results list */}
            {identifyResult && identifyResult.results.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                {identifyResult.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 bg-navy-800/50 rounded-xl px-3 py-2">
                    <ConfidenceRing confidence={r.confidence} size={40} />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-syne font-semibold text-white">{r.name}</span>
                      <span className="text-xs font-mono text-slate-600">Face #{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <FaceDrawer
            face={selected}
            onClose={() => setSelected(null)}
            onDelete={() => {
              handleDelete(selected.id, selected.name);
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DBStat({ label, value, accent }: { label: string; value: React.ReactNode; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20" style={{ background: accent }} />
      <p className="relative text-[10px] font-mono text-slate-500 tracking-widest uppercase">{label}</p>
      <p className="relative font-syne font-bold text-xl text-white mt-1 leading-none">{value}</p>
    </div>
  );
}

function FaceDrawer({ face, onClose, onDelete }: { face: Face; onClose: () => void; onDelete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex justify-end"
      style={{ background: 'rgba(2,6,16,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 360 }}
        animate={{ x: 0 }}
        exit={{ x: 360 }}
        transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] h-full overflow-y-auto border-l border-white/10"
        style={{ background: 'linear-gradient(180deg, rgba(20,28,52,0.95), rgba(13,18,38,0.95))' }}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/8">
          <span className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase">Face Profile</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10">
            <img src={face.image_path} alt={face.name} className="w-full aspect-square object-cover" />
            <div className="absolute inset-0 ring-1 ring-blue-500/20 rounded-xl pointer-events-none" />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
              ID #{face.id}
            </div>
          </div>
          <h3 className="font-syne font-bold text-2xl text-white mt-4">{face.name}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <DrawerMeta label="Enrolled" value={new Date(face.created_at).toLocaleDateString()} />
            <DrawerMeta label="Image hash" value={face.image_path.split('/').pop()?.slice(0, 8) ?? '—'} />
            <DrawerMeta label="Encoding" value="128-D face-api.js" />
            <DrawerMeta label="Status" value={<span className="text-emerald-300">Active</span>} />
          </div>
          <button
            onClick={onDelete}
            className="mt-6 w-full h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 font-syne text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={14} /> Remove from database
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DrawerMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2">
      <p className="text-[9px] font-mono text-slate-500 tracking-widest uppercase">{label}</p>
      <p className="text-xs font-mono text-slate-200 mt-1 truncate">{value}</p>
    </div>
  );
}
