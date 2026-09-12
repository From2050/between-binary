/** A recorded piano performance, streamed locally only after explicit consent.
 * Friday Morning — Kevin MacLeod, CC BY 4.0. See public/audio/CREDITS.md.
 */
export class Soundscape {
  private audio?: HTMLAudioElement;
  private enabled = false;
  private hidden = false;
  private volume = 0.22;
  private fade?: ReturnType<typeof setInterval>;
  private revision = 0;
  private ramp(target: number) {
    clearInterval(this.fade);
    const audio = this.audio;
    if (!audio) return;
    const from = audio.volume;
    let tick = 0;
    this.fade = setInterval(() => {
      audio.volume = from + (target - from) * Math.min(1, ++tick / 24);
      if (tick >= 24) {
        clearInterval(this.fade);
        if (!this.enabled || this.hidden) audio.pause();
      }
    }, 50);
  }
  async toggle() {
    const revision = ++this.revision;
    if (this.enabled) {
      this.enabled = false;
      this.ramp(0);
      return false;
    }
    if (!this.audio) {
      this.audio = new Audio('/audio/friday-morning.mp3');
      this.audio.preload = 'none';
      this.audio.loop = true;
      this.audio.volume = 0;
    }
    this.enabled = true;
    try {
      await this.audio.play();
      if (revision !== this.revision) return this.enabled;
      if (this.hidden) this.audio.pause();
      else this.ramp(this.volume);
      return true;
    } catch (error) {
      if (revision === this.revision) this.enabled = false;
      throw error;
    }
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.enabled && !this.hidden) this.ramp(this.volume);
  }
  // Reserved for future separately recorded environmental audio. No synthesized noise.
  proximity(_distance: number, _pan = 0) {}
  visibility(hidden: boolean) {
    this.hidden = hidden;
    if (!this.audio) return;
    clearInterval(this.fade);
    if (hidden) {
      this.audio.pause();
      this.audio.volume = 0;
    } else if (this.enabled) {
      const revision = this.revision;
      void this.audio.play().then(() => {
        if (revision === this.revision && this.enabled && !this.hidden) this.ramp(this.volume);
        else this.audio?.pause();
      }).catch(() => {
        this.enabled = false;
        document.dispatchEvent(new Event('world-audio-unavailable'));
      });
    }
  }
  dispose() {
    ++this.revision;
    clearInterval(this.fade);
    this.enabled = false;
    this.audio?.pause();
    this.audio?.removeAttribute('src');
    this.audio?.load();
    this.audio = undefined;
  }
}
