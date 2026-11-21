import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  CloudUpload,
  Database,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  Lock,
  ShieldCheck,
  Unlock,
  Wifi,
  WifiOff,
  ArrowUpRight,
} from 'lucide-react';
import { db, flushPendingSyncQueue } from '../services/db';
import type {
  BiometricPulseLog,
  LightingAuditLog,
  ModalReportPayload,
  PrivilegeRole,
  SyncQueueItem,
} from '../types';
import { PrismGlassCard } from './PrismGlassCard';

interface DosimeterVaultProps {
  role: PrivilegeRole;
  refreshSignal: number;
  onSelectReportModal: (payload: ModalReportPayload) => void;
  onSyncQueueChanged: () => void;
}

const DEFAULT_PIN = '2026';

export const DosimeterVault: React.FC<DosimeterVaultProps> = ({
  role,
  refreshSignal,
  onSelectReportModal,
  onSyncQueueChanged,
}) => {
  const [biometrics, setBiometrics] = useState<BiometricPulseLog[]>([]);
  const [audits, setAudits] = useState<LightingAuditLog[]>([]);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);

  // Optional 4-digit Glass PIN Lock with liquid un-blur animation
  const [pinLocked, setPinLocked] = useState<boolean>(true);
  const [pinEntry, setPinEntry] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncing, setSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const loadAllRecords = async () => {
    const [b, a, q] = await Promise.all([
      db.biometricLogs.orderBy('timestamp').reverse().toArray(),
      db.lightingAudits.orderBy('timestamp').reverse().toArray(),
      db.syncQueue.orderBy('createdAt').reverse().toArray(),
    ]);
    setBiometrics(b);
    setAudits(a);
    setQueueItems(q);
  };

  useEffect(() => {
    void loadAllRecords();
  }, [refreshSignal]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleDigitPress = (digit: string) => {
    if (pinEntry.length >= 4) return;
    const next = pinEntry + digit;
    setPinEntry(next);
    setPinError(false);

    if (next.length === 4) {
      if (next === DEFAULT_PIN) {
        setTimeout(() => {
          setPinLocked(false);
          setPinEntry('');
        }, 140);
      } else {
        setPinError(true);
        setTimeout(() => setPinEntry(''), 450);
      }
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 450));
    const count = await flushPendingSyncQueue();
    await loadAllRecords();
    onSyncQueueChanged();
    setSyncing(false);
    setSyncToast(
      count > 0
        ? `Synced ${count} Offline IndexedDB Diagnostic Record(s) to Encrypted Cloud Ledger.`
        : 'All Local IndexedDB Medical Vault Records Are Already Synced.'
    );
    setTimeout(() => setSyncToast(null), 3500);
  };

  const handleExportTelemetry = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const payload = JSON.stringify({ biometrics, lightingAudits: audits }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LuminaVital-Telemetry-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const header =
      'Type,UUID,TimestampISO,LabelOrRoom,BPM_or_Kelvin,RMSSD_or_ModDepthPct,Stress_or_FlickerHz,RiskOrCoherence\n';
    const rows = [
      ...biometrics.map(
        (b) =>
          `BIOMETRIC,${b.uuid},${new Date(b.timestamp).toISOString()},"${b.presetLabel}",${b.bpm},${b.rmssdMs},${b.stressScore},${b.coherenceScore}%`
      ),
      ...audits.map(
        (l) =>
          `LIGHTING_AUDIT,${l.uuid},${new Date(l.timestamp).toISOString()},"${l.roomName}",${l.kelvin},${l.modulationDepthPct},${l.flickerHz},${l.ieeeRiskZone}`
      ),
    ].join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LuminaVital-60Hz-Telemetry-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingCount = queueItems.filter((q) => q.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      {/* Top Offline-First IndexedDB & Cloud Sync Header */}
      <PrismGlassCard innerClassName="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                Module 05 · Offline-First Dexie IndexedDB Medical Vault
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                }`}
              >
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'ONLINE SYNC READY' : 'OFFLINE QUEUE ACTIVE'}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold mt-1">
              PIN-Locked Biometric Ledger & Multi-Room Lighting Compliance Audits
            </h1>
            <p className="text-xs sm:text-sm text-[var(--lv-text-secondary)]">
              Click any audit or pulse card to morph it via shared-element physics into a full-screen Spectral & Cardiac Waveform Report.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPinLocked((l) => !l)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/20 flex items-center gap-1.5"
            >
              {pinLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-300" />
                  <span>Quick Unlock (PIN: 2026)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Lock Biometric Vault</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 text-white flex items-center gap-1.5 shadow-md"
            >
              <CloudUpload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
              <span>
                {syncing
                  ? 'Syncing Queue...'
                  : `Sync Cloud Queue (${pendingCount} Pending)`}
              </span>
            </button>
          </div>
        </div>

        {syncToast && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{syncToast}</span>
          </div>
        )}

        {/* Admin Tier (Clinical Lab Director): CSV & JSON Exporter + Storage Inspector */}
        {role === 'CLINICAL_DIRECTOR' && (
          <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
              <Database className="w-4 h-4" />
              <span>
                CLINICAL DIRECTOR · IndexedDB Inspector: {biometrics.length} rPPG Logs ·{' '}
                {audits.length} Room Audits · {queueItems.length} Sync Events
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportTelemetry('csv')}
                className="px-3 py-1.5 rounded-xl text-xs font-mono bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export 60Hz CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportTelemetry('json')}
                className="px-3 py-1.5 rounded-xl text-xs font-mono bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 flex items-center gap-1.5"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Export JSON Ledger</span>
              </button>
            </div>
          </div>
        )}
      </PrismGlassCard>

      {/* Two-Column Vault Grid: PIN-Protected Biometrics + Workspace Lighting Audits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Personal Biometric Logs (Protected behind 4-digit Glass PIN Pad with Liquid Un-Blur) */}
        <div className="lg:col-span-6 relative">
          <PrismGlassCard innerClassName="p-4 sm:p-5 min-h-[370px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold">Personal rPPG Biometric Logs</h2>
              </div>
              <span className="text-[11px] font-mono text-[var(--lv-text-secondary)]">
                {pinLocked ? 'PIN PROTECTED' : 'VAULT UNLOCKED'}
              </span>
            </div>

            {/* Liquid Un-Blur Animated Content */}
            <motion.div
              animate={{
                filter: pinLocked ? 'blur(14px)' : 'blur(0px)',
                opacity: pinLocked ? 0.35 : 1,
                scale: pinLocked ? 0.98 : 1,
              }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className={`space-y-2.5 ${pinLocked ? 'pointer-events-none select-none' : ''}`}
            >
              {biometrics.map((log) => (
                <PrismGlassCard
                  key={log.uuid}
                  layoutId={`report-card-${log.uuid}`}
                  interactive
                  onClick={() => onSelectReportModal({ kind: 'biometric', data: log })}
                  innerClassName="p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{log.presetLabel}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-[11px] font-mono text-[var(--lv-text-secondary)]">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-base font-extrabold text-emerald-400">
                        {log.bpm} BPM
                      </div>
                      <div className="text-[11px] text-[var(--lv-text-secondary)]">
                        RMSSD {log.rmssdMs}ms · Stress {log.stressScore}
                      </div>
                    </div>
                  </div>
                </PrismGlassCard>
              ))}
            </motion.div>

            {/* Glass 4-Digit PIN Pad Overlay */}
            {pinLocked && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                <div className="w-full max-w-[270px] rounded-2xl bg-slate-950/85 border border-cyan-400/35 p-4 backdrop-blur-xl shadow-2xl text-center">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 mb-2">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Enter Biometric Privacy PIN
                  </h3>
                  <p className="text-[11px] font-mono text-cyan-300 mt-0.5">
                    Demo PIN: <strong>2026</strong>
                  </p>

                  {/* 4 Dots */}
                  <div className="flex justify-center gap-2.5 my-3">
                    {[0, 1, 2, 3].map((idx) => (
                      <span
                        key={idx}
                        className={`w-3 h-3 rounded-full border transition-all ${
                          pinError
                            ? 'bg-rose-500 border-rose-400'
                            : idx < pinEntry.length
                            ? 'bg-emerald-400 border-emerald-300 scale-110'
                            : 'border-white/35'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 font-mono text-sm">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (key === 'C') setPinEntry('');
                          else if (key === 'OK') setPinLocked(false);
                          else handleDigitPress(key);
                        }}
                        className="py-2 rounded-xl bg-white/10 hover:bg-cyan-500/25 border border-white/15 font-bold text-white active:scale-95 transition"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </PrismGlassCard>
        </div>

        {/* Right: Workspace Lighting Audits */}
        <div className="lg:col-span-6 space-y-4">
          <PrismGlassCard innerClassName="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                Workspace & Room Lighting Compliance Audits
              </h2>
              <span className="text-[11px] font-mono text-[var(--lv-text-secondary)]">
                Tap card for Spectral Report
              </span>
            </div>

            <div className="space-y-2.5">
              {audits.map((audit) => {
                const badgeStyle =
                  audit.ieeeRiskZone === 'HIGH_HAZARD'
                    ? 'bg-rose-500/25 text-rose-200 border-rose-400/50'
                    : audit.ieeeRiskZone === 'LOW_RISK'
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                    : 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50';

                const badgeText =
                  audit.ieeeRiskZone === 'HIGH_HAZARD'
                    ? 'REPLACE BULB'
                    : audit.ieeeRiskZone === 'LOW_RISK'
                    ? 'LOW RISK'
                    : 'SAFE';

                return (
                  <PrismGlassCard
                    key={audit.uuid}
                    layoutId={`report-card-${audit.uuid}`}
                    interactive
                    onClick={() => onSelectReportModal({ kind: 'lighting', data: audit })}
                    innerClassName="p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>{audit.roomName}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                        <div className="text-[11px] font-mono text-[var(--lv-text-secondary)] mt-0.5">
                          {audit.kelvin}K ·{' '}
                          {audit.flickerHz === 0 ? 'DC' : `${audit.flickerHz}Hz`} /{' '}
                          {audit.modulationDepthPct}% Flicker
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border shrink-0 ${badgeStyle}`}
                      >
                        [{badgeText}]
                      </span>
                    </div>
                  </PrismGlassCard>
                );
              })}
            </div>
          </PrismGlassCard>

          {/* Offline-to-Online Sync Queue Ledger */}
          <PrismGlassCard innerClassName="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Offline-to-Online Cloud Sync Queue</span>
              <span className="font-mono text-[11px] text-cyan-300">
                {pendingCount} Pending / {queueItems.length} Total
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {queueItems.map((item) => (
                <div
                  key={`${item.recordUuid}-${item.id}`}
                  className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-black/25 border border-white/10"
                >
                  <span className="truncate pr-2">{item.payloadSummary}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      item.status === 'SYNCED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </PrismGlassCard>
        </div>
      </div>
    </div>
  );
};
