#!/usr/bin/env python3
"""Sūtra 1.4 — Synth chain version.

वृत्तिसारूप्यमितरत्र
vṛtti-sārūpyam-itaratra
"The other assumes the form of the vṛttis"

OSC → VCA (ADSR) → VCF (resonant lowpass) → delay → reverb
Mandala only + Devanagari top.
"""
import base64
import math
import struct
import os
import random
from PIL import Image, ImageDraw, ImageFont

# ─── Sutra → Base64 → Frequency ─────────────────────────────
SUTRA = "वृत्तिसारूप्यमितरत्र"
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
print(f"=== Sūtra 1.4 synth ===")
print(f"UTF-8: {len(UTF8)} bytes | Base64: {len(B64)} ({padding} padding)")
print(f"Notes: {len(notes)} | Freq: {notes[0][2]:.0f}–{notes[-1][2]:.0f} Hz | DR: {dr}")

# ─── SYNTH CHAIN ─────────────────────────────────────────────
SAMPLE_RATE = 44100
NOTE_DUR = 0.40
GAP = 0.06
NUM_NOTES = len(notes)
TOTAL = NUM_NOTES * (NOTE_DUR + GAP)

def synth_params(idx):
    t = idx / 63.0
    saw_mix = 0.5 + 0.5 * math.sin(t * math.pi * 2)
    pulse_width = 0.25 + 0.35 * t
    cutoff_base = 200 + 800 * t
    resonance = 2.0 + 6.0 * t
    attack  = 0.02 + 0.03 * (1 - t)
    decay   = 0.08 + 0.06 * t
    sustain = 0.4 + 0.3 * (1 - t)
    release = 0.12 + 0.15 * t
    delay_time = 0.15 + 0.20 * t
    delay_fb   = 0.25 + 0.20 * t
    reverb_wet = 0.15 + 0.15 * math.sin(t * math.pi)
    return {
        'saw_mix': saw_mix, 'pulse_width': pulse_width,
        'cutoff': cutoff_base, 'resonance': resonance,
        'attack': attack, 'decay': decay, 'sustain': sustain, 'release': release,
        'delay_time': delay_time, 'delay_fb': delay_fb, 'reverb_wet': reverb_wet,
    }

def gen_adsr_env(n_samples, attack_s, decay_s, sustain_l, release_s, note_dur_s):
    a = max(1, int(attack_s * SAMPLE_RATE))
    d = max(1, int(decay_s * SAMPLE_RATE))
    r = max(1, int(release_s * SAMPLE_RATE))
    env = []
    for i in range(n_samples):
        if i < a: v = i / a
        elif i < a + d: v = 1.0 - (i - a) / d * (1.0 - sustain_l)
        elif i < n_samples - r: v = sustain_l
        else: v = sustain_l * (n_samples - i) / r
        env.append(max(0, min(1, v)))
    return env

def gen_saw(n, freq, sample_rate):
    return [((t / sample_rate * freq) % 1.0) * 2 - 1 for t in range(n)]

def gen_pulse(n, freq, sample_rate, width=0.5):
    return [((t / sample_rate * freq) % 1.0 < width) * 2 - 1 for t in range(n)]

def lowpass_filter(signal, cutoff, q, sample_rate):
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / sample_rate
    alpha = dt / (rc + dt)
    boost = 1.0 + (q - 1.0) * 0.3
    out = [0.0] * len(signal)
    prev = 0.0
    for i, s in enumerate(signal):
        raw = alpha * s + (1 - alpha) * prev
        out[i] = prev + alpha * (raw - prev) * boost
        prev = out[i]
    mx = max(abs(x) for x in out) if out else 1.0
    if mx > 0.5: out = [x / (mx * 2) for x in out]
    return out

