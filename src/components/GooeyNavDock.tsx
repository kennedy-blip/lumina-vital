import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  SunMedium,
  Eye,
  Wind,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { ActiveModule } from '../types';
import { LUMINA_SPRING } from './PrismGlassCard';

interface GooeyNavDockProps {
  activeModule: ActiveModule;
  onSelectModule: (m: ActiveModule) => void;
  compactMobile?: boolean;
  onOpenApkCenter: () => void;
  pendingSyncCount: number;
}

const NAV_ITEMS: {
  id: ActiveModule;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'bio-pulse', label: 'Bio-Pulse Lab', shortLabel: 'Pulse', icon: Activity },
  { id: 'spectrometer', label: 'Flicker & Lux', shortLabel: 'Lux/PWM', icon: SunMedium },
  { id: 'ocular-rehab', label: 'Ocular Rehab', shortLabel: 'Ocular', icon: Eye },
  { id: 'vagal-sync', label: 'Vagal Sync', shortLabel: 'Vagal', icon: Wind },
  { id: 'vault-sync', label: 'Dosimeter Vault', shortLabel: 'Vault', icon: ShieldCheck },
];

export const GooeyNavDock: React.FC<GooeyNavDockProps> = ({
  activeModule,
  onSelectModule,
  compactMobile = false,
  onOpenApkCenter,
  pendingSyncCount,
}) => {
  return (
    <nav
      aria-label="Primary Diagnostic Modules"
      className={`w-full flex justify-center ${
        compactMobile ? 'px-2 pb-2 pt-1' : 'px-4 py-2'
      }`}
    >
      {/* Inline SVG Liquid Mercury Contrast Filter */}
      <svg className="sr-only" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="lumina-gooey-dock">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="lv-prism-outer rounded-2xl max-w-full">
        <div
          className={`lv-glass-inner rounded-[15px] flex items-center gap-1 ${
            compactMobile ? 'px-1.5 py-1.5' : 'px-2.5 py-2'
          }`}
        >
          <div className="relative flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectModule(item.id)}
                  className={`relative flex items-center justify-center gap-2 rounded-xl font-medium transition-colors ${
                    compactMobile
                      ? 'px-2.5 py-2 text-[11px] flex-col gap-0.5 min-w-[56px]'
                      : 'px-3.5 py-2 text-xs sm:text-sm'
                  } ${
                    isActive
                      ? 'text-white'
                      : 'text-[var(--lv-text-secondary)] hover:text-[var(--lv-text-primary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId={compactMobile ? 'gooey-pill-mobile' : 'gooey-pill-desktop'}
                      transition={LUMINA_SPRING}
                      style={{ filter: 'url(#lumina-gooey-dock)' }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/85 via-cyan-500/85 to-teal-500/85 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center">
                    <Icon className={compactMobile ? 'w-4 h-4' : 'w-4 h-4'} />
                    {item.id === 'vault-sync' && pendingSyncCount > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-400 text-slate-950">
                        {pendingSyncCount}
                      </span>
                    )}
                  </span>
                  <span className="relative z-10 whitespace-nowrap">
                    {compactMobile ? item.shortLabel : item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {compactMobile && (
            <a
              href="/releases/luminavital-release.apk"
              download="LuminaVital-BioOptic-v1.0.0.apk"
              onClick={() => onOpenApkCenter()}
              className="ml-1 flex flex-col items-center justify-center px-2.5 py-2 rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/25 border border-emerald-400/40 text-emerald-300 text-[10px] font-semibold"
              title="Download Android .APK"
            >
              <Smartphone className="w-4 h-4 mb-0.5" />
              <span>.APK</span>
            </a>
          )}
        </div>
      </div>
    </nav>
  );
};
