#!/usr/bin/env python3
"""
soundtrack.py — a procedural 8-bit score + hand-made foley for the Opus 5.5 film.

Reads  out/cues.json      (written by `node scripts/render.mjs --cues`)
Writes out/soundtrack.wav (48 kHz, 16-bit stereo, exactly FILM duration)

Nothing is sampled: pulse / triangle / noise voices like a NES, plus synthesized
pencil scratches, paper flips, stamps and whooshes placed on the film's own cue list.
Music: 120 BPM, bars on 2.5 + 2k s so every cut in the edit lands on the grid.
"""
import json
import os
import wave

import numpy as np
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, lfilter, sosfilt, sosfilt_zi

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'out')
RNG = np.random.default_rng(55)

with open(os.path.join(OUT, 'cues.json')) as fh:
    DATA = json.load(fh)
DUR = float(DATA['video']['duration'])
N = int(SR * DUR)

BPM = 120.0
BEAT = 60.0 / BPM            # 0.5 s
S16 = BEAT / 4               # 0.125 s
BAR0 = 2.5                   # first downbeat of the groove (the "drop")


def bar_t(b):
    return BAR0 + b * 4 * BEAT


# ----------------------------------------------------------------- buses ----
class Bus:
    def __init__(self):
        self.L = np.zeros(N + SR * 4)
        self.R = np.zeros(N + SR * 4)

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= N or len(sig) == 0:
            return
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), len(self.L) - i)
        th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        self.L[i:i + n] += sig[:n] * gain * np.cos(th) * 1.4142
        self.R[i:i + n] += sig[:n] * gain * np.sin(th) * 1.4142


music, drums, sfx, verb_send = Bus(), Bus(), Bus(), Bus()


# ----------------------------------------------------------- primitives ----
NOTE_IDX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def hz(name):
    if isinstance(name, (int, float)):
        return float(name)
    pc = NOTE_IDX[name[0]]
    rest = name[1:]
    if rest.startswith('#'):
        pc += 1
        rest = rest[1:]
    elif rest.startswith('b'):
        pc -= 1
        rest = rest[1:]
    midi = (int(rest) + 1) * 12 + pc
    return 440.0 * 2 ** ((midi - 69) / 12)


def tvec(n):
    return np.arange(n) / SR


def _blep(t, dt):
    out = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    out[m] = x + x - x * x - 1.0
    m = t > 1.0 - dt
    x = (t[m] - 1.0) / dt[m]
    out[m] = x * x + x + x + 1.0
    return out


def phase_of(freq, n):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    return np.cumsum(dt) % 1.0, dt


def pulse(freq, n, duty=0.25):
    ph, dt = phase_of(freq, n)
    y = np.where(ph < duty, 1.0, -1.0)
    y += _blep(ph, dt)
    y -= _blep((ph - duty) % 1.0, dt)
    return y


def tri(freq, n, steps=16):
    ph, _ = phase_of(freq, n)
    y = 2 * np.abs(2 * ph - 1) - 1
    return np.round(y * steps / 2) / (steps / 2) if steps else y


def sine(freq, n):
    ph, _ = phase_of(freq, n)
    return np.sin(2 * np.pi * ph)


def saw(freq, n):
    ph, dt = phase_of(freq, n)
    return (2 * ph - 1) - _blep(ph, dt)


def noise(n):
    return RNG.uniform(-1, 1, n)


def adsr(n, gate, a=0.004, d=0.08, s=0.7, r=0.06):
    t = tvec(n)
    e = np.where(t < a, t / max(a, 1e-5), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    g = gate / SR
    if gate < n:
        eg = e[min(gate, n - 1)]
        rel = t >= g
        e[rel] = eg * np.clip(1 - (t[rel] - g) / max(r, 1e-4), 0, 1)
    return e


def expdecay(n, tau, a=0.001):
    t = tvec(n)
    return np.minimum(t / a, 1.0) * np.exp(-t / tau)


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)


def sweep_bp(x, f0, f1, q=0.6, block=256):
    """time-varying band-pass (log sweep f0→f1), state carried across blocks."""
    out = np.zeros_like(x)
    nb = max(1, len(x) // block)
    zi = None
    for b in range(nb + 1):
        s, e = b * block, min(len(x), (b + 1) * block)
        if s >= e:
            break
        k = b / max(1, nb)
        fc = f0 * (f1 / f0) ** k
        lo, hi = fc / (1 + q), min(fc * (1 + q), SR * 0.45)
        sos = butter(1, [lo, hi], 'band', fs=SR, output='sos')
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        out[s:e], zi = sosfilt(sos, x[s:e], zi=zi)
    return out


def block_comb(x, d, g):
    """y[n] = x[n] + g*y[n-d], vectorised in blocks of d samples."""
    y = np.zeros(len(x) + d)
    y[d:] = x
    for s in range(d, len(y), d):
        e = min(s + d, len(y))
        y[s:e] += g * y[s - d:e - d]
    return y[d:]


def block_allpass(x, d, g=0.5):
    """Schroeder all-pass, vectorised in blocks: y[n] = -g x[n] + x[n-d] + g y[n-d]."""
    xp = np.concatenate([np.zeros(d), x])
    y = np.zeros(len(xp))
    for s in range(d, len(xp), d):
        e = min(s + d, len(xp))
        y[s:e] = -g * xp[s:e] + xp[s - d:e - d] + g * y[s - d:e - d]
    return y[d:]


def reverb(x, room=0.84, wet_lp=4500, offset=0):
    combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116]
    k = SR / 44100
    out = np.zeros_like(x)
    for c in combs:
        out += block_comb(x, int((c + offset) * k), room)
    out /= len(combs)
    for a in [556, 441, 341, 225]:
        out = block_allpass(out, int((a + offset) * k), 0.5)
    return lp(out, wet_lp)


