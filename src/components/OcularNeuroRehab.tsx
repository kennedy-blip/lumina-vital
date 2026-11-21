import React, { useEffect, useRef, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Crosshair,
  Eye,
  Infinity as InfinityIcon,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { saveOcularSessionToVault } from '../services/db';
import { vagalAudio } from '../services/vagalAudio';
import { PrismGlassCard } from './PrismGlassCard';

type OcularMode = 'SMOOTH_PURSUIT' | 'SACCADIC_PRISM' | 'GABOR_CONTRAST';

interface OcularNeuroRehabProps {
  hapticsEnabled: boolean;
  guardianSecondsLeft: number;
  guardianBreakActive: boolean;
  guardianBreakCountdown: number;
  onTriggerImmediateBreak: () => void;
  onResetGuardianTimer: () => void;
  onSessionSaved: () => void;
}

export const OcularNeuroRehab: React.FC<OcularNeuroRehabProps> = ({
  hapticsEnabled,
  guardianSecondsLeft,
  guardianBreakActive,
  guardianBreakCountdown,
  onTriggerImmediateBreak,
  onResetGuardianTimer,
  onSessionSaved,
}) => {
  const [mode, setMode] = useState<OcularMode>('SMOOTH_PURSUIT');
  const [pursuitSpeed, setPursuitSpeed] = useState(1.0);
  const [lissajousRatio, setLissajousRatio] = useState<'infinity' | '3:2'>('infinity');

  // Saccadic Prism Target State
  const [saccadePos, setSaccadePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [saccadeHits, setSaccadeHits] = useState(0);
  const [saccadeAvgMs, setSaccadeAvgMs] = useState(340);
  const lastJumpTimeRef = useRef<number>(Date.now());

  // Gabor Patch & Astigmatism Contrast State
  const [gaborAngleDeg, setGaborAngleDeg] = useState<number>(45);
  const [gaborContrast, setGaborContrast] = useState<number>(0.42);
  const [gaborScore, setGaborScore] = useState<number>(0);

  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const pursuitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gaborCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mode 1: Smooth Pursuit Liquid Orb along Lissajous / Figure-8 Curve
  useEffect(() => {
    if (mode !== 'SMOOTH_PURSUIT') return;
    let raf = 0;
    const trail: { x: number; y: number }[] = [];

    const render = (nowMs: number) => {
      const canvas = pursuitCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const t = (nowMs / 1000) * pursuitSpeed * 1.25;
      const rx = w * 0.38;
      const ry = h * 0.34;
      const cx = w / 2;
      const cy = h / 2;

      // Draw faint mathematical guide curve
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let s = 0; s <= Math.PI * 2 + 0.05; s += 0.05) {
        const gx =
          lissajousRatio === 'infinity' ? cx + rx * Math.sin(s) : cx + rx * Math.sin(3 * s);
        const gy =
          lissajousRatio === 'infinity'
            ? cy + ry * Math.sin(2 * s) * 0.65
            : cy + ry * Math.sin(2 * s);
        if (s === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();

      // Current Orb Coordinates
      const x =
        lissajousRatio === 'infinity' ? cx + rx * Math.sin(t) : cx + rx * Math.sin(3 * t * 0.55);
      const y =
        lissajousRatio === 'infinity'
          ? cy + ry * Math.sin(2 * t) * 0.65
          : cy + ry * Math.sin(2 * t * 0.55);

      trail.push({ x, y });
      if (trail.length > 28) trail.shift();

      // Liquid Comet Trail
      trail.forEach((pt, idx) => {
        const alpha = (idx / trail.length) * 0.35;
        const radius = 4 + (idx / trail.length) * 12;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
        ctx.fill();
      });

      // Glowing Refractive Liquid Orb
      const orbGrad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, 22);
      orbGrad.addColorStop(0, '#FFFFFF');
      orbGrad.addColorStop(0.35, '#34D399');
      orbGrad.addColorStop(0.75, '#06B6D4');
      orbGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [mode, pursuitSpeed, lissajousRatio]);

  // Mode 3: Render Real Mathematical Gabor Patch (Gaussian Envelope * Sinusoidal Grating)
  useEffect(() => {
    if (mode !== 'GABOR_CONTRAST') return;
    const canvas = gaborCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const img = ctx.createImageData(size, size);
    const rad = (gaborAngleDeg * Math.PI) / 180;
    const sigma = size * 0.19;
    const lambda = 16; // spatial wavelength in pixels
    const half = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - half;
        const dy = y - half;
        const xTheta = dx * Math.cos(rad) + dy * Math.sin(rad);
        const gaussian = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        const grating = Math.cos((2 * Math.PI * xTheta) / lambda);
        const val = 128 + 127 * gaborContrast * gaussian * grating;
        const idx = (y * size + x) * 4;
        img.data[idx] = val;
        img.data[idx + 1] = val;
        img.data[idx + 2] = val;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [mode, gaborAngleDeg, gaborContrast]);

  const handleSaccadeHit = () => {
    const reaction = Date.now() - lastJumpTimeRef.current;
    setSaccadeAvgMs((prev) => Math.round(prev * 0.7 + Math.min(reaction, 1200) * 0.3));
    setSaccadeHits((h) => h + 1);
    void vagalAudio.triggerBiofeedbackHaptic('systolic-tick', hapticsEnabled);

    // Jump to peripheral quadrant
    const nextX = 12 + Math.random() * 76;
    const nextY = 16 + Math.random() * 68;
    setSaccadePos({ x: nextX, y: nextY });
    lastJumpTimeRef.current = Date.now();
  };

  const handleGuessGaborOrientation = (guessDeg: number) => {
    const correct = guessDeg === gaborAngleDeg;
    if (correct) {
      setGaborScore((s) => s + 1);
      // Progressively lower contrast to train cortical V1 vernier acuity!
      setGaborContrast((c) => Number(Math.max(0.08, c * 0.86).toFixed(2)));
      vagalAudio.playOcularHarmonicChime();
    } else {
      setGaborContrast((c) => Number(Math.min(0.75, c * 1.18).toFixed(2)));
    }
    const angles = [0, 45, 90, 135];
    const nextAngle = angles[Math.floor(Math.random() * angles.length)];
    setGaborAngleDeg(nextAngle);
  };

  const handleCompleteRehabLog = async () => {
    const score =
      mode === 'SACCADIC_PRISM'
        ? Math.min(100, 60 + saccadeHits * 4)
        : mode === 'GABOR_CONTRAST'
        ? Math.min(100, 70 + gaborScore * 6)
        : 95;

    await saveOcularSessionToVault({
      mode,
      durationSec: 60,
      accuracyOrScore: score,
    });
    vagalAudio.playOcularHarmonicChime();
    void vagalAudio.triggerBiofeedbackHaptic('ocular-complete', hapticsEnabled);
    setSavedBanner(`Logged Ocular Rehab Session (${mode.replace('_', ' ')}) to Medical Vault!`);
    onSessionSaved();
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const mins = Math.floor(guardianSecondsLeft / 60);
  const secs = guardianSecondsLeft % 60;

  return (
    <div className="space-y-4">
      {/* Top Smart 20-20-20 Ergonomic Guardian Banner */}
      <PrismGlassCard innerClassName="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-teal-500/15 text-teal-300 border border-teal-400/30">
              Module 03 · Kinetic Ciliary Muscle Rehab & 20-20-20 Biofeedback
            </span>
            <h1 className="text-lg sm:text-xl font-bold mt-1">
              Ocular Neuro-Rehab & Computer Vision Syndrome Relief
            </h1>
            <p className="text-xs sm:text-sm text-[var(--lv-text-secondary)]">
              Relaxes ciliary accommodation spasm via mathematical Lissajous smooth pursuit, peripheral saccades, and V1 Gabor contrast training.
            </p>
          </div>

          {/* 20-20-20 Countdown Widget */}
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-black/25 border border-white/15">
            <div>
              <div className="text-[10px] font-mono uppercase text-[var(--lv-text-secondary)] flex items-center gap-1">
                <BellRing className="w-3 h-3 text-emerald-400" />
                <span>Smart 20-20-20 Guardian</span>
              </div>
              {guardianBreakActive ? (
                <div className="text-sm font-bold text-amber-300 font-mono">
                  LOOK 20 FT AWAY · {guardianBreakCountdown}s LEFT
                </div>
              ) : (
                <div className="text-lg font-extrabold font-mono">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onTriggerImmediateBreak}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/25 border border-emerald-400/45 text-emerald-200 flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Test 20s Chime Break</span>
            </button>

            <button
              type="button"
              onClick={onResetGuardianTimer}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15"
              title="Reset 20-Minute Countdown"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {savedBanner && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedBanner}</span>
          </div>
        )}

        {/* 3 Interactive Glass Canvas Therapy Mode Tabs */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('SMOOTH_PURSUIT')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                mode === 'SMOOTH_PURSUIT'
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200'
                  : 'bg-white/5 border-white/15 text-[var(--lv-text-secondary)]'
              }`}
            >
              <InfinityIcon className="w-4 h-4" />
              <span>1. Smooth Pursuit Liquid Orb</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('SACCADIC_PRISM')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                mode === 'SACCADIC_PRISM'
                  ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200'
                  : 'bg-white/5 border-white/15 text-[var(--lv-text-secondary)]'
              }`}
            >
              <Crosshair className="w-4 h-4" />
              <span>2. Saccadic Prism Targets</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('GABOR_CONTRAST')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                mode === 'GABOR_CONTRAST'
                  ? 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200'
                  : 'bg-white/5 border-white/15 text-[var(--lv-text-secondary)]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>3. Gabor Patch & Astigmatism Grid</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCompleteRehabLog}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
          >
            Log Completed Rehab Streak
          </button>
        </div>
      </PrismGlassCard>

      {/* Interactive Canvas Stage */}
      {mode === 'SMOOTH_PURSUIT' && (
        <PrismGlassCard innerClassName="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--lv-text-secondary)]">
              Keep your head still and track the refractive liquid orb smoothly with your eyes to release lateral/medial rectus tension.
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <label className="flex items-center gap-2">
                <span>Curve:</span>
                <select
                  value={lissajousRatio}
                  onChange={(e) => setLissajousRatio(e.target.value as 'infinity' | '3:2')}
                  className="bg-slate-900 text-white px-2 py-1 rounded-lg border border-white/20"
                >
                  <option value="infinity">Figure-8 Infinity (1:2)</option>
                  <option value="3:2">Harmonic Lissajous (3:2)</option>
                </select>
              </label>

              <label className="flex items-center gap-2">
                <span>Speed {pursuitSpeed.toFixed(1)}x</span>
                <input
                  type="range"
                  min="0.4"
                  max="2.2"
                  step="0.2"
                  value={pursuitSpeed}
                  onChange={(e) => setPursuitSpeed(Number(e.target.value))}
                  className="accent-emerald-400 w-24"
                />
              </label>
            </div>
          </div>

          <canvas
            ref={pursuitCanvasRef}
            width={820}
            height={300}
            className="w-full h-[270px] sm:h-[310px] rounded-2xl bg-slate-950/80 border border-white/10 block"
          />
        </PrismGlassCard>
      )}

      {mode === 'SACCADIC_PRISM' && (
        <PrismGlassCard innerClassName="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-[var(--lv-text-secondary)]">
              Snap your foveal gaze + tap each peripheral prism target as fast as possible.
            </span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-400 font-bold">Targets Hit: {saccadeHits}</span>
              <span className="text-cyan-400 font-bold">Avg Cadence: {saccadeAvgMs} ms</span>
            </div>
          </div>

          <div className="relative w-full h-[290px] rounded-2xl bg-slate-950/85 border border-white/15 overflow-hidden">
            {/* Center fixation cross */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
              <Eye className="w-8 h-8 text-slate-400" />
            </div>

            <button
              type="button"
              onClick={handleSaccadeHit}
              style={{ left: `${saccadePos.x}%`, top: `${saccadePos.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 via-emerald-400 to-rose-400 p-0.5 shadow-[0_0_28px_rgba(6,182,212,0.85)] transition-transform active:scale-90"
            >
              <span className="w-full h-full rounded-full bg-slate-950/60 flex items-center justify-center text-xs font-mono font-bold text-white">
                TAP
              </span>
            </button>
          </div>
        </PrismGlassCard>
      )}

      {mode === 'GABOR_CONTRAST' && (
        <PrismGlassCard innerClassName="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Left: Interactive Gabor Patch */}
            <div className="space-y-3 flex flex-col items-center">
              <div className="text-center">
                <h3 className="text-sm font-bold">Cortical V1 Gabor Contrast Acuity</h3>
                <p className="text-xs text-[var(--lv-text-secondary)]">
                  Identify grating orientation — contrast adapts down to {Math.round(gaborContrast * 100)}% threshold.
                </p>
              </div>

              <canvas
                ref={gaborCanvasRef}
                width={180}
                height={180}
                className="w-44 h-44 rounded-2xl border border-white/20 shadow-lg"
              />

              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { deg: 0, label: 'Vertical (0°)' },
                  { deg: 45, label: 'Diag 45°' },
                  { deg: 90, label: 'Horizontal (90°)' },
                  { deg: 135, label: 'Diag 135°' },
                ].map((btn) => (
                  <button
                    key={btn.deg}
                    type="button"
                    onClick={() => handleGuessGaborOrientation(btn.deg)}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono bg-white/10 hover:bg-cyan-500/25 border border-white/20"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <div className="text-xs font-mono text-emerald-400">
                Verified Acuity Hits: {gaborScore} · Contrast {Math.round(gaborContrast * 100)}%
              </div>
            </div>

            {/* Right: Radial Astigmatism Fan Dial Self-Check */}
            <div className="space-y-3 flex flex-col items-center">
              <div className="text-center">
                <h3 className="text-sm font-bold">12-Meridian Astigmatism Contrast Dial</h3>
                <p className="text-xs text-[var(--lv-text-secondary)]">
                  Cover one eye at 40cm: all radial spokes should appear equally crisp & uniform in darkness.
                </p>
              </div>

              <div className="w-48 h-48 rounded-full bg-slate-950 border border-white/20 p-3 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {Array.from({ length: 12 }, (_, idx) => {
                    const angle = idx * 15;
                    return (
                      <line
                        key={angle}
                        x1="100"
                        y1="14"
                        x2="100"
                        y2="186"
                        stroke="#F8FAFC"
                        strokeWidth="2.2"
                        transform={`rotate(${angle} 100 100)`}
                      />
                    );
                  })}
                  <circle cx="100" cy="100" r="16" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
                  <circle cx="100" cy="100" r="3.5" fill="#10B981" />
                </svg>
              </div>
              <span className="text-[11px] font-mono text-[var(--lv-text-secondary)]">
                Directional blur along a single axis indicates cylindrical corneal fatigue.
              </span>
            </div>
          </div>
        </PrismGlassCard>
      )}
    </div>
  );
};
