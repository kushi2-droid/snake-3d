// src/audio.js
// Synthesized retro-futuristic arcade sound effects using the browser's native Web Audio API.
// Zero external audio files or paid libraries required.

export class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;
  }

  /**
   * Lazily initialize or resume AudioContext only after a user gesture (click/tap/key press).
   */
  init() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.initialized = Boolean(this.ctx);
    } catch (err) {
      // Gracefully continue if Web Audio API is blocked or unsupported
      this.initialized = false;
    }
  }

  /**
   * Toggle mute state and return the new muted status.
   */
  toggleMute() {
    this.muted = !this.muted;
    if (!this.muted) {
      this.init();
      this.playTone(520, 0.06, 'sine', 0.08);
    }
    return this.muted;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    return this.muted;
  }

  /**
   * Helper to play a single synthesized oscillator tone with smooth envelope.
   */
  playTone(freq, duration = 0.1, type = 'sine', volume = 0.12, startTimeOffset = 0, endFreq = null) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime + startTimeOffset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.015);
    } catch (e) {
      // Ignore audio scheduling errors
    }
  }

  /**
   * Play ascending arcade chime when starting a new game.
   */
  playStart() {
    this.playTone(330, 0.09, 'triangle', 0.12, 0.0);
    this.playTone(440, 0.09, 'triangle', 0.12, 0.07);
    this.playTone(659.25, 0.18, 'triangle', 0.14, 0.14);
  }

  /**
   * Play bright synth pickup sound when collecting food.
   */
  playEat(score = 1) {
    // Slightly pitch up with combo/score for extra arcade satisfaction
    const pitchBoost = Math.min(score * 6, 180);
    this.playTone(520 + pitchBoost, 0.08, 'sine', 0.14, 0.0, 780 + pitchBoost);
    this.playTone(780 + pitchBoost, 0.12, 'triangle', 0.12, 0.055, 1040 + pitchBoost);
  }

  /**
   * Play crisp two-tone blip when pausing or resuming.
   */
  playPause(isPaused = true) {
    if (isPaused) {
      this.playTone(520, 0.07, 'sine', 0.1, 0.0);
      this.playTone(340, 0.1, 'sine', 0.1, 0.06);
    } else {
      this.playTone(340, 0.07, 'sine', 0.1, 0.0);
      this.playTone(520, 0.1, 'sine', 0.1, 0.06);
    }
  }

  /**
   * Play retro descending synth chord when colliding with a wall or self.
   */
  playGameOver() {
    this.playTone(300, 0.16, 'sawtooth', 0.11, 0.0, 220);
    this.playTone(220, 0.18, 'sawtooth', 0.11, 0.14, 155);
    this.playTone(155, 0.34, 'sawtooth', 0.13, 0.28, 85);
  }
}
