import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Cpu,
  Download,
  QrCode,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { generateQrMatrix } from '../utils/qrGenerator';
import { LUMINA_SPRING } from './PrismGlassCard';

interface ApkDownloadModalProps {
  open: boolean;
  onClose: () => void;
  apkSha256: string;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({
  open,
  onClose,
  apkSha256,
}) => {
  const apkDirectUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'https://lumina-vital.vercel.app/releases/luminavital-release.apk';
    }
    return `${window.location.origin}/releases/luminavital-release.apk`;
  }, []);

  const qrMatrix = useMemo(() => generateQrMatrix(apkDirectUrl), [apkDirectUrl]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={LUMINA_SPRING}
            className="relative z-10 w-full max-w-2xl lv-prism-outer rounded-3xl"
          >
            <div className="lv-glass-inner rounded-[23px] p-5 sm:p-6 text-slate-100 bg-slate-950/90">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-emerald-400/45 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                      Self-Hosted Capacitor Android Release Center
                    </span>
                    <h2 className="text-lg sm:text-xl font-extrabold">
                      LuminaVital Bio-Optic Field APK
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

              <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Left: Instant Scannable SVG QR Code */}
                <div className="md:col-span-5 flex flex-col items-center p-4 rounded-2xl bg-white text-slate-950 shadow-xl">
                  <svg
                    viewBox={`0 0 ${qrMatrix.length + 4} ${qrMatrix.length + 4}`}
                    className="w-40 h-40"
                    shapeRendering="crispEdges"
                    aria-label="QR Code to download LuminaVital Android APK"
                  >
                    <rect
                      x="0"
                      y="0"
                      width={qrMatrix.length + 4}
                      height={qrMatrix.length + 4}
                      fill="#FFFFFF"
                    />
                    {qrMatrix.map((row, y) =>
                      row.map((dark, x) =>
                        dark ? (
                          <rect
                            key={`${x}-${y}`}
                            x={x + 2}
                            y={y + 2}
                            width="1"
                            height="1"
                            fill="#050811"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-mono font-bold text-slate-800">
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Scan to Install on Android</span>
                  </div>
                </div>

                {/* Right: Direct Download + Telemetry Badges + 3-Step Guide */}
                <div className="md:col-span-7 space-y-3.5">
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" />
                      v1.0.0-arm64
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/35 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      100% Offline Optical DSP Ready
                    </span>
                  </div>

                  {/* SHA-256 Checksum Badge */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-[10px] text-slate-300 break-all">
                    <span className="text-emerald-400 font-bold flex items-center gap-1 mb-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      SHA-256 RELEASE CHECKSUM:
                    </span>
                    {apkSha256}
                  </div>

                  {/* Primary One-Tap Direct APK Download Button */}
                  <a
                    href="/releases/luminavital-release.apk"
                    download="LuminaVital-BioOptic-v1.0.0.apk"
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shadow-[0_0_28px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 hover:brightness-110 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>One-Tap Direct Download (.APK)</span>
                  </a>

                  {/* 3-Step Android Sideloading Guide */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs text-slate-300">
                    <div className="font-bold text-white text-[11px] uppercase font-mono">
                      3-Step Android Sideloading Guide:
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[11px]">
                      <li>
                        Download <code className="text-cyan-300">LuminaVital-BioOptic-v1.0.0.apk</code> or scan the QR code above.
                      </li>
                      <li>
                        Tap the downloaded package and enable <strong>Install Unknown Apps</strong> if prompted by Android.
                      </li>
                      <li>
                        Launch <strong>LuminaVital</strong>, grant Camera access, and audit room lightbulbs or fingertip pulse offline!
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