# --------------------------------------------------------- note helpers ----
def note(bus, start, dur, freq, wave='pulse', duty=0.25, gain=0.2, pan=0.0, a=0.004, d=0.08, s=0.7, r=0.06,
         vib=0.0, vib_rate=5.8, vib_delay=0.14, slide_from=None, slide_time=0.03, send=0.0, lpf=None):
    gate = int(dur * SR)
    n = gate + int(r * SR) + 16
    tt = tvec(n)
    f0 = hz(freq)
    f = np.full(n, f0)
    if slide_from is not None:
        f = f0 + (hz(slide_from) - f0) * np.exp(-tt / slide_time)
    if vib:
        f = f * (1 + vib * np.sin(2 * np.pi * vib_rate * tt) * np.clip((tt - vib_delay) / 0.12, 0, 1))
    if wave == 'pulse':
        y = pulse(f, n, duty)
    elif wave == 'tri':
        y = tri(f, n)
    elif wave == 'saw':
        y = saw(f, n)
    else:
        y = sine(f, n)
    if lpf:
        y = lp(y, lpf)
    y *= adsr(n, gate, a, d, s, r)
    bus.add(y, start, gain, pan)
    if send:
        verb_send.add(y, start, gain * send, pan)


# ------------------------------------------------------------- drums -------
def kick_sig():
    n = int(0.4 * SR)
    t = tvec(n)
    f = 44 + 120 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = hp(noise(n), 2000) * np.exp(-t / 0.004) * 0.35
    return np.tanh((body + click) * 1.6)


def snare_sig():
    n = int(0.25 * SR)
    t = tvec(n)
    nz = bp(noise(n), 1200, 9000) * np.exp(-t / 0.07)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.045) * 0.6
    return nz + tone


def hat_sig(open_=False):
    n = int((0.35 if open_ else 0.06) * SR)
    t = tvec(n)
    return hp(noise(n), 7500, 3) * np.exp(-t / (0.11 if open_ else 0.018))


def crash_sig(length=2.4):
    n = int(length * SR)
    t = tvec(n)
    metal = sum(pulse(f, n, 0.5) for f in [311.1, 427.3, 587.9, 813.2, 1144.0]) / 5
    nz = hp(noise(n) * 0.8 + metal * 0.35, 3800, 2)
    return nz * np.exp(-t / 0.7) * np.minimum(t / 0.002, 1)


KICK, SNARE, HAT, OHAT, CRASH = kick_sig(), snare_sig(), hat_sig(), hat_sig(True), crash_sig()
KICK_TIMES = []


def kick(t, g=0.62):
    drums.add(KICK, t, g, 0)
    KICK_TIMES.append(t)


def snare(t, g=0.32):
    drums.add(SNARE, t, g, 0.05)
    verb_send.add(SNARE, t, g * 0.35, 0.05)


def hat(t, g=0.075, open_=False):
    drums.add(OHAT if open_ else HAT, t, g, 0.28)


def crash(t, g=0.28):
    drums.add(CRASH, t, g, -0.2)
    verb_send.add(CRASH, t, g * 0.25, -0.2)


# ------------------------------------------------------------- score -------
# chords per bar (bar index → (name, tones)); bar -1 = intro, bars 0.. from 2.5 s
CHORDS = {
    -1: ('G7', ['G', 'B', 'D', 'F']),
    0: ('C', ['C', 'E', 'G']), 1: ('G', ['G', 'B', 'D']),
    2: ('Am', ['A', 'C', 'E']), 3: ('F', ['F', 'A', 'C']), 4: ('C', ['C', 'E', 'G']), 5: ('G', ['G', 'B', 'D']),
    6: ('D', ['D', 'F#', 'A']), 7: ('A', ['A', 'C#', 'E']), 8: ('Bm', ['B', 'D', 'F#']), 9: ('G', ['G', 'B', 'D']),
    10: ('G', ['G', 'B', 'D']), 11: ('A', ['A', 'C#', 'E']),
    12: ('D', ['D', 'F#', 'A']), 13: ('D', ['D', 'F#', 'A']),
}


def chord_at(t):
    b = int(np.floor((t - BAR0) / (4 * BEAT)))
    return CHORDS.get(max(-1, min(13, b)))


def nn(tone, octave):
    return f'{tone}{octave}'


