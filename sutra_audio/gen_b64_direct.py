#!/usr/bin/env python3
"""Direct Sanskrit → UTF-8 → Base64 → Sound + Image.

No intermediate mapping. The base64 IS the frequency.
The base64 IS the image.
The base64 IS the mandala.
"""
import base64
import math
import struct
import os
import random
from PIL import Image, ImageDraw, ImageFont

# ─── STEP 1: Sanskrit → Base64 → Frequency ───────────────────

SUTRA = "अथ योगानुशासनम्"
UTF8 = SUTRA.encode('utf-8')
B64 = base64.b64encode(UTF8).decode()

B64_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

def b64_to_freq(idx):
    """Map base64 index (0-63) to frequency 55-1100 Hz."""
    return 55 + idx * (1100 - 55) / 63

# Build the note sequence
notes = []
for c in B64:
    idx = B64_ALPHA.index(c)
    if c == '=':
        notes.append((c, idx, 0))  # padding = silence
    else:
        notes.append((c, idx, b64_to_freq(idx)))

real_notes = [(c, i, f) for c, i, f in notes if f > 0]
print(f"Sutra: {SUTRA}")
print(f"Base64: {B64}")
print(f"Notes: {len(real_notes)} | Range: {min(n[2] for n in real_notes):.0f}-{max(n[2] for n in real_notes):.0f} Hz")

# ─── STEP 2: Generate Audio (WAV) ────────────────────────────

SAMPLE_RATE = 44100
NOTE_DURATION = 0.35  # seconds per note
NUM_NOTES = len(real_notes)
TOTAL_DURATION = NUM_NOTES * NOTE_DURATION

print(f"\nGenerating audio: {NUM_NOTES} notes × {NOTE_DURATION}s = {TOTAL_DURATION:.1f}s")

samples = []
for c, idx, freq in real_notes:
    n_samples = int(SAMPLE_RATE * NOTE_DURATION)
    for t in range(n_samples):
        # Smooth envelope
        env = min(t / 500, (n_samples - t) / 500, 1.0)
        # Sine wave
        sample = env * 0.5 * math.sin(2 * math.pi * freq * t / SAMPLE_RATE)
        samples.append(int(sample * 32767))

# Write WAV
os.makedirs('NPR_OS_sandbox/sutra_audio/audio', exist_ok=True)
wav_path = 'NPR_OS_sandbox/sutra_audio/audio/01_01_b64_direct.wav'

with open(wav_path, 'wb') as f:
    # RIFF header
    data_size = len(samples) * 2
    f.write(b'RIFF')
    f.write(struct.pack('<I', 36 + data_size))
    f.write(b'WAVE')
    # fmt chunk
    f.write(b'fmt ')
    f.write(struct.pack('<I', 16))
    f.write(struct.pack('<H', 1))  # PCM
    f.write(struct.pack('<H', 1))  # mono
    f.write(struct.pack('<I', SAMPLE_RATE))
    f.write(struct.pack('<I', SAMPLE_RATE * 2))
    f.write(struct.pack('<H', 2))
    f.write(struct.pack('<H', 16))
    # data chunk
    f.write(b'data')
    f.write(struct.pack('<I', data_size))
    for s in samples:
        f.write(struct.pack('<h', s))

print(f"WAV written: {wav_path} ({data_size:,} bytes)")

# ─── STEP 3: Generate Visual (Base64 Mandala) ────────────────

W, H = 1920, 1080
FPS = 30
DURATION = TOTAL_DURATION + 2  # extra fade
cx = W // 2
cy = H // 2  # full center — no text panel

