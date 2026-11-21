import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, SunMedium, X } from 'lucide-react';
import type { ModalReportPayload } from '../types';
import { LUMINA_SPRING } from './PrismGlassCard';

interface ClinicalReportModalProps {
  payload: ModalReportPayload;
  onClose: () => void;
}

export const ClinicalReportModal: React.FC<ClinicalReportModalProps> = ({
  payload,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {payload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            layoutId={`report-card-${payload.data.uuid}`}
            transition={LUMINA_SPRING}
            className="relative z-10 w-full max-w-2xl lv-prism-outer rounded-3xl"
          >
            <div className="lv-glass-inner rounded-[23px] p-5 sm:p-6 bg-slate-950/90 text-slate-100 space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  {payload.kind === 'biometric' ? (
                    <Activity className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <SunMedium className="w-6 h-6 text-amber-400" />
                  )}
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                      {payload.kind === 'biometric'
                        ? 'Clinical Cardiac rPPG Waveform Report'
                        : 'Clinical Spectral & IEEE 1789 Flicker Audit'}
                    </span>
                    <h2 className="text-lg font-extrabold">
                      {payload.kind === 'biometric'
                        ? payload.data.presetLabel
                        : payload.data.roomName}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {payload.kind === 'biometric' ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-center">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">HEART RATE</div>
                      <div className="text-xl font-extrabold text-emerald-400 mt-0.5">
                        {payload.data.bpm} BPM
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">HRV RMSSD</div>
                      <div className="text-xl font-extrabold text-cyan-400 mt-0.5">
                        {payload.data.rmssdMs} ms
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">STRESS INDEX</div>
                      <div className="text-xl font-extrabold text-amber-300 mt-0.5">
                        {payload.data.stressScore}/100
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">RESPIRATION</div>
                      <div className="text-xl font-extrabold text-teal-300 mt-0.5">
                        {payload.data.respirationRate}/m
                      </div>
                    </div>
                  </div>

                  {/* Full-Width SVG Waveform */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10">
                    <div className="text-[11px] font-mono text-slate-400 mb-2">
                      Captured Arterial PPG Dicrotic Waveform Snapshot (G/R Mean:{' '}
                      {payload.data.rgbRatioMean})
                    </div>
                    <svg viewBox="0 0 240 70" className="w-full h-32">
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="1.8"
                        points={payload.data.waveformSnapshot
                          .map((v, idx, arr) => {
                            const x = (idx / Math.max(arr.length - 1, 1)) * 240;
                            const y = 42 - v * 26;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(' ')}
                      />
                    </svg>
                  </div>

                  {payload.data.notes && (
                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/10">
                      {payload.data.notes}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-center">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">KELVIN CCT</div>
                      <div className="text-xl font-extrabold text-amber-300 mt-0.5">
                        {payload.data.kelvin}K
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">PWM FLICKER</div>
                      <div className="text-xl font-extrabold text-cyan-300 mt-0.5">
                        {payload.data.flickerHz === 0
                          ? 'DC Steady'
                          : `${payload.data.flickerHz} Hz`}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">MOD DEPTH</div>
                      <div className="text-xl font-extrabold text-rose-300 mt-0.5">
                        {payload.data.modulationDepthPct}%
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-400">MELATONIN SUPP.</div>
                      <div className="text-xl font-extrabold text-indigo-300 mt-0.5">
                        ~{payload.data.melatoninSuppressionPct}%
                      </div>
                    </div>
                  </div>

                  {/* Full-Width Luma Ripple SVG */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-white/10">
                    <div className="text-[11px] font-mono text-slate-400 mb-2">
                      Captured Scanline Luma Modulation Profile · CIE ({payload.data.cieX},{' '}
                      {payload.data.cieY})
                    </div>
                    <svg viewBox="0 0 240 70" className="w-full h-32">
                      <polyline
                        fill="none"
                        stroke={
                          payload.data.ieeeRiskZone === 'HIGH_HAZARD'
                            ? '#FB7185'
                            : '#34D399'
                        }
                        strokeWidth="1.8"
                        points={payload.data.lumaWaveform
                          .map((v, idx, arr) => {
                            const x = (idx / Math.max(arr.length - 1, 1)) * 240;
                            const y = 62 - v * 52;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(' ')}
                      />
                    </svg>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/15 text-xs text-slate-200">
                    {payload.data.verdict}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
