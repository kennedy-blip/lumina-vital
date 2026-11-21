# LUMINA-VITAL · Bio-Optic rPPG & Circadian Spectrometer

**LUMINA-VITAL** is an offline-first biomedical optics & environmental diagnostic workstation (Vercel Web App + Self-Hosted Capacitor Android `.APK` Replica) that turns a laptop webcam or Android smartphone camera into:

1. **Bio-Pulse Lab (`src/services/ppgEngine.ts`):** Contactless facial ROI rPPG & fingertip PPG Heart Rate (`BPM`), HRV Autonomic Stress Index (`RMSSD` in ms), and Respiration Rate scanner using 60 FPS Green/Red hemoglobin chrominance extraction + `0.75–3.5 Hz` cardiac band-pass filtering, paired with 4 instant physiological signal presets.
2. **Flicker & Lux Spectrometer (`src/services/spectrometerEngine.ts`):** Real colorimetric RGB-to-CIE 1931 $(x, y)$ **McCamy Cubic Kelvin CCT Spectrometer** (`1,800K–10,000K`), rolling-shutter scanline PWM flicker analyzer, interactive **IEEE Std 1789-2015 Stroboscopic Hazard Plotter**, and Circadian Melatonin Verdict engine.
3. **Ocular Neuro-Rehab (`src/components/OcularNeuroRehab.tsx`):** Kinetic ciliary muscle therapy featuring Lissajous / Figure-8 liquid orb smooth pursuit, peripheral saccadic prism targets, cortical V1 Gabor patch + 12-meridian astigmatism contrast dial, and a background **Smart 20-20-20 Ergonomic Guardian** with harmonic chimes.
4. **Vagal Coherence Sync (`src/services/vagalAudio.ts`):** Closed-loop cardiac-linked resonance breathing sphere generating real-time Web Audio API `432 Hz` + `438 Hz` (`6 Hz` Theta binaural beat) vagal tones, pink-noise ocean surf swells, and Capacitor Android Haptics.
5. **Dosimeter Vault & Cloud Sync (`src/services/db.ts`):** Offline-first `Dexie.js` (`IndexedDB`) medical ledger with 4-digit PIN privacy lock (Demo PIN: `2026`), liquid un-blur animation, shared-element `layoutId` clinical report modals, CSV/JSON 60Hz telemetry export, and an offline-to-online sync queue.

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Capacitor Android `.APK` Build Pipeline

 Automated builds run via `.github/workflows/build-and-bundle-apk.yml` using JDK 21 + Gradle + `@capacitor/android` (`com.luminavital.biooptic`) and bundle the release artifact directly into `public/releases/luminavital-release.apk` for zero-404 one-tap downloads.