# lead motifs: (step16, note, len16)
M = {
    'A1': [(0, 'E5', 2), (2, 'G5', 2), (4, 'C6', 3), (7, 'B5', 1), (8, 'A5', 2), (10, 'G5', 2), (12, 'E5', 3), (15, 'D5', 1)],
    'A2': [(0, 'D5', 2), (2, 'G5', 2), (4, 'B5', 3), (7, 'A5', 1), (8, 'G5', 2), (10, 'D5', 2), (12, 'G5', 4)],
    'B1': [(0, 'A5', 1), (1, 'A5', 1), (2, 'C6', 2), (4, 'E6', 2), (6, 'D6', 2), (8, 'C6', 2), (10, 'B5', 2), (12, 'A5', 4)],
    'B2': [(0, 'A5', 1), (1, 'A5', 1), (2, 'C6', 2), (4, 'F6', 2), (6, 'E6', 2), (8, 'C6', 2), (10, 'A5', 2), (12, 'C6', 4)],
    'B3': [(0, 'G5', 1), (1, 'G5', 1), (2, 'C6', 2), (4, 'E6', 2), (6, 'G6', 2), (8, 'E6', 2), (10, 'C6', 2), (12, 'D6', 4)],
    'B4': [(0, 'B5', 2), (2, 'D6', 2), (4, 'G6', 3), (7, 'F6', 1), (8, 'E6', 2), (10, 'D6', 2), (12, 'B5', 2), (14, 'D6', 2)],
    'C1': [(0, 'F#5', 2), (2, 'A5', 2), (4, 'D6', 3), (7, 'C#6', 1), (8, 'B5', 2), (10, 'A5', 2), (12, 'F#5', 3), (15, 'E5', 1)],
    'C2': [(0, 'E5', 2), (2, 'A5', 2), (4, 'C#6', 3), (7, 'B5', 1), (8, 'A5', 2), (10, 'E5', 2), (12, 'A5', 4)],
    'C3': [(0, 'B5', 1), (1, 'B5', 1), (2, 'D6', 2), (4, 'F#6', 2), (6, 'E6', 2), (8, 'D6', 2), (10, 'C#6', 2), (12, 'B5', 4)],
    'C4': [(0, 'B5', 1), (1, 'B5', 1), (2, 'D6', 2), (4, 'G6', 2), (6, 'F#6', 2), (8, 'D6', 2), (10, 'B5', 2), (12, 'D6', 2), (14, 'E6', 2)],
}
LEAD_PLAN = {0: 'A1', 1: 'A2', 2: 'B1', 3: 'B2', 4: 'B3', 5: 'B4', 6: 'C1', 7: 'C2', 8: 'C3', 9: 'C4'}

# cut / hit moments where the band drops out for a beat so the SFX can speak
HITS = [c['t'] for c in DATA['cues'] if c['sfx'] in ('hit',)]
FINAL = next(c['t'] for c in DATA['cues'] if c['sfx'] == 'final')


def lead_bar(b, gain=0.13):
    for st, nm, ln in M[LEAD_PLAN[b]]:
        t = bar_t(b) + st * S16
        if any(h - 0.05 < t < h + 0.4 for h in HITS):
            continue
        note(music, t, ln * S16 * 0.92, nm, 'pulse', duty=0.25, gain=gain, pan=0.0, a=0.003, d=0.09, s=0.62, r=0.05,
             vib=0.006 if ln >= 3 else 0.0, send=0.35, lpf=7000)
        # dotted-eighth echo, panned, like a tape delay
        note(music, t + 3 * S16, ln * S16 * 0.8, nm, 'pulse', duty=0.125, gain=gain * 0.32, pan=0.55, a=0.003, d=0.06, s=0.5, r=0.04, lpf=3500)


def arp_bar(b, gain=0.05, octave=5, density=1):
    name, tones = CHORDS[b]
    seq = [nn(tones[0], octave - 1), nn(tones[1 % len(tones)], octave - 1), nn(tones[2 % len(tones)], octave - 1), nn(tones[0], octave),
           nn(tones[2 % len(tones)], octave - 1), nn(tones[1 % len(tones)], octave - 1)]
    for i in range(0, 16, density):
        t = bar_t(b) + i * S16
        if any(h - 0.05 < t < h + 0.35 for h in HITS):
            continue
        note(music, t, S16 * 0.8, seq[i % len(seq)], 'pulse', duty=0.125, gain=gain, pan=-0.35 if i % 2 else 0.35, a=0.002, d=0.05, s=0.4, r=0.03, lpf=4200)


def bass_bar(b, style='oct', gain=0.3):
    root = CHORDS[b][1][0]
    lo = 2
    if style == 'oct':
        for i in range(8):
            t = bar_t(b) + i * 2 * S16
            if any(h - 0.05 < t < h + 0.3 for h in HITS):
                continue
            note(music, t, S16 * 1.6, nn(root, lo + (i % 2)), 'tri', gain=gain, a=0.002, d=0.1, s=0.8, r=0.03)
    elif style == 'long':
        note(music, bar_t(b), 4 * BEAT * 0.95, nn(root, lo), 'tri', gain=gain * 0.9, a=0.01, d=0.3, s=0.8, r=0.2)


def pad_chord(t, dur, tones, octave=4, gain=0.05, pan_spread=0.5):
    for i, tn in enumerate(tones):
        for det in (-0.004, 0.004):
            note(music, t, dur, hz(nn(tn, octave)) * (1 + det), 'saw', gain=gain / len(tones), pan=(i / max(1, len(tones) - 1) - 0.5) * pan_spread * 2,
                 a=0.25, d=0.5, s=0.8, r=0.6, lpf=1800, send=0.6)


