/** Sound for the walk. Created on the visitor's gesture, and silent unless the world's "Sound on" is pressed.
 * The score and the ambience are pre-rendered stems (public/audio/rite, made by tools/compose-rite-music.py):
 * loops run together and the walk crossfades them by place and moment; one-shots mark the end and the way home.
 * Footsteps, the carried flame, ignitions and bells stay live, so they follow the walk exactly. */
type Stem = { loop: boolean; length: number; start: number; level: number };
export type RiteMix = { music: Record<string, number>; ambience: Record<string, number>; level?: number };

export function createRiteSound() {
  let ctx: AudioContext | null = null, master: GainNode, rev: ConvolverNode, crackle: GainNode, wind: GainNode, windFilter: BiquadFilterNode, noise: AudioBuffer;
  let musicBus: GainNode, ambBus: GainNode;
  const enabled = () => document.getElementById("sound-toggle")?.getAttribute("aria-pressed") === "true";
  const volume = () => { const v = Number((document.getElementById("volume") as HTMLInputElement | null)?.value ?? 22); return Math.max(0, Math.min(2.2, v / 22)); };
  const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  // ─── the stems ───
  let manifest: Record<string, Stem> | null = null, loading = false, ready = false;
  const buffers = new Map<string, AudioBuffer>(), gains = new Map<string, GainNode>(), targets = new Map<string, number>();
  const shots = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();
  async function load() {
    if (loading || !ctx) return; loading = true;
    try {
      manifest = await (await fetch("/audio/rite/manifest.json")).json() as Record<string, Stem>;
      await Promise.all(Object.keys(manifest).map(async name => {
        const data = await (await fetch(`/audio/rite/${name}.mp3`)).arrayBuffer(); buffers.set(name, await ctx!.decodeAudioData(data));
      }));
      const at = ctx.currentTime + .1;
      for (const [name, stem] of Object.entries(manifest)) {
        if (!stem.loop) continue;
        const source = ctx.createBufferSource(); source.buffer = buffers.get(name)!; source.loop = true; source.loopStart = stem.start; source.loopEnd = stem.start + stem.length;
        const gain = ctx.createGain(); gain.gain.value = 0; source.connect(gain); gain.connect(name.startsWith("amb-") ? ambBus : musicBus);
        source.start(at, stem.start + (name.startsWith("amb-") ? Math.random() * stem.length : 0)); gains.set(name, gain);
      }
      ready = true; wind.gain.setTargetAtTime(0, ctx.currentTime, 2);
    } catch (error) { console.warn("The walk's music could not load", error); loading = false; }
  }
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); const sr = ctx.sampleRate, r = seeded(5);
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = .85; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = .7; ambBus.connect(master);
    rev = ctx.createConvolver(); { const len = sr * 4, b = ctx.createBuffer(2, len, sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.7); } rev.buffer = b; }
    const rg = ctx.createGain(); rg.gain.value = .45; rev.connect(rg); rg.connect(master);
    noise = ctx.createBuffer(1, sr * 3, sr); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    // the carried flame: a looped crackle whose level follows the torch
    const cl = sr * 5, cb = ctx.createBuffer(1, cl, sr), cd = cb.getChannelData(0); let prev = 0;
    for (let k = 0; k < 120; k++) { const p0 = Math.floor(r() * cl), len = Math.floor(sr * (.002 + r() * r() * .03)), amp = .15 + r() * r() * .85; for (let i = 0; i < len && p0 + i < cl; i++) cd[p0 + i] += (r() * 2 - 1) * amp * Math.exp(-i / (len * .3)); }
    for (let i = 0; i < cl; i++) { const x = cd[i]; cd[i] = x - prev * .92; prev = x; }
    const cs = ctx.createBufferSource(); cs.buffer = cb; cs.loop = true; crackle = ctx.createGain(); crackle.gain.value = 0; cs.connect(crackle); crackle.connect(master); cs.start();
    // a live wind, until the pre-rendered ambience has loaded
    const ws = ctx.createBufferSource(); ws.buffer = noise; ws.loop = true; windFilter = ctx.createBiquadFilter(); windFilter.type = "bandpass"; windFilter.frequency.value = 360; windFilter.Q.value = .6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = .07; const lg = ctx.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(windFilter.frequency);
    wind = ctx.createGain(); wind.gain.value = 0; ws.connect(windFilter); windFilter.connect(wind); wind.connect(master); ws.start(); lfo.start();
    return ctx;
  }
  const bus = (send: number) => { const g = ctx!.createGain(); g.connect(master); const s = ctx!.createGain(); s.gain.value = send; g.connect(s); s.connect(rev); return g; };
  const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(type: OscillatorType, freq: number, at: number, dur: number, vol: number, attack: number, release: number, dest: AudioNode) {
    const o = ctx!.createOscillator(); o.type = type; o.frequency.value = freq; const g = ctx!.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + attack); g.gain.setValueAtTime(vol, at + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g); g.connect(dest); o.start(at); o.stop(at + dur + .05);
  }
  return {
    /** call from a click/keydown so the context may start */
    wake() { const c = ensure(); if (c && c.state === "suspended") void c.resume(); if (c && enabled()) void load(); },
    get ready() { return ready; },
    /** torch: how brightly you carry fire; ash: the burnt country; open: out of the trees; mix: the score and ambience */
    update(torch: number, ash: number, open: number, mix?: RiteMix) {
      if (!ctx) return; const on = enabled() ? 1 : 0, t = ctx.currentTime;
      if (on && !loading) void load();
      master.gain.setTargetAtTime(on * .9 * volume(), t, .4);
      crackle.gain.setTargetAtTime(torch * .2, t, .2);
      if (!ready) { wind.gain.setTargetAtTime(.05 + open * .05 + ash * .22, t, 1.6); windFilter.Q.value = .6 + ash * .8; }
      if (!ready || !manifest || !mix) return;
      for (const [name, gain] of gains) {
        const amb = name.startsWith("amb-"), want = ((amb ? mix.ambience[name.slice(4)] : mix.music[name]) ?? 0) * manifest[name].level * (amb ? 1 : mix.level ?? 1);
        const before = targets.get(name) ?? 0;
        if (Math.abs(before - want) > .005) { targets.set(name, want); gain.gain.setTargetAtTime(want, t, want > before ? 1.8 : 1.2); }
      }
      for (const [name, shot] of shots) {
        const want = (mix.music[name] ?? 0) * (manifest[name]?.level ?? 1) * (mix.level ?? 1);
        if (Math.abs((targets.get(name) ?? -1) - want) > .005) { targets.set(name, want); shot.gain.gain.setTargetAtTime(want, t, .8); }
      }
    },
    /** start a one-shot cue (the finale, the way home) */
    cue(name: string) {
      if (!ctx || !ready || !manifest?.[name] || shots.has(name)) return;
      const source = ctx.createBufferSource(); source.buffer = buffers.get(name)!; const gain = ctx.createGain(); gain.gain.value = manifest[name].level;
      source.connect(gain); gain.connect(musicBus); source.start(); targets.set(name, manifest[name].level); shots.set(name, { source, gain });
      source.onended = () => { if (shots.get(name)?.source === source) shots.delete(name); };
    },
    /** stop the one-shots (when the walk is left or begun again) */
    hush() { if (!ctx) return; for (const [, shot] of shots) { shot.gain.gain.setTargetAtTime(0, ctx.currentTime, .6); shot.source.stop(ctx.currentTime + 3); } shots.clear(); },
    step(up: number) {
      if (!ctx || !enabled()) return; const t = ctx.currentTime, steps = buffers.get("steps");
      if (steps) { const s = ctx.createBufferSource(); s.buffer = steps; s.playbackRate.value = .9 + Math.random() * .2 - up * .04; const g = ctx.createGain(); g.gain.value = .32; s.connect(g); g.connect(master); s.start(t, Math.floor(Math.random() * 8) * .5, .3); return; }
      const s = ctx.createBufferSource(); s.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 700 + Math.random() * 600 - up * 120; f.Q.value = .9;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.09, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + .24);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 2.5, .3);
    },
    ignite() {
      if (!ctx || !enabled()) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + .35);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.05, t + .12); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
      s.connect(f); f.connect(g); g.connect(bus(.3)); s.start(t, Math.random() * 2, 1);
    },
    bell(note = 76, vol = .05, delay = 0) {
      if (!ctx || !enabled()) return; const t = ctx.currentTime + delay, b = bus(.7);
      for (const [k, a, d] of [[1, 1, 6], [2, .45, 3.6], [2.76, .3, 2.4], [5.4, .14, 1.5]]) {
        const o = ctx.createOscillator(); o.frequency.value = mf(note) * k; const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(g); g.connect(b); o.start(t); o.stop(t + d + .1);
      }
    },
    /** a synthesized chord, used only while the score has not loaded so it never clashes with it */
    chord(notes: number[], dur = 9, vol = .022) {
      if (!ctx || !enabled() || ready) return; const t = ctx.currentTime, b = bus(.6), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300; lp.connect(b);
      for (const m of notes) for (const d of [-1, 1]) tone("sawtooth", mf(m) * (1 + d * .004), t, dur, vol, 2.2, 4, lp);
    },
    boom(vol = .4) {
      if (!ctx || !enabled()) return; const t = ctx.currentTime, o = ctx.createOscillator(); o.frequency.setValueAtTime(68, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 5);
      o.connect(g); g.connect(bus(.5)); o.start(t); o.stop(t + 5.2);
    },
    dispose() { void ctx?.close(); ctx = null; },
  };
}
