#!/usr/bin/env python3
"""
NPR-OS Sūtra 1.7: अविद्यास्मितारागद्वेषाभिनिवेशाः क्लिष्टाः
"The five painful kleshas: ignorance, egoism, attachment, aversion, clinging"

121 bytes → 164 Base64 → 162 notes (strip 2 padding)
Digital root: 2 | Visarga: ः ×2
Theme: Five kleshas enumerated — the root causes of suffering
Synth: Five distinct tonal zones, each klesha gets its own character
"""

import struct, math, os, subprocess
import numpy as np
import base64

# ─── Sūtra ───
SUTRA = "अविद्यास्मितारागद्वेषाभिनिवेशाः क्लिष्टाः"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
WAV_PATH = os.path.join(OUTPUT_DIR, "01_07_standard_synth.wav")
MP4_PATH = os.path.join(OUTPUT_DIR, "01_07_standard_synth.mp4")

# ─── Base64 → Notes ───
b64_str = base64.b64encode(SUTRA.encode('utf-8')).decode('ascii')
b64_chars = [c for c in b64_str if c != '=']
N = len(b64_chars)

B64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
freqs = []
for c in b64_chars:
    idx = B64_MAP.index(c)
    freq = 55 + idx * (1045 / 63)
    freqs.append(freq)

print(f"Sūtra 1.7: {SUTRA}")
print(f"Notes: {N} | Freq range: {min(freqs):.1f}-{max(freqs):.1f} Hz | Mean: {sum(freqs)/len(freqs):.1f} Hz")
print(f"Digital root: 2 | Padding: {len(b64_str) - N}")

# ─── Five Klesha Zones ───
# Divide notes into 5 zones (one per klesha) + final "kliṣṭāḥ" marker
# अविद्या (1-32) | अस्मित (33-65) | रग (66-97) | द्वेष (98-129) | अभिनिवेश (130-152) | क्लिष्टाः (153-162)
KLESHAS = [
    ("अविद्या", "ignorance", 0, 32, "dull, muddy"),
    ("अस्मित", "egoism", 33, 65, "rigid, separate"),
    ("राग", "attachment", 66, 97, "sticky, sweet"),
    ("द्वेष", "aversion", 98, 129, "sharp, repelling"),
    ("अभिनिवेश", "clinging", 130, 152, "gripping, fearful"),
]
KLISHTA_START = 153

def klesha_zone(idx):
    """Return klesha name for note index"""
    for name, eng, start, end, _ in KLESHAS:
        if start <= idx <= end:
            return name, eng
    return "क्लिष्टाः", "painful summary"