def drums_bar(b, style):
    t0_ = bar_t(b)
    for beat in range(4):
        tb = t0_ + beat * BEAT
        if any(h - 0.05 < tb < h + 0.3 for h in HITS):
            continue
        if style in ('A', 'B'):
            if beat in (0, 2):
                kick(tb)
            if beat in (1, 3):
                snare(tb)
            if style == 'B' and beat == 2:
                kick(tb + 2 * S16, 0.45)
        elif style == 'C':
            kick(tb)
            if beat in (1, 3):
                snare(tb)
            hat(tb + 2 * S16, 0.09, open_=True)
        for s16 in range(4):
            if style == 'A' and s16 % 2:
                continue
            ts = tb + s16 * S16
            hat(ts, 0.075 if s16 % 2 == 0 else 0.045)


# --- intro: pencil & a sparkly dominant arpeggio that winds up into the drop
for i in range(16):
    t = 0.5 + i * S16
    tones = CHORDS[-1][1]
    oct_ = 5 if i < 8 else 6
    note(music, t, S16 * 0.9, nn(tones[i % 4], oct_), 'pulse', duty=0.125, gain=0.035 + 0.035 * i / 16, pan=-0.3 if i % 2 else 0.3, a=0.002, d=0.05, s=0.3, r=0.04, send=0.5)
pad_chord(0.5, 1.9, ['G', 'B', 'D', 'F'], 3, gain=0.05)
for i in range(8):                                     # snare fill into the drop
    snare(2.0 + i * S16 / 2, 0.08 + 0.2 * i / 8)
crash(2.5, 0.32)

# --- A (title, value)
for b in (0, 1):
    lead_bar(b)
    arp_bar(b, 0.04, 5, 2)
    bass_bar(b, 'oct', 0.28)
    drums_bar(b, 'A')

# --- B "Builds." (Am F C G)
for b in (2, 3, 4, 5):
    lead_bar(b, 0.12)
    arp_bar(b, 0.045, 5, 1)
    bass_bar(b, 'oct', 0.3)
    drums_bar(b, 'B')

# --- C "Works." (up a whole step: D A Bm G)
for b in (6, 7, 8, 9):
    lead_bar(b, 0.125)
    arp_bar(b, 0.045, 5, 1)
    bass_bar(b, 'oct', 0.3)
    drums_bar(b, 'C')
    pad_chord(bar_t(b), 4 * BEAT, CHORDS[b][1], 4, gain=0.03)

# --- D "Draws." breakdown: pads + arps, the drums fall away, riser into the finale
for b in (10, 11):
    pad_chord(bar_t(b), 4 * BEAT, CHORDS[b][1], 4, gain=0.07)
    arp_bar(b, 0.05, 6, 1)
    bass_bar(b, 'long', 0.28)
    for i in range(8):
        hat(bar_t(b) + i * 2 * S16, 0.05)
kick(bar_t(11), 0.45)
for i in range(12):                                    # snare roll into the finale
    snare(25.5 + i * (0.75 / 12), 0.05 + 0.22 * i / 12)

# --- Finale: big D major, a Clawd victory jingle, and a warm tail
crash(FINAL - 0.05, 0.36)
kick(FINAL - 0.05, 0.8)
pad_chord(FINAL - 0.05, 3.2, ['D', 'F#', 'A', 'D'], 4, gain=0.11)
pad_chord(FINAL - 0.05, 3.2, ['D', 'A'], 3, gain=0.07)
note(music, FINAL - 0.05, 3.0, 'D2', 'tri', gain=0.34, a=0.005, d=0.6, s=0.7, r=0.6)
for i, nm in enumerate(['A5', 'D6', 'F#6']):
    note(music, FINAL - 0.05, 1.4, nm, 'pulse', duty=0.25, gain=0.05, pan=(i - 1) * 0.4, a=0.003, d=0.4, s=0.5, r=0.5, vib=0.004, send=0.6)
for i, nm in enumerate(['D6', 'F#6', 'A6', 'D7']):     # victory jingle while Clawd hops in
    note(music, 27.15 + i * 0.09, 0.08 if i < 3 else 0.5, nm, 'pulse', duty=0.5, gain=0.07, pan=0.2, a=0.002, d=0.1, s=0.6, r=0.2, send=0.4)
for i, nm in enumerate(['A5', 'B5', 'C#6', 'D6']):      # little resolving tag at the very end
    note(music, 28.55 + i * S16, S16 * (0.8 if i < 3 else 6), nm, 'pulse', duty=0.25, gain=0.055, pan=-0.1, a=0.002, d=0.1, s=0.6, r=0.35, send=0.5)
note(music, 28.55 + 3 * S16, 1.2, 'D3', 'tri', gain=0.22, a=0.005, d=0.3, s=0.6, r=0.5)


# ------------------------------------------------------------- foley -------
def click_sig(freq=2600, tau=0.004, g=1.0):
    n = int(0.03 * SR)
    t = tvec(n)
    return (hp(noise(n), 1800) * np.exp(-t / tau) + np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006) * 0.4) * g


