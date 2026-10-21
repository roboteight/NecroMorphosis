// Dark-ambient drone: detuned sub-bass oscillators through a slowly modulated low-pass filter.
export class Drone {
  private ctx: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private intensity = 0.3;

  /** Toggles playback; returns true when the drone is audible afterwards. */
  async toggle(): Promise<boolean> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.build(this.ctx);
      return true;
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
      return true;
    }
    await this.ctx.suspend();
    return false;
  }

  /** Opens the filter as the fly-through speeds up (0..1). */
  setIntensity(value: number): void {
    this.intensity = value;
    this.filter?.frequency.setTargetAtTime(120 + value * 160, this.ctx!.currentTime, 0.3);
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  private build(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 4.5;
    filter.connect(master);
    this.filter = filter;
    this.setIntensity(this.intensity);

    const filterLfo = ctx.createOscillator();
    const filterLfoGain = ctx.createGain();
    filterLfo.frequency.value = 0.08;
    filterLfoGain.gain.value = 85;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    filterLfo.start();

    const freqs = [48.0, 51.5, 96.0, 98.2];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = freq;

      const drift = ctx.createOscillator();
      const driftGain = ctx.createGain();
      drift.frequency.value = 0.05 + idx * 0.03;
      driftGain.gain.value = 1.2;
      drift.connect(driftGain);
      driftGain.connect(osc.frequency);
      drift.start();

      gain.gain.value = 0.25 / freqs.length;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
    });
  }
}
