import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Download,
  Monitor,
  Smartphone,
  Shield,
  Moon,
  Sun,
  Zap,
  Sparkles,
  Eye,
} from 'lucide-react';
import type { PrivilegeRole, ThemeMode, ViewportMode } from '../types';
import { LUMINA_SPRING } from './PrismGlassCard';

interface TopStationHeaderProps {
  theme: ThemeMode;
  onChangeTheme: (t: ThemeMode) => void;
  viewportMode: ViewportMode;
  onChangeViewportMode: (v: ViewportMode) => void;
  role: PrivilegeRole;
  onOpenPrivilegeDrawer: () => void;
  onOpenApkModal: () => void;
  liveBpm: number;
  liveKelvin: number;
  guardianSecondsLeft: number;
  guardianBreakActive: boolean;
}

const THEME_OPTIONS: {
  id: ThemeMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'obsidian', label: 'Obsidian', icon: Sparkles },
  { id: 'amber', label: 'Amber 0-Blue', icon: Moon },
  { id: 'daylight', label: 'Daylight', icon: Sun },
  { id: 'eco', label: 'Eco 60FPS', icon: Zap },
];

const ROLE_LABELS: Record<PrivilegeRole, string> = {
  WELLNESS_USER: 'Wellness Tier',
  ERGONOMIC_SPECIALIST: 'Bio Specialist',
  CLINICAL_DIRECTOR: 'Clinical Director',
};

export const TopStationHeader: React.FC<TopStationHeaderProps> = ({
  theme,
  onChangeTheme,
  viewportMode,
  onChangeViewportMode,
  role,
  onOpenPrivilegeDrawer,
  onOpenApkModal,
  liveBpm,
  liveKelvin,
  guardianSecondsLeft,
  guardianBreakActive,
}) => {
  const mins = Math.floor(guardianSecondsLeft / 60);
  const secs = guardianSecondsLeft % 60;
  const formattedGuardian = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <header className="relative z-20 w-full px-3 sm:px-6 pt-3 pb-2">
      <div className="lv-prism-outer rounded-2xl">
        <div className="lv-glass-inner rounded-[15px] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Identity + Live Vitals Pill */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 via-cyan-500/20 to-rose-500/25 border border-cyan-400/35 flex items-center justify-center shadow-inner">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-sm sm:text-base">
                  LUMINA-VITAL
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-400/30">
                  rPPG · IEEE 1789 · CCT
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[11px] text-[var(--lv-text-secondary)] font-mono">
                <span>{liveBpm} BPM</span>
                <span className="opacity-40">•</span>
                <span>{liveKelvin}K</span>
                <span className="opacity-40">•</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    guardianBreakActive ? 'text-amber-400 font-semibold animate-pulse' : ''
                  }`}
                  title="Smart 20-20-20 Ocular Ergonomic Guardian"
                >
                  <Eye className="w-3 h-3" />
                  20-20-20: {guardianBreakActive ? 'LOOK 20FT!' : formattedGuardian}
                </span>
              </div>
            </div>
          </div>

          {/* Center Controls: Viewport Form-Factor Toggle & 4-Theme Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Desktop Station View | Mobile APK Preview */}
            <div className="hidden lg:flex items-center p-1 rounded-xl bg-black/20 border border-white/10">
              <button
                type="button"
                onClick={() => onChangeViewportMode('desktop')}
                className={`relative px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewportMode === 'desktop'
                    ? 'text-white'
                    : 'text-[var(--lv-text-secondary)] hover:text-[var(--lv-text-primary)]'
                }`}
              >
                {viewportMode === 'desktop' && (
                  <motion.span
                    layoutId="viewport-mode-pill"
                    transition={LUMINA_SPRING}
                    className="absolute inset-0 rounded-lg bg-cyan-500/30 border border-cyan-400/40"
                  />
                )}
                <Monitor className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">Desktop Station View</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeViewportMode('mobile')}
                className={`relative px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewportMode === 'mobile'
                    ? 'text-white'
                    : 'text-[var(--lv-text-secondary)] hover:text-[var(--lv-text-primary)]'
                }`}
              >
                {viewportMode === 'mobile' && (
                  <motion.span
                    layoutId="viewport-mode-pill"
                    transition={LUMINA_SPRING}
                    className="absolute inset-0 rounded-lg bg-emerald-500/30 border border-emerald-400/40"
                  />
                )}
                <Smartphone className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">Mobile APK Preview</span>
              </button>
            </div>

            {/* 4 Specialized Themes & GPU Modes */}
            <div
              className="flex items-center p-1 rounded-xl bg-black/20 border border-white/10"
              role="group"
              aria-label="Theme and Circadian Environment Switcher"
            >
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeTheme(opt.id)}
                    title={opt.label}
                    className={`relative px-2 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      active
                        ? 'text-amber-200 font-semibold'
                        : 'text-[var(--lv-text-secondary)] hover:text-[var(--lv-text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="theme-switcher-pill"
                        transition={LUMINA_SPRING}
                        className="absolute inset-0 rounded-lg bg-white/15 border border-white/25"
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="hidden xl:inline relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Action Cluster: RBAC & Sensor Drawer + One-Tap .APK Download */}
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenPrivilegeDrawer}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/15 flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{ROLE_LABELS[role]}</span>
              <span className="sm:hidden">RBAC</span>
            </motion.button>

            <motion.a
              href="/releases/luminavital-release.apk"
              download="LuminaVital-BioOptic-v1.0.0.apk"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onOpenApkModal()}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shadow-[0_0_24px_rgba(16,185,129,0.45)] border border-emerald-300/40 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Android .APK</span>
            </motion.a>
          </div>
        </div>
      </div>
    </header>
  );
};
