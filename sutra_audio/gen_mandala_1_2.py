#!/usr/bin/env python3
"""Generate mandala frames for Sūtra 1.2: योगश्चित्तवृत्तिनिरोधः"""

import math
import os
from PIL import Image, ImageDraw

# Sūtra 1.2 phoneme data
phonemes = [
    {"char": "यो", "freq": 330, "g": 3, "brightness": 0.9, "angle": 90},
    {"char": "गा", "freq": 110, "g": 1, "brightness": 0.7, "angle": 180},
    {"char": "श्", "freq": 275, "g": 5, "brightness": 0.8, "angle": 270},
    {"char": "चि", "freq": 165, "g": 2, "brightness": 0.6, "angle": 0},
    {"char": "त्त", "freq": 220, "g": 3, "brightness": 1.0, "angle": 45},
    {"char": "वृ", "freq": 440, "g": 5, "brightness": 0.85, "angle": 135},
    {"char": "ति", "freq": 220, "g": 3, "brightness": 0.6, "angle": 225},
    {"char": "नि", "freq": 220, "g": 4, "brightness": 0.7, "angle": 315},
    {"char": "रो", "freq": 55,  "g": 1, "brightness": 0.5, "angle": 60},
    {"char": "धः", "freq": 110, "g": 1, "brightness": 0.9, "angle": 150},
]

# 8-color palette: 6 Gaṇa + vowels + anusvāra/visarga
COLORS = [
    (220, 20, 60),    # 0: crimson   - Gaṇa 1
    (255, 140, 0),    # 1: orange    - Gaṇa 2
    (255, 215, 0),    # 2: gold      - Gaṇa 3
    (0, 191, 255),    # 3: sky blue  - Gaṇa 4
    (0, 128, 0),      # 4: green     - Gaṇa 5
    (139, 0, 139),    # 5: purple    - Gaṇa 6
    (255, 105, 180),  # 6: pink      - vowels
    (180, 100, 255),  # 7: violet    - anusvāra/visarga
]

colors = {i: c for i, c in enumerate(COLORS)}

W, H = 1920, 1080
cx, cy = W // 2, H // 2
DURATION = 23  # seconds
FPS = 30
TOTAL_FRAMES = int(DURATION * FPS)

FRAMES_DIR = os.path.join(os.path.dirname(__file__), "frames_1_2")
os.makedirs(FRAMES_DIR, exist_ok=True)


def draw_frame(t):
    """Draw a single mandala frame at time t (seconds)."""
    img = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Śūnya background - subtle noise field
    import random
    random.seed(int(t * 100))
    for _ in range(2000):
        nx = random.randint(0, W - 1)
        ny = random.randint(0, H - 1)
        noise_val = random.randint(5, 15)
        draw.point((nx, ny), fill=(noise_val, noise_val, noise_val))

    # Śūnya center glow
    sunya_pulse = 0.5 + 0.5 * math.sin(t * math.pi * 2 / DURATION)
    for r in range(200, 0, -10):
        alpha_val = int(30 * sunya_pulse * (r / 200))
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(20, 20, 40, alpha_val)
        )

    # Draw mandala rings
    for ring in range(1, 5):
        radius = ring * 120
        draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            outline=(255, 215, 0),
            width=1
        )

    # Draw phoneme particles
    for i, p in enumerate(phonemes):
        base_angle = math.radians(p["angle"])
        rot_speed = 0.1 * (1 if i % 2 == 0 else -1)
        angle = base_angle + t * rot_speed

        ring = (i // 2) + 1
        radius = ring * 120 + math.sin(t * 2 + i) * 20

        x = cx + math.cos(angle) * radius
        y = cy + math.sin(angle) * radius

        c = colors[p["g"]]
        size = 3 + int(p["brightness"] * 4)

        # Core pixel
        draw.ellipse(
            [x - size, y - size, x + size, y + size],
            fill=c
        )

        # Character-specific geometry
        char_code = ord(p["char"][0])
        for j in range(3):
            angle_offset = (char_code * 0.1 + j * 2) % (math.pi * 2)
            r_offset = 10 + j * 5
            gx = x + math.cos(angle_offset) * r_offset
            gy = y + math.sin(angle_offset) * r_offset
            draw.ellipse(
                [gx - 2, gy - 2, gx + 2, gy + 2],
                fill=c
            )

        # Connect to center
        draw.line([(cx, cy), (x, y)], fill=(255, 215, 0), width=1)

    # Visarga (ः) final release - sand grains like the rest, bigger
    if t > DURATION * 0.8:
        visarga_t = (t - DURATION * 0.8) / (DURATION * 0.2)
        visarga_color = COLORS[7]  # violet
        
        num_visarga = 200
        import random
        random.seed(int(t * 200))
        for g in range(num_visarga):
            angle = random.uniform(0, math.pi * 2)
            r = 100 + random.gauss(0, 80) * visarga_t
            
            x = int(cx + math.cos(angle) * r)
            y = int(cy + math.sin(angle) * r)
            
            grain_size = max(1, int(3 * visarga_t))
            intensity = 0.3 + 0.7 * visarga_t
            color = tuple(int(ch * intensity) for ch in visarga_color)
            
            draw.ellipse(
                [x - grain_size, y - grain_size,
                 x + grain_size, y + grain_size],
                fill=color
            )
    
    return img


# Generate frames
print(f"Generating {TOTAL_FRAMES} frames...")
for frame in range(TOTAL_FRAMES):
    t = frame / FPS
    img = draw_frame(t)
    img.save(os.path.join(FRAMES_DIR, f"frame_{frame:04d}.png"))
    if (frame + 1) % 100 == 0:
        print(f"  Frame {frame + 1}/{TOTAL_FRAMES}")

print(f"Frames saved to: {FRAMES_DIR}")

# Encode with ffmpeg
audio_path = os.path.join(os.path.dirname(__file__), "audio", "01_02_yoga_chitta.wav")
mp4_path = os.path.join(os.path.dirname(__file__), "mp4", "01_02_yoga_chitta.mp4")
os.makedirs(os.path.dirname(mp4_path), exist_ok=True)

cmd = (
    f"ffmpeg -y -framerate {FPS} "
    f"-i {FRAMES_DIR}/frame_%04d.png "
    f"-i {audio_path} "
    f"-c:v libx264 -pix_fmt yuv420p -c:a aac "
    f"{mp4_path}"
)

print(f"\nEncoding MP4...")
os.system(cmd)
print(f"MP4 saved to: {mp4_path}")

# Cleanup frames
import shutil
print(f"\nCleaning up frames...")
shutil.rmtree(FRAMES_DIR)
print("Done!")
