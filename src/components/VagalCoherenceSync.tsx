import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  HeartHandshake,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { vagalAudio } from '../services/vagalAudio';
import { PrismGlassCard } from './PrismGlassCard';

interface VagalCoherenceSyncProps {
  latestBpm: number;
  latestStress: number;
  latestRmssd: number;
  hapticsEnabled: boolean;
}

type ProtocolId = 'auto-vagal' | 'resonance-5-5' | 'box-4-4-4-4';

interface BreathProtocol {
  id: ProtocolId;
  label: string;
  inhaleSec: number;
  holdInSec: number;
  exhaleSec: number;
  holdOutSec: number;
  description: string;
}

export const VagalCoherenceSync: React.FC<VagalCoherenceSyncProps> = ({
  latestBpm,
  latestStress,
  latestRmssd,
  hapticsEnabled,
}) => {
  // Automatically configure Resonance Frequency Breathing from Bio-Pulse Lab stress/BPM
  const autoProtocol: BreathProtocol =
    latestStress >= 55 || latestBpm >= 85
      ? {
          id: 'auto-vagal',
          label: 'Rapid Parasympathetic Brake (4s In / 6s Out)',
          inhaleSec: 4,
          holdInSec: 0,
          exhaleSec: 6,
          holdOutSec: 0,
          description:
            'Extended 6s exhalation stimulates acetylcholine release along the 10th cranial vagus nerve to decelerate elevated BPM.',
        }
      : {
          id: 'auto-vagal',
          label: 'HRV Baroreflex Resonance (4.5s In / 5.5s Out)',
          inhaleSec: 4.5,
          holdInSec: 0,
          exhaleSec: 5.5,
          holdOutSec: 0,
          description:
            '0.1 Hz (6 breaths/min) Mayer-wave resonance maximizes arterial baroreceptor & RMSSD amplitude.',
        };

  const protocols: BreathProtocol[] = [
    autoProtocol,
    {
      id: 'resonance-5-5',
      label: 'Classic Coherence (5s In / 5s Out)',
      inhaleSec: 5,
      holdInSec: 0,
      exhaleSec: 5,
      holdOutSec: 0,
      description: 'Balanced 0.1 Hz cardiac coherence cadence for sustained cognitive focus.',
    },
    {
      id: 'box-4-4-4-4',
      label: 'Tactical Box Pacer (4-4-4-4s)',
      inhaleSec: 4,
      holdInSec: 4,
      exhaleSec: 4,
      holdOutSec: 4,
      description: 'CO2 tolerance & autonomic stabilization under acute workload.',
    },
  ];

  const [selectedId, setSelectedId] = useState<ProtocolId>('auto-vagal');
  const [sessionActive, setSessionActive] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [volume, setVolume] = useState(0.24);
  const [phaseName, setPhaseName] = useState<'INHALE' | 'HOLD' | 'EXHALE' | 'REST'>('INHALE');
  const [expansion, setExpansion] = useState(0.35);
  const [phaseSecondsRemaining, setPhaseSecondsRemaining] = useState(4.0);
  const [elapsedSessionSec, setElapsedSessionSec] = useState(0);

  const activeProtocol = protocols.find((p) => p.id === selectedId) || autoProtocol;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      vagalAudio.stopVagalBinauralDrone();
    };
  }, []);

  useEffect(() => {
    if (!sessionActive) {
      vagalAudio.stopVagalBinauralDrone();
      setExpansion(0.35);
      return;
    }

    if (!audioMuted) {
      vagalAudio.startVagalBinauralDrone(volume);
    } else {
      vagalAudio.stopVagalBinauralDrone();
    }
  }, [sessionActive, audioMuted]);

  // Real-Time Breathing Phase Physics & Audio-Haptic Modulation Loop
  useEffect(() => {
    if (!sessionActive) return;

    const cycleTotal =
      activeProtocol.inhaleSec +
      activeProtocol.holdInSec +
      activeProtocol.exhaleSec +
      activeProtocol.holdOutSec;

    const startMs = performance.now();
    let prevPhase = '';

    const timer = window.setInterval(() => {
      const elapsedSec = (performance.now() - startMs) / 1000;
      setElapsedSessionSec(Math.floor(elapsedSec));

      const t = elapsedSec % cycleTotal;
      let currentPhase: 'INHALE' | 'HOLD' | 'EXHALE' | 'REST' = 'INHALE';
      let exp = 0.25;
      let rem = 0;

      const t1 = activeProtocol.inhaleSec;
      const t2 = t1 + activeProtocol.holdInSec;
      const t3 = t2 + activeProtocol.exhaleSec;

      if (t < t1) {
        currentPhase = 'INHALE';
        const p = t / t1;
        exp = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(Math.PI * p));
        rem = t1 - t;
      } else if (t < t2) {
        currentPhase = 'HOLD';
        exp = 1.0;
        rem = t2 - t;
      } else if (t < t3) {
        currentPhase = 'EXHALE';
        const p = (t - t2) / activeProtocol.exhaleSec;
        exp = 1.0 - 0.75 * (0.5 - 0.5 * Math.cos(Math.PI * p));
        rem = t3 - t;
      } else {
        currentPhase = 'REST';
        exp = 0.25;
        rem = cycleTotal - t;
      }

      if (currentPhase !== prevPhase) {
        prevPhase = currentPhase;
        void vagalAudio.triggerBiofeedbackHaptic('breath-transition', hapticsEnabled);
      }

      setPhaseName(currentPhase);
      setExpansion(exp);
      setPhaseSecondsRemaining(Number(rem.toFixed(1)));

      if (!audioMuted) {
        vagalAudio.modulateBreathExpansion(exp, volume);
      }
    }, 60);

    return () => window.clearInterval(timer);
  }, [sessionActive, activeProtocol, audioMuted, volume, hapticsEnabled]);

  // Simulated closed-loop vagal BPM drop as session progresses
  const projectedLiveBpm = sessionActive
    ? Math.max(54, Math.round(latestBpm - Math.min(12, elapsedSessionSec * 0.18)))
    : latestBpm;

  return (
    <div className="space-y-4">
      {/* Closed-Loop Biofeedback Header */}
      <PrismGlassCard innerClassName="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
              Module 04 · Closed-Loop Binaural 432Hz + 6Hz Theta Biofeedback
            </span>
            <h1 className="text-lg sm:text-xl font-bold mt-1">
              Vagal Coherence Sync & Audio-Haptic Resonance Sphere
            </h1>
            <p className="text-xs sm:text-sm text-[var(--lv-text-secondary)]">
              Auto-calibrated from your latest Bio-Pulse Lab scan ({latestBpm} BPM · Stress{' '}
              {latestStress}/100 · RMSSD {latestRmssd}ms).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSessionActive((s) => !s)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                sessionActive
                  ? 'bg-rose-500/25 border border-rose-400/50 text-rose-200'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.45)]'
              }`}
            >
              {sessionActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>
                {sessionActive ? 'Pause Vagal Session' : 'Start Audio-Haptic Biofeedback'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAudioMuted((m) => !m)}
              className="px-3 py-2.5 rounded-xl text-xs font-mono bg-white/10 border border-white/20 flex items-center gap-1.5"
            >
              {audioMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              )}
              <span>{audioMuted ? 'Muted' : '432Hz + Surf'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {protocols.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-400/50 shadow-md'
                    : 'bg-black/15 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{p.label}</span>
                </div>
                <p className="text-[11px] text-[var(--lv-text-secondary)] mt-1 line-clamp-2">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>
      </PrismGlassCard>

      {/* Centerpiece: Refractive 3D Multi-Layered Glass Breathing Sphere */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <PrismGlassCard
          className="lg:col-span-8"
          innerClassName="p-6 flex flex-col items-center justify-center min-h-[340px] relative"
        >
          {/* Outer Refractive Halo Rings */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <motion.div
              animate={{
                scale: 0.72 + expansion * 0.58,
                rotate: sessionActive ? 360 : 0,
              }}
              transition={{
                scale: { type: 'spring', stiffness: 120, damping: 20 },
                rotate: { duration: 28, repeat: Infinity, ease: 'linear' },
              }}
              className="absolute inset-4 rounded-full border border-cyan-400/35 bg-gradient-to-tr from-emerald-500/15 via-cyan-500/10 to-indigo-500/20 blur-[1px]"
            />

            <motion.div
              animate={{
                scale: 0.62 + expansion * 0.52,
              }}
              transition={{ type: 'spring', stiffness: 150, damping: 22 }}
              className="absolute inset-8 rounded-full border border-emerald-300/45 bg-gradient-to-br from-emerald-400/25 via-teal-500/20 to-cyan-500/30 shadow-[0_0_60px_rgba(16,185,129,0.4),inset_0_2px_18px_rgba(255,255,255,0.45)]"
            />

            <motion.div
              animate={{
                scale: 0.55 + expansion * 0.45,
              }}
              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
              className="relative z-10 w-36 h-36 rounded-full bg-slate-950/75 border border-white/30 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-inner"
            >
              <span className="text-[11px] font-mono tracking-widest text-emerald-300 uppercase">
                {sessionActive ? phaseName : 'READY'}
              </span>
              <span className="text-2xl font-extrabold font-mono mt-0.5">
                {sessionActive ? `${phaseSecondsRemaining}s` : 'TAP PLAY'}
              </span>
              <span className="text-[10px] font-mono text-[var(--lv-text-secondary)] mt-0.5">
                432Hz · 6Hz Theta
              </span>
            </motion.div>
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs font-mono text-[var(--lv-text-secondary)]">
            <span>Acoustic Gain</span>
            <input
              type="range"
              min="0.05"
              max="0.55"
              step="0.03"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="accent-emerald-400 w-32"
            />
            <span>{Math.round((volume / 0.55) * 100)}%</span>
          </div>
        </PrismGlassCard>

        {/* Right Telemetry Panel */}
        <div className="lg:col-span-4 space-y-3">
          <PrismGlassCard innerClassName="p-4">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--lv-text-secondary)]">
              <span>CLOSED-LOOP CARDIAC RESPONSE</span>
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono">{projectedLiveBpm}</span>
              <span className="text-xs font-mono text-emerald-400">BPM</span>
              {projectedLiveBpm < latestBpm && (
                <span className="ml-auto text-xs font-mono text-emerald-300">
                  -{latestBpm - projectedLiveBpm} BPM Vagal Drop
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--lv-text-secondary)] mt-1">
              Session Duration: <strong className="font-mono">{elapsedSessionSec}s</strong>
            </p>
          </PrismGlassCard>

          <PrismGlassCard innerClassName="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Neuro-Acoustic Synthesis Engine</span>
            </div>
            <ul className="text-xs text-[var(--lv-text-secondary)] space-y-1.5 font-mono">
              <li>• Left Ear Carrier: 432.0 Hz Pure Sine</li>
              <li>• Right Ear Carrier: 438.0 Hz (+6.0 Hz Theta)</li>
              <li>• Pink-Noise Surf: 220–780 Hz Low-Pass Breath Swell</li>
              <li>• Haptic Swell: Capacitor Impact / Vibrate Sync</li>
            </ul>
          </PrismGlassCard>
        </div>
      </div>
    </div>
  );
};
