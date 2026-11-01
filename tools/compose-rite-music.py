"""Reproducible score and ambience for the walk (prototype). Run: python tools/compose-rite-music.py [stem ...]

Everything is synthesized here: wavetable string ensembles, a formant choir, a modal piano, harp, celesta,
timpani, and noise-based wind, crickets, owls and embers, all through one synthetic hall. No samples, no downloads.
The ambience follows history along the road: wind and wolves in deep time, crickets and a cow bell by the fields,
the murmur and chisels of the first cities, war drums and horses, temple bells and chanting, the sea and timbers
of the age of sail, clocks and bells, steam and factories, then the wars (guns, sirens, aircraft, fire), the quiet
after them, and the hum of the modern world.
It writes public/audio/rite/<stem>.mp3 and manifest.json, and is meant to be replaced stem by stem with
recorded or generated music later (see docs/RITE_AUDIO.md for the cue sheet).

Loops are rendered circularly: every note tail and the reverb wrap past the end back into the start, so a
loop has no seam. Each loop file carries PAD seconds of its own tail before it and of its head after it, so
the browser can loop the middle exactly whatever the encoder adds at the edges.
"""
import json, pathlib, subprocess, sys
import numpy as np
import scipy.signal as sg
from scipy.io import wavfile

SR = 44100
PAD = 0.25
BEAT = 60 / 56
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public/audio/rite"
FFMPEG = pathlib.Path(r"C:\Users\m4601\Video_Test\render\node_modules\ffmpeg-static\ffmpeg.exe")
rng = np.random.default_rng(1914)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def note(name):
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    base, rest = names[name[0]], name[1:]
    if rest.startswith("#"): base, rest = base + 1, rest[1:]
    elif rest.startswith("b"): base, rest = base - 1, rest[1:]
    return 12 * (int(rest) + 1) + base
def N(*names): return [note(n) for n in names]

# ───────────────────────── oscillators and instruments ─────────────────────────
def table(amps, size=4096, seed=0):
    r = np.random.default_rng(seed)
    k = np.arange(1, len(amps) + 1)[:, None]; x = np.arange(size)[None, :] / size
    return (amps[:, None] * np.sin(2 * np.pi * k * x + r.uniform(0, 6.28, (len(amps), 1)))).sum(0).astype(np.float32)
def osc(tab, freq):
    ph = np.cumsum(freq) / SR; idx = (ph % 1.0) * len(tab); i0 = idx.astype(np.int64); fr = (idx - i0).astype(np.float32)
    return tab[i0] * (1 - fr) + tab[(i0 + 1) % len(tab)] * fr
def lowpass(x, cutoff, order=2): b, a = sg.butter(order, min(cutoff, SR * .45) / (SR / 2)); return sg.lfilter(b, a, x)
def highpass(x, cutoff, order=2): b, a = sg.butter(order, cutoff / (SR / 2), "high"); return sg.lfilter(b, a, x)
def bandpass(x, lo, hi, order=2): b, a = sg.butter(order, [lo / (SR / 2), min(hi, SR * .45) / (SR / 2)], "band"); return sg.lfilter(b, a, x)
def envelope(n, dur, attack, release, curve=1.6):
    t = np.arange(n) / SR
    e = np.clip(t / max(attack, 1e-3), 0, 1) ** curve
    return (e * np.where(t > dur, np.exp(-(t - dur) / max(release / 4.5, 1e-3)), 1.0)).astype(np.float32)

def strings(m, dur, vel=.6, voices=5, bright=.45, attack=1.4, release=2.6, vib=.0035, solo=False):
    f = mtof(m); n = int((dur + release) * SR); t = np.arange(n) / SR
    k = np.arange(1, int(min(64, 9500 / f)) + 1); hf = k * f
    amps = (1 / k) * np.exp(-k * (1 - bright) * .07) * (1 + .7 * np.exp(-((hf - 380) / 260) ** 2) + .4 * np.exp(-((hf - 2700) / 1000) ** 2))
    out = np.zeros(n, np.float32)
    for v in range(1 if solo else voices):
        tab = table(amps, seed=int(m * 7 + v))
        det = 0 if solo else rng.uniform(-1, 1) * .0035
        vr = 5.2 + rng.uniform(-.5, .5); vib_amt = vib * (2.2 if solo else 1)
        fm = f * (1 + det) * (1 + vib_amt * np.sin(2 * np.pi * vr * t + rng.uniform(0, 6.28)) * np.clip((t - .35) / 1.2, 0, 1)) * (1 + .0012 * np.sin(2 * np.pi * rng.uniform(.06, .2) * t + rng.uniform(0, 6)))
        out += osc(tab, fm)
    out /= (1 if solo else voices ** .5)
    bow = bandpass(rng.standard_normal(n), 1800, 5200) * .012 * (2 if solo else 1)
    out = lowpass(out + bow, 1500 + bright * 5200)
    swell = 1 + .12 * np.sin(np.pi * np.clip(t / max(dur, .1), 0, 1))
    return (out * envelope(n, dur, attack, release) * swell * vel).astype(np.float32)

VOWELS = {"a": [(730, 90, 1), (1150, 110, .5), (2650, 170, .25), (3400, 250, .12)],
          "o": [(520, 80, 1), (880, 100, .45), (2500, 160, .12), (3300, 250, .06)],
          "u": [(330, 70, 1), (750, 90, .3), (2400, 160, .06), (3200, 250, .03)]}
def choir(m, dur, vel=.5, vowel="a", voices=6, attack=2.0, release=3.0):
    f = mtof(m); n = int((dur + release) * SR); t = np.arange(n) / SR
    k = np.arange(1, int(min(60, 8000 / f)) + 1); hf = k * f
    resp = sum(g / (1 + ((hf - c) / bw) ** 2) for c, bw, g in VOWELS[vowel]) + .02
    amps = resp * (1 / k ** .6)
    out = np.zeros(n, np.float32)
    for v in range(voices):
        tab = table(amps, seed=int(m * 11 + v)); det = rng.uniform(-1, 1) * .005
        fm = f * (1 + det) * (1 + .006 * np.sin(2 * np.pi * (5.4 + rng.uniform(-.6, .6)) * t + rng.uniform(0, 6.28)) * np.clip((t - .6) / 1.5, 0, 1))
        out += osc(tab, fm) * (.8 + .2 * np.sin(2 * np.pi * rng.uniform(.1, .3) * t + v))
    out /= voices ** .5
    breath = sum(bandpass(rng.standard_normal(n), c * .8, c * 1.25) * g for c, _, g in VOWELS[vowel][:3]) * .02
    return (lowpass(out + breath, 5200) * envelope(n, dur, attack, release) * vel).astype(np.float32)

