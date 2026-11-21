export type LightingPresetId =
  | 'cheap-120hz-led'
  | 'oled-240hz-pwm'
  | 'healthy-dc-monitor'
  | 'warm-2700k-incandescent'
  | 'harsh-6500k-fluorescent';

export interface LightingSimulatorPreset {
  id: LightingPresetId;
  title: string;
  subtitle: string;
  rgbSample: [number, number, number];
  flickerHz: number;
  modulationDepthPct: number;
  luxEstimate: number;
}

export const LIGHTING_SIMULATOR_PRESETS: LightingSimulatorPreset[] = [
  {
    id: 'cheap-120hz-led',
    title: 'Cheap 120Hz PWM LED Bulb',
    subtitle: '120Hz · 54% Modulation · 4100K',
    rgbSample: [248, 236, 206],
    flickerHz: 120,
    modulationDepthPct: 54.2,
    luxEstimate: 340,
  },
  {
    id: 'oled-240hz-pwm',
    title: 'OLED Phone @ 20% Brightness',
    subtitle: '240Hz PWM · 38% Modulation · 6100K',
    rgbSample: [228, 236, 250],
    flickerHz: 240,
    modulationDepthPct: 38.6,
    luxEstimate: 165,
  },
  {
    id: 'healthy-dc-monitor',
    title: 'Healthy DC-Dimmed Monitor',
    subtitle: '0Hz Ripple (<3%) · 4500K Neutral',
    rgbSample: [250, 241, 222],
    flickerHz: 0,
    modulationDepthPct: 2.7,
    luxEstimate: 380,
  },
  {
    id: 'warm-2700k-incandescent',
    title: '2700K Warm Incandescent',
    subtitle: '120Hz Thermal · 6.4% Ripple · Melatonin Safe',
    rgbSample: [255, 189, 118],
    flickerHz: 120,
    modulationDepthPct: 6.4,
    luxEstimate: 190,
  },
  {
    id: 'harsh-6500k-fluorescent',
    title: '6500K Harsh Office Fluorescent',
    subtitle: '100Hz Ballast · 34% Ripple · High Blue Peak',
    rgbSample: [216, 233, 255],
    flickerHz: 100,
    modulationDepthPct: 34.5,
    luxEstimate: 640,
  },
];

export interface SpectralAnalysisResult {
  kelvin: number;
  cieX: number;
  cieY: number;
  flickerHz: number;
  modulationDepthPct: number;
  luxEstimate: number;
  ieeeRiskZone: 'SAFE' | 'LOW_RISK' | 'HIGH_HAZARD';
  ieeeNoelBoundaryPct: number;
  melatoninSuppressionPct: number;
  circadianVerdict: string;
  lumaWaveform: number[];
}

function srgbChannelToLinear(channel0to255: number): number {
  const c = Math.max(0, Math.min(255, channel0to255)) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Real Colorimetric RGB -> CIE 1931 XYZ -> (x, y) Chromaticity -> McCamy's Cubic CCT Formula
 * CCT(x, y) = 449*n^3 + 3525*n^2 + 6823.3*n + 5520.33  where n = (x - 0.3320) / (0.1858 - y)
 */
export function calculateKelvinMcCamy(r: number, g: number, b: number): {
  kelvin: number;
  cieX: number;
  cieY: number;
  relativeLuminanceY: number;
} {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);

  // ITU-R BT.709 / sRGB D65 transformation matrix to CIE 1931 XYZ
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

  const sum = X + Y + Z;
  if (sum < 0.0001) {
    return { kelvin: 4500, cieX: 0.332, cieY: 0.341, relativeLuminanceY: 0 };
  }

  const x = X / sum;
  const y = Y / sum;

  // McCamy's epicenter (x_e = 0.3320, y_e = 0.1858)
  const denom = 0.1858 - y;
  const n = Math.abs(denom) < 0.0001 ? 0 : (x - 0.3320) / denom;

  const rawCct = 449 * Math.pow(n, 3) + 3525 * Math.pow(n, 2) + 6823.3 * n + 5520.33;
  const clampedKelvin = Math.round(Math.max(1800, Math.min(10000, rawCct)));

  return {
    kelvin: clampedKelvin,
    cieX: Number(x.toFixed(4)),
    cieY: Number(y.toFixed(4)),
    relativeLuminanceY: Y,
  };
}

