#!/usr/bin/env python3
"""Sūtra 1.3 — Synth chain version.

Oscillator → VCA (envelope) → VCF (lowpass) → delay → reverb
No text panel. Mandala only + Devanagari top.
"""
import base64
import math
import struct
import os
import random
from PIL import Image, ImageDraw, ImageFont

# ─── Sutra → Base64 → Frequency ─────────────────────────────
SUTRA = "तदा द्रष्टुः स्वरूपेऽवस्थानम्"
UTF8 = SUTRA.encode('utf-8')
B64 = base64.b64encode(UTF8).decode()
B64_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

notes = []
for c in B64:
    idx = B64_ALPHA.index(c)
    if c != '=':
        notes.append((c, idx, 55 + idx * (1100 - 55) / 63))

padding = sum(1 for c in B64 if c == '=')
dr = sum(UTF8) % 9 or 9
print(f"=== Sūtra 1.3 synth ===")
print(f"UTF-8: {len(UTF8)} bytes | Base64: {len(B64)} ({padding} padding)")
print(f"Notes: {len(notes)} | Freq: {notes[0][2]:.0f}–{notes[-1][2]:.0f} Hz | DR: {dr}")

# ─── SYNTH CHAIN ─────────────────────────────────────────────
# Each note goes through:
#   OSC (saw + pulse) → VCA (ADSR) → VCF (resonant lowpass) → delay → reverb

SAMPLE_RATE = 44100
NOTE_DUR = 0.40
GAP = 0.06
NUM_NOTES = len(notes)
TOTAL = NUM_NOTES * (NOTE_DUR + GAP)

# Synth params per note — mapped from base64 index
def synth_params(idx):
    """Return synth params for this base64 index (0-63)."""
    t = idx / 63.0  # 0..1

    # OSC: mix saw and pulse based on index
    saw_mix = 0.5 + 0.5 * math.sin(t * math.pi * 2)  # 0..1 oscillation
    pulse_width = 0.25 + 0.35 * t  # 25% to 60% pulse

    # VCF: cutoff and resonance
    cutoff_base = 200 + 800 * t  # 200–1000 Hz base
    resonance = 2.0 + 6.0 * t    # Q factor: 2–8

    # VCA: ADSR envelope
    attack  = 0.02 + 0.03 * (1 - t)   # lower freq = slightly longer attack
    decay   = 0.08 + 0.06 * t
    sustain = 0.4 + 0.3 * (1 - t)
    release = 0.12 + 0.15 * t

    # Delay: feedback and time per note
    delay_time = 0.15 + 0.20 * t      # 150–350ms delay
    delay_fb   = 0.25 + 0.20 * t      # 25–45% feedback

    # Reverb: wet mix
    reverb_wet = 0.15 + 0.15 * math.sin(t * math.pi)  # more in mid-range

    return {
        'saw_mix': saw_mix,
        'pulse_width': pulse_width,
        'cutoff': cutoff_base,
        'resonance': resonance,
        'attack': attack,
        'decay': decay,
        'sustain': sustain,
        'release': release,
        'delay_time': delay_time,
        'delay_fb': delay_fb,
        'reverb_wet': reverb_wet,
    }


def gen_adsr_env(n_samples, attack_s, decay_s, sustain_l, release_s, note_dur_s):
    """Generate ADSR envelope for one note."""
    a = max(1, int(attack_s * SAMPLE_RATE))
    d = max(1, int(decay_s * SAMPLE_RATE))
    r = max(1, int(release_s * SAMPLE_RATE))
    env = []
    for i in range(n_samples):
        if i < a:
            v = i / a
        elif i < a + d:
            v = 1.0 - (i - a) / d * (1.0 - sustain_l)
        elif i < n_samples - r:
            v = sustain_l
        else:
            v = sustain_l * (n_samples - i) / r
        env.append(max(0, min(1, v)))
    return env


