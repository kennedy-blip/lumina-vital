import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { db, seedInitialVaultIfEmpty } from './services/db';
import { vagalAudio } from './services/vagalAudio';
import type {
  ActiveModule,
  BioAlertState,
  ModalReportPayload,
  PrivilegeRole,
  SensorPermissionsState,
  ThemeMode,
  ViewportMode,
} from './types';
import { BioReactiveMesh } from './components/BioReactiveMesh';
import { TopStationHeader } from './components/TopStationHeader';
import { GooeyNavDock } from './components/GooeyNavDock';
import { BioPulseLab } from './components/BioPulseLab';
import { FlickerSpectrometer } from './components/FlickerSpectrometer';
import { OcularNeuroRehab } from './components/OcularNeuroRehab';
import { VagalCoherenceSync } from './components/VagalCoherenceSync';
import { DosimeterVault } from './components/DosimeterVault';
import { PrivilegeSensorDrawer } from './components/PrivilegeSensorDrawer';
import { ApkDownloadModal } from './components/ApkDownloadModal';
import { ClinicalReportModal } from './components/ClinicalReportModal';
import { LUMINA_SPRING } from './components/PrismGlassCard';

export const App: React.FC = () => {
  // Instant Hydration from localStorage
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('lv-theme') as ThemeMode | null;
    return saved || 'obsidian';
  });

  const [role, setRole] = useState<PrivilegeRole>(() => {
    const saved = localStorage.getItem('lv-role') as PrivilegeRole | null;
    return saved || 'ERGONOMIC_SPECIALIST';
  });

  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'mobile';
    return 'desktop';
  });

  const [isNativeMobileViewport, setIsNativeMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.innerWidth < 768 || Capacitor.isNativePlatform()
      : false
  );

  const [activeModule, setActiveModule] = useState<ActiveModule>('bio-pulse');

  // Shared Bio-Reactive Physiological & Environmental State
  const [liveBpm, setLiveBpm] = useState<number>(72);
  const [liveStress, setLiveStress] = useState<number>(29);
  const [liveRmssd, setLiveRmssd] = useState<number>(54);
  const [liveKelvin, setLiveKelvin] = useState<number>(4200);
  const [liveIeeeRisk, setLiveIeeeRisk] = useState<'SAFE' | 'LOW_RISK' | 'HIGH_HAZARD'>('SAFE');

  // Hardware & OS Sensor Matrix State
  const [sensors, setSensors] = useState<SensorPermissionsState>({
    cameraMode: 'user',
    cameraStatus: 'SIMULATOR ACTIVE',
    motionStatus: 'ACTIVE',
    hapticsEnabled: true,
    persistentStorageGranted: true,
  });
  const [motionMagnitudeG, setMotionMagnitudeG] = useState<number>(0);

  // Modals & Drawers (Trigger "Depth Push" Scale 0.94 + 28px Radius)
  const [privilegeDrawerOpen, setPrivilegeDrawerOpen] = useState(false);
  const [apkModalOpen, setApkModalOpen] = useState(false);
  const [reportModalPayload, setReportModalPayload] = useState<ModalReportPayload>(null);

  const [vaultRefreshSignal, setVaultRefreshSignal] = useState<number>(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [apkSha256, setApkSha256] = useState<string>(
    'b71c94be703f304730dfdeb6c2bbc41dd96b1dd2f4947701b834528c11d3d27c'
  );

  // Smart 20-20-20 Ergonomic Guardian Background Countdown (20 mins = 1200s)
  const [guardianSecondsLeft, setGuardianSecondsLeft] = useState<number>(1200);
  const [guardianBreakActive, setGuardianBreakActive] = useState<boolean>(false);
  const [guardianBreakCountdown, setGuardianBreakCountdown] = useState<number>(20);

  const anyModalOpen =
    privilegeDrawerOpen || apkModalOpen || reportModalPayload !== null;

  // Apply Theme Attribute & Persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lv-theme', theme);

    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({
        style: theme === 'daylight' ? Style.Light : Style.Dark,
      }).catch(() => {});
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lv-role', role);
  }, [role]);

  // Seed IndexedDB Medical Vault & Load SHA-256 Checksum if Present
  useEffect(() => {
    (async () => {
      await seedInitialVaultIfEmpty();
      const pending = await db.syncQueue.where('status').equals('PENDING').count();
      setPendingSyncCount(pending);
      setVaultRefreshSignal((v) => v + 1);

      try {
        const resp = await fetch('/releases/luminavital-release.apk.sha256');
        if (resp.ok) {
          const txt = (await resp.text()).trim().split(/\s+/)[0];
          if (txt && txt.length === 64) {
            setApkSha256(txt);
          }
        }
      } catch {
        // Fallback deterministic checksum remains displayed
      }
    })();
  }, []);

  const refreshVaultCounts = async () => {
    const pending = await db.syncQueue.where('status').equals('PENDING').count();
    setPendingSyncCount(pending);
    setVaultRefreshSignal((v) => v + 1);
  };

  // Track Window Resize for Automatic Native Mobile vs Desktop Detection
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768 || Capacitor.isNativePlatform();
      setIsNativeMobileViewport(mobile);
      if (mobile) setViewportMode('mobile');
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Cursor & DeviceOrientation Specular Lighting Sweep + Motion Artifact Sensor
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const xPct = ((e.clientX / Math.max(window.innerWidth, 1)) * 100).toFixed(1);
      const yPct = ((e.clientY / Math.max(window.innerHeight, 1)) * 100).toFixed(1);
      document.documentElement.style.setProperty('--specular-x', `${xPct}%`);
      document.documentElement.style.setProperty('--specular-y', `${yPct}%`);
    };

    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        const xPct = Math.max(5, Math.min(95, 50 + e.gamma * 1.1)).toFixed(1);
        const yPct = Math.max(5, Math.min(95, 45 + (e.beta - 30) * 0.9)).toFixed(1);
        document.documentElement.style.setProperty('--specular-x', `${xPct}%`);
        document.documentElement.style.setProperty('--specular-y', `${yPct}%`);
      }
    };

    const handleDeviceMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
        setMotionMagnitudeG(mag);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('deviceorientation', handleDeviceOrientation, {
      passive: true,
    });
    window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      window.removeEventListener('devicemotion', handleDeviceMotion);
    };
  }, []);

  // Smart 20-20-20 Ergonomic Guardian Background Loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (guardianBreakActive) {
        setGuardianBreakCountdown((prev) => {
          if (prev <= 1) {
            setGuardianBreakActive(false);
            setGuardianSecondsLeft(1200);
            vagalAudio.playOcularHarmonicChime();
            void vagalAudio.triggerBiofeedbackHaptic(
              'ocular-complete',
              sensors.hapticsEnabled
            );
            return 20;
          }
          return prev - 1;
        });
      } else {
        setGuardianSecondsLeft((prev) => {
          if (prev <= 1) {
            setGuardianBreakActive(true);
            setGuardianBreakCountdown(20);
            vagalAudio.playOcularHarmonicChime();
            void vagalAudio.triggerBiofeedbackHaptic(
              'ocular-complete',
              sensors.hapticsEnabled
            );
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [guardianBreakActive, sensors.hapticsEnabled]);

  // Compute Bio-Reactive Mesh Alert State
  const bioAlertState: BioAlertState =
    liveStress >= 68 || liveBpm >= 105 || liveIeeeRisk === 'HIGH_HAZARD'
      ? 'hazard-stress'
      : liveKelvin >= 5400
      ? 'high-kelvin'
      : 'coherent';

  const handleUpdateSensors = (partial: Partial<SensorPermissionsState>) => {
    setSensors((prev) => ({ ...prev, ...partial }));
  };

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'bio-pulse':
        return (
          <BioPulseLab
            role={role}
            sensors={sensors}
            onUpdateSensors={handleUpdateSensors}
            motionMagnitudeG={motionMagnitudeG}
            onLiveVitalsChange={(bpm, stress, rmssd) => {
              setLiveBpm(bpm);
              setLiveStress(stress);
              setLiveRmssd(rmssd);
            }}
            onLogSaved={refreshVaultCounts}
          />
        );
      case 'spectrometer':
        return (
          <FlickerSpectrometer
            role={role}
            sensors={sensors}
            onUpdateSensors={handleUpdateSensors}
            onLiveSpectrumChange={(kelvin, zone) => {
              setLiveKelvin(kelvin);
              setLiveIeeeRisk(zone);
            }}
            onAuditSaved={refreshVaultCounts}
          />
        );
      case 'ocular-rehab':
        return (
          <OcularNeuroRehab
            hapticsEnabled={sensors.hapticsEnabled}
            guardianSecondsLeft={guardianSecondsLeft}
            guardianBreakActive={guardianBreakActive}
            guardianBreakCountdown={guardianBreakCountdown}
            onTriggerImmediateBreak={() => {
              setGuardianBreakActive(true);
              setGuardianBreakCountdown(20);
              vagalAudio.playOcularHarmonicChime();
              void vagalAudio.triggerBiofeedbackHaptic(
                'ocular-complete',
                sensors.hapticsEnabled
              );
            }}
            onResetGuardianTimer={() => {
              setGuardianBreakActive(false);
              setGuardianSecondsLeft(1200);
            }}
            onSessionSaved={refreshVaultCounts}
          />
        );
      case 'vagal-sync':
        return (
          <VagalCoherenceSync
            latestBpm={liveBpm}
            latestStress={liveStress}
            latestRmssd={liveRmssd}
            hapticsEnabled={sensors.hapticsEnabled}
          />
        );
      case 'vault-sync':
        return (
          <DosimeterVault
            role={role}
            refreshSignal={vaultRefreshSignal}
            onSelectReportModal={(payload) => setReportModalPayload(payload)}
            onSyncQueueChanged={refreshVaultCounts}
          />
        );
    }
  };

  const showFramedMobileSimulator =
    viewportMode === 'mobile' && !isNativeMobileViewport;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* 3.5% Opacity Frosted Acrylic SVG Film-Grain Noise Overlay */}
      <svg
        className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-[0.035]"
        aria-hidden="true"
      >
        <filter id="lumina-acrylic-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.82"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#lumina-acrylic-noise)" />
      </svg>

      {/* GPU-Accelerated Bio-Reactive Mesh Gradient Underlay */}
      <BioReactiveMesh bpm={liveBpm} alertState={bioAlertState} theme={theme} />

      {/* "Depth Push" App Shell (Scales to 0.94 with 28px rounded corners & depth blur when modals open) */}
      <motion.div
        animate={{
          scale: anyModalOpen ? 0.94 : 1,
          borderRadius: anyModalOpen ? '28px' : '0px',
          filter: anyModalOpen ? 'blur(4px)' : 'blur(0px)',
        }}
        transition={LUMINA_SPRING}
        className="relative z-10 min-h-screen flex flex-col origin-center"
      >
        <TopStationHeader
          theme={theme}
          onChangeTheme={setTheme}
          viewportMode={viewportMode}
          onChangeViewportMode={setViewportMode}
          role={role}
          onOpenPrivilegeDrawer={() => setPrivilegeDrawerOpen(true)}
          onOpenApkModal={() => setApkModalOpen(true)}
          liveBpm={liveBpm}
          liveKelvin={liveKelvin}
          guardianSecondsLeft={guardianSecondsLeft}
          guardianBreakActive={guardianBreakActive}
        />

        {showFramedMobileSimulator ? (
          /* Interactive Android Phone APK Replica Preview Frame on Desktop */
          <main className="flex-1 flex flex-col items-center justify-center px-4 py-4">
            <div className="w-[412px] max-w-full h-[780px] rounded-[42px] p-2.5 bg-gradient-to-b from-slate-700 via-slate-900 to-black shadow-[0_30px_90px_rgba(0,0,0,0.75)] border border-white/20 flex flex-col overflow-hidden">
              {/* Android Camera Punch-Hole Status Bar */}
              <div className="flex items-center justify-between px-5 py-2 text-[11px] font-mono text-slate-300 bg-slate-950/85 rounded-t-[32px]">
                <span>LuminaVital APK</span>
                <span className="w-3 h-3 rounded-full bg-black border border-slate-700" />
                <span>60FPS DSP · 100%</span>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[var(--lv-bg-base)]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeModule}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderActiveModule()}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="bg-slate-950/90 border-t border-white/10 rounded-b-[32px] pt-1">
                <GooeyNavDock
                  activeModule={activeModule}
                  onSelectModule={setActiveModule}
                  compactMobile
                  onOpenApkCenter={() => setApkModalOpen(true)}
                  pendingSyncCount={pendingSyncCount}
                />
              </div>
            </div>
          </main>
        ) : (
          /* Full-Screen Clinical Desktop Workstation OR Native Edge-to-Edge Mobile Layout */
          <>
            {!isNativeMobileViewport && (
              <GooeyNavDock
                activeModule={activeModule}
                onSelectModule={setActiveModule}
                onOpenApkCenter={() => setApkModalOpen(true)}
                pendingSyncCount={pendingSyncCount}
              />
            )}

            <main
              className={`flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pt-2 ${
                isNativeMobileViewport ? 'pb-24' : 'pb-10'
              }`}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeModule}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  {renderActiveModule()}
                </motion.div>
              </AnimatePresence>
            </main>

            {isNativeMobileViewport && (
              <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-3">
                <GooeyNavDock
                  activeModule={activeModule}
                  onSelectModule={setActiveModule}
                  compactMobile
                  onOpenApkCenter={() => setApkModalOpen(true)}
                  pendingSyncCount={pendingSyncCount}
                />
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Modals & Drawers */}
      <PrivilegeSensorDrawer
        open={privilegeDrawerOpen}
        onClose={() => setPrivilegeDrawerOpen(false)}
        role={role}
        onChangeRole={setRole}
        sensors={sensors}
        onUpdateSensors={handleUpdateSensors}
      />

      <ApkDownloadModal
        open={apkModalOpen}
        onClose={() => setApkModalOpen(false)}
        apkSha256={apkSha256}
      />

      <ClinicalReportModal
        payload={reportModalPayload}
        onClose={() => setReportModalPayload(null)}
      />
    </div>
  );
};

export default App;