/**
 * IEEE Std 1789-2015 Recommended Practices for Modulating Current in High-Brightness LEDs:
 * - NOEL (No Observable Effect Level):
 *     f < 90 Hz -> Mod% < 0.025 * f
 *     90 Hz <= f <= 1250 Hz -> Mod% < 0.08 * f
 *     f > 1250 Hz -> Safe up to 100%
 * - Low Risk Zone boundary:
 *     f < 90 Hz -> Mod% < 0.01 * f (strict) / Low risk up to 0.08 * f
 *     90 Hz <= f <= 3000 Hz -> Low risk below 0.08 * f, NOEL below 0.0333 * f
 */
export function evaluateIeee1789Risk(
  flickerHz: number,
  modulationDepthPct: number
): {
  zone: 'SAFE' | 'LOW_RISK' | 'HIGH_HAZARD';
  noelBoundaryPct: number;
  lowRiskBoundaryPct: number;
} {
  if (flickerHz <= 2 || modulationDepthPct <= 4.0) {
    return { zone: 'SAFE', noelBoundaryPct: 8.0, lowRiskBoundaryPct: 18.0 };
  }

  const noelBoundary =
    flickerHz < 90
      ? Math.min(100, flickerHz * 0.033)
      : flickerHz <= 3000
      ? Math.min(100, flickerHz * 0.0333)
      : 100;

  const lowRiskBoundary =
    flickerHz < 90
      ? Math.min(100, flickerHz * 0.08)
      : flickerHz <= 1250
      ? Math.min(100, flickerHz * 0.08)
      : 100;

  if (modulationDepthPct <= noelBoundary) {
    return {
      zone: 'SAFE',
      noelBoundaryPct: Number(noelBoundary.toFixed(1)),
      lowRiskBoundaryPct: Number(lowRiskBoundary.toFixed(1)),
    };
  }
  if (modulationDepthPct <= lowRiskBoundary) {
    return {
      zone: 'LOW_RISK',
      noelBoundaryPct: Number(noelBoundary.toFixed(1)),
      lowRiskBoundaryPct: Number(lowRiskBoundary.toFixed(1)),
    };
  }

  return {
    zone: 'HIGH_HAZARD',
    noelBoundaryPct: Number(noelBoundary.toFixed(1)),
    lowRiskBoundaryPct: Number(lowRiskBoundary.toFixed(1)),
  };
}

/**
 * Circadian Melanopic Verdict comparing Kelvin & Lux against user's local hour
 */
export function evaluateCircadianMelanopicImpact(
  kelvin: number,
  lux: number,
  dateNow: Date = new Date()
): { melatoninSuppressionPct: number; verdict: string } {
  const hour = dateNow.getHours();
  const minutes = dateNow.getMinutes();
  const formattedTime = dateNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Melanopic M/P action ratio rises strongly above 3500K (480nm ipRGC peak)
  const blueFactor = Math.max(0, Math.min(1.25, (kelvin - 2200) / 4800));
  const intensityFactor = Math.max(0.15, Math.min(1.2, Math.log10(Math.max(lux, 20)) / 2.8));
  const suppressionPct = Math.round(Math.min(89, Math.max(2, blueFactor * intensityFactor * 78)));

  const isEveningOrNight = hour >= 19 || hour < 6;
  const isMorningBoostWindow = hour >= 6 && hour <= 11;

  if (isEveningOrNight && kelvin >= 4000) {
    return {
      melatoninSuppressionPct: suppressionPct,
      verdict: `WARNING: ${kelvin}K Blue-Enriched Light detected at ${formattedTime} — Suppresses Melatonin by ~${suppressionPct}%. Switch to <3000K Warm Amber.`,
    };
  }

  if (isEveningOrNight && kelvin < 3100) {
    return {
      melatoninSuppressionPct: suppressionPct,
      verdict: `OPTIMAL NIGHT SPECTRUM (${formattedTime}): ${kelvin}K warm light preserves pineal melatonin (~${suppressionPct}% minimal impact).`,
    };
  }

  if (isMorningBoostWindow && kelvin >= 4500) {
    return {
      melatoninSuppressionPct: suppressionPct,
      verdict: `MORNING CIRCADIAN ANCHOR (${formattedTime}): ${kelvin}K daylight spectrum boosts cortisol awakening & alertness (+${suppressionPct}% ipRGC drive).`,
    };
  }

  if (minutes >= 0 && kelvin > 5800) {
    return {
      melatoninSuppressionPct: suppressionPct,
      verdict: `CAUTION (${formattedTime}): ${kelvin}K harsh cool-blue spectrum (~${suppressionPct}% melanopic drive). Consider 4000K–4500K for visual comfort.`,
    };
  }

  return {
    melatoninSuppressionPct: suppressionPct,
    verdict: `BALANCED WORKSPACE SPECTRUM (${formattedTime}): ${kelvin}K neutral chromaticity with ~${suppressionPct}% circadian ipRGC stimulation.`,
  };
}