def gen_saw(n, freq, sample_rate):
    """Sawtooth wave."""
    return [((t / sample_rate * freq) % 1.0) * 2 - 1 for t in range(n)]


def gen_pulse(n, freq, sample_rate, width=0.5):
    """Pulse/square wave with variable width."""
    return [((t / sample_rate * freq) % 1.0 < width) * 2 - 1 for t in range(n)]


def lowpass_filter(signal, cutoff, q, sample_rate):
    """Simple resonant lowpass (one-pole with resonance)."""
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / sample_rate
    alpha = dt / (rc + dt)
    # Resonance boost
    boost = 1.0 + (q - 1.0) * 0.3
    out = [0.0] * len(signal)
    prev = 0.0
    for i, s in enumerate(signal):
        raw = alpha * s + (1 - alpha) * prev
        out[i] = prev + alpha * (raw - prev) * boost
        prev = out[i]
    # Normalize to prevent resonance blow-up
    mx = max(abs(x) for x in out) if out else 1.0
    if mx > 0.5:
        out = [x / (mx * 2) for x in out]
    return out


def gen_note(freq, params):
    """Generate one note through full synth chain."""
    n_samples = int((NOTE_DUR + params['release']) * SAMPLE_RATE)
    pw = params['pulse_width']

    # OSC: mix saw + pulse
    saw = gen_saw(n_samples, freq, SAMPLE_RATE)
    pulse = gen_pulse(n_samples, freq, SAMPLE_RATE, pw)
    osc = [params['saw_mix'] * s + (1 - params['saw_mix']) * p
           for s, p in zip(saw, pulse)]

    # VCF: resonant lowpass
    filtered = lowpass_filter(osc, params['cutoff'], params['resonance'], SAMPLE_RATE)

    # VCA: ADSR envelope
    env = gen_adsr_env(n_samples, params['attack'], params['decay'],
                       params['sustain'], params['release'], NOTE_DUR)
    amplified = [f * e * 0.35 for f, e in zip(filtered, env)]

    return amplified, n_samples


def add_delay(signal, delay_samples, feedback):
    """Simple delay effect."""
    out = list(signal) + [0.0] * (delay_samples * 3)
    for i in range(delay_samples, len(out)):
        if i - delay_samples < len(signal):
            out[i] += feedback * out[i - delay_samples]
    # Fade tail
    tail = delay_samples * 2
    for i in range(len(out) - tail, len(out)):
        fade = (len(out) - i) / tail
        out[i] *= fade
    return out


def add_reverb(signal, wet):
    """Simple reverb (comb-filter-ish)."""
    out = list(signal)
    length = len(signal)
    # Multiple comb filters at different delays
    delays = [int(SAMPLE_RATE * d) for d in [0.025, 0.045, 0.065, 0.085]]
    for d in delays:
        if d < length:
            fb = 0.4
            for i in range(d, length):
                out[i] += wet * 0.2 * (signal[i - d] * fb)
    # Normalize
    mx = max(abs(x) for x in out) if out else 1.0
    if mx > 0.6:
        out = [x * 0.6 / mx for x in out]
    return out


# ─── BUILD AUDIO ─────────────────────────────────────────────
print(f"\nSynth chain: OSC → VCF → VCA → delay → reverb")

all_samples = []
for ci, (ch, idx, freq) in enumerate(notes):
    p = synth_params(idx)

    # Generate note through chain
    note_sig, n_samples = gen_note(freq, p)

    # Delay
    delay_samples = int(p['delay_time'] * SAMPLE_RATE)
    note_sig = add_delay(note_sig, delay_samples, p['delay_fb'])

    # Reverb
    note_sig = add_reverb(note_sig, p['reverb_wet'])

    all_samples.extend([int(s * 32767) for s in note_sig])
    gap = int(SAMPLE_RATE * GAP)
    all_samples.extend([0] * gap)
    if ci % 20 == 0:
        print(f"  Note {ci}/{NUM_NOTES} ({ch}, idx={idx}, {freq:.0f} Hz)")