def piano(m, dur, vel=.55, ring=1.0):
    f = mtof(m); T = min(dur + .2, 10) * ring + .5; n = int(T * SR); t = np.arange(n) / SR
    B = .0003 * (f / 261) ** .4; base = float(np.clip(11 * (110 / f) ** .55, 1.4, 14))
    out = np.zeros(n, np.float32)
    for k in range(1, 48):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 10500: break
        a = vel ** (1 + .06 * k) / k ** 1.05 * (.35 if k % 7 == 0 else 1)
        t60 = base / (1 + .2 * (k - 1))
        for d in (-.00045, .00045):
            out += (a * .5 * np.sin(2 * np.pi * fk * (1 + d) * t + rng.uniform(0, 6.28)) * np.exp(-6.9 * t / t60)).astype(np.float32)
    out *= np.where(t > dur, np.exp(-(t - dur) / .16), 1).astype(np.float32)
    out *= np.clip(t / .003, 0, 1).astype(np.float32)
    thump = lowpass(rng.standard_normal(int(.04 * SR)), 900) * np.exp(-np.arange(int(.04 * SR)) / (SR * .008)) * vel * .25
    out[:len(thump)] += thump.astype(np.float32)
    return lowpass(out, 3000 + vel * 6000).astype(np.float32)

def struck(m, ratios, decays, amps, vel=.5, length=6.0, noise=.0):
    f = mtof(m); n = int(length * SR); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for r, d, a in zip(ratios, decays, amps):
        if f * r < 15000: out += (a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6.28)) * np.exp(-6.9 * t / d)).astype(np.float32)
    if noise:
        burst = lowpass(rng.standard_normal(int(.03 * SR)), 2500) * np.exp(-np.arange(int(.03 * SR)) / (SR * .005)) * noise
        out[:len(burst)] += burst.astype(np.float32)
    return (out * np.clip(t / .002, 0, 1) * vel).astype(np.float32)
def celesta(m, vel=.4): return struck(m, [1, 2, 3.01, 4.2, 5.4], [2.8, 1.2, .6, .35, .2], [1, .35, .15, .08, .05], vel, 4)
def harp(m, vel=.45): return lowpass(struck(m, [1, 2, 3, 4, 5, 6], [4.2, 2.6, 1.6, 1.0, .7, .5], [1, .5, .28, .15, .09, .05], vel, 5, .05), 4200)
def bell(m, vel=.4): return struck(m, [.5, 1, 1.19, 1.56, 2, 2.74, 3.76], [9, 7, 5, 3.5, 2.6, 1.6, 1], [.4, 1, .55, .3, .25, .16, .08], vel, 10)
def timpani(m, vel=.5): return lowpass(struck(m, [1, 1.504, 1.742, 2.0, 2.245, 2.494], [2.4, 1.3, 1.0, .8, .6, .4], [1, .55, .3, .25, .15, .1], vel, 4, .4), 2400)
def flute(m, dur, vel=.4, attack=.25, release=1.2):
    f = mtof(m); n = int((dur + release) * SR); t = np.arange(n) / SR
    fm = f * (1 + .005 * np.sin(2 * np.pi * 5 * t) * np.clip((t - .3) / .8, 0, 1))
    tab = table(np.array([1, .22, .08, .03]))
    breath = bandpass(rng.standard_normal(n), f * 1.5, min(f * 6, 12000)) * .05
    return (lowpass(osc(tab, fm) + breath, 6000) * envelope(n, dur, attack, release, 1.2) * vel).astype(np.float32)
def drone(m, dur, vel=.3): # sine with slow beating, for subs and ashes
    f = mtof(m); n = int(dur * SR); t = np.arange(n) / SR
    return (vel * (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 1.003 * t + 1) + .25 * np.sin(2 * np.pi * f * 2 * t)) * envelope(n, dur - 3, 3, 3)).astype(np.float32)

# ───────────────────────── the room ─────────────────────────
def hall(seconds=4.6, seed=3):
    r = np.random.default_rng(seed); n = int(seconds * SR); t = np.arange(n) / SR
    out = np.zeros((2, n), np.float32)
    for c in range(2):
        noise = r.standard_normal(n)
        low, high = lowpass(noise, 900), highpass(noise, 900)
        out[c] = (low * np.exp(-6.9 * t / seconds) + high * np.exp(-6.9 * t / (seconds * .45))).astype(np.float32)
        for _ in range(14):
            i = int(r.uniform(.008, .09) * SR); out[c, i] += r.uniform(.2, .6) * r.choice([-1, 1])
    pre = int(.025 * SR); out = np.concatenate([np.zeros((2, pre), np.float32), out], 1)
    return out / np.sqrt((out ** 2).sum() / 2)
HALL = hall()

class Track:
    """A stereo canvas. `loop` folds everything past the end back into the start."""
    def __init__(self, seconds, loop=True, tail=12.0):
        self.L = int(seconds * SR); self.loop = loop; self.buf = np.zeros((2, self.L + int(tail * SR)), np.float32)
    def add(self, sig, at, pan=0.0, gain=1.0, wet=None):
        i = int(at * SR)
        if i >= self.buf.shape[1]: return
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4; sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * 1.4142
        n = min(sig.shape[1], self.buf.shape[1] - i); self.buf[:, i:i + n] += sig[:, :n] * gain
    def render(self, wet=.32, dry=.8):
        rev = np.stack([sg.oaconvolve(self.buf[c], HALL[c])[: self.buf.shape[1] + HALL.shape[1]] for c in range(2)]).astype(np.float32)
        full = np.zeros((2, rev.shape[1]), np.float32); full[:, :self.buf.shape[1]] += self.buf * dry; full += rev * wet * .06
        if not self.loop:
            end = np.nonzero(np.abs(full).max(0) > 1e-4)[0]; return full[:, : (end[-1] + 1 if len(end) else self.L)]
        out = np.zeros((2, self.L), np.float32)
        for k in range(0, full.shape[1], self.L): chunk = full[:, k:k + self.L]; out[:, :chunk.shape[1]] += chunk
        return out