# Color from base64 index
def idx_to_color(idx, intensity=1.0):
    """Map base64 index to color. 0-63 → hue."""
    hue = (idx / 63) * 360
    # HSL to RGB
    s, l = 0.85, 0.5
    c_val = (1 - abs(2 * l - 1)) * s
    x = c_val * (1 - abs((hue / 60) % 2 - 1))
    m = l - c_val / 2
    
    if hue < 60:
        r1, g1, b1 = c_val, x, 0
    elif hue < 120:
        r1, g1, b1 = x, c_val, 0
    elif hue < 180:
        r1, g1, b1 = 0, c_val, x
    elif hue < 240:
        r1, g1, b1 = 0, x, c_val
    elif hue < 300:
        r1, g1, b1 = x, 0, c_val
    else:
        r1, g1, b1 = c_val, 0, x
    
    r = int((r1 + m) * 255 * intensity)
    g = int((g1 + m) * 255 * intensity)
    b = int((b1 + m) * 255 * intensity)
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))

# Fonts
DEVANAGARI_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", 48)
B64_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf", 22)
SMALL_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", 18)

def draw_b64_mandala(t):
    """Draw mandala where each base64 char is a sand-grain arc."""
    img = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Śūnya background
    random.seed(int(t * 100))
    for _ in range(1000):
        nx = random.randint(0, W - 1)
        ny = random.randint(0, H - 1)
        nv = random.randint(2, 8)
        draw.point((nx, ny), fill=(nv, nv, nv))
    
    # Center glow
    pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / TOTAL_DURATION)
    glow_r = int(40 + 20 * pulse)
    for r in range(glow_r, 0, -1):
        alpha = r / glow_r * 0.3
        color = tuple(int(c * alpha) for c in (255, 215, 0))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color)
    
    # Each base64 char → arc of grains
    num_real = len(real_notes)
    angle_step = math.pi * 2 / num_real
    
    for i, (c, idx, freq) in enumerate(real_notes):
        # Base angle
        base_angle = i * angle_step
        # Slow rotation based on frequency
        rot = t * 0.05 * (freq / 550)
        angle = base_angle + rot
        
        # Radius from frequency (higher freq = further out)
        radius = 80 + (freq / 1100) * 250
        radius += math.sin(t * 2 + i) * 10
        
        color = idx_to_color(idx)
        
        # Grain count proportional to index
        grain_count = max(10, int(30 * idx / 63))
        arc_spread = angle_step * 0.7
        
        for g in range(grain_count):
            ga = angle - arc_spread/2 + arc_spread * g / grain_count
            r_var = random.gauss(0, 5)
            r = radius + r_var
            
            x = int(cx + math.cos(ga) * r)
            y = int(cy + math.sin(ga) * r)
            
            size = max(1, int(3 * (idx / 63)))
            intensity = 0.4 + 0.6 * (0.5 + 0.5 * math.sin(t * 3 + i * 0.7))
            
            gc = idx_to_color(idx, intensity)
            draw.ellipse([x - size, y - size, x + size, y + size], fill=gc)
    
    # Golden structural rings
    for ring_r in [80, 180, 280, 380]:
        alpha = 0.15 + 0.1 * math.sin(t + ring_r)
        ring_color = tuple(int(c * alpha) for c in (255, 215, 0))
        draw.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                    outline=ring_color, width=1)
    
    # ─── Devanagari text (top center) ───────────────────────
    text_alpha = 1.0
    if t < 1.0:
        text_alpha = t / 1.0
    elif t > DURATION - 2.0:
        text_alpha = max(0, (DURATION - t) / 2.0)
    
    dev_text = SUTRA
    dev_bbox = draw.textbbox((0, 0), dev_text, font=DEVANAGARI_FONT)
    dev_w = dev_bbox[2] - dev_bbox[0]
    
    # Glow behind text
    for glow_w in range(4, 0, -1):
        glow_c = tuple(int(c * 0.15) for c in (255, 215, 0))
        draw.text(((W - dev_w) / 2 - glow_w, 20 - glow_w),
                 dev_text, fill=glow_c, font=DEVANAGARI_FONT)
    
    draw.text(
        ((W - dev_w) / 2, 20),
        dev_text,
        fill=(255, 255, 255),
        font=DEVANAGARI_FONT
    )
    
    # ─── Bottom text panel ──────────────────────────────────
    panel_y = H - TEXT_PANEL_H
    
    # Panel background
    draw.rectangle([0, panel_y, W, H], fill=(10, 10, 15))
    
    # Gold separator
    draw.line([(0, panel_y), (W, panel_y)], fill=(255, 215, 0), width=2)
    
    # Base64 string (the direct translation)
    b64_text = B64
    b64_bbox = draw.textbbox((0, 0), b64_text, font=B64_FONT)
    b64_w = b64_bbox[2] - b64_bbox[0]
    fill_b64 = tuple(int(c * text_alpha) for c in (255, 215, 0))
    draw.text(((W - b64_w) / 2, panel_y + 8), b64_text, fill=fill_b64, font=B64_FONT)
    
    # Roman transliteration
    roman = "atha yogānuśāsanam"
    r_bbox = draw.textbbox((0, 0), roman, font=SMALL_FONT)
    r_w = r_bbox[2] - r_bbox[0]
    fill_r = tuple(int(c * text_alpha * 0.8) for c in (220, 220, 220))
    draw.text(((W - r_w) / 2, panel_y + 40), roman, fill=fill_r, font=SMALL_FONT)
    
    # English
    eng = "Atha — the yoga-anuśāsanam."
    e_bbox = draw.textbbox((0, 0), eng, font=SMALL_FONT)
    e_w = e_bbox[2] - e_bbox[0]
    fill_e = tuple(int(c * text_alpha * 0.7) for c in (200, 180, 140))
    draw.text(((W - e_w) / 2, panel_y + 65), eng, fill=fill_e, font=SMALL_FONT)
    
    # Gloss
    gloss = "atha: the turning point  |  yoga: connection  |  anuśāsanam: discipline"
    g_bbox = draw.textbbox((0, 0), gloss, font=SMALL_FONT)
    g_w = g_bbox[2] - g_bbox[0]
    fill_g = tuple(int(c * text_alpha * 0.5) for c in (180, 160, 120))
    draw.text(((W - g_w) / 2, panel_y + 90), gloss, fill=fill_g, font=SMALL_FONT)
    
    # Byte math
    math_text = f"bytes: {len(UTF8)}  →  base64: {len(B64)}  →  notes: {len(real_notes)}  →  DR: {sum(UTF8) % 9 or 9}"
    m_bbox = draw.textbbox((0, 0), math_text, font=SMALL_FONT)
    m_w = m_bbox[2] - m_bbox[0]
    fill_m = tuple(int(c * text_alpha * 0.4) for c in (140, 140, 160))
    draw.text(((W - m_w) / 2, panel_y + 115), math_text, fill=fill_m, font=SMALL_FONT)
    
    return img


# ─── GENERATE ────────────────────────────────────────────────

os.makedirs('NPR_OS_sandbox/sutra_audio/frames_b64', exist_ok=True)
os.makedirs('NPR_OS_sandbox/sutra_audio/mp4', exist_ok=True)

total_frames = int(FPS * DURATION)
print(f"\nGenerating {total_frames} base64 mandala frames...")

for frame_idx in range(total_frames):
    t = frame_idx / FPS
    img = draw_b64_mandala(t)
    img.save(f'NPR_OS_sandbox/sutra_audio/frames_b64/frame_{frame_idx:04d}.png')
    
    if frame_idx % 100 == 0:
        print(f"  Frame {frame_idx}/{total_frames}...")

print("Done! Encode:")
print(f"""
ffmpeg -y -framerate 30 \\
  -i NPR_OS_sandbox/sutra_audio/frames_b64/frame_%04d.png \\
  -i NPR_OS_sandbox/sutra_audio/audio/01_01_b64_direct.wav \\
  -c:v libx264 -pix_fmt yuv420p -c:a aac \\
  NPR_OS_sandbox/sutra_audio/mp4/01_01_b64_direct.mp4
""")
