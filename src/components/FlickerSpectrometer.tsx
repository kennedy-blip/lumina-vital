import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Cpu,
  Lightbulb,
  Save,
  SunMedium,
  Zap,
} from 'lucide-react';
import {
  LIGHTING_SIMULATOR_PRESETS,
  OpticalSpectrometerEngine,
  type LightingPresetId,
  type SpectralAnalysisResult,
} from '../services/spectrometerEngine';
import { saveLightingAuditToVault } from '../services/db';
import type { PrivilegeRole, SensorPermissionsState } from '../types';
import { PrismGlassCard } from './PrismGlassCard';

interface FlickerSpectrometerProps {
  role: PrivilegeRole;
  sensors: SensorPermissionsState;
  onUpdateSensors: (partial: Partial<SensorPermissionsState>) => void;
  onLiveSpectrumChange: (
    kelvin: number,
    ieeeRiskZone: 'SAFE' | 'LOW_RISK' | 'HIGH_HAZARD'
  ) => void;
  onAuditSaved: () => void;
}

export const FlickerSpectrometer: React.FC<FlickerSpectrometerProps> = ({
  role,
  sensors,
  onUpdateSensors,
  onLiveSpectrumChange,
  onAuditSaved,
}) => {
  const [sourceMode, setSourceMode] = useState<'SIMULATOR' | 'LIVE_CAMERA'>('SIMULATOR');
  const [presetId, setPresetId] = useState<LightingPresetId>('cheap-120hz-led');
  const [roomName, setRoomName] = useState('Home Office Desk Lamp');
  const [wakeTimeHour, setWakeTimeHour] = useState(7);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const engineRef = useRef(new OpticalSpectrometerEngine());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const lumaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [analysis, setAnalysis] = useState<SpectralAnalysisResult>(() =>
    engineRef.current.analyzeSimulatorPreset(LIGHTING_SIMULATOR_PRESETS[0], 0)
  );

  const selectedPreset =
    LIGHTING_SIMULATOR_PRESETS.find((p) => p.id === presetId) ||
    LIGHTING_SIMULATOR_PRESETS[0];

  // Camera Lifecycle for Live Optical Spectrometer
  useEffect(() => {
    const cleanup = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    if (sourceMode !== 'LIVE_CAMERA') {
      cleanup();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setCamError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: sensors.cameraMode || 'environment',
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 60 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        engineRef.current.reset();
        onUpdateSensors({ cameraStatus: 'ACTIVE', cameraMode: 'environment' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Camera unavailable';
        setCamError(`Camera Restricted (${msg}) — Using Optical Spectral Simulator.`);
        setSourceMode('SIMULATOR');
        onUpdateSensors({ cameraStatus: 'RESTRICTED' });
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [sourceMode, sensors.cameraMode]);

  // Continuous Spectral & Luma Ripple Analysis Loop
  useEffect(() => {
    let tick = 0;
    if (!offscreenRef.current) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 96;
      offscreenRef.current = c;
    }

    const interval = window.setInterval(() => {
      tick++;
      let res: SpectralAnalysisResult;

      if (
        sourceMode === 'LIVE_CAMERA' &&
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        offscreenRef.current
      ) {
        const ctx = offscreenRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(
            videoRef.current,
            0,
            0,
            offscreenRef.current.width,
            offscreenRef.current.height
          );
          const img = ctx.getImageData(
            0,
            0,
            offscreenRef.current.width,
            offscreenRef.current.height
          );
          res = engineRef.current.analyzeLiveCameraFrame(img, new Date());
        } else {
          res = engineRef.current.analyzeSimulatorPreset(selectedPreset, tick, new Date());
        }
      } else {
        res = engineRef.current.analyzeSimulatorPreset(selectedPreset, tick, new Date());
      }

      setAnalysis(res);
      onLiveSpectrumChange(res.kelvin, res.ieeeRiskZone);

      // Draw Scanline Luma Ripple Oscilloscope
      const canvas = lumaCanvasRef.current;
      if (canvas) {
        const c2d = canvas.getContext('2d');
        if (c2d) {
          const w = canvas.width;
          const h = canvas.height;
          c2d.clearRect(0, 0, w, h);

          c2d.strokeStyle = 'rgba(148,163,184,0.14)';
          c2d.beginPath();
          c2d.moveTo(0, h * 0.5);
          c2d.lineTo(w, h * 0.5);
          c2d.stroke();

          c2d.strokeStyle =
            res.ieeeRiskZone === 'HIGH_HAZARD'
              ? '#FB7185'
              : res.ieeeRiskZone === 'LOW_RISK'
              ? '#FBBF24'
              : '#34D399';
          c2d.lineWidth = 2.2;
          c2d.beginPath();
          res.lumaWaveform.forEach((v, idx) => {
            const x = (idx / Math.max(res.lumaWaveform.length - 1, 1)) * w;
            const y = h - 12 - v * (h - 24);
            if (idx === 0) c2d.moveTo(x, y);
            else c2d.lineTo(x, y);
          });
          c2d.stroke();
        }
      }
    }, 110);

    return () => window.clearInterval(interval);
  }, [sourceMode, selectedPreset]);

  const handleSaveRoomAudit = async () => {
    const cleanRoom = roomName.trim() || 'Workspace Light Source';
    await saveLightingAuditToVault({
      roomName: cleanRoom,
      source: sourceMode === 'LIVE_CAMERA' ? 'LIVE_SPECTROMETER' : 'SIMULATOR',
      kelvin: analysis.kelvin,
      cieX: analysis.cieX,
      cieY: analysis.cieY,
      flickerHz: analysis.flickerHz,
      modulationDepthPct: analysis.modulationDepthPct,
      luxEstimate: analysis.luxEstimate,
      ieeeRiskZone: analysis.ieeeRiskZone,
      melatoninSuppressionPct: analysis.melatoninSuppressionPct,
      verdict: analysis.circadianVerdict,
      lumaWaveform: analysis.lumaWaveform,
    });
    setSavedNotice(
      `Saved "${cleanRoom}" (${analysis.kelvin}K / ${analysis.modulationDepthPct}% Flicker) to Vault`
    );
    onAuditSaved();
    setTimeout(() => setSavedNotice(null), 3500);
  };

  // Position marker on Spectral Locus Bar (1800K -> 10000K)
  const kelvinPercent = Math.max(
    2,
    Math.min(98, ((analysis.kelvin - 1800) / (10000 - 1800)) * 100)
  );

  // Position marker on IEEE 1789 Risk Plot (X: 0..400Hz+, Y: 0..100% Mod Depth)
  const plotX = Math.max(6, Math.min(94, (Math.min(analysis.flickerHz, 400) / 400) * 100));
  const plotY = Math.max(6, Math.min(94, 100 - analysis.modulationDepthPct));

  const dlmoEveningHour = (wakeTimeHour + 14) % 24;
  const zeroBlueCutoffHour = (wakeTimeHour + 13) % 24;

  return (
    <div className="space-y-4">
      {/* Header & 5 Built-in Lighting Simulators */}
      <PrismGlassCard innerClassName="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
              Module 02 · IEEE 1789 PWM Flicker & McCamy Kelvin Spectrometer
            </span>
            <h1 className="text-lg sm:text-xl font-bold mt-1">
              Stroboscopic Migraine Detector & Circadian Color Temperature Analyzer
            </h1>
            <p className="text-xs sm:text-sm text-[var(--lv-text-secondary)]">
              Computes CIE 1931 (x, y) chromaticity via McCamy’s cubic CCT formula and rolling-shutter luma modulation depth.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSourceMode('SIMULATOR')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                sourceMode === 'SIMULATOR'
                  ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200'
                  : 'bg-white/5 border-white/15 text-[var(--lv-text-secondary)]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>5 Lighting Simulators</span>
            </button>

            <button
              type="button"
              onClick={() => setSourceMode('LIVE_CAMERA')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                sourceMode === 'LIVE_CAMERA'
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200'
                  : 'bg-white/5 border-white/15 text-[var(--lv-text-secondary)]'
              }`}
            >
              {sourceMode === 'LIVE_CAMERA' ? (
                <Camera className="w-3.5 h-3.5" />
              ) : (
                <CameraOff className="w-3.5 h-3.5" />
              )}
              <span>Live Bulb / Screen Scan</span>
            </button>
          </div>
        </div>

        {camError && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-200 text-xs">
            {camError}
          </div>
        )}

        {savedNotice && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {sourceMode === 'SIMULATOR' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
            {LIGHTING_SIMULATOR_PRESETS.map((preset) => {
              const active = preset.id === presetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setPresetId(preset.id);
                    setRoomName(preset.title);
                  }}
                  className={`text-left p-2.5 rounded-xl border transition-all ${
                    active
                      ? 'bg-gradient-to-br from-cyan-500/20 via-amber-500/10 to-rose-500/15 border-cyan-400/50 shadow-md'
                      : 'bg-black/15 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">{preset.title}</span>
                  </div>
                  <p className="text-[10px] font-mono text-[var(--lv-text-secondary)] mt-1">
                    {preset.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Save Room Audit Input Bar */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Room / Fixture label (e.g., Bedroom Lamp, Studio Monitor)"
            className="flex-1 px-3 py-2 rounded-xl text-xs bg-black/25 border border-white/15 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={handleSaveRoomAudit}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-emerald-500 text-white flex items-center justify-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Room Lighting Audit</span>
          </button>
        </div>
      </PrismGlassCard>

      {/* Main Diagnostics: Kelvin Locus + IEEE 1789 Stroboscopic Risk Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Correlated Color Temperature & Circadian Melanopic Verdict */}
        <PrismGlassCard className="lg:col-span-6" innerClassName="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SunMedium className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold">
                McCamy Cubic CCT Spectrometer (1,800K – 10,000K)
              </h2>
            </div>
            <span className="text-xs font-mono text-[var(--lv-text-secondary)]">
              CIE (x={analysis.cieX}, y={analysis.cieY})
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold font-mono">
                {analysis.kelvin}K
              </span>
              <span className="ml-2 text-xs font-mono text-[var(--lv-text-secondary)]">
                ~{analysis.luxEstimate} Lux
              </span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                analysis.kelvin > 5000
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                  : analysis.kelvin < 3200
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
              }`}
            >
              Melatonin Impact: ~{analysis.melatoninSuppressionPct}%
            </span>
          </div>

          {/* Glowing Spectral Locus Bar */}
          <div className="space-y-1.5">
            <div className="relative h-5 rounded-full lv-kelvin-gradient border border-white/25 shadow-inner">
              <div
                style={{ left: `${kelvinPercent}%` }}
                className="absolute -top-1.5 -translate-x-1/2 w-4 h-8 rounded-md bg-slate-950 border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.9)] transition-all duration-200"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[var(--lv-text-secondary)]">
              <span>1800K Candle</span>
              <span>2700K Warm</span>
              <span>4500K Neutral</span>
              <span>6500K Daylight</span>
              <span>10000K Blue Sky</span>
            </div>
          </div>

          {/* Live Camera Preview if Active */}
          <div className={sourceMode === 'LIVE_CAMERA' ? 'block' : 'hidden'}>
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-28 object-cover rounded-xl border border-cyan-400/30"
            />
          </div>

          {/* Scanline / Temporal Luma Waveform */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-[var(--lv-text-secondary)] mb-1">
              <span>Temporal & Rolling-Shutter Scanline Luma Waveform</span>
              <span>
                {analysis.flickerHz > 0 ? `${analysis.flickerHz} Hz` : 'DC Steady'} ·{' '}
                {analysis.modulationDepthPct}% Ripple
              </span>
            </div>
            <canvas
              ref={lumaCanvasRef}
              width={520}
              height={88}
              className="w-full h-[84px] rounded-xl bg-slate-950/75 border border-white/10 block"
            />
          </div>

          {/* Actionable Circadian Melanopic Verdict */}
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              analysis.melatoninSuppressionPct > 45
                ? 'bg-indigo-500/15 border-indigo-400/40 text-indigo-100'
                : 'bg-emerald-500/15 border-emerald-400/35 text-emerald-100'
            }`}
          >
            <div className="font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Circadian Melanopic Verdict</span>
            </div>
            {analysis.circadianVerdict}
          </div>
        </PrismGlassCard>

        {/* Right: Interactive IEEE 1789 Flicker Risk Graph */}
        <PrismGlassCard className="lg:col-span-6" innerClassName="p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold">
                IEEE Std 1789-2015 Stroboscopic Flicker Hazard Plotter
              </h2>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1 ${
                analysis.ieeeRiskZone === 'HIGH_HAZARD'
                  ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                  : analysis.ieeeRiskZone === 'LOW_RISK'
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              {analysis.ieeeRiskZone === 'HIGH_HAZARD'
                ? 'RED: HIGH MIGRAINE HAZARD'
                : analysis.ieeeRiskZone === 'LOW_RISK'
                ? 'AMBER: LOW EYESTRAIN RISK'
                : 'GREEN: NO OBSERVABLE EFFECT'}
            </span>
          </div>

          {/* Interactive SVG IEEE 1789 Risk Zone Map */}
          <div className="relative w-full h-[240px] rounded-xl overflow-hidden border border-white/15 bg-slate-950/85">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full block"
            >
              {/* RED Zone: High Migraine & Photophobia Hazard */}
              <rect x="0" y="0" width="100" height="100" fill="rgba(244, 63, 94, 0.20)" />

              {/* AMBER Zone: Low Eyestrain Risk (Mod% <= 0.08 * f) */}
              <polygon
                points="0,100 0,94 30,90 60,80 100,68 100,100"
                fill="rgba(245, 158, 11, 0.24)"
              />

              {/* GREEN Zone: IEEE 1789 NOEL Safe Zone (Mod% <= 0.033 * f) */}
              <polygon
                points="0,100 0,96 30,95 60,91 100,86 100,100"
                fill="rgba(16, 185, 129, 0.30)"
              />

              {/* Boundary Curves */}
              <polyline
                points="0,94 30,90 60,80 100,68"
                fill="none"
                stroke="#FBBF24"
                strokeWidth="0.8"
                strokeDasharray="2,2"
              />
              <polyline
                points="0,96 30,95 60,91 100,86"
                fill="none"
                stroke="#10B981"
                strokeWidth="0.9"
              />
            </svg>

            {/* Zone Labels */}
            <div className="absolute top-3 left-3 text-[10px] font-mono text-rose-300 bg-black/55 px-2 py-0.5 rounded">
              RED: High Migraine & Photophobia Hazard
            </div>
            <div className="absolute bottom-12 right-3 text-[10px] font-mono text-amber-300 bg-black/55 px-2 py-0.5 rounded">
              AMBER: Low Eyestrain Risk
            </div>
            <div className="absolute bottom-3 left-3 text-[10px] font-mono text-emerald-300 bg-black/55 px-2 py-0.5 rounded">
              GREEN: IEEE 1789 Safe (NOEL &lt;{analysis.ieeeNoelBoundaryPct}%)
            </div>

            {/* Live Plotted Light Source Crosshair */}
            <div
              style={{ left: `${plotX}%`, top: `${plotY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none"
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute w-8 h-8 rounded-full bg-white/30 animate-ping" />
                <span className="w-4 h-4 rounded-full bg-white border-2 border-slate-900 shadow-[0_0_16px_#fff]" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-black/25 border border-white/10">
              <div className="text-[10px] text-[var(--lv-text-secondary)]">PWM FREQ</div>
              <div className="text-base font-bold mt-0.5">
                {analysis.flickerHz === 0 ? 'DC (0Hz)' : `${analysis.flickerHz} Hz`}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-black/25 border border-white/10">
              <div className="text-[10px] text-[var(--lv-text-secondary)]">MOD DEPTH</div>
              <div className="text-base font-bold mt-0.5">{analysis.modulationDepthPct}%</div>
            </div>
            <div className="p-2.5 rounded-xl bg-black/25 border border-white/10">
              <div className="text-[10px] text-[var(--lv-text-secondary)]">NOEL LIMIT</div>
              <div className="text-base font-bold mt-0.5 text-emerald-400">
                &le;{analysis.ieeeNoelBoundaryPct}%
              </div>
            </div>
          </div>

          {/* Pro Tier Feature: Custom Circadian Shift Schedule Calculator */}
          {role !== 'WELLNESS_USER' && (
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-200">
                  PRO TIER · Custom Circadian Shift Schedule Calculator
                </span>
                <label className="font-mono text-[11px] flex items-center gap-1.5">
                  <span>Wake Hour:</span>
                  <select
                    value={wakeTimeHour}
                    onChange={(e) => setWakeTimeHour(Number(e.target.value))}
                    className="bg-slate-900 text-white rounded px-1.5 py-0.5 border border-white/20"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-[11px] font-mono text-[var(--lv-text-secondary)]">
                Sunlight Anchor: {String(wakeTimeHour).padStart(2, '0')}:30 (&gt;5500K) · Zero-Blue
                Amber Cutoff: {String(zeroBlueCutoffHour).padStart(2, '0')}:00 (&lt;2800K) · DLMO
                Melatonin Onset: {String(dlmoEveningHour).padStart(2, '0')}:00
              </p>
            </div>
          )}
        </PrismGlassCard>
      </div>
    </div>
  );
};
