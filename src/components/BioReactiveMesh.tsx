import React from 'react';
import { motion } from 'framer-motion';
import type { BioAlertState, ThemeMode } from '../types';

interface BioReactiveMeshProps {
  bpm: number;
  alertState: BioAlertState;
  theme: ThemeMode;
}

const PALETTES: Record<BioAlertState, [string, string, string, string]> = {
  coherent: ['#10B981', '#06B6D4', '#0EA5E9', '#14B8A6'],
  'high-kelvin': ['#6366F1', '#38BDF8', '#818CF8', '#0284C7'],
  'hazard-stress': ['#F43F5E', '#F59E0B', '#FB7185', '#EA580C'],
};

const AMBER_SAFE_PALETTE: [string, string, string, string] = [
  '#F59E0B',
  '#FB923C',
  '#D97706',
  '#EA580C',
];

export const BioReactiveMesh: React.FC<BioReactiveMeshProps> = ({
  bpm,
  alertState,
  theme,
}) => {
  const safeBpm = Math.max(45, Math.min(180, bpm || 72));
  const beatDurationSec = Number((60 / safeBpm).toFixed(3));

  const colors = theme === 'amber' ? AMBER_SAFE_PALETTE : PALETTES[alertState];
  const baseOpacity = theme === 'daylight' ? 0.24 : theme === 'eco' ? 0.14 : 0.32;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* Blob 1: Primary Cardiac Pulse Core */}
      <motion.div
        style={{
          background: `radial-gradient(circle, ${colors[0]} 0%, transparent 68%)`,
          willChange: 'transform, opacity',
        }}
        animate={{
          scale: theme === 'eco' ? [1, 1.04, 1] : [1, 1.14, 1],
          x: ['-6%', '4%', '-6%'],
          y: ['-4%', '6%', '-4%'],
          opacity: [baseOpacity * 0.85, baseOpacity * 1.15, baseOpacity * 0.85],
        }}
        transition={{
          scale: {
            duration: beatDurationSec,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          opacity: {
            duration: beatDurationSec,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          x: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute -top-28 -left-24 w-[36rem] h-[36rem] rounded-full blur-3xl"
      />

      {/* Blob 2: Secondary Chromatic Counter-Drift */}
      <motion.div
        style={{
          background: `radial-gradient(circle, ${colors[1]} 0%, transparent 68%)`,
          willChange: 'transform',
        }}
        animate={{
          scale: theme === 'eco' ? 1 : [1.05, 0.94, 1.05],
          x: ['5%', '-7%', '5%'],
          y: ['4%', '-5%', '4%'],
        }}
        transition={{
          scale: {
            duration: beatDurationSec * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          x: { duration: 24, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 19, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute top-1/4 -right-28 w-[34rem] h-[34rem] rounded-full blur-3xl"
      />

      {/* Blob 3: Lower Left Autonomic Field */}
      <motion.div
        style={{
          background: `radial-gradient(circle, ${colors[2]} 0%, transparent 70%)`,
          opacity: baseOpacity * 0.8,
          willChange: 'transform',
        }}
        animate={{
          x: ['-4%', '8%', '-4%'],
          y: ['6%', '-6%', '6%'],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -bottom-32 left-1/6 w-[32rem] h-[32rem] rounded-full blur-3xl"
      />

      {/* Blob 4: Lower Right Spectral Halo */}
      <motion.div
        style={{
          background: `radial-gradient(circle, ${colors[3]} 0%, transparent 70%)`,
          opacity: baseOpacity * 0.72,
          willChange: 'transform',
        }}
        animate={{
          scale: theme === 'eco' ? 1 : [0.96, 1.1, 0.96],
          x: ['3%', '-6%', '3%'],
          y: ['-5%', '4%', '-5%'],
        }}
        transition={{
          scale: {
            duration: beatDurationSec,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          x: { duration: 21, repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 25, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute -bottom-24 right-1/5 w-[30rem] h-[30rem] rounded-full blur-3xl"
      />
    </div>
  );
};