# Write WAV
OUTDIR = 'NPR_OS_sandbox/sutra_audio'
wav_path = os.path.join(OUTDIR, 'audio', '01_03_standard_synth.wav')
os.makedirs(os.path.dirname(wav_path), exist_ok=True)

data_size = len(all_samples) * 2
with open(wav_path, 'wb') as f:
    f.write(b'RIFF')
    f.write(struct.pack('<I', 36 + data_size))
    f.write(b'WAVE')
    f.write(b'fmt ')
    f.write(struct.pack('<I', 16))
    f.write(struct.pack('<H', 1))
    f.write(struct.pack('<H', 1))
    f.write(struct.pack('<I', SAMPLE_RATE))
    f.write(struct.pack('<I', SAMPLE_RATE * 2))
    f.write(struct.pack('<H', 2))
    f.write(struct.pack('<H', 16))
    f.write(b'data')
    f.write(struct.pack('<I', data_size))
    for s in all_samples:
        f.write(struct.pack('<h', s))

print(f"\nWAV: {wav_path} ({data_size:,} bytes)")

# ─── MANDALA (no text panel) ────────────────────────────────

W, H = 1920, 1080
FPS = 30
DURATION = (len(all_samples) / SAMPLE_RATE) + 2
cx, cy = W // 2, H // 2

def idx_color(idx, intensity=1.0):
    hue = (idx / 63) * 360
    s, l = 0.85, 0.5
    cv = (1 - abs(2 * l - 1)) * s
    x = cv * (1 - abs((hue / 60) % 2 - 1))
    m = l - cv / 2
    if hue < 60: r1, g1, b1 = cv, x, 0
    elif hue < 120: r1, g1, b1 = x, cv, 0
    elif hue < 180: r1, g1, b1 = 0, cv, x
    elif hue < 240: r1, g1, b1 = 0, x, cv
    elif hue < 300: r1, g1, b1 = x, 0, cv
    else: r1, g1, b1 = cv, 0, x
    return tuple(max(0, min(255, int((v + m) * 255 * intensity))) for v in (r1, g1, b1))

DEV_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", 56)

# Current note index based on time
def get_current_note(t):
    note_step = (NOTE_DUR + GAP)
    return min(int(t / note_step), len(notes) - 1)