def chord(tr, notes, at, dur, inst="strings", vel=.4, spread=.6, **kw):
    for j, m in enumerate(notes):
        pan = (j / max(1, len(notes) - 1) - .5) * spread
        sig = strings(m, dur, vel, **kw) if inst == "strings" else choir(m, dur, vel, **kw)
        tr.add(sig, at + rng.uniform(0, .25), pan)

THEME = [("D4", 2), ("A4", 2), ("G4", 1), ("F#4", 1), ("E4", 2), ("F#4", 1), ("G4", 1), ("A4", 2), ("B4", 1), ("A4", 1), ("F#4", 2),
         ("E4", 2), ("D4", 1), ("E4", 1), ("F#4", 3), ("E4", 1), ("D4", 6)]
THEME_CHORDS = [(N("D2", "A2", "D3", "F#3"), 4), (N("G2", "D3", "G3", "B3"), 4), (N("D2", "A2", "D3", "F#3"), 4), (N("B1", "F#2", "B2", "D3"), 4),
                (N("A1", "E2", "A2", "C#3"), 4), (N("B1", "F#2", "B2", "D3"), 2), (N("A1", "E2", "A2", "C#3"), 2), (N("D2", "A2", "D3", "F#3"), 6)]
def theme_line(tr, at, octave=0, play=None, beat=BEAT, upto=None):
    t = at
    for i, (name, beats) in enumerate(THEME):
        if upto is not None and i >= upto: break
        play(tr, note(name) + 12 * octave, t, beats * beat); t += beats * beat
    return t

# ───────────────────────── the cues ─────────────────────────
def cue_ember():
    """Tonight, by the fire: the theme, alone on a piano, over the faintest strings."""
    tr = Track(48 * BEAT)
    theme_line(tr, 2 * BEAT, play=lambda tr, m, t, d: tr.add(piano(m, d * .95, .42), t, .1))
    t = 2 * BEAT
    for notes, beats in THEME_CHORDS:
        tr.add(piano(notes[0] + 12, beats * BEAT, .3), t, -.3); tr.add(piano(notes[1] + 12, beats * BEAT, .22), t + BEAT * .5, -.15)
        t += beats * BEAT
    chord(tr, N("D3", "A3", "D4"), 0, 48 * BEAT * .55, vel=.12, attack=6, release=8)
    chord(tr, N("D3", "A3", "F#4"), 48 * BEAT * .5, 48 * BEAT * .55, vel=.12, attack=6, release=8)
    return tr.render(wet=.4)

def cue_forest():
    """Into the dark forest, three hundred thousand years ago: low strings, a cello, single piano notes."""
    L = 48.0; tr = Track(L)
    for start in (0, L / 2): chord(tr, N("D2", "A2"), start, L * .62, vel=.26, attack=8, release=9, bright=.25)
    for at, line in ((6, ["D3", "F3", "E3", "D3", "C3", "D3"]), (30, ["A2", "C3", "D3", "F3", "E3"])):
        t = at
        for name in line: d = rng.choice([2, 3, 4]) * BEAT; tr.add(strings(note(name), d, .32, solo=True, bright=.35, attack=.5, release=1.6), t, -.25); t += d
    for at, name in ((3, "D2"), (15, "A1"), (21, "F2"), (38, "D2"), (44, "C2")): tr.add(piano(note(name), 3, .35), at, .2)
    for at in (11, 35): tr.add(strings(note("A5"), 6, .05, bright=.8, attack=3, release=4), at, .5)
    air = highpass(lowpass(rng.standard_normal(tr.L), 2000), 300) * .006
    tr.add(np.stack([air, np.roll(air, 999)]), 0)
    return tr.render(wet=.45)

