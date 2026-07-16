#!/usr/bin/env python3
"""Pure base64 mandala — Sūtra 1.2: योगश्चित्तवृत्तिनिरोधः"""
import base64, math, os, struct, random
from PIL import Image, ImageDraw, ImageFont

# ─── Sutra → Base64 → Frequency ─────────────────────────────
SUTRA = "योगश्चित्तवृत्तिनिरोधः"
UTF8 = SUTRA.encode('utf-8')
B64 = base64.b64encode(UTF8).decode()
B64_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

real_notes = []
for c in B64:
    idx = B64_ALPHA.index(c)
    if c != '=':
        freq = 55 + idx * (1100 - 55) / 63
        real_notes.append((c, idx, freq))

print(f"Sutra: {SUTRA}")
print(f"Base64: {B64}")
print(f"Notes: {len(real_notes)} | Range: {min(n[2] for n in real_notes):.0f}–{max(n[2] for n in real_notes):.0f} Hz")

# ─── Audio ───────────────────────────────────────────────────
SAMPLE_RATE = 44100
NOTE_DUR = 0.30
samples = []
for c, idx, freq in real_notes:
    ns = int(SAMPLE_RATE * NOTE_DUR)
    for t in range(ns):
        env = min(t/500, (ns-t)/500, 1.0)
        samples.append(int(env * 0.5 * math.sin(2*math.pi*freq*t/SAMPLE_RATE) * 32767))

os.makedirs('NPR_OS_sandbox/sutra_audio/audio', exist_ok=True)
wav_path = 'NPR_OS_sandbox/sutra_audio/audio/01_02_b64_direct.wav'
data_size = len(samples) * 2
with open(wav_path, 'wb') as f:
    f.write(b'RIFF'); f.write(struct.pack('<I', 36 + data_size)); f.write(b'WAVE')
    f.write(b'fmt '); f.write(struct.pack('<I', 16))
    f.write(struct.pack('<HHIIHH', 1, 1, SAMPLE_RATE, SAMPLE_RATE*2, 2, 16))
    f.write(b'data'); f.write(struct.pack('<I', data_size))
    for s in samples: f.write(struct.pack('<h', s))
print(f"WAV: {data_size:,} bytes")

# ─── Visual ──────────────────────────────────────────────────
W, H = 1920, 1080
FPS = 30
DURATION = len(real_notes) * NOTE_DUR + 2
cx, cy = W // 2, H // 2

def idx_color(idx, intensity=1.0):
    hue = (idx / 63) * 360
    s, l = 0.85, 0.5
    cv = (1 - abs(2*l - 1)) * s
    x = cv * (1 - abs((hue/60) % 2 - 1))
    m = l - cv/2
    if hue < 60: r1,g1,b1 = cv,x,0
    elif hue < 120: r1,g1,b1 = x,cv,0
    elif hue < 180: r1,g1,b1 = 0,cv,x
    elif hue < 240: r1,g1,b1 = 0,x,cv
    elif hue < 300: r1,g1,b1 = x,0,cv
    else: r1,g1,b1 = cv,0,x
    return tuple(max(0,min(255,int((v+m)*255*intensity))) for v in (r1,g1,b1))

DEV_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", 52)

def draw(t):
    img = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    
    # Śūnya noise
    random.seed(int(t * 100))
    for _ in range(800):
        d.point((random.randint(0,W-1), random.randint(0,H-1)), fill=(random.randint(1,6),)*3)
    
    # Center glow
    pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / DURATION)
    for r in range(60, 0, -1):
        a = r/60 * 0.2 * pulse
        d.ellipse([cx-r, cy-r, cx+r, cy+r], outline=tuple(int(c*a) for c in (255,215,0)))
    
    # Base64 arcs
    num = len(real_notes)
    step = math.pi * 2 / num
    for i, (c, idx, freq) in enumerate(real_notes):
        angle = i * step + t * 0.05 * (freq / 550)
        radius = 100 + (freq / 1100) * 300 + math.sin(t*2 + i) * 12
        for g in range(max(6, int(20 * idx / 63))):
            ga = angle - step*0.5/2 + step*0.5*g/max(6,int(20*idx/63))
            r = radius + random.gauss(0, 6)
            x = int(cx + math.cos(ga) * r)
            y = int(cy + math.sin(ga) * r)
            sz = max(1, int(3 * idx / 63))
            inten = 0.4 + 0.6*(0.5 + 0.5*math.sin(t*3 + i*0.7))
            d.ellipse([x-sz, y-sz, x+sz, y+sz], fill=idx_color(idx, inten))
    
    # Golden rings
    for rr in [100, 200, 300, 400]:
        a = 0.1 + 0.08*math.sin(t + rr)
        d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], outline=tuple(int(c*a) for c in (255,215,0)))
    
    # Devanagari top center
    alpha = 1.0
    if t < 1.0: alpha = t
    elif t > DURATION - 2: alpha = max(0, (DURATION - t) / 2)
    
    dev = SUTRA
    bw = d.textbbox((0,0), dev, font=DEV_FONT)
    tw = bw[2] - bw[0]
    for gw in range(3, 0, -1):
        d.text(((W-tw)/2-gw, 30-gw), dev, fill=tuple(int(c*0.12) for c in (255,215,0)), font=DEV_FONT)
    d.text(((W-tw)/2, 30), dev, fill=(int(255*alpha), int(255*alpha), int(255*alpha)), font=DEV_FONT)
    
    return img

# ─── Render ──────────────────────────────────────────────────
os.makedirs('NPR_OS_sandbox/sutra_audio/frames_1_2', exist_ok=True)
frames = int(FPS * DURATION)
print(f"Rendering {frames} frames...")
for i in range(frames):
    draw(i/FPS).save(f'NPR_OS_sandbox/sutra_audio/frames_1_2/frame_{i:04d}.png')
    if i % 100 == 0: print(f"  {i}/{frames}")
print("Done")
