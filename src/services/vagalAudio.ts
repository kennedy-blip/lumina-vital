import { Haptics, ImpactStyle } from '@capacitor/haptics';

class VagalBiofeedbackAudioEngine {
  private ctx: AudioContext | null = null;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private surfSource: AudioBufferSourceNode | null = null;
  private surfFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private isRunning = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, durationSec = 4): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSec;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  public startVagalBinauralDrone(volume = 0.24): void {
    if (this.isRunning) return;
    const ctx = this.ensureContext();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.02, volume), ctx.currentTime + 0.8);
    master.connect(ctx.destination);

    // Stereo Merger for true 432 Hz Left + 438 Hz Right (6 Hz Theta Binaural Vagal Entrainment)
    const merger = ctx.createChannelMerger(2);
    merger.connect(master);

    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    oscL.type = 'sine';
    oscR.type = 'sine';
    oscL.frequency.setValueAtTime(432, ctx.currentTime);
    oscR.frequency.setValueAtTime(438, ctx.currentTime);

    const oscGainL = ctx.createGain();
    const oscGainR = ctx.createGain();
    oscGainL.gain.setValueAtTime(0.32, ctx.currentTime);
    oscGainR.gain.setValueAtTime(0.32, ctx.currentTime);

    oscL.connect(oscGainL);
    oscR.connect(oscGainR);
    oscGainL.connect(merger, 0, 0);
    oscGainR.connect(merger, 0, 1);

    // Pink-noise Ocean Surf modulated by respiratory phase
    const noiseBuffer = this.createPinkNoiseBuffer(ctx, 5);
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, ctx.currentTime);
    filter.Q.setValueAtTime(1.1, ctx.currentTime);

    const surfGain = ctx.createGain();
    surfGain.gain.setValueAtTime(0.55, ctx.currentTime);

    noiseNode.connect(filter);
    filter.connect(surfGain);
    surfGain.connect(master);

    oscL.start();
    oscR.start();
    noiseNode.start();

    this.leftOsc = oscL;
    this.rightOsc = oscR;
    this.surfSource = noiseNode;
    this.surfFilter = filter;
    this.masterGain = master;
    this.isRunning = true;
  }

  /**
   * Modulates ocean surf cutoff & harmonic swell in lockstep with respiratory expansion (0..1)
   */
  public modulateBreathExpansion(expansion0to1: number, volume = 0.24): void {
    if (!this.isRunning || !this.ctx || !this.surfFilter || !this.masterGain) return;
    const clamped = Math.max(0, Math.min(1, expansion0to1));
    const cutoff = 220 + clamped * 560; // Swells from warm 220Hz on exhale to 780Hz crest on inhale
    this.surfFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.12);
    const targetGain = Math.max(0.01, volume * (0.68 + clamped * 0.45));
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.15);
  }

  public stopVagalBinauralDrone(): void {
    if (!this.isRunning || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.18);
    }
    const oscL = this.leftOsc;
    const oscR = this.rightOsc;
    const surf = this.surfSource;

    setTimeout(() => {
      try {
        oscL?.stop();
        oscR?.stop();
        surf?.stop();
      } catch {
        // Ignore already-stopped nodes
      }
    }, 300);

    this.leftOsc = null;
    this.rightOsc = null;
    this.surfSource = null;
    this.surfFilter = null;
    this.masterGain = null;
    this.isRunning = false;
  }

  /**
   * Synthesized crystalline 20-20-20 Ocular Rehab Harmonic Chime (528 Hz + 792 Hz Perfect Fifth)
   */
  public playOcularHarmonicChime(): void {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const freqs = [528, 792, 1056];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.07);

        gain.gain.setValueAtTime(0.001, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.14 / (idx + 1), now + idx * 0.07 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 1.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 1.5);
      });
    } catch {
      // Audio blocked before user gesture
    }
  }

  /**
   * Triggers native Capacitor Android Haptics with Web Vibration API fallback
   */
  public async triggerBiofeedbackHaptic(
    pattern: 'systolic-tick' | 'breath-transition' | 'ocular-complete',
    enabled = true
  ): Promise<void> {
    if (!enabled) return;

    try {
      if (pattern === 'systolic-tick') {
        await Haptics.impact({ style: ImpactStyle.Light });
        return;
      }
      if (pattern === 'breath-transition') {
        await Haptics.impact({ style: ImpactStyle.Medium });
        return;
      }
      if (pattern === 'ocular-complete') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        return;
      }
    } catch {
      // Fallback to navigator.vibrate on mobile browsers
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          if (pattern === 'systolic-tick') navigator.vibrate(14);
          else if (pattern === 'breath-transition') navigator.vibrate([30, 40, 55]);
          else navigator.vibrate([60, 50, 90]);
        } catch {
          // Ignore unsupported browser environments
        }
      }
    }
  }
}

export const vagalAudio = new VagalBiofeedbackAudioEngine();
