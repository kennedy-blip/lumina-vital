import Dexie, { type Table } from 'dexie';
import type {
  BiometricPulseLog,
  LightingAuditLog,
  OcularSessionLog,
  SyncQueueItem,
} from '../types';

export class LuminaVitalDatabase extends Dexie {
  biometricLogs!: Table<BiometricPulseLog, number>;
  lightingAudits!: Table<LightingAuditLog, number>;
  ocularSessions!: Table<OcularSessionLog, number>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('LuminaVitalMedicalVaultDB');
    this.version(1).stores({
      biometricLogs: '++id, uuid, timestamp, bpm, stressScore, syncedToCloud',
      lightingAudits: '++id, uuid, timestamp, roomName, ieeeRiskZone, syncedToCloud',
      ocularSessions: '++id, uuid, timestamp, mode, syncedToCloud',
      syncQueue: '++id, recordUuid, recordType, createdAt, status',
    });
  }
}

export const db = new LuminaVitalDatabase();

function makeSyntheticPPG(bpm: number, noise = 0.03): number[] {
  const arr: number[] = [];
  const freq = bpm / 60;
  for (let i = 0; i < 120; i++) {
    const t = i / 60;
    const phase = (t * freq) % 1;
    // Realistic arterial systolic + dicrotic notch wave shape
    const systolic = Math.exp(-Math.pow((phase - 0.18) / 0.085, 2));
    const dicrotic = 0.36 * Math.exp(-Math.pow((phase - 0.44) / 0.11, 2));
    const baseline = 0.06 * Math.sin(2 * Math.PI * 0.22 * t);
    const jitter = (Math.sin(i * 12.9898) * 43758.5453 % 1) * noise;
    arr.push(Number((systolic + dicrotic + baseline + jitter).toFixed(4)));
  }
  return arr;
}

function makeSyntheticLuma(freqHz: number, modDepthPct: number): number[] {
  const arr: number[] = [];
  const depth = modDepthPct / 100;
  for (let i = 0; i < 96; i++) {
    const t = i / 960;
    const raw = freqHz === 0
      ? 0.92 + 0.01 * Math.sin(i * 0.5)
      : 1 - depth * (0.5 + 0.5 * Math.sign(Math.sin(2 * Math.PI * freqHz * t)));
    arr.push(Number(raw.toFixed(3)));
  }
  return arr;
}

export async function seedInitialVaultIfEmpty(): Promise<void> {
  const bioCount = await db.biometricLogs.count();
  const auditCount = await db.lightingAudits.count();

  const now = Date.now();

  if (bioCount === 0) {
    const seedBios: BiometricPulseLog[] = [
      {
        uuid: 'bio-seed-01',
        timestamp: now - 1000 * 60 * 145,
        source: 'SIMULATOR',
        presetLabel: 'Focused Flow — Morning Baseline',
        bpm: 68,
        rmssdMs: 58,
        stressScore: 24,
        respirationRate: 13.2,
        coherenceScore: 86,
        waveformSnapshot: makeSyntheticPPG(68, 0.02),
        rgbRatioMean: 1.184,
        notes: 'Morning parasympathomimetic coherence baseline after sunlight exposure.',
        syncedToCloud: true,
      },
      {
        uuid: 'bio-seed-02',
        timestamp: now - 1000 * 60 * 48,
        source: 'LIVE_CAMERA_RPPG',
        presetLabel: 'Afternoon Screen Fatigue Scan',
        bpm: 89,
        rmssdMs: 29,
        stressScore: 63,
        respirationRate: 17.6,
        coherenceScore: 49,
        waveformSnapshot: makeSyntheticPPG(89, 0.05),
        rgbRatioMean: 1.112,
        notes: 'Elevated sympathetic tone after 2h under 6200K office LED panels.',
        syncedToCloud: false,
      },
    ];

    await db.biometricLogs.bulkAdd(seedBios);
    await db.syncQueue.add({
      recordUuid: 'bio-seed-02',
      recordType: 'BIOMETRIC_PULSE',
      createdAt: now - 1000 * 60 * 48,
      status: 'PENDING',
      payloadSummary: 'rPPG Scan · 89 BPM · RMSSD 29ms (Stress 63)',
    });
  }

  if (auditCount === 0) {
    const seedAudits: LightingAuditLog[] = [
      {
        uuid: 'lux-seed-01',
        timestamp: now - 1000 * 60 * 220,
        roomName: 'Home Office Desk — Primary Monitor',
        source: 'SIMULATOR',
        kelvin: 4200,
        cieX: 0.372,
        cieY: 0.371,
        flickerHz: 0,
        modulationDepthPct: 3.8,
        luxEstimate: 410,
        ieeeRiskZone: 'SAFE',
        melatoninSuppressionPct: 18,
        verdict: 'SAFE: True DC-Dimmed backlight (<4% ripple) & balanced neutral 4200K.',
        lumaWaveform: makeSyntheticLuma(0, 3.8),
        syncedToCloud: true,
      },
      {
        uuid: 'lux-seed-02',
        timestamp: now - 1000 * 60 * 75,
        roomName: 'Bedroom Nightstand LED Bulb',
        source: 'LIVE_SPECTROMETER',
        kelvin: 5850,
        cieX: 0.325,
        cieY: 0.335,
        flickerHz: 120,
        modulationDepthPct: 48.4,
        luxEstimate: 295,
        ieeeRiskZone: 'HIGH_HAZARD',
        melatoninSuppressionPct: 64,
        verdict: 'REPLACE BULB: 120Hz 48.4% PWM Flicker crosses IEEE 1789 migraine threshold + 5850K suppresses melatonin.',
        lumaWaveform: makeSyntheticLuma(120, 48.4),
        syncedToCloud: false,
      },
      {
        uuid: 'lux-seed-03',
        timestamp: now - 1000 * 60 * 25,
        roomName: 'Reading Lounge Incandescent',
        source: 'SIMULATOR',
        kelvin: 2680,
        cieX: 0.461,
        cieY: 0.411,
        flickerHz: 120,
        modulationDepthPct: 6.2,
        luxEstimate: 180,
        ieeeRiskZone: 'SAFE',
        melatoninSuppressionPct: 4,
        verdict: 'MELATONIN SAFE: Thermal filament inertia keeps ripple at 6.2% with warm 2680K spectrum.',
        lumaWaveform: makeSyntheticLuma(120, 6.2),
        syncedToCloud: true,
      },
    ];

    await db.lightingAudits.bulkAdd(seedAudits);
    await db.syncQueue.add({
      recordUuid: 'lux-seed-02',
      recordType: 'LIGHTING_AUDIT',
      createdAt: now - 1000 * 60 * 75,
      status: 'PENDING',
      payloadSummary: 'Bedroom Lamp · 5850K · 120Hz / 48.4% PWM [HIGH HAZARD]',
    });
  }
}