/**
 * Extracts spatial RGB + row-scanline rolling shutter PWM flicker & temporal frame variance from live camera ImageData
 */
export class OpticalSpectrometerEngine {
  private temporalLumaHistory: number[] = [];

  public reset(): void {
    this.temporalLumaHistory = [];
  }

  public analyzeLiveCameraFrame(imageData: ImageData, nowDate = new Date()): SpectralAnalysisResult {
    const { data, width, height } = imageData;

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let totalPixels = 0;

    // Row-by-row scanline luminance profile (captures CMOS rolling-shutter banding from 100/120/240Hz PWM!)
    const rowLumas: number[] = [];

    for (let y = 0; y < height; y += 2) {
      let rowY = 0;
      let rowCount = 0;
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x += 4) {
        const idx = rowOffset + x * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        sumR += r;
        sumG += g;
        sumB += b;
        totalPixels++;

        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        rowY += luma;
        rowCount++;
      }
      rowLumas.push(rowCount > 0 ? rowY / rowCount : 0);
    }

    const avgR = totalPixels > 0 ? sumR / totalPixels : 180;
    const avgG = totalPixels > 0 ? sumG / totalPixels : 180;
    const avgB = totalPixels > 0 ? sumB / totalPixels : 180;

    const frameLuma = 0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB;
    this.temporalLumaHistory.push(frameLuma);
    if (this.temporalLumaHistory.length > 96) {
      this.temporalLumaHistory.shift();
    }

    // Compute Michelson Percent Flicker = 100 * (Lmax - Lmin) / (Lmax + Lmin)
    // Combine temporal variance and high-pass scanline banding (for PWM > 60Hz)
    const recentTemporal = this.temporalLumaHistory.slice(-48);
    const tMax = Math.max(...recentTemporal, 1);
    const tMin = Math.min(...recentTemporal, 0);
    const temporalModPct = ((tMax - tMin) / Math.max(tMax + tMin, 1)) * 100;

    // High-pass scanline ripple (detrend spatial room gradient with 9-row moving average)
    const detrendedRows: number[] = [];
    for (let i = 0; i < rowLumas.length; i++) {
      let localSum = 0;
      let c = 0;
      for (let k = Math.max(0, i - 4); k <= Math.min(rowLumas.length - 1, i + 4); k++) {
        localSum += rowLumas[k];
        c++;
      }
      const localMean = localSum / c;
      detrendedRows.push(rowLumas[i] - localMean);
    }

    const maxRipple = Math.max(...detrendedRows.map((v) => Math.abs(v)), 0);
    const scanlineModPct = (maxRipple / Math.max(frameLuma, 15)) * 100;

    const modulationDepthPct = Number(
      Math.min(98, Math.max(1.2, Math.max(temporalModPct * 0.85, scanlineModPct * 1.4))).toFixed(1)
    );

