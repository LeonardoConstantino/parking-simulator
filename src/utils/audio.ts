/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioManagerClass {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private rainNoise: AudioWorkletNode | ScriptProcessorNode | null = null;
  private rainGain: GainNode | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported in this browser', e);
    }
  }

  public resume() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      if (this.engineGain) this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      if (this.rainGain) this.rainGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    } else {
      if (this.engineGain) this.engineGain.gain.setValueAtTime(0.08, this.ctx?.currentTime || 0);
    }
  }

  public playCrash() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.5;

    // Buffer for noise
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Lowpass filter to make it sound muffled and deep
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(10, t + duration);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.3, t);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // Also a low metallic synth thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    noise.start(t);
    osc.start(t);
    osc.stop(t + duration);
  }

  public playHonk() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const t = this.ctx.currentTime;
    // Dual frequency sine waves for realistic horn
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 400; // Hz
    osc2.type = 'sine';
    osc2.frequency.value = 445; // Hz

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.15, t + 0.05);
    gainNode.gain.setValueAtTime(0.15, t + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.4);
    osc2.stop(t + 0.4);
  }

  public playWinChime() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.1);

      gainNode.gain.setValueAtTime(0, t + idx * 0.1);
      gainNode.gain.linearRampToValueAtTime(0.1, t + idx * 0.1 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.4);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(t + idx * 0.1);
      osc.stop(t + idx * 0.1 + 0.5);
    });
  }

  public playTick() {
    this.resume();
    if (this.isMuted || !this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);

    gainNode.gain.setValueAtTime(0.05, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  public startEngine() {
    this.resume();
    if (!this.ctx || this.engineOsc) return;

    const t = this.ctx.currentTime;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();

    // Use triangle/sawtooth mix for a rumbling motor
    this.engineOsc.type = 'triangle';
    this.engineOsc.frequency.setValueAtTime(45, t); // low pitch idle

    this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, t);

    // Lowpass filter to make it deep
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start(t);
  }

  public updateEnginePitch(velocity: number, maxSpeed: number) {
    this.resume();
    if (!this.ctx || !this.engineOsc) return;

    const speedRatio = Math.min(Math.abs(velocity) / maxSpeed, 1);
    const targetFreq = 45 + speedRatio * 85; // ranges from 45Hz idle to 130Hz max speed

    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
  }

  public stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch (e) {}
      this.engineOsc.disconnect();
      this.engineOsc = null;
    }
  }

  public startRain() {
    this.resume();
    if (!this.ctx || this.rainNoise) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, t);
    filter.Q.setValueAtTime(1, t);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, t);

    source.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.ctx.destination);

    source.start(t);
    this.rainNoise = source as any;
  }

  public stopRain() {
    if (this.rainNoise) {
      try {
        (this.rainNoise as any).stop();
      } catch (e) {}
      this.rainNoise.disconnect();
      this.rainNoise = null;
    }
  }
}

export const AudioManager = new AudioManagerClass();
