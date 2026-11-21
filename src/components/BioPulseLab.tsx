import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  CameraOff,
  CheckCircle2,
  Cpu,
  Heart,
  Save,
  Sparkles,
  Wind,
  AlertTriangle,
  Sliders,
} from 'lucide-react';
import {
  OpticalPpgProcessor,
  PPG_SIMULATOR_PRESETS,
  type PpgComputedMetrics,
  type PpgPresetId,
} from '../services/ppgEngine';
import { saveBiometricLogToVault } from '../services/db';
import { vagalAudio } from '../services/vagalAudio';
import type { PrivilegeRole, SensorPermissionsState } from '../types';
import { PrismGlassCard } from './PrismGlassCard';

interface BioPulseLabProps {
  role: PrivilegeRole;
  sensors: SensorPermissionsState;
  onUpdateSensors: (partial: Partial<SensorPermissionsState>) => void;
  motionMagnitudeG: number;
  onLiveVitalsChange: (bpm: number, stressScore: number, rmssdMs: number) => void;
  onLogSaved: () => void;
}

export const BioPulseLab: React.FC<BioPulseLabProps> = ({
  role,
  sensors,
  onUpdateSensors,
  motionMagnitudeG,
  onLiveVitalsChange,
  onLogSaved,
}) => {
  const [inputMode, setInputMode] = useState<'SIMULATOR' | 'LIVE_CAMERA'>('SIMULATOR');
  const [selectedPresetId, setSelectedPresetId] = useState<PpgPresetId>('focused-flow');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [systolicBeatFlash, setSystolicBeatFlash] = useState(false);
  const [motionWarning, setMotionWarning] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<PpgComputedMetrics>({
    bpm: 72,
    rmssdMs: 54,
    stressScore: 29,
    respirationRate: 13.5,
    coherenceScore: 71,
    signalQualityPct: 96,
    rgbRatioMean: 0.723,
  });

  const [rawChannels, setRawChannels] = useState<{ r: number; g: number; b: number }>({
    r: 188,
    g: 136,
    b: 121,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawRgbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processorRef = useRef<OpticalPpgProcessor>(new OpticalPpgProcessor());
  const streamRef = useRef<MediaStream | null>(null);

  const ppgBufferRef = useRef<number[]>(Array(220).fill(0));
  const rgbTraceRef = useRef<{ r: number[]; g: number[]; b: number[] }>({
    r: Array(160).fill(185),
    g: Array(160).fill(135),
    b: Array(160).fill(120),
  });

  const activePreset =
    PPG_SIMULATOR_PRESETS.find((p) => p.id === selectedPresetId) || PPG_SIMULATOR_PRESETS[1];

  // Manage Live Camera Stream
  useEffect(() => {
    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    if (inputMode !== 'LIVE_CAMERA') {
      stopStream();
      onUpdateSensors({ cameraStatus: 'SIMULATOR ACTIVE' });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setCameraError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: sensors.cameraMode,
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 60, min: 30 },
          },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
        processorRef.current.reset();
        onUpdateSensors({ cameraStatus: 'ACTIVE' });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Camera permission denied or hardware unavailable.';
        setCameraError(
          `Optical Camera Restricted (${msg}) — Switched to 60Hz Physiological Signal Simulator.`
        );
        setInputMode('SIMULATOR');
        onUpdateSensors({ cameraStatus: 'RESTRICTED' });
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [inputMode, sensors.cameraMode]);

  // 60 FPS Optical Pixel Math + Band-Pass PPG Oscilloscope Loop
  useEffect(() => {
    let rafId = 0;
    let frameCounter = 0;

    if (!offscreenCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 80;
      c.height = 60;
      offscreenCanvasRef.current = c;
    }

    const renderOscilloscope = () => {
      const canvas = waveCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle Clinical Reticle Grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 36) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Draw PPG Dicrotic Notch Waveform
      const buf = ppgBufferRef.current;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
      grad.addColorStop(0.55, '#10B981');
      grad.addColorStop(1, '#34D399');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * w;
        const y = h * 0.56 - buf[i] * (h * 0.34);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glowing Area Fill
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
      fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Leading Laser Playhead Dot
      const lastVal = buf[buf.length - 1] ?? 0;
      const dotY = h * 0.56 - lastVal * (h * 0.34);
      ctx.beginPath();
      ctx.arc(w - 4, dotY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#6EE7B7';
      ctx.fill();
    };

    const renderRawRgbScope = () => {
      const rgbCanvas = rawRgbCanvasRef.current;
      if (!rgbCanvas) return;
      const ctx = rgbCanvas.getContext('2d');
      if (!ctx) return;

      const w = rgbCanvas.width;
      const h = rgbCanvas.height;
      ctx.clearRect(0, 0, w, h);

      const drawChannel = (arr: number[], stroke: string) => {
        const min = Math.min(...arr) - 1;
        const max = Math.max(...arr) + 1;
        const span = Math.max(max - min, 2);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        arr.forEach((val, idx) => {
          const x = (idx / (arr.length - 1)) * w;
          const norm = (val - min) / span;
          const y = h - 10 - norm * (h - 20);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };

      drawChannel(rgbTraceRef.current.r, '#FB7185');
      drawChannel(rgbTraceRef.current.g, '#34D399');
      drawChannel(rgbTraceRef.current.b, '#38BDF8');
    };

    const step = (nowMs: number) => {
      frameCounter++;
      const processor = processorRef.current;

      let sample;
      if (
        inputMode === 'LIVE_CAMERA' &&
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        offscreenCanvasRef.current
      ) {
        const offCtx = offscreenCanvasRef.current.getContext('2d', {
          willReadFrequently: true,
        });
        if (offCtx) {
          offCtx.drawImage(
            videoRef.current,
            0,
            0,
            offscreenCanvasRef.current.width,
            offscreenCanvasRef.current.height
          );
          const imgData = offCtx.getImageData(
            0,
            0,
            offscreenCanvasRef.current.width,
            offscreenCanvasRef.current.height
          );
          const { r, g, b, motionDelta } = processor.extractRoiRgbFromImageData(imgData);
          sample = processor.processLiveRgb(
            r,
            g,
            b,
            nowMs,
            Math.max(motionMagnitudeG, motionDelta * 18)
          );
        } else {
          sample = processor.processSimulatedFrame(activePreset, nowMs, motionMagnitudeG);
        }
      } else {
        sample = processor.processSimulatedFrame(activePreset, nowMs, motionMagnitudeG);
      }

      ppgBufferRef.current.push(sample.filteredSignal);
      if (ppgBufferRef.current.length > 220) {
        ppgBufferRef.current.shift();
      }

      rgbTraceRef.current.r.push(sample.rawR);
      rgbTraceRef.current.g.push(sample.rawG);
      rgbTraceRef.current.b.push(sample.rawB);
      if (rgbTraceRef.current.r.length > 160) {
        rgbTraceRef.current.r.shift();
        rgbTraceRef.current.g.shift();
        rgbTraceRef.current.b.shift();
      }

      if (sample.systolicPeak) {
        setSystolicBeatFlash(true);
        void vagalAudio.triggerBiofeedbackHaptic('systolic-tick', sensors.hapticsEnabled);
        setTimeout(() => setSystolicBeatFlash(false), 160);
      }

      renderOscilloscope();
      if (role !== 'WELLNESS_USER') {
        renderRawRgbScope();
      }

      // Throttle React state telemetry updates to ~6 Hz for silky 60 FPS UI
      if (frameCounter % 10 === 0) {
        const computed = processor.computeMetrics(
          inputMode === 'SIMULATOR' ? activePreset : null
        );
        setMetrics(computed);
        setMotionWarning(sample.motionArtifactWarning);
        setRawChannels({
          r: Number(sample.rawR.toFixed(1)),
          g: Number(sample.rawG.toFixed(1)),
          b: Number(sample.rawB.toFixed(1)),
        });
        onLiveVitalsChange(computed.bpm, computed.stressScore, computed.rmssdMs);
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [inputMode, activePreset, motionMagnitudeG, role, sensors.hapticsEnabled]);

  const handleSaveLog = async () => {
    const snapshot = processorRef.current.getWaveformSnapshot(120);
    const label =
      inputMode === 'LIVE_CAMERA'
        ? `Live Camera rPPG (${sensors.cameraMode === 'user' ? 'Facial ROI' : 'Fingertip PPG'})`
        : activePreset.title;

    await saveBiometricLogToVault({
      source: inputMode === 'LIVE_CAMERA' ? 'LIVE_CAMERA_RPPG' : 'SIMULATOR',
      presetLabel: label,
      bpm: metrics.bpm,
      rmssdMs: metrics.rmssdMs,
      stressScore: metrics.stressScore,
      respirationRate: metrics.respirationRate,
      coherenceScore: metrics.coherenceScore,
      waveformSnapshot: snapshot,
      rgbRatioMean: metrics.rgbRatioMean,
      notes: `Captured via ${label} · Signal Quality ${metrics.signalQualityPct}%`,
    });

    setSavedBanner(`Saved ${metrics.bpm} BPM / RMSSD ${metrics.rmssdMs}ms to Offline Medical Vault`);
    onLogSaved();
    setTimeout(() => setSavedBanner(null), 3500);
  };

  return (
    <div className="space-y-4">
      {/* Top Control Strip: Live Camera Optical Scan vs 1-Tap Physiological Signal Simulator */}
      <PrismGlassCard innerClassName="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-400/30">
                Module 01 · Contactless rPPG & Fingertip PPG
              </span>
              {motionWarning && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-400/40 animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  Motion / Tremor Artifact Detected
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold mt-1">
              Optical Hemoglobin Absorption & Autonomic HRV Scanner
            </h1>
            <p className="text-xs sm:text-sm text-[var(--lv-text-secondary)]">
              Extracts 60 FPS Green/Red chrominance absorption across 0.75–3.5 Hz cardiac band-pass filter to plot arterial dicrotic notch & RMSSD vagal tone.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInputMode('SIMULATOR')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                inputMode === 'SIMULATOR'
                  ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200 shadow-[0_0_18px_rgba(6,182,212,0.3)]'
                  : 'bg-white/5 border-white/15 text-[var(--lv-text-secondary)] hover:text-[var(--lv-text-primary)]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>1-Tap Signal Simulator</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('LIVE_CAMERA')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                inputMode === 'LIVE_CAMERA'
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.3)]'
                  : 'bg-white/5 border-white/15 text-[var(--lv-text-secondary)] hover:text-[var(--lv-text-primary)]'
              }`}
            >
              {inputMode === 'LIVE_CAMERA' ? (
                <Camera className="w-3.5 h-3.5" />
              ) : (
                <CameraOff className="w-3.5 h-3.5" />
              )}
              <span>Live Camera Optical Scan</span>
            </button>

            {inputMode === 'LIVE_CAMERA' && (
              <button
                type="button"
                onClick={() =>
                  onUpdateSensors({
                    cameraMode: sensors.cameraMode === 'user' ? 'environment' : 'user',
                  })
                }
                className="px-3 py-2 rounded-xl text-xs font-mono bg-white/10 border border-white/20"
              >
                {sensors.cameraMode === 'user' ? 'Front Facial ROI' : 'Rear Fingertip PPG'}
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveLog}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md flex items-center gap-1.5 hover:brightness-110 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Biometric Log</span>
            </button>
          </div>
        </div>

        {cameraError && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {savedBanner && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedBanner}</span>
          </div>
        )}

        {/* 4 Instant Physiological Presets */}
        {inputMode === 'SIMULATOR' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {PPG_SIMULATOR_PRESETS.map((preset) => {
              const selected = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    processorRef.current.reset();
                    setSelectedPresetId(preset.id);
                  }}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    selected
                      ? 'bg-gradient-to-br from-emerald-500/20 via-cyan-500/15 to-transparent border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'bg-black/15 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      {preset.title}
                    </span>
                    {selected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-[var(--lv-text-secondary)] mt-1">
                    {preset.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </PrismGlassCard>

      {/* Main Clinical Telemetry Grid: Oscilloscope + Live Camera ROI + 4 Core Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Real-Time PPG Dicrotic Notch Waveform Canvas */}
        <PrismGlassCard className="lg:col-span-8" innerClassName="p-4 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold">
                Real-Time PPG Dicrotic Notch Waveform (0.75–3.5 Hz Band-Pass)
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-[var(--lv-text-secondary)]">
              <span>G/R Ratio: {metrics.rgbRatioMean}</span>
              <span>SNR: {metrics.signalQualityPct}%</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  systolicBeatFlash
                    ? 'bg-rose-500/30 border-rose-400 text-rose-200'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <Heart
                  className={`w-3 h-3 ${
                    systolicBeatFlash ? 'text-rose-400 fill-rose-400 scale-125' : 'text-rose-400'
                  } transition-transform`}
                />
                SYSTOLIC
              </span>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-slate-950/75 border border-white/10">
            <canvas
              ref={waveCanvasRef}
              width={760}
              height={230}
              className="w-full h-[200px] sm:h-[230px] block"
            />

            {/* Live Camera Optical ROI Picture-in-Picture Overlay */}
            <div
              className={`absolute top-3 right-3 w-28 sm:w-36 rounded-xl overflow-hidden border border-cyan-400/40 bg-black/80 shadow-lg ${
                inputMode === 'LIVE_CAMERA' ? 'block' : 'hidden'
              }`}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-20 sm:h-24 object-cover"
              />
              {/* Central ROI Target Box */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-10 border-2 border-emerald-400/80 rounded-md shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
              </div>
              <div className="px-1.5 py-0.5 text-[9px] font-mono text-center bg-black/75 text-emerald-300">
                LIVE ROI 60FPS
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--lv-text-secondary)]">
            <span>
              RGB Sample: R={rawChannels.r} · G={rawChannels.g} · B={rawChannels.b}
            </span>
            <span>Detrended 2nd-Order RC Filter · Systolic Peak + Catacrotic Notch</span>
          </div>
        </PrismGlassCard>

        {/* Right Column: Live Clinical Metrics Cards */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
          {/* Heart Rate BPM */}
          <PrismGlassCard interactive innerClassName="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[var(--lv-text-secondary)]">
                Heart Rate
              </span>
              <Heart
                className={`w-4 h-4 text-rose-400 transition-transform ${
                  systolicBeatFlash ? 'scale-125 fill-rose-400' : ''
                }`}
              />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight">
                {metrics.bpm}
              </span>
              <span className="text-xs font-mono text-emerald-400">BPM</span>
            </div>
            <p className="text-[11px] text-[var(--lv-text-secondary)] mt-1">
              {metrics.bpm < 65
                ? 'Athletic Bradycardic Calm'
                : metrics.bpm <= 88
                ? 'Normocardic Resting Zone'
                : 'Sympathetic Acceleration'}
            </p>
          </PrismGlassCard>

          {/* HRV RMSSD & 0-100 Autonomic Stress Gauge */}
          <PrismGlassCard interactive innerClassName="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[var(--lv-text-secondary)]">
                HRV & Stress Index
              </span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono">
                  {metrics.rmssdMs}
                </span>
                <span className="text-xs font-mono text-cyan-400 ml-1">ms RMSSD</span>
              </div>
              <div className="text-right">
                <span
                  className={`text-lg font-bold font-mono ${
                    metrics.stressScore > 65
                      ? 'text-rose-400'
                      : metrics.stressScore > 40
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {metrics.stressScore}/100
                </span>
                <span className="block text-[10px] text-[var(--lv-text-secondary)]">
                  STRESS GAUGE
                </span>
              </div>
            </div>
            <div className="mt-2.5 w-full h-2 rounded-full bg-black/30 overflow-hidden">
              <div
                style={{ width: `${metrics.stressScore}%` }}
                className={`h-full transition-all duration-300 ${
                  metrics.stressScore > 65
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                }`}
              />
            </div>
          </PrismGlassCard>

          {/* Respiratory Rate & Vagal Coherence */}
          <PrismGlassCard interactive className="col-span-2 lg:col-span-1" innerClassName="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-[var(--lv-text-secondary)]">
                Sinus Arrhythmia Respiration
              </span>
              <Wind className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono">
                  {metrics.respirationRate}
                </span>
                <span className="text-xs font-mono text-teal-400 ml-1">Breaths/Min</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                {metrics.coherenceScore}% Coherent
              </span>
            </div>
          </PrismGlassCard>
        </div>
      </div>

      {/* Pro / Director RBAC Tier Exclusive: Raw R/G/B Hemoglobin Absorption Oscilloscope */}
      {role !== 'WELLNESS_USER' ? (
        <PrismGlassCard innerClassName="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold">
                PRO TIER · Raw R / G / B Hemoglobin Chrominance Absorption Oscilloscope
              </h3>
            </div>
            <span className="text-[11px] font-mono text-cyan-300">
              540nm Oxyhemoglobin Peak (Green Channel Inverted Dominance)
            </span>
          </div>
          <canvas
            ref={rawRgbCanvasRef}
            width={760}
            height={110}
            className="w-full h-[96px] rounded-xl bg-slate-950/70 border border-white/10 block"
          />
        </PrismGlassCard>
      ) : (
        <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-[var(--lv-text-secondary)]">
          <span>
            Switch to <strong>Ergonomic & Bio Specialist</strong> in the RBAC Drawer to unlock the Raw R/G/B Hemoglobin Absorption Oscilloscope.
          </span>
        </div>
      )}
    </div>
  );
};
