#!/usr/bin/env python3
"""Sūtra 1.3 — Standard text: तदा द्रष्टुः स्वरूपेऽवस्थानम्

tadā draṣṭuḥ svarūpe 'vasthānam
"Then the seer abides in its own nature."

Pipeline: Sanskrit → UTF-8 → Base64 → frequency + mandala
"""
import base64
import math
import struct
import os
import random
from PIL import Image, ImageDraw, ImageFont

# ─── STEP 1: Sanskrit → Base64 → Frequency ─────────────────

SUTRA = "तदा द्रष्टुः स्वरूपेऽवस्थानम्"
UTF8 = SUTRA.encode('utf-8')
B64 = base64.b64encode(UTF8).decode()

B64_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

def b64_to_freq(idx):
    """Map base64 index (0-63) to frequency 55-1100 Hz."""
    return 55 + idx * (1100 - 55) / 63

notes = []
for c in B64:
    idx = B64_ALPHA.index(c)
    if c == '=':
        notes.append((c, idx, 0))
    else:
        notes.append((c, idx, b64_to_freq(idx)))

real_notes = [(c, i, f) for c, i, f in notes if f > 0]
padding_chars = sum(1 for c in B64 if c == '=')
dr = sum(UTF8) % 9 or 9

print(f"=== Sūtra 1.3 (Standard) ===")
print(f"Sutra:    {SUTRA}")
print(f"UTF-8:    {len(UTF8)} bytes")
print(f"Base64:   {len(B64)} chars ({padding_chars} padding)")
print(f"Notes:    {len(real_notes)} real notes")
print(f"Freq:     {min(n[2] for n in real_notes):.0f}–{max(n[2] for n in real_notes):.0f} Hz")
print(f"Mean freq:{sum(n[2] for n in real_notes)/len(real_notes):.0f} Hz")
print(f"Digital root: {dr}")
print(f"Closure:  म् (closed) + {'=' * padding_chars} ({padding_chars} padding)")
print(f"Base64:   {B64}")

# ─── STEP 2: Generate Audio (WAV) ──────────────────────────

SAMPLE_RATE = 44100
NOTE_DURATION = 0.40  # seconds per note
GAP = 0.06
NUM_NOTES = len(real_notes)
TOTAL_DURATION = NUM_NOTES * (NOTE_DURATION + GAP)

print(f"\nGenerating audio: {NUM_NOTES} notes × {NOTE_DURATION}s = {TOTAL_DURATION:.1f}s")

samples = []
for c, idx, freq in real_notes:
    n_samples = int(SAMPLE_RATE * NOTE_DURATION)
    for t in range(n_samples):
        # Smooth attack/decay envelope
        env = min(t / 300, (n_samples - t) / 300, 1.0)
        # Fundamental + harmonics
        sample = env * 0.35 * math.sin(2 * math.pi * freq * t / SAMPLE_RATE)
        sample += env * 0.15 * math.sin(2 * math.pi * freq * 2 * t / SAMPLE_RATE)
        sample += env * 0.05 * math.sin(2 * math.pi * freq * 3 * t / SAMPLE_RATE)
        samples.append(int(sample * 32767))
    # Gap (silence)
    gap_samples = int(SAMPLE_RATE * GAP)
    samples.extend([0] * gap_samples)

# Write WAV
OUTDIR = 'NPR_OS_sandbox/sutra_audio'
AUDIODIR = os.path.join(OUTDIR, 'audio')
os.makedirs(AUDIODIR, exist_ok=True)
wav_path = os.path.join(AUDIODIR, '01_03_standard.wav')

with open(wav_path, 'wb') as f:
    data_size = len(samples) * 2
    f.write(b'RIFF')
    f.write(struct.pack('<I', 36 + data_size))
    f.write(b'WAVE')
    f.write(b'fmt ')
    f.write(struct.pack('<I', 16))
    f.write(struct.pack('<H', 1))  # PCM
    f.write(struct.pack('<H', 1))  # mono
    f.write(struct.pack('<I', SAMPLE_RATE))
    f.write(struct.pack('<I', SAMPLE_RATE * 2))
    f.write(struct.pack('<H', 2))
    f.write(struct.pack('<H', 16))
    f.write(b'data')
    f.write(struct.pack('<I', data_size))
    for s in samples:
        f.write(struct.pack('<h', s))

print(f"WAV: {wav_path} ({data_size:,} bytes)")

# ─── STEP 3: Mandala Video Frames ──────────────────────────

W, H = 1920, 1080
FPS = 30
DURATION = TOTAL_DURATION + 2  # fade buffer
cx, cy = W // 2, H // 2

def idx_to_color(idx, intensity=1.0):
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

# Fonts
DEV_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", 48)
B64_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf", 18)
SMALL_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", 16)