def sfx_type(t, dur):
    x = t
    while x < t + dur:
        sfx.add(click_sig(RNG.uniform(1800, 3200)), x, RNG.uniform(0.18, 0.3), RNG.uniform(-0.3, 0.3))
        x += RNG.uniform(0.045, 0.085)


def strokes(dur, stroke=(0.06, 0.14), band=(2200, 7000), grain=(18, 40)):
    n = int(dur * SR)
    env = np.zeros(n)
    x = 0
    while x < n:
        L = int(RNG.uniform(*stroke) * SR)
        seg = np.sin(np.linspace(0, np.pi, min(L, n - x))) ** 0.7 * RNG.uniform(0.6, 1.0)
        env[x:x + len(seg)] = seg
        x += L + int(RNG.uniform(0.0, 0.02) * SR)
    am = 0.7 + 0.3 * np.sin(2 * np.pi * RNG.uniform(*grain) * tvec(n))
    return bp(noise(n), *band) * env * am


def sfx_pencil(t, dur):
    sfx.add(strokes(dur, (0.07, 0.16), (2500, 7500)), t, 0.5, -0.15)


def sfx_scribble(t, dur):
    sfx.add(strokes(dur, (0.035, 0.06), (900, 4200), (30, 60)), t, 0.55, 0.1)


def sfx_riser(t, dur):
    n = int(dur * SR)
    tt = tvec(n)
    nz = sweep_bp(noise(n), 400, 6000, 0.5) * (tt / dur) ** 1.5
    tone = pulse(200 * (4 ** (tt / dur)), n, 0.5) * (tt / dur) ** 2 * 0.08
    sfx.add(nz * 0.9 + tone, t, 0.45)


def pop_sig(f0=320, f1=1250, tau=0.07):
    n = int(0.18 * SR)
    tt = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-tt / 0.02)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / tau)


def sfx_pop(t):
    sfx.add(pop_sig(), t, 0.55)
    sfx.add(lp(noise(int(0.12 * SR)), 900) * expdecay(int(0.12 * SR), 0.03), t, 0.4)


def sfx_bits(t, dur):
    pent = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7']
    k = int(dur / 0.012)
    for i in range(k):
        nm = pent[RNG.integers(0, len(pent))]
        note(sfx, t + i * 0.012, 0.01, nm, 'pulse', duty=0.5, gain=0.06, pan=RNG.uniform(-0.5, 0.5), a=0.001, d=0.02, s=0.5, r=0.005)


def thump_sig(f0=95, f1=48, tau=0.12, length=0.35):
    n = int(length * SR)
    tt = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-tt / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / tau)


def sfx_land(t):
    sfx.add(thump_sig(), t, 0.6)
    sfx.add(lp(noise(int(0.2 * SR)), 700) * expdecay(int(0.2 * SR), 0.05), t, 0.35)


def whoosh_sig(dur=0.35, f0=300, f1=3000, shape='bell'):
    n = int(dur * SR)
    tt = tvec(n) / dur
    env = np.sin(np.pi * tt) ** 1.5 if shape == 'bell' else tt ** 2
    return sweep_bp(noise(n), f0, f1, 0.7) * env


def sfx_whoosh(t, pan=0.0):
    sfx.add(whoosh_sig(0.36, 350, 2800), t - 0.18, 0.55, pan)


def sfx_whooshUp(t):
    sfx.add(whoosh_sig(0.36, 250, 5000), t - 0.18, 0.55)


def sfx_zoom(t):
    sfx.add(whoosh_sig(0.3, 300, 4200), t - 0.16, 0.5)
    n = int(0.2 * SR)
    tt = tvec(n)
    sfx.add(pulse(300 * (5 ** (tt / 0.2)), n, 0.5) * np.sin(np.pi * tt / 0.2) * 0.06, t - 0.16, 1.0)


def sfx_drops(t, n_, dur):
    pent = ['C5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6']
    for i in range(n_):
        x = t + i * dur / n_ + RNG.uniform(0, 0.01)
        note(sfx, x, 0.03, pent[(i * 3) % len(pent)], 'tri', gain=0.12, pan=(i / n_ - 0.5), a=0.001, d=0.04, s=0.3, r=0.03)
        sfx.add(thump_sig(160, 90, 0.03, 0.08), x, 0.12)


def sfx_boing(t):
    n = int(0.55 * SR)
    tt = tvec(n)
    f = 190 * (1 + 0.9 * tt / 0.55) + 120 * np.exp(-tt / 0.2) * np.sin(2 * np.pi * 16 * tt)
    sfx.add(sine(f, n) * np.exp(-tt / 0.22), t, 0.4)


def sfx_swish(t):
    sfx.add(whoosh_sig(0.2, 1500, 6000), t, 0.3, 0.3)


def bell_sig(freq, tau=0.6, length=1.2):
    n = int(length * SR)
    tt = tvec(n)
    f = hz(freq)
    y = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt / (tau / m ** 0.5)) for m, a in [(1, 1), (2.76, 0.45), (5.4, 0.22), (8.93, 0.1)])
    return y * np.minimum(tt / 0.002, 1)