def gen_note(freq, params):
    n_samples = int((NOTE_DUR + params['release']) * SAMPLE_RATE)
    pw = params['pulse_width']
    saw = gen_saw(n_samples, freq, SAMPLE_RATE)
    pulse = gen_pulse(n_samples, freq, SAMPLE_RATE, pw)
    osc = [params['saw_mix'] * s + (1 - params['saw_mix']) * p for s, p in zip(saw, pulse)]
    filtered = lowpass_filter(osc, params['cutoff'], params['resonance'], SAMPLE_RATE)
    env = gen_adsr_env(n_samples, params['attack'], params['decay'],
                       params['sustain'], params['release'], NOTE_DUR)
    amplified = [f * e * 0.35 for f, e in zip(filtered, env)]
    return amplified, n_samples

def add_delay(signal, delay_samples, feedback):
    out = list(signal) + [0.0] * (delay_samples * 3)
    for i in range(delay_samples, len(out)):
        if i - delay_samples < len(signal): out[i] += feedback * out[i - delay_samples]
    tail = delay_samples * 2
    for i in range(len(out) - tail, len(out)):
        out[i] *= (len(out) - i) / tail
    return out

def add_reverb(signal, wet):
    out = list(signal)
    length = len(signal)
    delays = [int(SAMPLE_RATE * d) for d in [0.025, 0.045, 0.065, 0.085]]
    for d in delays:
        if d < length:
            fb = 0.4
            for i in range(d, length): out[i] += wet * 0.2 * (signal[i - d] * fb)
    mx = max(abs(x) for x in out) if out else 1.0
    if mx > 0.6: out = [x * 0.6 / mx for x in out]
    return out

# ─── BUILD AUDIO ─────────────────────────────────────────────
print(f"\nSynth chain: OSC → VCF → VCA → delay → reverb")

all_samples = []
for ci, (ch, idx, freq) in enumerate(notes):
    p = synth_params(idx)
    note_sig, n_samples = gen_note(freq, p)
    delay_samples = int(p['delay_time'] * SAMPLE_RATE)
    note_sig = add_delay(note_sig, delay_samples, p['delay_fb'])
    note_sig = add_reverb(note_sig, p['reverb_wet'])
    all_samples.extend([int(s * 32767) for s in note_sig])
    gap = int(SAMPLE_RATE * GAP)
    all_samples.extend([0] * gap)
    if ci % 20 == 0: print(f"  Note {ci}/{NUM_NOTES} ({ch}, idx={idx}, {freq:.0f} Hz)")

# Write WAV
OUTDIR = 'NPR_OS_sandbox/sutra_audio'
wav_path = os.path.join(OUTDIR, 'audio', '01_04_standard_synth.wav')
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
    for s in all_samples: f.write(struct.pack('<h', s))

print(f"\nWAV: {wav_path} ({data_size:,} bytes)")