def draw_mandala(t):
    img = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Śūnya background noise
    random.seed(int(t * 100))
    for _ in range(800):
        draw.point((random.randint(0, W - 1), random.randint(0, H - 1)),
                    fill=(random.randint(1, 6),) * 3)

    # Center glow
    pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / DURATION)
    for r in range(50, 0, -1):
        a = r / 50 * 0.2 * pulse
        draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                      outline=tuple(int(c * a) for c in (255, 215, 0)))

    # Base64 arcs
    num_real = len(real_notes)
    step = math.pi * 2 / num_real
    for i, (c, idx, freq) in enumerate(real_notes):
        angle = i * step + t * 0.05 * (freq / 550)
        radius = 100 + (freq / 1100) * 300 + math.sin(t * 2 + i) * 12
        gc = idx_to_color(idx)
        for g in range(max(8, int(25 * idx / 63))):
            ga = angle - step * 0.6 / 2 + step * 0.6 * g / max(8, int(25 * idx / 63))
            r = radius + random.gauss(0, 6)
            x = int(cx + math.cos(ga) * r)
            y = int(cy + math.sin(ga) * r)
            sz = max(1, int(3 * idx / 63))
            inten = 0.4 + 0.6 * (0.5 + 0.5 * math.sin(t * 3 + i * 0.7))
            draw.ellipse([x - sz, y - sz, x + sz, y + sz],
                          fill=idx_to_color(idx, inten))

    # Golden structural rings
    for rr in [100, 200, 300, 400]:
        a = 0.1 + 0.08 * math.sin(t + rr)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                      outline=tuple(int(c * a) for c in (255, 215, 0)))

    # ─── Text: Devanagari top ──────────────────────────────
    alpha = 1.0
    if t < 1.0:
        alpha = t / 1.0
    elif t > DURATION - 2.0:
        alpha = max(0, (DURATION - t) / 2.0)

    dev = SUTRA
    bw = draw.textbbox((0, 0), dev, font=DEV_FONT)
    tw = bw[2] - bw[0]
    # Glow
    for gw in range(3, 0, -1):
        draw.text(((W - tw) / 2 - gw, 30 - gw), dev,
                    fill=tuple(int(c * 0.12) for c in (255, 215, 0)),
                    font=DEV_FONT)
    draw.text(((W - tw) / 2, 30), dev,
              fill=(int(255 * alpha), int(255 * alpha), int(255 * alpha)),
              font=DEV_FONT)

    # ─── Bottom panel ──────────────────────────────────────
    PANEL_H = 110
    py = H - PANEL_H
    draw.rectangle([0, py, W, H], fill=(10, 10, 15))
    draw.line([(0, py), (W, py)], fill=(255, 215, 0), width=2)

    # Base64 string
    b64t = B64
    bb = draw.textbbox((0, 0), b64t, font=B64_FONT)
    bw2 = bb[2] - bb[0]
    fc = tuple(int(c * alpha) for c in (255, 215, 0))
    draw.text(((W - bw2) / 2, py + 8), b64t, fill=fc, font=B64_FONT)

    # Roman transliteration
    roman = "tadā draṣṭuḥ svarūpe 'vasthānam"
    rb = draw.textbbox((0, 0), roman, font=SMALL_FONT)
    rw = rb[2] - rb[0]
    fc2 = tuple(int(c * alpha * 0.8) for c in (220, 220, 220))
    draw.text(((W - rw) / 2, py + 32), roman, fill=fc2, font=SMALL_FONT)

    # English
    eng = "Then the seer abides in its own nature."
    eb = draw.textbbox((0, 0), eng, font=SMALL_FONT)
    ew = eb[2] - eb[0]
    fc3 = tuple(int(c * alpha * 0.7) for c in (200, 180, 140))
    draw.text(((W - ew) / 2, py + 56), eng, fill=fc3, font=SMALL_FONT)

    # Byte math
    math_t = (f"bytes: {len(UTF8)}  →  base64: {len(B64)}  →  "
              f"notes: {len(real_notes)}  →  DR: {dr}  →  closure: म् + {'=' * padding_chars}")
    mb = draw.textbbox((0, 0), math_t, font=SMALL_FONT)
    mw = mb[2] - mb[0]
    fc4 = tuple(int(c * alpha * 0.4) for c in (140, 140, 160))
    draw.text(((W - mw) / 2, py + 80), math_t, fill=fc4, font=SMALL_FONT)

    return img


# ─── RENDER ──────────────────────────────────────────────────

FRAMEDIR = os.path.join(OUTDIR, 'frames_01_03')
os.makedirs(FRAMEDIR, exist_ok=True)

total_frames = int(FPS * DURATION)
print(f"\nRendering {total_frames} mandala frames...")
for frame_idx in range(total_frames):
    t = frame_idx / FPS
    draw_mandala(t).save(os.path.join(FRAMEDIR, f'frame_{frame_idx:04d}.png'))
    if frame_idx % 100 == 0:
        print(f"  {frame_idx}/{total_frames}")

print(f"\n=== Done ===")
print(f"WAV:  {wav_path}")
print(f"Frames: {FRAMEDIR}/")
print(f"\nEncode with ffmpeg:")
mp4_out = os.path.join(OUTDIR, 'mp4', '01_03_standard.mp4')
os.makedirs(os.path.dirname(mp4_out), exist_ok=True)
print(f"""
ffmpeg -y -framerate 30 \\
  -i {FRAMEDIR}/frame_%04d.png \\
  -i {wav_path} \\
  -c:v libx264 -pix_fmt yuv420p -c:a aac \\
  {mp4_out}
""")