export async function saveBiometricLogToVault(
  entry: Omit<BiometricPulseLog, 'id' | 'uuid' | 'timestamp' | 'syncedToCloud'>
): Promise<BiometricPulseLog> {
  const uuid = `bio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = Date.now();
  const fullRecord: BiometricPulseLog = {
    ...entry,
    uuid,
    timestamp,
    syncedToCloud: false,
  };
  const id = await db.biometricLogs.add(fullRecord);
  await db.syncQueue.add({
    recordUuid: uuid,
    recordType: 'BIOMETRIC_PULSE',
    createdAt: timestamp,
    status: 'PENDING',
    payloadSummary: `${entry.presetLabel} · ${entry.bpm} BPM · RMSSD ${entry.rmssdMs}ms`,
  });
  return { ...fullRecord, id };
}

export async function saveLightingAuditToVault(
  entry: Omit<LightingAuditLog, 'id' | 'uuid' | 'timestamp' | 'syncedToCloud'>
): Promise<LightingAuditLog> {
  const uuid = `lux-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = Date.now();
  const fullRecord: LightingAuditLog = {
    ...entry,
    uuid,
    timestamp,
    syncedToCloud: false,
  };
  const id = await db.lightingAudits.add(fullRecord);
  await db.syncQueue.add({
    recordUuid: uuid,
    recordType: 'LIGHTING_AUDIT',
    createdAt: timestamp,
    status: 'PENDING',
    payloadSummary: `${entry.roomName} · ${entry.kelvin}K · ${entry.modulationDepthPct}% Flicker [${entry.ieeeRiskZone}]`,
  });
  return { ...fullRecord, id };
}

export async function saveOcularSessionToVault(
  entry: Omit<OcularSessionLog, 'id' | 'uuid' | 'timestamp' | 'syncedToCloud'>
): Promise<OcularSessionLog> {
  const uuid = `ocu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = Date.now();
  const fullRecord: OcularSessionLog = {
    ...entry,
    uuid,
    timestamp,
    syncedToCloud: false,
  };
  const id = await db.ocularSessions.add(fullRecord);
  await db.syncQueue.add({
    recordUuid: uuid,
    recordType: 'OCULAR_REHAB',
    createdAt: timestamp,
    status: 'PENDING',
    payloadSummary: `Ocular ${entry.mode} · ${entry.durationSec}s · Score ${entry.accuracyOrScore}%`,
  });
  return { ...fullRecord, id };
}

export async function flushPendingSyncQueue(): Promise<number> {
  const pending = await db.syncQueue.where('status').equals('PENDING').toArray();
  if (pending.length === 0) return 0;

  await db.transaction(
    'rw',
    db.biometricLogs,
    db.lightingAudits,
    db.ocularSessions,
    db.syncQueue,
    async () => {
      for (const item of pending) {
        if (item.id !== undefined) {
          await db.syncQueue.update(item.id, { status: 'SYNCED' });
        }
        if (item.recordType === 'BIOMETRIC_PULSE') {
          await db.biometricLogs
            .where('uuid')
            .equals(item.recordUuid)
            .modify({ syncedToCloud: true });
        } else if (item.recordType === 'LIGHTING_AUDIT') {
          await db.lightingAudits
            .where('uuid')
            .equals(item.recordUuid)
            .modify({ syncedToCloud: true });
        } else if (item.recordType === 'OCULAR_REHAB') {
          await db.ocularSessions
            .where('uuid')
            .equals(item.recordUuid)
            .modify({ syncedToCloud: true });
        }
      }
    }
  );

  return pending.length;
}