def sfx_twinkle(t):
    for i, nm in enumerate(['E6', 'G6', 'B6', 'D7', 'E7']):
        b = bell_sig(nm, 0.35, 0.8)
        sfx.add(b, t + i * 0.05, 0.07, -0.4 + i * 0.2)
        verb_send.add(b, t + i * 0.05, 0.05, 0)


def sfx_stamp(t):
    sfx.add(thump_sig(80, 40, 0.22, 0.5), t, 0.8)
    sfx.add(bp(noise(int(0.08 * SR)), 900, 4500) * expdecay(int(0.08 * SR), 0.02), t, 0.5)


def sfx_needle(t):
    n = int(0.55 * SR)
    tt = tvec(n)
    k = np.clip(tt / 0.5, 0, 1)
    over = 1 + 0.12 * np.exp(-tt * 9) * np.sin(tt * 40)
    f = (180 + 720 * (1 - (1 - k) ** 3)) * over
    sfx.add(pulse(f, n, 0.25) * np.exp(-tt / 0.4) * 0.5, t, 0.16, 0.3)


def sfx_dash(t):
    n = int(0.7 * SR)
    tt = tvec(n) / 0.7
    x = sweep_bp(noise(n), 2600, 500, 0.7) * np.sin(np.pi * tt) ** 2
    th = (np.linspace(-1, 1, n) + 1) * np.pi / 4          # pans left → right with Clawd
    i = int(t * SR)
    sfx.L[i:i + n] += x * 0.5 * np.cos(th) * 1.41
    sfx.R[i:i + n] += x * 0.5 * np.sin(th) * 1.41


def sfx_hit(t):
    name, tones = chord_at(t + 0.3)
    crash(t, 0.34)
    kick(t, 0.8)
    sfx.add(thump_sig(70, 34, 0.35, 0.9), t, 0.55)
    for i, tn in enumerate(tones):
        for o, g in ((4, 0.07), (5, 0.05)):
            note(music, t, 0.32, nn(tn, o), 'pulse', duty=0.5 if o == 4 else 0.25, gain=g, pan=(i - 1) * 0.3, a=0.002, d=0.15, s=0.4, r=0.25, send=0.7)
    note(music, t, 0.4, nn(tones[0], 2), 'tri', gain=0.3, a=0.002, d=0.2, s=0.6, r=0.2)


def metal_sig(freqs=(523, 1310, 2093, 3202), tau=0.12, length=0.5):
    n = int(length * SR)
    tt = tvec(n)
    return sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / (tau * (1 - i * 0.18))) for i, f in enumerate(freqs)) / len(freqs)


def sfx_clonk(t):
    sfx.add(metal_sig(), t, 0.42, 0.25)
    sfx.add(click_sig(1500, 0.003), t, 0.3)


def sfx_flip(t):
    n = int(0.42 * SR)
    tt = tvec(n) / 0.42
    x = sweep_bp(noise(n), 1200, 5200, 0.8) * np.sin(np.pi * tt) ** 1.2 * (1 + 0.5 * np.sin(2 * np.pi * 30 * tt * 0.42))
    sfx.add(x, t - 0.2, 0.6, -0.1)
    sfx.add(thump_sig(140, 70, 0.05, 0.15), t + 0.18, 0.25)


def sfx_counter(t, dur):
    x = 0.0
    while x < dur:
        k = x / dur
        rate = 45 * (1 - k) ** 1.6 + 6
        sfx.add(click_sig(2200 + 900 * (1 - k), 0.002), t + x, 0.16, 0.2)
        x += 1 / rate


def sfx_stream(t, dur):
    x = t
    while x < t + dur:
        m = int(0.012 * SR)
        sfx.add(bp(noise(m), 2000, 6000) * np.hanning(m), x, 0.12, RNG.uniform(-0.6, 0.6))
        x += RNG.uniform(0.025, 0.05)


def sfx_grow(t, dur):
    n = int(dur * SR)
    tt = tvec(n) / dur
    f = hz('C4') * 4 ** E_out(tt)
    sfx.add(pulse(f, n, 0.25) * (0.4 + 0.6 * tt) * np.minimum((1 - tt) * 20, 1), t, 0.07, -0.2)


def E_out(x):
    return 1 - (1 - x) ** 3


def sfx_flag(t):
    sfx.add(thump_sig(120, 60, 0.08, 0.25), t, 0.45)
    note(sfx, t + 0.05, 0.07, 'B5', 'pulse', duty=0.5, gain=0.08, a=0.001, d=0.05, s=0.8, r=0.01)
    note(sfx, t + 0.12, 0.45, 'E6', 'pulse', duty=0.5, gain=0.08, a=0.001, d=0.2, s=0.5, r=0.2, send=0.4)


def sfx_spawn(t, n_, dur):
    for i in range(n_):
        f0 = 250 * 2 ** (i / 12 * 1.5)
        sfx.add(pop_sig(f0, f0 * 3.2, 0.05), t + i * dur / n_, 0.22, -0.6 + 1.2 * i / max(1, n_ - 1))