# ─── MANDALA ─────────────────────────────────────────────────
# 1.4 visual: "the other assumes the form"
# → Mirror effect: main cursor + reflected echo
# → Sārūpya = "same form" → doubled mandala

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

    # 1.4 = sārūpya: mirror/echo structure
    # The mandala has TWO layers — original + reflection
    mirror_phase = 0.5 + 0.5 * math.sin(t * math.pi * 2 / DURATION)

    # Central axis line (the boundary between seer and seen)
    axis_alpha = 0.06 + 0.04 * mirror_phase
    draw.line([(cx, 50), (cx, H - 50)],
              fill=tuple(int(255 * axis_alpha) for _ in range(3)))

    # Hex structure at center (but split — two halves)
    for ring in range(1, 4):
        r = 30 * ring
        a = 0.1 + 0.08 * mirror_phase * (1 / ring)
        # Left half: warm tones
        draw.polygon([
            (cx + r * math.cos(theta), cy + r * math.sin(theta))
            for theta in [math.pi/6 * i for i in [0, 1, 2, 3]]
        ], outline=tuple(int(c * a) for c in (255, 180, 50)))
        # Right half: cool tones
        draw.polygon([
            (cx + r * math.cos(theta), cy + r * math.sin(theta))
            for theta in [math.pi/6 * i for i in [3, 4, 5, 0]]
        ], outline=tuple(int(c * a) for c in (50, 180, 255)))

    # Stored field: all notes as ring
    step = math.pi * 2 / len(notes)
    for i, (c, idx, freq) in enumerate(notes):
        angle = i * step
        radius = 160 + (freq / 1100) * 300
        x = int(cx + math.cos(angle) * radius)
        y = int(cy + math.sin(angle) * radius)
        draw.ellipse([x - 2, y - 2, x + 2, y + 2],
                      fill=tuple(int(c * 0.15) for c in idx_color(idx, 0.3)))

    # Current note — PRIMARY
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

    # Sārūpya: MIRROR — the "other" assumes same form
    # Reflection of current note across center
    m_angle = c_angle + math.pi
    mx_vis = int(cx + math.cos(m_angle) * c_radius)
    my_vis = int(cy + math.sin(m_angle) * c_radius)
    mirror_intensity = 0.3 + 0.4 * mirror_phase
    for sz in range(10, 0, -1):
        a = sz / 10 * 0.5 * mirror_intensity
        draw.ellipse([mx_vis - sz, my_vis - sz, mx_vis + sz, my_vis + sz],
                      outline=tuple(int(c * a) for c in (200, 150, 255)))
    draw.ellipse([mx_vis - 5, my_vis - 5, mx_vis + 5, my_vis + 5],
                  fill=tuple(int(c * mirror_intensity) for c in idx_color(cidx, mirror_intensity)))

    # Mandala arcs — dual layer (vṛtti + sārūpya)
    for i, (c, idx, freq) in enumerate(notes):
        angle = i * step + t * 0.03 * (freq / 550)
        radius = 120 + (freq / 1100) * 350 + math.sin(t * 2 + i) * 10

        # Layer 1: original vṛtti
        for g in range(max(4, int(20 * idx / 63))):
            ga = angle - step * 0.5 / 2 + step * 0.5 * g / max(4, int(20 * idx / 63))
            r = radius + random.gauss(0, 6)
            x = int(cx + math.cos(ga) * r)
            y = int(cy + math.sin(ga) * r)
            sz = max(1, int(3 * idx / 63))
            inten = 0.2 + 0.5 * (0.5 + 0.5 * math.sin(t * 2.5 + i * 0.7))
            draw.ellipse([x - sz, y - sz, x + sz, y + sz],
                          fill=tuple(int(c * inten) for c in idx_color(idx, inten)))

        # Layer 2: sārūpya echo (mirrored arc, fainter)
        if i % 2 == 0:
            echo_angle = -angle + t * 0.02
            echo_r = radius * 0.85
            ex = int(cx + math.cos(echo_angle) * echo_r)
            ey = int(cy + math.sin(echo_angle) * echo_r)
            draw.ellipse([ex - sz//2, ey - sz//2, ex + sz//2, ey + sz//2],
                          fill=tuple(int(c * inten * 0.3 * mirror_phase) for c in (150, 120, 200)))

    # Golden rings
    for rr in [120, 220, 320, 420]:
        a = 0.08 + 0.04 * math.sin(t + rr)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                      outline=tuple(int(c * a) for c in (255, 215, 0)))

    # Devanagari
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
FRAMEDIR = os.path.join(OUTDIR, 'frames_01_04_synth')
os.makedirs(FRAMEDIR, exist_ok=True)
total_frames = int(FPS * DURATION)
print(f"\nRendering {total_frames} frames...")
for fi in range(total_frames):
    draw(fi / FPS).save(os.path.join(FRAMEDIR, f'frame_{fi:04d}.png'))
    if fi % 100 == 0: print(f"  {fi}/{total_frames}")

print(f"\n=== Done ===")
print(f"WAV:    {wav_path}")
print(f"Frames: {FRAMEDIR}/")
mp4 = os.path.join(OUTDIR, 'mp4', '01_04_standard_synth.mp4')
os.makedirs(os.path.dirname(mp4), exist_ok=True)
print(f"""
ffmpeg -y -framerate 30 \\
  -i {FRAMEDIR}/frame_%04d.png \\
  -i {wav_path} \\
  -c:v libx264 -pix_fmt yuv420p -c:a aac \\
  {mp4}
""")