def generate_note_klesha(freq, duration, sr, note_idx, total_notes):
    """Generate note with klesha-specific character"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    pos = note_idx / max(total_notes - 1, 1)
    
    name, eng = klesha_zone(note_idx)
    
    # Base signal
    signal = np.sin(2 * np.pi * freq * t)
    
    # Klesha-specific modifications
    if name == "अविद्या":
        # Ignorance: low-pass muffled, missing harmonics
        signal = signal * 0.6  # quieter
        # Add sub-octave drone
        signal += np.sin(2 * np.pi * freq * 0.5 * t) * 0.3
    elif name == "अस्मित":
        # Egoism: harsh square-wave edge, separation
        signal = np.sign(signal) * 0.5
        # Add slight detune for "separate self" feeling
        signal += np.sin(2 * np.pi * freq * 1.01 * t) * 0.2
    elif name == "राग":
        # Attachment: warm, sticky, lingering
        signal = signal * 0.8
        # Add octave above (sweetness)
        signal += np.sin(2 * np.pi * freq * 2 * t) * 0.25
        # Slower decay
        pass
    elif name == "द्वेष":
        # Aversion: dissonant, sharp, repelling
        signal = signal * 0.7
        # Add minor 2nd dissonance
        signal += np.sin(2 * np.pi * freq * (16/15) * t) * 0.3
        # Add noise
        signal += np.random.randn(len(t)) * 0.1
    elif name == "अभिनिवेश":
        # Clinging: gripping tremolo, fearful
        signal = signal * 0.7
        # Tremolo (fear vibration)
        tremolo = 1 + 0.3 * np.sin(2 * np.pi * 6 * t)
        signal = signal * tremolo
    else:
        # kliṣṭāḥ summary: return to harsh reality
        signal = signal * 0.8
        signal += np.sin(2 * np.pi * freq * 1.5 * t) * 0.2
    
    # Envelope
    attack = 0.015
    attack_samples = int(sr * attack)
    env_attack = np.linspace(0.2, 1.0, attack_samples)
    env_rest = np.ones(len(t) - attack_samples)
    decay_rate = 2.5 if name != "राग" else 1.5  # attachment lingers
    env_decay = np.exp(-decay_rate * t / duration)
    
    envelope = np.concatenate([env_attack, env_rest])[:len(t)]
    envelope = envelope * env_decay
    
    signal = signal * envelope
    
    # Gap
    gap_samples = int(sr * 0.04)
    signal = np.concatenate([signal, np.zeros(gap_samples)])
    
    return signal

# ─── Generate ───
NOTE_DURATION = 0.28  # faster for 162 notes
GAP = 0.04
SAMPLE_RATE = 44100

print("Synthesizing 5 kleshas...")
all_notes = []
for i, freq in enumerate(freqs):
    note = generate_note_klesha(freq, NOTE_DURATION, SAMPLE_RATE, i, N)
    all_notes.append(note)

audio = np.concatenate(all_notes)
audio = audio / (np.max(np.abs(audio)) * 1.1)

total_time = N * (NOTE_DURATION + GAP)
print(f"Total duration: {total_time:.1f}s")

# ─── Write WAV ───
with open(WAV_PATH, 'wb') as f:
    f.write(b'RIFF')
    chunk_size = 4 + (8 + 24 + 8 + len(audio) * 2)
    f.write(struct.pack('<I', chunk_size))
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
    f.write(struct.pack('<I', len(audio) * 2))
    samples = np.int16(audio * 32767)
    f.write(samples.tobytes())

print(f"WAV: {WAV_PATH} ({os.path.getsize(WAV_PATH)/1024:.0f}KB)")

# ─── Mandala: Five Petals + Center ───
from PIL import Image, ImageDraw, ImageFont
import colorsys

WIDTH, HEIGHT = 1280, 720
CENTER = (WIDTH // 2, HEIGHT // 2)
MAX_RADIUS = 260

KLESHA_COLORS = {
    "अविद्या": (80, 80, 120),    # dull purple - ignorance
    "अस्मित": (180, 60, 60),     # red - ego
    "राग": (200, 160, 60),       # golden - attachment
    "द्वेष": (60, 60, 180),       # cold blue - aversion
    "अभिनिवेश": (100, 60, 120),  # deep purple - clinging
    "क्लिष्टाः": (200, 80, 80),   # harsh red - painful
}

def freq_to_hsl(freq):
    h = ((freq - 55) / 1045) * 360
    return h, 0.75, 0.35 + 0.35 * ((freq - 55) / 1045)

frames = []
frame_duration = 0.4
total_frames = math.ceil(total_time / frame_duration)

for frame_idx in range(total_frames):
    img = Image.new('RGB', (WIDTH, HEIGHT), '#08080f')
    draw = ImageDraw.Draw(img)
    
    t_current = frame_idx * frame_duration
    
    # Background: five-sector wheel
    for sector in range(5):
        angle_start = sector * 72 - 90
        angle_end = (sector + 1) * 72 - 90
        color = list(KLESHA_COLORS.values())[sector]
        for r in range(50, MAX_RADIUS + 30, 5):
            alpha = 1 - (r / (MAX_RADIUS + 30))
            c = tuple(int(ch * alpha * 0.4) for ch in color)
            draw.arc(
                [CENTER[0] - r, CENTER[1] - r, CENTER[0] + r, CENTER[1] + r],
                angle_start, angle_end,
                fill=c, width=5
            )
    
    # Active notes
    notes_active = []
    for i in range(N):
        note_start = i * (NOTE_DURATION + GAP)
        note_end = note_start + NOTE_DURATION
        if note_start <= t_current < note_end:
            notes_active.append(i)
    
    # Draw active notes
    for note_idx in notes_active:
        freq = freqs[note_idx]
        name, _ = klesha_zone(note_idx)
        color = KLESHA_COLORS.get(name, (200, 200, 200))
        
        radius = MAX_RADIUS * ((freq - 55) / 1045) ** 0.5
        angle = (note_idx / N) * 360 + t_current * 1.5
        
        x = CENTER[0] + radius * math.cos(math.radians(angle))
        y = CENTER[1] + radius * math.sin(math.radians(angle))
        
        for r in range(8, 0, -1):
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color)
    
    # Sector labels
    devanagari_font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", 18)
    latin_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    
    for i, (name, eng, _, _, _) in enumerate(KLESHAS):
        angle = i * 72 - 45
        r = MAX_RADIUS + 40
        x = CENTER[0] + r * math.cos(math.radians(angle))
        y = CENTER[1] + r * math.sin(math.radians(angle))
        color = KLESHA_COLORS[name]
        draw.text((int(x - 30), int(y)), f"{name}", fill=color, font=devanagari_font)
        draw.text((int(x - 30), int(y + 20)), eng, fill=(150, 150, 170), font=latin_font)
    
    # Current klesha highlight
    if notes_active:
        curr_name, curr_eng = klesha_zone(notes_active[0])
        draw.rectangle([20, 10, 400, 40], fill=(20, 20, 30))
        draw.text((25, 14), f"● {curr_name} — {curr_eng}", fill=KLESHA_COLORS.get(curr_name, (200,200,200)),
                 font=devanagari_font)
    
    # Sutra text
    draw.text((20, HEIGHT - 35), f"1.7 — {SUTRA}", fill=(180, 180, 200), 
             font=ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", 18))
    
    # Progress
    progress = frame_idx / total_frames
    bar_width = int(WIDTH * 0.5 * progress)
    draw.rectangle([WIDTH // 2 - WIDTH // 4, HEIGHT - 15, 
                    WIDTH // 2 - WIDTH // 4 + bar_width, HEIGHT - 5], 
                   fill=(100, 100, 200))
    
    frames.append(img)

# ─── Encode ───
if frames:
    tmp_dir = os.path.join(OUTPUT_DIR, "tmp_frames_1_7")
    os.makedirs(tmp_dir, exist_ok=True)
    for fi, img in enumerate(frames):
        img.save(os.path.join(tmp_dir, f"frame_{fi:04d}.png"))
    
    cmd = [
        "ffmpeg", "-y",
        "-r", str(int(1/frame_duration)),
        "-i", os.path.join(tmp_dir, "frame_%04d.png"),
        "-i", WAV_PATH,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", MP4_PATH
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    for f in os.listdir(tmp_dir):
        os.remove(os.path.join(tmp_dir, f))
    os.rmdir(tmp_dir)
    print(f"MP4: {MP4_PATH} ({os.path.getsize(MP4_PATH)/1024/1024:.1f}MB)")

# ─── Analysis ───
print(f"\n=== Sūtra 1.7 Analysis ===")
for name, eng, start, end, char in KLESHAS:
    count = end - start + 1
    zone_freqs = freqs[start:end+1]
    print(f"  {name} ({eng}): notes {start}-{end} ({count}) | mean {sum(zone_freqs)/len(zone_freqs):.0f}Hz | {char}")
klishta_freqs = freqs[KLISHTA_START:]
print(f"  क्लिष्टाः (summary): notes {KLISHTA_START}-{N-1} ({N-KLISHTA_START}) | mean {sum(klishta_freqs)/len(klishta_freqs):.0f}Hz")
