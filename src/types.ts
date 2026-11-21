export type ThemeMode = 'obsidian' | 'amber' | 'daylight' | 'eco';

export type PrivilegeRole = 'WELLNESS_USER' | 'ERGONOMIC_SPECIALIST' | 'CLINICAL_DIRECTOR';

export type ViewportMode = 'desktop' | 'mobile';

export type ActiveModule =
  | 'bio-pulse'
  | 'spectrometer'
  | 'ocular-rehab'
  | 'vagal-sync'
  | 'vault-sync';

export type BioAlertState = 'coherent' | 'high-kelvin' | 'hazard-stress';

export type SensorPermissionStatus = 'ACTIVE' | 'SIMULATOR ACTIVE' | 'RESTRICTED';

export interface SensorPermissionsState {
  cameraMode: 'user' | 'environment';
  cameraStatus: SensorPermissionStatus;
  motionStatus: SensorPermissionStatus;
  hapticsEnabled: boolean;
  persistentStorageGranted: boolean;
}

export interface BiometricPulseLog {
  id?: number;
  uuid: string;
  timestamp: number;
  source: 'LIVE_CAMERA_RPPG' | 'SIMULATOR';
  presetLabel: string;
  bpm: number;
  rmssdMs: number;
  stressScore: number; // 0 - 100
  respirationRate: number; // breaths/min
  coherenceScore: number; // 0 - 100
  waveformSnapshot: number[]; // 120 normalized samples
  rgbRatioMean: number;
  notes?: string;
  syncedToCloud: boolean;
}

export interface LightingAuditLog {
  id?: number;
  uuid: string;
  timestamp: number;
  roomName: string;
  source: 'LIVE_SPECTROMETER' | 'SIMULATOR';
  kelvin: number;
  cieX: number;
  cieY: number;
  flickerHz: number;
  modulationDepthPct: number;
  luxEstimate: number;
  ieeeRiskZone: 'SAFE' | 'LOW_RISK' | 'HIGH_HAZARD';
  melatoninSuppressionPct: number;
  verdict: string;
  lumaWaveform: number[];
  syncedToCloud: boolean;
}

export interface OcularSessionLog {
  id?: number;
  uuid: string;
  timestamp: number;
  mode: 'SMOOTH_PURSUIT' | 'SACCADIC_PRISM' | 'GABOR_CONTRAST' | 'GUARDIAN_20_20_20';
  durationSec: number;
  accuracyOrScore: number;
  syncedToCloud: boolean;
}

export type SyncQueueRecordType = 'BIOMETRIC_PULSE' | 'LIGHTING_AUDIT' | 'OCULAR_REHAB';

export interface SyncQueueItem {
  id?: number;
  recordUuid: string;
  recordType: SyncQueueRecordType;
  createdAt: number;
  status: 'PENDING' | 'SYNCED';
  payloadSummary: string;
}

export type ModalReportPayload =
  | { kind: 'biometric'; data: BiometricPulseLog }
  | { kind: 'lighting'; data: LightingAuditLog }
  | null;