def sfx_checks(t, n_, dur):
    scale = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7']
    for i in range(n_):
        nm = scale[min(len(scale) - 1, int(i / n_ * len(scale)))]
        note(sfx, t + i * dur / n_, 0.02, nm, 'pulse', duty=0.5, gain=0.045, pan=0.4, a=0.001, d=0.02, s=0.5, r=0.01)
    b = bell_sig('C7', 0.5, 1.0)
    sfx.add(b, t + dur, 0.12, 0.3)
    verb_send.add(b, t + dur, 0.08, 0)


def sfx_pops(t, n_, dur):
    for i in range(n_):
        f0 = RNG.uniform(400, 900)
        sfx.add(pop_sig(f0, f0 * 2.5, 0.03), t + i * dur / n_, 0.07, RNG.uniform(0, 0.8))


def sfx_hats(t, every, dur):
    x = 0.0
    i = 0
    while x < dur:
        sfx.add(whoosh_sig(0.07, 2000, 7000), t + x, 0.18, -0.4)
        note(sfx, t + x + 0.03, 0.03, ['G5', 'A5', 'C6', 'D6', 'E6'][i % 5], 'pulse', duty=0.25, gain=0.035, a=0.001, d=0.02, s=0.5, r=0.01)
        x += every
        i += 1


def sfx_keys(t, dur):
    x = t
    while x < t + dur:
        sfx.add(click_sig(RNG.uniform(2400, 3600), 0.003), x, RNG.uniform(0.12, 0.2), 0.35)
        x += RNG.uniform(0.035, 0.06)


def sfx_fold(t):
    n = int(0.4 * SR)
    tt = tvec(n)
    crackle = (RNG.uniform(0, 1, n) > 0.985) * RNG.uniform(-1, 1, n)
    x = hp(crackle, 1500) * np.exp(-tt / 0.2) * 1.5 + whoosh_sig(0.4, 800, 3000) * 0.6
    sfx.add(x, t, 0.4, 0.2)


def sfx_ding(t):
    b = bell_sig('E6', 0.6, 1.4) + bell_sig('B6', 0.5, 1.4) * 0.6
    sfx.add(b, t, 0.09, 0.3)
    verb_send.add(b, t, 0.06, 0)


def sfx_wipe(t):
    n = int(0.5 * SR)
    tt = tvec(n) / 0.5
    x = sweep_bp(noise(n), 500, 2600, 0.9) * np.sin(np.pi * tt) ** 1.3 * (0.75 + 0.25 * np.sin(2 * np.pi * 55 * tvec(n)))
    sfx.add(x, t - 0.22, 0.75)


def sfx_stamps(t, n_, every, fail):
    for i in range(n_):
        x = t + i * every
        if i in fail:
            note(sfx, x, 0.09, 'A2', 'pulse', duty=0.5, gain=0.06, a=0.001, d=0.05, s=0.6, r=0.02, lpf=1200)
        else:
            sfx.add(click_sig(1800, 0.003), x, 0.22, 0.2)
            sfx.add(thump_sig(180, 110, 0.03, 0.08), x, 0.18)
            note(sfx, x + 0.01, 0.025, ['E6', 'G6', 'A6', 'C7'][i % 4], 'pulse', duty=0.5, gain=0.03, a=0.001, d=0.02, s=0.4, r=0.01)


def sfx_clicks(t, times):
    for k in times:
        sfx.add(click_sig(3200, 0.002), t + k, 0.35, 0.3)
        sfx.add(click_sig(2400, 0.002), t + k + 0.06, 0.22, 0.3)
        sfx.add(pop_sig(700, 1400, 0.03), t + k, 0.12, 0.3)


def sfx_zoomOut(t, dur):
    n = int(dur * SR)
    tt = tvec(n) / dur
    sfx.add(sweep_bp(noise(n), 4200, 300, 0.8) * np.sin(np.pi * tt) ** 1.5, t, 0.5)


def sfx_slide(t):
    sfx.add(whoosh_sig(0.3, 600, 2400), t - 0.1, 0.4, -0.5)


def sfx_chips(t, n_, every):
    for i in range(n_):
        f0 = 500 * 2 ** (i * 4 / 12)
        sfx.add(pop_sig(f0, f0 * 2, 0.04), t + i * every, 0.2, -0.3 + 0.2 * i)


def sfx_final(t):
    sfx.add(thump_sig(65, 30, 0.5, 1.4), t, 0.6)
    for i, nm in enumerate(['D7', 'F#7', 'A7', 'D8']):
        b = bell_sig(nm, 0.9, 2.2)
        sfx.add(b, t + 0.03 * i, 0.045, -0.5 + i * 0.33)
        verb_send.add(b, t + 0.03 * i, 0.06, 0)


def sfx_hop(t, dur):
    for i in range(3):
        n = int(0.1 * SR)
        tt = tvec(n)
        sfx.add(pulse(300 * (2.4 ** (tt / 0.1)), n, 0.5) * np.exp(-tt / 0.08), t + i * dur / 3, 0.05, 0.4)