def draw(t):
    img = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    current = get_current_note(t)

    # Śūnya noise
    random.seed(int(t * 100))
    for _ in range(600):
        draw.point((random.randint(0, W - 1), random.randint(0, H - 1)),
                    fill=(random.randint(1, 6),) * 3)

    # 3 = Point Prime / Planck: hexastructure routing at center
    hex_pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / DURATION)
    for ring in range(1, 4):
        r = 30 * ring
        a = 0.15 + 0.1 * hex_pulse * (1 / ring)
        draw.polygon([
            (cx + r * math.cos(theta), cy + r * math.sin(theta))
            for theta in [math.pi/6 * i for i in range(6)]
        ], outline=tuple(int(c * a) for c in (255, 215, 0)))

    # 9 = Frame / complete stored field: all notes as faint ring
    step = math.pi * 2 / len(notes)
    for i, (c, idx, freq) in enumerate(notes):
        angle = i * step
        radius = 160 + (freq / 1100) * 300
        x = int(cx + math.cos(angle) * radius)
        y = int(cy + math.sin(angle) * radius)
        # Stored: always faintly visible
        draw.ellipse([x - 2, y - 2, x + 2, y + 2],
                      fill=tuple(int(c * 0.15) for c in idx_color(idx, 0.3)))

    # 6 = Perspective / visible route: highlight current note
    ci, cidx, cfreq = notes[current]
    c_angle = current * step + t * 0.05
    c_radius = 160 + (cfreq / 1100) * 300
    cx_vis = int(cx + math.cos(c_angle) * c_radius)
    cy_vis = int(cy + math.sin(c_angle) * c_radius)
    for sz in range(12, 0, -1):
        a = sz / 12 * 0.8
        draw.ellipse([cx_vis - sz, cy_vis - sz, cx_vis + sz, cy_vis + sz],
                      outline=tuple(int(c * a) for c in (255, 255, 255)))
    draw.ellipse([cx_vis - 6, cy_vis - 6, cx_vis + 6, cy_vis + 6],
                  fill=idx_color(cidx, 1.0))

    # Mandala arcs — self-similar fractal core
    for i, (c, idx, freq) in enumerate(notes):
        angle = i * step + t * 0.03 * (freq / 550)
        radius = 120 + (freq / 1100) * 350 + math.sin(t * 2 + i) * 10
        for g in range(max(4, int(20 * idx / 63))):
            ga = angle - step * 0.5 / 2 + step * 0.5 * g / max(4, int(20 * idx / 63))
            r = radius + random.gauss(0, 6)
            x = int(cx + math.cos(ga) * r)
            y = int(cy + math.sin(ga) * r)
            sz = max(1, int(3 * idx / 63))
            inten = 0.2 + 0.5 * (0.5 + 0.5 * math.sin(t * 2.5 + i * 0.7))
            # Fractal self-similarity: inner rings echo outer
            if i % 3 == 0:
                inner_r = r * 0.5
                ix = int(cx + math.cos(ga) * inner_r)
                iy = int(cy + math.sin(ga) * inner_r)
                draw.ellipse([ix - sz//2, iy - sz//2, ix + sz//2, iy + sz//2],
                              fill=tuple(int(c * inten * 0.5) for c in idx_color(idx, inten)))
            draw.ellipse([x - sz, y - sz, x + sz, y + sz],
                          fill=tuple(int(c * inten) for c in idx_color(idx, inten)))

    # Golden rings (structural boundaries)
    for rr in [120, 220, 320, 420]:
        a = 0.08 + 0.04 * math.sin(t + rr)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                      outline=tuple(int(c * a) for c in (255, 215, 0)))

    # Devanagari top center
    alpha = 1.0
    if t < 1.5: alpha = t / 1.5
    elif t > DURATION - 2: alpha = max(0, (DURATION - t) / 2)

    dev = SUTRA
    bw = draw.textbbox((0, 0), dev, font=DEV_FONT)
    tw = bw[2] - bw[0]
    for gw in range(4, 0, -1):
        draw.text(((W - tw) / 2 - gw, 35 - gw), dev,
                    fill=tuple(int(c * 0.1) for c in (255, 215, 0)),
                    font=DEV_FONT)
    draw.text(((W - tw) / 2, 35), dev,
              fill=(int(255 * alpha), int(255 * alpha), int(255 * alpha)),
              font=DEV_FONT)

    return img


# Render
FRAMEDIR = os.path.join(OUTDIR, 'frames_01_03_synth')
os.makedirs(FRAMEDIR, exist_ok=True)
total_frames = int(FPS * DURATION)
print(f"\nRendering {total_frames} frames...")
for fi in range(total_frames):
    draw(fi / FPS).save(os.path.join(FRAMEDIR, f'frame_{fi:04d}.png'))
    if fi % 100 == 0:
        print(f"  {fi}/{total_frames}")

print(f"\n=== Done ===")
print(f"WAV:    {wav_path}")
print(f"Frames: {FRAMEDIR}/")
mp4 = os.path.join(OUTDIR, 'mp4', '01_03_standard_synth.mp4')
os.makedirs(os.path.dirname(mp4), exist_ok=True)
print(f"""
ffmpeg -y -framerate 30 \\
  -i {FRAMEDIR}/frame_%04d.png \\
  -i {wav_path} \\
  -c:v libx264 -pix_fmt yuv420p -c:a aac \\
  {mp4}
""")
