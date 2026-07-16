#!/usr/bin/env python3
"""Pure base64 mandala — no text panel. Only Devanagari top center."""
import base64, math, os, random
from PIL import Image, ImageDraw, ImageFont

# ─── Sutra → Base64 → Frequency ─────────────────────────────
SUTRA = "अथ योगानुशासनम्"
UTF8 = SUTRA.encode('utf-8')
B64 = base64.b64encode(UTF8).decode()
B64_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

real_notes = []
for c in B64:
    idx = B64_ALPHA.index(c)
    if c != '=':
        freq = 55 + idx * (1100 - 55) / 63
        real_notes.append((c, idx, freq))

# ─── Params ──────────────────────────────────────────────────
W, H = 1920, 1080
FPS = 30
NOTE_DUR = 0.35
DURATION = len(real_notes) * NOTE_DUR + 2
cx, cy = W // 2, H // 2

# ─── Colors ──────────────────────────────────────────────────
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

# ─── Fonts ───────────────────────────────────────────────────
DEV_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", 56)

def draw(t):
    img = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Śūnya noise
    random.seed(int(t * 100))
    for _ in range(800):
        draw.point((random.randint(0,W-1), random.randint(0,H-1)),
                   fill=(random.randint(1,6),)*3)
    
    # Center glow
    pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / DURATION)
    for r in range(60, 0, -1):
        a = r/60 * 0.2 * pulse
        draw.ellipse([cx-r, cy-r, cx+r, cy+r],
                     outline=tuple(int(c*a) for c in (255,215,0)))
    
    # Base64 arcs
    num = len(real_notes)
    step = math.pi * 2 / num
    for i, (c, idx, freq) in enumerate(real_notes):
        angle = i * step + t * 0.05 * (freq / 550)
        radius = 100 + (freq / 1100) * 300 + math.sin(t*2 + i) * 12
        gc = idx_color(idx)
        for g in range(max(8, int(25 * idx / 63))):
            ga = angle - step*0.6/2 + step*0.6*g/max(8,int(25*idx/63))
            r = radius + random.gauss(0, 6)
            x = int(cx + math.cos(ga) * r)
            y = int(cy + math.sin(ga) * r)
            sz = max(1, int(3 * idx / 63))
            inten = 0.4 + 0.6*(0.5 + 0.5*math.sin(t*3 + i*0.7))
            draw.ellipse([x-sz, y-sz, x+sz, y+sz], fill=idx_color(idx, inten))
    
    # Golden rings
    for rr in [100, 200, 300, 400]:
        a = 0.1 + 0.08*math.sin(t + rr)
        draw.ellipse([cx-rr, cy-rr, cx+rr, cy+rr],
                     outline=tuple(int(c*a) for c in (255,215,0)))
    
    # Devanagari top center
    alpha = 1.0
    if t < 1.0: alpha = t
    elif t > DURATION - 2: alpha = max(0, (DURATION - t) / 2)
    
    dev = SUTRA
    bw = draw.textbbox((0,0), dev, font=DEV_FONT)
    tw = bw[2] - bw[0]
    
    # Glow
    for gw in range(3, 0, -1):
        draw.text(((W-tw)/2-gw, 30-gw), dev,
                 fill=tuple(int(c*0.12) for c in (255,215,0)), font=DEV_FONT)
    draw.text(((W-tw)/2, 30), dev,
             fill=(int(255*alpha), int(255*alpha), int(255*alpha)), font=DEV_FONT)
    
    return img

# ─── Render ──────────────────────────────────────────────────
os.makedirs('NPR_OS_sandbox/sutra_audio/frames_pure', exist_ok=True)
frames = int(FPS * DURATION)
print(f"Rendering {frames} frames...")
for i in range(frames):
    draw(i/FPS).save(f'NPR_OS_sandbox/sutra_audio/frames_pure/frame_{i:04d}.png')
    if i % 100 == 0: print(f"  {i}/{frames}")

print(f"""
ffmpeg -y -framerate 30 \\
  -i NPR_OS_sandbox/sutra_audio/frames_pure/frame_%04d.png \\
  -i NPR_OS_sandbox/sutra_audio/audio/01_01_b64_direct.wav \\
  -c:v libx264 -pix_fmt yuv420p -c:a aac \\
  NPR_OS_sandbox/sutra_audio/mp4/01_01_b64_pure.mp4
""")