HANDLERS = {
    'type': lambda c: sfx_type(c['t'], c['dur']), 'pencil': lambda c: sfx_pencil(c['t'], c['dur']),
    'scribble': lambda c: sfx_scribble(c['t'], c['dur']), 'riser': lambda c: sfx_riser(c['t'], c['dur']),
    'pop': lambda c: sfx_pop(c['t']), 'bits': lambda c: sfx_bits(c['t'], c['dur']), 'land': lambda c: sfx_land(c['t']),
    'whoosh': lambda c: sfx_whoosh(c['t']), 'whooshUp': lambda c: sfx_whooshUp(c['t']), 'zoom': lambda c: sfx_zoom(c['t']),
    'drops': lambda c: sfx_drops(c['t'], c['n'], c['dur']), 'boing': lambda c: sfx_boing(c['t']), 'swish': lambda c: sfx_swish(c['t']),
    'twinkle': lambda c: sfx_twinkle(c['t']), 'stamp': lambda c: sfx_stamp(c['t']), 'needle': lambda c: sfx_needle(c['t']),
    'dash': lambda c: sfx_dash(c['t']), 'hit': lambda c: sfx_hit(c['t']), 'clonk': lambda c: sfx_clonk(c['t']),
    'flip': lambda c: sfx_flip(c['t']), 'counter': lambda c: sfx_counter(c['t'], c['dur']), 'stream': lambda c: sfx_stream(c['t'], c['dur']),
    'grow': lambda c: sfx_grow(c['t'], c['dur']), 'flag': lambda c: sfx_flag(c['t']), 'spawn': lambda c: sfx_spawn(c['t'], c['n'], c['dur']),
    'checks': lambda c: sfx_checks(c['t'], c['n'], c['dur']), 'pops': lambda c: sfx_pops(c['t'], c['n'], c['dur']),
    'hats': lambda c: sfx_hats(c['t'], c['every'], c['dur']), 'keys': lambda c: sfx_keys(c['t'], c['dur']), 'fold': lambda c: sfx_fold(c['t']),
    'ding': lambda c: sfx_ding(c['t']), 'wipe': lambda c: sfx_wipe(c['t']), 'stamps': lambda c: sfx_stamps(c['t'], c['n'], c['every'], set(c['fail'])),
    'clicks': lambda c: sfx_clicks(c['t'], c['times']), 'zoomOut': lambda c: sfx_zoomOut(c['t'], c['dur']), 'slide': lambda c: sfx_slide(c['t']),
    'chips': lambda c: sfx_chips(c['t'], c['n'], c['every']), 'final': lambda c: sfx_final(c['t']), 'hop': lambda c: sfx_hop(c['t'], c['dur']),
}
missing = sorted({c['sfx'] for c in DATA['cues']} - set(HANDLERS))
if missing:
    raise SystemExit(f'no sound for cues: {missing}')
for c in DATA['cues']:
    HANDLERS[c['sfx']](c)

# ----------------------------------------------------------------- mix -----
def sidechain_env():
    env = np.zeros(len(music.L))
    for t in KICK_TIMES:
        i = int(t * SR)
        n = int(0.22 * SR)
        seg = 1 - np.exp(-tvec(n) / 0.06)
        env[i:i + n] = np.maximum(env[i:i + n], 1 - seg)
    return 1 - 0.4 * env


duck = sidechain_env()
mL, mR = music.L * duck, music.R * duck
rev_L = reverb(verb_send.L + (mL + drums.L) * 0.06, 0.82, 4200, 0)
rev_R = reverb(verb_send.R + (mR + drums.R) * 0.06, 0.82, 4200, 23)

L = mL + drums.L + sfx.L + rev_L * 0.42
R = mR + drums.R + sfx.R + rev_R * 0.42
L, R = L[:N], R[:N]

# master: high-pass rumble, set level so only true peaks touch the limiter, soft-knee limit at −1 dBFS
L, R = hp(L, 28), hp(R, 28)
both = np.maximum(np.abs(L), np.abs(R))
level = 0.63 / np.percentile(both, 99.7)          # 99.7th-percentile peak → −4 dBFS
L, R = L * level, R * level
peak = maximum_filter1d(np.maximum(np.abs(L), np.abs(R)), size=int(0.004 * SR))
a = np.exp(-1 / (0.06 * SR))
env = np.maximum(lfilter([1 - a], [1, -a], peak), peak)
target = 0.8
gr = np.minimum(1.0, target / np.maximum(env, 1e-9))
L, R = L * gr, R * gr
L, R = np.tanh(L * 1.1) / np.tanh(1.1), np.tanh(R * 1.1) / np.tanh(1.1)
fade = np.ones(N)
fn = int(0.5 * SR)
fade[-fn:] = np.linspace(1, 0, fn) ** 1.5
fade[:int(0.01 * SR)] = np.linspace(0, 1, int(0.01 * SR))
L, R = L * fade, R * fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / pk * 0.78, R / pk * 0.78       # ≈ −14 LUFS, true peak < −1 dBTP
rms = np.sqrt(np.mean((L ** 2 + R ** 2) / 2))
print(f'limiter: max gain reduction {20 * np.log10(np.min(gr)):.1f} dB, active {100 * np.mean(gr < 0.999):.1f}% of samples')

pcm = (np.stack([L, R], axis=1) * 32767).astype('<i2')
with wave.open(os.path.join(OUT, 'soundtrack.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'wrote out/soundtrack.wav  {DUR:.2f}s  peak -2.2 dBFS  rms {20 * np.log10(rms):.1f} dBFS  ({len(DATA["cues"])} cues)')