    // Zero-crossings of scanline ripple estimate dominant PWM harmonic
    let zeroCrossings = 0;
    for (let i = 1; i < detrendedRows.length; i++) {
      if (
        (detrendedRows[i - 1] >= 0 && detrendedRows[i] < 0) ||
        (detrendedRows[i - 1] < 0 && detrendedRows[i] >= 0)
      ) {
        zeroCrossings++;
      }
    }

    const estimatedHz =
      modulationDepthPct < 4.5
        ? 0
        : Math.min(1200, Math.max(50, Math.round((zeroCrossings * 30) / 2) * 10));

    const { kelvin, cieX, cieY, relativeLuminanceY } = calculateKelvinMcCamy(avgR, avgG, avgB);
    const luxEstimate = Math.round(Math.max(25, Math.min(2500, relativeLuminanceY * 820)));

    const ieee = evaluateIeee1789Risk(estimatedHz, modulationDepthPct);
    const circadian = evaluateCircadianMelanopicImpact(kelvin, luxEstimate, nowDate);

    const normalizedLumaWave = rowLumas.slice(0, 96).map((v) =>
      Number(Math.max(0.05, Math.min(1, v / 255)).toFixed(3))
    );

    return {
      kelvin,
      cieX,
      cieY,
      flickerHz: estimatedHz,
      modulationDepthPct,
      luxEstimate,
      ieeeRiskZone: ieee.zone,
      ieeeNoelBoundaryPct: ieee.noelBoundaryPct,
      melatoninSuppressionPct: circadian.melatoninSuppressionPct,
      circadianVerdict: circadian.verdict,
      lumaWaveform: normalizedLumaWave,
    };
  }

  public analyzeSimulatorPreset(
    preset: LightingSimulatorPreset,
    phaseTick: number,
    nowDate = new Date()
  ): SpectralAnalysisResult {
    const [r, g, b] = preset.rgbSample;
    const jitter = Math.sin(phaseTick * 0.25) * 1.5;
    const { kelvin, cieX, cieY } = calculateKelvinMcCamy(r + jitter, g, b - jitter);

    const depthRatio = preset.modulationDepthPct / 100;
    const lumaWaveform: number[] = [];
    for (let i = 0; i < 96; i++) {
      const t = i / 960 + phaseTick * 0.002;
      let val = 0.92;
      if (preset.flickerHz > 0) {
        const sine = Math.sin(2 * Math.PI * preset.flickerHz * t);
        // PWM square-ish duty wave for LED/OLED, smooth rectified sine for incandescent/ballast
        const isPwm = preset.id === 'cheap-120hz-led' || preset.id === 'oled-240hz-pwm';
        const wave = isPwm ? (sine >= -0.15 ? 1 : 1 - depthRatio * 1.45) : 1 - depthRatio * (0.5 - 0.5 * sine);
        val = Math.max(0.06, Math.min(1.0, wave));
      } else {
        val = 0.9 + Math.sin(i * 0.22 + phaseTick * 0.3) * (depthRatio * 0.45);
      }
      lumaWaveform.push(Number(val.toFixed(3)));
    }

    const liveDepth = Number(
      Math.max(1.2, preset.modulationDepthPct + Math.sin(phaseTick * 0.4) * 0.6).toFixed(1)
    );

    const ieee = evaluateIeee1789Risk(preset.flickerHz, liveDepth);
    const circadian = evaluateCircadianMelanopicImpact(kelvin, preset.luxEstimate, nowDate);

    return {
      kelvin,
      cieX,
      cieY,
      flickerHz: preset.flickerHz,
      modulationDepthPct: liveDepth,
      luxEstimate: Math.round(preset.luxEstimate + Math.cos(phaseTick * 0.3) * 4),
      ieeeRiskZone: ieee.zone,
      ieeeNoelBoundaryPct: ieee.noelBoundaryPct,
      melatoninSuppressionPct: circadian.melatoninSuppressionPct,
      circadianVerdict: circadian.verdict,
      lumaWaveform,
    };
  }
}