def cue_fields():
    """Out of the trees, the first fields: warm strings, a harp, the theme on a wooden flute."""
    L = 64.0; tr = Track(L)
    prog = [N("D3", "A3", "D4", "F#4"), N("B2", "F#3", "B3", "D4"), N("G2", "D3", "G3", "B3"), N("A2", "E3", "A3", "C#4"),
            N("F#2", "D3", "A3", "D4"), N("G2", "D3", "B3", "D4"), N("E2", "B2", "G3", "B3"), N("A2", "E3", "A3", "D4")]
    for i, notes in enumerate(prog):
        at = i * 8; chord(tr, notes, at, 8.4, vel=.24, attack=2.5, release=4, bright=.55)
        tr.add(strings(notes[0] - 12, 8.2, .22, bright=.3, attack=1.5, release=3), at, -.4)
        for j in range(8): tr.add(harp(notes[j % 4] + 12 * (j // 4), .3), at + j * BEAT * .5 + 2, (j / 7 - .5) * .8)
    for at in (16, 48): theme_line(tr, at, play=lambda tr, m, t, d: tr.add(flute(m + 12, d * .92, .28), t, .25), upto=6)
    return tr.render(wet=.4)

def cue_voices():
    """The awakening and the heavens: a choir that never sings words, stars like celesta."""
    L = 56.0; tr = Track(L)
    prog = [(N("G2", "B3", "D4", "F#4"), "a"), (N("F#2", "A3", "D4", "A4"), "o"), (N("E2", "G3", "B3", "F#4"), "a"), (N("A2", "D4", "E4", "A4"), "o")]
    for i, (notes, vowel) in enumerate(prog):
        at = i * 14; chord(tr, notes[1:], at, 14.5, "choir", vel=.22, vowel=vowel, attack=3, release=5)
        tr.add(strings(notes[0], 14.2, .2, bright=.3, attack=3, release=4), at, -.3)
    tr.add(choir(note("C#4"), 5, .16, "a", attack=1.5, release=4), 48.5, .2)
    pent = N("D5", "E5", "F#5", "A5", "B5", "D6", "E6")
    for k in range(34): tr.add(celesta(pent[rng.integers(len(pent))], .16 + rng.uniform(0, .12)), rng.uniform(0, L), rng.uniform(-.8, .8))
    return tr.render(wet=.55)

def cue_ash():
    """The ashes: almost nothing. A sub, a cluster that will not resolve, a slow heart, a broken bell far off."""
    L = 40.0; tr = Track(L)
    for start in (0, L / 2): tr.add(drone(note("D1"), L * .6, .18), start, 0)
    for start, notes in ((2, N("D3", "D#3", "A3")), (22, N("C#3", "D3", "G#3"))):
        chord(tr, notes, start, 14, vel=.09, attack=6, release=8, bright=.2)
    t = 0.0
    while t < L - .5: tr.add(timpani(note("D2"), .28), t, 0); tr.add(timpani(note("D2"), .16), t + .32, 0); t += 1.75
    for at, m in ((5, note("D#5")), (25, note("A4"))): tr.add(bell(m, .14) * np.float32(1), at, rng.uniform(-.6, .6))
    rumble = lowpass(rng.standard_normal(tr.L), 90, 4) * .05
    tr.add(np.stack([rumble, np.roll(rumble, 3000)]), 0)
    return tr.render(wet=.6)

def cue_candle():
    """After the candle: the theme returns, on a single violin, over a thin, hopeful pad."""
    L = 48 * BEAT; tr = Track(L)
    end = theme_line(tr, 2 * BEAT, octave=1, play=lambda tr, m, t, d: tr.add(strings(m, d * .98, .26, solo=True, bright=.6, attack=.35, release=1.4), t, .15))
    t = 2 * BEAT
    for notes, beats in THEME_CHORDS:
        chord(tr, [m + 12 for m in notes[1:]], t, beats * BEAT + .5, vel=.11, attack=1.5, release=3, bright=.4); t += beats * BEAT
    for k in range(10): tr.add(piano(N("D5", "A4", "F#5", "E5")[k % 4], 1.5, .14), end + k * BEAT, .4)
    # the pad carries on to the end of the loop, so the hope does not drop out before the theme returns
    rest = L - end
    for j, notes in enumerate((N("B3", "D4", "F#4"), N("G3", "B3", "D4"), N("A3", "D4", "E4"))):
        chord(tr, notes, end - 1 + j * rest / 3, rest / 3 + 1.5, vel=.12, attack=2, release=3, bright=.4)
    tr.add(strings(note("A5"), rest * .8, .14, solo=True, bright=.55, attack=2, release=3), end + 2, .15)
    return tr.render(wet=.45)

def cue_ascent():
    """The last slope: a pulse in the strings and a heartbeat in the timpani, chords that keep climbing."""
    L = 48.0; tr = Track(L)
    prog = [N("D2", "A2", "D3", "F#3"), N("C#2", "A2", "E3", "A3"), N("B1", "F#2", "D3", "B3"), N("F#2", "C#3", "F#3", "A3"),
            N("G2", "D3", "G3", "B3"), N("F#2", "D3", "A3", "D4"), N("E2", "B2", "G3", "B3"), N("A2", "E3", "A3", "C#4")]
    eighth = BEAT / 2
    for i, notes in enumerate(prog):
        at = i * 6; chord(tr, notes[1:], at, 6.3, vel=.2, attack=1.2, release=2.5, bright=.6)
        tr.add(strings(notes[0], 6.1, .26, bright=.35, attack=.8, release=2), at, -.35)
        for j in range(int(6 / eighth)):
            tr.add(strings(notes[2] + (12 if j % 2 else 0), eighth * .55, .13, voices=3, bright=.7, attack=.02, release=.25), at + j * eighth, (.3 if j % 2 else -.3))
        for j in range(int(6 / (2 * BEAT))): tr.add(timpani(notes[0] + 12, .3), at + j * 2 * BEAT, 0)
    return tr.render(wet=.4)

def cue_finale():
    """The end of the road. The star rises (0–7 s) and becomes the Torchbearer's flame; the choir sings the theme while the
    figure shines and the shared sky wakes (7.6–25 s); then the piano, as you turn and look home (25.4 s)."""
    tr = Track(80.0, loop=False)
    for j, m in enumerate(N("D2", "A2", "D3", "A3", "D4", "F#4", "A4")): tr.add(strings(m, 7.5, .1 + j * .02, attack=5 + j * .2, release=3, bright=.4 + j * .05), j * .4, (j / 6 - .5) * .7)
    for j, m in enumerate(N("D4", "F#4", "A4", "D5", "E5", "F#5", "A5", "D6")): tr.add(harp(m, .3), 4.8 + j * .22, (j / 7 - .5))
    tr.add(celesta(note("A6"), .4), 7.1, 0); tr.add(bell(note("D5"), .3), 7.1, 0)
    t0 = 7.6
    theme_line(tr, t0, play=lambda tr, m, t, d: (tr.add(choir(m, d * 1.02, .3, "a", attack=.4, release=1.6), t, -.1), tr.add(strings(m + 12, d * 1.02, .2, bright=.65, attack=.3, release=1.4), t, .15)), upto=11)
    t = t0
    for notes, beats in THEME_CHORDS[:4]:
        chord(tr, notes, t, beats * BEAT + .6, vel=.24, attack=.8, release=2.5, bright=.5); tr.add(timpani(notes[0] + 12, .28), t, 0); t += beats * BEAT
    t1 = 25.4
    theme_line(tr, t1, play=lambda tr, m, t, d: tr.add(piano(m, d * .95, .4), t, .1))
    t = t1
    for notes, beats in THEME_CHORDS:
        chord(tr, [m + 12 for m in notes[1:]], t, beats * BEAT + .5, vel=.12, attack=1.5, release=3, bright=.45); t += beats * BEAT
    chord(tr, N("D3", "A3", "E4", "F#4", "A4"), 57, 14, vel=.12, attack=4, release=8, bright=.4)
    chord(tr, N("D4", "A4"), 57, 14, "choir", vel=.08, vowel="o", attack=4, release=8)
    return tr.render(wet=.5)

def cue_hold():
    """Waiting on the ridge before going home: the open D chord, breathing."""
    L = 32.0; tr = Track(L)
    for start in (0, L / 2): chord(tr, N("D3", "A3", "E4", "F#4", "A4"), start, L * .62, vel=.1, attack=6, release=8, bright=.4)
    for at, m in ((5, note("A5")), (13, note("F#5")), (21, note("E5")), (28, note("D5"))): tr.add(celesta(m, .12), at, rng.uniform(-.6, .6))
    return tr.render(wet=.55)

def cue_homeward():
    """The glide home above the lit road, then the clearing again: the theme in full, and the piano at the door."""
    tr = Track(56.0, loop=False)
    t = 1.0
    for notes, beats in THEME_CHORDS:
        chord(tr, notes, t, beats * BEAT + .8, vel=.26, attack=1.0, release=3, bright=.55)
        chord(tr, [m + 12 for m in notes[1:]], t, beats * BEAT + .8, "choir", vel=.14, vowel="a", attack=1.2, release=3); t += beats * BEAT
    theme_line(tr, 1.0, octave=1, play=lambda tr, m, t, d: (tr.add(strings(m, d * 1.02, .28, voices=4, bright=.7, attack=.25, release=1.6), t, .2), tr.add(flute(m + 12, d * .95, .12), t, -.3)))
    for j in range(int(30 / (2 * BEAT))): tr.add(harp(N("D4", "A4", "F#5", "D5")[j % 4], .2), 1 + j * 2 * BEAT, (j % 2 - .5) * .7)
    # a long cadence carries the glide right down to the clearing
    chord(tr, N("G2", "D3", "G3", "B3", "D4"), 30.5, 4.5, vel=.22, attack=1, release=3, bright=.5)
    chord(tr, N("A2", "E3", "A3", "C#4", "E4"), 34.5, 4.2, vel=.2, attack=1, release=3, bright=.5)
    tr.add(choir(note("A4"), 8, .14, "a", attack=1.5, release=4), 31, 0)
    home = 38.5
    for k, (name, beats) in enumerate(THEME[:5]): tr.add(piano(note(name), beats * BEAT * .95, .36), home + sum(b for _, b in THEME[:k]) * BEAT, .1)
    chord(tr, N("D3", "A3", "D4", "F#4"), home, 9, vel=.12, attack=2, release=6)
    tr.add(piano(note("D2"), 8, .3), home + 8 * BEAT, -.2); tr.add(piano(note("A3"), 8, .2), home + 8 * BEAT + .2, .2); tr.add(piano(note("F#4"), 8, .2), home + 8 * BEAT + .4, .3)
    return tr.render(wet=.5)

# ───────────────────────── ambience ─────────────────────────
def shaped_noise(n, lo, hi, tilt=-1.0, seed=0):
    """Loopable noise: shaped in the frequency domain over the whole loop."""
    r = np.random.default_rng(seed); spec = np.fft.rfft(r.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR) + 1
    gain = (f / 1000) ** (tilt / 2) * (1 / (1 + (lo / f) ** 4)) * (1 / (1 + (f / hi) ** 4))
    out = np.fft.irfft(spec * gain, n); return (out / (np.abs(out).max() + 1e-9)).astype(np.float32)
def periodic(n, cycles, phase=0.0): return np.sin(2 * np.pi * cycles * np.arange(n) / n + phase).astype(np.float32)
def gusts(n, seed):
    r = np.random.default_rng(seed); g = sum(periodic(n, c, r.uniform(0, 6.28)) * a for c, a in ((1, .5), (2, .3), (5, .2), (9, .12)))
    return (.55 + .45 * g / 1.12).astype(np.float32)
def crickets(n, count, level, seed, freq=(4300, 5200)):
    r = np.random.default_rng(seed); out = np.zeros((2, n), np.float32)
    for c in range(count):
        f, pan, period, ofs = r.uniform(*freq), r.uniform(-.9, .9), r.uniform(.55, 1.1), r.uniform(0, 1)
        ch = int(.016 * SR); burst = (np.sin(2 * np.pi * f * np.arange(ch) / SR) * np.hanning(ch)).astype(np.float32)
        t = ofs
        while t < n / SR - .2:
            for p in range(r.integers(2, 5)):
                i = int((t + p * .033) * SR)
                if i + ch < n: g = level * r.uniform(.5, 1); a = (pan + 1) * np.pi / 4; out[0, i:i + ch] += burst * g * np.cos(a); out[1, i:i + ch] += burst * g * np.sin(a)
            t += period * r.uniform(.85, 1.15)
    return out
def owl(level):
    n = int(1.6 * SR); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for at, dur in ((0, .42), (.62, .7)):
        m = (t >= at) & (t < at + dur); tt = t[m] - at; f = 390 - 22 * tt / dur
        out[m] += (np.sin(2 * np.pi * np.cumsum(f) / SR) + .25 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * tt / dur) ** 1.5
    return lowpass(out, 1400) * level
def crackle(n, rate, level, seed):
    r = np.random.default_rng(seed); out = np.zeros(n, np.float32)
    for i in r.integers(0, n - 2000, int(rate * n / SR)):
        k = int(r.uniform(.001, .006) * SR); out[i:i + k] += (r.standard_normal(k) * np.exp(-np.arange(k) / (k * .3)) * r.uniform(.2, 1) ** 2).astype(np.float32)
    return highpass(out, 900) * level
def put(out, sig, at, pan=0.0, gain=1.0):
    """add a sound into a loop at `at` seconds, wrapping past the end back into the start"""
    n = out.shape[1]; i = int(at * SR) % n; ang = (pan + 1) * np.pi / 4
    for c, k in ((0, np.cos(ang) * 1.4142), (1, np.sin(ang) * 1.4142)):
        m = min(len(sig), n - i); out[c, i:i + m] += sig[:m] * k * gain
        if m < len(sig): out[c, :len(sig) - m] += sig[m:] * k * gain
def far(out, wet=.5, cutoff=2500):
    """put a layer at a distance: soften its top and give it the hall, circularly so the loop stays seamless"""
    n = out.shape[1]; res = np.zeros_like(out)
    for c in range(2):
        h = np.zeros(n, np.float32); h[:HALL.shape[1]] = HALL[c][:n]
        rev = np.fft.irfft(np.fft.rfft(out[c]) * np.fft.rfft(h), n) * .06
        res[c] = lowpass(out[c] * (1 - wet) + rev * wet * 6, cutoff)
    return res.astype(np.float32)
def burst(n_s, lo, hi, decay, seed):
    r = np.random.default_rng(seed); n = int(n_s * SR); t = np.arange(n) / SR
    return (bandpass(r.standard_normal(n), lo, hi) * np.exp(-t / decay)).astype(np.float32)
def glide(f0, f1, dur, harm=(1, .3, .1), vib=0.0, vibf=5.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = f0 + (f1 - f0) * (t / dur) + vib * np.sin(2 * np.pi * vibf * t)
    ph = 2 * np.pi * np.cumsum(f) / SR; return sum(a * np.sin((k + 1) * ph) for k, a in enumerate(harm)).astype(np.float32)
def howl(level):  # a wolf, far off: a rising cry that falls away
    d = 3.2; n = int(d * SR); t = np.arange(n) / SR; f = 420 + 260 * np.sin(np.pi * np.minimum(1, t / 2.4)) ** .7 - 90 * (t / d) ** 2
    ph = 2 * np.pi * np.cumsum(f + 6 * np.sin(2 * np.pi * 5.5 * t)) / SR
    return (lowpass(np.sin(ph) + .2 * np.sin(2 * ph), 1600) * np.sin(np.pi * t / d) ** 1.2 * level).astype(np.float32)
def thud(freq, decay, level, noise=.3, seed=0):  # drums, hooves, artillery: a low tone that drops, with a slap
    d = decay * 5; n = int(d * SR); t = np.arange(n) / SR; ph = 2 * np.pi * np.cumsum(freq * (1 + .6 * np.exp(-t / .02))) / SR
    r = np.random.default_rng(seed); slap = lowpass(r.standard_normal(n), freq * 8) * np.exp(-t / (decay * .25)) * noise
    return ((np.sin(ph) * np.exp(-t / decay) + slap) * level).astype(np.float32)
def murmur(n, voices, level, seed):  # a crowd far off: many voices, none of them words
    r = np.random.default_rng(seed); out = np.zeros((2, n), np.float32)
    for v in range(voices):
        syll = np.clip(np.convolve(r.random(int(n / SR * 5) + 2) > .45, np.ones(1), "same"), 0, 1).astype(np.float32)
        env = np.interp(np.arange(n), np.linspace(0, n, len(syll)), syll) * (.6 + .4 * periodic(n, r.integers(1, 4), r.uniform(0, 6)))
        f = r.uniform(380, 900); voice = bandpass(r.standard_normal(n), f * .7, f * 1.6) + .5 * bandpass(r.standard_normal(n), f * 2.4, f * 3.4)
        pan = r.uniform(-.8, .8); a = (pan + 1) * np.pi / 4; out[0] += voice * env * np.cos(a) * level; out[1] += voice * env * np.sin(a) * level
    return out
def chisel(level, seed):  # iron on stone
    r = np.random.default_rng(seed); n = int(.18 * SR); t = np.arange(n) / SR
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) * a for f, d, a in ((r.uniform(2600, 3400), .03, 1), (r.uniform(4800, 5600), .015, .5)))
    return ((ring + bandpass(r.standard_normal(n), 2000, 7000) * np.exp(-t / .006)) * level).astype(np.float32)
def horn(m, dur, level):  # a war horn, far off
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m) * (1 - .03 * np.exp(-t / .15)); ph = 2 * np.pi * np.cumsum(f) / SR
    tone = sum(np.sin(k * ph) / k ** .8 for k in range(1, 8)); return (lowpass(tone, 1400) * envelope(n, dur, .25, .8) * level).astype(np.float32)
def creak(level, seed):  # ship's timbers working
    r = np.random.default_rng(seed); d = r.uniform(.6, 1.4); n = int(d * SR); t = np.arange(n) / SR
    pulses = (np.sin(2 * np.pi * np.cumsum(r.uniform(18, 40) * (1 + .5 * np.sin(np.pi * t / d))) / SR) > .97).astype(np.float32)
    return (bandpass(pulses, 300, 1600) * np.sin(np.pi * t / d) * level).astype(np.float32)
def tick(level, hi=True):
    n = int(.03 * SR); t = np.arange(n) / SR; return ((np.sin(2 * np.pi * (3200 if hi else 2600) * t) * np.exp(-t / .004)) * level).astype(np.float32)
def chirp(level, seed):  # a small bird at first light
    r = np.random.default_rng(seed); parts = []
    for k in range(r.integers(2, 5)):
        d = r.uniform(.05, .12); f0 = r.uniform(3200, 4600); parts.append(glide(f0, f0 + r.uniform(-900, 900), d, (1, .1)) * np.hanning(int(d * SR))); parts.append(np.zeros(int(r.uniform(.04, .1) * SR), np.float32))
    return (np.concatenate(parts) * level).astype(np.float32)
def gunfire(level, seed):  # a machine gun, far away: a short run of cracks
    r = np.random.default_rng(seed); count = r.integers(6, 16); gap = r.uniform(.075, .11); n = int((count * gap + .4) * SR); out = np.zeros(n, np.float32)
    for k in range(count):
        b = burst(.25, 400, 3200, .02, seed * 31 + k) * r.uniform(.6, 1); i = int(k * gap * SR); out[i:i + len(b)] += b[: n - i]
    return out * level
def shell(level, seed, near=False):  # artillery: a crump and a long roll
    r = np.random.default_rng(seed); n = int(5 * SR); t = np.arange(n) / SR
    roll = lowpass(r.standard_normal(n), 140 if not near else 400) * np.exp(-t / (1.4 if not near else .9))
    sub = np.sin(2 * np.pi * np.cumsum(46 * (1 + .8 * np.exp(-t / .05))) / SR) * np.exp(-t / .6)
    crack = highpass(r.standard_normal(n), 900) * np.exp(-t / .03) * (.5 if near else 0)
    return ((roll * 2.2 + sub + crack) * level).astype(np.float32)
def siren(seconds, level):  # an air-raid siren rising and falling
    n = int(seconds * SR); t = np.arange(n) / SR; f = 330 + 420 * (.5 - .5 * np.cos(2 * np.pi * t / (seconds / 2.5))) ** .8
    ph = 2 * np.pi * np.cumsum(f) / SR; tone = np.sin(ph) + .35 * np.sin(2 * ph) + .15 * np.sin(3 * ph)
    return (lowpass(tone, 2200) * envelope(n, seconds, 4, 6) * level).astype(np.float32)
def aircraft(seconds, level, seed):  # engines passing high overhead, the pitch falling as they go
    r = np.random.default_rng(seed); n = int(seconds * SR); t = np.arange(n) / SR; x = (t / seconds - .5) * 2
    f = 92 * (1 - .06 * np.tanh(x * 3)); tone = 0
    for k, det in ((1, 1), (1, 1.012), (2, .997), (3, 1.004)): tone = tone + np.sin(2 * np.pi * np.cumsum(f * k * det) / SR) / k
    hum = lowpass(tone + .3 * bandpass(r.standard_normal(n), 200, 900), 900); return (hum * np.exp(-(x * 1.6) ** 2) * level).astype(np.float32)
def whistle(level):  # a steam whistle, two notes together
    d = 1.8; n = int(d * SR); t = np.arange(n) / SR
    tone = glide(640, 655, d, (1, .4, .2)) + glide(770, 785, d, (1, .3)); return (lowpass(tone + .3 * bandpass(np.random.default_rng(4).standard_normal(n), 600, 3000), 2600) * envelope(n, d, .12, .5) * level).astype(np.float32)
def radio(n_s, level, seed):  # a wireless somewhere: a voice you cannot follow, under static
    r = np.random.default_rng(seed); n = int(n_s * SR); out = murmur(n, 1, 1, seed)[0] * 3
    static = bandpass(r.standard_normal(n), 1500, 5000) * .12 * (.6 + .4 * np.sin(2 * np.pi * .3 * np.arange(n) / SR))
    return (bandpass(out, 300, 2800) + static) * envelope(n, n_s, .5, .8) * level

def ambience(kind, seconds=60.0):
    n = int(seconds * SR); out = np.zeros((2, n), np.float32)
    def wind(lo, hi, level, seed, tilt=-1.2):
        for c in range(2): out[c] += shaped_noise(n, lo, hi, tilt, seed + c) * gusts(n, seed + 10 + c) * level
    if kind == "forest":
        wind(60, 900, .14, 1); wind(1500, 7000, .035, 3, 0)   # canopy hush and needles
        out += crickets(n, 4, .012, 5)
        for at, pan in ((14, -.6), (41, .5)):
            h = owl(.06); i = int(at * SR); a = (pan + 1) * np.pi / 4; out[0, i:i + len(h)] += h * np.cos(a); out[1, i:i + len(h)] += h * np.sin(a)
    elif kind == "open":
        wind(80, 2400, .16, 7); out += crickets(n, 10, .016, 9, (4000, 6000)); out += crickets(n, 3, .006, 19, (2600, 3200))
    elif kind == "ash":
        wind(40, 500, .2, 11, -2); wind(500, 3000, .03, 13)
        for c in range(2): out[c] += crackle(n, 7, .3, 15 + c)
    elif kind == "deep":       # deep time: wind over the grass, wolves, a drum somewhere far off
        wind(70, 1800, .16, 41); out += crickets(n, 6, .01, 43, (4400, 5600))
        far_ = np.zeros_like(out)
        for at, pan in ((9, -.7), (31, .6), (47, -.2)): put(far_, howl(.09), at, pan)
        for k, at in enumerate(np.arange(18, 30, .62)): put(far_, thud(105, .09, .05 if k % 4 else .08, .5, k), at + (k % 2) * .08, .3)
        out += far(far_, .65, 2000)
    elif kind == "fields":   # the first fields: crickets thick, frogs, a cow bell, a dog in a village
        wind(90, 2200, .1, 51); out += crickets(n, 16, .018, 53, (3800, 6200)); out += crickets(n, 5, .012, 54, (1300, 1700))
        far_ = np.zeros_like(out)
        for at in (6, 6.9, 22, 22.5, 23.4, 44): put(far_, struck(84, [1, 1.48, 2.1, 2.9], [.6, .35, .2, .12], [1, .5, .3, .15], .05, 1.2), at, .5)
        for at in (14, 14.35, 38, 38.4, 38.8): put(far_, burst(.2, 500, 1600, .05, int(at * 10)), at, -.6, .12)
        out += far(far_, .6, 2400)
    elif kind == "city":     # the first cities: a crowd murmuring, chisels on stone, a lyre's note now and then
        wind(80, 1200, .06, 61); out += far(murmur(n, 14, .02, 63), .6, 1800)
        near_ = np.zeros_like(out)
        for k, at in enumerate(np.arange(1, seconds, .7)):
            if (k // 6) % 3 != 2: put(near_, chisel(.05, k), at + np.random.default_rng(k).uniform(0, .1), -.4 if (k // 18) % 2 else .5)
        out += far(near_, .4, 6000)
    elif kind == "march":    # armies: drums, horns and horses, never quite in sight
        wind(60, 900, .1, 71)
        far_ = np.zeros_like(out)
        for k, at in enumerate(np.arange(0, seconds, .8)): put(far_, thud(62, .16, .11 if k % 2 == 0 else .07, .4, k), at, -.3)
        for at, m in ((8, 50), (8.9, 55), (33, 50), (34.2, 57)): put(far_, horn(m, 1.6, .05), at, .4)
        for g, at in enumerate((16, 44)):
            for k in range(36): put(far_, thud(140, .03, .05, .7, 900 + k), at + (k // 3) * .38 + (k % 3) * .09, .7 - g * 1.2)
        out += far(far_, .7, 1500)
    elif kind == "temple":   # the awakening: bronze bells slowly, a low chant
        wind(90, 1500, .08, 81)
        far_ = np.zeros_like(out)
        for at, m in ((3, 52), (21, 47), (39, 52), (52, 45)): put(far_, bell(m, .16), at, (at % 3 - 1) * .5)
        chant = choir(45, seconds - 2, .12, "o", voices=5, attack=6, release=6) + choir(52, seconds - 2, .07, "o", voices=4, attack=8, release=6)
        put(far_, chant * .6, 1, 0); out += far(far_, .7, 1600)
    elif kind == "sea":      # the age of sail: the sea, timbers working, a rope's knock
        swell = (.5 + .5 * periodic(n, 6)) ** 2
        for c in range(2): out[c] += lowpass(shaped_noise(n, 40, 2600, -1.4, 91 + c), 1400) * (.12 + .3 * swell)
        far_ = np.zeros_like(out)
        for at in np.arange(2, seconds, 4.3): put(far_, creak(.05, int(at * 7)), at, np.random.default_rng(int(at)).uniform(-.6, .6))
        out += far(far_, .4, 2000)
    elif kind == "clock":    # the new science: a clock, a church bell across the fields
        wind(90, 1500, .07, 101)
        for k, at in enumerate(np.arange(0, seconds, 1.0)): put(out, tick(.025, k % 2 == 0), at, .5)
        far_ = np.zeros_like(out)
        for at in (5, 11, 17, 41, 47): put(far_, bell(43, .2), at, -.5)
        out += far(far_, .7, 1800)
    elif kind == "industry": # steam and iron: a train passing far off, a factory's hum
        for c in range(2): out[c] += (np.sin(2 * np.pi * 50 * np.arange(n) / SR) * .015 + np.sin(2 * np.pi * 100 * np.arange(n) / SR) * .01 + lowpass(shaped_noise(n, 40, 400, -1, 111 + c), 300) * .05).astype(np.float32)
        far_ = np.zeros_like(out)
        for k in range(120): put(far_, burst(.3, 200, 1800, .06, 1200 + k), 8 + k * max(.16, .45 - k * .004), (k / 120 - .5) * 1.4, .1)
        for at in (12, 40): put(far_, whistle(.08), at, .2)
        out += far(far_, .6, 2200)
    elif kind == "war":      # the wars: guns far and near, a siren, aircraft overhead, fire close by
        wind(40, 500, .14, 121, -2)
        for c in range(2): out[c] += lowpass(shaped_noise(n, 20, 300, -2, 123 + c), 160) * .35 * (.6 + .4 * gusts(n, 125 + c)) + crackle(n, 9, .25, 127 + c)
        far_ = np.zeros_like(out); r = np.random.default_rng(131)
        t = 1.0
        while t < seconds: put(far_, shell(.3 if r.random() > .15 else .5, int(t * 10), near=r.random() > .85), t, r.uniform(-.9, .9)); t += r.uniform(1.4, 4.5)
        for k, at in enumerate((7, 19, 26, 43, 51)): put(far_, gunfire(.18, k + 7), at, r.uniform(-.8, .8))
        put(far_, siren(28, .07), 3, -.4); put(far_, aircraft(22, .2, 133), 30, .3)
        out += far(far_, .55, 1800)
    elif kind == "after":    # after the wars: the guns quiet, wind, the first birds, a bell for peace
        wind(80, 1600, .1, 141)
        for k, at in enumerate((4, 9, 9.6, 21, 33, 33.5, 46, 55)): put(out, chirp(.03, k + 3), at, np.random.default_rng(k).uniform(-.8, .8))
        far_ = np.zeros_like(out)
        for at in (12, 18, 24): put(far_, bell(48, .14), at, .4)
        out += far(far_, .7, 1800)
    elif kind == "modern":   # today: a city's hum far below, a jet very high, a voice on the air
        wind(100, 1400, .1, 151)
        for c in range(2): out[c] += lowpass(shaped_noise(n, 30, 600, -1.2, 153 + c), 400) * .1 * (.8 + .2 * gusts(n, 155 + c))
        far_ = np.zeros_like(out)
        for c in range(2): far_[c] += bandpass(shaped_noise(n, 300, 4000, -.6, 157 + c), 500, 3000) * (np.exp(-((np.arange(n) / SR - 20) / 9) ** 2)) * .12
        for at in (8, 37): put(far_, radio(5, .05, int(at)), at, -.5)
        out += far(far_, .6, 2600)
    elif kind == "crest":
        wind(100, 1400, .15, 21); wind(700, 1500, .05, 23, 0)
        for c in range(2): out[c] += bandpass(shaped_noise(n, 600, 2200, 0, 31 + c), 900, 1300) * periodic(n, 3, c) ** 2 * .05
    return np.stack([sg.lfilter(*sg.butter(1, 30 / (SR / 2), "high"), out[c]) for c in range(2)]).astype(np.float32)

def footsteps():
    """Eight steps on soil and needles, half a second apart: the browser plays them as slices."""
    n = int(4 * SR); out = np.zeros(n, np.float32)
    for k in range(8):
        i = int(k * .5 * SR); L = int(.28 * SR); t = np.arange(L) / SR
        thump = lowpass(rng.standard_normal(L), 260) * np.exp(-t / .03) * .9
        grit = highpass(rng.standard_normal(L), 1800) * np.exp(-t / .05) * (rng.random(L) > .7) * .35
        out[i:i + L] += (thump + grit).astype(np.float32) * rng.uniform(.7, 1)
    return np.stack([out, out])

# ───────────────────────── output ─────────────────────────
def write(name, audio, loop, level):
    if name.startswith("amb-"):  # ambience is levelled by loudness, with crackles softly limited, not by its loudest click
        audio = np.tanh(audio / (np.sqrt((audio ** 2).mean()) + 1e-9) * .12 / .8) * .8
    audio = audio / (np.abs(audio).max() + 1e-9) * .78
    rms = float(np.sqrt((audio ** 2).mean()))
    if loop:
        p = int(PAD * SR); audio = np.concatenate([audio[:, -p:], audio, audio[:, :2 * p]], 1)
    OUT.mkdir(parents=True, exist_ok=True); wav = OUT / f"{name}.wav"
    wavfile.write(wav, SR, (audio.T * 32767).astype(np.int16))
    subprocess.run([str(FFMPEG), "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "96k" if name.startswith("amb-") else "128k", str(OUT / f"{name}.mp3")], check=True)
    wav.unlink()
    length = (audio.shape[1] - (3 * int(PAD * SR) if loop else 0)) / SR
    print(f"{name:10s} {length:6.1f}s  rms {rms:.3f}  {(OUT / f'{name}.mp3').stat().st_size // 1024} KB")
    return {"loop": loop, "length": round(length, 4), "start": PAD if loop else 0, "level": round(level, 3)}

CUES = {"ember": (cue_ember, True, 1), "forest": (cue_forest, True, 1), "fields": (cue_fields, True, .9), "voices": (cue_voices, True, .85),
        "ash": (cue_ash, True, 1), "candle": (cue_candle, True, .9), "ascent": (cue_ascent, True, .85), "finale": (cue_finale, False, 1),
        "hold": (cue_hold, True, .8), "homeward": (cue_homeward, False, .95)}
AMB = {"amb-forest": ("forest", .9), "amb-open": ("open", .8), "amb-ash": ("ash", .9), "amb-crest": ("crest", .8),
       "amb-deep": ("deep", .85), "amb-fields": ("fields", .8), "amb-city": ("city", .8), "amb-march": ("march", .8), "amb-temple": ("temple", .8),
       "amb-sea": ("sea", .8), "amb-clock": ("clock", .75), "amb-industry": ("industry", .8), "amb-war": ("war", 1), "amb-after": ("after", .8), "amb-modern": ("modern", .75)}

if __name__ == "__main__":
    only = set(sys.argv[1:]); manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for name, (fn, loop, level) in CUES.items():
        if not only or name in only: manifest[name] = write(name, fn(), loop, level)
    for name, (kind, level) in AMB.items():
        if not only or name in only: manifest[name] = write(name, ambience(kind), True, level)
    if not only or "steps" in only: manifest["steps"] = write("steps", footsteps(), False, 1)
    manifest_path.write_text(json.dumps(manifest, indent=2))
