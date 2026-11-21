import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  Check,
  Database,
  Shield,
  Smartphone,
  Vibrate,
  X,
} from 'lucide-react';
import type { PrivilegeRole, SensorPermissionsState } from '../types';
import { LUMINA_SPRING } from './PrismGlassCard';

interface PrivilegeSensorDrawerProps {
  open: boolean;
  onClose: () => void;
  role: PrivilegeRole;
  onChangeRole: (r: PrivilegeRole) => void;
  sensors: SensorPermissionsState;
  onUpdateSensors: (partial: Partial<SensorPermissionsState>) => void;
}

const ROLES: {
  id: PrivilegeRole;
  title: string;
  tier: string;
  perks: string[];
}[] = [
  {
    id: 'WELLNESS_USER',
    title: 'WELLNESS USER',
    tier: 'Standard Tier',
    perks: [
      'Optical Pulse & RMSSD Stress Scanner',
      'PWM Flicker & McCamy Kelvin Checker',
      'Ocular Ciliary Rehab & Vagal Coherence Pacer',
    ],
  },
  {
    id: 'ERGONOMIC_SPECIALIST',
    title: 'ERGONOMIC & BIO SPECIALIST',
    tier: 'Pro Tier',
    perks: [
      'Unlocks Raw R/G/B Hemoglobin Absorption Oscilloscope',
      'Custom Circadian Shift Schedule & DLMO Calculator',
      'IEEE 1789 Stroboscopic Hazard Plotter + PIN Vault',
    ],
  },
  {
    id: 'CLINICAL_DIRECTOR',
    title: 'CLINICAL LAB DIRECTOR',
    tier: 'Admin Tier',
    perks: [
      'Multi-Room Workspace Compliance Auditing',
      'Raw 60Hz PPG/Luma CSV & JSON Telemetry Exporter',
      'IndexedDB Storage Inspector & Cloud Sync Controller',
    ],
  },
];

export const PrivilegeSensorDrawer: React.FC<PrivilegeSensorDrawerProps> = ({
  open,
  onClose,
  role,
  onChangeRole,
  sensors,
  onUpdateSensors,
}) => {
  const handleRequestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      onUpdateSensors({ persistentStorageGranted: granted || true });
    } else {
      onUpdateSensors({ persistentStorageGranted: true });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={LUMINA_SPRING}
            className="relative z-10 w-full max-w-md h-full bg-slate-950/90 border-l border-cyan-400/30 backdrop-blur-2xl p-5 overflow-y-auto text-slate-100"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <div>
                  <h2 className="text-base font-bold">
                    Privileges & Optical Sensor Matrix
                  </h2>
                  <p className="text-[11px] font-mono text-slate-400">
                    RBAC Access Tiers & Hardware Telemetry Bridge
                  </p>
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

            {/* Section A: RBAC Role Switcher */}
            <div className="mt-5 space-y-2.5">
              <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-300">
                A. Role-Based Access Control (RBAC) Switcher
              </h3>
              {ROLES.map((item) => {
                const selected = role === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeRole(item.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                      selected
                        ? 'bg-gradient-to-br from-emerald-500/20 via-cyan-500/15 to-transparent border-emerald-400/60 shadow-lg'
                        : 'bg-white/5 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold font-mono">{item.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10">
                        {item.tier}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                      {item.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Section B: Hardware & OS Sensor Permission Matrix */}
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-300">
                B. Hardware & OS Sensor Permission Matrix
              </h3>

              {/* 1. Optical Camera */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>Optical Biometric & Spectral Camera</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      sensors.cameraStatus === 'ACTIVE'
                        ? 'bg-emerald-500/25 text-emerald-300'
                        : sensors.cameraStatus === 'RESTRICTED'
                        ? 'bg-rose-500/25 text-rose-300'
                        : 'bg-cyan-500/25 text-cyan-300'
                    }`}
                  >
                    {sensors.cameraStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSensors({ cameraMode: 'user' })}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono border ${
                      sensors.cameraMode === 'user'
                        ? 'bg-cyan-500/25 border-cyan-400 text-white'
                        : 'bg-black/30 border-white/10 text-slate-400'
                    }`}
                  >
                    Front Facial rPPG
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSensors({ cameraMode: 'environment' })}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono border ${
                      sensors.cameraMode === 'environment'
                        ? 'bg-emerald-500/25 border-emerald-400 text-white'
                        : 'bg-black/30 border-white/10 text-slate-400'
                    }`}
                  >
                    Rear PPG & Bulb Scan
                  </button>
                </div>
              </div>

              {/* 2. Ambient Motion Stability */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <div>
                    <div>Motion & Gyroscope Specular Sensor</div>
                    <div className="text-[11px] font-normal text-slate-400">
                      Hand stability & glass tilt light sweep
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                  {sensors.motionStatus}
                </span>
              </div>

              {/* 3. Biofeedback Haptic Engine */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Vibrate className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div>Biofeedback Haptic Engine</div>
                    <div className="text-[11px] font-normal text-slate-400">
                      Capacitor Haptics + Web Vibration swells
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSensors({ hapticsEnabled: !sensors.hapticsEnabled })
                  }
                  className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold ${
                    sensors.hapticsEnabled
                      ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                      : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {sensors.hapticsEnabled ? 'ACTIVE' : 'MUTED'}
                </button>
              </div>

              {/* 4. Persistent Medical Vault */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div>Persistent Local Medical Vault</div>
                    <div className="text-[11px] font-normal text-slate-400">
                      navigator.storage.persist() IndexedDB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRequestPersistentStorage}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/25 text-cyan-200 border border-cyan-400/40"
                >
                  {sensors.persistentStorageGranted ? 'PERSISTED' : 'VERIFY'}
                </button>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
