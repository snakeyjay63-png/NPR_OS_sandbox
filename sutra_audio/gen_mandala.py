#!/usr/bin/env python3
"""Generate sand mandala video frames from phoneme data.

Sand mandala = NPR-OS in visual form:
- Every grain is an individual signal
- Together they form the field-pattern
- The mandala dissolves back into śūnya
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFont

# Fonts
DEVANAGARI_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", 52)
ENG_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", 28)
SMALL_FONT = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", 20)

# Text overlay
SUTRA_DEVANAGARI = "अथ योगानुशासनम्"
SUTRA_ROMAN = "atha yogānuśāsanam"
SUTRA_ENG = "Atha, the yoga-anuśāsanam."
SUTRA_ENG_NOTE = "The turning marks the beginning of yoga's discipline."

# Word-by-word gloss
GLYSS_WORDS = [
    ("atha", "the turning — not time, but direction"),
    ("yoga", "connection, integration, coherence"),
    ("anuśāsanam", "discipline, the structure that follows"),
]

# 8-color palette: 6 Gaṇa + vowels + anusvāra/visarga
COLORS = [
    (220, 20, 60),    # 0: crimson   - Gaṇa 1 (क ख ग घ ङ)
    (255, 140, 0),    # 1: orange    - Gaṇa 2 (च छ ज झ ञ)
    (255, 215, 0),    # 2: gold      - Gaṇa 3 (ट ठ ड ढ ण)
    (0, 191, 255),    # 3: sky blue  - Gaṇa 4 (त थ द ध न)
    (0, 128, 0),      # 4: green     - Gaṇa 5 (प फ ब भ म)
    (139, 0, 139),    # 5: purple    - Gaṇa 6 (श ष स ह ल व र य)
    (255, 105, 180),  # 6: pink      - vowels (अ आ इ ई उ ऊ)
    (180, 100, 255),  # 7: violet    - anusvāra/visarga (ं ः)
]

# Phoneme data for अथ योगानुशासनम्
phonemes = [
    {"char": "अ", "freq": 55,    "g": 6, "brightness": 0.3, "angle": 0},
    {"char": "थ", "freq": 523,   "g": 3, "brightness": 0.6, "angle": 45},
    {"char": "यो", "freq": 220,  "g": 5, "brightness": 1.0, "angle": 90},
    {"char": "गा", "freq": 165,  "g": 0, "brightness": 0.8, "angle": 135},
    {"char": "नु", "freq": 698,  "g": 3, "brightness": 0.5, "angle": 180},
    {"char": "शा", "freq": 349,  "g": 5, "brightness": 0.9, "angle": 225},
    {"char": "स", "freq": 440,   "g": 5, "brightness": 0.4, "angle": 270},
    {"char": "न", "freq": 698,   "g": 3, "brightness": 0.3, "angle": 315}
]

W, H = 1920, 1080
FPS = 30
DURATION = 21.8  # seconds
cx, cy = W // 2, H // 2

# Sand mandala parameters
MANDALA_RINGS = 4
RADIUS_STEP = 100
GRAINS_PER_PHONEME = 120  # grains forming each phoneme's arc


def draw_sand_mandala(t):
    """Draw a sand mandala frame at time t (seconds).
    
    Each phoneme is represented as a cluster of sand grains
    forming arcs around the center. The grains pulse and rotate
    according to the NPR cycle.
    """
    img = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Śūnya background - subtle field noise
    random.seed(int(t * 100))
    for _ in range(1500):
        nx = random.randint(0, W - 1)
        ny = random.randint(0, H - 1)
        noise_val = random.randint(3, 12)
        draw.point((nx, ny), fill=(noise_val, noise_val, noise_val))
    
    # Center glow - śūnya pulse
    sunya_pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / DURATION)
    
    # Draw sand grains for each phoneme
    for i, p in enumerate(phonemes):
        base_angle = math.radians(p["angle"])
        rot_speed = 0.1 * (1 if i % 2 == 0 else -1)
        angle = base_angle + t * rot_speed
        
        ring = (i // 2) + 1
        base_radius = ring * RADIUS_STEP
        radius = base_radius + math.sin(t * 2 + i) * 15
        
        c = COLORS[p["g"]]
        alpha = p["brightness"] * (0.5 + 0.5 * math.sin(t * 3 + i * 0.5))
        
        # Draw grain cluster for this phoneme
        for grain in range(GRAINS_PER_PHONEME):
            # Spread grains along an arc
            arc_spread = math.radians(30)  # 30-degree arc per phoneme
            grain_angle = angle - arc_spread/2 + (arc_spread * grain / GRAINS_PER_PHONEME)
            
            # Radial variation
            r_var = random.gauss(0, 8)
            r = radius + r_var
            
            x = int(cx + math.cos(grain_angle) * r)
            y = int(cy + math.sin(grain_angle) * r)
            
            # Grain size varies with brightness
            grain_size = max(1, int(2 * alpha * p["brightness"]))
            
            # Color intensity varies
            intensity = 0.5 + 0.5 * alpha
            color = tuple(int(ch * intensity) for ch in c)
            
            draw.ellipse(
                [x - grain_size, y - grain_size, 
                 x + grain_size, y + grain_size],
                fill=color
            )
    
    # Golden ring lines (subtle structure)
    for ring in range(1, MANDALA_RINGS + 1):
        radius = ring * RADIUS_STEP
        draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            outline=(255, 215, 0),  # faint gold
            width=1
        )
    
    # Anusvāra sub-bass resonance (end of sequence)
    # Same sand-grain logic as the rest, but bigger
    if t > DURATION * 0.8:
        anusvara_t = (t - DURATION * 0.8) / (DURATION * 0.2)
        anusvara_color = COLORS[7]  # violet
        
        # Scatter large sand grains in expanding ring
        num_anusvara = 200
        random.seed(int(t * 200))
        for g in range(num_anusvara):
            angle = random.uniform(0, math.pi * 2)
            r = 100 + random.gauss(0, 80) * anusvara_t
            
            x = int(cx + math.cos(angle) * r)
            y = int(cy + math.sin(angle) * r)
            
            grain_size = max(1, int(3 * anusvara_t))
            intensity = 0.3 + 0.7 * anusvara_t
            color = tuple(int(ch * intensity) for ch in anusvara_color)
            
            draw.ellipse(
                [x - grain_size, y - grain_size,
                 x + grain_size, y + grain_size],
                fill=color
            )
    
    # === SANSKRIT OVERLAY (minimal, center-top) ===
    # Fade in/out
    text_alpha = 1.0
    if t < 1.0:
        text_alpha = t / 1.0
    elif t > DURATION - 2.0:
        text_alpha = max(0, (DURATION - t) / 2.0)
    
    dev_text = SUTRA_DEVANAGARI
    dev_bbox = draw.textbbox((0, 0), dev_text, font=DEVANAGARI_FONT)
    dev_w = dev_bbox[2] - dev_bbox[0]
    draw.text(
        ((W - dev_w) / 2, 30),
        dev_text,
        fill=(255, 255, 255),
        font=DEVANAGARI_FONT
    )
    
    return img


# Generate frames
os.makedirs('NPR_OS_sandbox/sutra_audio/frames', exist_ok=True)

total_frames = int(FPS * DURATION)
print(f"Generating {total_frames} sand mandala frames...")

for frame_idx in range(total_frames):
    t = frame_idx / FPS
    img = draw_sand_mandala(t)
    img.save(f'NPR_OS_sandbox/sutra_audio/frames/frame_{frame_idx:04d}.png')
    
    if frame_idx % 100 == 0:
        print(f"Frame {frame_idx}/{total_frames}...")

print("Done!")
print("Now encode with ffmpeg:")
print("ffmpeg -y -framerate 30 \\")
print("  -i NPR_OS_sandbox/sutra_audio/frames/frame_%04d.png \\")
print("  -i NPR_OS_sandbox/sutra_audio/audio/01_01_atha_yoga.wav \\")
print("  -c:v libx264 -pix_fmt yuv420p -c:a aac \\")
print("  NPR_OS_sandbox/sutra_audio/mp4/01_01_atha_yoga.mp4")
